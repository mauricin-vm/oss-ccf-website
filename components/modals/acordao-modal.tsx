'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface AcordaoModalProps {
  processoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface AcordaoData {
  id?: string
  numeroAcordao?: string | null
  dataPublicacao?: string | null
  numeroPublicacao?: string | null
}

interface AcordaoForm {
  numeroAcordao: string
  dataPublicacao: string
  numeroPublicacao: string
}

export default function AcordaoModal({
  processoId,
  open,
  onOpenChange,
  onSuccess
}: AcordaoModalProps) {
  const [formData, setFormData] = useState<AcordaoForm>({
    numeroAcordao: '',
    dataPublicacao: '',
    numeroPublicacao: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [acordaoExistente, setAcordaoExistente] = useState<AcordaoData | null>(null)

  const handleInputChange = (field: keyof AcordaoForm, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    // Limpar erro visual do campo quando o usuário começar a digitar
    clearFieldError(field)
  }

  const validateAndFocus = () => {
    const errors: string[] = []
    let firstErrorField = ''

    // Ordem dos campos para validação e foco
    if (!formData.numeroAcordao.trim()) {
      errors.push('Número do Acórdão é obrigatório')
      if (!firstErrorField) firstErrorField = 'numeroAcordao'
    }
    if (!formData.dataPublicacao.trim()) {
      errors.push('Data de Publicação é obrigatória')
      if (!firstErrorField) firstErrorField = 'dataPublicacao'
    }
    if (!formData.numeroPublicacao.trim()) {
      errors.push('Número da Publicação é obrigatório')
      if (!firstErrorField) firstErrorField = 'numeroPublicacao'
    }

    if (errors.length > 0) {
      toast.warning(errors[0])

      // Aplicar bordas vermelhas e focar no primeiro campo com erro
      setTimeout(() => {
        const element = document.getElementById(firstErrorField)
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
          element.setAttribute('data-error', 'true')
        }
      }, 100)

      return false
    }
    return true
  }

  const clearFieldError = (fieldId: string) => {
    const element = document.getElementById(fieldId)
    if (element) {
      element.style.borderColor = ''
      element.style.boxShadow = ''
      element.removeAttribute('data-error')
    }
  }

  const loadAcordaoData = useCallback(async () => {
    try {
      setIsLoadingData(true)
      const response = await fetch(`/api/processos/${processoId}/acordao`)

      if (response.ok) {
        const data = await response.json()

        if (data.acordao) {
          setAcordaoExistente(data.acordao)

          // Preencher formulário com dados existentes
          setFormData({
            numeroAcordao: data.acordao.numeroAcordao || '',
            numeroPublicacao: data.acordao.numeroPublicacao || '',
            dataPublicacao: data.acordao.dataPublicacao
              ? new Date(data.acordao.dataPublicacao).toISOString().split('T')[0]
              : ''
          })
        } else {
          setAcordaoExistente(null)
          setFormData({
            numeroAcordao: '',
            dataPublicacao: '',
            numeroPublicacao: ''
          })
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados do acórdão:', error)
      toast.error('Erro ao carregar dados do acórdão')
    } finally {
      setIsLoadingData(false)
    }
  }, [processoId])

  // Carregar dados do acórdão quando o modal abrir
  useEffect(() => {
    if (open && processoId) {
      loadAcordaoData()
    }
  }, [open, processoId, loadAcordaoData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateAndFocus()) {
      return
    }

    setIsSubmitting(true)

    try {
      // Preparar dados para envio
      const requestData = {
        numeroAcordao: formData.numeroAcordao.trim(),
        dataPublicacao: formData.dataPublicacao.trim(),
        numeroPublicacao: formData.numeroPublicacao.trim()
      }

      // Determinar método e URL
      const method = acordaoExistente ? 'PUT' : 'POST'
      const response = await fetch(`/api/processos/${processoId}/acordao`, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar acórdão')
      }

      const responseData = await response.json()

      toast.success(responseData.message)
      onSuccess()
      handleClose()

    } catch (error) {
      console.error('Erro ao salvar acórdão:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar acórdão')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!acordaoExistente) return

    if (!confirm('Tem certeza que deseja excluir este acórdão?')) {
      return
    }

    try {
      setIsSubmitting(true)

      const response = await fetch(`/api/processos/${processoId}/acordao`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao excluir acórdão')
      }

      const responseData = await response.json()

      toast.success(responseData.message)
      onSuccess()
      handleClose()

    } catch (error) {
      console.error('Erro ao excluir acórdão:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir acórdão')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setFormData({
      numeroAcordao: '',
      dataPublicacao: '',
      numeroPublicacao: ''
    })
    setAcordaoExistente(null)
    // Limpar erros visuais
    clearFieldError('numeroAcordao')
    clearFieldError('dataPublicacao')
    clearFieldError('numeroPublicacao')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {acordaoExistente ? 'Editar Acórdão' : 'Adicionar Acórdão'}
          </DialogTitle>
          <DialogDescription>
            {acordaoExistente
              ? 'Edite as informações do acórdão publicado'
              : 'Informe os dados do acórdão publicado para este processo'
            }
          </DialogDescription>
        </DialogHeader>

        {isLoadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2">Carregando...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="numeroAcordao">Número do Acórdão <span className="text-red-500">*</span></Label>
              <Input
                id="numeroAcordao"
                value={formData.numeroAcordao}
                onChange={(e) => handleInputChange('numeroAcordao', e.target.value)}
                onFocus={() => clearFieldError('numeroAcordao')}
                placeholder="Ex: AC-2024-001"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataPublicacao">Data de Publicação <span className="text-red-500">*</span></Label>
              <Input
                id="dataPublicacao"
                type="date"
                value={formData.dataPublicacao}
                onChange={(e) => handleInputChange('dataPublicacao', e.target.value)}
                onFocus={() => clearFieldError('dataPublicacao')}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeroPublicacao">Número da Publicação <span className="text-red-500">*</span></Label>
              <Input
                id="numeroPublicacao"
                value={formData.numeroPublicacao}
                onChange={(e) => handleInputChange('numeroPublicacao', e.target.value)}
                onFocus={() => clearFieldError('numeroPublicacao')}
                placeholder="Ex: DOM-2024-15486"
                disabled={isSubmitting}
                required
              />
            </div>

            <DialogFooter>
              {acordaoExistente && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="cursor-pointer mr-auto"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Excluir
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {acordaoExistente ? 'Atualizando...' : 'Salvando...'}
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    {acordaoExistente ? 'Atualizar' : 'Salvar'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
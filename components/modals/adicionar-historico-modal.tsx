'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, History } from 'lucide-react'
import { toast } from 'sonner'

interface AdicionarHistoricoModalProps {
  processoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface HistoricoForm {
  titulo: string
  descricao: string
  tipo: string
}

const tiposHistorico = [
  { value: 'EVENTO', label: 'Evento' },
  { value: 'OBSERVACAO', label: 'Observação' },
  { value: 'ALTERACAO', label: 'Alteração' },
  { value: 'COMUNICACAO', label: 'Comunicação' },
  { value: 'DECISAO', label: 'Decisão' },
  { value: 'SISTEMA', label: 'Sistema' }
]

export default function AdicionarHistoricoModal({
  processoId,
  open,
  onOpenChange,
  onSuccess
}: AdicionarHistoricoModalProps) {
  const [formData, setFormData] = useState<HistoricoForm>({
    titulo: '',
    descricao: '',
    tipo: 'EVENTO'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (field: keyof HistoricoForm, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setError(null)
    // Limpar erro visual do campo quando o usuário começar a digitar
    if (field === 'titulo') clearFieldError('titulo')
    if (field === 'descricao') clearFieldError('descricao')
  }

  const validateAndFocus = () => {
    const errors: string[] = []
    let firstErrorField = ''

    // Ordem dos campos para validação e foco
    if (!formData.titulo.trim()) {
      errors.push('Título é obrigatório')
      if (!firstErrorField) firstErrorField = 'titulo'
    }
    if (!formData.descricao.trim()) {
      errors.push('Descrição é obrigatória')
      if (!firstErrorField) firstErrorField = 'descricao'
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateAndFocus()) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/processos/${processoId}/historico`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao adicionar histórico')
      }

      toast.success('Histórico adicionado com sucesso')
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Erro ao adicionar histórico:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar histórico')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setFormData({
      titulo: '',
      descricao: '',
      tipo: 'EVENTO'
    })
    setError(null)
    // Limpar erros visuais
    clearFieldError('titulo')
    clearFieldError('descricao')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Adicionar Histórico
          </DialogTitle>
          <DialogDescription>
            Adicione um novo evento ou observação ao histórico do processo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo <span className="text-red-500">*</span></Label>
            <Select
              value={formData.tipo}
              onValueChange={(value) => handleInputChange('tipo', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tiposHistorico.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="titulo">Título <span className="text-red-500">*</span></Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => handleInputChange('titulo', e.target.value)}
              onFocus={() => clearFieldError('titulo')}
              placeholder="Digite o título do histórico"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição <span className="text-red-500">*</span></Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleInputChange('descricao', e.target.value)}
              onFocus={() => clearFieldError('descricao')}
              placeholder="Descreva detalhadamente o evento ou observação"
              disabled={isSubmitting}
              rows={4}
              required
            />
          </div>

          <DialogFooter>
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
                  Adicionando...
                </>
              ) : (
                <>
                  <History className="mr-2 h-4 w-4" />
                  Adicionar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
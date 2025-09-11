'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface AlterarStatusModalProps {
  processoId: string
  statusAtual: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const statusOptions = [
  { value: 'RECEPCIONADO', label: 'Recepcionado', color: 'bg-gray-100 text-gray-800' },
  { value: 'EM_ANALISE', label: 'Em Análise', color: 'bg-blue-100 text-blue-800' },
  { value: 'AGUARDANDO_DOCUMENTOS', label: 'Aguardando Documentos', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'EM_PAUTA', label: 'Em Pauta', color: 'bg-purple-100 text-purple-800' },
  { value: 'JULGADO', label: 'Julgado', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'ACORDO_FIRMADO', label: 'Acordo Firmado', color: 'bg-green-100 text-green-800' },
  { value: 'EM_CUMPRIMENTO', label: 'Em Cumprimento', color: 'bg-orange-100 text-orange-800' },
  { value: 'FINALIZADO', label: 'Finalizado', color: 'bg-green-100 text-green-800' },
  { value: 'ARQUIVADO', label: 'Arquivado', color: 'bg-gray-100 text-gray-800' }
]

export default function AlterarStatusModal({
  processoId,
  statusAtual,
  open,
  onOpenChange,
  onSuccess
}: AlterarStatusModalProps) {
  const [novoStatus, setNovoStatus] = useState(statusAtual)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (novoStatus === statusAtual) {
      setError('Selecione um status diferente do atual')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/processos/${processoId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: novoStatus })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao alterar status')
      }

      const statusAnterior = statusOptions.find(s => s.value === statusAtual)?.label
      const statusNovo = statusOptions.find(s => s.value === novoStatus)?.label
      
      toast.success(`Status alterado de ${statusAnterior} para ${statusNovo}`)
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Erro ao alterar status:', error)
      setError(error instanceof Error ? error.message : 'Erro ao alterar status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setNovoStatus(statusAtual)
    setError(null)
    onOpenChange(false)
  }

  const statusAtualLabel = statusOptions.find(s => s.value === statusAtual)?.label

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Alterar Status do Processo
          </DialogTitle>
          <DialogDescription>
            Altere o status do processo. Esta ação será registrada no histórico.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Status Atual</Label>
            <div className={`px-3 py-2 rounded-md text-sm font-medium ${
              statusOptions.find(s => s.value === statusAtual)?.color
            }`}>
              {statusAtualLabel}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Novo Status *</Label>
            <Select
              value={novoStatus}
              onValueChange={setNovoStatus}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o novo status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem 
                    key={status.value} 
                    value={status.value}
                    disabled={status.value === statusAtual}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                        {status.label}
                      </div>
                      {status.value === statusAtual && (
                        <span className="text-xs text-gray-500">(atual)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {novoStatus !== statusAtual && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Você está alterando o status de <strong>{statusAtualLabel}</strong> para{' '}
                <strong>{statusOptions.find(s => s.value === novoStatus)?.label}</strong>.
                Esta ação será registrada no histórico do processo.
              </AlertDescription>
            </Alert>
          )}

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
              disabled={isSubmitting || novoStatus === statusAtual}
              className="cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Alterar Status
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
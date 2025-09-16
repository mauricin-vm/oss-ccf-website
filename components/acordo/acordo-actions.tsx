'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  MoreHorizontal,
  X,
  Trash2,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface AcordoActionsProps {
  acordo: {
    id: string
    status: string
    parcelas: Array<{
      id: string
      pagamentos: Array<{ id: string; valorPago: number }>
    }>
    valorFinal: number
  }
}

export default function AcordoActions({ acordo }: AcordoActionsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [error, setError] = useState<string | null>(null)


  // Verificar se há algum valor pago
  const valorTotalPago = acordo.parcelas.reduce((total, parcela) => {
    return total + (parcela.pagamentos || []).reduce((subtotal, pagamento) => {
      return subtotal + pagamento.valorPago
    }, 0)
  }, 0)

  const canCancel = acordo.status === 'ativo'
  const canDelete = valorTotalPago === 0 && acordo.status !== 'cumprido'

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!motivoCancelamento.trim()) {
      setError('Motivo do cancelamento é obrigatório')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/acordos/${acordo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'cancelado',
          motivoCancelamento: motivoCancelamento.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao cancelar acordo')
      }

      toast.success('Acordo cancelado com sucesso!')
      handleCloseCancelDialog()
      router.refresh()
    } catch (error) {
      console.error('Erro ao cancelar acordo:', error)
      setError(error instanceof Error ? error.message : 'Erro ao cancelar acordo')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseCancelDialog = () => {
    setMotivoCancelamento('')
    setError(null)
    setShowCancelDialog(false)
  }

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/acordos/${acordo.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao deletar acordo')
      }

      toast.success('Acordo deletado com sucesso!')
      router.push('/acordos')
    } catch (error) {
      console.error('Erro ao deletar acordo:', error)
      setError(error instanceof Error ? error.message : 'Erro ao deletar acordo')
    } finally {
      setIsLoading(false)
      setShowDeleteDialog(false)
    }
  }

  const handleCloseDeleteDialog = () => {
    setError(null)
    setShowDeleteDialog(false)
  }


  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={isLoading} className="cursor-pointer">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">


          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                setError(null)
                setShowCancelDialog(true)
              }} className="cursor-pointer">
                <X className="mr-2 h-4 w-4" />
                Cancelar Acordo
              </DropdownMenuItem>
            </>
          )}

          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setError(null)
                  setShowDeleteDialog(true)
                }}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Deletar Acordo
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog de Cancelar */}
      <Dialog open={showCancelDialog} onOpenChange={handleCloseCancelDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-yellow-600" />
              Cancelar Acordo de Pagamento
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar este acordo? O processo voltará ao status anterior
              e todas as parcelas pendentes serão canceladas.
              <br /><br />
              <strong>Esta ação não pode ser desfeita.</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCancel} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo do cancelamento <span className="text-red-500">*</span></Label>
              <Textarea
                id="motivo"
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                placeholder="Descreva o motivo do cancelamento do acordo..."
                disabled={isLoading}
                rows={3}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseCancelDialog}
                disabled={isLoading}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-yellow-600 hover:bg-yellow-700 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Cancelar Acordo
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Deletar */}
      <Dialog open={showDeleteDialog} onOpenChange={handleCloseDeleteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Deletar Acordo de Pagamento
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar este acordo? O processo voltará ao status anterior.
              Esta ação só é possível porque o acordo ainda não tem pagamentos registrados.
              <br /><br />
              <strong>Esta ação não pode ser desfeita.</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDelete} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDeleteDialog}
                disabled={isLoading}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deletando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Deletar Acordo
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  MoreHorizontal, 
  Edit,
  Trash2, 
  Loader2 
} from 'lucide-react'
import { toast } from 'sonner'
import { formatLocalDate } from '@/lib/utils/date'

interface PautaActionsProps {
  pauta: {
    id: string
    numero: string
    status: string
    dataPauta: string
    processos: Record<string, unknown>[]
  }
  userRole: string
  onEdit: () => void
}

export default function PautaActions({ pauta, userRole, onEdit }: PautaActionsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Só permite editar/deletar se for ADMIN ou FUNCIONARIO
  const canEdit = userRole === 'ADMIN' || userRole === 'FUNCIONARIO'
  
  // Só permite deletar se for ADMIN e se a pauta estiver aberta e sem sessão
  const canDelete = userRole === 'ADMIN' && pauta.status === 'aberta'

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/pautas/${pauta.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao excluir pauta')
      }

      toast.success('Pauta excluída com sucesso!')
      router.push('/pautas')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
      setShowDeleteDialog(false)
    }
  }

  if (!canEdit) {
    return null
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
          <DropdownMenuItem 
            onClick={onEdit}
            className="cursor-pointer"
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar Pauta
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir Pauta
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog de Excluir */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pauta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a pauta <strong>{pauta.numero}</strong> 
              agendada para <strong>{formatLocalDate(pauta.dataPauta)}</strong>?
              <br /><br />
              {pauta.processos.length > 0 && (
                <>
                  Esta pauta contém <strong>{pauta.processos.length}</strong> processo(s). 
                  Os processos não serão deletados, mas serão removidos desta pauta.
                  <br /><br />
                </>
              )}
              Todos os dados da pauta e histórico serão permanentemente removidos.
              <br /><br />
              <strong>Esta ação não pode ser desfeita.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir Pauta'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
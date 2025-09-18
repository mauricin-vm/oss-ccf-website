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
  CheckCircle, 
  Trash2, 
  Loader2 
} from 'lucide-react'
import { toast } from 'sonner'

interface SessaoActionsProps {
  sessao: {
    id: string
    dataFim: Date | null
    decisoes: Array<{ id: string }>
    pauta?: {
      processos: Array<{ id: string }>
    } | null
    tipoSessao?: string
  }
}

export default function SessaoActions({ sessao }: SessaoActionsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const isActive = !sessao.dataFim
  const totalProcessos = sessao.pauta?.processos.length || 0
  const processosJulgados = sessao.decisoes.length

  // Para sessões de julgamento, pode finalizar quando todos os processos foram julgados
  // Para sessões administrativas, pode finalizar a qualquer momento
  const canFinalize = isActive && (
    sessao.tipoSessao === 'ADMINISTRATIVA' ||
    (totalProcessos > 0 && processosJulgados === totalProcessos)
  )
  const canDelete = sessao.decisoes.length === 0 && isActive

  // Se não há nenhuma ação disponível, não mostrar o botão
  if (!canFinalize && !canDelete) {
    return null
  }

  const handleFinalizar = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/sessoes/${sessao.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataFim: new Date().toISOString()
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao finalizar sessão')
      }

      toast.success('Sessão finalizada com sucesso!')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
      setShowFinalizarDialog(false)
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/sessoes/${sessao.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao deletar sessão')
      }

      toast.success('Sessão deletada com sucesso!')
      router.push('/sessoes')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
      setShowDeleteDialog(false)
    }
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
          {isActive && canFinalize && (
            <DropdownMenuItem onClick={() => setShowFinalizarDialog(true)} className="cursor-pointer">
              <CheckCircle className="mr-2 h-4 w-4" />
              Finalizar Sessão
            </DropdownMenuItem>
          )}
          
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Deletar Sessão
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog de Finalizar */}
      <AlertDialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Finalizar {sessao.tipoSessao === 'ADMINISTRATIVA' ? 'Sessão Administrativa' : 'Sessão de Julgamento'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sessao.tipoSessao === 'ADMINISTRATIVA' ? (
                <>
                  Tem certeza que deseja finalizar esta sessão administrativa?
                  A sessão será marcada como finalizada.
                </>
              ) : (
                <>
                  Tem certeza que deseja finalizar esta sessão? Todos os {totalProcessos} processos
                  foram julgados e a sessão será marcada como finalizada.
                </>
              )}
              <br /><br />
              <strong>Esta ação não pode ser desfeita.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading} className="cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleFinalizar}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finalizando...
                </>
              ) : (
                'Finalizar Sessão'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Deletar */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deletar {sessao.tipoSessao === 'ADMINISTRATIVA' ? 'Sessão Administrativa' : 'Sessão de Julgamento'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {sessao.tipoSessao === 'ADMINISTRATIVA' ? (
                <>
                  Tem certeza que deseja deletar esta sessão administrativa?
                </>
              ) : (
                <>
                  Tem certeza que deseja deletar esta sessão? A pauta voltará ao status &quot;aberta&quot;
                  e poderá ser utilizada para criar uma nova sessão.
                </>
              )}
              <br /><br />
              <strong>Esta ação não pode ser desfeita.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading} className="cursor-pointer">
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
                  Deletando...
                </>
              ) : (
                'Deletar Sessão'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
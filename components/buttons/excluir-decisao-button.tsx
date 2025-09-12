'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface ExcluirDecisaoButtonProps {
  sessaoId: string
  decisaoId: string
  onSuccess?: () => void
}

export default function ExcluirDecisaoButton({ 
  sessaoId, 
  decisaoId, 
  onSuccess 
}: ExcluirDecisaoButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleExcluir = async () => {
    if (!confirm('Tem certeza que deseja excluir esta decisão? Esta ação não pode ser desfeita.')) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/sessoes/${sessaoId}/decisoes/${decisaoId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Decisão excluída com sucesso!')
        if (onSuccess) {
          onSuccess()
        } else {
          window.location.reload()
        }
      } else {
        const errorData = await response.json()
        toast.error('Erro ao excluir decisão: ' + errorData.error)
      }
    } catch (error) {
      toast.error('Erro inesperado ao excluir decisão')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button
      onClick={handleExcluir}
      disabled={isDeleting}
      className="text-red-600 hover:text-red-700 hover:bg-red-50 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 rounded"
    >
      {isDeleting ? 'Excluindo...' : 'Excluir'}
    </button>
  )
}
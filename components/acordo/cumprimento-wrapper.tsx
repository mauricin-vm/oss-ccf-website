'use client'

import { useState } from 'react'
import CumprimentoDetalhes from './cumprimento-detalhes'

interface CumprimentoWrapperProps {
  acordoId: string
  detalhes: any[]
}

export default function CumprimentoWrapper({ acordoId, detalhes }: CumprimentoWrapperProps) {
  const [detalhesAtualizados, setDetalhesAtualizados] = useState(detalhes)

  const handleStatusUpdate = async (detalheId: string, novoStatus: string, observacoes?: string) => {
    try {
      const response = await fetch(`/api/acordos/${acordoId}/detalhes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          detalheId,
          status: novoStatus,
          observacoes
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar status')
      }

      const { detalhe } = await response.json()

      // Atualizar o detalhe na lista local
      setDetalhesAtualizados(prev =>
        prev.map(d => d.id === detalheId ? detalhe : d)
      )

      // Recarregar a página para atualizar outros dados dependentes
      window.location.reload()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      alert('Erro ao atualizar status do detalhe')
    }
  }

  return (
    <CumprimentoDetalhes
      acordoId={acordoId}
      detalhes={detalhesAtualizados}
      onStatusUpdate={handleStatusUpdate}
    />
  )
}
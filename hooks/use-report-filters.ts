'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { FiltersState } from '@/components/reports/filters-panel'
import { toast } from 'sonner'

export function useReportFilters(initialData: {
  totais: {
    processos: number
    pautas: number
    sessoes: number
    acordos: number
  }
  parcelas: {
    total: number
    abertas: number
    vencidas: number
    pagas: number
  }
  processosPorTipo: Array<{ tipo: string; _count: number }>
  processosPorStatus: Array<{ status: string; _count: number }>
  sessoesAtivas: number
  acordosVencidos: number
  valores: {
    totalAcordos: number
    recebido: number
  }
  decisoesPorTipo: Array<{ tipoDecisao: string | null; _count: { id: number } }>
  valoresPorTipoProcesso: Array<{ tipo: string; _count: number; _sum: { valorTotal: number } }>
  valoresPorResultado: Array<{ tipoDecisao: string | null; valorTotal: number }>
  evolucaoMensal: Array<{
    mes: number
    ano: number
    valor: number
    acordos: { valor: number; quantidade: number }
    parcelas: { valor: number; quantidade: number }
    total: { valor: number; quantidade: number }
  }>
}) {
  const [filters, setFilters] = useState<FiltersState>({
    dataInicio: undefined,
    dataFim: undefined,
    tiposProcesso: [],
    statusProcesso: [],
    statusParcelas: [],
    tiposDecisao: [],
    valorMinimo: undefined,
    valorMaximo: undefined
  })

  const [filteredData, setFilteredData] = useState(initialData)
  const [loading, setLoading] = useState(false)
  const previousFiltersRef = useRef<FiltersState>(filters)

  const activeFiltersCount = useMemo(() => {
    let count = 0

    if (filters.dataInicio) count++
    if (filters.dataFim) count++
    if (filters.tiposProcesso.length > 0) count += filters.tiposProcesso.length
    if (filters.statusProcesso.length > 0) count += filters.statusProcesso.length
    if (filters.statusParcelas.length > 0) count += filters.statusParcelas.length
    if (filters.tiposDecisao.length > 0) count += filters.tiposDecisao.length
    if (filters.valorMinimo !== undefined) count++
    if (filters.valorMaximo !== undefined) count++

    return count
  }, [filters])

  // Buscar dados filtrados quando os filtros de data mudarem
  useEffect(() => {
    // Verificar se havia filtros anteriormente
    const hadPreviousFilters = previousFiltersRef.current.dataInicio || previousFiltersRef.current.dataFim
    const hasCurrentFilters = filters.dataInicio || filters.dataFim

    if (hasCurrentFilters) {
      const fetchFilteredData = async () => {
        setLoading(true)
        try {
          const params = new URLSearchParams()
          if (filters.dataInicio) params.append('dataInicio', filters.dataInicio.toISOString())
          if (filters.dataFim) params.append('dataFim', filters.dataFim.toISOString())

          const response = await fetch(`/api/relatorios?${params}`)
          if (response.ok) {
            const data = await response.json()
            setFilteredData(data)
            toast.success('Dados atualizados com sucesso!')
          } else {
            toast.error('Erro ao carregar dados filtrados')
          }
        } catch (error) {
          console.error('Erro ao buscar dados filtrados:', error)
          toast.error('Erro ao carregar dados filtrados')
        } finally {
          setLoading(false)
        }
      }

      fetchFilteredData()
    } else {
      // Se não há filtro de data ativo, usar dados iniciais
      setFilteredData(initialData)
      // Mostrar toast de sucesso quando voltar aos dados iniciais (se havia filtros antes)
      if (hadPreviousFilters) {
        toast.success('Dados atualizados com sucesso!')
      }
    }

    // Atualizar a referência dos filtros anteriores
    previousFiltersRef.current = filters
  }, [filters, initialData])

  return {
    filters,
    setFilters,
    activeFiltersCount,
    data: filteredData,
    loading
  }
}
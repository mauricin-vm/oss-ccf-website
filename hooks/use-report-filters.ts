'use client'

import { useState, useMemo, useEffect } from 'react'
import { FiltersState } from '@/components/reports/filters-panel'

export function useReportFilters(initialData: any) {
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
    if (filters.dataInicio || filters.dataFim) {
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
          }
        } catch (error) {
          console.error('Erro ao buscar dados filtrados:', error)
        } finally {
          setLoading(false)
        }
      }

      fetchFilteredData()
    } else {
      // Se não há filtro de data ativo, usar dados iniciais
      setFilteredData(initialData)
    }
  }, [filters.dataInicio, filters.dataFim, initialData])

  return {
    filters,
    setFilters,
    activeFiltersCount,
    data: filteredData,
    loading
  }
}
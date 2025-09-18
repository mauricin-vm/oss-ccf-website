'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { CalendarIcon, Filter, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface FiltersState {
  dataInicio?: Date
  dataFim?: Date
  tiposProcesso: string[]
  statusProcesso: string[]
  statusParcelas: string[]
  tiposDecisao: string[]
  valorMinimo?: number
  valorMaximo?: number
}

interface FiltersPanelProps {
  filters: FiltersState
  onFiltersChange: (filters: FiltersState) => void
  activeFiltersCount: number
}

export function FiltersPanel({ filters, onFiltersChange }: FiltersPanelProps) {
  const [showStartCalendar, setShowStartCalendar] = useState(false)
  const [showEndCalendar, setShowEndCalendar] = useState(false)
  const startCalendarRef = useRef<HTMLDivElement>(null)
  const endCalendarRef = useRef<HTMLDivElement>(null)

  const handleValueChange = (key: keyof FiltersState, value: string[] | Date | number | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  // const clearAllFilters = () => {
  //   onFiltersChange({
  //     dataInicio: undefined,
  //     dataFim: undefined,
  //     tiposProcesso: [],
  //     statusProcesso: [],
  //     statusParcelas: [],
  //     tiposDecisao: [],
  //     valorMinimo: undefined,
  //     valorMaximo: undefined
  //   })
  // }

  const hasActiveFilters = (filters.dataInicio || filters.dataFim) ? true : false
  const localActiveFiltersCount = (filters.dataInicio ? 1 : 0) + (filters.dataFim ? 1 : 0)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (startCalendarRef.current && !startCalendarRef.current.contains(event.target as Node)) {
        setShowStartCalendar(false)
      }
      if (endCalendarRef.current && !endCalendarRef.current.contains(event.target as Node)) {
        setShowEndCalendar(false)
      }
    }

    if (showStartCalendar || showEndCalendar) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showStartCalendar, showEndCalendar])

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filtros
          {hasActiveFilters && (
            <Badge variant="default" className="ml-2 px-1.5 py-0.5 text-xs">
              {localActiveFiltersCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:max-w-none overflow-y-auto">
        <SheetHeader className="border-b pb-4">
          <div>
            <SheetTitle className="text-lg font-semibold">Filtrar Relatórios</SheetTitle>
            <SheetDescription className="text-sm mt-1">
              Selecione o período para análise
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="p-6">
          <div className="space-y-6">
            <div>
              <Label className="text-sm font-medium">Data de Início</Label>
              <div className="relative mt-2" ref={startCalendarRef}>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => setShowStartCalendar(!showStartCalendar)}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dataInicio
                    ? format(filters.dataInicio, 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecionar data de início'}
                </Button>
                {showStartCalendar && (
                  <div className="absolute top-full left-0 z-50 mt-1">
                    <Card>
                      <CardContent className="p-0">
                        <Calendar
                          mode="single"
                          selected={filters.dataInicio}
                          onSelect={(date) => {
                            handleValueChange('dataInicio', date)
                            setShowStartCalendar(false)
                          }}
                          locale={ptBR}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Data de Fim</Label>
              <div className="relative mt-2" ref={endCalendarRef}>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  onClick={() => setShowEndCalendar(!showEndCalendar)}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dataFim
                    ? format(filters.dataFim, 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecionar data de fim'}
                </Button>
                {showEndCalendar && (
                  <div className="absolute top-full left-0 z-50 mt-1">
                    <Card>
                      <CardContent className="p-0">
                        <Calendar
                          mode="single"
                          selected={filters.dataFim}
                          onSelect={(date) => {
                            handleValueChange('dataFim', date)
                            setShowEndCalendar(false)
                          }}
                          locale={ptBR}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>

            {(filters.dataInicio || filters.dataFim) && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Datas Selecionadas</Label>
                <div className="flex flex-wrap gap-2">
                  {filters.dataInicio && (
                    <Badge variant="secondary" className="text-xs">
                      Início: {format(filters.dataInicio, 'dd/MM/yyyy', { locale: ptBR })}
                      <button
                        className="ml-1 h-3 w-3 cursor-pointer hover:text-red-500 flex items-center justify-center"
                        onClick={() => handleValueChange('dataInicio', undefined)}
                      >
                        <X className="h-3 w-3 cursor-pointer" />
                      </button>
                    </Badge>
                  )}
                  {filters.dataFim && (
                    <Badge variant="secondary" className="text-xs">
                      Fim: {format(filters.dataFim, 'dd/MM/yyyy', { locale: ptBR })}
                      <button
                        className="ml-1 h-3 w-3 cursor-pointer hover:text-red-500 flex items-center justify-center"
                        onClick={() => handleValueChange('dataFim', undefined)}
                      >
                        <X className="h-3 w-3 cursor-pointer" />
                      </button>
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
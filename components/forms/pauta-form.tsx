'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { pautaSchema, type PautaInput } from '@/lib/validations/pauta'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Calendar, X, Plus, ChevronUp, ChevronDown } from 'lucide-react'
import { getStatusInfo } from '@/lib/constants/status'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { toast } from 'sonner'

interface PautaFormProps {
  onSuccess?: () => void
}

interface ProcessoWithDataAbertura {
  id: string
  numero: string
  tipo: string
  status: string
  valorOriginal: number
  dataAbertura?: string
  contribuinte: {
    nome: string
  }
  pautas?: Array<{
    ordem: number
    relator?: string
    revisores?: string[]
    pauta: {
      id: string
      numero: string
      dataPauta: Date
      status: string
    }
  }>
}

interface Conselheiro {
  id: string
  nome: string
  ativo: boolean
}

export default function PautaForm({ onSuccess }: PautaFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [processos, setProcessos] = useState<ProcessoWithDataAbertura[]>([])
  const [conselheiros, setConselheiros] = useState<Conselheiro[]>([])
  const [searchProcess, setSearchProcess] = useState('')
  const [selectedProcessos, setSelectedProcessos] = useState<Array<{
    processo: ProcessoWithDataAbertura
    ordem: number
    relator: string // Campo usado para armazenar distribuição (relator ou revisor)
  }>>([])

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<PautaInput>({
    resolver: zodResolver(pautaSchema),
    defaultValues: {
      processos: []
    },
    shouldFocusError: false // Desabilitar foco automático para controlarmos manualmente
  })

  // Buscar processos elegíveis para pauta
  useEffect(() => {
    const fetchProcessoWithDataAberturas = async () => {
      if (searchProcess.length < 3) {
        setProcessos([])
        return
      }

      try {
        const response = await fetch(`/api/processos?search=${encodeURIComponent(searchProcess)}`)
        if (response.ok) {
          const data = await response.json()
          setProcessos(data.processos || [])
        }
      } catch (error) {
        console.error('Erro ao buscar processos:', error)
        toast.error('Erro ao buscar processos')
      }
    }

    const timeoutId = setTimeout(fetchProcessoWithDataAberturas, 300)
    return () => clearTimeout(timeoutId)
  }, [searchProcess])

  // Buscar conselheiros ativos
  useEffect(() => {
    const fetchConselheiros = async () => {
      try {
        const response = await fetch('/api/conselheiros?apenasAtivos=true')
        if (response.ok) {
          const data = await response.json()
          setConselheiros(data.conselheiros || [])
        }
      } catch (error) {
        console.error('Erro ao buscar conselheiros:', error)
        toast.error('Erro ao carregar conselheiros')
      }
    }

    fetchConselheiros()
  }, [])

  // Gerar número da pauta automaticamente
  useEffect(() => {
    const generateNumero = () => {
      const dia = String(new Date().getDate()).padStart(2, '0')
      const mes = String(new Date().getMonth() + 1).padStart(2, '0')
      const ano = new Date().getFullYear()
      const numero = `Pauta ${dia}-${mes}-${ano}`
      setValue('numero', numero)
    }

    generateNumero()
  }, [setValue])

  // Sincronizar processos selecionados com React Hook Form
  useEffect(() => {
    const processosForForm = selectedProcessos.map((item, index) => ({
      processoId: item.processo.id,
      ordem: index + 1,
      relator: item.relator.trim()
    }))
    setValue('processos', processosForForm)
  }, [selectedProcessos, setValue])

  // Função para lidar com erros de validação do formulário
  const onInvalid = (errors: FieldErrors<PautaInput>) => {
    // Verificar primeiro os campos básicos da pauta
    if (errors.numero?.message) {
      toast.warning(errors.numero.message)
      setTimeout(() => {
        const element = document.getElementById('numero')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }
    if (errors.dataPauta?.message) {
      toast.warning(errors.dataPauta.message)
      setTimeout(() => {
        const element = document.getElementById('dataPauta')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }
    if (errors.observacoes?.message) {
      toast.warning(errors.observacoes.message)
      setTimeout(() => {
        const element = document.getElementById('observacoes')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }

    // Verificar erros no array de processos
    if (errors.processos?.message) {
      toast.warning(errors.processos.message)
      return
    }

    // Verificar erros em processos individuais
    if (errors.processos && Array.isArray(errors.processos)) {
      for (let i = 0; i < errors.processos.length; i++) {
        const processoErrors = errors.processos[i]
        if (processoErrors) {
          if (processoErrors.processoId?.message) {
            toast.warning(`Processo ${i + 1}: ${processoErrors.processoId.message}`)
            return
          }
          if (processoErrors.ordem?.message) {
            toast.warning(`Processo ${i + 1}: ${processoErrors.ordem.message}`)
            return
          }
          if (processoErrors.relator?.message) {
            toast.warning(`Processo ${i + 1}: ${processoErrors.relator.message}`)
            return
          }
        }
      }
    }

    // Se chegou até aqui, mostrar erro genérico
    toast.warning('Por favor, corrija os erros no formulário')
  }

  const clearFieldError = (fieldId: string) => {
    const element = document.getElementById(fieldId)
    if (element) {
      element.style.borderColor = ''
      element.style.boxShadow = ''
    }
  }

  const onSubmit = async (data: PautaInput) => {
    setIsLoading(true)

    try {
      // Os dados já incluem os processos sincronizados pelo useEffect
      const pautaData = data

      const response = await fetch('/api/pautas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pautaData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar pauta')
      }

      const result = await response.json()
      toast.success('Pauta criada com sucesso!')

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/pautas/${result.id}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddProcessoWithDataAbertura = (processo: ProcessoWithDataAbertura) => {
    if (selectedProcessos.find(item => item.processo.id === processo.id)) {
      return // Já foi adicionado
    }

    // Validar status do processo
    const statusPermitidos = ['RECEPCIONADO', 'EM_ANALISE', 'EM_NEGOCIACAO', 'SUSPENSO', 'PEDIDO_VISTA', 'PEDIDO_DILIGENCIA']
    if (!statusPermitidos.includes(processo.status)) {
      toast.warning(`Processo com status "${getStatusInfo(processo.status).label}" não pode ser incluído em pauta`)
      return
    }

    const conselheiroParaDistribuicao = getConselheiroParaDistribuicao(processo)

    setSelectedProcessos(prev => [...prev, {
      processo,
      ordem: prev.length + 1,
      relator: conselheiroParaDistribuicao
    }])
    setSearchProcess('')
    setProcessos([])
  }

  const handleRemoveProcessoWithDataAbertura = (processoId: string) => {
    setSelectedProcessos(prev =>
      prev.filter(item => item.processo.id !== processoId)
        .map((item, index) => ({ ...item, ordem: index + 1 }))
    )
  }

  const handleReorderProcessoWithDataAbertura = (startIndex: number, endIndex: number) => {
    setSelectedProcessos(prev => {
      const result = Array.from(prev)
      const [removed] = result.splice(startIndex, 1)
      result.splice(endIndex, 0, removed)

      return result.map((item, index) => ({ ...item, ordem: index + 1 }))
    })
  }

  const handleDistribuicaoChange = (processoId: string, relator: string) => {
    setSelectedProcessos(prev =>
      prev.map(item =>
        item.processo.id === processoId ? { ...item, relator } : item
      )
    )
  }

  const onDragEnd = (result: { destination?: { index: number } | null; source: { index: number } }) => {
    if (!result.destination) return
    handleReorderProcessoWithDataAbertura(result.source.index, result.destination.index)
  }

  const tipoProcessoWithDataAberturaMap = {
    COMPENSACAO: 'Compensação',
    DACAO_PAGAMENTO: 'Dação em Pagamento',
    TRANSACAO_EXCEPCIONAL: 'Transação Excepcional'
  }

  // Removido statusProcessoWithDataAberturaMap local - agora usa getStatusInfo das constantes

  // Função para obter informações da última pauta
  const getUltimaPautaInfo = (processo: ProcessoWithDataAbertura) => {
    if (!processo.pautas || processo.pautas.length === 0) return null
    return processo.pautas[0] // Já vem ordenado por data desc na API
  }

  // Função para obter o último conselheiro para distribuição
  const getConselheiroParaDistribuicao = (processo: ProcessoWithDataAbertura) => {
    const ultimaPauta = getUltimaPautaInfo(processo)
    if (!ultimaPauta) return ''

    // Regra: Se houver revisores, pegar o último; senão pegar o relator
    if (ultimaPauta.revisores && ultimaPauta.revisores.length > 0) {
      return ultimaPauta.revisores[ultimaPauta.revisores.length - 1]
    }

    // Se não houver revisor, pegar o relator
    return ultimaPauta.relator || ''
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6" noValidate>

      {/* Informações da Pauta */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da Pauta</CardTitle>
          <CardDescription>
            Configure os dados básicos da pauta de julgamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataPauta">Data da Pauta <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="dataPauta"
                  type="date"
                  {...register('dataPauta', {
                    setValueAs: (value) => {
                      if (!value || typeof value !== 'string') return undefined
                      // Criar data no timezone local para evitar problemas de UTC
                      const [year, month, day] = value.split('-')
                      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                    }
                  })}
                  onChange={(e) => {
                    clearFieldError('dataPauta')
                    // Atualizar número da pauta automaticamente baseado na data selecionada
                    const dateValue = e.target.value
                    if (dateValue) {
                      const [year, month, day] = dateValue.split('-')
                      const numero = `Pauta ${day}-${month}-${year}`
                      setValue('numero', numero)
                    }
                  }}
                  onFocus={() => clearFieldError('dataPauta')}
                  className={`pl-10 ${errors.dataPauta ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero">Número da Pauta <span className="text-red-500">*</span></Label>
              <Input
                id="numero"
                {...register('numero')}
                onChange={(e) => {
                  setValue('numero', e.target.value)
                  clearFieldError('numero')
                }}
                onFocus={() => clearFieldError('numero')}
                disabled={isLoading}
                className={errors.numero ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Informações adicionais sobre a pauta..."
              rows={3}
              {...register('observacoes')}
              onChange={(e) => {
                setValue('observacoes', e.target.value)
                clearFieldError('observacoes')
              }}
              onFocus={() => clearFieldError('observacoes')}
              disabled={isLoading}
              className={errors.observacoes ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
          </div>
        </CardContent>
      </Card>

      {/* Seleção de ProcessoWithDataAberturas */}
      <Card>
        <CardHeader>
          <CardTitle>Processos para Julgamento</CardTitle>
          <CardDescription>
            Adicione os processos que serão julgados nesta pauta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Busca de ProcessoWithDataAberturas */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar processo por número ou contribuinte..."
                value={searchProcess}
                onChange={(e) => setSearchProcess(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>

            {processos.length > 0 && (
              <div className="border rounded-lg max-h-60 overflow-y-auto">
                {processos.map((processo) => (
                  <div
                    key={processo.id}
                    onClick={() => handleAddProcessoWithDataAbertura(processo)}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{processo.numero}</p>
                          <Badge className={getStatusInfo(processo.status).color}>
                            {getStatusInfo(processo.status).label}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{processo.contribuinte.nome}</p>
                        <p className="text-xs text-gray-500 mb-1">
                          {tipoProcessoWithDataAberturaMap[processo.tipo as keyof typeof tipoProcessoWithDataAberturaMap]} -
                          {new Date((processo as ProcessoWithDataAbertura).dataAbertura || '').toLocaleDateString('pt-BR')}
                        </p>
                        {(() => {
                          const ultimaPauta = getUltimaPautaInfo(processo)
                          if (ultimaPauta) {
                            return (
                              <div className="text-xs text-blue-600 bg-blue-50 p-1 rounded mt-1">
                                <p className="font-medium">Já pautado em: {new Date(ultimaPauta.pauta.dataPauta).toLocaleDateString('pt-BR')}</p>
                                {ultimaPauta.relator && (
                                  <p>Relator: {ultimaPauta.relator}</p>
                                )}
                                {ultimaPauta.revisores && ultimaPauta.revisores.length > 0 && (
                                  <p>Revisor{ultimaPauta.revisores.length > 1 ? 'es' : ''}: {ultimaPauta.revisores.join(', ')}</p>
                                )}
                              </div>
                            )
                          }
                          return null
                        })()}
                      </div>
                      <div className="ml-4">
                        <Button
                          type="button"
                          size="sm"
                          disabled={selectedProcessos.find(item => item.processo.id === processo.id) !== undefined}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lista de ProcessoWithDataAberturas Selecionados */}
          {selectedProcessos.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Processos Selecionados ({selectedProcessos.length})</h4>

              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="processos">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {selectedProcessos.map((item, index) => (
                        <Draggable
                          key={item.processo.id}
                          draggableId={item.processo.id}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="p-4 bg-white border rounded-lg shadow-sm"
                            >
                              <div className="flex items-center gap-4">
                                <div
                                  {...provided.dragHandleProps}
                                  className="cursor-move text-gray-400 hover:text-gray-600 flex flex-col items-center"
                                  title="Arraste para reordenar"
                                >
                                  <div className="text-xs">⋮⋮</div>
                                  <span className="font-bold text-lg">{index + 1}</span>
                                </div>

                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h5 className="font-medium">{item.processo.numero}</h5>
                                    <Badge className={getStatusInfo(item.processo.status).color}>
                                      {getStatusInfo(item.processo.status).label}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-600">{item.processo.contribuinte.nome}</p>
                                  <p className="text-xs text-gray-500 mb-1">
                                    {tipoProcessoWithDataAberturaMap[item.processo.tipo as keyof typeof tipoProcessoWithDataAberturaMap]} -
                                    {new Date((item.processo as ProcessoWithDataAbertura).dataAbertura || '').toLocaleDateString('pt-BR')}
                                  </p>
                                  {(() => {
                                    const ultimaPauta = getUltimaPautaInfo(item.processo)
                                    if (ultimaPauta) {
                                      return (
                                        <div className="text-xs text-blue-600 bg-blue-50 p-1 rounded">
                                          <p className="font-medium">Já pautado em: {new Date(ultimaPauta.pauta.dataPauta).toLocaleDateString('pt-BR')}</p>
                                          {ultimaPauta.relator && (
                                            <p>Relator: {ultimaPauta.relator}</p>
                                          )}
                                          {ultimaPauta.revisores && ultimaPauta.revisores.length > 0 && (
                                            <p>Revisor{ultimaPauta.revisores.length > 1 ? 'es' : ''}: {ultimaPauta.revisores.join(', ')}</p>
                                          )}
                                        </div>
                                      )
                                    }
                                    return null
                                  })()}
                                </div>

                                <div className="w-60 mr-4">
                                  <Label htmlFor={`relator-${item.processo.id}`} className="text-xs">
                                    Conselheiro <span className="text-red-500">*</span>
                                  </Label>
                                  <Select
                                    value={item.relator}
                                    onValueChange={(value) => handleDistribuicaoChange(item.processo.id, value)}
                                  >
                                    <SelectTrigger className="mt-1 h-8">
                                      <SelectValue placeholder="Selecione um conselheiro" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {conselheiros.map((conselheiro) => (
                                        <SelectItem key={conselheiro.id} value={conselheiro.nome}>
                                          {conselheiro.nome}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="flex flex-col gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReorderProcessoWithDataAbertura(index, index - 1)}
                                    disabled={index === 0}
                                    className="p-1 h-6 w-6 cursor-pointer hover:bg-gray-100 disabled:cursor-not-allowed"
                                    title="Mover para cima"
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReorderProcessoWithDataAbertura(index, index + 1)}
                                    disabled={index === selectedProcessos.length - 1}
                                    className="p-1 h-6 w-6 cursor-pointer hover:bg-gray-100 disabled:cursor-not-allowed"
                                    title="Mover para baixo"
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveProcessoWithDataAbertura(item.processo.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                  title="Remover processo"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <p className="text-xs text-gray-500">
                💡 Dica: Arraste os processos ou use os botões ↑↓ para reordenar a sequência de julgamento
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex gap-4 justify-end">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="cursor-pointer"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Criando...
            </>
          ) : (
            'Criar Pauta'
          )}
        </Button>
      </div>
    </form>
  )
}
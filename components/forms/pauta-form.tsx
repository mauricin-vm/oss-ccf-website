'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { pautaSchema, type PautaInput } from '@/lib/validations/pauta'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, Search, Calendar, X, Plus, ChevronUp, ChevronDown } from 'lucide-react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

interface PautaFormProps {
  onSuccess?: () => void
}

interface Processo {
  id: string
  numero: string
  tipo: string
  status: string
  valorOriginal: number
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
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [processos, setProcessos] = useState<Processo[]>([])
  const [conselheiros, setConselheiros] = useState<Conselheiro[]>([])
  const [searchProcess, setSearchProcess] = useState('')
  const [selectedProcessos, setSelectedProcessos] = useState<Array<{
    processo: Processo
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
    }
  })

  // Buscar processos elegíveis para pauta
  useEffect(() => {
    const fetchProcessos = async () => {
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
      }
    }

    const timeoutId = setTimeout(fetchProcessos, 300)
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

  const onSubmit = async (data: PautaInput) => {
    setIsLoading(true)
    setError(null)

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

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/pautas/${result.id}`)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddProcesso = (processo: Processo) => {
    if (selectedProcessos.find(item => item.processo.id === processo.id)) {
      return // Já foi adicionado
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

  const handleRemoveProcesso = (processoId: string) => {
    setSelectedProcessos(prev =>
      prev.filter(item => item.processo.id !== processoId)
        .map((item, index) => ({ ...item, ordem: index + 1 }))
    )
  }

  const handleReorderProcesso = (startIndex: number, endIndex: number) => {
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

  const onDragEnd = (result: { destination?: { index: number }; source: { index: number } }) => {
    if (!result.destination) return
    handleReorderProcesso(result.source.index, result.destination.index)
  }

  const tipoProcessoMap = {
    COMPENSACAO: 'Compensação',
    DACAO_PAGAMENTO: 'Dação em Pagamento',
    TRANSACAO_EXCEPCIONAL: 'Transação Excepcional'
  }

  const statusProcessoMap = {
    RECEPCIONADO: { label: 'Recepcionado', color: 'bg-gray-100 text-gray-800' },
    EM_ANALISE: { label: 'Em Análise', color: 'bg-blue-100 text-blue-800' },
    EM_PAUTA: { label: 'Em Pauta', color: 'bg-purple-100 text-purple-800' },
    SUSPENSO: { label: 'Suspenso', color: 'bg-yellow-100 text-yellow-800' },
    PEDIDO_VISTA: { label: 'Pedido de vista', color: 'bg-blue-100 text-blue-800' },
    PEDIDO_DILIGENCIA: { label: 'Pedido de diligência', color: 'bg-orange-100 text-orange-800' },
    JULGADO: { label: 'Julgado', color: 'bg-indigo-100 text-indigo-800' },
    ACORDO_FIRMADO: { label: 'Acordo Firmado', color: 'bg-green-100 text-green-800' },
    EM_CUMPRIMENTO: { label: 'Em Cumprimento', color: 'bg-orange-100 text-orange-800' },
    ARQUIVADO: { label: 'Arquivado', color: 'bg-gray-100 text-gray-800' },
    AGUARDANDO_DOCUMENTOS: { label: 'Aguardando Docs', color: 'bg-yellow-100 text-yellow-800' }
  }

  // Função para obter informações da última pauta
  const getUltimaPautaInfo = (processo: Processo) => {
    if (!processo.pautas || processo.pautas.length === 0) return null
    return processo.pautas[0] // Já vem ordenado por data desc na API
  }

  // Função para obter o último conselheiro para distribuição
  const getConselheiroParaDistribuicao = (processo: Processo) => {
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
              <Label htmlFor="numero">Número da Pauta <span className="text-red-500">*</span></Label>
              <Input
                id="numero"
                {...register('numero')}
                disabled={isLoading}
              />
              {errors.numero && (
                <p className="text-sm text-red-500">{errors.numero.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataPauta">Data da Pauta <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="dataPauta"
                  type="date"
                  {...register('dataPauta', {
                    setValueAs: (value) => {
                      if (!value) return undefined
                      // Criar data no timezone local para evitar problemas de UTC
                      const [year, month, day] = value.split('-')
                      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                    }
                  })}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              {errors.dataPauta && (
                <p className="text-sm text-red-500">{errors.dataPauta.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Informações adicionais sobre a pauta..."
              rows={3}
              {...register('observacoes')}
              disabled={isLoading}
            />
            {errors.observacoes && (
              <p className="text-sm text-red-500">{errors.observacoes.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Processos */}
      <Card>
        <CardHeader>
          <CardTitle>Processos para Julgamento</CardTitle>
          <CardDescription>
            Adicione os processos que serão julgados nesta pauta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Busca de Processos */}
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
                    onClick={() => handleAddProcesso(processo)}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{processo.numero}</p>
                          <Badge className={statusProcessoMap[processo.status as keyof typeof statusProcessoMap]?.color || 'bg-gray-100 text-gray-800'}>
                            {statusProcessoMap[processo.status as keyof typeof statusProcessoMap]?.label || processo.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{processo.contribuinte.nome}</p>
                        <p className="text-xs text-gray-500 mb-1">
                          {tipoProcessoMap[processo.tipo as keyof typeof tipoProcessoMap]} -
                          {new Date(processo.dataAbertura).toLocaleDateString('pt-BR')}
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

          {/* Lista de Processos Selecionados */}
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
                                    <Badge className={statusProcessoMap[item.processo.status as keyof typeof statusProcessoMap]?.color || 'bg-gray-100 text-gray-800'}>
                                      {statusProcessoMap[item.processo.status as keyof typeof statusProcessoMap]?.label || item.processo.status}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-600">{item.processo.contribuinte.nome}</p>
                                  <p className="text-xs text-gray-500 mb-1">
                                    {tipoProcessoMap[item.processo.tipo as keyof typeof tipoProcessoMap]} -
                                    {new Date(item.processo.dataAbertura).toLocaleDateString('pt-BR')}
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
                                    <SelectTrigger className={`mt-1 h-8 ${!item.relator ? 'border-red-300 focus:border-red-500' : ''}`}>
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
                                    onClick={() => handleReorderProcesso(index, index - 1)}
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
                                    onClick={() => handleReorderProcesso(index, index + 1)}
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
                                  onClick={() => handleRemoveProcesso(item.processo.id)}
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

          {errors.processos && (
            <p className="text-sm text-red-500">{errors.processos.message}</p>
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
          disabled={isLoading || selectedProcessos.length === 0 || selectedProcessos.some(item => !item.relator)}
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
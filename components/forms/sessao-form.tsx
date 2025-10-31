'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sessaoSchema, type SessaoInput } from '@/lib/validations/pauta'
import { TipoSessao } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Calendar, Users, Search, User } from 'lucide-react'
import { formatLocalDate } from '@/lib/utils/date'
import { toast } from 'sonner'

interface SessaoFormProps {
  onSuccess?: () => void
  pautaId?: string
}

interface Pauta {
  id: string
  numero: string
  dataPauta: Date
  status: string
  processos: Array<{
    ordem: number
    relator: string
    distribuidoPara: string
    revisores: string[]
    processo: {
      id: string
      numero: string
      contribuinte: {
        nome: string
      }
    }
  }>
}

interface Conselheiro {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  cargo: string | null
  origem: string | null
  ativo: boolean
}

export default function SessaoForm({ onSuccess, pautaId }: SessaoFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPauta, setIsLoadingPauta] = useState(false)
  const [pautas, setPautas] = useState<Pauta[]>([])
  const [conselheiros, setConselheiros] = useState<Conselheiro[]>([])
  const [selectedPauta, setSelectedPauta] = useState<Pauta | null>(null)
  const [selectedConselheiros, setSelectedConselheiros] = useState<string[]>([])
  const [selectedPresidente, setSelectedPresidente] = useState<string>('')
  const [searchPauta, setSearchPauta] = useState('')
  const [tipoSessao, setTipoSessao] = useState<TipoSessao>('JULGAMENTO')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<SessaoInput>({
    resolver: zodResolver(sessaoSchema),
    defaultValues: {
      tipoSessao: 'JULGAMENTO',
      dataInicio: new Date(),
      presidenteId: '',
      conselheiros: []
    },
    shouldFocusError: false
  })

  // Função para lidar com erros de validação do formulário
  const onInvalid = (errors: FieldErrors<SessaoInput>) => {
    // Verificar erros de forma type-safe
    if (errors.tipoSessao?.message) {
      toast.warning(errors.tipoSessao.message)
      setTimeout(() => {
        const element = document.getElementById('tipoSessao')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }
    if (errors.agenda?.message) {
      toast.warning(errors.agenda.message)
      setTimeout(() => {
        const element = document.getElementById('agenda')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }
    if (errors.pautaId?.message) {
      toast.warning(errors.pautaId.message)
      setTimeout(() => {
        const element = document.getElementById('pautaId')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }
    if (errors.dataInicio?.message) {
      toast.warning(errors.dataInicio.message)
      setTimeout(() => {
        const element = document.getElementById('dataInicio')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }
    if (errors.presidenteId?.message) {
      toast.warning(errors.presidenteId.message)
      setTimeout(() => {
        const element = document.getElementById('presidenteId')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }
    if (errors.conselheiros?.message) {
      toast.warning(errors.conselheiros.message)
      return
    }
  }

  const clearFieldError = (fieldId: string) => {
    const element = document.getElementById(fieldId)
    if (element) {
      element.style.borderColor = ''
      element.style.boxShadow = ''
    }
  }

  // Buscar pautas elegíveis
  useEffect(() => {
    const fetchPautas = async () => {
      try {
        const response = await fetch('/api/pautas?status=aberta')
        if (response.ok) {
          const data = await response.json()
          setPautas(data.pautas || [])
        }
      } catch (error) {
        console.error('Erro ao buscar pautas:', error)
        toast.error('Erro ao carregar pautas disponíveis')
      }
    }

    fetchPautas()
  }, [])

  // Buscar conselheiros ativos
  useEffect(() => {
    const fetchConselheiros = async () => {
      try {
        const response = await fetch('/api/conselheiros')
        if (response.ok) {
          const data = await response.json()
          // Filtrar apenas conselheiros ativos
          const conselheirosAtivos = (data.conselheiros || []).filter((conselheiro: Conselheiro) =>
            conselheiro.ativo
          )
          setConselheiros(conselheirosAtivos)

          // Auto-selecionar conselheiros titulares
          const titulares = conselheirosAtivos
            .filter((conselheiro: Conselheiro) =>
              conselheiro.cargo === 'Conselheiro Titular' ||
              conselheiro.cargo === 'Conselheira Titular'
            )
            .map((conselheiro: Conselheiro) => conselheiro.id)

          setSelectedConselheiros(titulares)
        }
      } catch (error) {
        console.error('Erro ao buscar conselheiros:', error)
        toast.error('Erro ao carregar lista de conselheiros')
      }
    }

    fetchConselheiros()
  }, [])

  // Se pautaId for fornecido via URL, buscar a pauta específica
  useEffect(() => {
    const fetchPauta = async () => {
      const pautaIdFromUrl = pautaId || searchParams.get('pauta')
      if (!pautaIdFromUrl) return

      setIsLoadingPauta(true)
      try {
        const response = await fetch(`/api/pautas/${pautaIdFromUrl}`)
        if (response.ok) {
          const pauta = await response.json()
          setSelectedPauta(pauta)
          setValue('pautaId', pauta.id)
        }
      } catch (error) {
        console.error('Erro ao buscar pauta:', error)
        toast.error('Erro ao carregar dados da pauta')
      } finally {
        setIsLoadingPauta(false)
      }
    }

    fetchPauta()
  }, [pautaId, searchParams, setValue])

  // Atualizar campo de conselheiros quando seleção muda (excluindo o presidente)
  useEffect(() => {
    const conselheirosParticipantes = selectedConselheiros.filter(id => id !== selectedPresidente)
    setValue('conselheiros', conselheirosParticipantes)
  }, [selectedConselheiros, selectedPresidente, setValue])

  // Atualizar campo de presidente quando seleção muda
  useEffect(() => {
    setValue('presidenteId', selectedPresidente || '')
  }, [selectedPresidente, setValue])

  // Atualizar campo de tipo de sessão quando seleção muda
  useEffect(() => {
    setValue('tipoSessao', tipoSessao)
  }, [tipoSessao, setValue])

  const onSubmit = async (data: SessaoInput) => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/sessoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar sessão')
      }

      const resultado = await response.json()

      toast.success('Sessão iniciada com sucesso!')

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/sessoes/${resultado.id}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro inesperado'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectPauta = (pauta: Pauta) => {
    setSelectedPauta(pauta)
    setValue('pautaId', pauta.id)
    setSearchPauta('')
  }

  const handleConselheiroToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedConselheiros(prev => [...prev, userId])
    } else {
      setSelectedConselheiros(prev => prev.filter(id => id !== userId))
    }
  }

  const handlePresidenteChange = (presidenteId: string) => {
    // Primeiro, remover qualquer presidente anterior dos participantes selecionados
    let newSelectedConselheiros = [...selectedConselheiros]
    if (selectedPresidente && newSelectedConselheiros.includes(selectedPresidente)) {
      newSelectedConselheiros = newSelectedConselheiros.filter(id => id !== selectedPresidente)
    }

    // Se um novo presidente foi selecionado e está nos participantes, removê-lo
    if (presidenteId && newSelectedConselheiros.includes(presidenteId)) {
      newSelectedConselheiros = newSelectedConselheiros.filter(id => id !== presidenteId)
    }

    setSelectedPresidente(presidenteId)
    setSelectedConselheiros(newSelectedConselheiros)
  }

  const pautasFiltradas = pautas.filter(pauta =>
    pauta.numero.toLowerCase().includes(searchPauta.toLowerCase())
  )

  // Calcular conselheiros participantes (excluindo o presidente)
  const conselheirosParticipantes = selectedConselheiros.filter(id => id !== selectedPresidente)

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6" noValidate>

      {/* Seleção de Tipo de Sessão */}
      <Card>
        <CardHeader>
          <CardTitle>Tipo de Sessão</CardTitle>
          <CardDescription>
            Selecione se esta é uma sessão para julgamento de processos ou apenas administrativa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${tipoSessao === 'JULGAMENTO'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
                }`}
              onClick={() => setTipoSessao('JULGAMENTO')}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${tipoSessao === 'JULGAMENTO'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                  }`}>
                  {tipoSessao === 'JULGAMENTO' && (
                    <div className="w-2 h-2 rounded-full bg-white m-0.5"></div>
                  )}
                </div>
                <div>
                  <h4 className="font-medium">Sessão de Julgamento</h4>
                  <p className="text-sm text-gray-600">
                    Para julgar processos de uma pauta específica
                  </p>
                </div>
              </div>
            </div>

            <div
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${tipoSessao === 'ADMINISTRATIVA'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
                }`}
              onClick={() => setTipoSessao('ADMINISTRATIVA')}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${tipoSessao === 'ADMINISTRATIVA'
                    ? 'border-green-500 bg-green-500'
                    : 'border-gray-300'
                  }`}>
                  {tipoSessao === 'ADMINISTRATIVA' && (
                    <div className="w-2 h-2 rounded-full bg-white m-0.5"></div>
                  )}
                </div>
                <div>
                  <h4 className="font-medium">Sessão Administrativa</h4>
                  <p className="text-sm text-gray-600">
                    Para tratar apenas assuntos administrativos
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campo de Agenda para Sessões Administrativas */}
      {tipoSessao === 'ADMINISTRATIVA' && (
        <Card>
          <CardHeader>
            <CardTitle>Agenda da Sessão</CardTitle>
            <CardDescription>
              Descreva os assuntos que serão tratados nesta sessão administrativa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <textarea
                id="agenda"
                {...register('agenda')}
                onChange={(e) => {
                  setValue('agenda', e.target.value)
                  clearFieldError('agenda')
                }}
                onFocus={() => clearFieldError('agenda')}
                className={`w-full p-3 border rounded-lg resize-vertical min-h-[100px] ${errors.agenda ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                placeholder="Descreva os assuntos administrativos que serão tratados..."
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seleção de Pauta - Apenas para Sessões de Julgamento */}
      {tipoSessao === 'JULGAMENTO' && (
        <Card>
          <CardHeader>
            <CardTitle>Pauta para Julgamento</CardTitle>
            <CardDescription>
              Selecione a pauta que será julgada nesta sessão
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingPauta ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : !selectedPauta ? (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="pautaId"
                    placeholder="Buscar pauta..."
                    value={searchPauta}
                    onChange={(e) => {
                      setSearchPauta(e.target.value)
                      clearFieldError('pautaId')
                    }}
                    onFocus={() => clearFieldError('pautaId')}
                    className={`pl-10 ${errors.pautaId ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    disabled={isLoading}
                  />
                </div>

                {pautasFiltradas.length > 0 && (
                  <div className="border rounded-lg">
                    {pautasFiltradas.map((pauta) => (
                      <div
                        key={pauta.id}
                        onClick={() => handleSelectPauta(pauta)}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{pauta.numero}</p>
                            <p className="text-sm text-gray-600">
                              {formatLocalDate(pauta.dataPauta)} - {pauta.processos.length} processo{pauta.processos.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <Badge className="bg-blue-100 text-blue-800">
                            {pauta.status === 'aberta' ? 'Aberta' : pauta.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {searchPauta.length > 0 && pautasFiltradas.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    Nenhuma pauta encontrada
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-blue-900">{selectedPauta.numero}</h4>
                    <p className="text-sm text-blue-700">
                      {formatLocalDate(selectedPauta.dataPauta)} - {selectedPauta.processos.length} processo{selectedPauta.processos.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedPauta(null)
                      setValue('pautaId', '')
                    }}
                  >
                    Alterar
                  </Button>
                </div>

                {/* Lista de Processos da Pauta */}
                <div className="mt-4 space-y-2">
                  <h5 className="text-sm font-medium text-blue-900">Processos para Julgamento:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedPauta.processos.map((processoPauta) => (
                      <div key={processoPauta.processo.id} className="text-sm bg-white p-2 rounded border">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold">
                            {processoPauta.ordem}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium">{processoPauta.processo.numero}</p>
                            <p className="text-xs text-gray-600">{processoPauta.processo.contribuinte.nome}</p>

                            {/* Relator técnico (sempre) */}
                            {processoPauta.relator && (
                              <p className="text-xs text-purple-600">
                                Relator: {processoPauta.relator}
                              </p>
                            )}

                            {/* Revisores */}
                            {processoPauta.revisores && processoPauta.revisores.length > 0 && (
                              <p className="text-xs text-blue-600">
                                {processoPauta.revisores.length === 1 ? 'Revisor' : 'Revisores'}: {processoPauta.revisores.join(', ')}
                              </p>
                            )}

                            {/* Distribuição (se diferente do relator) */}
                            {processoPauta.distribuidoPara && processoPauta.distribuidoPara !== processoPauta.relator && (
                              <p className="text-xs text-green-600">
                                Distribuído para: {processoPauta.distribuidoPara}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informações da Sessão */}
      {(tipoSessao === 'JULGAMENTO' ? selectedPauta : true) && (
        <Card>
          <CardHeader>
            <CardTitle>Dados da Sessão</CardTitle>
            <CardDescription>
              Configure a data e hora de início da sessão
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataInicio">Data e Hora de Início</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="dataInicio"
                    type="datetime-local"
                    {...register('dataInicio', {
                      setValueAs: (value) => value ? new Date(value) : undefined,
                      onChange: () => clearFieldError('dataInicio')
                    })}
                    onFocus={() => clearFieldError('dataInicio')}
                    className={`pl-10 w-full ${errors.dataInicio ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    disabled={isLoading}
                    defaultValue={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Presidente da Sessão <span className="text-red-500">*</span></Label>
                <Select
                  value={selectedPresidente || ''}
                  onValueChange={(value) => {
                    handlePresidenteChange(value)
                    clearFieldError('presidenteId')
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger
                    id="presidenteId"
                    className={`w-full ${errors.presidenteId ? 'border-red-500 focus:ring-red-500' : ''}`}
                    onFocus={() => clearFieldError('presidenteId')}
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <SelectValue placeholder="Selecionar presidente" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {conselheiros.map((conselheiro) => (
                      <SelectItem key={conselheiro.id} value={conselheiro.id}>
                        {conselheiro.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPresidente && (
                  <p className="text-xs text-blue-600">
                    Presidente não aparecerá na lista de participantes
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seleção de Conselheiros */}
      {(tipoSessao === 'JULGAMENTO' ? selectedPauta : true) && (
        <Card>
          <CardHeader>
            <CardTitle>Conselheiros Participantes <span className="text-red-500">*</span></CardTitle>
            <CardDescription>
              Selecione os conselheiros que participarão desta sessão
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {conselheiros
                .filter(conselheiro => conselheiro.id !== selectedPresidente)
                .map((conselheiro) => (
                  <div key={conselheiro.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id={`conselheiro-${conselheiro.id}`}
                      checked={selectedConselheiros.includes(conselheiro.id)}
                      onCheckedChange={(checked) =>
                        handleConselheiroToggle(conselheiro.id, checked as boolean)
                      }
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`conselheiro-${conselheiro.id}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {conselheiro.nome}
                        </label>
                        {conselheiro.cargo && (
                          <Badge variant="outline" className="text-xs">
                            {conselheiro.cargo}
                          </Badge>
                        )}
                      </div>
                      {conselheiro.email && (
                        <p className="text-xs text-gray-600">{conselheiro.email}</p>
                      )}
                      {conselheiro.origem && (
                        <p className="text-xs text-gray-500">{conselheiro.origem}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {conselheirosParticipantes.length > 0 && (
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  <Users className="inline h-4 w-4 mr-1" />
                  {conselheirosParticipantes.length} conselheiro{conselheirosParticipantes.length !== 1 ? 's' : ''} selecionado{conselheirosParticipantes.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}

          </CardContent>
        </Card>
      )}


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
              Iniciando...
            </>
          ) : (
            'Iniciar Sessão'
          )}
        </Button>
      </div>
    </form>
  )
}
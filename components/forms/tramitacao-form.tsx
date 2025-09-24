'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { tramitacaoSchema } from '@/lib/validations/processo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pagination } from '@/components/ui/pagination'
import { Loader2, AlertCircle, Search, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getStatusInfo } from '@/lib/constants/status'
import { getTipoProcessoInfo } from '@/lib/constants/tipos-processo'
import { toast } from 'sonner'

interface TramitacaoFormProps {
  onSuccess?: () => void
  processoId?: string
}

interface Processo {
  id: string
  numero: string
  tipo: string
  status: string
  contribuinte: {
    nome: string
  }
  tramitacoes: Array<{
    setorDestino: string
    dataEnvio: Date
  }>
}

interface Setor {
  id: string
  nome: string
  sigla: string
}

interface Conselheiro {
  id: string
  nome: string
  ativo: boolean
}

export default function TramitacaoForm({ onSuccess, processoId }: TramitacaoFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [processos, setProcessos] = useState<Processo[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [conselheiros, setConselheiros] = useState<Conselheiro[]>([])
  const [searchProcess, setSearchProcess] = useState('')
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null)
  const [destinationType, setDestinationType] = useState<'setor' | 'pessoa'>('setor')
  const [isLoadingProcessos, setIsLoadingProcessos] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<{
    processoId: string
    setorOrigem: string
    setorDestino: string
    prazoResposta?: string
    observacoes?: string
  }>({
    resolver: zodResolver(tramitacaoSchema) as unknown as Resolver<{
      processoId: string
      setorOrigem: string
      setorDestino: string
      prazoResposta?: string
      observacoes?: string
    }>,
    defaultValues: {
      processoId: processoId || '',
      setorOrigem: 'CCF',
      setorDestino: '',
      prazoResposta: undefined,
      observacoes: ''
    },
    shouldFocusError: false // Desabilitar foco automático para controlarmos manualmente
  })

  // Buscar setores
  useEffect(() => {
    const fetchSetores = async () => {
      try {
        const response = await fetch('/api/setores')
        if (response.ok) {
          const data = await response.json()
          setSetores(data)
        }
      } catch (error) {
        console.error('Erro ao buscar setores:', error)
      }
    }

    fetchSetores()
  }, [])

  // Buscar conselheiros
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

  // Carregar todos os processos inicialmente
  useEffect(() => {
    const fetchAllProcessos = async () => {
      try {
        setIsLoadingProcessos(true)
        const response = await fetch('/api/processos?limit=1000')
        if (response.ok) {
          const data = await response.json()
          setProcessos(data.processos || [])
        }
      } catch (error) {
        console.error('Erro ao carregar processos:', error)
      } finally {
        setIsLoadingProcessos(false)
      }
    }

    fetchAllProcessos()
  }, [])

  // Reset para primeira página quando busca muda
  useEffect(() => {
    setCurrentPage(1)
  }, [searchProcess])

  // Se processoId for fornecido, buscar o processo específico
  useEffect(() => {
    const fetchProcesso = async () => {
      if (!processoId) return

      try {
        const response = await fetch(`/api/processos/${processoId}`)
        if (response.ok) {
          const processo = await response.json()
          setSelectedProcesso(processo)
          setValue('processoId', processo.id)

          // Manter CCF como padrão para setor de origem
          setValue('setorOrigem', 'CCF', { shouldValidate: true })
        }
      } catch (error) {
        console.error('Erro ao buscar processo:', error)
      }
    }

    fetchProcesso()
  }, [processoId, setValue])

  // Função para lidar com erros de validação do formulário
  const onInvalid = (errors: any) => {
    // Ordem lógica dos campos no formulário
    const fieldOrder = [
      'processoId',
      'setorOrigem',
      'setorDestino',
      'prazoResposta',
      'observacoes'
    ]

    // Procurar pelo primeiro erro na ordem dos campos
    for (const field of fieldOrder) {
      const fieldError = errors[field]

      if (fieldError?.message) {
        toast.warning(fieldError.message)

        // Focar no campo com erro após um pequeno delay
        setTimeout(() => {
          // Para processoId, mostrar mensagem mas não focar pois não é input direto
          if (field === 'processoId') {
            // Processo deve ser selecionado, não há campo para focar
            return
          }

          const element = document.getElementById(field)
          if (element) {
            element.focus()
            element.style.borderColor = '#ef4444'
            element.style.boxShadow = '0 0 0 1px #ef4444'
          }
        }, 100)
        break
      }
    }
  }

  const onSubmit = async (data: {
    processoId: string
    setorOrigem: string
    setorDestino: string
    prazoResposta?: string
    observacoes?: string
  }) => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/tramitacoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar tramitação')
      }

      await response.json()

      toast.success('Tramitação criada com sucesso!')

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/tramitacoes')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectProcesso = (processo: Processo) => {
    setSelectedProcesso(processo)
    setValue('processoId', processo.id)
    setSearchProcess('')

    // Manter CCF como padrão para setor de origem
    setValue('setorOrigem', 'CCF', { shouldValidate: true })
  }

  // Filtragem local dos processos
  const filteredProcessos = processos.filter((processo) => {
    if (!searchProcess) return true

    const searchLower = searchProcess.toLowerCase()
    const searchNumbers = searchProcess.replace(/\D/g, '')

    return processo.numero.toLowerCase().includes(searchLower) ||
      processo.contribuinte.nome.toLowerCase().includes(searchLower) ||
      (searchNumbers && processo.numero.includes(searchNumbers))
  })

  // Paginação local
  const totalFilteredProcessos = filteredProcessos.length
  const totalPages = Math.ceil(totalFilteredProcessos / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProcessos = filteredProcessos.slice(startIndex, endIndex)


  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6" noValidate>

      {/* Seleção de Processo */}
      <Card>
        <CardHeader>
          <CardTitle>Processo</CardTitle>
          <CardDescription>
            Selecione o processo para tramitar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedProcesso ? (
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

              {isLoadingProcessos && (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">Carregando processos</p>
                      <p className="text-xs text-gray-500">Buscando processos cadastrados...</p>
                    </div>
                  </div>
                </div>
              )}

              {!isLoadingProcessos && paginatedProcessos.length > 0 && (
                <div className="space-y-4">
                  <div className="border rounded-lg max-h-96 overflow-y-auto">
                    {paginatedProcessos.map((processo) => (
                      <div
                        key={processo.id}
                        onClick={() => handleSelectProcesso(processo)}
                        className="p-4 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{processo.numero}</p>
                            <p className="text-sm text-gray-600">{processo.contribuinte.nome}</p>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getTipoProcessoInfo(processo.tipo).color}>
                              {getTipoProcessoInfo(processo.tipo).label}
                            </Badge>
                            <Badge className={getStatusInfo(processo.status).color}>
                              {getStatusInfo(processo.status).label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalFilteredProcessos}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}

              {!isLoadingProcessos && paginatedProcessos.length === 0 && processos.length > 0 && searchProcess && (
                <div className="text-center py-6 text-gray-500">
                  <p>Nenhum processo encontrado para "{searchProcess}"</p>
                </div>
              )}

              {!isLoadingProcessos && processos.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <p>Nenhum processo cadastrado</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-blue-900">{selectedProcesso.numero}</h4>
                  <p className="text-sm text-blue-700">{selectedProcesso.contribuinte.nome}</p>
                  <p className="text-xs text-blue-600">
                    {getTipoProcessoInfo(selectedProcesso.tipo).label}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedProcesso(null)
                    setValue('processoId', '')
                    setValue('setorOrigem', '')
                    setValue('setorDestino', '')
                    setValue('prazoResposta', undefined)
                  }}
                >
                  Alterar
                </Button>
              </div>
            </div>
          )}
          {errors.processoId && (
            <p className="text-sm text-red-500">{errors.processoId.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Informações da Tramitação */}
      {selectedProcesso && (
        <Card>
          <CardHeader>
            <CardTitle>Dados da Tramitação</CardTitle>
            <CardDescription>
              Configure o destino e prazos da tramitação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="setorOrigem">Setor de Origem <span className="text-red-500">*</span></Label>
                <Select
                  value={watch('setorOrigem')}
                  onValueChange={(value) => setValue('setorOrigem', value, { shouldValidate: true })}
                  disabled={isLoading}
                >
                  <SelectTrigger id="setorOrigem" className={errors.setorOrigem ? 'border-red-500 focus:ring-red-500' : ''}>
                    <SelectValue placeholder="Selecione o setor de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CCF">
                      CCF - Câmara de Conciliação Fiscal
                    </SelectItem>
                    {setores.filter(setor => setor.sigla !== 'CCF').map((setor) => (
                      <SelectItem key={setor.id} value={setor.sigla}>
                        {setor.sigla} - {setor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Destino <span className="text-red-500">*</span></Label>

                {/* Tipo de Destino */}
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="setor"
                      checked={destinationType === 'setor'}
                      onChange={() => {
                        setDestinationType('setor')
                        setValue('setorDestino', '', { shouldValidate: true })
                      }}
                      className="text-blue-600"
                    />
                    <span className="text-sm">Setor</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="pessoa"
                      checked={destinationType === 'pessoa'}
                      onChange={() => {
                        setDestinationType('pessoa')
                        setValue('setorDestino', '', { shouldValidate: true })
                      }}
                      className="text-blue-600"
                    />
                    <span className="text-sm">Pessoa</span>
                  </label>
                </div>

                {/* Select baseado no tipo */}
                <Select
                  value={watch('setorDestino')}
                  onValueChange={(value) => setValue('setorDestino', value, { shouldValidate: true })}
                  disabled={isLoading}
                >
                  <SelectTrigger id="setorDestino" className={errors.setorDestino ? 'border-red-500 focus:ring-red-500' : ''}>
                    <SelectValue placeholder={`Selecione ${destinationType === 'setor' ? 'o setor' : 'a pessoa'} de destino`} />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationType === 'setor' ? (
                      setores.map((setor) => (
                        <SelectItem key={setor.id} value={setor.sigla}>
                          {setor.sigla} - {setor.nome}
                        </SelectItem>
                      ))
                    ) : (
                      conselheiros.filter(conselheiro => conselheiro.ativo).map((conselheiro) => (
                        <SelectItem key={conselheiro.id} value={conselheiro.nome}>
                          {conselheiro.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 w-1/2">
              <Label htmlFor="prazoResposta">Prazo para Resposta</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="prazoResposta"
                  type="date"
                  {...register('prazoResposta')}
                  className={`pl-10 ${errors.prazoResposta ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-gray-500">
                Data limite para resposta ou retorno do setor de destino
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Informações adicionais sobre a tramitação..."
                rows={3}
                {...register('observacoes')}
                disabled={isLoading}
              />
            </div>

            {/* Histórico de Tramitações do Processo */}
            {selectedProcesso.tramitacoes.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Última Tramitação</h4>
                <div className="text-sm text-gray-600">
                  <p>
                    <strong>Destino Atual:</strong> {selectedProcesso.tramitacoes[0].setorDestino}
                  </p>
                  <p>
                    <strong>Data:</strong> {new Date(selectedProcesso.tramitacoes[0].dataEnvio).toLocaleDateString('pt-BR')}
                  </p>
                </div>
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
          disabled={isLoading || !selectedProcesso}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Criando...
            </>
          ) : (
            'Criar Tramitação'
          )}
        </Button>
      </div>
    </form>
  )
}
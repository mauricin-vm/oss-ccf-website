'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { acordoSchema, type AcordoInput } from '@/lib/validations/acordo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, AlertCircle, HandCoins, Calculator, FileText, Search, User, Building, Settings, CreditCard } from 'lucide-react'
import TransacaoExcepcionalAcordoSection from '@/components/acordo/transacao-excepcional-acordo-section'
import CompensacaoSection from '@/components/acordo/compensacao-section'
import DacaoSection from '@/components/acordo/dacao-section'

interface AcordoFormProps {
  onSuccess?: () => void
  processoId?: string
}

interface Processo {
  id: string
  numero: string
  tipo: string
  valor: number
  status: string
  tipoDecisao?: string // Adicionar tipo de decisão para processos julgados
  contribuinte: {
    nome: string
    documento: string
    email: string
  }
  valoresEspecificos?: {
    configurado: boolean
    valorOriginal: number
    valorFinal: number
    detalhes?: any
  }
}

export default function AcordoForm({ onSuccess, processoId }: AcordoFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProcessos, setIsLoadingProcessos] = useState(true)
  const [processos, setProcessos] = useState<Processo[]>([])
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null)
  const [searchProcesso, setSearchProcesso] = useState('')
  const [dadosEspecificos, setDadosEspecificos] = useState<any>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors }
  } = useForm<AcordoInput>({
    resolver: zodResolver(acordoSchema),
    defaultValues: {
      modalidadePagamento: 'avista',
      dataAssinatura: new Date(),
      numeroParcelas: 1
    }
  })

  // Função para verificar se processo julgado teve decisão deferida e retornar o tipo
  const fetchDecisoesDeferidas = useCallback(async (processoId: string) => {
    try {
      const response = await fetch(`/api/processos/${processoId}/decisoes`)
      if (response.ok) {
        const data = await response.json()
        const decisaoDeferida = data.decisoes?.find((decisao: any) =>
          ['DEFERIDO', 'PARCIAL'].includes(decisao.tipoDecisao)
        )
        return decisaoDeferida ? decisaoDeferida.tipoDecisao : null
      }
    } catch (error) {
      console.error('Erro ao buscar decisões:', error)
    }
    return null
  }, [])

  // Função para buscar valores específicos baseado no tipo do processo
  const fetchValoresEspecificos = useCallback(async (processo: any) => {
    try {
      let valoresResponse

      switch (processo.tipo) {
        case 'TRANSACAO_EXCEPCIONAL':
          valoresResponse = await fetch(`/api/processos/${processo.id}/valores-transacao`)
          break
        case 'COMPENSACAO':
          valoresResponse = await fetch(`/api/processos/${processo.id}/valores-compensacao`)
          break
        case 'DACAO_PAGAMENTO':
          valoresResponse = await fetch(`/api/processos/${processo.id}/valores-dacao`)
          break
        default:
          return processo
      }

      if (valoresResponse && valoresResponse.ok) {
        const valoresData = await valoresResponse.json()
        processo.valoresEspecificos = {
          configurado: true,
          detalhes: valoresData,
          tipo: processo.tipo
        }
      }

      return processo
    } catch (error) {
      console.error('Erro ao buscar valores específicos:', error)
      return processo
    }
  }, [])

  // Buscar processos elegíveis para acordo
  useEffect(() => {
    const fetchProcessos = async () => {
      setIsLoadingProcessos(true)
      try {
        const response = await fetch('/api/processos?status=JULGADO&limit=1000')
        if (response.ok) {
          const data = await response.json()

          // Filtrar processos elegíveis
          const processosElegiveis = await Promise.all(
            (data.processos || []).map(async (processo) => {
              // Verificar se já tem acordo
              if (processo.acordo && processo.acordo.length > 0) {
                return null
              }

              // Só processos julgados são elegíveis, verificar se teve decisão deferida
              if (processo.status === 'JULGADO') {
                const tipoDecisao = await fetchDecisoesDeferidas(processo.id)
                if (tipoDecisao) {
                  const processoComDecisao = { ...processo, tipoDecisao }

                  // Buscar valores específicos para cada processo elegível
                  await fetchValoresEspecificos(processoComDecisao)

                  return processoComDecisao
                }
              }

              return null
            })
          )

          setProcessos(processosElegiveis.filter(p => p !== null))
        }
      } catch (error) {
        console.error('Erro ao buscar processos:', error)
        setError('Erro ao carregar processos elegíveis')
      } finally {
        setIsLoadingProcessos(false)
      }
    }

    fetchProcessos()
  }, [fetchDecisoesDeferidas, fetchValoresEspecificos])

  // Se processoId for fornecido via prop ou URL, buscar o processo específico
  useEffect(() => {
    const fetchProcesso = async () => {
      const processoIdFromUrl = processoId || searchParams.get('processo')
      if (!processoIdFromUrl) return

      try {
        const response = await fetch(`/api/processos/${processoIdFromUrl}`)
        if (response.ok) {
          const processo = await response.json()

          // Verificar se processo é elegível para acordo (só processos julgados com decisão deferida)
          const tipoDecisao = processo.status === 'JULGADO' ? await fetchDecisoesDeferidas(processo.id) : null

          if (tipoDecisao) {
            // Adicionar tipo de decisão ao processo
            processo.tipoDecisao = tipoDecisao

            // Buscar valores específicos baseado no tipo do processo
            await fetchValoresEspecificos(processo)
            
            // Usar valores específicos se já estão no processo (vindos da API principal)
            let valorOriginal = processo.valor || 0
            let valorFinal = processo.valor || 0

            if (processo.valoresEspecificos) {
              if (processo.tipo === 'TRANSACAO_EXCEPCIONAL' && processo.valoresEspecificos.transacao) {
                valorOriginal = processo.valoresEspecificos.transacao.valorTotalInscricoes
                valorFinal = processo.valoresEspecificos.transacao.valorTotalProposto
              } else if (processo.tipo === 'COMPENSACAO' && processo.valoresEspecificos.creditos && processo.valoresEspecificos.inscricoes) {
                const totalCreditos = processo.valoresEspecificos.creditos.reduce((total, credito) => total + credito.valor, 0)
                const totalDebitos = processo.valoresEspecificos.inscricoes.reduce((total, inscricao) =>
                  total + (inscricao.debitos?.reduce((subtotal, debito) => subtotal + debito.valor, 0) || 0), 0
                )
                valorOriginal = Math.max(totalCreditos, totalDebitos)
                valorFinal = Math.min(totalCreditos, totalDebitos) // O que será pago é o menor valor (compensação)
              } else if (processo.tipo === 'DACAO_PAGAMENTO' && processo.valoresEspecificos.imoveis && processo.valoresEspecificos.inscricoes) {
                const totalImoveis = processo.valoresEspecificos.imoveis.reduce((total, imovel) => total + (imovel.valorAvaliacao || 0), 0)
                const totalDebitos = processo.valoresEspecificos.inscricoes.reduce((total, inscricao) =>
                  total + (inscricao.debitos?.reduce((subtotal, debito) => subtotal + debito.valor, 0) || 0), 0
                )
                valorOriginal = totalDebitos
                valorFinal = Math.min(totalImoveis, totalDebitos) // O que será quitado com dação
              }
            }

            const processoComValores = {
              ...processo,
              valoresEspecificos: {
                configurado: !!processo.valoresEspecificos,
                valorOriginal,
                valorFinal,
                detalhes: processo.valoresEspecificos
              }
            }

            setSelectedProcesso(processoComValores)
            setValue('processoId', processo.id)
            
            // Usar valor dos valores específicos se disponível
            const valorParaUsar = processoComValores.valoresEspecificos.valorFinal
            setValue('valorTotal', valorParaUsar)
            setValue('valorFinal', valorParaUsar)
          }
        }
      } catch (error) {
        console.error('Erro ao buscar processo:', error)
      }
    }

    fetchProcesso()
  }, [processoId, searchParams, setValue, fetchDecisoesDeferidas, fetchValoresEspecificos])

  // Watch valores para exibição
  const modalidadePagamento = watch('modalidadePagamento')
  const numeroParcelas = watch('numeroParcelas') || 1
  const valorTotal = watch('valorTotal') || 0
  const percentualDesconto = watch('percentualDesconto') || 0
  const valorDesconto = watch('valorDesconto') || 0

  // Calcular valores finais para exibição (sem usar setValue)
  const calcularValores = () => {
    const desconto = percentualDesconto > 0 ? (valorTotal * percentualDesconto) / 100 : valorDesconto
    const final = valorTotal - desconto
    return {
      original: valorTotal,
      desconto,
      final
    }
  }

  const valoresCalculados = calcularValores()

  const onSubmit = async (data: AcordoInput) => {
    setIsLoading(true)
    setError(null)

    try {
      // Calcular valores finais antes de enviar
      const valores = calcularValores()
      const finalData = {
        ...data,
        valorFinal: valores.final,
        valorDesconto: valores.desconto,
        dadosEspecificos
      }


      const response = await fetch('/api/acordos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(finalData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar acordo')
      }

      const resultado = await response.json()

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/acordos/${resultado.id}`)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectProcesso = (processo: Processo) => {
    setSelectedProcesso(processo)
    setValue('processoId', processo.id)
    setValue('valorTotal', processo.valor || 0)
    setSearchProcesso('')
  }

  const getTipoProcessoLabel = (tipo: string) => {
    switch (tipo) {
      case 'COMPENSACAO': return 'Compensação'
      case 'DACAO_PAGAMENTO': return 'Dação em Pagamento'
      case 'TRANSACAO_EXCEPCIONAL': return 'Transação Excepcional'
      default: return tipo
    }
  }

  const getTipoDecisaoLabel = (tipoDecisao: string) => {
    switch (tipoDecisao) {
      case 'DEFERIDO': return 'Deferido'
      case 'PARCIAL': return 'Deferido Parcial'
      case 'INDEFERIDO': return 'Indeferido'
      default: return tipoDecisao
    }
  }

  const getTipoDecisaoColor = (tipoDecisao: string) => {
    switch (tipoDecisao) {
      case 'DEFERIDO': return 'bg-green-100 text-green-800'
      case 'PARCIAL': return 'bg-yellow-100 text-yellow-800'
      case 'INDEFERIDO': return 'bg-red-100 text-red-800'
      default: return 'bg-green-100 text-green-800'
    }
  }

  const processosFiltrados = processos.filter(processo =>
    processo.numero.toLowerCase().includes(searchProcesso.toLowerCase()) ||
    processo.contribuinte.nome.toLowerCase().includes(searchProcesso.toLowerCase())
  )

  // Calcular valor das parcelas se for parcelado
  const valorParcela = modalidadePagamento === 'parcelado' && numeroParcelas > 0
    ? valoresCalculados.final / numeroParcelas
    : 0

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Seleção de Processo */}
      <Card>
        <CardHeader>
          <CardTitle>Processo para Acordo</CardTitle>
          <CardDescription>
            Selecione o processo que terá um acordo de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedProcesso ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar processo por número ou contribuinte..."
                  value={searchProcesso}
                  onChange={(e) => setSearchProcesso(e.target.value)}
                  className="pl-10"
                  disabled={isLoading || isLoadingProcessos}
                />
              </div>

              {isLoadingProcessos ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">Carregando processos elegíveis</p>
                      <p className="text-xs text-gray-500">Verificando processos julgados e configurações...</p>
                    </div>
                  </div>
                </div>
              ) : processosFiltrados.length > 0 ? (
                <div className="border rounded-lg max-h-96 overflow-y-auto">
                  {processosFiltrados.map((processo) => (
                    <div
                      key={processo.id}
                      onClick={() => handleSelectProcesso(processo)}
                      className="p-4 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    >
                      <div>
                        <div>
                          <p className="font-medium">{processo.numero}</p>
                          <p className="text-sm text-gray-600">{processo.contribuinte.nome}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">
                              {getTipoProcessoLabel(processo.tipo)}
                            </Badge>
                            <Badge className="bg-blue-100 text-blue-800">
                              {processo.status === 'JULGADO' ? 'Julgado' : processo.status}
                            </Badge>
                            {processo.tipoDecisao && (
                              <Badge className={getTipoDecisaoColor(processo.tipoDecisao)}>
                                {getTipoDecisaoLabel(processo.tipoDecisao)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchProcesso.length === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <HandCoins className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                    <p className="text-sm font-medium text-blue-800 mb-2">
                      <strong>{processos.length}</strong> processo{processos.length !== 1 ? 's' : ''} elegível{processos.length !== 1 ? 'is' : ''} para acordo
                    </p>
                    <p className="text-xs text-blue-600">
                      Digite no campo acima para buscar um processo específico
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Nenhum processo encontrado com os critérios de busca</p>
                  <p className="text-xs text-gray-400 mt-1">Tente uma busca diferente</p>
                </div>
              )}

              {!isLoadingProcessos && processos.length === 0 && (
                <div className="text-center py-8">
                  <HandCoins className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum processo elegível
                  </h3>
                  <p className="text-gray-600">
                    Não há processos deferidos disponíveis para criar acordos.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-blue-900">{selectedProcesso.numero}</h4>
                  <p className="text-sm text-blue-700">{selectedProcesso.contribuinte.nome}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">
                      {getTipoProcessoLabel(selectedProcesso.tipo)}
                    </Badge>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProcesso(null)
                    setValue('processoId', '')
                    setValue('valorTotal', 0)
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

      {/* Seção Específica por Tipo de Processo */}
      {selectedProcesso && selectedProcesso.tipo === 'TRANSACAO_EXCEPCIONAL' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Detalhes da Transação Excepcional
            </CardTitle>
            <CardDescription>
              Configure os detalhes específicos do acordo de transação excepcional
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedProcesso.valoresEspecificos?.detalhes ? (
              <TransacaoExcepcionalAcordoSection
                valoresTransacao={selectedProcesso.valoresEspecificos.detalhes}
                onSelectionChange={(dadosSelecionados) => {
                  // Atualizar valores do formulário baseado na seleção
                  setValue('valorTotal', dadosSelecionados.valorTotal)
                  setValue('valorFinal', dadosSelecionados.valorFinal)

                  // Configurar modalidade de pagamento baseada na proposta
                  if (dadosSelecionados.metodoPagamento) {
                    const modalidade = dadosSelecionados.metodoPagamento === 'a_vista' ? 'avista' : 'parcelado'
                    setValue('modalidadePagamento', modalidade)
                  }

                  // Configurar número de parcelas
                  if (dadosSelecionados.numeroParcelas) {
                    setValue('numeroParcelas', dadosSelecionados.numeroParcelas)
                  }

                  // Capturar dados específicos
                  setDadosEspecificos(dadosSelecionados)
                }}
              />
            ) : (
              <div className="text-center py-8">
                <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Valores não configurados
                </h3>
                <p className="text-gray-600">
                  Os valores específicos da transação excepcional ainda não foram configurados para este processo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seção Específica para Compensação */}
      {selectedProcesso && selectedProcesso.tipo === 'COMPENSACAO' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Detalhes da Compensação
            </CardTitle>
            <CardDescription>
              Configure os detalhes específicos do acordo de compensação
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedProcesso.valoresEspecificos?.detalhes ? (
              <CompensacaoSection
                valoresCompensacao={selectedProcesso.valoresEspecificos.detalhes}
                onSelectionChange={(dadosSelecionados) => {
                  // Atualizar valores do formulário baseado na seleção
                  setValue('valorTotal', dadosSelecionados.valorTotal)
                  setValue('valorFinal', dadosSelecionados.valorFinal)
                  // Capturar dados específicos
                  setDadosEspecificos(dadosSelecionados)
                }}
              />
            ) : (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Valores não configurados
                </h3>
                <p className="text-gray-600">
                  Os valores específicos da compensação ainda não foram configurados para este processo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seção Específica para Dação em Pagamento */}
      {selectedProcesso && selectedProcesso.tipo === 'DACAO_PAGAMENTO' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Detalhes da Dação em Pagamento
            </CardTitle>
            <CardDescription>
              Configure os detalhes específicos do acordo de dação em pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedProcesso.valoresEspecificos?.detalhes ? (
              <DacaoSection
                valoresDacao={selectedProcesso.valoresEspecificos.detalhes}
                onSelectionChange={(dadosSelecionados) => {
                  // Atualizar valores do formulário baseado na seleção
                  setValue('valorTotal', dadosSelecionados.valorTotal)
                  setValue('valorFinal', dadosSelecionados.valorFinal)
                  // Capturar dados específicos
                  setDadosEspecificos(dadosSelecionados)
                }}
              />
            ) : (
              <div className="text-center py-8">
                <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Valores não configurados
                </h3>
                <p className="text-gray-600">
                  Os valores específicos da dação em pagamento ainda não foram configurados para este processo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Valores do Acordo */}
      {selectedProcesso && (
        <>


          {/* Datas */}
          <Card>
            <CardHeader>
              <CardTitle>Datas do Acordo</CardTitle>
              <CardDescription>
                Configure as datas de assinatura e vencimento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dataAssinatura">Data de Assinatura *</Label>
                  <Input
                    id="dataAssinatura"
                    type="date"
                    {...register('dataAssinatura', {
                      setValueAs: (value) => value ? new Date(value) : undefined
                    })}
                    disabled={isLoading}
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                  {errors.dataAssinatura && (
                    <p className="text-sm text-red-500">{errors.dataAssinatura.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataVencimento">Data de Vencimento *</Label>
                  <Input
                    id="dataVencimento"
                    type="date"
                    {...register('dataVencimento', {
                      setValueAs: (value) => value ? new Date(value) : undefined
                    })}
                    disabled={isLoading}
                  />
                  {errors.dataVencimento && (
                    <p className="text-sm text-red-500">{errors.dataVencimento.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Modalidade de Pagamento - apenas para tipos que não têm proposta específica */}
          {selectedProcesso.tipo !== 'TRANSACAO_EXCEPCIONAL' && (
            <Card>
              <CardHeader>
                <CardTitle>Modalidade de Pagamento</CardTitle>
                <CardDescription>
                  Escolha se o pagamento será à vista ou parcelado
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label>Forma de Pagamento *</Label>
                  <RadioGroup
                    value={modalidadePagamento}
                    onValueChange={(value) => {
                      setValue('modalidadePagamento', value)
                      // Se mudar para à vista, definir parcelas como 1
                      if (value === 'avista') {
                        setValue('numeroParcelas', 1)
                      } else if (value === 'parcelado' && numeroParcelas < 2) {
                        // Se mudar para parcelado e tem menos de 2 parcelas, definir como 2
                        setValue('numeroParcelas', 2)
                      }
                    }}
                    disabled={isLoading}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="avista" id="avista" />
                      <Label htmlFor="avista">À Vista</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="parcelado" id="parcelado" />
                      <Label htmlFor="parcelado">Parcelado</Label>
                    </div>
                  </RadioGroup>
                  {errors.modalidadePagamento && (
                    <p className="text-sm text-red-500">{errors.modalidadePagamento.message}</p>
                  )}
                </div>

                {modalidadePagamento === 'parcelado' && (
                  <div className="space-y-2">
                    <Label htmlFor="numeroParcelas">Número de Parcelas *</Label>
                    <Input
                      id="numeroParcelas"
                      type="number"
                      min={2}
                      max={60}
                      {...register('numeroParcelas', {
                        setValueAs: (value) => parseInt(value) || 1
                      })}
                      disabled={isLoading}
                      placeholder="Ex: 12"
                    />
                    {errors.numeroParcelas && (
                      <p className="text-sm text-red-500">{errors.numeroParcelas.message}</p>
                    )}
                    {valorParcela > 0 && (
                      <p className="text-sm text-gray-600">
                        Valor da parcela: R$ {valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
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
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !selectedProcesso}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <HandCoins className="mr-2 h-4 w-4" />
                  Criar Acordo
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
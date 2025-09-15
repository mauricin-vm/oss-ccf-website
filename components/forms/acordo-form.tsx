'use client'

import { useState, useEffect } from 'react'
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
import { Loader2, AlertCircle, HandCoins, Calculator, FileText, Search, User, Building } from 'lucide-react'

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
  contribuinte: {
    nome: string
    documento: string
    email: string
  }
  decisoes: Array<{
    id: string
    tipo: string
    descricao: string
  }>
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
  const [processos, setProcessos] = useState<Processo[]>([])
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null)
  const [searchProcesso, setSearchProcesso] = useState('')
  const [valorCalculado, setValorCalculado] = useState({
    original: 0,
    desconto: 0,
    final: 0
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<AcordoInput>({
    resolver: zodResolver(acordoSchema),
    defaultValues: {
      modalidadePagamento: 'avista',
      dataAssinatura: new Date(),
      numeroParcelas: 1
    }
  })

  // Buscar processos elegíveis para acordo
  useEffect(() => {
    const fetchProcessos = async () => {
      try {
        const response = await fetch('/api/processos?status=DEFERIDO,DEFERIDO_PARCIAL&semAcordo=true')
        if (response.ok) {
          const data = await response.json()
          setProcessos(data.processos || [])
        }
      } catch (error) {
        console.error('Erro ao buscar processos:', error)
      }
    }

    fetchProcessos()
  }, [])

  // Se processoId for fornecido via prop ou URL, buscar o processo específico
  useEffect(() => {
    const fetchProcesso = async () => {
      const processoIdFromUrl = processoId || searchParams.get('processo')
      if (!processoIdFromUrl) return

      try {
        const response = await fetch(`/api/processos/${processoIdFromUrl}`)
        if (response.ok) {
          const processo = await response.json()
          if (['DEFERIDO', 'DEFERIDO_PARCIAL'].includes(processo.status)) {
            
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
            setValorCalculado({
              original: processoComValores.valoresEspecificos.valorOriginal,
              desconto: processoComValores.valoresEspecificos.valorOriginal - valorParaUsar,
              final: valorParaUsar
            })
          }
        }
      } catch (error) {
        console.error('Erro ao buscar processo:', error)
      }
    }

    fetchProcesso()
  }, [processoId, searchParams, setValue])

  // Calcular valores quando há mudanças
  useEffect(() => {
    const valorTotal = watch('valorTotal') || 0
    const percentualDesconto = watch('percentualDesconto') || 0
    const valorDesconto = watch('valorDesconto') || 0

    let novoDesconto = valorDesconto
    let novoPercentual = percentualDesconto

    // Se foi alterado o percentual, calcular valor do desconto
    if (percentualDesconto > 0 && valorTotal > 0) {
      novoDesconto = (valorTotal * percentualDesconto) / 100
      setValue('valorDesconto', novoDesconto)
    }

    // Se foi alterado o valor do desconto, calcular percentual
    if (valorDesconto > 0 && valorTotal > 0) {
      novoPercentual = (valorDesconto / valorTotal) * 100
      setValue('percentualDesconto', novoPercentual)
    }

    const valorFinal = valorTotal - novoDesconto
    setValue('valorFinal', valorFinal)

    setValorCalculado({
      original: valorTotal,
      desconto: novoDesconto,
      final: valorFinal
    })
  }, [watch, setValue])

  const onSubmit = async (data: AcordoInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/acordos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
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
    setValue('valorTotal', processo.valor)
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

  const processosFiltrados = processos.filter(processo =>
    processo.numero.toLowerCase().includes(searchProcesso.toLowerCase()) ||
    processo.contribuinte.nome.toLowerCase().includes(searchProcesso.toLowerCase())
  )

  const modalidadePagamento = watch('modalidadePagamento')
  const numeroParcelas = watch('numeroParcelas') || 1

  // Calcular valor das parcelas se for parcelado
  const valorParcela = modalidadePagamento === 'parcelado' && numeroParcelas > 0
    ? valorCalculado.final / numeroParcelas
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
                  disabled={isLoading}
                />
              </div>

              {processosFiltrados.length > 0 && (
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {processosFiltrados.map((processo) => (
                    <div
                      key={processo.id}
                      onClick={() => handleSelectProcesso(processo)}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{processo.numero}</p>
                          <p className="text-sm text-gray-600">{processo.contribuinte.nome}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">
                              {getTipoProcessoLabel(processo.tipo)}
                            </Badge>
                            <Badge className="bg-green-100 text-green-800">
                              {processo.status === 'DEFERIDO' ? 'Deferido' : 'Deferido Parcial'}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            R$ {processo.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchProcesso.length > 0 && processosFiltrados.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Nenhum processo encontrado
                </p>
              )}

              {processos.length === 0 && (
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
                    <span className="text-sm text-blue-700">
                      R$ {selectedProcesso.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
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

              {/* Detalhes do Contribuinte */}
              <div className="mt-4 p-3 bg-white rounded border">
                <h5 className="text-sm font-medium text-blue-900 mb-2">Dados do Contribuinte:</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>{selectedProcesso.contribuinte.nome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span>{selectedProcesso.contribuinte.documento}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span>{selectedProcesso.contribuinte.email}</span>
                  </div>
                </div>
              </div>

              {/* Decisões do Processo */}
              {selectedProcesso.decisoes.length > 0 && (
                <div className="mt-4 p-3 bg-white rounded border">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">Decisões do Processo:</h5>
                  <div className="space-y-2">
                    {selectedProcesso.decisoes.map((decisao) => (
                      <div key={decisao.id} className="text-sm">
                        <Badge
                          className={
                            decisao.tipo === 'deferido' ? 'bg-green-100 text-green-800' :
                              decisao.tipo === 'indeferido' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {decisao.tipo === 'deferido' ? 'Deferido' :
                            decisao.tipo === 'indeferido' ? 'Indeferido' :
                              'Parcial'}
                        </Badge>
                        <p className="text-gray-700 mt-1">{decisao.descricao}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Valores Específicos Configurados */}
              {selectedProcesso.valoresEspecificos && (
                <div className="mt-4 p-3 rounded border bg-gradient-to-r from-green-50 to-blue-50">
                  <h5 className="text-sm font-medium text-green-900 mb-2 flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Valores Configurados para o Tipo de Processo
                  </h5>
                  
                  {selectedProcesso.valoresEspecificos.configurado ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Valor Original:</span>
                          <p className="font-medium">
                            R$ {selectedProcesso.valoresEspecificos.valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-600">Valor para Acordo:</span>
                          <p className="font-bold text-green-700">
                            R$ {selectedProcesso.valoresEspecificos.valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-xs text-green-700 bg-green-100 p-2 rounded">
                        ✅ Os valores específicos para este tipo de processo ({getTipoProcessoLabel(selectedProcesso.tipo)}) 
                        já foram configurados. O acordo será baseado nos valores configurados.
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-700 bg-amber-100 p-2 rounded">
                      ⚠️ Os valores específicos para este tipo de processo ({getTipoProcessoLabel(selectedProcesso.tipo)}) 
                      ainda não foram configurados. Será usado o valor original do processo.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {errors.processoId && (
            <p className="text-sm text-red-500">{errors.processoId.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Valores do Acordo */}
      {selectedProcesso && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Valores do Acordo
              </CardTitle>
              <CardDescription>
                Configure o valor total e descontos aplicáveis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valorTotal">Valor Total *</Label>
                  <Input
                    id="valorTotal"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('valorTotal', { valueAsNumber: true })}
                    disabled={isLoading}
                  />
                  {errors.valorTotal && (
                    <p className="text-sm text-red-500">{errors.valorTotal.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="percentualDesconto">Percentual de Desconto (%)</Label>
                  <Input
                    id="percentualDesconto"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    {...register('percentualDesconto', { valueAsNumber: true })}
                    disabled={isLoading}
                  />
                  {errors.percentualDesconto && (
                    <p className="text-sm text-red-500">{errors.percentualDesconto.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valorDesconto">Valor do Desconto (R$)</Label>
                  <Input
                    id="valorDesconto"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('valorDesconto', { valueAsNumber: true })}
                    disabled={isLoading}
                  />
                  {errors.valorDesconto && (
                    <p className="text-sm text-red-500">{errors.valorDesconto.message}</p>
                  )}
                </div>
              </div>

              {/* Resumo dos Valores */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h5 className="text-sm font-medium mb-3">Resumo dos Valores:</h5>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Valor Original:</span>
                    <p className="font-medium">
                      R$ {valorCalculado.original.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Desconto:</span>
                    <p className="font-medium text-red-600">
                      - R$ {valorCalculado.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Valor Final:</span>
                    <p className="font-bold text-green-600 text-lg">
                      R$ {valorCalculado.final.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              <Input
                type="hidden"
                {...register('valorFinal', { valueAsNumber: true })}
              />
            </CardContent>
          </Card>

          {/* Modalidade de Pagamento */}
          <Card>
            <CardHeader>
              <CardTitle>Modalidade de Pagamento</CardTitle>
              <CardDescription>
                Escolha como o acordo será pago
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={modalidadePagamento}
                onValueChange={(value) => {
                  setValue('modalidadePagamento', value as 'avista' | 'parcelado')
                  if (value === 'avista') {
                    setValue('numeroParcelas', 1)
                  }
                }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className="flex items-center space-x-2 p-4 border rounded-lg">
                  <RadioGroupItem value="avista" id="avista" />
                  <div className="space-y-1">
                    <Label htmlFor="avista" className="font-medium">À Vista</Label>
                    <p className="text-sm text-gray-600">Pagamento integral na data de vencimento</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg">
                  <RadioGroupItem value="parcelado" id="parcelado" />
                  <div className="space-y-1">
                    <Label htmlFor="parcelado" className="font-medium">Parcelado</Label>
                    <p className="text-sm text-gray-600">Pagamento dividido em parcelas mensais</p>
                  </div>
                </div>
              </RadioGroup>

              {modalidadePagamento === 'parcelado' && (
                <div className="space-y-2">
                  <Label htmlFor="numeroParcelas">Número de Parcelas *</Label>
                  <Input
                    id="numeroParcelas"
                    type="number"
                    min="2"
                    max="60"
                    {...register('numeroParcelas', { valueAsNumber: true })}
                    disabled={isLoading}
                  />
                  {valorParcela > 0 && (
                    <p className="text-sm text-gray-600">
                      Cada parcela: R$ {valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  {errors.numeroParcelas && (
                    <p className="text-sm text-red-500">{errors.numeroParcelas.message}</p>
                  )}
                </div>
              )}
              {errors.modalidadePagamento && (
                <p className="text-sm text-red-500">{errors.modalidadePagamento.message}</p>
              )}
            </CardContent>
          </Card>

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

          {/* Observações */}
          <Card>
            <CardHeader>
              <CardTitle>Observações e Cláusulas</CardTitle>
              <CardDescription>
                Informações adicionais sobre o acordo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações Gerais</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações sobre o acordo, condições especiais, etc..."
                  rows={3}
                  {...register('observacoes')}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clausulasEspeciais">Cláusulas Especiais</Label>
                <Textarea
                  id="clausulasEspeciais"
                  placeholder="Cláusulas contratuais específicas, penalidades, etc..."
                  rows={4}
                  {...register('clausulasEspeciais')}
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500">
                  Descreva condições especiais, multas por atraso, ou outras cláusulas contratuais
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Resumo Final */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resumo do Acordo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Processo:</span>
                  <span className="font-medium">{selectedProcesso.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Contribuinte:</span>
                  <span className="font-medium">{selectedProcesso.contribuinte.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor Original:</span>
                  <span className="font-medium">
                    R$ {valorCalculado.original.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {valorCalculado.desconto > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Desconto:</span>
                    <span className="font-medium text-red-600">
                      - R$ {valorCalculado.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Valor Final:</span>
                  <span className="font-bold text-lg">
                    R$ {valorCalculado.final.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Modalidade:</span>
                  <span className="font-medium">
                    {modalidadePagamento === 'avista' ? 'À Vista' : `${numeroParcelas}x`}
                  </span>
                </div>
                {modalidadePagamento === 'parcelado' && valorParcela > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Valor por Parcela:</span>
                    <span className="font-medium">
                      R$ {valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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
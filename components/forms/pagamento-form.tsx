'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { pagamentoSchema, type PagamentoInput } from '@/lib/validations/acordo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, AlertCircle, DollarSign, CreditCard, Calendar, FileText } from 'lucide-react'

interface PagamentoFormProps {
  acordoId: string
  onSuccess?: () => void
}

interface Parcela {
  id: string
  numero: number
  valor: number
  dataVencimento: Date
  status: string
  valorPago: number
  valorRestante: number
}

interface Acordo {
  id: string
  valorFinal: number
  modalidadePagamento: string
  numeroParcelas: number
  processo: {
    numero: string
    contribuinte: {
      nome: string
      documento: string
    }
  }
  parcelas: Parcela[]
}

export default function PagamentoForm({ acordoId, onSuccess }: PagamentoFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [acordo, setAcordo] = useState<Acordo | null>(null)
  const [selectedParcela, setSelectedParcela] = useState<Parcela | null>(null)
  const [loadingAcordo, setLoadingAcordo] = useState(true)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<PagamentoInput>({
    resolver: zodResolver(pagamentoSchema),
    defaultValues: {
      dataPagamento: new Date(),
      formaPagamento: 'pix'
    }
  })

  // Buscar dados do acordo
  useEffect(() => {
    const fetchAcordo = async () => {
      try {
        const response = await fetch(`/api/acordos/${acordoId}`)
        if (response.ok) {
          const data = await response.json()

          // Calcular valores das parcelas
          const parcelasComValores = data.parcelas.map((parcela: { id: string; numero: number; valor: number; dataVencimento: Date; status: string; pagamentos?: { valorPago: number }[] }) => {
            const valorPago = parcela.pagamentos?.reduce((total: number, p) => total + p.valorPago, 0) || 0
            return {
              ...parcela,
              valorPago,
              valorRestante: parcela.valor - valorPago
            }
          })

          setAcordo({
            ...data,
            parcelas: parcelasComValores
          })

          // Se parcela foi especificada na URL, selecionar automaticamente
          const parcelaIdFromUrl = searchParams.get('parcela')
          if (parcelaIdFromUrl) {
            const parcela = parcelasComValores.find((p: Parcela) => p.id === parcelaIdFromUrl)
            if (parcela && parcela.status === 'pendente') {
              setSelectedParcela(parcela)
              setValue('parcelaId', parcela.id)
              setValue('valorPago', parcela.valorRestante)
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar acordo:', error)
        setError('Erro ao carregar dados do acordo')
      } finally {
        setLoadingAcordo(false)
      }
    }

    fetchAcordo()
  }, [acordoId, searchParams, setValue])

  const onSubmit = async (data: PagamentoInput) => {
    if (!selectedParcela) {
      setError('Selecione uma parcela para pagamento')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/acordos/${acordoId}/pagamentos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao registrar pagamento')
      }

      await response.json()

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/acordos/${acordoId}`)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectParcela = (parcela: Parcela) => {
    setSelectedParcela(parcela)
    setValue('parcelaId', parcela.id)
    setValue('valorPago', parcela.valorRestante)
  }

  const getFormasPagamento = () => [
    { value: 'dinheiro', label: 'Dinheiro' },
    { value: 'pix', label: 'PIX' },
    { value: 'transferencia', label: 'Transferência Bancária' },
    { value: 'boleto', label: 'Boleto' },
    { value: 'cartao', label: 'Cartão' },
    { value: 'dacao', label: 'Dação em Pagamento' },
    { value: 'compensacao', label: 'Compensação' }
  ]

  const isVencida = (dataVencimento: Date) => {
    return new Date(dataVencimento) < new Date()
  }

  const valorPago = watch('valorPago') || 0

  if (loadingAcordo) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!acordo) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Erro ao carregar dados do acordo</AlertDescription>
      </Alert>
    )
  }

  const parcelasPendentes = acordo.parcelas.filter(p => p.status === 'pendente' && p.valorRestante > 0)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Informações do Acordo */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Acordo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600 block">Processo:</span>
              <span className="font-medium">{acordo.processo.numero}</span>
            </div>
            <div>
              <span className="text-gray-600 block">Contribuinte:</span>
              <span className="font-medium">{acordo.processo.contribuinte.nome}</span>
            </div>
            <div>
              <span className="text-gray-600 block">Valor Total:</span>
              <span className="font-medium">
                R$ {acordo.valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Parcela */}
      <Card>
        <CardHeader>
          <CardTitle>Parcela para Pagamento</CardTitle>
          <CardDescription>
            Selecione a parcela que será paga
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {parcelasPendentes.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Todas as parcelas foram pagas
              </h3>
              <p className="text-gray-600">
                Este acordo não possui parcelas pendentes de pagamento.
              </p>
            </div>
          ) : !selectedParcela ? (
            <div className="space-y-3">
              {parcelasPendentes.map((parcela) => {
                const vencida = isVencida(parcela.dataVencimento)

                return (
                  <div
                    key={parcela.id}
                    onClick={() => handleSelectParcela(parcela)}
                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${vencida ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                          {parcela.numero}
                        </span>
                        <div>
                          <p className="font-medium">
                            Parcela {parcela.numero} de {acordo.numeroParcelas}
                          </p>
                          <p className="text-sm text-gray-600">
                            Vencimento: {new Date(parcela.dataVencimento).toLocaleDateString('pt-BR')}
                          </p>
                          {vencida && (
                            <Badge className="bg-red-100 text-red-800 mt-1">
                              Vencida
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        {parcela.valorPago > 0 && (
                          <p className="text-sm text-blue-600">
                            Pago: R$ {parcela.valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                        <p className="text-sm text-green-600 font-medium">
                          Restante: R$ {parcela.valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-bold">
                    {selectedParcela.numero}
                  </span>
                  <div>
                    <h4 className="font-medium text-blue-900">
                      Parcela {selectedParcela.numero} de {acordo.numeroParcelas}
                    </h4>
                    <p className="text-sm text-blue-700">
                      Vencimento: {new Date(selectedParcela.dataVencimento).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-sm text-blue-700">
                      Valor da parcela: R$ {selectedParcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    {selectedParcela.valorPago > 0 && (
                      <p className="text-sm text-blue-700">
                        Já pago: R$ {selectedParcela.valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedParcela(null)
                    setValue('parcelaId', '')
                    setValue('valorPago', 0)
                  }}
                >
                  Alterar
                </Button>
              </div>
            </div>
          )}
          {errors.parcelaId && (
            <p className="text-sm text-red-500">{errors.parcelaId.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Dados do Pagamento */}
      {selectedParcela && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Dados do Pagamento
              </CardTitle>
              <CardDescription>
                Configure os detalhes do pagamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dataPagamento">Data do Pagamento *</Label>
                  <Input
                    id="dataPagamento"
                    type="date"
                    {...register('dataPagamento', {
                      setValueAs: (value) => value ? new Date(value) : undefined
                    })}
                    disabled={isLoading}
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                  {errors.dataPagamento && (
                    <p className="text-sm text-red-500">{errors.dataPagamento.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valorPago">Valor Pago *</Label>
                  <Input
                    id="valorPago"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedParcela.valorRestante}
                    {...register('valorPago', { valueAsNumber: true })}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500">
                    Máximo: R$ {selectedParcela.valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  {errors.valorPago && (
                    <p className="text-sm text-red-500">{errors.valorPago.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="numeroComprovante">Número do Comprovante</Label>
                <Input
                  id="numeroComprovante"
                  placeholder="Número do comprovante, autorização, etc..."
                  {...register('numeroComprovante')}
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500">
                  Campo opcional para controle interno
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Forma de Pagamento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Forma de Pagamento
              </CardTitle>
              <CardDescription>
                Selecione como o pagamento foi realizado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={watch('formaPagamento')}
                onValueChange={(value) => setValue('formaPagamento', value as PagamentoInput['formaPagamento'])}
                className="grid grid-cols-2 md:grid-cols-3 gap-4"
              >
                {getFormasPagamento().map((forma) => (
                  <div key={forma.value} className="flex items-center space-x-2 p-3 border rounded-lg">
                    <RadioGroupItem value={forma.value} id={forma.value} />
                    <Label htmlFor={forma.value} className="font-medium cursor-pointer">
                      {forma.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {errors.formaPagamento && (
                <p className="text-sm text-red-500 mt-2">{errors.formaPagamento.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader>
              <CardTitle>Observações</CardTitle>
              <CardDescription>
                Informações adicionais sobre o pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações sobre o pagamento, condições especiais, etc..."
                  rows={3}
                  {...register('observacoes')}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          {/* Resumo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resumo do Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Processo:</span>
                  <span className="font-medium">{acordo.processo.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Contribuinte:</span>
                  <span className="font-medium">{acordo.processo.contribuinte.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Parcela:</span>
                  <span className="font-medium">
                    {selectedParcela.numero} de {acordo.numeroParcelas}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor da Parcela:</span>
                  <span className="font-medium">
                    R$ {selectedParcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {selectedParcela.valorPago > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Já Pago:</span>
                    <span className="font-medium text-blue-600">
                      R$ {selectedParcela.valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-600">Valor a Pagar:</span>
                  <span className="font-bold text-lg text-green-600">
                    R$ {valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Forma de Pagamento:</span>
                  <span className="font-medium">
                    {getFormasPagamento().find(f => f.value === watch('formaPagamento'))?.label}
                  </span>
                </div>
                {valorPago === selectedParcela.valorRestante && (
                  <div className="p-2 bg-green-50 rounded text-green-700 text-center">
                    ✓ Esta parcela será quitada integralmente
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
              disabled={isLoading || !selectedParcela || valorPago <= 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Registrar Pagamento
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, AlertCircle, Plus, Trash2, FileText, Calculator, DollarSign, Edit, CreditCard, Settings } from 'lucide-react'
import { toast } from 'sonner'

const debitoSchema = z.object({
  descricao: z.string().min(1, 'Descrição do débito é obrigatória'),
  valor: z.number().min(0.01, 'Valor deve ser maior que zero'),
  dataVencimento: z.string().min(1, 'Data de vencimento é obrigatória')
})

const inscricaoSchema = z.object({
  numeroInscricao: z.string().min(1, 'Número da inscrição é obrigatório'),
  tipoInscricao: z.enum(['imobiliaria', 'economica'], {
    required_error: 'Tipo de inscrição é obrigatório'
  }),
  debitos: z.array(debitoSchema).min(1, 'Pelo menos um débito deve ser informado')
})

const propostaSchema = z.object({
  valorTotalProposto: z.number().min(0.01, 'Valor total proposto deve ser maior que zero'),
  metodoPagamento: z.enum(['a_vista', 'parcelado'], {
    required_error: 'Método de pagamento é obrigatório'
  }),
  valorEntrada: z.number().min(0, 'Valor de entrada deve ser maior ou igual a zero'),
  quantidadeParcelas: z.number().min(1).max(120, 'Quantidade de parcelas deve ser entre 1 e 120').optional()
})

const valoresTransacaoSchema = z.object({
  inscricoes: z.array(inscricaoSchema),
  proposta: propostaSchema
})

type ValoresTransacaoInput = z.infer<typeof valoresTransacaoSchema>

interface ValoresTransacaoFormProps {
  processoId: string
  onSuccess?: () => void
}

export default function ValoresTransacaoForm({ processoId, onSuccess }: ValoresTransacaoFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInscricaoModal, setShowInscricaoModal] = useState(false)
  const [editingInscricao, setEditingInscricao] = useState<{ index: number, inscricao: any } | null>(null)
  const [resumoData, setResumoData] = useState<any>(null)

  // Estados para formulários dos modais
  const [inscricaoForm, setInscricaoForm] = useState({
    numeroInscricao: '',
    tipoInscricao: 'imobiliaria' as 'imobiliaria' | 'economica',
    debitos: [{ descricao: '', valor: '', dataVencimento: '' }]
  })

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ValoresTransacaoInput>({
    resolver: zodResolver(valoresTransacaoSchema),
    defaultValues: {
      inscricoes: [],
      proposta: {
        valorTotalProposto: 0,
        metodoPagamento: 'a_vista',
        valorEntrada: 0,
        quantidadeParcelas: 1
      }
    }
  })

  const { fields: inscricoesFields, append: appendInscricao, remove: removeInscricao } = useFieldArray({
    control,
    name: 'inscricoes'
  })

  // Carregar dados existentes quando o componente for montado
  useEffect(() => {
    const loadValoresExistentes = async () => {
      try {
        setIsLoadingData(true)
        const response = await fetch(`/api/processos/${processoId}/valores-transacao`)
        if (response.ok) {
          const data = await response.json()

          // Limpar dados atuais
          setValue('inscricoes', [])

          // Carregar inscrições
          if (data.inscricoes && data.inscricoes.length > 0) {
            data.inscricoes.forEach((inscricao: any) => {
              appendInscricao({
                numeroInscricao: inscricao.numeroInscricao,
                tipoInscricao: inscricao.tipoInscricao,
                debitos: inscricao.debitos || []
              })
            })
          }

          // Carregar proposta
          if (data.proposta) {
            setValue('proposta.valorTotalProposto', data.proposta.valorTotalProposto || 0)
            setValue('proposta.metodoPagamento', data.proposta.metodoPagamento || 'a_vista')
            setValue('proposta.valorEntrada', data.proposta.valorEntrada || 0)
            setValue('proposta.quantidadeParcelas', data.proposta.quantidadeParcelas || 1)
          }

          // Carregar resumo (se disponível da nova estrutura do banco)
          if (data.resumo) {
            setResumoData(data.resumo)
          }
        }
      } catch (error) {
        console.error('Erro ao carregar valores existentes:', error)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadValoresExistentes()
  }, [processoId, appendInscricao, setValue])

  const onSubmit = async (data: ValoresTransacaoInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/processos/${processoId}/valores-transacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar valores de transação')
      }

      toast.success('Valores de transação salvos com sucesso!')
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro inesperado')
      toast.error('Erro ao salvar valores de transação')
    } finally {
      setIsLoading(false)
    }
  }

  const openInscricaoModal = () => {
    setEditingInscricao(null)
    setInscricaoForm({
      numeroInscricao: '',
      tipoInscricao: 'imobiliaria',
      debitos: [{ descricao: '', valor: '', dataVencimento: '' }]
    })
    setShowInscricaoModal(true)
  }

  const openEditInscricaoModal = (index: number) => {
    const inscricao = watch(`inscricoes.${index}`)
    setEditingInscricao({ index, inscricao })
    setInscricaoForm({
      numeroInscricao: inscricao.numeroInscricao,
      tipoInscricao: inscricao.tipoInscricao,
      debitos: inscricao.debitos?.map((d: any) => ({
        descricao: d.descricao,
        valor: d.valor?.toString() || '',
        dataVencimento: d.dataVencimento || ''
      })) || [{ descricao: '', valor: '', dataVencimento: '' }]
    })
    setShowInscricaoModal(true)
  }

  const handleSaveInscricao = () => {
    const inscricaoData = {
      numeroInscricao: inscricaoForm.numeroInscricao,
      tipoInscricao: inscricaoForm.tipoInscricao,
      debitos: inscricaoForm.debitos.map(d => ({
        descricao: d.descricao,
        valor: parseFloat(d.valor) || 0,
        dataVencimento: d.dataVencimento
      }))
    }

    if (editingInscricao) {
      // Editar inscrição existente
      const currentInscricoes = watch('inscricoes')
      const updatedInscricoes = [...currentInscricoes]
      updatedInscricoes[editingInscricao.index] = inscricaoData
      setValue('inscricoes', updatedInscricoes)
    } else {
      // Adicionar nova inscrição
      appendInscricao(inscricaoData)
    }

    setShowInscricaoModal(false)
  }

  const addDebito = () => {
    setInscricaoForm({
      ...inscricaoForm,
      debitos: [...inscricaoForm.debitos, { descricao: '', valor: '', dataVencimento: '' }]
    })
  }

  const removeDebito = (index: number) => {
    if (inscricaoForm.debitos.length > 1) {
      if (confirm('Tem certeza que deseja remover este débito?')) {
        setInscricaoForm({
          ...inscricaoForm,
          debitos: inscricaoForm.debitos.filter((_, i) => i !== index)
        })
      }
    }
  }

  const handleRemoveInscricao = (index: number) => {
    const inscricao = watch(`inscricoes.${index}`)
    if (confirm(`Tem certeza que deseja remover a inscrição "${inscricao.numeroInscricao || 'sem número'}"?`)) {
      removeInscricao(index)
    }
  }

  const updateDebito = (index: number, field: string, value: string) => {
    const updatedDebitos = [...inscricaoForm.debitos]
    updatedDebitos[index] = { ...updatedDebitos[index], [field]: value }
    setInscricaoForm({ ...inscricaoForm, debitos: updatedDebitos })
  }

  const calcularTotalDebitos = () => {
    // Se temos dados do resumo salvos no banco, usar eles
    if (resumoData?.valorTotalInscricoes) {
      return resumoData.valorTotalInscricoes
    }

    // Senão, calcular baseado nos campos do formulário
    const inscricoes = watch('inscricoes') || []
    return inscricoes.reduce((total, inscricao) => {
      const totalInscricao = (inscricao.debitos || []).reduce((subtotal, debito) => {
        return subtotal + (debito.valor || 0)
      }, 0)
      return total + totalInscricao
    }, 0)
  }

  const calcularDesconto = () => {
    // Se temos dados do resumo salvos no banco, usar eles
    if (resumoData?.valorDesconto !== undefined) {
      return resumoData.valorDesconto
    }

    // Senão, calcular baseado nos valores atuais
    const totalDebitos = calcularTotalDebitos()
    const valorProposto = watch('proposta.valorTotalProposto') || 0
    return totalDebitos - valorProposto
  }

  const calcularPercentualDesconto = () => {
    // Se temos dados do resumo salvos no banco, usar eles
    if (resumoData?.percentualDesconto !== undefined) {
      return resumoData.percentualDesconto
    }

    // Senão, calcular baseado nos valores atuais
    const totalDebitos = calcularTotalDebitos()
    const desconto = calcularDesconto()
    return totalDebitos > 0 ? (desconto / totalDebitos) * 100 : 0
  }

  const calcularValorParcela = () => {
    const valorProposto = watch('proposta.valorTotalProposto') || 0
    const valorEntrada = watch('proposta.valorEntrada') || 0
    const quantidadeParcelas = watch('proposta.quantidadeParcelas') || 1
    const metodoPagamento = watch('proposta.metodoPagamento')

    if (metodoPagamento === 'parcelado' && quantidadeParcelas > 0 && valorProposto > 0) {
      const valorParcelado = valorProposto - valorEntrada
      return Math.max(0, valorParcelado / quantidadeParcelas)
    }
    return 0
  }

  const totalDebitos = calcularTotalDebitos()
  const valorProposto = watch('proposta.valorTotalProposto') || 0
  const desconto = calcularDesconto()
  const percentualDesconto = calcularPercentualDesconto()
  const metodoPagamento = watch('proposta.metodoPagamento')

  if (!processoId) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Erro: ID do processo não fornecido</p>
      </div>
    )
  }

  // Se ainda está carregando, mostrar loading
  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Carregando valores existentes...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Resumo da Negociação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Resumo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Total a Negociar</span>
                </div>
                <p className="text-lg font-bold text-green-700">
                  R$ {totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-green-600">
                  {inscricoesFields.length} {inscricoesFields.length === 1 ? 'inscrição' : 'inscrições'}
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Valor Proposto</span>
                </div>
                <p className="text-lg font-bold text-blue-700">
                  R$ {valorProposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-blue-600">
                  {metodoPagamento === 'a_vista' ? 'À vista' : `${watch('proposta.quantidadeParcelas') || 1}x`}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-800">Desconto</span>
                </div>
                <p className="text-lg font-bold text-gray-700">
                  R$ {desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-600">
                  {percentualDesconto.toFixed(1)}% de desconto
                </p>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800">Status</span>
                </div>
                <p className={`text-sm font-medium ${valorProposto > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                  {valorProposto > 0 ? 'Negociável' : 'Pendente'}
                </p>
                <p className="text-xs text-purple-600">
                  {valorProposto > 0 ? 'Proposta definida' : 'Definir proposta'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inscrições a Negociar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                Inscrições a Negociar
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openInscricaoModal}
                disabled={isLoading}
                className="cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Inscrição
              </Button>
            </div>
            <CardDescription>
              Inscrições de dívida ativa que o contribuinte deseja negociar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inscricoesFields.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-gray-500">
                  Nenhuma inscrição adicionada ainda
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Clique em "Adicionar Inscrição" para começar
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inscricoesFields.map((inscricaoField, inscricaoIndex) => {
                  const inscricao = watch(`inscricoes.${inscricaoIndex}`)
                  const totalDebitos = (inscricao.debitos || []).reduce((total, debito) => total + (debito.valor || 0), 0)

                  return (
                    <div key={inscricaoField.id} className="p-4 border rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
                            <FileText className="h-4 w-4 text-green-700" />
                          </div>
                          <div>
                            <h5 className="font-medium text-green-800">{inscricao.numeroInscricao || 'Sem número'}</h5>
                            <p className="text-xs text-green-600 capitalize">{inscricao.tipoInscricao}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditInscricaoModal(inscricaoIndex)}
                            className="h-6 w-6 p-0 text-green-700 hover:text-green-800 cursor-pointer"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveInscricao(inscricaoIndex)}
                            disabled={isLoading}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs text-green-600">
                          {(inscricao.debitos || []).length} débito(s)
                        </p>
                        <p className="text-lg font-bold text-green-600">
                          Total: R$ {totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        {(inscricao.debitos || []).length > 0 && (
                          <div className="text-xs text-green-600 space-y-0.5">
                            {(inscricao.debitos || []).slice(0, 2).map((debito, index) => (
                              <p key={index}>• {debito.descricao || 'Sem descrição'}</p>
                            ))}
                            {(inscricao.debitos || []).length > 2 && (
                              <p>• +{(inscricao.debitos || []).length - 2} mais...</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Proposta da Parte */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              Proposta da Parte
            </CardTitle>
            <CardDescription>
              Valor e condições de pagamento propostas pelo contribuinte
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valorTotalProposto">Valor Total Proposto <span className="text-red-500">*</span></Label>
                <Input
                  id="valorTotalProposto"
                  type="number"
                  step="0.01"
                  {...register('proposta.valorTotalProposto', { valueAsNumber: true })}
                  placeholder="Ex: 120000.00"
                />
                {errors.proposta?.valorTotalProposto && (
                  <p className="text-sm text-red-600">{errors.proposta.valorTotalProposto.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="metodoPagamento">Método de Pagamento <span className="text-red-500">*</span></Label>
                <select
                  id="metodoPagamento"
                  {...register('proposta.metodoPagamento')}
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="a_vista">À Vista</option>
                  <option value="parcelado">Parcelado</option>
                </select>
                {errors.proposta?.metodoPagamento && (
                  <p className="text-sm text-red-600">{errors.proposta.metodoPagamento.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valorEntrada">Valor de Entrada</Label>
                <Input
                  id="valorEntrada"
                  type="number"
                  step="0.01"
                  {...register('proposta.valorEntrada', { valueAsNumber: true })}
                  placeholder="Ex: 20000.00"
                />
                {errors.proposta?.valorEntrada && (
                  <p className="text-sm text-red-600">{errors.proposta.valorEntrada.message}</p>
                )}
              </div>

              {metodoPagamento === 'parcelado' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="quantidadeParcelas">Quantidade de Parcelas (máx. 120)</Label>
                    <Input
                      id="quantidadeParcelas"
                      type="number"
                      min="1"
                      max="120"
                      {...register('proposta.quantidadeParcelas', { valueAsNumber: true })}
                      placeholder="Ex: 12"
                    />
                    {errors.proposta?.quantidadeParcelas && (
                      <p className="text-sm text-red-600">{errors.proposta.quantidadeParcelas.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valorParcela">Valor da Parcela</Label>
                    <Input
                      id="valorParcela"
                      type="number"
                      step="0.01"
                      value={calcularValorParcela().toFixed(2)}
                      disabled={true}
                      className="bg-gray-100"
                    />
                    <p className="text-xs text-gray-500">
                      Calculado automaticamente: (Total - Entrada) ÷ Parcelas
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Simulação de Pagamento */}
            {valorProposto > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h5 className="font-medium mb-3 text-blue-800">Simulação do Pagamento:</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600">Valor de Entrada:</span>
                    <p className="font-medium text-blue-700">
                      R$ {(watch('proposta.valorEntrada') || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">
                      {metodoPagamento === 'parcelado' ? 'Valor das Parcelas:' : 'Valor Total:'}
                    </span>
                    <p className="font-medium text-blue-700">
                      {metodoPagamento === 'parcelado' && watch('proposta.quantidadeParcelas') > 0
                        ? `${watch('proposta.quantidadeParcelas')}x de R$ ${calcularValorParcela().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : `R$ ${valorProposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      }
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">Total Final:</span>
                    <p className="font-bold text-blue-700">
                      R$ {valorProposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex gap-4 justify-end">
          <Button
            type="submit"
            disabled={isLoading}
            className="cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Settings className="mr-2 h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Modal de Inscrição */}
      <Dialog open={showInscricaoModal} onOpenChange={setShowInscricaoModal}>
        <DialogContent className="w-[95vw] !max-w-[1200px] max-h-[90vh] overflow-hidden" style={{ width: '95vw', maxWidth: '1200px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              {editingInscricao ? 'Editar Inscrição' : 'Adicionar Inscrição'}
            </DialogTitle>
            <DialogDescription>
              {editingInscricao ? 'Edite as informações da inscrição e seus débitos' : 'Adicione uma nova inscrição com múltiplos débitos'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modal-inscricao-numero">Número da Inscrição <span className="text-red-500">*</span></Label>
                <Input
                  id="modal-inscricao-numero"
                  value={inscricaoForm.numeroInscricao}
                  onChange={(e) => setInscricaoForm({ ...inscricaoForm, numeroInscricao: e.target.value })}
                  placeholder="Ex: 123.456.789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-inscricao-tipo">Tipo de Inscrição <span className="text-red-500">*</span></Label>
                <select
                  id="modal-inscricao-tipo"
                  value={inscricaoForm.tipoInscricao}
                  onChange={(e) => setInscricaoForm({ ...inscricaoForm, tipoInscricao: e.target.value as 'imobiliaria' | 'economica' })}
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="imobiliaria">Imobiliária</option>
                  <option value="economica">Econômica</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Débitos da Inscrição</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDebito}
                  className="cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Débito
                </Button>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {inscricaoForm.debitos.map((debito, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <h6 className="text-sm font-medium">Débito {index + 1}</h6>
                      {inscricaoForm.debitos.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDebito(index)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`debito-desc-${index}`}>Descrição <span className="text-red-500">*</span></Label>
                        <Input
                          id={`debito-desc-${index}`}
                          value={debito.descricao}
                          onChange={(e) => updateDebito(index, 'descricao', e.target.value)}
                          placeholder="Ex: IPTU 2024"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`debito-valor-${index}`}>Valor Lançado <span className="text-red-500">*</span></Label>
                        <Input
                          id={`debito-valor-${index}`}
                          type="text"
                          value={debito.valor}
                          onChange={(e) => updateDebito(index, 'valor', e.target.value)}
                          placeholder="Ex: 1.500,00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`debito-vencimento-${index}`}>Data de Vencimento <span className="text-red-500">*</span></Label>
                        <Input
                          id={`debito-vencimento-${index}`}
                          type="date"
                          value={debito.dataVencimento}
                          onChange={(e) => updateDebito(index, 'dataVencimento', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-green-50 rounded border border-green-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-green-800">Total dos Débitos:</span>
                  <span className="text-lg font-bold text-green-700">
                    R$ {inscricaoForm.debitos.reduce((total, d) => total + (parseFloat(d.valor) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInscricaoModal(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveInscricao}
                disabled={!inscricaoForm.numeroInscricao || inscricaoForm.debitos.some(d => !d.descricao || !d.valor || !d.dataVencimento)}
                className="cursor-pointer"
              >
                {editingInscricao ? 'Atualizar' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

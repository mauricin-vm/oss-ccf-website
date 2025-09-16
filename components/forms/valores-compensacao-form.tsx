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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, AlertCircle, Plus, Trash2, FileText, Calculator, Edit, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

const creditoSchema = z.object({
  tipo: z.enum(['precatorio', 'credito_tributario', 'alvara_judicial', 'outro'], {
    required_error: 'Tipo de crédito é obrigatório'
  }),
  numero: z.string().min(1, 'Número do crédito é obrigatório'),
  valor: z.union([
    z.string(),
    z.number()
  ])
    .refine((val) => {
      if (typeof val === 'number') return val > 0
      if (typeof val === 'string') {
        if (val === '') return false
        const cleanValue = val.replace(/[^\d,]/g, '')
        const numericValue = cleanValue.replace(',', '.')
        const num = parseFloat(numericValue)
        return !isNaN(num) && num >= 0.01
      }
      return false
    }, 'Valor é obrigatório e deve ser maior que zero')
    .transform((val) => {
      if (typeof val === 'number') return val
      if (typeof val === 'string') {
        const cleanValue = val.replace(/[^\d,]/g, '')
        const numericValue = cleanValue.replace(',', '.')
        return parseFloat(numericValue)
      }
      return 0
    }),
  dataVencimento: z.string().optional(),
  descricao: z.string().optional()
})

const debitoSchema = z.object({
  descricao: z.string().min(1, 'Descrição do débito é obrigatória'),
  valor: z.union([
    z.string(),
    z.number()
  ])
    .refine((val) => {
      if (typeof val === 'number') return val > 0
      if (typeof val === 'string') {
        if (val === '') return false
        const cleanValue = val.replace(/[^\d,]/g, '')
        const numericValue = cleanValue.replace(',', '.')
        const num = parseFloat(numericValue)
        return !isNaN(num) && num >= 0.01
      }
      return false
    }, 'Valor é obrigatório e deve ser maior que zero')
    .transform((val) => {
      if (typeof val === 'number') return val
      if (typeof val === 'string') {
        const cleanValue = val.replace(/[^\d,]/g, '')
        const numericValue = cleanValue.replace(',', '.')
        return parseFloat(numericValue)
      }
      return 0
    }),
  dataVencimento: z.string().min(1, 'Data de vencimento é obrigatória')
})

const inscricaoSchema = z.object({
  numeroInscricao: z.string().min(1, 'Número da inscrição é obrigatório'),
  tipoInscricao: z.enum(['imobiliaria', 'economica'], {
    required_error: 'Tipo de inscrição é obrigatório'
  }),
  debitos: z.array(debitoSchema).min(1, 'Pelo menos um débito deve ser informado')
})

const valoresCompensacaoSchema = z.object({
  creditos: z.array(creditoSchema),
  inscricoes: z.array(inscricaoSchema)
})

type ValoresCompensacaoInput = z.infer<typeof valoresCompensacaoSchema>

interface ValoresCompensacaoFormProps {
  processoId: string
  onSuccess?: () => void
}

export default function ValoresCompensacaoForm({ processoId, onSuccess }: ValoresCompensacaoFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreditoModal, setShowCreditoModal] = useState(false)
  const [showInscricaoModal, setShowInscricaoModal] = useState(false)
  const [editingCredito, setEditingCredito] = useState<{ index: number, credito: Record<string, unknown> } | null>(null)
  const [editingInscricao, setEditingInscricao] = useState<{ index: number, inscricao: Record<string, unknown> } | null>(null)

  // Estados para formulários dos modais
  const [creditoForm, setCreditoForm] = useState({
    tipo: 'precatorio',
    numero: '',
    valor: '',
    dataVencimento: '',
    descricao: ''
  })

  const [inscricaoForm, setInscricaoForm] = useState({
    numeroInscricao: '',
    tipoInscricao: 'imobiliaria',
    debitos: [{ descricao: '', valor: '', dataVencimento: '' }]
  })

  const {
    control,
    handleSubmit,
    watch,
    setValue
  } = useForm<ValoresCompensacaoInput>({
    resolver: zodResolver(valoresCompensacaoSchema),
    defaultValues: {
      creditos: [],
      inscricoes: []
    }
  })

  // Funções de formatação de moeda (igual ao dacao-form)
  const formatCurrency = (value: string) => {
    // Remove tudo que não for número
    const numericValue = value.replace(/\D/g, '')

    // Se não há número, retorna vazio
    if (!numericValue) return ''

    // Converte para centavos
    const cents = parseInt(numericValue, 10)

    // Divide por 100 para ter o valor em reais
    const reais = cents / 100

    // Formata no padrão brasileiro
    return reais.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const parseCurrencyToNumber = (value: string): number => {
    // Remove tudo que não for número ou vírgula
    const cleanValue = value.replace(/[^\d,]/g, '')

    // Substitui vírgula por ponto para parseFloat
    const numericValue = cleanValue.replace(',', '.')

    return parseFloat(numericValue) || 0
  }

  const { fields: creditosFields, append: appendCredito, remove: removeCredito } = useFieldArray({
    control,
    name: 'creditos'
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
        const response = await fetch(`/api/processos/${processoId}/valores-compensacao`)
        if (response.ok) {
          const data = await response.json()

          // Limpar dados atuais
          setValue('creditos', [])
          setValue('inscricoes', [])

          // Carregar créditos
          if (data.creditos && data.creditos.length > 0) {
            data.creditos.forEach((credito: Record<string, unknown>) => {
              // Formatar valor monetário ao carregar
              const valorFormatado = credito.valor
                ? (credito.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : ''

              appendCredito({
                tipo: credito.tipo,
                numero: credito.numero,
                valor: valorFormatado,
                dataVencimento: credito.dataVencimento || '',
                descricao: credito.descricao || ''
              })
            })
          }

          // Carregar inscrições
          if (data.inscricoes && data.inscricoes.length > 0) {
            data.inscricoes.forEach((inscricao: Record<string, unknown>) => {
              const debitosFormatados = (inscricao.debitos as Record<string, unknown>[])?.map((debito: Record<string, unknown>) => ({
                descricao: debito.descricao,
                valor: debito.valor
                  ? (debito.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : '',
                dataVencimento: debito.dataVencimento || ''
              })) || []

              appendInscricao({
                numeroInscricao: inscricao.numeroInscricao,
                tipoInscricao: inscricao.tipoInscricao,
                debitos: debitosFormatados
              })
            })
          }
        }
      } catch (error) {
        console.error('Erro ao carregar valores existentes:', error)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadValoresExistentes()
  }, [processoId, appendCredito, appendInscricao, setValue])

  const onSubmit = async (data: ValoresCompensacaoInput) => {

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/processos/${processoId}/valores-compensacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar valores de compensação')
      }

      toast.success('Valores de compensação salvos com sucesso!')
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro inesperado')
      toast.error('Erro ao salvar valores de compensação')
    } finally {
      setIsLoading(false)
    }
  }

  const openCreditoModal = () => {
    setEditingCredito(null)
    setCreditoForm({
      tipo: 'precatorio',
      numero: '',
      valor: '',
      dataVencimento: '',
      descricao: ''
    })
    setShowCreditoModal(true)
  }

  const openEditCreditoModal = (index: number) => {
    const credito = watch(`creditos.${index}`)
    setEditingCredito({ index, credito })
    setCreditoForm({
      tipo: credito.tipo,
      numero: credito.numero,
      valor: credito.valor?.toString() || '',
      dataVencimento: credito.dataVencimento || '',
      descricao: credito.descricao || ''
    })
    setShowCreditoModal(true)
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
      debitos: inscricao.debitos?.map(d => ({
        descricao: d.descricao,
        valor: d.valor?.toString() || '',
        dataVencimento: d.dataVencimento || ''
      })) || [{ descricao: '', valor: '', dataVencimento: '' }]
    })
    setShowInscricaoModal(true)
  }

  const handleSaveCredito = () => {
    const valor = parseCurrencyToNumber(creditoForm.valor)
    if (!creditoForm.numero || valor <= 0) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    const creditoData = {
      tipo: creditoForm.tipo,
      numero: creditoForm.numero,
      valor: creditoForm.valor, // Manter formato de string para o form
      dataVencimento: creditoForm.dataVencimento,
      descricao: creditoForm.descricao
    }

    if (editingCredito) {
      // Editar crédito existente
      const currentCreditos = watch('creditos')
      const updatedCreditos = [...currentCreditos]
      updatedCreditos[editingCredito.index] = creditoData
      setValue('creditos', updatedCreditos)
    } else {
      // Adicionar novo crédito
      appendCredito(creditoData)
    }

    setShowCreditoModal(false)
    toast.success(editingCredito ? 'Crédito atualizado' : 'Crédito adicionado')
  }

  const handleSaveInscricao = () => {
    if (!inscricaoForm.numeroInscricao) {
      toast.error('Número da inscrição é obrigatório')
      return
    }

    // Validar débitos
    const debitosValidos = inscricaoForm.debitos.filter(d =>
      d.descricao && d.valor && d.dataVencimento
    )

    if (debitosValidos.length === 0) {
      toast.error('Pelo menos um débito deve ser informado')
      return
    }

    const inscricaoData = {
      numeroInscricao: inscricaoForm.numeroInscricao,
      tipoInscricao: inscricaoForm.tipoInscricao,
      debitos: debitosValidos.map(d => ({
        descricao: d.descricao,
        valor: d.valor, // Manter formato de string para o form
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
    toast.success(editingInscricao ? 'Inscrição atualizada' : 'Inscrição adicionada')
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

  const handleRemoveCredito = (index: number) => {
    const credito = watch(`creditos.${index}`)
    if (confirm(`Tem certeza que deseja remover o crédito "${credito.numero || 'sem número'}"?`)) {
      removeCredito(index)
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

  const calcularTotalCreditos = () => {
    const creditos = watch('creditos') || []
    return creditos.reduce((total, credito) => {
      const valor = typeof credito.valor === 'string' ? parseCurrencyToNumber(credito.valor) : (credito.valor || 0)
      return total + valor
    }, 0)
  }

  const calcularTotalDebitos = () => {
    const inscricoes = watch('inscricoes') || []
    return inscricoes.reduce((total, inscricao) => {
      const totalInscricao = (inscricao.debitos || []).reduce((subtotal, debito) => {
        const valor = typeof debito.valor === 'string' ? parseCurrencyToNumber(debito.valor) : (debito.valor || 0)
        return subtotal + valor
      }, 0)
      return total + totalInscricao
    }, 0)
  }

  const totalCreditos = calcularTotalCreditos()
  const totalDebitos = calcularTotalDebitos()

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'precatorio': return 'Precatório'
      case 'credito_tributario': return 'Crédito Tributário'
      case 'alvara_judicial': return 'Alvará Judicial'
      case 'outro': return 'Outro'
      default: return tipo
    }
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Resumo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Resumo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Créditos Oferecidos</span>
              </div>
              <p className="text-lg font-bold text-green-700">
                R$ {totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-green-600">
                {creditosFields.length} {creditosFields.length === 1 ? 'crédito' : 'créditos'}
              </p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">A Compensar</span>
              </div>
              <p className="text-lg font-bold text-blue-700">
                R$ {totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-blue-600">
                {inscricoesFields.length} {inscricoesFields.length === 1 ? 'inscrição' : 'inscrições'}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-800">Saldo</span>
              </div>
              <p className={`text-lg font-bold ${totalCreditos >= totalDebitos ? 'text-green-600' : 'text-red-600'}`}>
                R$ {(totalCreditos - totalDebitos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-600">
                {totalCreditos >= totalDebitos ? 'Superávit' : 'Déficit'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Créditos Oferecidos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Créditos Oferecidos
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCreditoModal}
              disabled={isLoading}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Crédito
            </Button>
          </div>
          <CardDescription>
            Créditos que o contribuinte oferece para compensação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {creditosFields.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">
                Nenhum crédito adicionado ainda
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Clique em &quot;Adicionar Crédito&quot; para começar
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {creditosFields.map((creditoField, creditoIndex) => {
                const credito = watch(`creditos.${creditoIndex}`)
                return (
                  <div key={creditoField.id} className="p-4 border rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
                          <DollarSign className="h-4 w-4 text-green-700" />
                        </div>
                        <div>
                          <h5 className="font-medium text-green-800">{getTipoLabel(credito.tipo)}</h5>
                          <p className="text-xs text-green-600">{credito.numero || 'Sem número'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditCreditoModal(creditoIndex)}
                          className="h-6 w-6 p-0 text-green-700 hover:text-green-800 cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCredito(creditoIndex)}
                          disabled={isLoading}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-lg font-bold text-green-700">
                        R$ {(typeof credito.valor === 'string' ? parseCurrencyToNumber(credito.valor) : (credito.valor || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {credito.dataVencimento && (
                        <p className="text-xs text-green-600">
                          Vence: {new Date(credito.dataVencimento).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                      {credito.descricao && (
                        <p className="text-xs text-green-600">
                          {credito.descricao}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inscrições a Compensar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Inscrições a Compensar
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
            Inscrições municipais que serão compensadas pelos créditos oferecidos
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
                Clique em &quot;Adicionar Inscrição&quot; para começar
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inscricoesFields.map((inscricaoField, inscricaoIndex) => {
                const inscricao = watch(`inscricoes.${inscricaoIndex}`)
                const totalDebitos = (inscricao.debitos || []).reduce((total, debito) => {
                  const valor = typeof debito.valor === 'string' ? parseCurrencyToNumber(debito.valor) : (debito.valor || 0)
                  return total + valor
                }, 0)

                return (
                  <div key={inscricaoField.id} className="p-4 border rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
                          <FileText className="h-4 w-4 text-blue-700" />
                        </div>
                        <div>
                          <h5 className="font-medium text-blue-800">{inscricao.numeroInscricao || 'Sem número'}</h5>
                          <p className="text-xs text-blue-600 capitalize">{inscricao.tipoInscricao}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditInscricaoModal(inscricaoIndex)}
                          className="h-6 w-6 p-0 text-blue-700 hover:text-blue-800 cursor-pointer"
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
                      <p className="text-xs text-blue-600">
                        {(inscricao.debitos || []).length} débito(s)
                      </p>
                      <p className="text-lg font-bold text-blue-600">
                        Total: R$ {totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {(inscricao.debitos || []).length > 0 && (
                        <div className="text-xs text-blue-600 space-y-0.5">
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
              <FileText className="mr-2 h-4 w-4" />
              Salvar
            </>
          )}
        </Button>
      </div>

      {/* Modal de Crédito */}
      <Dialog open={showCreditoModal} onOpenChange={setShowCreditoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              {editingCredito ? 'Editar Crédito' : 'Adicionar Crédito'}
            </DialogTitle>
            <DialogDescription>
              {editingCredito ? 'Edite as informações do crédito' : 'Adicione as informações do crédito'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-tipo">Tipo de Crédito <span className="text-red-500">*</span></Label>
              <select
                id="modal-tipo"
                value={creditoForm.tipo}
                onChange={(e) => setCreditoForm({ ...creditoForm, tipo: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="precatorio">Precatório</option>
                <option value="credito_tributario">Crédito Tributário</option>
                <option value="alvara_judicial">Alvará Judicial</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-numero">Número do Crédito <span className="text-red-500">*</span></Label>
              <Input
                id="modal-numero"
                value={creditoForm.numero}
                onChange={(e) => setCreditoForm({ ...creditoForm, numero: e.target.value })}
                placeholder="Ex: PRE-2024-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-valor">Valor <span className="text-red-500">*</span></Label>
              <Input
                id="modal-valor"
                type="text"
                value={creditoForm.valor}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value)
                  setCreditoForm({ ...creditoForm, valor: formatted })
                }}
                placeholder="Ex: 50.000,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-vencimento">Data de Vencimento</Label>
              <Input
                id="modal-vencimento"
                type="date"
                value={creditoForm.dataVencimento}
                onChange={(e) => setCreditoForm({ ...creditoForm, dataVencimento: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-descricao">Descrição</Label>
              <Textarea
                id="modal-descricao"
                rows={2}
                value={creditoForm.descricao}
                onChange={(e) => setCreditoForm({ ...creditoForm, descricao: e.target.value })}
                placeholder="Informações adicionais sobre o crédito..."
              />
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreditoModal(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveCredito}
                disabled={!creditoForm.numero || !creditoForm.valor}
                className="cursor-pointer"
              >
                {editingCredito ? 'Atualizar' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Inscrição */}
      <Dialog open={showInscricaoModal} onOpenChange={setShowInscricaoModal}>
        <DialogContent className="w-[95vw] !max-w-[1200px] max-h-[90vh] overflow-hidden" style={{ width: '95vw', maxWidth: '1200px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
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
                  onChange={(e) => setInscricaoForm({ ...inscricaoForm, tipoInscricao: e.target.value })}
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
                          onChange={(e) => {
                            const formatted = formatCurrency(e.target.value)
                            updateDebito(index, 'valor', formatted)
                          }}
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

              <div className="p-3 bg-blue-50 rounded border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-blue-800">Total dos Débitos:</span>
                  <span className="text-lg font-bold text-blue-700">
                    R$ {inscricaoForm.debitos.reduce((total, d) => total + parseCurrencyToNumber(d.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
    </form>
  )
}
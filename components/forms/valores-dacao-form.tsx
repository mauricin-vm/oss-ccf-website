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
import { Loader2, AlertCircle, Plus, Trash2, FileText, Calculator, Edit } from 'lucide-react'
import { toast } from 'sonner'

// Tipos para dados carregados da API
interface InscricaoOferecidaData {
  numeroInscricao: string
  tipoInscricao: 'imobiliaria' | 'economica'
  valor: number
  dataVencimento?: string
  descricao?: string
}

interface DebitoData {
  descricao: string
  valor: number
  dataVencimento: string
}

interface InscricaoCompensarData {
  numeroInscricao: string
  tipoInscricao: 'imobiliaria' | 'economica'
  debitos: DebitoData[]
}

// Tipos para estruturas do formulário
interface DebitoFormData {
  descricao: string
  valor: string
  dataVencimento: string
}

const inscricaoOferecidaSchema = z.object({
  numeroInscricao: z.string().min(1, 'Número da inscrição é obrigatório'),
  tipoInscricao: z.enum(['imobiliaria', 'economica'], {
    message: 'Tipo de inscrição é obrigatório'
  }),
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

const inscricaoCompensarSchema = z.object({
  numeroInscricao: z.string().min(1, 'Número da inscrição é obrigatório'),
  tipoInscricao: z.enum(['imobiliaria', 'economica'], {
    message: 'Tipo de inscrição é obrigatório'
  }),
  debitos: z.array(debitoSchema).min(1, 'Pelo menos um débito deve ser informado')
})

const valoresDacaoSchema = z.object({
  inscricoesOferecidas: z.array(inscricaoOferecidaSchema),
  inscricoesCompensar: z.array(inscricaoCompensarSchema)
})

type ValoresDacaoInput = z.infer<typeof valoresDacaoSchema>

interface ValoresDacaoFormProps {
  processoId: string
  onSuccess?: () => void
}

export default function ValoresDacaoForm({ processoId, onSuccess }: ValoresDacaoFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Estados dos modais
  const [showInscricaoOferecidaModal, setShowInscricaoOferecidaModal] = useState(false)
  const [showInscricaoCompensarModal, setShowInscricaoCompensarModal] = useState(false)
  const [editingInscricaoOferecida, setEditingInscricaoOferecida] = useState<{ index: number; inscricao: Record<string, unknown> } | null>(null)
  const [editingInscricaoCompensar, setEditingInscricaoCompensar] = useState<{ index: number; inscricao: Record<string, unknown> } | null>(null)

  // Formulários dos modais
  const [inscricaoOferecidaForm, setInscricaoOferecidaForm] = useState({
    numeroInscricao: '',
    tipoInscricao: 'imobiliaria' as 'imobiliaria' | 'economica',
    valor: '',
    dataVencimento: '',
    descricao: ''
  })

  const [inscricaoCompensarForm, setInscricaoCompensarForm] = useState({
    numeroInscricao: '',
    tipoInscricao: 'imobiliaria' as 'imobiliaria' | 'economica',
    debitos: [{ descricao: '', valor: '', dataVencimento: '' }]
  })

  const {
    control,
    handleSubmit,
    watch,
    setValue
  } = useForm({
    resolver: zodResolver(valoresDacaoSchema),
    defaultValues: {
      inscricoesOferecidas: [],
      inscricoesCompensar: []
    }
  })

  // Funções de formatação de moeda (igual ao transacao-form)
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

  const { fields: inscricoesOferecidasFields, append: appendInscricaoOferecida, remove: removeInscricaoOferecida } = useFieldArray({
    control,
    name: 'inscricoesOferecidas'
  })

  const { fields: inscricoesCompensarFields, append: appendInscricaoCompensar, remove: removeInscricaoCompensar } = useFieldArray({
    control,
    name: 'inscricoesCompensar'
  })

  // Carregar dados existentes quando o componente for montado
  useEffect(() => {
    const loadValoresExistentes = async () => {
      try {
        setIsLoadingData(true)
        const response = await fetch(`/api/processos/${processoId}/valores-dacao`)
        if (response.ok) {
          const data = await response.json()

          // Limpar dados atuais
          setValue('inscricoesOferecidas', [])
          setValue('inscricoesCompensar', [])

          // Carregar inscrições oferecidas
          if (data.inscricoesOferecidas && data.inscricoesOferecidas.length > 0) {
            data.inscricoesOferecidas.forEach((inscricao: InscricaoOferecidaData) => {
              // Usar valor direto da inscrição sem formatação

              appendInscricaoOferecida({
                numeroInscricao: inscricao.numeroInscricao,
                tipoInscricao: inscricao.tipoInscricao,
                valor: inscricao.valor,
                dataVencimento: inscricao.dataVencimento || '',
                descricao: inscricao.descricao || ''
              })
            })
          }

          // Carregar inscrições a compensar
          if (data.inscricoesCompensar && data.inscricoesCompensar.length > 0) {
            data.inscricoesCompensar.forEach((inscricao: InscricaoCompensarData) => {
              const debitosFormatados = inscricao.debitos?.map((debito: DebitoData) => ({
                descricao: debito.descricao,
                valor: debito.valor,
                dataVencimento: debito.dataVencimento || ''
              })) || []

              appendInscricaoCompensar({
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
  }, [processoId, appendInscricaoOferecida, appendInscricaoCompensar, setValue])

  // Função helper para limpar erros visuais de um campo
  const clearFieldError = (fieldId: string) => {
    setTimeout(() => {
      const element = document.getElementById(fieldId)
      if (element) {
        element.style.borderColor = ''
        element.style.boxShadow = ''
        element.removeAttribute('data-error')
      }
    }, 50)
  }

  // Funções dos modais de Inscrições Oferecidas
  const openInscricaoOferecidaModal = () => {
    setInscricaoOferecidaForm({
      numeroInscricao: '',
      tipoInscricao: 'imobiliaria',
      valor: '',
      dataVencimento: '',
      descricao: ''
    })
    setEditingInscricaoOferecida(null)

    // Limpar estilos de erro quando abrir o modal
    setTimeout(() => {
      const fieldIds = ['modal-numero-inscricao', 'modal-valor-inscricao']
      fieldIds.forEach(id => {
        const element = document.getElementById(id)
        if (element) {
          element.style.borderColor = ''
          element.style.boxShadow = ''
          element.removeAttribute('data-error')
        }
      })
    }, 100)

    setShowInscricaoOferecidaModal(true)
  }

  const openEditInscricaoOferecidaModal = (index: number) => {
    const inscricao = watch(`inscricoesOferecidas.${index}`)
    setEditingInscricaoOferecida({ index, inscricao })
    setInscricaoOferecidaForm({
      numeroInscricao: inscricao.numeroInscricao,
      tipoInscricao: inscricao.tipoInscricao,
      valor: inscricao.valor ? inscricao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
      dataVencimento: inscricao.dataVencimento || '',
      descricao: inscricao.descricao || ''
    })

    // Limpar estilos de erro quando abrir o modal para edição
    setTimeout(() => {
      const fieldIds = ['modal-numero-inscricao', 'modal-valor-inscricao']
      fieldIds.forEach(id => {
        const element = document.getElementById(id)
        if (element) {
          element.style.borderColor = ''
          element.style.boxShadow = ''
          element.removeAttribute('data-error')
        }
      })
    }, 100)

    setShowInscricaoOferecidaModal(true)
  }

  const handleSaveInscricaoOferecida = () => {
    // Validar campos na ordem: numeroInscricao -> valor
    const errors: string[] = []
    let firstErrorField: string | null = null

    // Validar número da inscrição
    if (!inscricaoOferecidaForm.numeroInscricao.trim()) {
      errors.push('Número da inscrição é obrigatório')
      if (!firstErrorField) firstErrorField = 'modal-numero-inscricao'
    }

    // Validar valor
    const valor = parseCurrencyToNumber(inscricaoOferecidaForm.valor)
    if (valor <= 0) {
      errors.push('Valor é obrigatório e deve ser maior que zero')
      if (!firstErrorField) firstErrorField = 'modal-valor-inscricao'
    }

    // Se houver erros, mostrar toast e focar no primeiro campo com erro
    if (errors.length > 0) {
      toast.warning(errors[0]) // Mostrar apenas o primeiro erro

      if (firstErrorField) {
        setTimeout(() => {
          const element = document.getElementById(firstErrorField!)
          if (element) {
            element.focus()
            // Aplicar classes de erro com !important via style para garantir que funcionem
            element.style.borderColor = '#ef4444'
            element.style.boxShadow = '0 0 0 1px #ef4444'
            element.setAttribute('data-error', 'true')
          }
        }, 100)
      }
      return
    }

    // Limpar estilos de erro dos campos
    const fieldIds = ['modal-numero-inscricao', 'modal-valor-inscricao']
    fieldIds.forEach(id => {
      const element = document.getElementById(id)
      if (element) {
        element.style.borderColor = ''
        element.style.boxShadow = ''
        element.removeAttribute('data-error')
      }
    })

    const inscricaoData = {
      numeroInscricao: inscricaoOferecidaForm.numeroInscricao,
      tipoInscricao: inscricaoOferecidaForm.tipoInscricao,
      valor: inscricaoOferecidaForm.valor, // Manter formato de string para o form
      dataVencimento: inscricaoOferecidaForm.dataVencimento || undefined,
      descricao: inscricaoOferecidaForm.descricao || undefined
    }

    if (editingInscricaoOferecida) {
      setValue(`inscricoesOferecidas.${editingInscricaoOferecida.index}`, inscricaoData)
    } else {
      appendInscricaoOferecida(inscricaoData)
    }

    setShowInscricaoOferecidaModal(false)
    toast.success(editingInscricaoOferecida ? 'Inscrição atualizada' : 'Inscrição adicionada')
  }

  const handleRemoveInscricaoOferecida = (index: number) => {
    const inscricao = watch(`inscricoesOferecidas.${index}`)
    if (confirm(`Tem certeza que deseja remover a inscrição "${inscricao.numeroInscricao}"?`)) {
      removeInscricaoOferecida(index)
      toast.success('Inscrição removida')
    }
  }

  // Funções dos modais de Inscrições a Compensar
  const openInscricaoCompensarModal = () => {
    setInscricaoCompensarForm({
      numeroInscricao: '',
      tipoInscricao: 'imobiliaria',
      debitos: [{ descricao: '', valor: '', dataVencimento: '' }]
    })
    setEditingInscricaoCompensar(null)

    // Limpar estilos de erro quando abrir o modal
    setTimeout(() => {
      const mainField = document.getElementById('modal-inscricao-numero')
      if (mainField) {
        mainField.style.borderColor = ''
        mainField.style.boxShadow = ''
        mainField.removeAttribute('data-error')
      }

      // Limpar campos de débitos (normalmente 1 no início)
      const fieldIds = [
        'modal-debito-descricao-0',
        'modal-debito-valor-0',
        'modal-debito-vencimento-0'
      ]
      fieldIds.forEach(id => {
        const element = document.getElementById(id)
        if (element) {
          element.style.borderColor = ''
          element.style.boxShadow = ''
          element.removeAttribute('data-error')
        }
      })
    }, 100)

    setShowInscricaoCompensarModal(true)
  }

  const openEditInscricaoCompensarModal = (index: number) => {
    const inscricao = watch(`inscricoesCompensar.${index}`)
    setEditingInscricaoCompensar({ index, inscricao })
    const formData = {
      numeroInscricao: inscricao.numeroInscricao,
      tipoInscricao: inscricao.tipoInscricao,
      debitos: (inscricao.debitos as DebitoFormData[])?.map((d: DebitoFormData) => ({
        descricao: d.descricao,
        valor: d.valor ? parseFloat(d.valor.toString()).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
        dataVencimento: d.dataVencimento || ''
      })) || [{ descricao: '', valor: '', dataVencimento: '' }]
    }
    setInscricaoCompensarForm(formData)

    // Limpar estilos de erro quando abrir o modal para edição
    setTimeout(() => {
      const mainField = document.getElementById('modal-inscricao-numero')
      if (mainField) {
        mainField.style.borderColor = ''
        mainField.style.boxShadow = ''
        mainField.removeAttribute('data-error')
      }

      // Limpar campos de débitos baseado no número de débitos existentes
      for (let i = 0; i < formData.debitos.length; i++) {
        const fieldIds = [
          `modal-debito-descricao-${i}`,
          `modal-debito-valor-${i}`,
          `modal-debito-vencimento-${i}`
        ]
        fieldIds.forEach(id => {
          const element = document.getElementById(id)
          if (element) {
            element.style.borderColor = ''
            element.style.boxShadow = ''
            element.removeAttribute('data-error')
          }
        })
      }
    }, 100)

    setShowInscricaoCompensarModal(true)
  }

  const updateDebito = (index: number, field: string, value: string) => {
    const updatedDebitos = [...inscricaoCompensarForm.debitos]
    updatedDebitos[index] = { ...updatedDebitos[index], [field]: value }
    setInscricaoCompensarForm({ ...inscricaoCompensarForm, debitos: updatedDebitos })
  }

  const addDebito = () => {
    setInscricaoCompensarForm({
      ...inscricaoCompensarForm,
      debitos: [...inscricaoCompensarForm.debitos, { descricao: '', valor: '', dataVencimento: '' }]
    })
  }

  const removeDebito = (index: number) => {
    if (inscricaoCompensarForm.debitos.length > 1) {
      const updatedDebitos = inscricaoCompensarForm.debitos.filter((_, i) => i !== index)
      setInscricaoCompensarForm({ ...inscricaoCompensarForm, debitos: updatedDebitos })
    }
  }

  const handleSaveInscricaoCompensar = () => {
    // Validar campos na ordem: numeroInscricao -> débitos
    const errors: string[] = []
    let firstErrorField: string | null = null

    // Validar número da inscrição
    if (!inscricaoCompensarForm.numeroInscricao.trim()) {
      errors.push('Número da inscrição é obrigatório')
      if (!firstErrorField) firstErrorField = 'modal-inscricao-numero'
    }

    // Validar débitos - pelo menos um débito completo
    let hasValidDebito = false

    for (let i = 0; i < inscricaoCompensarForm.debitos.length; i++) {
      const debito = inscricaoCompensarForm.debitos[i]

      // Verificar se o débito tem todos os campos preenchidos
      if (debito.descricao.trim() || debito.valor.trim() || debito.dataVencimento.trim()) {
        // Se começou a preencher, deve completar todos os campos
        if (!debito.descricao.trim()) {
          errors.push(`Descrição do débito ${i + 1} é obrigatória`)
          if (!firstErrorField) firstErrorField = `modal-debito-descricao-${i}`
        } else if (!debito.valor.trim() || parseCurrencyToNumber(debito.valor) <= 0) {
          errors.push(`Valor do débito ${i + 1} é obrigatório e deve ser maior que zero`)
          if (!firstErrorField) firstErrorField = `modal-debito-valor-${i}`
        } else if (!debito.dataVencimento.trim()) {
          errors.push(`Data de vencimento do débito ${i + 1} é obrigatória`)
          if (!firstErrorField) firstErrorField = `modal-debito-vencimento-${i}`
        } else {
          hasValidDebito = true
        }
      }
    }

    if (!hasValidDebito) {
      errors.push('Pelo menos um débito completo deve ser informado')
      if (!firstErrorField) firstErrorField = 'modal-debito-descricao-0'
    }

    // Se houver erros, mostrar toast e focar no primeiro campo com erro
    if (errors.length > 0) {
      toast.warning(errors[0]) // Mostrar apenas o primeiro erro

      if (firstErrorField) {
        setTimeout(() => {
          const element = document.getElementById(firstErrorField!)
          if (element) {
            element.focus()
            element.style.borderColor = '#ef4444'
            element.style.boxShadow = '0 0 0 1px #ef4444'
            element.setAttribute('data-error', 'true')
          }
        }, 100)
      }
      return
    }

    // Limpar estilos de erro de todos os campos
    const clearAllErrors = () => {
      // Limpar campo principal
      const mainField = document.getElementById('modal-inscricao-numero')
      if (mainField) {
        mainField.style.borderColor = ''
        mainField.style.boxShadow = ''
        mainField.removeAttribute('data-error')
      }

      // Limpar campos de débitos
      for (let i = 0; i < inscricaoCompensarForm.debitos.length; i++) {
        const fieldIds = [
          `modal-debito-descricao-${i}`,
          `modal-debito-valor-${i}`,
          `modal-debito-vencimento-${i}`
        ]
        fieldIds.forEach(id => {
          const element = document.getElementById(id)
          if (element) {
            element.style.borderColor = ''
            element.style.boxShadow = ''
            element.removeAttribute('data-error')
          }
        })
      }
    }
    clearAllErrors()

    // Validar débitos para salvar apenas os completos
    const debitosValidos = inscricaoCompensarForm.debitos.filter(d =>
      d.descricao.trim() && d.valor.trim() && d.dataVencimento.trim() && parseCurrencyToNumber(d.valor) > 0
    )

    const inscricaoData = {
      numeroInscricao: inscricaoCompensarForm.numeroInscricao,
      tipoInscricao: inscricaoCompensarForm.tipoInscricao,
      debitos: debitosValidos.map(d => ({
        descricao: d.descricao,
        valor: d.valor, // Manter formato de string pois o schema aceita both
        dataVencimento: d.dataVencimento
      }))
    }

    if (editingInscricaoCompensar) {
      setValue(`inscricoesCompensar.${editingInscricaoCompensar.index}`, inscricaoData)
    } else {
      appendInscricaoCompensar(inscricaoData)
    }

    setShowInscricaoCompensarModal(false)
    toast.success(editingInscricaoCompensar ? 'Inscrição atualizada' : 'Inscrição adicionada')
  }

  const handleRemoveInscricaoCompensar = (index: number) => {
    const inscricao = watch(`inscricoesCompensar.${index}`)
    if (confirm(`Tem certeza que deseja remover a inscrição "${inscricao.numeroInscricao}"?`)) {
      removeInscricaoCompensar(index)
      toast.success('Inscrição removida')
    }
  }

  const onSubmit = async (data: ValoresDacaoInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/processos/${processoId}/valores-dacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar valores de dação')
      }

      toast.success('Valores de dação salvos com sucesso!')
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro inesperado')
      toast.error('Erro ao salvar valores de dação')
    } finally {
      setIsLoading(false)
    }
  }

  const calcularTotalOferecidas = () => {
    const inscricoes = watch('inscricoesOferecidas') || []
    return inscricoes.reduce((total, inscricao) => {
      const valor = typeof inscricao.valor === 'string' ? parseCurrencyToNumber(inscricao.valor) : (inscricao.valor || 0)
      return total + valor
    }, 0)
  }

  const calcularTotalCompensar = () => {
    const inscricoes = watch('inscricoesCompensar') || []
    return inscricoes.reduce((total, inscricao) => {
      const debitosTotal = inscricao.debitos?.reduce((subtotal: number, debito: { valor: string | number, [key: string]: unknown }) => {
        const valor = typeof debito.valor === 'string' ? parseCurrencyToNumber(debito.valor) : (Number(debito.valor) || 0)
        return subtotal + valor
      }, 0) || 0
      return total + debitosTotal
    }, 0)
  }

  const totalOferecidas = calcularTotalOferecidas()
  const totalCompensar = calcularTotalCompensar()

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
                  <FileText className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Inscrições Oferecidas</span>
                </div>
                <p className="text-lg font-bold text-green-700">
                  R$ {totalOferecidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-green-600">
                  {inscricoesOferecidasFields.length} {inscricoesOferecidasFields.length === 1 ? 'inscrição' : 'inscrições'}
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">A Compensar</span>
                </div>
                <p className="text-lg font-bold text-blue-700">
                  R$ {totalCompensar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-blue-600">
                  {inscricoesCompensarFields.length} {inscricoesCompensarFields.length === 1 ? 'inscrição' : 'inscrições'}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-800">Saldo</span>
                </div>
                <p className={`text-lg font-bold ${totalOferecidas >= totalCompensar ? 'text-green-600' : 'text-red-600'}`}>
                  R$ {(totalOferecidas - totalCompensar).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-600">
                  {totalOferecidas >= totalCompensar ? 'Superávit' : 'Déficit'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inscrições Oferecidas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                Inscrições Oferecidas
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openInscricaoOferecidaModal}
                disabled={isLoading}
                className="cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Inscrição
              </Button>
            </div>
            <CardDescription>
              Inscrições que o contribuinte oferece para dação em pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inscricoesOferecidasFields.length === 0 ? (
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
                {inscricoesOferecidasFields.map((inscricaoField, inscricaoIndex) => {
                  const inscricao = watch(`inscricoesOferecidas.${inscricaoIndex}`)
                  return (
                    <div key={inscricaoField.id} className="p-4 border rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
                            <FileText className="h-4 w-4 text-green-700" />
                          </div>
                          <div>
                            <h5 className="font-medium text-green-800">{inscricao.tipoInscricao === 'imobiliaria' ? 'Imobiliária' : 'Econômica'}</h5>
                            <p className="text-xs text-green-600">{inscricao.numeroInscricao}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditInscricaoOferecidaModal(inscricaoIndex)}
                            className="h-6 w-6 p-0 text-green-700 hover:text-green-800 cursor-pointer"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveInscricaoOferecida(inscricaoIndex)}
                            disabled={isLoading}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-lg font-bold text-green-700">
                          R$ {(typeof inscricao.valor === 'string' ? parseCurrencyToNumber(inscricao.valor) : (inscricao.valor || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        {inscricao.dataVencimento && (
                          <p className="text-xs text-green-600">
                            Vence: {new Date(inscricao.dataVencimento).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                        {inscricao.descricao && (
                          <p className="text-xs text-green-600">
                            {inscricao.descricao}
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
                onClick={openInscricaoCompensarModal}
                disabled={isLoading}
                className="cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Inscrição
              </Button>
            </div>
            <CardDescription>
              Inscrições municipais que serão dadas em pagamento pelos créditos oferecidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inscricoesCompensarFields.length === 0 ? (
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
                {inscricoesCompensarFields.map((inscricaoField, inscricaoIndex) => {
                  const inscricao = watch(`inscricoesCompensar.${inscricaoIndex}`)
                  return (
                    <div key={inscricaoField.id} className="p-4 border rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
                            <FileText className="h-4 w-4 text-blue-700" />
                          </div>
                          <div>
                            <h5 className="font-medium text-blue-800">{inscricao.tipoInscricao === 'imobiliaria' ? 'Imobiliária' : 'Econômica'}</h5>
                            <p className="text-xs text-blue-600">{inscricao.numeroInscricao}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditInscricaoCompensarModal(inscricaoIndex)}
                            className="h-6 w-6 p-0 text-blue-700 hover:text-blue-800 cursor-pointer"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveInscricaoCompensar(inscricaoIndex)}
                            disabled={isLoading}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-lg font-bold text-blue-700">
                          R$ {(inscricao.debitos?.reduce((total: number, debito: { valor: string | number, [key: string]: unknown }) => {
                            const valor = typeof debito.valor === 'string' ? parseCurrencyToNumber(debito.valor) : (Number(debito.valor) || 0)
                            return total + valor
                          }, 0) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-blue-600">
                          {inscricao.debitos?.length || 0} {inscricao.debitos?.length === 1 ? 'débito' : 'débitos'}
                        </p>
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
      </form>

      {/* Modal de Inscrição Oferecida */}
      <Dialog open={showInscricaoOferecidaModal} onOpenChange={setShowInscricaoOferecidaModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              {editingInscricaoOferecida ? 'Editar Inscrição' : 'Adicionar Inscrição'}
            </DialogTitle>
            <DialogDescription>
              {editingInscricaoOferecida ? 'Edite as informações da inscrição' : 'Adicione as informações da inscrição'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-tipo-inscricao">Tipo de Inscrição <span className="text-red-500">*</span></Label>
              <select
                id="modal-tipo-inscricao"
                value={inscricaoOferecidaForm.tipoInscricao}
                onChange={(e) => setInscricaoOferecidaForm({ ...inscricaoOferecidaForm, tipoInscricao: e.target.value as 'imobiliaria' | 'economica' })}
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="imobiliaria">Imobiliária</option>
                <option value="economica">Econômica</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-numero-inscricao">Número da Inscrição <span className="text-red-500">*</span></Label>
              <Input
                id="modal-numero-inscricao"
                value={inscricaoOferecidaForm.numeroInscricao}
                onChange={(e) => {
                  setInscricaoOferecidaForm({ ...inscricaoOferecidaForm, numeroInscricao: e.target.value })
                  clearFieldError('modal-numero-inscricao')
                }}
                placeholder="Ex: IMOB-2024-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-valor-inscricao">Valor <span className="text-red-500">*</span></Label>
              <Input
                id="modal-valor-inscricao"
                type="text"
                value={inscricaoOferecidaForm.valor}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value)
                  setInscricaoOferecidaForm({ ...inscricaoOferecidaForm, valor: formatted })
                  clearFieldError('modal-valor-inscricao')
                }}
                placeholder="Ex: 25.000,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-vencimento-inscricao">Data de Vencimento</Label>
              <Input
                id="modal-vencimento-inscricao"
                type="date"
                value={inscricaoOferecidaForm.dataVencimento}
                onChange={(e) => setInscricaoOferecidaForm({ ...inscricaoOferecidaForm, dataVencimento: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-descricao-inscricao">Descrição</Label>
              <Textarea
                id="modal-descricao-inscricao"
                rows={2}
                value={inscricaoOferecidaForm.descricao}
                onChange={(e) => setInscricaoOferecidaForm({ ...inscricaoOferecidaForm, descricao: e.target.value })}
                placeholder="Informações adicionais sobre a inscrição..."
              />
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInscricaoOferecidaModal(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveInscricaoOferecida}
                className="cursor-pointer"
              >
                {editingInscricaoOferecida ? 'Salvar Alterações' : 'Adicionar Inscrição'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Inscrição a Compensar */}
      <Dialog open={showInscricaoCompensarModal} onOpenChange={setShowInscricaoCompensarModal}>
        <DialogContent className="w-[95vw] !max-w-[1200px] max-h-[90vh] overflow-hidden" style={{ width: '95vw', maxWidth: '1200px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              {editingInscricaoCompensar ? 'Editar Inscrição' : 'Adicionar Inscrição'}
            </DialogTitle>
            <DialogDescription>
              {editingInscricaoCompensar ? 'Edite as informações da inscrição e seus débitos' : 'Adicione uma nova inscrição com múltiplos débitos'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modal-inscricao-numero">Número da Inscrição <span className="text-red-500">*</span></Label>
                <Input
                  id="modal-inscricao-numero"
                  value={inscricaoCompensarForm.numeroInscricao}
                  onChange={(e) => {
                    setInscricaoCompensarForm({ ...inscricaoCompensarForm, numeroInscricao: e.target.value })
                    clearFieldError('modal-inscricao-numero')
                  }}
                  placeholder="Ex: 123.456.789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-inscricao-tipo">Tipo de Inscrição <span className="text-red-500">*</span></Label>
                <select
                  id="modal-inscricao-tipo"
                  value={inscricaoCompensarForm.tipoInscricao}
                  onChange={(e) => setInscricaoCompensarForm({ ...inscricaoCompensarForm, tipoInscricao: e.target.value as 'imobiliaria' | 'economica' })}
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
                {inscricaoCompensarForm.debitos.map((debito, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <h6 className="text-sm font-medium">Débito {index + 1}</h6>
                      {inscricaoCompensarForm.debitos.length > 1 && (
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
                        <Label htmlFor={`modal-debito-descricao-${index}`}>Descrição <span className="text-red-500">*</span></Label>
                        <Input
                          id={`modal-debito-descricao-${index}`}
                          value={debito.descricao}
                          onChange={(e) => {
                            updateDebito(index, 'descricao', e.target.value)
                            clearFieldError(`modal-debito-descricao-${index}`)
                          }}
                          placeholder="Ex: IPTU 2024"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`modal-debito-valor-${index}`}>Valor Lançado <span className="text-red-500">*</span></Label>
                        <Input
                          id={`modal-debito-valor-${index}`}
                          type="text"
                          value={debito.valor}
                          onChange={(e) => {
                            const formatted = formatCurrency(e.target.value)
                            updateDebito(index, 'valor', formatted)
                            clearFieldError(`modal-debito-valor-${index}`)
                          }}
                          placeholder="Ex: 1.500,00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`modal-debito-vencimento-${index}`}>Data de Vencimento <span className="text-red-500">*</span></Label>
                        <Input
                          id={`modal-debito-vencimento-${index}`}
                          type="date"
                          value={debito.dataVencimento}
                          onChange={(e) => {
                            updateDebito(index, 'dataVencimento', e.target.value)
                            clearFieldError(`modal-debito-vencimento-${index}`)
                          }}
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
                    R$ {inscricaoCompensarForm.debitos.reduce((total, d) => total + parseCurrencyToNumber(d.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInscricaoCompensarModal(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveInscricaoCompensar}
                className="cursor-pointer"
              >
                {editingInscricaoCompensar ? 'Atualizar' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  HandCoins,
  DollarSign,
  FileText,
  ArrowLeft,
  AlertTriangle,
  Calculator,
  CreditCard,
  Check,
  X,
  Edit,
  Receipt
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { SessionUser } from '@/types'
import AcordoActions from '@/components/acordo/acordo-actions'
import CumprimentoWrapper from '@/components/acordo/cumprimento-wrapper'

import { toast } from 'sonner'

interface AcordoPageProps {
  params: Promise<{ id: string }>
}

interface Pagamento {
  id: string
  valorPago: number
  dataPagamento: string
  formaPagamento: string
  numeroComprovante?: string
}

interface Parcela {
  id: string
  numero: number
  valor: number
  dataVencimento: string
  dataPagamento?: string
  status: 'PENDENTE' | 'PAGO' | 'ATRASADO' | 'CANCELADO'
  tipoParcela: 'ENTRADA' | 'PARCELA_ACORDO' | 'PARCELA_HONORARIOS'
  pagamentos: Pagamento[]
}

interface TransacaoDetails {
  custasAdvocaticias: number
  custasDataVencimento?: string
  custasDataPagamento?: string
  honorariosValor: number
  honorariosMetodoPagamento: string
  honorariosParcelas: number
}

interface CompensacaoDetails {
  valorTotalCreditos: number
  valorTotalDebitos: number
  valorLiquido: number
  custasAdvocaticias: number
  custasDataVencimento?: string
  custasDataPagamento?: string
  honorariosValor: number
  honorariosMetodoPagamento: string
  honorariosParcelas: number
  honorariosDataVencimento?: string
  honorariosDataPagamento?: string
}

interface DacaoDetails {
  valorTotalOferecido: number
  valorTotalCompensar: number
  valorLiquido: number
  custasAdvocaticias: number
  custasDataVencimento?: string
  custasDataPagamento?: string
  honorariosValor: number
  honorariosMetodoPagamento: string
  honorariosParcelas: number
  honorariosDataVencimento?: string
  honorariosDataPagamento?: string
}

interface Contribuinte {
  nome: string
}

interface Processo {
  id: string
  numero: string
  tipo: string
  contribuinte: Contribuinte
}

interface DetalhesAcordo {
  detalhes: DetalheAcordo[]
  creditos?: Credito[]
  inscricoes?: InscricaoDetalhe[]
}

interface DetalheAcordo {
  id: string
  tipo: string
  descricao: string
  valorOriginal: number
  valorFinal?: number
  observacoes?: string
  inscricoes?: InscricaoDetalhe[]
  imovel?: Imovel
  credito?: Credito
}

interface InscricaoDetalhe {
  id: string
  numeroInscricao: string
  tipoInscricao: string
  valorDebito?: number
  valorTotal: number
  descricaoDebitos?: DebitoDetalhe[]
  debitos: DebitoDetalhe[]
}

interface DebitoDetalhe {
  id: string
  descricao: string
  valorLancado: number
  dataVencimento?: string
}

interface Imovel {
  matricula: string
  endereco: string
  valorAvaliado: number
}

interface Credito {
  id: string
  numero: string
  numeroCredito?: string
  tipo: string
  tipoCredito?: string
  valor: number
  dataVencimento?: string
  descricao?: string
}



interface AcordoData {
  id: string
  status: string
  valorTotal: number
  valorFinal: number
  valorDesconto: number
  valorEntrada: number
  numeroParcelas: number
  modalidadePagamento: string
  dataAssinatura: string
  dataVencimento: string
  observacoes?: string
  clausulasEspeciais?: string
  parcelas: Parcela[]
  transacaoDetails?: TransacaoDetails
  compensacaoDetails?: CompensacaoDetails
  dacaoDetails?: DacaoDetails
  processo: Processo
}

export default function AcordoPage({ params }: AcordoPageProps) {
  const { data: session } = useSession()
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const [acordo, setAcordo] = useState<AcordoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [modoRegistrarPagamento, setModoRegistrarPagamento] = useState(false)
  const [parcelasSelecionadas, setParcelasSelecionadas] = useState<Set<string>>(new Set())
  const [custasSeelcionada, setCustasSeelcionada] = useState(false)
  const [honorariosSelecionados, setHonorariosSelecionados] = useState<Set<string>>(new Set())
  const [processandoPagamento, setProcessandoPagamento] = useState(false)
  const [parcelaEditando, setParcelaEditando] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [formEdicaoParcela, setFormEdicaoParcela] = useState({
    dataVencimento: '',
    dataPagamento: ''
  })
  const [detalhesAcordo, setDetalhesAcordo] = useState<DetalhesAcordo | null>(null)
  const [showEditCustasModal, setShowEditCustasModal] = useState(false)
  const [formEdicaoCustas, setFormEdicaoCustas] = useState({
    dataVencimento: '',
    dataPagamento: ''
  })
  const [processandoConclusao, setProcessandoConclusao] = useState(false)

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params
      setResolvedParams(resolved)
    }
    resolveParams()
  }, [params])

  const loadAcordo = useCallback(async () => {
    if (!resolvedParams) return

    try {
      setLoading(true)
      const [acordoResponse, detalhesResponse] = await Promise.all([
        fetch(`/api/acordos/${resolvedParams.id}`),
        fetch(`/api/acordos/${resolvedParams.id}/detalhes`)
      ])

      if (acordoResponse.ok) {
        const acordoData = await acordoResponse.json()
        setAcordo(acordoData)
      } else if (acordoResponse.status === 404) {
        notFound()
      }

      if (detalhesResponse.ok) {
        const detalhesData = await detalhesResponse.json()
        setDetalhesAcordo(detalhesData)
      }
    } catch (error) {
      console.error('Erro ao carregar acordo:', error)
    } finally {
      setLoading(false)
    }
  }, [resolvedParams])

  useEffect(() => {
    if (!session) {
      return
    }

    if (resolvedParams) {
      loadAcordo()
    }
  }, [session, resolvedParams, loadAcordo])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        <span className="ml-2">Carregando acordo...</span>
      </div>
    )
  }

  if (!acordo || !session) {
    return null
  }

  const user = session.user as SessionUser

  // Funções para gerenciar modo de pagamento
  const handleIniciarRegistroPagamento = () => {
    setModoRegistrarPagamento(true)
    setParcelasSelecionadas(new Set())
  }

  const handleCancelarRegistroPagamento = () => {
    setModoRegistrarPagamento(false)
    setParcelasSelecionadas(new Set())
    setCustasSeelcionada(false)
    setHonorariosSelecionados(new Set())
  }

  const handleToggleParcela = (parcelaId: string) => {
    const novaSelecao = new Set(parcelasSelecionadas)
    if (novaSelecao.has(parcelaId)) {
      novaSelecao.delete(parcelaId)
    } else {
      novaSelecao.add(parcelaId)
    }
    setParcelasSelecionadas(novaSelecao)
  }

  const handleToggleCustas = () => {
    setCustasSeelcionada(prev => !prev)
  }

  const handleToggleHonorarios = (parcelaId: string) => {
    setHonorariosSelecionados(prev => {
      const newSet = new Set(prev)
      if (newSet.has(parcelaId)) {
        newSet.delete(parcelaId)
      } else {
        newSet.add(parcelaId)
      }
      return newSet
    })
  }

  const handleConfirmarPagamento = async () => {
    if (parcelasSelecionadas.size === 0 && !custasSeelcionada && honorariosSelecionados.size === 0) {
      toast.error('Selecione pelo menos uma parcela, custas ou honorários para registrar o pagamento')
      return
    }

    setProcessandoPagamento(true)
    try {
      let totalRegistros = 0

      // Processar parcelas selecionadas
      const parcelasParaPagar = Array.from(parcelasSelecionadas)
      for (const parcelaId of parcelasParaPagar) {
        const parcela = acordo.parcelas?.find((p: Parcela) => p.id === parcelaId)
        if (!parcela) continue

        const valorPago = parcela.pagamentos?.reduce((total: number, p: Pagamento) => total + Number(p.valorPago || 0), 0) || 0
        const valorRestante = Number(parcela.valor) - valorPago

        if (valorRestante <= 0) continue

        const response = await fetch(`/api/pagamentos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            parcelaId: parcela.id,
            dataPagamento: new Date(),
            valorPago: valorRestante,
            formaPagamento: 'dinheiro'
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erro ao registrar pagamento da parcela')
        }
        totalRegistros++
      }

      // Processar custas se selecionadas
      if (custasSeelcionada) {
        const detalhes = getCurrentDetails()
        if (detalhes && detalhes.custasAdvocaticias > 0) {
          const response = await fetch(`/api/acordos/${acordo.id}/custas`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              tipoProcesso: tipoProcesso, // Adicionar tipo para a API identificar qual tabela atualizar
              custasDataVencimento: detalhes.custasDataVencimento || acordo.dataVencimento,
              custasDataPagamento: new Date(),
              status: 'PAGO'
            })
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Erro ao registrar pagamento das custas')
          }
          totalRegistros++
        }
      }

      // Processar parcelas de honorários selecionadas (agora são parcelas reais)
      if (honorariosSelecionados.size > 0) {
        const parcelasHonorariosParaPagar = Array.from(honorariosSelecionados)
        for (const parcelaId of parcelasHonorariosParaPagar) {
          const response = await fetch(`/api/parcelas/${parcelaId}/pagamento`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              valorPago: acordo.parcelas.find(p => p.id === parcelaId)?.valor || 0,
              formaPagamento: 'dinheiro',
              observacoes: `Pagamento de honorários registrado em ${new Date().toLocaleDateString('pt-BR')}`
            })
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || `Erro ao registrar pagamento da parcela de honorários`)
          }
          totalRegistros++
        }
      }

      if (totalRegistros > 0) {
        toast.success(`Pagamento${totalRegistros > 1 ? 's' : ''} registrado${totalRegistros > 1 ? 's' : ''} com sucesso!`)
      }

      // Recarregar dados e sair do modo de pagamento
      await loadAcordo()
      handleCancelarRegistroPagamento()
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar pagamento')
    } finally {
      setProcessandoPagamento(false)
    }
  }

  // Funções para edição de parcelas
  const handleEditarParcela = (parcela: Parcela) => {
    setParcelaEditando(parcela.id)
    setFormEdicaoParcela({
      dataVencimento: new Date(parcela.dataVencimento).toISOString().split('T')[0],
      dataPagamento: parcela.dataPagamento ? new Date(parcela.dataPagamento).toISOString().split('T')[0] : ''
    })
    setShowEditModal(true)
  }

  const handleCancelarEdicao = () => {
    setParcelaEditando(null)
    setShowEditModal(false)
    setFormEdicaoParcela({
      dataVencimento: '',
      dataPagamento: ''
    })
    // Limpar bordas vermelhas dos campos
    clearFieldErrorEdit('dataVencimento-edit')
    clearFieldErrorEdit('dataPagamento-edit')
  }

  const calcularStatusAutomatico = (dataVencimento: string, dataPagamento: string) => {
    if (dataPagamento) {
      return 'PAGO'
    }

    const hoje = new Date()
    const vencimento = new Date(dataVencimento)

    if (vencimento < hoje) {
      return 'ATRASADO'
    }

    return 'PENDENTE'
  }

  // Função para calcular status de parcela dinamicamente
  const calcularStatusParcela = (parcela: Parcela) => {
    return calcularStatusAutomatico(parcela.dataVencimento, parcela.dataPagamento || '')
  }

  const clearFieldErrorEdit = (fieldId: string) => {
    const element = document.getElementById(fieldId)
    if (element) {
      element.style.borderColor = ''
      element.style.boxShadow = ''
    }
  }

  const clearFormErrors = () => {
  }

  const showFieldError = (fieldId: string, errorMessage: string) => {
    toast.error(errorMessage)

    setTimeout(() => {
      const element = document.getElementById(fieldId)
      if (element) {
        element.focus()
        element.style.borderColor = '#ef4444'
        element.style.boxShadow = '0 0 0 1px #ef4444'
      }
    }, 100)
  }

  const validateRequiredFields = (fields: { id: string; value: string; label: string }[]): string | null => {
    for (const field of fields) {
      if (!field.value.trim()) {
        showFieldError(field.id, `${field.label} é obrigatório`)
        return field.label
      }
    }
    return null
  }

  const handleSalvarEdicaoParcela = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!parcelaEditando) return

    // Validar campos obrigatórios na ordem de visualização
    const requiredFields = [
      { id: 'dataVencimento-edit', value: formEdicaoParcela.dataVencimento, label: 'Data de vencimento' }
    ]

    const invalidField = validateRequiredFields(requiredFields)
    if (invalidField) {
      return
    }

    try {
      setProcessandoPagamento(true)
  
      // Agora todas as parcelas (incluindo honorários) usam a API de parcelas
      const status = calcularStatusAutomatico(formEdicaoParcela.dataVencimento, formEdicaoParcela.dataPagamento)

      const response = await fetch(`/api/parcelas/${parcelaEditando}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataVencimento: new Date(formEdicaoParcela.dataVencimento + 'T12:00:00'),
          dataPagamento: formEdicaoParcela.dataPagamento ? new Date(formEdicaoParcela.dataPagamento + 'T12:00:00') : null,
          status: status
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Erro ao atualizar parcela'
        toast.error(errorMessage)
        return
      }

      toast.success('Parcela atualizada com sucesso!')

      // Recarregar dados
      await loadAcordo()

      handleCancelarEdicao()
    } catch (error) {
      console.error('Erro ao atualizar parcela:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar parcela'
      toast.error(errorMessage)
    } finally {
      setProcessandoPagamento(false)
    }
  }

  // Funções para edição de custas
  const handleEditarCustas = () => {
    const detalhes = getCurrentDetails()
    setFormEdicaoCustas({
      dataVencimento: detalhes?.custasDataVencimento
        ? new Date(detalhes.custasDataVencimento).toISOString().split('T')[0]
        : acordo?.dataVencimento
          ? new Date(acordo.dataVencimento).toISOString().split('T')[0]
          : '',
      dataPagamento: detalhes?.custasDataPagamento
        ? new Date(detalhes.custasDataPagamento).toISOString().split('T')[0]
        : ''
    })
    setShowEditCustasModal(true)
  }

  const handleCancelarEdicaoCustas = () => {
    setShowEditCustasModal(false)
    setFormEdicaoCustas({ dataVencimento: '', dataPagamento: '' })
    // Limpar bordas vermelhas dos campos
    clearFieldErrorEdit('custasDataVencimento-edit')
    clearFieldErrorEdit('custasDataPagamento-edit')
  }

  const handleSalvarEdicaoCustas = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!acordo?.id) return

    // Validar campos obrigatórios na ordem de visualização
    const requiredFields = [
      { id: 'custasDataVencimento-edit', value: formEdicaoCustas.dataVencimento, label: 'Data de vencimento' }
    ]

    const invalidField = validateRequiredFields(requiredFields)
    if (invalidField) {
      return
    }

    try {
      setProcessandoPagamento(true)
  
      const status = calcularStatusAutomatico(formEdicaoCustas.dataVencimento, formEdicaoCustas.dataPagamento)

      const response = await fetch(`/api/acordos/${acordo.id}/custas`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          custasDataVencimento: new Date(formEdicaoCustas.dataVencimento + 'T12:00:00'),
          custasDataPagamento: formEdicaoCustas.dataPagamento ? new Date(formEdicaoCustas.dataPagamento + 'T12:00:00') : null,
          status: status
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Erro ao atualizar custas'
        toast.error(errorMessage)
        return
      }

      const acordoAtualizado = await response.json()
      setAcordo(acordoAtualizado)
      setShowEditCustasModal(false)
      toast.success('Custas atualizadas com sucesso!')

    } catch (error) {
      console.error('Erro ao atualizar custas:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar custas'
      toast.error(errorMessage)
    } finally {
      setProcessandoPagamento(false)
    }
  }

  // Função para concluir acordo (dação e compensação)
  const handleConcluirAcordo = async () => {
    if (!window.confirm('Tem certeza que deseja concluir este acordo? Esta ação não pode ser desfeita. O acordo e o processo serão marcados como concluídos.')) {
      return
    }

    setProcessandoConclusao(true)
    try {
      const response = await fetch(`/api/acordos/${resolvedParams?.id}/concluir`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          atualizarProcesso: true
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao concluir acordo')
      }

      toast.success('Acordo e processo concluídos com sucesso!')

      // Recarregar dados
      await loadAcordo()
    } catch (error) {
      console.error('Erro ao concluir acordo:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao concluir acordo')
    } finally {
      setProcessandoConclusao(false)
    }
  }

  const canEdit = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'
  const canRegisterPayment = canEdit && acordo?.status === 'ativo'

  // Verificar se é um tipo de processo que tem parcelas/pagamentos
  const tipoProcesso = acordo?.processo?.tipo
  const temParcelas = tipoProcesso === 'TRANSACAO_EXCEPCIONAL'

  // Função para verificar se há custas ou honorários em aberto (para compensação e dação)
  const hasCustasOrHonorariosEmAberto = () => {
    if (tipoProcesso === 'TRANSACAO_EXCEPCIONAL') return false // Para transação, usar lógica existente

    const detalhes = getCurrentDetails()
    if (!detalhes) return false

    // Verificar custas em aberto
    const custasEmAberto = detalhes.custasAdvocaticias > 0 && !detalhes.custasDataPagamento

    // Verificar parcelas de honorários em aberto (agora são parcelas reais)
    const parcelasHonorariosEmAberto = acordo.parcelas
      .filter(parcela => parcela.tipoParcela === 'PARCELA_HONORARIOS')
      .some(parcela => parcela.status !== 'PAGO')

    return custasEmAberto || parcelasHonorariosEmAberto
  }

  if (!acordo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        <span className="ml-2">Carregando acordo...</span>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-green-100 text-green-800'
      case 'cumprido': return 'bg-blue-100 text-blue-800'
      case 'vencido': return 'bg-red-100 text-red-800'
      case 'cancelado': return 'bg-orange-100 text-orange-800'
      case 'renegociado': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }


  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ativo': return 'Ativo'
      case 'cumprido': return 'Cumprido'
      case 'vencido': return 'Vencido'
      case 'cancelado': return 'Cancelado'
      case 'renegociado': return 'Renegociado'
      default: return status
    }
  }

  const getParcelaStatusColor = (status: string) => {
    switch (status) {
      case 'PENDENTE': return 'bg-yellow-100 text-yellow-800'
      case 'PAGO': return 'bg-green-100 text-green-800'
      case 'ATRASADO': return 'bg-red-100 text-red-800'
      case 'CANCELADO': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getParcelaStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDENTE': return 'Pendente'
      case 'PAGO': return 'Pago'
      case 'ATRASADO': return 'Atrasado'
      case 'CANCELADO': return 'Cancelado'
      default: return status
    }
  }

  const getProgressoPagamento = () => {
    // Para transação excepcional, usar a lógica original
    if (tipoProcesso === 'TRANSACAO_EXCEPCIONAL') {
      const parcelas = acordo.parcelas || []

      // Calcular valor total das parcelas (acordo + honorários)
      const valorTotalParcelas = parcelas.reduce((total: number, parcela: Parcela) => {
        return total + Number(parcela.valor || 0)
      }, 0)

      // Adicionar custas (se existir)
      const custasAdvocaticias = acordo.transacaoDetails?.custasAdvocaticias || 0
      const valorTotalGeral = valorTotalParcelas + custasAdvocaticias

      // Calcular valor pago de todas as parcelas (acordo + honorários)
      let valorPago = parcelas.reduce((total: number, parcela: Parcela) => {
        const pagamentos = parcela.pagamentos || []
        return total + pagamentos.reduce((subtotal: number, pagamento: Pagamento) => {
          return subtotal + Number(pagamento.valorPago || 0)
        }, 0)
      }, 0)

      // Adicionar custas se foram pagas
      if (acordo.transacaoDetails?.custasDataPagamento && custasAdvocaticias > 0) {
        valorPago += custasAdvocaticias
      }

      const percentual = valorTotalGeral > 0 ? Math.round((valorPago / valorTotalGeral) * 100) : 0

      return {
        valorTotal: valorTotalGeral,
        valorPago,
        valorPendente: valorTotalGeral - valorPago,
        percentual
      }
    }

    // Para compensação e dação, calcular como na página de listagem
    let valorOfertado = 0
    let valorCompensado = 0
    let valorCustasHonorarios = 0
    let valorTotal = 0

    if (tipoProcesso === 'COMPENSACAO' && acordo.compensacaoDetails) {
      valorOfertado = Number(acordo.compensacaoDetails.valorTotalCreditos || 0)
      valorCompensado = Number(acordo.compensacaoDetails.valorTotalDebitos || 0)
      valorCustasHonorarios = Number(acordo.compensacaoDetails.custasAdvocaticias || 0) + Number(acordo.compensacaoDetails.honorariosValor || 0)
      valorTotal = valorCompensado + valorCustasHonorarios
    } else if (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacaoDetails) {
      valorOfertado = Number(acordo.dacaoDetails.valorTotalOferecido || 0)
      valorCompensado = Number(acordo.dacaoDetails.valorTotalCompensar || 0)
      valorCustasHonorarios = Number(acordo.dacaoDetails.custasAdvocaticias || 0) + Number(acordo.dacaoDetails.honorariosValor || 0)
      valorTotal = valorOfertado + valorCustasHonorarios
    } else {
      // Fallback para casos sem detalhes
      valorTotal = getValorAcordo()
    }

    // Calcular valores pagos baseado em custas, parcelas de honorários e status
    let valorPago = 0

    if (acordo.status === 'cumprido') {
      valorPago = valorTotal
    } else {
      // Verificar se custas foram pagas
      const details = tipoProcesso === 'COMPENSACAO' ? acordo.compensacaoDetails : acordo.dacaoDetails
      if (details?.custasDataPagamento && details.custasAdvocaticias > 0) {
        valorPago += Number(details.custasAdvocaticias)
      }

      // Verificar parcelas de honorários pagas
      const parcelasHonorarios = acordo.parcelas?.filter(p => p.tipoParcela === 'PARCELA_HONORARIOS') || []
      parcelasHonorarios.forEach(parcela => {
        if (parcela.status === 'PAGO') {
          valorPago += Number(parcela.valor)
        } else {
          // Somar pagamentos parciais
          const pagamentos = parcela.pagamentos || []
          valorPago += pagamentos.reduce((total: number, pagamento: Pagamento) => {
            return total + Number(pagamento.valorPago || 0)
          }, 0)
        }
      })
    }

    const percentual = valorTotal > 0 ? Math.round((valorPago / valorTotal) * 100) : 0

    return {
      valorOfertado,
      valorCompensado,
      valorCustasHonorarios,
      valorTotal,
      valorPago,
      valorPendente: valorTotal - valorPago,
      percentual
    }
  }

  // Função helper para formatar datas corretamente (evitando problema de timezone)
  const formatarData = (data: string | Date) => {
    const date = new Date(data)
    // Para datas que vêm do backend (ISO string), usar apenas a parte da data
    if (typeof data === 'string' && data.includes('T')) {
      const [datePart] = data.split('T')
      const [year, month, day] = datePart.split('-').map(Number)
      return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
    }
    return date.toLocaleDateString('pt-BR')
  }

  // Função helper para obter os detalhes corretos baseado no tipo de processo
  const getCurrentDetails = (): TransacaoDetails | CompensacaoDetails | DacaoDetails | undefined => {
    if (tipoProcesso === 'TRANSACAO_EXCEPCIONAL' && acordo.transacaoDetails) {
      return acordo.transacaoDetails
    }
    if (tipoProcesso === 'COMPENSACAO' && acordo.compensacaoDetails) {
      return acordo.compensacaoDetails
    }
    if (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacaoDetails) {
      return acordo.dacaoDetails
    }
    return undefined
  }

  const isVencido = () => {
    if (acordo.status !== 'ativo') return false

    // Verificar se há parcelas vencidas (ATRASADO)
    const temParcelaVencida = acordo.parcelas?.some((parcela: Parcela) => calcularStatusParcela(parcela) === 'ATRASADO')

    // Verificar se há custas vencidas (custas com data de vencimento passada e sem data de pagamento)
    let temCustasVencida = false
    const detalhes = getCurrentDetails()
    if (detalhes?.custasAdvocaticias && detalhes.custasAdvocaticias > 0) {
      const custasDataVencimento = detalhes.custasDataVencimento || acordo?.dataVencimento
      const custasDataPagamento = detalhes.custasDataPagamento

      if (custasDataVencimento && !custasDataPagamento) {
        temCustasVencida = new Date(custasDataVencimento) < new Date()
      }
    }

    return temParcelaVencida || temCustasVencida
  }

  // Função para calcular o valor do acordo baseado no tipo (compensação/dação)
  const getValorAcordo = () => {
    if (temParcelas) {
      // Para transação excepcional, usar valorFinal padrão
      return Number(acordo.valorFinal || 0)
    }

    // Para compensação e dação, usar valorTotal que representa o valor original/base
    if (tipoProcesso === 'COMPENSACAO' || tipoProcesso === 'DACAO_PAGAMENTO') {
      // Primeiro tentar o valorTotal que foi corrigido no backend para representar o valor correto
      if (acordo.valorTotal) {
        return Number(acordo.valorTotal)
      }

    }

    // Fallback para detalhes do acordo
    if (!detalhesAcordo) {
      return Number(acordo.valorFinal || 0)
    }

    const detalhes = detalhesAcordo.detalhes
    if (!detalhes || !Array.isArray(detalhes) || detalhes.length === 0) {
      return Number(acordo.valorFinal || 0)
    }

    let valorTotal = 0

    detalhes.forEach((detalhe: DetalheAcordo) => {
      if (detalhe.tipo === 'compensacao') {
        // Para compensação: usar valorOriginal do detalhe
        valorTotal += Number(detalhe.valorOriginal || 0)
      } else if (detalhe.tipo === 'dacao') {
        // Para dação: usar valorOriginal do detalhe (que representa valor oferecido)
        valorTotal += Number(detalhe.valorOriginal || 0)
      }
    })

    return valorTotal > 0 ? valorTotal : Number(acordo.valorFinal || 0)
  }

  const progresso = acordo ? getProgressoPagamento() : null
  const vencido = acordo ? isVencido() : false

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/acordos">
          <Button variant="outline" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Acordo de Pagamento</h1>
            <Badge className={getStatusColor(acordo.status)}>
              {getStatusLabel(acordo.status)}
            </Badge>
            {vencido && (
              <Badge className="bg-red-100 text-red-800">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Vencido
              </Badge>
            )}
          </div>
          <p className="text-gray-600">
            Processo: {acordo.processo?.numero} - {acordo.processo?.contribuinte?.nome}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Botão Registrar Pagamento - para transação com parcelas pendentes OU para compensação/dação com custas/honorários em aberto */}
          {((temParcelas && canRegisterPayment && (progresso?.valorPendente || 0) > 0) ||
            (!temParcelas && canRegisterPayment && hasCustasOrHonorariosEmAberto())) &&
            !modoRegistrarPagamento && (
              <Button onClick={handleIniciarRegistroPagamento} className="cursor-pointer">
                <DollarSign className="mr-2 h-4 w-4" />
                Registrar Pagamento
              </Button>
            )}

          {/* Botão Concluir Acordo - para compensação/dação SEM custas/honorários em aberto */}
          {!temParcelas && canEdit && acordo?.status === 'ativo' && !hasCustasOrHonorariosEmAberto() && (
            <Button
              onClick={handleConcluirAcordo}
              disabled={processandoConclusao}
              className="bg-green-600 hover:bg-green-700 cursor-pointer"
            >
              {processandoConclusao ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Processando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Concluir Acordo
                </>
              )}
            </Button>
          )}
          {modoRegistrarPagamento && (
            <>
              <Button
                onClick={handleConfirmarPagamento}
                disabled={(parcelasSelecionadas.size === 0 && !custasSeelcionada && honorariosSelecionados.size === 0) || processandoPagamento}
                className="bg-green-600 hover:bg-green-700 cursor-pointer"
              >
                {processandoPagamento ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirmar Pagamento ({parcelasSelecionadas.size + (custasSeelcionada ? 1 : 0) + honorariosSelecionados.size})
                  </>
                )}
              </Button>
              <Button
                onClick={handleCancelarRegistroPagamento}
                variant="outline"
                disabled={processandoPagamento}
                className="cursor-pointer"
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </>
          )}
          {canEdit && !(
            !temParcelas &&
            acordo.status === 'cumprido' &&
            (tipoProcesso === 'COMPENSACAO' || tipoProcesso === 'DACAO_PAGAMENTO')
          ) && (
              <AcordoActions
                acordo={acordo as { id: string; status: string; parcelas: { id: string; pagamentos: { id: string; valorPago: number; }[]; }[]; valorFinal: number; }}
                userRole={user.role}
              />
            )}
        </div>
      </div>

      {/* Informações do Acordo */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5" />
              Informações do Acordo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Data de Assinatura:</span>
                <p className="font-medium">{formatarData(acordo.dataAssinatura)}</p>
              </div>
              <div>
                <span className="text-gray-600">Data de Vencimento:</span>
                <p className="font-medium">{formatarData(acordo.dataVencimento)}</p>
              </div>
              {/* Mostrar modalidade apenas para transação excepcional */}
              {temParcelas && (
                <div>
                  <span className="text-gray-600">Modalidade:</span>
                  <p className="font-medium">
                    {acordo.modalidadePagamento === 'avista' ? 'À Vista' : `Parcelamento (${acordo.numeroParcelas || 1}x)`}
                  </p>
                </div>
              )}
              <div>
                <span className="text-gray-600">Status:</span>
                <p className="font-medium">{getStatusLabel(acordo.status as string)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Informações do Processo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Número do Processo:</span>
                <Link
                  href={`/processos/${acordo.processo.id}`}
                  className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors block"
                >
                  {acordo.processo.numero}
                </Link>
              </div>
              <div>
                <span className="text-gray-600">Contribuinte:</span>
                <p className="font-medium">{acordo.processo.contribuinte.nome}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Tipo de Processo:</span>
                <p className="font-medium">
                  {acordo.processo.tipo === 'TRANSACAO_EXCEPCIONAL' ? 'Transação Excepcional' :
                    acordo.processo.tipo === 'COMPENSACAO' ? 'Compensação' :
                      acordo.processo.tipo === 'DACAO_PAGAMENTO' ? 'Dação em Pagamento' :
                        acordo.processo.tipo}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Valores e Progresso */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Valores e Progresso
          </CardTitle>
          <CardDescription>
            {temParcelas
              ? 'Acompanhamento dos valores e pagamentos do acordo'
              : tipoProcesso === 'COMPENSACAO'
                ? 'Detalhes da compensação entre créditos e débitos'
                : 'Detalhes da dação em pagamento'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Mostrar detalhamento apenas para transação excepcional */}
            {temParcelas && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                {/* Valores Principais */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-blue-600">Valor Original:</span>
                    <p className="font-medium text-blue-700">
                      R$ {Number(acordo.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">Valor Proposto:</span>
                    <p className="font-medium text-blue-700">
                      R$ {Number(acordo.valorFinal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">Desconto:</span>
                    <p className="font-medium text-blue-700">
                      R$ {Math.max(0, Number(acordo.valorDesconto || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">Valor de Entrada:</span>
                    <p className="font-medium text-blue-700">
                      R$ {Number(acordo.valorEntrada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Parcelas do Acordo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-blue-600">
                      {acordo.modalidadePagamento === 'avista' ? 'Valor Total:' : 'Valor das Parcelas:'}
                    </span>
                    <p className="font-medium text-blue-700">
                      {acordo.modalidadePagamento === 'avista'
                        ? `R$ ${Number(acordo.valorFinal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : (acordo.numeroParcelas as number) > 0
                          ? `${acordo.numeroParcelas as number}x de R$ ${((Number(acordo.valorFinal) - Number(acordo.valorEntrada || 0)) / (acordo.numeroParcelas as number)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `R$ ${Number(acordo.valorFinal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      }
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">Total do Acordo:</span>
                    <p className="font-bold text-blue-700">
                      R$ {Number(acordo.valorFinal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Custas e Honorários (só aparece se tiver valores) */}
                {acordo.transacaoDetails && (acordo.transacaoDetails.custasAdvocaticias > 0 || acordo.transacaoDetails.honorariosValor > 0) && (
                  <>
                    <div className="border-t border-blue-200 pt-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        {acordo.transacaoDetails.custasAdvocaticias > 0 && (
                          <div>
                            <span className="text-amber-600">Custas:</span>
                            <p className="font-medium text-amber-700">
                              R$ {acordo.transacaoDetails.custasAdvocaticias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        )}
                        {acordo.transacaoDetails.honorariosValor > 0 && (
                          <div>
                            <span className="text-amber-600">Honorários:</span>
                            <p className="font-medium text-amber-700">
                              {acordo.transacaoDetails.honorariosMetodoPagamento === 'parcelado' && acordo.transacaoDetails.honorariosParcelas > 1
                                ? `${acordo.transacaoDetails.honorariosParcelas}x de R$ ${(acordo.transacaoDetails.honorariosValor / acordo.transacaoDetails.honorariosParcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `R$ ${acordo.transacaoDetails.honorariosValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              }
                            </p>
                          </div>
                        )}
                        <div>
                          <span className="text-amber-600">Total Adicional:</span>
                          <p className="font-bold text-amber-700">
                            R$ {(acordo.transacaoDetails.custasAdvocaticias + acordo.transacaoDetails.honorariosValor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {temParcelas ? 'Progresso do Pagamento' :
                   (tipoProcesso === 'COMPENSACAO' || tipoProcesso === 'DACAO_PAGAMENTO') ? 'Progresso do Acordo' : 'Status do Acordo'}
                </span>
                <span className="font-medium">
                  {(temParcelas || tipoProcesso === 'COMPENSACAO' || tipoProcesso === 'DACAO_PAGAMENTO')
                    ? `${(progresso?.percentual as number) || 0}%`
                    : acordo.status === 'cumprido' ? '100%' : '0%'
                  }
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{
                    width: (temParcelas || tipoProcesso === 'COMPENSACAO' || tipoProcesso === 'DACAO_PAGAMENTO')
                      ? `${progresso?.percentual || 0}%`
                      : acordo.status === 'cumprido' ? '100%' : '0%'
                  }}
                />
              </div>
              {temParcelas && (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-600">
                      R$ {(progresso?.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-600">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-yellow-600">
                      R$ {(progresso?.valorPendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-600">Pendente</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">
                      R$ {(progresso?.valorPago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-600">Pago</p>
                  </div>
                </div>
              )}
              {!temParcelas && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  {tipoProcesso === 'COMPENSACAO' && acordo.compensacaoDetails && (
                    <>
                      <div>
                        <p className="text-lg font-bold text-green-600">
                          R$ {Number(acordo.compensacaoDetails.valorTotalCreditos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-600">Valor Total Ofertado</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">
                          R$ {Number(acordo.compensacaoDetails.valorTotalDebitos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-600">Valor Total Compensado</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-amber-600">
                          R$ {(Number(acordo.compensacaoDetails.custasAdvocaticias || 0) + Number(acordo.compensacaoDetails.honorariosValor || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-600">Valor Total de Cust./Honor.</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-600">
                          R$ {(Number(acordo.compensacaoDetails.valorTotalDebitos || 0) + Number(acordo.compensacaoDetails.custasAdvocaticias || 0) + Number(acordo.compensacaoDetails.honorariosValor || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-600">Valor Total do Acordo</p>
                      </div>
                    </>
                  )}
                  {tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacaoDetails && (
                    <>
                      <div>
                        <p className="text-lg font-bold text-green-600">
                          R$ {Number(acordo.dacaoDetails.valorTotalOferecido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-600">Valor Total Ofertado</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">
                          R$ {Number(acordo.dacaoDetails.valorTotalCompensar || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-600">Valor Total Compensado</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-amber-600">
                          R$ {(Number(acordo.dacaoDetails.custasAdvocaticias || 0) + Number(acordo.dacaoDetails.honorariosValor || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-600">Valor Total de Cust./Honor.</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-600">
                          R$ {(Number(acordo.dacaoDetails.valorTotalOferecido || 0) + Number(acordo.dacaoDetails.custasAdvocaticias || 0) + Number(acordo.dacaoDetails.honorariosValor || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-600">Valor Total do Acordo</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Observações do Acordo */}
            {(acordo.observacoes as string) && (
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900">Observações do Acordo</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {acordo.observacoes as string}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custas e Honorários - para todos os tipos de acordo */}
      {((temParcelas && acordo.transacaoDetails && (acordo.transacaoDetails.custasAdvocaticias > 0 || acordo.transacaoDetails.honorariosValor > 0)) ||
        (tipoProcesso === 'COMPENSACAO' && acordo.compensacaoDetails && (acordo.compensacaoDetails.custasAdvocaticias > 0 || acordo.compensacaoDetails.honorariosValor > 0)) ||
        (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacaoDetails && (acordo.dacaoDetails.custasAdvocaticias > 0 || acordo.dacaoDetails.honorariosValor > 0))) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-amber-600" />
                Custas e Honorários
              </CardTitle>
              <CardDescription>
                Cronograma de pagamento das custas e honorários
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Custas - primeira seção */}
                {(() => {
                  const detalhes = getCurrentDetails()
                  if (!detalhes || detalhes.custasAdvocaticias <= 0) return null

                  // Calcular status das custas
                  const custasStatus = detalhes.custasDataPagamento
                    ? 'PAGO'
                    : detalhes.custasDataVencimento && new Date(detalhes.custasDataVencimento) < new Date()
                      ? 'ATRASADO'
                      : 'PENDENTE'

                  const isVencidaCustas = custasStatus === 'ATRASADO'
                  const isPagaCustas = custasStatus === 'PAGO'

                  const isClickable = modoRegistrarPagamento && (custasStatus === 'PENDENTE' || custasStatus === 'ATRASADO')

                  return (
                    <div
                      onClick={isClickable ? () => handleToggleCustas() : undefined}
                      className={`border rounded-lg p-4 ${isPagaCustas ? 'bg-green-50 border-green-200' :
                        isVencidaCustas ? 'bg-red-50 border-red-200' :
                          'bg-orange-50 border-orange-200'
                        } ${isClickable ? 'cursor-pointer hover:bg-orange-100 hover:border-orange-300 transition-colors' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {modoRegistrarPagamento && (custasStatus === 'PENDENTE' || custasStatus === 'ATRASADO') ? (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={custasSeelcionada}
                                onCheckedChange={handleToggleCustas}
                                className="w-6 h-6 cursor-pointer"
                              />
                            </div>
                          ) : (
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isPagaCustas ? 'bg-orange-100 text-orange-800' :
                              isVencidaCustas ? 'bg-red-100 text-red-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                              C
                            </span>
                          )}
                          <div>
                            <p className="font-medium">Custas</p>
                            <p className="text-sm text-orange-600">
                              Vencimento: {formatarData(detalhes.custasDataVencimento || acordo.dataVencimento)}
                            </p>
                            {detalhes.custasDataPagamento && (
                              <p className="text-sm text-green-600">
                                Pago em: {formatarData(detalhes.custasDataPagamento)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 justify-end mb-2">
                            <Badge className={getParcelaStatusColor(custasStatus)}>
                              {getParcelaStatusLabel(custasStatus)}
                            </Badge>
                            {canEdit && !modoRegistrarPagamento && acordo.status !== 'cancelado' && acordo.status !== 'cumprido' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditarCustas()
                                }}
                                className={`cursor-pointer ${isPagaCustas ? 'border-green-300 text-green-700 hover:bg-green-100' :
                                  isVencidaCustas ? 'border-red-300 text-red-700 hover:bg-red-100' :
                                    'border-orange-300 text-orange-700 hover:bg-orange-100'
                                  }`}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <p className="text-sm font-medium">
                            R$ {detalhes.custasAdvocaticias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Parcelas de Honorários */}
                {acordo.parcelas
                  .filter((parcela: Parcela) => parcela.tipoParcela === 'PARCELA_HONORARIOS')
                  .map((parcela: Parcela) => {
                    const statusCalculado = calcularStatusParcela(parcela)
                    const isVencidaParcela = statusCalculado === 'ATRASADO'
                    const totalPagoParcela = parcela.pagamentos.reduce((total: number, p: Pagamento) => total + Number(p.valorPago), 0)
                    const restanteParcela = Number(parcela.valor) - totalPagoParcela

                    const isClickable = modoRegistrarPagamento && (statusCalculado === 'PENDENTE' || statusCalculado === 'ATRASADO') && restanteParcela > 0

                    return (
                      <div
                        key={parcela.id}
                        onClick={isClickable ? () => handleToggleHonorarios(parcela.id) : undefined}
                        className={`border rounded-lg p-4 ${parcela.status === 'PAGO' ? 'bg-green-50 border-green-200' :
                          isVencidaParcela ? 'bg-red-50 border-red-200' :
                            'bg-gray-50'
                          } ${isClickable ? 'cursor-pointer hover:bg-amber-50 hover:border-amber-300 transition-colors' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {modoRegistrarPagamento && (statusCalculado === 'PENDENTE' || statusCalculado === 'ATRASADO') && restanteParcela > 0 ? (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={honorariosSelecionados.has(parcela.id)}
                                  onCheckedChange={() => handleToggleHonorarios(parcela.id)}
                                  className="w-6 h-6 cursor-pointer"
                                />
                              </div>
                            ) : (
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${parcela.status === 'PAGO' ? 'bg-amber-100 text-amber-800' :
                                isVencidaParcela ? 'bg-red-100 text-red-800' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                H{parcela.numero}
                              </span>
                            )}
                            <div>
                              <p className="font-medium">
                                Honorários {parcela.numero} de {acordo.transacaoDetails?.honorariosParcelas || 1}
                              </p>
                              <p className="text-sm text-amber-600">
                                Vencimento: {formatarData(parcela.dataVencimento)}
                              </p>
                              {parcela.dataPagamento && (
                                <p className="text-sm text-green-600">
                                  Pago em: {formatarData(parcela.dataPagamento)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 justify-end mb-2">
                              <Badge className={getParcelaStatusColor(statusCalculado)}>
                                {getParcelaStatusLabel(statusCalculado)}
                              </Badge>
                              {canEdit && !modoRegistrarPagamento && acordo.status !== 'cancelado' && acordo.status !== 'cumprido' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditarParcela(parcela)
                                  }}
                                  className={`cursor-pointer ${parcela.status === 'PAGO' ? 'border-green-300 text-green-700 hover:bg-green-100' :
                                    isVencidaParcela ? 'border-red-300 text-red-700 hover:bg-red-100' :
                                      parcela.tipoParcela === 'PARCELA_HONORARIOS' ? 'border-amber-300 text-amber-700 hover:bg-amber-100' :
                                        Number(parcela.numero) === 0 ? 'border-purple-300 text-purple-700 hover:bg-purple-100' :
                                          'border-gray-300 text-gray-700 hover:bg-gray-100'
                                    }`}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <p className="text-sm font-medium">
                              R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            {parcela.status === 'PENDENTE' && totalPagoParcela > 0 && (
                              <p className="text-xs text-blue-600">
                                Pago: R$ {totalPagoParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                        </div>

                      </div>
                    )
                  })}

              </div>
            </CardContent>
          </Card>
        )}

      {/* Parcelas do Acordo - apenas parcelas regulares (não honorários) */}
      {acordo.parcelas.filter((parcela: Parcela) => parcela.tipoParcela !== 'PARCELA_HONORARIOS').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Parcelas do Acordo
            </CardTitle>
            <CardDescription>
              Cronograma de pagamento e status das parcelas do acordo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Mostrar apenas parcelas regulares (não honorários) */}
              {acordo.parcelas
                .filter((parcela: Parcela) => parcela.tipoParcela !== 'PARCELA_HONORARIOS')
                .map((parcela: Parcela) => {
                  const statusCalculado = calcularStatusParcela(parcela)
                  const isVencidaParcela = statusCalculado === 'ATRASADO'
                  const totalPagoParcela = parcela.pagamentos.reduce((total: number, p: Pagamento) => total + Number(p.valorPago), 0)
                  const restanteParcela = Number(parcela.valor) - totalPagoParcela

                  const isClickable = modoRegistrarPagamento && (statusCalculado === 'PENDENTE' || statusCalculado === 'ATRASADO') && restanteParcela > 0
                  const isHonorarios = parcela.tipoParcela === 'PARCELA_HONORARIOS'

                  return (
                    <div
                      key={parcela.id}
                      onClick={isClickable ? () => isHonorarios ? handleToggleHonorarios(parcela.id) : handleToggleParcela(parcela.id) : undefined}
                      className={`border rounded-lg p-4 ${parcela.status === 'PAGO' ? 'bg-green-50 border-green-200' :
                        isVencidaParcela ? 'bg-red-50 border-red-200' :
                          Number(parcela.numero) === 0 ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'
                        } ${isClickable ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {modoRegistrarPagamento && (statusCalculado === 'PENDENTE' || statusCalculado === 'ATRASADO') && restanteParcela > 0 ? (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isHonorarios ? honorariosSelecionados.has(parcela.id) : parcelasSelecionadas.has(parcela.id)}
                                onCheckedChange={() => isHonorarios ? handleToggleHonorarios(parcela.id) : handleToggleParcela(parcela.id)}
                                className="w-6 h-6 cursor-pointer"
                              />
                            </div>
                          ) : (
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              parcela.status === 'PAGO' ? (isHonorarios ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800') :
                              isVencidaParcela ? 'bg-red-100 text-red-800' :
                                isHonorarios ? 'bg-amber-100 text-amber-800' :
                                  Number(parcela.numero) === 0 ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                              {isHonorarios ? `H${parcela.numero}` :
                               Number(parcela.numero) === 0 ? '1' :
                               (acordo.valorEntrada > 0 ? (Number(parcela.numero) + 1).toString() : Number(parcela.numero).toString())}
                            </span>
                          )}
                          <div>
                            <p className="font-medium">
                              {isHonorarios
                                ? `Honorários ${parcela.numero}`
                                : Number(parcela.numero) === 0
                                  ? 'Parcela 1 (Entrada)'
                                  : acordo.valorEntrada > 0
                                    ? `Parcela ${(Number(parcela.numero) + 1).toString()} de ${(acordo.numeroParcelas || 1) + 1}`
                                    : `Parcela ${Number(parcela.numero).toString()} de ${acordo.numeroParcelas || 1}`
                              }
                            </p>
                            <p className="text-sm text-gray-600">
                              Vencimento: {formatarData(parcela.dataVencimento)}
                            </p>
                            {parcela.dataPagamento && (
                              <p className="text-sm text-green-600">
                                Paga em: {formatarData(parcela.dataPagamento)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2 justify-end mb-2">
                            <Badge className={getParcelaStatusColor(statusCalculado)}>
                              {getParcelaStatusLabel(statusCalculado)}
                            </Badge>
                            {canEdit && !modoRegistrarPagamento && acordo.status !== 'cancelado' && acordo.status !== 'cumprido' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditarParcela(parcela)
                                }}
                                className={`cursor-pointer ${parcela.status === 'PAGO' ? 'border-green-300 text-green-700 hover:bg-green-100' :
                                  isVencidaParcela ? 'border-red-300 text-red-700 hover:bg-red-100' :
                                    parcela.tipoParcela === 'PARCELA_HONORARIOS' ? 'border-amber-300 text-amber-700 hover:bg-amber-100' :
                                      Number(parcela.numero) === 0 ? 'border-purple-300 text-purple-700 hover:bg-purple-100' :
                                        'border-gray-300 text-gray-700 hover:bg-gray-100'
                                  }`}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <p className="text-sm font-medium">
                            R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          {parcela.status === 'PENDENTE' && totalPagoParcela > 0 && (
                            <p className="text-xs text-blue-600">
                              Pago: R$ {totalPagoParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </div>
                      </div>

                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Origem do Acordo */}
      {(detalhesAcordo && ((detalhesAcordo.creditos?.length ?? 0) > 0 || (detalhesAcordo.inscricoes?.length ?? 0) > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Origem do Acordo
            </CardTitle>
            <CardDescription>
              {tipoProcesso === 'COMPENSACAO' ? 'Créditos oferecidos e inscrições a compensar' :
                tipoProcesso === 'DACAO_PAGAMENTO' ? 'Inscrições oferecidas e inscrições a compensar' :
                  'Inscrições e débitos que originaram este acordo'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">

              {/* Créditos para compensação e dação */}
              {detalhesAcordo?.creditos && detalhesAcordo?.creditos.length > 0 && (
                <div className="mb-6">
                  <h5 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    {tipoProcesso === 'COMPENSACAO' ? 'Créditos Oferecidos' : 'Inscrições Oferecidas'}
                  </h5>
                  <div className="space-y-3">
                    {detalhesAcordo?.creditos?.map((credito: Credito, idx: number) => (
                      <div key={credito.id || `credito-${idx}`} className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <div>
                              <p className="font-medium text-sm text-green-900">{credito.numeroCredito}</p>
                              <p className="text-xs text-green-700 capitalize">
                                {credito.tipoCredito?.replace('_', ' ').toLowerCase()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-green-900">
                              R$ {Number(credito.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            {credito.dataVencimento && (
                              <p className="text-xs text-green-600">
                                Venc: {formatarData(credito.dataVencimento)}
                              </p>
                            )}
                          </div>
                        </div>
                        {credito.descricao && (
                          <p className="text-xs text-green-600 mt-1">{credito.descricao}</p>
                        )}
                      </div>
                    ))}
                    <div className="p-3 bg-green-100 rounded-lg border border-green-300">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-green-800">
                          Total {tipoProcesso === 'COMPENSACAO' ? 'dos Créditos' : 'das Inscrições Oferecidas'}:
                        </span>
                        <span className="text-sm font-bold text-green-900">
                          R$ {detalhesAcordo?.creditos?.reduce((total: number, credito: Credito) => total + Number(credito.valor || 0), 0)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Inscrições a compensar */}
              {detalhesAcordo?.inscricoes && detalhesAcordo?.inscricoes.length > 0 && (
                <div className="mb-6">
                  <h5 className="text-sm font-medium text-blue-700 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    {tipoProcesso === 'TRANSACAO_EXCEPCIONAL' ? 'Inscrições Incluídas' : 'Inscrições a Compensar'}
                  </h5>
                  <div className="space-y-3">
                    {detalhesAcordo?.inscricoes?.map((inscricao: InscricaoDetalhe, idx: number) => (
                      <div key={inscricao.id || `inscricao-${idx}`} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <div>
                              <p className="font-medium text-sm text-blue-900">{inscricao.numeroInscricao}</p>
                              <p className="text-xs text-blue-700 capitalize">
                                {inscricao.tipoInscricao === 'IMOBILIARIA' ? 'Imobiliária' : 'Econômica'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-blue-900">
                              Total: R$ {Number(inscricao.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>

                        {/* Débitos da inscrição */}
                        {inscricao.debitos && inscricao.debitos.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-blue-300">
                            <h6 className="text-xs font-medium text-blue-700 mb-2">Débitos:</h6>
                            <div className="space-y-2">
                              {inscricao.debitos?.map((debito: DebitoDetalhe, idx: number) => (
                                <div key={debito.id || `debito-${idx}`} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                                  <span className="text-gray-700">{debito.descricao}</span>
                                  <div className="text-right">
                                    <span className="font-medium text-gray-900">
                                      R$ {Number(debito.valorLancado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    {debito.dataVencimento && (
                                      <div className="text-gray-500">
                                        Venc: {formatarData(debito.dataVencimento)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="p-3 bg-blue-100 rounded-lg border border-blue-300">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-800">
                          Total das Inscrições:
                        </span>
                        <span className="text-sm font-bold text-blue-900">
                          R$ {detalhesAcordo?.inscricoes?.reduce((total: number, inscricao: InscricaoDetalhe) => total + Number(inscricao.valorTotal || 0), 0)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Verificar se tem detalhes */}
              {/* {detalhesAcordo?.detalhes && Array.isArray(detalhesAcordo.detalhes) && detalhesAcordo.detalhes.length > 0 ? (
                detalhesAcordo.detalhes.map((detalhe: DetalheAcordo) => (
                  <div key={detalhe.id} className="border rounded-lg p-4">

                    {detalhe.tipo === 'transacao' && (
                      <>
                        <div className="mb-6">
                          <h5 className="text-sm font-medium text-blue-700 mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            Inscrições Incluídas
                          </h5>
                          {detalhe.inscricoes && Array.isArray(detalhe.inscricoes) && detalhe.inscricoes.length > 0 ? (
                            <div className="space-y-3">
                              {detalhe.inscricoes.map((inscricao: InscricaoDetalhe, idx: number) => (
                                <div key={inscricao.id || `inscricao-${idx}`} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                      <div>
                                        <p className="font-medium text-sm text-blue-900">{inscricao.numeroInscricao}</p>
                                        <p className="text-xs text-blue-700 capitalize">
                                          {inscricao.tipoInscricao === 'imobiliaria' ? 'Imobiliária' : 'Econômica'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-medium text-blue-900">
                                        Total: R$ {(isNaN(Number(inscricao.valorDebito)) ? 0 : Number(inscricao.valorDebito || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                  </div>

                                  {inscricao.descricaoDebitos && Array.isArray(inscricao.descricaoDebitos) && inscricao.descricaoDebitos.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-blue-300">
                                      <h6 className="text-xs font-medium text-blue-700 mb-2">Débitos Incluídos:</h6>
                                      <div className="space-y-2">
                                        {inscricao.descricaoDebitos.map((debito: DebitoDetalhe, idx: number) => (
                                          <div key={debito.id || `debito-${idx}`} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                                            <span className="text-gray-700">{debito.descricao}</span>
                                            <div className="text-right">
                                              <span className="font-medium text-gray-900">
                                                R$ {(isNaN(Number(debito.valorLancado)) ? 0 : Number(debito.valorLancado || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </span>
                                              {debito.dataVencimento && (
                                                <div className="text-gray-500">
                                                  Venc: {new Date(debito.dataVencimento).toLocaleDateString('pt-BR')}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                              <div className="p-3 bg-blue-100 rounded-lg border border-blue-300">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-blue-800">Total das Inscrições:</span>
                                  <span className="text-sm font-bold text-blue-900">
                                    R$ {(detalhe.inscricoes && Array.isArray(detalhe.inscricoes)
                                      ? detalhe.inscricoes.reduce((total: number, inscricao: InscricaoDetalhe) => {
                                        const valor = Number(inscricao.valorDebito || 0)
                                        return total + (isNaN(valor) ? 0 : valor)
                                      }, 0)
                                      : 0
                                    ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">Nenhuma inscrição encontrada.</p>
                          )}
                        </div>
                      </>
                    )}

                    {detalhe.tipo === 'dacao' && (
                      <>
                        <div className="mb-6">
                          <h5 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Inscrições Oferecidas
                          </h5>
                          {(() => {
                            try {
                              const observacoes = detalhe.observacoes
                              if (observacoes) {
                                const dadosDacao = JSON.parse(observacoes) as DadosDacao
                                if (dadosDacao.inscricoesOferecidas && Array.isArray(dadosDacao.inscricoesOferecidas)) {
                                  return (
                                    <div className="space-y-3">
                                      {dadosDacao.inscricoesOferecidas.map((inscricao: InscricaoOferecida, idx: number) => (
                                        <div key={inscricao.id || `inscricao-oferecida-${idx}`} className="p-3 bg-green-50 rounded-lg border border-green-200">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                              <div>
                                                <p className="font-medium text-sm text-green-900">{inscricao.numeroInscricao}</p>
                                                <p className="text-xs text-green-700 capitalize">
                                                  {inscricao.tipoInscricao === 'imobiliaria' ? 'Imobiliária' : 'Econômica'}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-sm font-medium text-green-900">
                                                R$ {(isNaN(Number(inscricao.valor)) ? 0 : Number(inscricao.valor || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </p>
                                              {inscricao.dataVencimento && String(inscricao.dataVencimento) !== '' ? (
                                                <p className="text-xs text-green-600">
                                                  Venc: {new Date(inscricao.dataVencimento).toLocaleDateString('pt-BR')}
                                                </p>
                                              ) : null}
                                            </div>
                                          </div>
                                          {inscricao.descricao && (
                                            <p className="text-xs text-green-600 mt-1">{inscricao.descricao}</p>
                                          )}
                                        </div>
                                      ))}
                                      <div className="p-3 bg-green-100 rounded-lg border border-green-300">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm font-medium text-green-800">Total das Inscrições Oferecidas:</span>
                                          <span className="text-sm font-bold text-green-900">
                                            R$ {Number(dadosDacao.valorTotalOferecido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                }
                              }
                            } catch {
                              // Se não conseguir fazer parse ou não tiver dados
                            }
                            return (
                              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                <p className="text-sm text-green-700">
                                  As inscrições configuradas no momento da criação do acordo foram utilizadas para esta dação.
                                </p>
                              </div>
                            )
                          })()}
                        </div>
                      </>
                    )}


                    {detalhe.imovel && (
                      <div className="mt-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Imóvel:</h5>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="font-medium text-sm">{detalhe.imovel.matricula}</p>
                          <p className="text-xs text-gray-600">{detalhe.imovel.endereco}</p>
                          <p className="text-sm font-medium mt-1">
                            Valor Avaliado: R$ {(isNaN(Number(detalhe.imovel.valorAvaliado)) ? 0 : Number(detalhe.imovel.valorAvaliado || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    )}

                    {detalhe.credito && (
                      <div className="mt-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Crédito:</h5>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="font-medium text-sm">{detalhe.credito.numero}</p>
                          <p className="text-xs text-gray-600 capitalize">{detalhe.credito.tipo.replace('_', ' ')}</p>
                          <p className="text-sm font-medium mt-1">
                            Valor: R$ {(isNaN(Number(detalhe.credito.valor)) ? 0 : Number(detalhe.credito.valor || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                // Mostrar mensagem apenas se não há créditos nem inscrições
                !detalhesAcordo?.creditos?.length && !detalhesAcordo?.inscricoes?.length && (
                  <div className="text-center py-8 text-gray-500">
                    <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p>Nenhum detalhe específico encontrado para este acordo.</p>
                    <p className="text-sm mt-1">
                      {tipoProcesso === 'COMPENSACAO' ? 'Créditos e inscrições não foram configurados.' :
                        tipoProcesso === 'DACAO_PAGAMENTO' ? 'Inscrições oferecidas e a compensar não foram configuradas.' :
                          'As inscrições podem não ter sido configuradas ou carregadas.'}
                    </p>
                  </div>
                )
              )} */}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cláusulas Especiais */}
      {(acordo.clausulasEspeciais as string) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cláusulas Especiais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{acordo.clausulasEspeciais as string}</p>
          </CardContent>
        </Card>
      )}

      {/* Detalhes Específicos do Acordo */}
      <CumprimentoWrapper
        acordoId={acordo.id as string}
        detalhes={[]}
      />

      {/* Modal de Edição de Parcela */}
      <Dialog open={showEditModal} onOpenChange={handleCancelarEdicao}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Editar Parcela
            </DialogTitle>
            <DialogDescription>
              Edite as informações da parcela. O status será calculado automaticamente com base nas datas informadas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarEdicaoParcela} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dataVencimento-edit">Data de Vencimento <span className="text-red-500">*</span></Label>
              <Input
                id="dataVencimento-edit"
                type="date"
                value={formEdicaoParcela.dataVencimento}
                onChange={(e) => {
                  setFormEdicaoParcela(prev => ({ ...prev, dataVencimento: e.target.value }))
                  clearFieldErrorEdit('dataVencimento-edit')
                  clearFormErrors()
                }}
                onFocus={() => {
                  clearFieldErrorEdit('dataVencimento-edit')
                  clearFormErrors()
                }}
                disabled={processandoPagamento}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataPagamento-edit">Data de Pagamento</Label>
              <Input
                id="dataPagamento-edit"
                type="date"
                value={formEdicaoParcela.dataPagamento}
                onChange={(e) => {
                  setFormEdicaoParcela(prev => ({ ...prev, dataPagamento: e.target.value }))
                  clearFieldErrorEdit('dataPagamento-edit')
                  clearFormErrors()
                }}
                onFocus={() => {
                  clearFieldErrorEdit('dataPagamento-edit')
                  clearFormErrors()
                }}
                disabled={processandoPagamento}
              />
              <p className="text-xs text-gray-500">
                Deixe em branco se a parcela não foi paga. O status será calculado automaticamente.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelarEdicao}
                disabled={processandoPagamento}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={processandoPagamento}
                className="cursor-pointer"
              >
                {processandoPagamento ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Custas */}
      <Dialog open={showEditCustasModal} onOpenChange={handleCancelarEdicaoCustas}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Editar Custas
            </DialogTitle>
            <DialogDescription>
              Edite as informações das custas. O status será calculado automaticamente com base nas datas informadas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarEdicaoCustas} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custasDataVencimento-edit">Data de Vencimento <span className="text-red-500">*</span></Label>
              <Input
                id="custasDataVencimento-edit"
                type="date"
                value={formEdicaoCustas.dataVencimento}
                onChange={(e) => {
                  setFormEdicaoCustas(prev => ({ ...prev, dataVencimento: e.target.value }))
                  clearFieldErrorEdit('custasDataVencimento-edit')
                  clearFormErrors()
                }}
                onFocus={() => {
                  clearFieldErrorEdit('custasDataVencimento-edit')
                  clearFormErrors()
                }}
                disabled={processandoPagamento}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="custasDataPagamento-edit">Data de Pagamento</Label>
              <Input
                id="custasDataPagamento-edit"
                type="date"
                value={formEdicaoCustas.dataPagamento}
                onChange={(e) => {
                  setFormEdicaoCustas(prev => ({ ...prev, dataPagamento: e.target.value }))
                  clearFieldErrorEdit('custasDataPagamento-edit')
                  clearFormErrors()
                }}
                onFocus={() => {
                  clearFieldErrorEdit('custasDataPagamento-edit')
                  clearFormErrors()
                }}
                disabled={processandoPagamento}
              />
              <p className="text-xs text-gray-500">
                Deixe em branco se as custas não foram pagas. O status será calculado automaticamente.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelarEdicaoCustas}
                disabled={processandoPagamento}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={processandoPagamento}
                className="cursor-pointer"
              >
                {processandoPagamento ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}
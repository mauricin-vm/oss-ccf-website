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
  AlertCircle,
  Receipt
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
}

interface DetalheAcordo {
  id: string
  tipo: string
  descricao: string
  valorOriginal: number
  observacoes?: string
  inscricoes?: InscricaoDetalhe[]
  imovel?: Imovel
  credito?: Credito
}

interface InscricaoDetalhe {
  id: string
  numeroInscricao: string
  tipoInscricao: string
  valorDebito: number
  descricaoDebitos: DebitoDetalhe[]
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
  tipo: string
  valor: number
}

interface CreditoOferecido {
  id?: string
  numero: string
  tipo: string
  valor: number
  descricao?: string
}

interface InscricaoOferecida {
  id?: string
  numeroInscricao: string
  tipoInscricao: string
  valor: number
  descricao?: string
  dataVencimento?: string
}

interface DadosCreditos {
  creditosOferecidos: CreditoOferecido[]
  valorTotalCreditos: number
}

interface DadosDacao {
  inscricoesOferecidas: InscricaoOferecida[]
  valorTotalOferecido: number
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
  const [processandoPagamento, setProcessandoPagamento] = useState(false)
  const [parcelaEditando, setParcelaEditando] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [formEdicaoParcela, setFormEdicaoParcela] = useState({
    dataVencimento: '',
    dataPagamento: ''
  })
  const [errorEdit, setErrorEdit] = useState<string | null>(null)
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

  const handleConfirmarPagamento = async () => {
    if (parcelasSelecionadas.size === 0 && !custasSeelcionada) {
      toast.error('Selecione pelo menos uma parcela ou custas para registrar o pagamento')
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
      if (custasSeelcionada && acordo?.transacaoDetails?.custasAdvocaticias > 0) {
        const response = await fetch(`/api/acordos/${acordo.id}/custas`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            custasDataVencimento: acordo.transacaoDetails.custasDataVencimento || acordo.dataVencimento,
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
    setErrorEdit(null)
    setShowEditModal(true)
  }

  const handleCancelarEdicao = () => {
    setParcelaEditando(null)
    setShowEditModal(false)
    setFormEdicaoParcela({
      dataVencimento: '',
      dataPagamento: ''
    })
    setErrorEdit(null)
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

  const clearFieldErrorEdit = (fieldId: string) => {
    const element = document.getElementById(fieldId)
    if (element) {
      element.style.borderColor = ''
      element.style.boxShadow = ''
    }
  }

  const handleSalvarEdicaoParcela = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!parcelaEditando) return

    if (!formEdicaoParcela.dataVencimento.trim()) {
      const errorMessage = 'Data de vencimento é obrigatória'
      toast.error(errorMessage)
      setErrorEdit(errorMessage)

      setTimeout(() => {
        const element = document.getElementById('dataVencimento-edit')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }

    try {
      setProcessandoPagamento(true)
      setErrorEdit(null)

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
        throw new Error(errorMessage)
      }

      toast.success('Parcela atualizada com sucesso!')

      // Recarregar dados
      await loadAcordo()
      handleCancelarEdicao()
    } catch (error) {
      console.error('Erro ao atualizar parcela:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar parcela'
      setErrorEdit(errorMessage)
    } finally {
      setProcessandoPagamento(false)
    }
  }

  // Funções para edição de custas advocatícias
  const handleEditarCustas = () => {
    setFormEdicaoCustas({
      dataVencimento: acordo?.transacaoDetails?.custasDataVencimento
        ? new Date(acordo.transacaoDetails.custasDataVencimento).toISOString().split('T')[0]
        : acordo?.dataVencimento
          ? new Date(acordo.dataVencimento).toISOString().split('T')[0]
          : '',
      dataPagamento: acordo?.transacaoDetails?.custasDataPagamento
        ? new Date(acordo.transacaoDetails.custasDataPagamento).toISOString().split('T')[0]
        : ''
    })
    setErrorEdit(null)
    setShowEditCustasModal(true)
  }

  const handleCancelarEdicaoCustas = () => {
    setShowEditCustasModal(false)
    setFormEdicaoCustas({ dataVencimento: '', dataPagamento: '' })
    setErrorEdit(null)
    // Limpar bordas vermelhas dos campos
    clearFieldErrorEdit('custasDataVencimento-edit')
    clearFieldErrorEdit('custasDataPagamento-edit')
  }

  const handleSalvarEdicaoCustas = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!acordo?.id) return

    if (!formEdicaoCustas.dataVencimento.trim()) {
      const errorMessage = 'Data de vencimento é obrigatória'
      toast.error(errorMessage)
      setErrorEdit(errorMessage)

      setTimeout(() => {
        const element = document.getElementById('custasDataVencimento-edit')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }

    try {
      setProcessandoPagamento(true)
      setErrorEdit(null)

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
        const errorMessage = errorData.error || 'Erro ao atualizar custas advocatícias'
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }

      const acordoAtualizado = await response.json()
      setAcordo(acordoAtualizado)
      setShowEditCustasModal(false)
      toast.success('Custas advocatícias atualizadas com sucesso!')

    } catch (error) {
      console.error('Erro ao atualizar custas:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      setErrorEdit(errorMessage)
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
    const parcelas = acordo.parcelas || []

    // Calcular valor total das parcelas (acordo + honorários)
    const valorTotalParcelas = parcelas.reduce((total: number, parcela: Parcela) => {
      return total + Number(parcela.valor || 0)
    }, 0)

    // Adicionar custas advocatícias (se existir)
    const custasAdvocaticias = acordo.transacaoDetails?.custasAdvocaticias || 0
    const valorTotalGeral = valorTotalParcelas + custasAdvocaticias

    // Calcular valor pago de todas as parcelas (acordo + honorários)
    let valorPago = parcelas.reduce((total: number, parcela: Parcela) => {
      const pagamentos = parcela.pagamentos || []
      return total + pagamentos.reduce((subtotal: number, pagamento: Pagamento) => {
        return subtotal + Number(pagamento.valorPago || 0)
      }, 0)
    }, 0)

    // Adicionar custas advocatícias se foram pagas
    if (acordo.transacaoDetails?.custasDataPagamento && custasAdvocaticias > 0) {
      valorPago += custasAdvocaticias
    }

    // Note: As custas advocatícias geralmente são pagas à vista na assinatura
    // Se não houver um sistema específico para rastrear pagamento das custas,
    // consideramos elas como pendentes no cálculo do progresso

    const percentual = valorTotalGeral > 0 ? Math.round((valorPago / valorTotalGeral) * 100) : 0

    return {
      valorTotal: valorTotalGeral,
      valorPago,
      valorPendente: valorTotalGeral - valorPago,
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

  const isVencido = () => {
    if (acordo.status !== 'ativo') return false

    // Verificar se há parcelas vencidas (ATRASADO)
    const temParcelaVencida = acordo.parcelas?.some((parcela: Parcela) => parcela.status === 'ATRASADO')

    // Verificar se há custas vencidas (custas com data de vencimento passada e sem data de pagamento)
    let temCustasVencida = false
    if (acordo.transacaoDetails?.custasAdvocaticias > 0) {
      const custasDataVencimento = acordo.transacaoDetails.custasDataVencimento || acordo.dataVencimento
      const custasDataPagamento = acordo.transacaoDetails.custasDataPagamento

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
          {temParcelas && canRegisterPayment && (progresso?.valorPendente || 0) > 0 && !modoRegistrarPagamento && (
            <Button onClick={handleIniciarRegistroPagamento} className="cursor-pointer">
              <DollarSign className="mr-2 h-4 w-4" />
              Registrar Pagamento
            </Button>
          )}
          {!temParcelas && canEdit && acordo?.status === 'ativo' && (
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
          {temParcelas && modoRegistrarPagamento && (
            <>
              <Button
                onClick={handleConfirmarPagamento}
                disabled={(parcelasSelecionadas.size === 0 && !custasSeelcionada) || processandoPagamento}
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
                    Confirmar Pagamento ({parcelasSelecionadas.size + (custasSeelcionada ? 1 : 0)})
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
              <AcordoActions acordo={acordo as { id: string; status: string; parcelas: { id: string; pagamentos: { id: string; valorPago: number; }[]; }[]; valorFinal: number; }} />
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
                <h5 className="font-medium mb-3 text-blue-800">Simulação do Pagamento:</h5>

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
                            <span className="text-amber-600">Custas Advocatícias:</span>
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
                  {temParcelas ? 'Progresso do Pagamento' : 'Status do Acordo'}
                </span>
                <span className="font-medium">
                  {temParcelas
                    ? `${(progresso?.percentual as number) || 0}%`
                    : acordo.status === 'cumprido' ? '100%' : '0%'
                  }
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{
                    width: temParcelas
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
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-600">
                      R$ {getValorAcordo().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-600">
                      {tipoProcesso === 'COMPENSACAO' ? 'Valor do Acordo' :
                        tipoProcesso === 'DACAO_PAGAMENTO' ? 'Valor do Acordo' :
                          'Valor do Acordo'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${acordo.status === 'cumprido' ? 'text-green-600' : acordo.status === 'ativo' ? 'text-yellow-600' : 'text-red-600'}`}>
                      {getStatusLabel(acordo.status)}
                    </p>
                    <p className="text-xs text-gray-600">Status Atual</p>
                  </div>
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

      {/* Custas e Honorários - apenas para transação excepcional */}
      {temParcelas && acordo.transacaoDetails && (acordo.transacaoDetails.custasAdvocaticias > 0 || acordo.transacaoDetails.honorariosValor > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-600" />
              Custas e Honorários
            </CardTitle>
            <CardDescription>
              Custas advocatícias e cronograma de pagamento dos honorários
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Custas Advocatícias - primeira seção */}
              {acordo.transacaoDetails && acordo.transacaoDetails.custasAdvocaticias > 0 && (() => {
                // Calcular status das custas
                const custasStatus = acordo.transacaoDetails.custasDataPagamento
                  ? 'PAGO'
                  : acordo.transacaoDetails.custasDataVencimento && new Date(acordo.transacaoDetails.custasDataVencimento) < new Date()
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
                          <p className="font-medium">Custas Advocatícias</p>
                          <p className="text-sm text-orange-600">
                            Vencimento: {formatarData(acordo.transacaoDetails.custasDataVencimento || acordo.dataVencimento)}
                          </p>
                          {acordo.transacaoDetails.custasDataPagamento && (
                            <p className="text-sm text-green-600">
                              Pago em: {formatarData(acordo.transacaoDetails.custasDataPagamento)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end mb-2">
                          <Badge className={getParcelaStatusColor(custasStatus as any)}>
                            {getParcelaStatusLabel(custasStatus as any)}
                          </Badge>
                          {canEdit && !modoRegistrarPagamento && acordo.status !== 'cancelado' && acordo.status !== 'cumprido' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditarCustas()
                              }}
                              className={`cursor-pointer ${
                                isPagaCustas ? 'border-green-300 text-green-700 hover:bg-green-100' :
                                isVencidaCustas ? 'border-red-300 text-red-700 hover:bg-red-100' :
                                'border-orange-300 text-orange-700 hover:bg-orange-100'
                              }`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm font-medium">
                          R$ {acordo.transacaoDetails.custasAdvocaticias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                  const isVencidaParcela = parcela.status === 'ATRASADO'
                  const totalPagoParcela = parcela.pagamentos.reduce((total: number, p: Pagamento) => total + Number(p.valorPago), 0)
                  const restanteParcela = Number(parcela.valor) - totalPagoParcela

                  const isClickable = modoRegistrarPagamento && (parcela.status === 'PENDENTE' || parcela.status === 'ATRASADO') && restanteParcela > 0

                  return (
                    <div
                      key={parcela.id}
                      onClick={isClickable ? () => handleToggleParcela(parcela.id) : undefined}
                      className={`border rounded-lg p-4 ${parcela.status === 'PAGO' ? 'bg-green-50 border-green-200' :
                        isVencidaParcela ? 'bg-red-50 border-red-200' :
                          'bg-gray-50'
                        } ${isClickable ? 'cursor-pointer hover:bg-amber-50 hover:border-amber-300 transition-colors' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {modoRegistrarPagamento && (parcela.status === 'PENDENTE' || parcela.status === 'ATRASADO') && restanteParcela > 0 ? (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={parcelasSelecionadas.has(parcela.id)}
                                onCheckedChange={() => handleToggleParcela(parcela.id)}
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
                            <Badge className={getParcelaStatusColor(parcela.status)}>
                              {getParcelaStatusLabel(parcela.status)}
                            </Badge>
                            {canEdit && !modoRegistrarPagamento && acordo.status !== 'cancelado' && acordo.status !== 'cumprido' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditarParcela(parcela)
                                }}
                                className={`cursor-pointer ${
                                  parcela.status === 'PAGO' ? 'border-green-300 text-green-700 hover:bg-green-100' :
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

              {/* Mensagem se não houver parcelas de honorários mas houver custas */}
              {acordo.parcelas
                .filter((parcela: Parcela) => parcela.tipoParcela === 'PARCELA_HONORARIOS').length === 0 &&
                acordo.transacaoDetails && acordo.transacaoDetails.honorariosValor > 0 && (
                  <div className="text-center py-4 text-amber-600 bg-amber-50 rounded-lg border border-amber-200">
                    <Receipt className="mx-auto h-8 w-8 text-amber-400 mb-2" />
                    <p className="text-sm">Honorários configurados para pagamento à vista na data de assinatura</p>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parcelas do Acordo - apenas para transação excepcional */}
      {temParcelas && (
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
              {/* Filtrar apenas parcelas do acordo (não de honorários) */}
              {acordo.parcelas
                .filter((parcela: Parcela) => parcela.tipoParcela !== 'PARCELA_HONORARIOS')
                .map((parcela: Parcela) => {
                  const isVencidaParcela = parcela.status === 'ATRASADO'
                  const totalPagoParcela = parcela.pagamentos.reduce((total: number, p: Pagamento) => total + Number(p.valorPago), 0)
                  const restanteParcela = Number(parcela.valor) - totalPagoParcela

                  const isClickable = modoRegistrarPagamento && (parcela.status === 'PENDENTE' || parcela.status === 'ATRASADO') && restanteParcela > 0

                  return (
                    <div
                      key={parcela.id}
                      onClick={isClickable ? () => handleToggleParcela(parcela.id) : undefined}
                      className={`border rounded-lg p-4 ${parcela.status === 'PAGO' ? 'bg-green-50 border-green-200' :
                        isVencidaParcela ? 'bg-red-50 border-red-200' :
                          Number(parcela.numero) === 0 ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'
                        } ${isClickable ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {modoRegistrarPagamento && (parcela.status === 'PENDENTE' || parcela.status === 'ATRASADO') && restanteParcela > 0 ? (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={parcelasSelecionadas.has(parcela.id)}
                                onCheckedChange={() => handleToggleParcela(parcela.id)}
                                className="w-6 h-6 cursor-pointer"
                              />
                            </div>
                          ) : (
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${parcela.status === 'PAGO' ? 'bg-green-100 text-green-800' :
                              isVencidaParcela ? 'bg-red-100 text-red-800' :
                                Number(parcela.numero) === 0 ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                              {Number(parcela.numero) === 0 ? '1' : (acordo.valorEntrada > 0 ? (Number(parcela.numero) + 1).toString() : Number(parcela.numero).toString())}
                            </span>
                          )}
                          <div>
                            <p className="font-medium">
                              {Number(parcela.numero) === 0
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
                            <Badge className={getParcelaStatusColor(parcela.status)}>
                              {getParcelaStatusLabel(parcela.status)}
                            </Badge>
                            {canEdit && !modoRegistrarPagamento && acordo.status !== 'cancelado' && acordo.status !== 'cumprido' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditarParcela(parcela)
                                }}
                                className={`cursor-pointer ${
                                  parcela.status === 'PAGO' ? 'border-green-300 text-green-700 hover:bg-green-100' :
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
      {detalhesAcordo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Origem do Acordo
            </CardTitle>
            <CardDescription>
              Inscrições e débitos que originaram este acordo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Verificar se tem detalhes */}
              {detalhesAcordo?.detalhes && Array.isArray(detalhesAcordo.detalhes) && detalhesAcordo.detalhes.length > 0 ? (
                detalhesAcordo.detalhes.map((detalhe: DetalheAcordo) => (
                  <div key={detalhe.id} className="border rounded-lg p-4">
                    {/* <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <h4 className="font-medium text-gray-900">
                        {detalhe.tipo === 'compensacao' ? '' :
                          detalhe.tipo === 'dacao' ? 'Dação em Pagamento' :
                            detalhe.descricao}
                      </h4>
                    </div> */}

                    {/* Para Transação Excepcional: Mostrar inscrições incluídas */}
                    {detalhe.tipo === 'transacao' && (
                      <>
                        {/* Inscrições Incluídas */}
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

                                  {/* Débitos da inscrição */}
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
                              {/* Total das Inscrições */}
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

                    {/* Para Compensação: Mostrar créditos oferecidos separadamente */}
                    {detalhe.tipo === 'compensacao' && (
                      <>
                        {/* Créditos Oferecidos */}
                        <div className="mb-6">
                          <h5 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Créditos Oferecidos
                          </h5>
                          {(() => {
                            try {
                              const observacoes = detalhe.observacoes
                              if (observacoes) {
                                const dadosCreditos = JSON.parse(observacoes) as DadosCreditos
                                if (dadosCreditos.creditosOferecidos && Array.isArray(dadosCreditos.creditosOferecidos)) {
                                  return (
                                    <div className="space-y-3">
                                      {dadosCreditos.creditosOferecidos.map((credito: CreditoOferecido, idx: number) => (
                                        <div key={credito.id || `credito-${idx}`} className="p-3 bg-green-50 rounded-lg border border-green-200">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                              <div>
                                                <p className="font-medium text-sm text-green-900">{credito.numero}</p>
                                                <p className="text-xs text-green-700 capitalize">
                                                  {credito.tipo.replace('_', ' ')}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-sm font-medium text-green-900">
                                                R$ {(isNaN(Number(credito.valor)) ? 0 : Number(credito.valor || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </p>
                                            </div>
                                          </div>
                                          {credito.descricao && (
                                            <p className="text-xs text-green-600 mt-1">{credito.descricao}</p>
                                          )}
                                        </div>
                                      ))}
                                      <div className="p-3 bg-green-100 rounded-lg border border-green-300">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm font-medium text-green-800">Total dos Créditos:</span>
                                          <span className="text-sm font-bold text-green-900">
                                            R$ {Number(dadosCreditos.valorTotalCreditos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                                  Os créditos configurados no momento da criação do acordo foram utilizados para esta compensação.
                                </p>
                              </div>
                            )
                          })()}
                        </div>
                      </>
                    )}


                    {/* Para Dação em Pagamento: Mostrar inscrições oferecidas separadamente */}
                    {detalhe.tipo === 'dacao' && (
                      <>
                        {/* Inscrições Oferecidas */}
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


                    {/* Imóvel relacionado (para dação) */}
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

                    {/* Crédito relacionado (para compensação) */}
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
                <div className="text-center py-8 text-gray-500">
                  <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p>Nenhum detalhe específico encontrado para este acordo.</p>
                  <p className="text-sm mt-1">Os detalhes podem não ter sido configurados ou carregados.</p>
                </div>
              )}
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

          <form onSubmit={handleSalvarEdicaoParcela} className="space-y-4">
            {errorEdit && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorEdit}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="dataVencimento-edit">Data de Vencimento <span className="text-red-500">*</span></Label>
              <Input
                id="dataVencimento-edit"
                type="date"
                value={formEdicaoParcela.dataVencimento}
                onChange={(e) => {
                  setFormEdicaoParcela(prev => ({ ...prev, dataVencimento: e.target.value }))
                  clearFieldErrorEdit('dataVencimento-edit')
                }}
                onFocus={() => clearFieldErrorEdit('dataVencimento-edit')}
                disabled={processandoPagamento}
                required
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
                }}
                onFocus={() => clearFieldErrorEdit('dataPagamento-edit')}
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

      {/* Modal de Edição de Custas Advocatícias */}
      <Dialog open={showEditCustasModal} onOpenChange={handleCancelarEdicaoCustas}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Editar Custas Advocatícias
            </DialogTitle>
            <DialogDescription>
              Edite as informações das custas advocatícias. O status será calculado automaticamente com base nas datas informadas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarEdicaoCustas} className="space-y-4">
            {errorEdit && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorEdit}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="custasDataVencimento-edit">Data de Vencimento <span className="text-red-500">*</span></Label>
              <Input
                id="custasDataVencimento-edit"
                type="date"
                value={formEdicaoCustas.dataVencimento}
                onChange={(e) => {
                  setFormEdicaoCustas(prev => ({ ...prev, dataVencimento: e.target.value }))
                  clearFieldErrorEdit('custasDataVencimento-edit')
                }}
                onFocus={() => clearFieldErrorEdit('custasDataVencimento-edit')}
                disabled={processandoPagamento}
                required
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
                }}
                onFocus={() => clearFieldErrorEdit('custasDataPagamento-edit')}
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
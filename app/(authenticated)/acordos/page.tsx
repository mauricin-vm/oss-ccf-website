'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import {
  Plus,
  Search,
  HandCoins,
  Calendar,
  AlertTriangle,
  DollarSign,
  FileText,
  Filter,
  CheckCircle,
  X,
  CreditCard
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'
import { formatarCpfCnpj } from '@/lib/utils'
import { getTipoProcessoInfo } from '@/lib/constants/tipos-processo'
import { toast } from 'sonner'

interface Acordo {
  id: string
  status: string
  modalidadePagamento: string
  numeroParcelas: number
  valorTotal: number
  valorDesconto: number
  percentualDesconto: number
  valorFinal: number
  valorEntrada?: number
  dataAssinatura: string
  dataVencimento: string
  createdAt: string
  processo: {
    id: string
    numero: string
    tipo: 'COMPENSACAO' | 'DACAO_PAGAMENTO' | 'TRANSACAO_EXCEPCIONAL'
    contribuinte: {
      nome: string
      cpfCnpj: string
    }
  }
  parcelas: Array<{
    id: string
    numero: number
    valor: number
    status: string
    dataVencimento: string
    tipoParcela: string
    pagamentos: Array<{
      id: string
      valorPago: number
    }>
  }>
  transacaoDetails?: {
    custasAdvocaticias: number
    custasDataVencimento: string | null
    custasDataPagamento: string | null
    honorariosValor: number
    honorariosMetodoPagamento: string | null
    honorariosParcelas: number | null
  }
  compensacaoDetails?: {
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
  dacaoDetails?: {
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
  detalhes: Array<{
    tipo: string
    descricao: string
    valorOriginal: number
    valorNegociado: number
    observacoes?: string
    imovel?: {
      valorAvaliado: number
    }
    inscricoes: Array<{
      valorDebito: number
      valorAbatido: number
      percentualAbatido: number
    }>
  }>
}

export default function AcordosPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser

  const [acordos, setAcordos] = useState<Acordo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tipoFilter, setTipoFilter] = useState('all')
  const [modalidadeFilter, setModalidadeFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(15)

  // Carregamento inicial
  useEffect(() => {
    loadAllAcordos()
  }, [])

  const loadAllAcordos = async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/acordos?limit=1000', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar acordos')
      }

      const data = await response.json()
      setAcordos(data.acordos || [])
    } catch {
      toast.error('Erro ao carregar acordos')
      setAcordos([])
    } finally {
      setLoading(false)
    }
  }

  // Função para calcular status da parcela dinamicamente (como na página de detalhes)
  const calcularStatusParcela = (dataVencimento: string, dataPagamento?: string) => {
    if (dataPagamento) {
      return 'PAGO'
    }

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const vencimento = new Date(dataVencimento)
    vencimento.setHours(0, 0, 0, 0)

    if (vencimento < hoje) {
      return 'ATRASADO'
    }

    return 'PENDENTE'
  }

  // Função para verificar se acordo está vencido (mesma lógica da página de detalhes)
  const isVencido = (acordo: Acordo) => {
    if (acordo.status !== 'ativo') return false

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    // Verificar se há parcelas vencidas (ATRASADO) - calculando dinamicamente
    const temParcelaVencida = (acordo.parcelas || []).some(parcela =>
      calcularStatusParcela(parcela.dataVencimento, parcela.pagamentos.length > 0 ? 'pago' : undefined) === 'ATRASADO'
    )

    // Verificar se há custas vencidas (custas com data de vencimento passada e sem data de pagamento)
    let temCustasVencida = false
    let custasDataVencimento = null
    let custasDataPagamento = null

    // Buscar detalhes de custas baseado no tipo de processo
    if (acordo.processo?.tipo === 'TRANSACAO_EXCEPCIONAL' && acordo.transacaoDetails) {
      custasDataVencimento = acordo.transacaoDetails.custasDataVencimento
      custasDataPagamento = acordo.transacaoDetails.custasDataPagamento
      if (acordo.transacaoDetails.custasAdvocaticias && acordo.transacaoDetails.custasAdvocaticias > 0) {
        if (custasDataVencimento && !custasDataPagamento) {
          const vencimentoCustas = new Date(custasDataVencimento)
          vencimentoCustas.setHours(0, 0, 0, 0)
          temCustasVencida = vencimentoCustas < hoje
        }
      }
    } else if (acordo.processo?.tipo === 'COMPENSACAO' && acordo.compensacaoDetails) {
      custasDataVencimento = acordo.compensacaoDetails.custasDataVencimento
      custasDataPagamento = acordo.compensacaoDetails.custasDataPagamento
      if (acordo.compensacaoDetails.custasAdvocaticias && acordo.compensacaoDetails.custasAdvocaticias > 0) {
        if (custasDataVencimento && !custasDataPagamento) {
          const vencimentoCustas = new Date(custasDataVencimento)
          vencimentoCustas.setHours(0, 0, 0, 0)
          temCustasVencida = vencimentoCustas < hoje
        }
      }
    } else if (acordo.processo?.tipo === 'DACAO_PAGAMENTO' && acordo.dacaoDetails) {
      custasDataVencimento = acordo.dacaoDetails.custasDataVencimento
      custasDataPagamento = acordo.dacaoDetails.custasDataPagamento
      if (acordo.dacaoDetails.custasAdvocaticias && acordo.dacaoDetails.custasAdvocaticias > 0) {
        if (custasDataVencimento && !custasDataPagamento) {
          const vencimentoCustas = new Date(custasDataVencimento)
          vencimentoCustas.setHours(0, 0, 0, 0)
          temCustasVencida = vencimentoCustas < hoje
        }
      }
    }

    return temParcelaVencida || temCustasVencida
  }

  // Filtragem local (client-side)
  const filteredAcordos = acordos.filter((acordo) => {
    // Filtro por texto de busca
    const searchMatch = !searchTerm ||
      acordo.processo?.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acordo.processo?.contribuinte?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acordo.id?.toLowerCase().includes(searchTerm.toLowerCase())

    // Filtro por status
    let statusMatch = true
    if (statusFilter === 'vencido') {
      // Filtro especial para acordos com parcelas/custas/honorários vencidos
      statusMatch = isVencido(acordo)
    } else if (statusFilter !== 'all') {
      statusMatch = acordo.status === statusFilter
    }

    // Filtro por tipo do processo
    const tipoMatch = tipoFilter === 'all' || acordo.processo?.tipo === tipoFilter

    // Filtro por modalidade de pagamento
    const modalidadeMatch = modalidadeFilter === 'all' || acordo.modalidadePagamento === modalidadeFilter

    return searchMatch && statusMatch && tipoMatch && modalidadeMatch
  })

  // Paginação local
  const totalFilteredAcordos = filteredAcordos.length
  const totalPages = Math.ceil(totalFilteredAcordos / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedAcordos = filteredAcordos.slice(startIndex, endIndex)

  // Reset para primeira página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, tipoFilter, modalidadeFilter])

  const canCreate = user?.role === 'ADMIN' || user?.role === 'FUNCIONARIO'

  // Função para formatar valores em moeda
  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    })
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

  // Função para calcular o valor correto do acordo baseado no tipo (usando mesma lógica dos cards)
  const getValorAcordo = (acordo: Acordo) => {
    const tipoProcesso = acordo.processo?.tipo

    // Para transação excepcional, usar a mesma lógica dos cards individuais
    if (tipoProcesso === 'TRANSACAO_EXCEPCIONAL') {
      const parcelas = acordo.parcelas || []

      // Calcular valor total das parcelas (acordo + honorários)
      const valorTotalParcelas = parcelas.reduce((total: number, parcela) => {
        return total + Number(parcela.valor || 0)
      }, 0)

      // Adicionar custas (se existir)
      const custasAdvocaticias = acordo.transacaoDetails?.custasAdvocaticias || 0
      return valorTotalParcelas + custasAdvocaticias
    }

    // Para compensação, usar mesma lógica dos cards individuais
    if (tipoProcesso === 'COMPENSACAO' && acordo.compensacaoDetails) {
      const valorCompensado = Number(acordo.compensacaoDetails.valorTotalDebitos || 0)
      const valorCustas = Number(acordo.compensacaoDetails.custasAdvocaticias || 0)
      const valorHonorarios = Number(acordo.compensacaoDetails.honorariosValor || 0)
      return valorCompensado + valorCustas + valorHonorarios
    }

    // Para dação, usar valor oferecido + custas + honorários (não o valor compensado)
    if (tipoProcesso === 'DACAO_PAGAMENTO' && acordo.dacaoDetails) {
      const valorOferecido = Number(acordo.dacaoDetails.valorTotalOferecido || 0)
      const valorCustas = Number(acordo.dacaoDetails.custasAdvocaticias || 0)
      const valorHonorarios = Number(acordo.dacaoDetails.honorariosValor || 0)
      return valorOferecido + valorCustas + valorHonorarios
    }

    // Fallback para valor final padrão
    return Number(acordo.valorFinal) || 0
  }

  // Estatísticas baseadas nos acordos filtrados
  const totalAcordos = totalFilteredAcordos
  const acordosAtivos = filteredAcordos.filter(a => a.status === 'ativo').length
  const acordosVencidos = filteredAcordos.filter(a => isVencido(a)).length

  const valorTotalAcordos = filteredAcordos
    .filter(acordo => acordo.status === 'ativo' || acordo.status === 'cumprido')
    .reduce((total, acordo) => {
      return total + getValorAcordo(acordo)
    }, 0)

  const getProgressoPagamento = (acordo: Acordo) => {
    const tipoProcesso = acordo.processo?.tipo

    // Para transação excepcional, usar a mesma lógica da página de detalhes
    if (tipoProcesso === 'TRANSACAO_EXCEPCIONAL') {
      const parcelas = acordo.parcelas || []

      // Calcular valor total das parcelas (acordo + honorários)
      const valorTotalParcelas = parcelas.reduce((total: number, parcela) => {
        return total + Number(parcela.valor || 0)
      }, 0)

      // Adicionar custas (se existir)
      const custasAdvocaticias = acordo.transacaoDetails?.custasAdvocaticias || 0
      const valorTotalGeral = valorTotalParcelas + custasAdvocaticias

      // Calcular valor pago de todas as parcelas (acordo + honorários)
      let valorPago = parcelas.reduce((total: number, parcela) => {
        const pagamentos = parcela.pagamentos || []
        return total + pagamentos.reduce((subtotal: number, pagamento) => {
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

    // Para compensação e dação, calcular como na página de detalhes
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
      valorTotal = getValorAcordo(acordo)
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
          valorPago += pagamentos.reduce((total: number, pagamento) => {
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

  const getDisplayParcelasInfo = (acordo: Acordo) => {
    const totalParcelas = (acordo.parcelas || []).length

    // Para transação excepcional, mostrar formato completo
    if (acordo.processo?.tipo === 'TRANSACAO_EXCEPCIONAL') {
      const parcelasRegulares = (acordo.parcelas || []).filter(p => p.tipoParcela === 'PARCELA_ACORDO').length
      const temEntrada = (acordo.parcelas || []).some(p => p.tipoParcela === 'ENTRADA')
      const temHonorarios = acordo.transacaoDetails?.honorariosValor && Number(acordo.transacaoDetails.honorariosValor) > 0
      const temCustas = acordo.transacaoDetails?.custasAdvocaticias && Number(acordo.transacaoDetails.custasAdvocaticias) > 0

      let resultado = ''

      if (temEntrada) {
        resultado += 'Entrada'
        if (parcelasRegulares > 0) {
          resultado += ` + ${parcelasRegulares} parcela${parcelasRegulares !== 1 ? 's' : ''}`
        }
      } else {
        resultado = `${parcelasRegulares} parcela${parcelasRegulares !== 1 ? 's' : ''}`
      }

      const extras = []
      if (temHonorarios) extras.push('Hon.')
      if (temCustas) extras.push('Cust.')

      if (extras.length > 0) {
        resultado += ` + ${extras.join('/')}`
      }

      return resultado
    }

    // Para compensação e dação, mostrar custas e honorários se existirem
    if (acordo.processo?.tipo === 'COMPENSACAO' || acordo.processo?.tipo === 'DACAO_PAGAMENTO') {
      const details = acordo.processo?.tipo === 'COMPENSACAO' ? acordo.compensacaoDetails : acordo.dacaoDetails

      if (details) {
        const temCustas = details.custasAdvocaticias && Number(details.custasAdvocaticias) > 0
        const temHonorarios = details.honorariosValor && Number(details.honorariosValor) > 0

        const extras = []
        if (temCustas) extras.push('Custas')
        if (temHonorarios) extras.push('Honorários')

        if (extras.length > 0) {
          return extras.join(' + ')
        }
      }

      // Se não há custas nem honorários, mostrar formato padrão
      return totalParcelas > 0 ? `${totalParcelas} parcela${totalParcelas !== 1 ? 's' : ''}` : 'Sem parcelas'
    }

    // Para outros tipos, mostrar formato padrão
    return `${totalParcelas} parcela${totalParcelas !== 1 ? 's' : ''}`
  }

  const getTotalPagamentos = (acordo: Acordo) => {
    // Contar pagamentos das parcelas - apenas de parcelas pagas
    const pagamentosParcelas = (acordo.parcelas || []).reduce((total, parcela) => {
      // Só contar pagamentos se a parcela estiver com status PAGO
      if (parcela.status === 'PAGO') {
        return total + (parcela.pagamentos?.length || 0)
      }
      return total
    }, 0)

    // Para transação excepcional, somar pagamentos de custas
    if (acordo.processo?.tipo === 'TRANSACAO_EXCEPCIONAL') {
      let totalPagamentos = pagamentosParcelas

      // Se custas foram pagas, conta como 1 pagamento
      if (acordo.transacaoDetails?.custasDataPagamento) {
        totalPagamentos += 1
      }

      return totalPagamentos
    }

    // Para compensação e dação, contar pagamentos de custas e honorários
    if (acordo.processo?.tipo === 'COMPENSACAO' || acordo.processo?.tipo === 'DACAO_PAGAMENTO') {
      let totalPagamentos = pagamentosParcelas
      const details = acordo.processo?.tipo === 'COMPENSACAO' ? acordo.compensacaoDetails : acordo.dacaoDetails

      if (details) {
        // Se custas foram pagas, conta como 1 pagamento
        if (details.custasDataPagamento) {
          totalPagamentos += 1
        }

        // Se honorários foram pagos (via data de pagamento), conta como 1 pagamento
        if (details.honorariosDataPagamento) {
          totalPagamentos += 1
        }
      }

      return totalPagamentos
    }

    return pagamentosParcelas
  }

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Acordos e Pagamentos</h1>
          <p className="text-gray-600">
            Gerencie os acordos de pagamento e acompanhe o cumprimento
          </p>
        </div>

        {canCreate && (
          <Link href="/acordos/novo">
            <Button className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              Novo Acordo
            </Button>
          </Link>
        )}
      </div>

      {/* Filtros e Busca */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por processo, contribuinte ou número do acordo..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="cursor-pointer"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="cumprido">Cumprido</SelectItem>
                      <SelectItem value="vencido">Vencido</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo do Processo</label>
                  <Select value={tipoFilter} onValueChange={setTipoFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="COMPENSACAO">Compensação</SelectItem>
                      <SelectItem value="DACAO_PAGAMENTO">Dação em Pagamento</SelectItem>
                      <SelectItem value="TRANSACAO_EXCEPCIONAL">Transação Excepcional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Modalidade</label>
                  <Select value={modalidadeFilter} onValueChange={setModalidadeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as modalidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as modalidades</SelectItem>
                      <SelectItem value="avista">À Vista</SelectItem>
                      <SelectItem value="parcelado">Parcelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('')
                      setStatusFilter('all')
                      setTipoFilter('all')
                      setModalidadeFilter('all')
                      toast.info('Filtros limpos')
                    }}
                    className="cursor-pointer"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Limpar Filtros
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Acordos</p>
                <p className="text-2xl font-bold">{totalAcordos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Ativos</p>
                <p className="text-2xl font-bold">{acordosAtivos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Vencidos</p>
                <p className="text-2xl font-bold">{acordosVencidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Total</p>
                <p className="text-2xl font-bold">
                  {valorTotalAcordos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Acordos */}
      <Card>
        <CardHeader>
          <CardTitle>Acordos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {totalFilteredAcordos === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <HandCoins className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {acordos.length === 0 ? 'Nenhum acordo encontrado' : 'Nenhum acordo corresponde aos filtros'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {acordos.length === 0 ? 'Comece criando seu primeiro acordo de pagamento.' : 'Tente ajustar os filtros ou criar um novo acordo.'}
                </p>
                {canCreate && (
                  <Link href="/acordos/novo">
                    <Button className="cursor-pointer">
                      <Plus className="mr-2 h-4 w-4" />
                      Criar Acordo
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                {paginatedAcordos.map((acordo) => {
                  const progresso = getProgressoPagamento(acordo)

                  return (
                    <Card key={acordo.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-3 flex-1">
                            {/* Cabeçalho do Acordo */}
                            <div className="flex items-center gap-3 flex-wrap">
                              <Link
                                href={`/processos/${acordo.processo?.id || ''}`}
                                className="font-semibold text-lg hover:text-blue-600 transition-colors"
                              >
                                {acordo.processo?.numero || 'Processo não encontrado'}
                              </Link>
                              <Badge className={getStatusColor(acordo.status)}>
                                {getStatusLabel(acordo.status)}
                              </Badge>
                              {isVencido(acordo) && (
                                <Badge className="bg-red-100 text-red-800">
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                  Vencido
                                </Badge>
                              )}
                              {/* Badge para tipo de processo */}
                              <Badge variant="outline" className={getTipoProcessoInfo(acordo.processo?.tipo || '').color}>
                                {getTipoProcessoInfo(acordo.processo?.tipo || '').label}
                              </Badge>
                            </div>

                            {/* Informações do Contribuinte */}
                            <div>
                              <p className="font-medium">{acordo.processo?.contribuinte?.nome || 'Contribuinte não encontrado'}</p>
                              <p className="text-sm text-gray-600">{acordo.processo?.contribuinte?.cpfCnpj ? formatarCpfCnpj(acordo.processo.contribuinte.cpfCnpj) : ''}</p>
                            </div>

                            {/* Valores e Progresso */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">
                                  {acordo.processo?.tipo === 'TRANSACAO_EXCEPCIONAL' ? 'Progresso do Pagamento' : 'Progresso do Acordo'}
                                </span>
                                <span className="font-medium">{progresso.percentual}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${progresso.percentual}%` }}
                                />
                              </div>
                              {acordo.processo?.tipo === 'TRANSACAO_EXCEPCIONAL' ? (
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-gray-500">Pago:</span>
                                    <p className="font-medium text-green-600">
                                      {formatarMoeda(progresso.valorPago)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Pendente:</span>
                                    <p className="font-medium text-amber-600">
                                      {formatarMoeda(progresso.valorPendente)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Total:</span>
                                    <p className="font-medium text-blue-600">
                                      {formatarMoeda(progresso.valorTotal)}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-4 gap-2 text-xs">
                                  <div>
                                    <span className="text-gray-500">
                                      {acordo.processo?.tipo === 'COMPENSACAO' ? 'Ofertado:' :
                                       acordo.processo?.tipo === 'DACAO_PAGAMENTO' ? 'Ofertado:' : 'Total:'}
                                    </span>
                                    <p className="font-medium text-green-600">
                                      {formatarMoeda(progresso.valorOfertado || progresso.valorTotal)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Compensado:</span>
                                    <p className="font-medium text-red-600">
                                      {formatarMoeda(progresso.valorCompensado || 0)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Cust./Hon.:</span>
                                    <p className="font-medium text-amber-600">
                                      {formatarMoeda(progresso.valorCustasHonorarios || 0)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Total:</span>
                                    <p className="font-medium text-blue-600">
                                      {formatarMoeda(progresso.valorTotal)}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Informações do Acordo */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>Assinado: {formatarData(acordo.dataAssinatura)}</span>
                              </div>
                              {acordo.processo?.tipo === 'TRANSACAO_EXCEPCIONAL' && (
                                <>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    <span>Vence: {formatarData(acordo.dataVencimento)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    <span>{getDisplayParcelasInfo(acordo)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" />
                                    <span>{getTotalPagamentos(acordo)} pagamento{getTotalPagamentos(acordo) !== 1 ? 's' : ''}</span>
                                  </div>
                                </>
                              )}
                              {(acordo.processo?.tipo === 'COMPENSACAO' || acordo.processo?.tipo === 'DACAO_PAGAMENTO') && (
                                <>
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    <span>{getDisplayParcelasInfo(acordo)}</span>
                                  </div>
                                  {getTotalPagamentos(acordo) > 0 && (
                                    <div className="flex items-center gap-2">
                                      <CreditCard className="h-4 w-4" />
                                      <span>{getTotalPagamentos(acordo)} pagamento{getTotalPagamentos(acordo) !== 1 ? 's' : ''}</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            {/* Próximas Parcelas - apenas para transação excepcional */}
                            {acordo.processo?.tipo === 'TRANSACAO_EXCEPCIONAL' && (acordo.parcelas || []).filter(p => p.status === 'pendente').length > 0 && (
                              <div className="border-t pt-3">
                                <h4 className="text-sm font-medium text-gray-900 mb-2">
                                  Próximas Parcelas:
                                </h4>
                                <div className="space-y-1">
                                  {(acordo.parcelas || [])
                                    .filter(p => p.status === 'pendente')
                                    .slice(0, 2)
                                    .map((parcela) => (
                                      <div key={parcela.id} className="text-sm flex items-center justify-between">
                                        <span>
                                          {parcela.numero === 0 ? 'Entrada' : `Parcela ${parcela.numero}`} - {formatarData(parcela.dataVencimento)}
                                        </span>
                                        <span className="font-medium">
                                          {formatarMoeda(parcela.valor)}
                                        </span>
                                      </div>
                                    ))}
                                  {(acordo.parcelas || []).filter(p => p.status === 'pendente').length > 2 && (
                                    <div className="text-xs text-gray-500">
                                      ... e mais {(acordo.parcelas || []).filter(p => p.status === 'pendente').length - 2} parcela{(acordo.parcelas || []).filter(p => p.status === 'pendente').length - 2 !== 1 ? 's' : ''}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Ações */}
                          <div className="flex flex-col gap-2 ml-4">
                            <Link href={`/acordos/${acordo.id}`}>
                              <Button variant="outline" size="sm" className="w-full cursor-pointer">
                                Ver Detalhes
                              </Button>
                            </Link>

                            <Link href={`/processos/${acordo.processo?.id || ''}`}>
                              <Button variant="ghost" size="sm" className="w-full cursor-pointer">
                                Ver Processo
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}

                {/* Paginação */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalFilteredAcordos}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Acordos Vencidos */}
      {acordosVencidos > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Acordos Vencidos
            </CardTitle>
            <CardDescription>
              Acordos que precisam de atenção urgente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredAcordos
                .filter(a => isVencido(a))
                .slice(0, 3)
                .map((acordo) => {
                  const progresso = getProgressoPagamento(acordo)
                  const diasVencido = Math.floor((new Date().getTime() - new Date(acordo.dataVencimento).getTime()) / (1000 * 60 * 60 * 24))

                  return (
                    <div key={acordo.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Link
                          href={`/acordos/${acordo.id}`}
                          className="font-medium hover:text-blue-600"
                        >
                          {acordo.processo?.numero || 'Processo não encontrado'}
                        </Link>
                        <p className="text-sm text-gray-600">
                          {acordo.processo?.contribuinte?.nome || 'Contribuinte não encontrado'} • Vencido há {diasVencido} dia{diasVencido !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-red-100 text-red-800">
                          Vencido
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          Pendente: {formatarMoeda(progresso.valorPendente)}
                        </p>
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
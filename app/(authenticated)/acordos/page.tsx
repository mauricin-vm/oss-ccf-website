'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  X
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'
import { formatarCpfCnpj } from '@/lib/utils'
import { getTipoProcessoInfo } from '@/lib/constants/tipos-processo'

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
    pagamentos: Array<{
      id: string
      valorPago: number
    }>
  }>
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
    } catch (error) {
      console.error('Erro ao carregar acordos:', error)
      setAcordos([])
    } finally {
      setLoading(false)
    }
  }

  // Filtragem local (client-side)
  const filteredAcordos = acordos.filter((acordo) => {
    // Filtro por texto de busca
    const searchMatch = !searchTerm ||
      acordo.processo?.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acordo.processo?.contribuinte?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acordo.id?.toLowerCase().includes(searchTerm.toLowerCase())

    // Filtro por status
    const statusMatch = statusFilter === 'all' || acordo.status === statusFilter

    // Filtro por tipo do processo
    const tipoMatch = tipoFilter === 'all' || acordo.processo?.tipo === tipoFilter

    // Filtro por modalidade de pagamento
    const modalidadeMatch = modalidadeFilter === 'all' || acordo.modalidadePagamento === modalidadeFilter

    return searchMatch && statusMatch && tipoMatch && modalidadeMatch
  })

  const canCreate = user?.role === 'ADMIN' || user?.role === 'FUNCIONARIO'

  // Função para formatar valores em moeda
  const formatarMoeda = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    })
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

  // Função para calcular o valor correto do acordo baseado no tipo
  const getValorAcordo = (acordo: Acordo) => {
    const tipoProcesso = acordo.processo?.tipo

    // Para transação excepcional, usar valorFinal padrão
    if (tipoProcesso === 'TRANSACAO_EXCEPCIONAL') {
      return Number(acordo.valorFinal) || 0
    }

    // Para compensação e dação, calcular baseado nos detalhes
    if (!acordo.detalhes || acordo.detalhes.length === 0) {
      return Number(acordo.valorFinal) || 0
    }

    let valorTotal = 0

    acordo.detalhes.forEach((detalhe) => {
      if (detalhe.tipo === 'compensacao') {
        // Para compensação: extrair valor total dos créditos das observações
        try {
          const observacoes = detalhe.observacoes
          if (observacoes) {
            const dadosCreditos = JSON.parse(observacoes)
            if (dadosCreditos.valorTotalCreditos) {
              valorTotal += Number(dadosCreditos.valorTotalCreditos || 0)
            }
          }
        } catch {
          // Se não conseguir fazer parse, usar valor original como fallback
          valorTotal += Number(detalhe.valorOriginal || 0)
        }
      } else if (detalhe.tipo === 'dacao') {
        // Para dação: usar valor avaliado do imóvel
        if (detalhe.imovel && detalhe.imovel.valorAvaliado) {
          valorTotal += Number(detalhe.imovel.valorAvaliado || 0)
        } else {
          // Fallback para valor original
          valorTotal += Number(detalhe.valorOriginal || 0)
        }
      }
    })

    return valorTotal > 0 ? valorTotal : Number(acordo.valorFinal) || 0
  }

  // Estatísticas baseadas nos acordos filtrados
  const totalAcordos = filteredAcordos.length
  const acordosAtivos = filteredAcordos.filter(a => a.status === 'ativo').length
  const acordosVencidos = filteredAcordos.filter(a => {
    const hoje = new Date()
    return a.status === 'ativo' && new Date(a.dataVencimento) < hoje
  }).length

  const valorTotalAcordos = filteredAcordos
    .filter(acordo => acordo.status === 'ativo' || acordo.status === 'cumprido')
    .reduce((total, acordo) => {
      return total + getValorAcordo(acordo)
    }, 0)

  const getProgressoPagamento = (acordo: Acordo) => {
    const tipoProcesso = acordo.processo?.tipo
    const valorTotal = getValorAcordo(acordo)

    // Para transação excepcional, calcular progresso baseado em pagamentos
    if (tipoProcesso === 'TRANSACAO_EXCEPCIONAL') {
      const valorPago = (acordo.parcelas || []).reduce((total: number, parcela) => {
        return total + (parcela.pagamentos || []).reduce((subtotal: number, pagamento) => {
          return subtotal + (Number(pagamento.valorPago) || 0)
        }, 0)
      }, 0)
      const percentual = valorTotal > 0 ? Math.round((valorPago / valorTotal) * 100) : 0

      return {
        valorTotal,
        valorPago,
        valorPendente: valorTotal - valorPago,
        percentual
      }
    }

    // Para compensação e dação, progresso baseado no status
    if (acordo.status === 'cumprido') {
      return {
        valorTotal,
        valorPago: valorTotal,
        valorPendente: 0,
        percentual: 100
      }
    }

    return {
      valorTotal,
      valorPago: 0,
      valorPendente: valorTotal,
      percentual: 0
    }
  }


  const isVencido = (dataVencimento: Date) => {
    return new Date(dataVencimento) < new Date()
  }

  const getDisplayParcelasInfo = (acordo: Acordo) => {
    const totalParcelas = (acordo.parcelas || []).length

    // Para transação excepcional parcelada, mostrar "Entrada + x parcelas"
    if (acordo.processo?.tipo === 'TRANSACAO_EXCEPCIONAL' && acordo.modalidadePagamento === 'parcelado' && totalParcelas > 1) {
      const parcelasRestantes = totalParcelas - 1 // Excluir a entrada
      return `Entrada + ${parcelasRestantes} parcela${parcelasRestantes !== 1 ? 's' : ''}`
    }

    // Para outros tipos, mostrar formato padrão
    return `${totalParcelas} parcela${totalParcelas !== 1 ? 's' : ''}`
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
                      <SelectItem value="renegociado">Renegociado</SelectItem>
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
      <div className="space-y-4">
        {filteredAcordos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
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
            </CardContent>
          </Card>
        ) : (
          filteredAcordos.map((acordo) => {
            const progresso = getProgressoPagamento(acordo)
            const vencido = isVencido(new Date(acordo.dataVencimento))

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
                        {vencido && acordo.status === 'ativo' && (
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
                              <span className="text-gray-500">Total:</span>
                              <p className="font-medium">
                                {formatarMoeda(progresso.valorTotal)}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Pago:</span>
                              <p className="font-medium text-green-600">
                                {formatarMoeda(progresso.valorPago)}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Pendente:</span>
                              <p className="font-medium text-yellow-600">
                                {formatarMoeda(progresso.valorPendente)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">
                                {acordo.processo?.tipo === 'COMPENSACAO' ? 'Valor dos Créditos:' :
                                  acordo.processo?.tipo === 'DACAO_PAGAMENTO' ? 'Valor do Imóvel:' : 'Valor Total:'}
                              </span>
                              <p className="font-medium">
                                {formatarMoeda(progresso.valorTotal)}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500">Status:</span>
                              <p className={`font-medium ${acordo.status === 'cumprido' ? 'text-green-600' : acordo.status === 'ativo' ? 'text-yellow-600' : 'text-red-600'}`}>
                                {getStatusLabel(acordo.status)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Informações do Acordo */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Assinado: {new Date(acordo.dataAssinatura).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {acordo.processo?.tipo === 'TRANSACAO_EXCEPCIONAL' && (
                          <>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>Vence: {new Date(acordo.dataVencimento).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span>{getDisplayParcelasInfo(acordo)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              <span>{(acordo.parcelas || []).reduce((total, p) => total + (p.pagamentos?.length || 0), 0)} pagamento{(acordo.parcelas || []).reduce((total, p) => total + (p.pagamentos?.length || 0), 0) !== 1 ? 's' : ''}</span>
                            </div>
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
                                    {parcela.numero === 0 ? 'Entrada' : `Parcela ${parcela.numero}`} - {new Date(parcela.dataVencimento).toLocaleDateString('pt-BR')}
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
          })
        )}
      </div>

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
                .filter(a => a.status === 'ativo' && isVencido(new Date(a.dataVencimento)))
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
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import {
  Plus,
  Search,
  Gavel,
  Users,
  Clock,
  CheckCircle,
  Calendar,
  FileText,
  Filter,
  X
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'
import { getResultadoBadge } from '@/lib/constants/status'
import { toast } from 'sonner'

interface Sessao {
  id: string
  dataInicio: string
  dataFim?: string
  ata?: string
  tipoSessao?: string
  agenda?: string
  pauta?: {
    id: string
    numero: string
    processos: Array<{
      processo: {
        id: string
        numero: string
        contribuinte: {
          nome: string
        }
      }
    }>
  } | null
  decisoes: Array<{
    id: string
    tipoResultado: 'SUSPENSO' | 'PEDIDO_VISTA' | 'PEDIDO_DILIGENCIA' | 'EM_NEGOCIACAO' | 'JULGADO'
    tipoDecisao?: 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL'
    processo: {
      id: string
      numero: string
      contribuinte: {
        nome: string
      }
    }
  }>
  conselheiros: Array<{
    id: string
    nome: string
    email: string
    cargo: string
  }>
}

export default function SessoesPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser

  const [sessoes, setSessoes] = useState<Sessao[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(15)

  // Carregamento inicial - buscar todas as sessões
  useEffect(() => {
    loadAllSessoes()
  }, [])

  const loadAllSessoes = async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/sessoes?limit=1000', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar sessões')
      }

      const data = await response.json()
      setSessoes(data.sessoes || [])
    } catch (error) {
      console.error('Erro ao carregar sessões:', error)
      toast.error('Erro ao carregar dados das sessões')
      setSessoes([])
    } finally {
      setLoading(false)
    }
  }

  // Filtragem local (client-side)
  const filteredSessoes = sessoes.filter((sessao) => {
    // Filtro por texto de busca
    const searchMatch = !searchTerm ||
      (sessao.pauta?.numero?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      sessao.conselheiros.some(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sessao.pauta?.processos?.some(p =>
        p.processo.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.processo.contribuinte.nome.toLowerCase().includes(searchTerm.toLowerCase())
      )) ||
      (sessao.ata && sessao.ata.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sessao.agenda && sessao.agenda.toLowerCase().includes(searchTerm.toLowerCase()))

    // Filtro por status
    const statusMatch = statusFilter === 'all' ||
      (statusFilter === 'abertas' && !sessao.dataFim) ||
      (statusFilter === 'fechadas' && sessao.dataFim)

    return searchMatch && statusMatch
  })

  // Paginação local
  const totalFilteredSessoes = filteredSessoes.length
  const totalPages = Math.ceil(totalFilteredSessoes / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSessoes = filteredSessoes.slice(startIndex, endIndex)

  // Reset para primeira página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  const canCreate = user?.role === 'ADMIN' || user?.role === 'FUNCIONARIO'

  // Estatísticas baseadas nas sessões filtradas
  const totalSessoes = totalFilteredSessoes
  const sessoesAbertas = filteredSessoes.filter(s => !s.dataFim).length
  const sessoesFechadas = filteredSessoes.filter(s => s.dataFim).length
  const totalDecisoes = filteredSessoes.reduce((total, s) => total + s.decisoes.length, 0)

  const getStatusSessao = (sessao: Sessao) => {
    if (sessao.dataFim) {
      return {
        label: 'Finalizada',
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle
      }
    } else {
      return {
        label: 'Em Andamento',
        color: 'bg-yellow-100 text-yellow-800',
        icon: Clock
      }
    }
  }

  const getDuracaoSessao = (dataInicio: string, dataFim?: string) => {
    const inicio = new Date(dataInicio)
    const fim = dataFim ? new Date(dataFim) : new Date()

    const diffMs = fim.getTime() - inicio.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`
    } else {
      return `${diffMinutes}m`
    }
  }

  const getProgressoJulgamento = (sessao: Sessao) => {
    const totalProcessos = sessao.pauta?.processos.length || 0
    const processosJulgados = sessao.decisoes.length
    const percentual = totalProcessos > 0 ? Math.round((processosJulgados / totalProcessos) * 100) : 100

    return {
      total: totalProcessos,
      julgados: processosJulgados,
      pendentes: totalProcessos - processosJulgados,
      percentual
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sessões</h1>
          <p className="text-gray-600">
            Gerencie as sessões da CCF
          </p>
        </div>

        {canCreate && (
          <Link href="/sessoes/nova">
            <Button className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              Nova Sessão
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
                    placeholder="Buscar por pauta, conselheiro, contribuinte..."
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="abertas">Em Andamento</SelectItem>
                      <SelectItem value="fechadas">Finalizadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('')
                      setStatusFilter('all')
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
              <Gavel className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sessões</p>
                <p className="text-2xl font-bold">{totalSessoes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Em Andamento</p>
                <p className="text-2xl font-bold">{sessoesAbertas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Finalizadas</p>
                <p className="text-2xl font-bold">{sessoesFechadas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Resultados</p>
                <p className="text-2xl font-bold">{totalDecisoes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Sessões */}
      <Card>
        <CardHeader>
          <CardTitle>Sessões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {totalFilteredSessoes === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Gavel className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {sessoes.length === 0 ? 'Nenhuma sessão encontrada' : 'Nenhuma sessão corresponde aos filtros'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {sessoes.length === 0 ? 'Comece criando sua primeira sessão.' : 'Tente ajustar os filtros ou criar uma nova sessão.'}
                </p>
                {canCreate && (
                  <Link href="/sessoes/nova">
                    <Button className="cursor-pointer">
                      <Plus className="mr-2 h-4 w-4" />
                      Criar Sessão
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                {paginatedSessoes.map((sessao) => {
                  const status = getStatusSessao(sessao)
                  const StatusIcon = status.icon
                  const progresso = getProgressoJulgamento(sessao)
                  const duracao = getDuracaoSessao(sessao.dataInicio, sessao.dataFim)

                  return (
                    <Card key={sessao.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-3 flex-1">
                            {/* Cabeçalho da Sessão */}
                            <div className="flex items-center gap-3">
                              {sessao.pauta ? (
                                <Link
                                  href={`/pautas/${sessao.pauta.id}`}
                                  className="font-semibold text-lg hover:text-blue-600 transition-colors"
                                >
                                  {sessao.pauta.numero}
                                </Link>
                              ) : (
                                <span className="font-semibold text-lg text-green-700">
                                  Sessão Administrativa
                                </span>
                              )}
                              <Badge className={status.color}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {status.label}
                              </Badge>
                              <Badge variant="outline">
                                {new Date(sessao.dataInicio).toLocaleDateString('pt-BR')}
                              </Badge>
                            </div>

                            {/* Progresso do Julgamento ou Informações da Sessão Administrativa */}
                            {sessao.pauta ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">Progresso do Julgamento</span>
                                  <span className="font-medium">{progresso.percentual}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progresso.percentual}%` }}
                                  />
                                </div>
                                <div className="text-xs text-gray-500">
                                  {progresso.julgados} de {progresso.total} processos analisados
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {sessao.agenda && (
                                  <div className="text-sm text-gray-600">
                                    <p className="line-clamp-2">{sessao.agenda}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Informações da Sessão */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>Iniciada: {new Date(sessao.dataInicio).toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>Duração: {duracao}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span>{sessao.conselheiros.length} conselheiro{sessao.conselheiros.length !== 1 ? 's' : ''}</span>
                              </div>
                              {sessao.pauta && (
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  <span>{sessao.decisoes.length} {sessao.decisoes.length !== 1 ? 'resultados' : 'resultado'}</span>
                                </div>
                              )}
                            </div>

                            {/* Últimas Decisões */}
                            {sessao.decisoes.length > 0 && (
                              <div className="border-t pt-3">
                                <h4 className="text-sm font-medium text-gray-900 mb-2">
                                  Últimos Resultados:
                                </h4>
                                <div className="space-y-1">
                                  {sessao.decisoes.slice(0, 2).map((decisao) => {
                                    const badge = getResultadoBadge(decisao.tipoResultado, decisao.tipoDecisao)
                                    return (
                                      <div key={decisao.id} className="text-sm flex items-center justify-between">
                                        <Link
                                          href={`/processos/${decisao.processo.id}`}
                                          className="text-blue-600 hover:text-blue-800"
                                        >
                                          {decisao.processo.numero}
                                        </Link>
                                        <Badge className={badge.color}>
                                          {badge.label}
                                        </Badge>
                                      </div>
                                    )
                                  })}
                                  {sessao.decisoes.length > 2 && (
                                    <div className="text-xs text-gray-500">
                                      ... e mais {sessao.decisoes.length - 2} {sessao.decisoes.length - 2 !== 1 ? 'resultados' : 'resultado'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Ata da Sessão */}
                            {sessao.ata && (
                              <div className="bg-gray-50 p-3 rounded-lg">
                                <h5 className="text-sm font-medium mb-1">Ata:</h5>
                                <p className="text-sm text-gray-700 line-clamp-2">{sessao.ata}</p>
                              </div>
                            )}
                          </div>

                          {/* Ações */}
                          <div className="flex flex-col gap-2 ml-4">
                            <Link href={`/sessoes/${sessao.id}`}>
                              <Button variant="outline" size="sm" className="w-full cursor-pointer">
                                Ver Detalhes
                              </Button>
                            </Link>

                            {sessao.pauta && (
                              <Link href={`/pautas/${sessao.pauta.id}`}>
                                <Button variant="ghost" size="sm" className="w-full cursor-pointer">
                                  Ver Pauta
                                </Button>
                              </Link>
                            )}

                            {!sessao.dataFim && canCreate && sessao.pauta && progresso.pendentes > 0 && (
                              <Link href={`/sessoes/${sessao.id}/decisoes/nova`}>
                                <Button size="sm" className="w-full cursor-pointer">
                                  <Gavel className="mr-1 h-3 w-3" />
                                  Julgar
                                </Button>
                              </Link>
                            )}

                            {!sessao.dataFim && canCreate && ((sessao.pauta && progresso.pendentes === 0) || !sessao.pauta) && (
                              <Button size="sm" className="w-full cursor-pointer" variant="secondary">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Finalizar
                              </Button>
                            )}
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
                  totalItems={totalFilteredSessoes}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sessões em Andamento */}
      {sessoesAbertas > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Sessões em Andamento
            </CardTitle>
            <p className="text-gray-600 text-sm">
              Sessões que precisam de atenção
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredSessoes
                .filter(s => !s.dataFim)
                .slice(0, 3)
                .map((sessao) => {
                  const progresso = getProgressoJulgamento(sessao)
                  const duracao = getDuracaoSessao(sessao.dataInicio)

                  return (
                    <div key={sessao.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Link
                          href={`/sessoes/${sessao.id}`}
                          className="font-medium hover:text-blue-600"
                        >
                          {sessao.pauta?.numero || 'Sessão Administrativa'}
                        </Link>
                        <p className="text-sm text-gray-600">
                          {sessao.pauta ? `${progresso.julgados}/${progresso.total} processos • ${duracao}` : `Sessão administrativa • ${duracao}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-yellow-100 text-yellow-800">
                          Em Andamento
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {progresso.percentual}% concluído
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
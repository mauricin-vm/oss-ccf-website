'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import {
  Wallet,
  ArrowLeft,
  Calendar,
  DollarSign,
  Users,
  FileText,
  Download,
  Edit,
  CheckCircle,
  Clock,
  TrendingUp,
  Search,
  Filter,
  X
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import GerenciarJetonModal from './components/gerenciar-jeton-modal'

interface Conselheiro {
  id: string
  nome: string
  email?: string
  cargo?: string
}

interface Sessao {
  id: string
  dataInicio: string
  dataFim: string | null
  numeroAta: string | null
  tipoSessao: string
  pauta?: {
    id: string
    numero: string
    dataPauta: string
  } | null
  conselheiros: Conselheiro[]
  presidente?: {
    id: string
    nome: string
  } | null
  folhaJeton?: {
    id: string
    status: 'PENDENTE' | 'ENTREGUE'
    dataEntrega: string | null
    membros: Array<{
      id: string
      conselheiroId: string
      valorJeton: number
      presente: boolean
      conselheiro: Conselheiro
    }>
  } | null
  valorTotalDiscutido: number
  valorTotalJetons: number
  quantidadeMembros: number
}

export default function ControleJetonsPage() {
  const [sessoes, setSessoes] = useState<Sessao[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSessao, setSelectedSessao] = useState<Sessao | null>(null)
  const [showGerenciarModal, setShowGerenciarModal] = useState(false)

  // Estados para filtros e busca
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [tipoSessaoFilter, setTipoSessaoFilter] = useState('all')
  const [statusFolhaFilter, setStatusFolhaFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)

  // Carregar sessões
  const loadSessoes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/folhas-jeton')
      if (!response.ok) throw new Error('Erro ao carregar sessões')
      const data = await response.json()
      setSessoes(data.sessoes || [])
    } catch (error) {
      toast.error('Erro ao carregar sessões')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessoes()
  }, [])

  // Reset para primeira página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, tipoSessaoFilter, statusFolhaFilter])

  // Abrir modal de gerenciamento
  const handleGerenciar = (sessao: Sessao) => {
    setSelectedSessao(sessao)
    setShowGerenciarModal(true)
  }

  // Baixar documento Word
  const handleBaixar = async (sessao: Sessao) => {
    if (!sessao.folhaJeton) {
      toast.error('É necessário configurar a folha de jeton antes de baixar')
      return
    }

    try {
      toast.loading('Gerando documento...')
      const response = await fetch(`/api/folhas-jeton/${sessao.folhaJeton.id}/download`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao gerar documento')
      }

      // Pegar o arquivo como blob
      const blob = await response.blob()

      // Criar URL temporária
      const url = window.URL.createObjectURL(blob)

      // Criar link de download
      const a = document.createElement('a')
      a.href = url

      // Pegar nome do arquivo do header Content-Disposition ou usar nome padrão
      const contentDisposition = response.headers.get('Content-Disposition')
      const fileName = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : 'folha-jeton.docx'

      a.download = fileName
      document.body.appendChild(a)
      a.click()

      // Limpar
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.dismiss()
      toast.success('Documento baixado com sucesso!')
    } catch (error) {
      toast.dismiss()
      const errorMessage = error instanceof Error ? error.message : 'Erro ao baixar documento'
      toast.error(errorMessage)
      console.error('Erro:', error)
    }
  }

  // Filtragem local (client-side)
  const filteredSessoes = sessoes.filter((sessao) => {
    // Filtro por texto de busca
    const searchMatch = !searchTerm ||
      (sessao.pauta?.numero.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sessao.numeroAta?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sessao.presidente?.nome.toLowerCase().includes(searchTerm.toLowerCase()))

    // Filtro por tipo de sessão
    const tipoMatch = tipoSessaoFilter === 'all' || sessao.tipoSessao === tipoSessaoFilter

    // Filtro por status de folha
    let statusMatch = true
    if (statusFolhaFilter === 'SEM_FOLHA') {
      statusMatch = !sessao.folhaJeton
    } else if (statusFolhaFilter === 'PENDENTE') {
      statusMatch = sessao.folhaJeton?.status === 'PENDENTE'
    } else if (statusFolhaFilter === 'ENTREGUE') {
      statusMatch = sessao.folhaJeton?.status === 'ENTREGUE'
    }

    return searchMatch && tipoMatch && statusMatch
  })

  // Paginação local
  const totalFilteredSessoes = filteredSessoes.length
  const totalPages = Math.ceil(totalFilteredSessoes / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedSessoes = filteredSessoes.slice(startIndex, endIndex)

  // Estatísticas gerais (baseadas nas sessões filtradas)
  const stats = {
    totalSessoes: filteredSessoes.length,
    sessoesComFolha: filteredSessoes.filter(s => s.folhaJeton).length,
    folhasPendentes: filteredSessoes.filter(s => s.folhaJeton?.status === 'PENDENTE').length,
    folhasEntregues: filteredSessoes.filter(s => s.folhaJeton?.status === 'ENTREGUE').length,
    valorTotalDiscutido: filteredSessoes.reduce((sum, s) => sum + s.valorTotalDiscutido, 0),
    valorTotalJetons: filteredSessoes.reduce((sum, s) => sum + s.valorTotalJetons, 0)
  }

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/ferramentas">
          <Button variant="outline" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-green-600" />
            <h1 className="text-3xl font-bold">Controle de Jetons</h1>
          </div>
          <p className="text-gray-600">Gerencie folhas de jeton por sessão</p>
        </div>
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
                    placeholder="Buscar por número de pauta, ata, presidente..."
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo de Sessão</label>
                  <Select value={tipoSessaoFilter} onValueChange={setTipoSessaoFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="JULGAMENTO">Julgamento</SelectItem>
                      <SelectItem value="ADMINISTRATIVA">Administrativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Status da Folha</label>
                  <Select value={statusFolhaFilter} onValueChange={setStatusFolhaFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="SEM_FOLHA">Sem Folha</SelectItem>
                      <SelectItem value="PENDENTE">Pendente</SelectItem>
                      <SelectItem value="ENTREGUE">Entregue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('')
                      setTipoSessaoFilter('all')
                      setStatusFolhaFilter('all')
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Sessões</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSessoes}</div>
            <p className="text-xs text-muted-foreground">
              {stats.sessoesComFolha} com folha configurada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Folhas Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.folhasPendentes}</div>
            <p className="text-xs text-muted-foreground">Aguardando entrega</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Folhas Entregues</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.folhasEntregues}</div>
            <p className="text-xs text-muted-foreground">Já entregues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Discutido</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-600">
              {new Intl.NumberFormat('pt-BR', {
                notation: 'compact',
                maximumFractionDigits: 1
              }).format(stats.valorTotalDiscutido)}
            </div>
            <p className="text-xs text-muted-foreground">Em todas as sessões</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Sessões */}
      <Card>
        <CardHeader>
          <CardTitle>Sessões</CardTitle>
          <CardDescription>
            Clique em &quot;Gerenciar&quot; para configurar a folha de jeton ou visualizar detalhes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {totalFilteredSessoes === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {sessoes.length === 0
                  ? 'Nenhuma sessão encontrada'
                  : 'Nenhuma sessão corresponde aos filtros aplicados'}
              </div>
            ) : (
              <>
              {paginatedSessoes.map((sessao) => {
                const statusFolha = sessao.folhaJeton
                  ? sessao.folhaJeton.status === 'ENTREGUE'
                    ? { label: 'Entregue', color: 'bg-green-100 text-green-800', icon: CheckCircle }
                    : { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock }
                  : { label: 'Não Configurado', color: 'bg-gray-100 text-gray-800', icon: FileText }

                const StatusIcon = statusFolha.icon
                const mediaValor = sessao.quantidadeMembros > 0
                  ? sessao.valorTotalDiscutido / sessao.quantidadeMembros
                  : 0

                return (
                  <div
                    key={sessao.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Informações da Sessão */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">
                            {sessao.pauta ? (
                              sessao.pauta.numero
                            ) : (
                              `Sessão ${sessao.tipoSessao === 'ADMINISTRATIVA' ? 'Administrativa' : 'de Julgamento'}`
                            )}
                          </h3>
                          <Badge className={statusFolha.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusFolha.label}
                          </Badge>
                          {!sessao.dataFim && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              Em Andamento
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="flex items-center gap-1 text-gray-600">
                              <Calendar className="h-3 w-3" />
                              <span>Data</span>
                            </div>
                            <p className="font-medium">
                              {new Date(sessao.dataInicio).toLocaleDateString('pt-BR')}
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center gap-1 text-gray-600">
                              <Users className="h-3 w-3" />
                              <span>Membros</span>
                            </div>
                            <p className="font-medium">
                              {sessao.folhaJeton
                                ? sessao.folhaJeton.membros.filter(m => m.presente).length
                                : sessao.quantidadeMembros} presentes
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center gap-1 text-gray-600">
                              <DollarSign className="h-3 w-3" />
                              <span>Valor Discutido</span>
                            </div>
                            <p className="font-medium text-blue-600">
                              {new Intl.NumberFormat('pt-BR', {
                                notation: 'compact',
                                maximumFractionDigits: 1
                              }).format(sessao.valorTotalDiscutido)}
                            </p>
                          </div>

                          <div>
                            <div className="flex items-center gap-1 text-gray-600">
                              <Wallet className="h-3 w-3" />
                              <span>Total Jetons</span>
                            </div>
                            <p className="font-medium text-green-600">
                              {sessao.folhaJeton
                                ? new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                  }).format(sessao.valorTotalJetons)
                                : 'Não configurado'}
                            </p>
                          </div>
                        </div>

                        {/* Média de valor por membro */}
                        {sessao.valorTotalDiscutido > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-xs text-gray-600">
                              Média de valor discutido por membro:{' '}
                              <span className="font-semibold text-blue-600">
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                }).format(mediaValor)}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleGerenciar(sessao)}
                          className="cursor-pointer"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Gerenciar
                        </Button>
                        {sessao.folhaJeton && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBaixar(sessao)}
                            className="cursor-pointer"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Baixar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
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

      {/* Modal de Gerenciamento */}
      {showGerenciarModal && selectedSessao && (
        <GerenciarJetonModal
          sessao={selectedSessao}
          open={showGerenciarModal}
          onClose={() => {
            setShowGerenciarModal(false)
            setSelectedSessao(null)
          }}
          onSuccess={() => {
            loadSessoes()
            setShowGerenciarModal(false)
            setSelectedSessao(null)
          }}
        />
      )}
    </div>
  )
}

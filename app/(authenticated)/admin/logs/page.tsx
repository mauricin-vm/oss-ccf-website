'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Activity,
  Search,
  Calendar,
  User,
  Database,
  Filter,
  Eye,
  X
} from 'lucide-react'
import { SessionUser } from '@/types'
import { toast } from 'sonner'

interface LogEntry {
  id: string
  acao: string
  entidade: string
  entidadeId: string
  dadosAnteriores?: Record<string, unknown>
  dadosNovos?: Record<string, unknown>
  ip?: string
  userAgent?: string
  createdAt: string
  usuario: {
    id: string
    name: string
    email: string
  }
}

interface LogsResponse {
  logs: LogEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  statistics: {
    totalLogs: number
    logsLast24h: number
    uniqueUsers: number
    criticalActions: number
    uniqueActions: string[]
    uniqueEntities: string[]
  }
}

export default function LogsAdminPage() {
  const { data: session, status } = useSession()
  const [allLogs, setAllLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [acaoFilter, setAcaoFilter] = useState('all')
  const [entidadeFilter, setEntidadeFilter] = useState('all')
  const [usuarioFilter, setUsuarioFilter] = useState('')
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50)
  const [statistics, setStatistics] = useState({
    totalLogs: 0,
    logsLast24h: 0,
    uniqueUsers: 0,
    criticalActions: 0,
    uniqueActions: [] as string[],
    uniqueEntities: [] as string[]
  })

  // Verificar se é admin
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirect('/login')
    }
    const user = session.user as SessionUser
    if (user.role !== 'ADMIN') {
      redirect('/dashboard')
    }
  }, [session, status])

  // Carregamento inicial - buscar todos os logs
  useEffect(() => {
    loadAllLogs()
  }, [])

  const loadAllLogs = async () => {
    try {
      setLoading(true)

      // Buscar todos os logs sem filtros
      const response = await fetch('/api/logs?limit=10000')

      if (!response.ok) {
        throw new Error('Erro ao carregar logs')
      }

      const data: LogsResponse = await response.json()
      setAllLogs(data.logs)
      setStatistics(data.statistics)
    } catch (error) {
      console.error('Erro ao carregar logs:', error)
      toast.error('Erro ao carregar a lista de logs')
      setAllLogs([])
    } finally {
      setLoading(false)
    }
  }

  // Filtragem local (client-side)
  const filteredLogs = allLogs.filter((log) => {
    // Filtro por texto de busca
    const searchMatch = !searchTerm ||
      log.acao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entidadeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.usuario.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.usuario.email.toLowerCase().includes(searchTerm.toLowerCase())

    // Filtro por ação
    const acaoMatch = acaoFilter === 'all' || log.acao === acaoFilter

    // Filtro por entidade
    const entidadeMatch = entidadeFilter === 'all' || log.entidade === entidadeFilter

    // Filtro por usuário
    const usuarioMatch = !usuarioFilter ||
      log.usuario.name.toLowerCase().includes(usuarioFilter.toLowerCase()) ||
      log.usuario.email.toLowerCase().includes(usuarioFilter.toLowerCase())

    return searchMatch && acaoMatch && entidadeMatch && usuarioMatch
  })

  // Paginação local
  const totalFilteredLogs = filteredLogs.length
  const totalPages = Math.ceil(totalFilteredLogs / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex)

  // Reset para primeira página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, acaoFilter, entidadeFilter, usuarioFilter])

  const getActionLabel = (acao: string) => {
    const labels: Record<string, string> = {
      CREATE: 'Criação',
      UPDATE: 'Atualização',
      DELETE: 'Exclusão',
      LOGIN: 'Login',
      LOGOUT: 'Logout',
      VIEW: 'Visualização',
      EXPORT: 'Exportação',
      DOWNLOAD: 'Download',
      MIGRATE: 'Migração',
      MIGRATE_HISTORY: 'Migração'
    }
    return labels[acao] || acao
  }

  const getActionColor = (acao: string) => {
    const colors: Record<string, string> = {
      CREATE: 'bg-green-100 text-green-800',
      UPDATE: 'bg-blue-100 text-blue-800',
      DELETE: 'bg-red-100 text-red-800',
      LOGIN: 'bg-purple-100 text-purple-800',
      LOGOUT: 'bg-gray-100 text-gray-800',
      VIEW: 'bg-cyan-100 text-cyan-800',
      EXPORT: 'bg-orange-100 text-orange-800',
      DOWNLOAD: 'bg-indigo-100 text-indigo-800',
      MIGRATE: 'bg-yellow-100 text-yellow-800',
      MIGRATE_HISTORY: 'bg-yellow-100 text-yellow-800'
    }
    return colors[acao] || 'bg-gray-100 text-gray-800'
  }

  const getEntityLabel = (entidade: string) => {
    const labels: Record<string, string> = {
      User: 'Usuário',
      Processo: 'Processo',
      Acordo: 'Acordo',
      Sessao: 'Sessão',
      Documento: 'Documento',
      Tramitacao: 'Tramitação',
      Pauta: 'Pauta',
      Parcela: 'Parcela',
      Pagamento: 'Pagamento',
      PagamentoParcela: 'Pagamento de Parcela',
      AcordoDetalhes: 'Detalhes do Acordo',
      HistoricoProcesso: 'Histórico do Processo'
    }
    return labels[entidade] || entidade
  }

  const showLogDetails = (log: LogEntry) => {
    setSelectedLog(log)
    setShowDetails(true)
  }

  if (status === 'loading' || loading) {
    return <div>Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Logs de Auditoria
          </h1>
          <p className="text-gray-600">
            Registro de todas as atividades do sistema
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalLogs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Últimas 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statistics.logsLast24h}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statistics.uniqueUsers}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ações Críticas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statistics.criticalActions}
            </div>
          </CardContent>
        </Card>
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
                    placeholder="Buscar por ação, entidade, usuário..."
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
                  <label className="text-sm font-medium mb-2 block">Ação</label>
                  <Select value={acaoFilter} onValueChange={setAcaoFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as ações" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as ações</SelectItem>
                      {statistics.uniqueActions.map((acao) => (
                        <SelectItem key={acao} value={acao}>
                          {getActionLabel(acao)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Entidade</label>
                  <Select value={entidadeFilter} onValueChange={setEntidadeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as entidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as entidades</SelectItem>
                      {statistics.uniqueEntities.map((entidade) => (
                        <SelectItem key={entidade} value={entidade}>
                          {getEntityLabel(entidade)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Usuário</label>
                  <Input
                    placeholder="Filtrar por usuário..."
                    value={usuarioFilter}
                    onChange={(e) => setUsuarioFilter(e.target.value)}
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('')
                      setAcaoFilter('all')
                      setEntidadeFilter('all')
                      setUsuarioFilter('')
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

      {/* Lista de Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Registros de Atividade</CardTitle>
          <CardDescription>
            Mostrando {paginatedLogs.length} de {totalFilteredLogs} registros (Página {currentPage} de {totalPages})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paginatedLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <Activity className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getActionColor(log.acao)}>
                        {getActionLabel(log.acao)}
                      </Badge>
                      <span className="font-medium">{getEntityLabel(log.entidade)}</span>
                      <span className="text-sm text-gray-500">#{log.entidadeId.slice(-6)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.usuario.name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                      {log.ip && (
                        <div className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          {log.ip}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => showLogDetails(log)}
                  className="cursor-pointer"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-gray-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, totalFilteredLogs)} de {totalFilteredLogs} logs
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  disabled={currentPage <= 1}
                  className="cursor-pointer"
                >
                  Anterior
                </Button>
                <span className="flex items-center px-3 text-sm">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={currentPage >= totalPages}
                  className="cursor-pointer"
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-7xl max-h-[80vh] overflow-y-auto" style={{ width: '90vw', maxWidth: '1200px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Detalhes do Log de Auditoria
            </DialogTitle>
            <DialogDescription>
              Informações detalhadas sobre a atividade registrada no sistema.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              {/* Informações básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Ação</label>
                  <div>
                    <Badge className={getActionColor(selectedLog.acao)}>
                      {getActionLabel(selectedLog.acao)}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Entidade</label>
                  <p className="text-sm">{getEntityLabel(selectedLog.entidade)}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Usuário</label>
                  <p className="text-sm">{selectedLog.usuario.name}</p>
                  <p className="text-xs text-gray-500">{selectedLog.usuario.email}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Data/Hora</label>
                  <p className="text-sm">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                {selectedLog.ip && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-600">Endereço IP</label>
                    <p className="text-sm font-mono">{selectedLog.ip}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">ID da Entidade</label>
                  <p className="text-sm font-mono">{selectedLog.entidadeId}</p>
                </div>
              </div>

              {/* Dados anteriores */}
              {selectedLog.dadosAnteriores && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Dados Anteriores</label>
                  <pre className="p-3 bg-gray-50 rounded-md text-xs overflow-auto max-h-40 border">
                    {JSON.stringify(selectedLog.dadosAnteriores, null, 2)}
                  </pre>
                </div>
              )}

              {/* Dados novos */}
              {selectedLog.dadosNovos && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Dados Novos</label>
                  <pre className="p-3 bg-gray-50 rounded-md text-xs overflow-auto max-h-40 border">
                    {JSON.stringify(selectedLog.dadosNovos, null, 2)}
                  </pre>
                </div>
              )}

              {/* User Agent */}
              {selectedLog.userAgent && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">User Agent</label>
                  <p className="text-xs text-gray-700 break-all p-2 bg-gray-50 rounded border">
                    {selectedLog.userAgent}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDetails(false)}
              className="cursor-pointer"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
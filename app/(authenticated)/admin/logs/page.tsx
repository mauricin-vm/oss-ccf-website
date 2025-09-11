'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { 
  Activity, 
  Search, 
  Calendar,
  User,
  Database,
  Filter,
  Download,
  RefreshCw,
  Eye
} from 'lucide-react'
import { SessionUser } from '@/types'

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
    name: string
    email: string
  }
}

export default function LogsAdminPage() {
  const { data: session, status } = useSession()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [acaoFilter, setAcaoFilter] = useState('all')
  const [entidadeFilter, setEntidadeFilter] = useState('all')
  const [usuarioFilter, setUsuarioFilter] = useState('')
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const [showDetails, setShowDetails] = useState(false)

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

  // Carregar logs (simulado - você implementaria uma API real)
  const loadLogs = async () => {
    try {
      setLoading(true)
      // Simular dados de logs por enquanto
      const mockLogs: LogEntry[] = [
        {
          id: '1',
          acao: 'CREATE',
          entidade: 'User',
          entidadeId: 'user123',
          dadosNovos: { name: 'João Silva', email: 'joao@ccf.gov.br' },
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0...',
          createdAt: new Date().toISOString(),
          usuario: { name: 'Admin', email: 'admin@ccf.gov.br' }
        },
        {
          id: '2',
          acao: 'UPDATE',
          entidade: 'Processo',
          entidadeId: 'proc456',
          dadosAnteriores: { status: 'EM_ANALISE' },
          dadosNovos: { status: 'EM_PAUTA' },
          ip: '192.168.1.101',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          usuario: { name: 'Maria Santos', email: 'maria@ccf.gov.br' }
        },
        {
          id: '3',
          acao: 'DELETE',
          entidade: 'Documento',
          entidadeId: 'doc789',
          dadosAnteriores: { nome: 'documento.pdf' },
          ip: '192.168.1.102',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          usuario: { name: 'Carlos Lima', email: 'carlos@ccf.gov.br' }
        }
      ]
      setLogs(mockLogs)
    } catch (error) {
      console.error('Erro ao carregar logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const getActionLabel = (acao: string) => {
    const labels: Record<string, string> = {
      CREATE: 'Criação',
      UPDATE: 'Atualização',
      DELETE: 'Exclusão',
      LOGIN: 'Login',
      LOGOUT: 'Logout',
      VIEW: 'Visualização',
      EXPORT: 'Exportação'
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
      EXPORT: 'bg-orange-100 text-orange-800'
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
      Pauta: 'Pauta'
    }
    return labels[entidade] || entidade
  }

  const filteredLogs = logs.filter(log => {
    const matchSearch = !search || 
      log.usuario.name.toLowerCase().includes(search.toLowerCase()) ||
      log.entidade.toLowerCase().includes(search.toLowerCase()) ||
      log.acao.toLowerCase().includes(search.toLowerCase())
    
    const matchAcao = acaoFilter === 'all' || log.acao === acaoFilter
    const matchEntidade = entidadeFilter === 'all' || log.entidade === entidadeFilter
    const matchUsuario = !usuarioFilter || log.usuario.name.toLowerCase().includes(usuarioFilter.toLowerCase())

    return matchSearch && matchAcao && matchEntidade && matchUsuario
  })

  const showLogDetails = (log: LogEntry) => {
    setSelectedLog(log)
    setShowDetails(true)
  }

  if (status === 'loading' || loading) {
    return <div>Carregando...</div>
  }

  const uniqueActions = Array.from(new Set(logs.map(log => log.acao)))
  const uniqueEntities = Array.from(new Set(logs.map(log => log.entidade)))

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
        <div className="flex gap-2">
          <Button onClick={loadLogs} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Últimas 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {logs.filter(log => new Date(log.createdAt) > new Date(Date.now() - 86400000)).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Set(logs.map(log => log.usuario.email)).size}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ações Críticas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {logs.filter(log => log.acao === 'DELETE').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={acaoFilter || 'all'} onValueChange={setAcaoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as ações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>
                    {getActionLabel(action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entidadeFilter || 'all'} onValueChange={setEntidadeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as entidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as entidades</SelectItem>
                {uniqueEntities.map(entity => (
                  <SelectItem key={entity} value={entity}>
                    {getEntityLabel(entity)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Filtrar por usuário..."
              value={usuarioFilter}
              onChange={(e) => setUsuarioFilter(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Registros de Atividade</CardTitle>
          <CardDescription>
            {filteredLogs.length} de {logs.length} registros
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => showLogDetails(log)}>
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
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      {showDetails && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Detalhes do Log</h2>
                <Button variant="outline" onClick={() => setShowDetails(false)}>
                  Fechar
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Ação</label>
                    <div className="mt-1">
                      <Badge className={getActionColor(selectedLog.acao)}>
                        {getActionLabel(selectedLog.acao)}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Entidade</label>
                    <p className="mt-1">{getEntityLabel(selectedLog.entidade)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Usuário</label>
                    <p className="mt-1">{selectedLog.usuario.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Data/Hora</label>
                    <p className="mt-1">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                  </div>
                  {selectedLog.ip && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">IP</label>
                      <p className="mt-1">{selectedLog.ip}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-600">ID da Entidade</label>
                    <p className="mt-1 font-mono text-sm">{selectedLog.entidadeId}</p>
                  </div>
                </div>

                {selectedLog.dadosAnteriores && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Dados Anteriores</label>
                    <pre className="mt-1 p-3 bg-gray-100 rounded text-sm overflow-auto">
                      {JSON.stringify(selectedLog.dadosAnteriores, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.dadosNovos && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Dados Novos</label>
                    <pre className="mt-1 p-3 bg-gray-100 rounded text-sm overflow-auto">
                      {JSON.stringify(selectedLog.dadosNovos, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.userAgent && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">User Agent</label>
                    <p className="mt-1 text-sm break-all">{selectedLog.userAgent}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Activity,
  Shield,
  CheckCircle,
  FileText,
  UserCheck,
  Building2,
  Gavel,
  DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'

async function getAdminStats() {
  const [
    totalUsers,
    activeUsers,
    totalProcessos,
    totalAcordos,
    totalSessoes,
    recentLogs,
    setores
  ] = await Promise.all([
    // Total de usuários
    prisma.user.count(),
    
    // Usuários ativos
    prisma.user.count({ where: { active: true } }),
    
    // Total de processos
    prisma.processo.count(),
    
    // Total de acordos
    prisma.acordo.count(),
    
    // Total de sessões
    prisma.sessaoJulgamento.count(),
    
    // Logs recentes
    prisma.logAuditoria.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        usuario: {
          select: {
            name: true,
            email: true
          }
        }
      }
    }),
    
    // Setores
    prisma.setor.count()
  ])

  return {
    totalUsers,
    activeUsers,
    totalProcessos,
    totalAcordos,
    totalSessoes,
    recentLogs,
    setores
  }
}

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  if (user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const stats = await getAdminStats()

  const adminMenuItems = [
    {
      title: 'Gerenciar Usuários',
      description: 'Criar, editar e gerenciar usuários do sistema',
      href: '/admin/usuarios',
      icon: Users,
      stats: `${stats.activeUsers}/${stats.totalUsers} ativos`
    },
    {
      title: 'Gerenciar Cadastros',
      description: 'Configurar conselheiros e setores',
      href: '/admin/cadastros',
      icon: Building2,
      stats: `${stats.setores} setores`
    },
    {
      title: 'Logs de Auditoria',
      description: 'Visualizar logs de atividades do sistema',
      href: '/admin/logs',
      icon: Activity,
      stats: `${stats.recentLogs.length} recentes`
    }
  ]

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
      Acordao: 'Acórdão',
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-red-600" />
            Painel Administrativo
          </h1>
          <p className="text-gray-600">
            Gerenciamento e configuração do sistema CCF
          </p>
        </div>
      </div>

      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              de {stats.totalUsers} usuários totais
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processos</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalProcessos}</div>
            <p className="text-xs text-muted-foreground">
              processos registrados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acordos</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalAcordos}</div>
            <p className="text-xs text-muted-foreground">
              acordos firmados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessões</CardTitle>
            <Gavel className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.totalSessoes}</div>
            <p className="text-xs text-muted-foreground">
              sessões realizadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Menu de Administração */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Ferramentas Administrativas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminMenuItems.map((item) => (
            <Card key={item.href} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <item.icon className="h-8 w-8 text-blue-600" />
                  <Badge variant="secondary">{item.stats}</Badge>
                </div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={item.href}>
                  <Button className="w-full cursor-pointer">
                    Acessar
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Logs Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Atividades Recentes
          </CardTitle>
          <CardDescription>
            Últimas ações realizadas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Activity className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className={getActionColor(log.acao)}>
                        {getActionLabel(log.acao)}
                      </Badge>
                      <span className="font-medium">{getEntityLabel(log.entidade)}</span>
                      <span className="text-sm text-gray-500">#{log.entidadeId.slice(-6)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span>{log.usuario.name}</span>
                      <span>{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link href="/admin/logs">
              <Button variant="outline" className="w-full cursor-pointer">
                Ver Todos os Logs
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Status do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Status do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Banco de Dados: Online</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Autenticação: Funcionando</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">APIs: Todas ativas</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
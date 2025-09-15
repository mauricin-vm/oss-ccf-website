import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Users,
  CreditCard,
  Gavel
} from 'lucide-react'
import { SessionUser } from '@/types'

async function getStatistics() {
  const [
    totalProcessos,
    processosEmAnalise,
    processosFinalizados,
    processosComPrazo,
    totalAcordos,
    parcelasPendentes,
    sessoesMes
  ] = await Promise.all([
    prisma.processo.count(),
    prisma.processo.count({
      where: {
        status: {
          in: ['EM_ANALISE', 'EM_PAUTA']
        }
      }
    }),
    prisma.processo.count({
      where: {
        status: 'ARQUIVADO'
      }
    }),
    prisma.tramitacao.count({
      where: {
        prazoResposta: {
          gte: new Date()
        },
        dataRecebimento: null
      }
    }),
    prisma.acordo.count(),
    prisma.parcela.count({
      where: {
        status: 'PENDENTE'
      }
    }),
    prisma.sessaoJulgamento.count({
      where: {
        dataInicio: {
          gte: new Date(new Date().setDate(1))
        }
      }
    })
  ])

  return {
    totalProcessos,
    processosEmAnalise,
    processosFinalizados,
    processosComPrazo,
    totalAcordos,
    parcelasPendentes,
    sessoesMes
  }
}

async function getRecentProcessos() {
  return prisma.processo.findMany({
    take: 5,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      contribuinte: true
    }
  })
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as SessionUser
  
  const stats = await getStatistics()
  const recentProcessos = await getRecentProcessos()

  const cards = [
    {
      title: 'Total de Processos',
      value: stats.totalProcessos,
      description: 'Processos cadastrados',
      icon: FileText,
      color: 'text-blue-600'
    },
    {
      title: 'Em Análise',
      value: stats.processosEmAnalise,
      description: 'Aguardando decisão',
      icon: Clock,
      color: 'text-yellow-600'
    },
    {
      title: 'Finalizados',
      value: stats.processosFinalizados,
      description: 'Processos concluídos',
      icon: CheckCircle,
      color: 'text-green-600'
    },
    {
      title: 'Prazos Ativos',
      value: stats.processosComPrazo,
      description: 'Aguardando resposta',
      icon: AlertCircle,
      color: 'text-red-600'
    },
    {
      title: 'Acordos Firmados',
      value: stats.totalAcordos,
      description: 'Total de acordos',
      icon: TrendingUp,
      color: 'text-purple-600'
    },
    {
      title: 'Parcelas Pendentes',
      value: stats.parcelasPendentes,
      description: 'Aguardando pagamento',
      icon: CreditCard,
      color: 'text-orange-600'
    },
    {
      title: 'Sessões no Mês',
      value: stats.sessoesMes,
      description: 'Julgamentos realizados',
      icon: Gavel,
      color: 'text-indigo-600'
    },
    {
      title: 'Taxa de Sucesso',
      value: stats.totalProcessos > 0 
        ? `${Math.round((stats.processosFinalizados / stats.totalProcessos) * 100)}%`
        : '0%',
      description: 'Processos concluídos',
      icon: Users,
      color: 'text-teal-600'
    }
  ]

  const tipoProcessoMap = {
    COMPENSACAO: 'Compensação',
    DACAO_PAGAMENTO: 'Dação em Pagamento',
    TRANSACAO_EXCEPCIONAL: 'Transação Excepcional'
  }

  const statusMap = {
    RECEPCIONADO: { label: 'Recepcionado', color: 'bg-gray-100 text-gray-800' },
    EM_ANALISE: { label: 'Em Análise', color: 'bg-blue-100 text-blue-800' },
    EM_PAUTA: { label: 'Em Pauta', color: 'bg-purple-100 text-purple-800' },
    SUSPENSO: { label: 'Suspenso', color: 'bg-yellow-100 text-yellow-800' },
    PEDIDO_VISTA: { label: 'Pedido de Vista', color: 'bg-orange-100 text-orange-800' },
    PEDIDO_DILIGENCIA: { label: 'Pedido de Diligência', color: 'bg-red-100 text-red-800' },
    JULGADO: { label: 'Julgado', color: 'bg-indigo-100 text-indigo-800' },
    ACORDO_FIRMADO: { label: 'Acordo Firmado', color: 'bg-green-100 text-green-800' },
    EM_CUMPRIMENTO: { label: 'Em Cumprimento', color: 'bg-orange-100 text-orange-800' },
    ARQUIVADO: { label: 'Arquivado', color: 'bg-gray-100 text-gray-800' }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600">
          Bem-vindo(a) de volta, {user.name}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Processos Recentes</CardTitle>
          <CardDescription>
            Últimos processos cadastrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentProcessos.map((processo) => (
              <div
                key={processo.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <p className="font-medium">{processo.numero}</p>
                  <p className="text-sm text-gray-600">
                    {processo.contribuinte.nome}
                  </p>
                  <p className="text-sm text-gray-500">
                    {tipoProcessoMap[processo.tipo]} • {new Date(processo.dataAbertura).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusMap[processo.status].color}`}>
                    {statusMap[processo.status].label}
                  </span>
                </div>
              </div>
            ))}
            {recentProcessos.length === 0 && (
              <p className="text-center text-gray-500 py-4">
                Nenhum processo cadastrado ainda
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
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
import { getStatusInfo, STATUS_GROUPS } from '@/lib/constants/status'
import { getTipoProcessoInfo } from '@/lib/constants/tipos-processo'

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
          in: [...STATUS_GROUPS.EM_ANALISE_GERAL]
        }
      }
    }),
    prisma.processo.count({
      where: {
        status: 'CONCLUIDO'
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
                    {getTipoProcessoInfo(processo.tipo).label} • {new Date(processo.dataAbertura).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusInfo(processo.status).color}`}>
                    {getStatusInfo(processo.status).label}
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
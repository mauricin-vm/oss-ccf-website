'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  FileText,
  Download,
  Gavel,
  HandCoins,
  AlertTriangle,
  Clock
} from 'lucide-react'
import { ChartsSection } from '@/components/reports/charts-section'
import { LineChartEvolucao } from '@/components/charts/line-chart-evolucao'
import { FiltersPanel } from '@/components/reports/filters-panel'
import { useReportFilters } from '@/hooks/use-report-filters'

interface ReportsClientProps {
  initialData: {
    totais: {
      processos: number
      pautas: number
      sessoes: number
      acordos: number
    }
    parcelas: {
      total: number
      abertas: number
      vencidas: number
      pagas: number
    }
    processosPorTipo: Array<{ tipo: string; _count: { id: number } }>
    processosPorStatus: Array<{ status: string; _count: { id: number } }>
    sessoesAtivas: number
    acordosVencidos: number
    valores: {
      totalAcordos: number
      recebido: number
    }
    decisoesPorTipo: Array<{ tipoDecisao: string | null; _count: { id: number } }>
    valoresPorTipoProcesso: Array<{ tipo: string; _count: number; _sum: { valorTotal: number } }>
    valoresPorResultado: Array<{ tipoDecisao: string | null; valorTotal: number }>
    evolucaoMensal: Array<{
      mes: number
      ano: number
      valor: number
      acordos: { valor: number; quantidade: number }
      parcelas: { valor: number; quantidade: number }
      total: { valor: number; quantidade: number }
    }>
  }
  relatóriosRecentes: {
    processosRecentes: number
    acordosRecentes: number
    pagamentosRecentes: number
    sessoesRecentes: number
  }
}

export function ReportsClient({ initialData, relatóriosRecentes }: ReportsClientProps) {
  const { filters, setFilters, activeFiltersCount, data: dashboardData } = useReportFilters(initialData)

  // const getStatusProcessoLabel = (status: string) => {
  //   const labels: Record<string, string> = {
  //     'RECEPCIONADO': 'Recepcionado',
  //     'EM_ANALISE': 'Em Análise',
  //     'EM_PAUTA': 'Em Pauta',
  //     'SUSPENSO': 'Suspenso',
  //     'PEDIDO_VISTA': 'Pedido Vista',
  //     'PEDIDO_DILIGENCIA': 'Pedido Diligência',
  //     'EM_NEGOCIACAO': 'Em Negociação',
  //     'JULGADO': 'Julgado',
  //     'EM_CUMPRIMENTO': 'Em Cumprimento',
  //     'CONCLUIDO': 'Concluído'
  //   }
  //   return labels[status] || status
  // }

  const getTipoProcessoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'COMPENSACAO': 'Compensação',
      'DACAO_PAGAMENTO': 'Dação em Pagamento',
      'TRANSACAO_EXCEPCIONAL': 'Transação Excepcional'
    }
    return labels[tipo] || tipo
  }

  const getTipoProcessoColor = (tipo: string) => {
    const colors: Record<string, string> = {
      'COMPENSACAO': 'bg-green-100 text-green-800',
      'DACAO_PAGAMENTO': 'bg-blue-100 text-blue-800',
      'TRANSACAO_EXCEPCIONAL': 'bg-yellow-100 text-yellow-800'
    }
    return colors[tipo] || 'bg-gray-100 text-gray-800'
  }

  // const getTipoDecisaoLabel = (tipo: string) => {
  //   const labels: Record<string, string> = {
  //     'DEFERIDO': 'Deferido',
  //     'INDEFERIDO': 'Indeferido',
  //     'PARCIAL': 'Deferido Parcial'
  //   }
  //   return labels[tipo] || tipo
  // }

  const totalAcordos = Number(activeFiltersCount > 0
    ? (dashboardData.valores?.totalAcordos || 0)
    : (initialData.valores?.totalAcordos || 0))
  const recebido = Number(activeFiltersCount > 0
    ? (dashboardData.valores?.recebido || 0)
    : (initialData.valores?.recebido || 0))

  const percentualRecebido = totalAcordos > 0
    ? Math.round((recebido / totalAcordos) * 100)
    : 0

  // Calcular totais (usar dados diretos como o card de Sessões)
  const processosFiltered = dashboardData.totais?.processos || 0
  const acordosFiltered = dashboardData.totais?.acordos || 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-gray-600">
            Acompanhe o desempenho e métricas do sistema CCF
          </p>
        </div>

        <div className="flex gap-2">
          <FiltersPanel
            filters={filters}
            onFiltersChange={setFilters}
            activeFiltersCount={activeFiltersCount}
          />
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Processos</p>
                <p className="text-2xl font-bold">
                  {activeFiltersCount > 0 ? processosFiltered : initialData.totais.processos}
                </p>
                {activeFiltersCount === 0 && (
                  <p className="text-xs text-green-600">
                    +{relatóriosRecentes.processosRecentes} este mês
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Sessões</p>
                <p className="text-2xl font-bold">
                  {activeFiltersCount > 0 ? dashboardData.totais?.sessoes || 0 : initialData.totais.sessoes}
                </p>
                <p className="text-xs text-yellow-600">
                  {activeFiltersCount > 0 ? dashboardData.sessoesAtivas || 0 : initialData.sessoesAtivas} ativas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Acordos</p>
                <p className="text-2xl font-bold">
                  {activeFiltersCount > 0 ? acordosFiltered : initialData.totais.acordos}
                </p>
                <p className="text-xs text-red-600">
                  {activeFiltersCount > 0 ? dashboardData.acordosVencidos || 0 : initialData.acordosVencidos} vencidos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Arrecadação</p>
                <p className="text-2xl font-bold">{percentualRecebido}%</p>
                <p className="text-xs text-gray-500">
                  R$ {recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status dos Processos */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Análise de Parcelas</CardTitle>
            <CardDescription>
              Situação atual das parcelas de pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-100 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-slate-700">
                  {activeFiltersCount > 0 ? dashboardData.parcelas?.total || 0 : initialData.parcelas.total}
                </div>
                <div className="text-sm text-slate-600 mt-1">Total de Parcelas</div>
              </div>

              <div className="bg-indigo-100 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-indigo-700">
                  {activeFiltersCount > 0 ? dashboardData.parcelas?.abertas || 0 : initialData.parcelas.abertas}
                </div>
                <div className="text-sm text-indigo-600 mt-1">Parcelas Pendentes</div>
              </div>

              <div className="bg-rose-100 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-rose-700">
                  {activeFiltersCount > 0 ? dashboardData.parcelas?.vencidas || 0 : initialData.parcelas.vencidas}
                </div>
                <div className="text-sm text-rose-600 mt-1">Parcelas Vencidas</div>
              </div>

              <div className="bg-emerald-100 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-emerald-700">
                  {activeFiltersCount > 0 ? dashboardData.parcelas?.pagas || 0 : initialData.parcelas.pagas}
                </div>
                <div className="text-sm text-emerald-600 mt-1">Parcelas Pagas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valores Totais por Tipo de Processo</CardTitle>
            <CardDescription>
              Distribuição dos valores de acordo por tipo de processo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(dashboardData.valoresPorTipoProcesso || []).map((item: { tipo: string; _count: number; _sum: { valorTotal: number } }) => (
                <div key={item.tipo} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getTipoProcessoColor(item.tipo)}>
                      {getTipoProcessoLabel(item.tipo)}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">
                      R$ {Number(item._sum.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <p className="text-xs text-gray-500">{item._count} processos</p>
                  </div>
                </div>
              ))}
              {(!dashboardData.valoresPorTipoProcesso || dashboardData.valoresPorTipoProcesso.length === 0) && activeFiltersCount > 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nenhum dado encontrado
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Valores Financeiros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Valores Financeiros
          </CardTitle>
          <CardDescription>
            Resumo dos valores dos acordos e arrecadação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Valor Total dos Acordos</p>
              <p className="text-2xl font-bold text-blue-600">
                R$ {totalAcordos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Valor Recebido</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Valor Pendente</p>
              <p className="text-2xl font-bold text-yellow-600">
                R$ {(totalAcordos - recebido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">Percentual Arrecadado</span>
              <span className="font-medium">{percentualRecebido}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${percentualRecebido}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <ChartsSection
        decisoesPorTipo={dashboardData.decisoesPorTipo || initialData.decisoesPorTipo || []}
        valoresPorTipoProcesso={(dashboardData.valoresPorTipoProcesso || initialData.valoresPorTipoProcesso || []).map((item: { tipo: string; _count: number; _sum: { valorTotal: number } }) => ({
          tipo: item.tipo as 'COMPENSACAO' | 'DACAO_PAGAMENTO' | 'TRANSACAO_EXCEPCIONAL',
          _count: item._count,
          _sum: {
            valorTotal: Number(item._sum.valorTotal)
          }
        }))}
        valoresPorResultado={(dashboardData.valoresPorResultado || initialData.valoresPorResultado || []).map((item: { tipoDecisao: string | null; valorTotal: number }) => ({
          ...item,
          valorTotal: Number(item.valorTotal)
        }))}
      />

      {/* Gráfico de Evolução Mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Evolução da Arrecadação
          </CardTitle>
          <CardDescription>
            {activeFiltersCount > 0
              ? 'Performance de recuperação no período filtrado'
              : 'Performance de recuperação nos últimos 12 meses'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LineChartEvolucao
            data={activeFiltersCount > 0
              ? (dashboardData.evolucaoMensal || [])
              : (initialData.evolucaoMensal || [])
            }
          />
        </CardContent>
      </Card>

      {/* Gráfico de Timeline de Processos */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline de Processos</CardTitle>
          <CardDescription>
            Fluxo atual dos processos no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="flex items-center justify-between">
              {[
                {
                  label: 'Entrada',
                  color: 'bg-blue-500',
                  statuses: ['RECEPCIONADO', 'EM_ANALISE']
                },
                {
                  label: 'Pré-Julgamento',
                  color: 'bg-purple-500',
                  statuses: ['EM_PAUTA', 'PEDIDO_VISTA', 'PEDIDO_DILIGENCIA', 'SUSPENSO']
                },
                {
                  label: 'Negociação',
                  color: 'bg-orange-500',
                  statuses: ['EM_NEGOCIACAO']
                },
                {
                  label: 'Julgado',
                  color: 'bg-amber-500',
                  statuses: ['JULGADO']
                },
                {
                  label: 'Acordo',
                  color: 'bg-lime-500',
                  statuses: ['EM_CUMPRIMENTO']
                },
                {
                  label: 'Concluído',
                  color: 'bg-green-500',
                  statuses: ['CONCLUIDO']
                }
              ].map((stage, index) => {
                const count = stage.statuses.reduce((total, status) => {
                  const processoData = (dashboardData.processosPorStatus || initialData.processosPorStatus || [])
                    .find((p: { status: string; _count: { id: number } }) => p.status === status)
                  return total + (processoData?._count.id || 0)
                }, 0)

                return (
                  <div key={index} className="flex flex-col items-center relative">
                    <div className={`w-16 h-16 ${stage.color} rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                      {count}
                    </div>
                    <p className="mt-2 text-xs font-medium text-center max-w-16">{stage.label}</p>
                    {index < 5 && (
                      <div className="absolute top-8 left-16 w-8 h-0.5 bg-gray-300"></div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Relatórios Disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle>Relatórios <del>Disponíveis</del> (Em Desenvolvimento)</CardTitle>
          <CardDescription>
            Gere relatórios detalhados por categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium">Relatório de Processos</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Listagem completa dos processos
              </p>
              <Button size="sm" variant="outline" className="w-full cursor-pointer">
                <Download className="mr-2 h-3 w-3" />
                Gerar
              </Button>
            </div>

            <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <HandCoins className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">Relatório de Acordos</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Acordos de pagamento e status de cumprimento
              </p>
              <Button size="sm" variant="outline" className="w-full cursor-pointer">
                <Download className="mr-2 h-3 w-3" />
                Gerar
              </Button>
            </div>

            <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="h-5 w-5 text-yellow-600" />
                <h4 className="font-medium">Relatório Financeiro</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Pagamentos, arrecadação e inadimplência
              </p>
              <Button size="sm" variant="outline" className="w-full cursor-pointer">
                <Download className="mr-2 h-3 w-3" />
                Gerar
              </Button>
            </div>

            <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Gavel className="h-5 w-5 text-purple-600" />
                <h4 className="font-medium">Relatório de Sessões</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Sessões de julgamento e decisões tomadas
              </p>
              <Button size="sm" variant="outline" className="w-full cursor-pointer">
                <Download className="mr-2 h-3 w-3" />
                Gerar
              </Button>
            </div>

            <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h4 className="font-medium">Parcelas Vencidas</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Acordos em atraso e ações de cobrança
              </p>
              <Button size="sm" variant="outline" className="w-full cursor-pointer">
                <Download className="mr-2 h-3 w-3" />
                Gerar
              </Button>
            </div>

            <div className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
                <h4 className="font-medium">Dashboard Executivo</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Indicadores gerenciais e métricas de performance
              </p>
              <Button size="sm" variant="outline" className="w-full cursor-pointer">
                <Download className="mr-2 h-3 w-3" />
                Gerar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Atividade Recente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Atividade Recente (30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{relatóriosRecentes.processosRecentes}</p>
              <p className="text-sm text-gray-600">Novos Processos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{relatóriosRecentes.sessoesRecentes}</p>
              <p className="text-sm text-gray-600">Sessões Realizadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{relatóriosRecentes.acordosRecentes}</p>
              <p className="text-sm text-gray-600">Acordos Criados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{relatóriosRecentes.pagamentosRecentes}</p>
              <p className="text-sm text-gray-600">Pagamentos Registrados</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
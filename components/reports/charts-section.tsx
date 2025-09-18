'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, PieChart } from 'lucide-react'
import dynamic from 'next/dynamic'

const PieChartResults = dynamic(() => import('@/components/charts/pie-chart-results').then(mod => ({ default: mod.PieChartResults })), {
  ssr: false,
  loading: () => <div className="h-80 flex items-center justify-center">Carregando gráfico...</div>
})

const BarChartTipos = dynamic(() => import('@/components/charts/bar-chart-tipos').then(mod => ({ default: mod.BarChartTipos })), {
  ssr: false,
  loading: () => <div className="h-80 flex items-center justify-center">Carregando gráfico...</div>
})


interface ChartsSectionProps {
  decisoesPorTipo: Array<{
    tipoDecisao: string | null
    _count: { id: number }
  }>
  valoresPorTipoProcesso: Array<{
    tipo: 'COMPENSACAO' | 'DACAO_PAGAMENTO' | 'TRANSACAO_EXCEPCIONAL'
    _count: number
    _sum: { valorTotal: number }
  }>
  valoresPorResultado: Array<{
    tipoDecisao: string | null
    valorTotal: number
  }>
}

export function ChartsSection({
  decisoesPorTipo,
  valoresPorTipoProcesso,
  valoresPorResultado
}: ChartsSectionProps) {
  return (
    <>
      {/* Gráfico de Comparação entre Resultados */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-green-600" />
              Comparação entre Resultados
            </CardTitle>
            <CardDescription>
              Distribuição das decisões nos julgamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PieChartResults
              data={decisoesPorTipo}
              values={valoresPorResultado}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Valores por Tipo de Processo
            </CardTitle>
            <CardDescription>
              Comparação dos valores totais por categoria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarChartTipos
              data={valoresPorTipoProcesso}
            />
          </CardContent>
        </Card>
      </div>

    </>
  )
}
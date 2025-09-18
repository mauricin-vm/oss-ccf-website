'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

interface BarChartTiposProps {
  data: Array<{
    tipo: 'COMPENSACAO' | 'DACAO_PAGAMENTO' | 'TRANSACAO_EXCEPCIONAL'
    _count: number
    _sum: { valorTotal: number }
  }>
}

export function BarChartTipos({ data }: BarChartTiposProps) {
  const getTipoProcessoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'COMPENSACAO': 'Compensação',
      'DACAO_PAGAMENTO': 'Dação',
      'TRANSACAO_EXCEPCIONAL': 'Transação'
    }
    return labels[tipo] || tipo
  }
  const getTipoColor = (tipo: string) => {
    const colors: Record<string, string> = {
      'COMPENSACAO': '#10b981',        // Verde
      'DACAO_PAGAMENTO': '#3b82f6',    // Azul
      'TRANSACAO_EXCEPCIONAL': '#f59e0b' // Amarelo
    }
    return colors[tipo] || '#6b7280'
  }

  const chartData = data.map(item => ({
    tipo: getTipoProcessoLabel(item.tipo),
    valor: Number(item._sum.valorTotal),
    quantidade: item._count,
    fill: getTipoColor(item.tipo)
  }))

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="tipo"
            tick={{ fontSize: 12 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `R$ ${(value / 1000000).toFixed(1)}M`}
          />
          <Tooltip
            formatter={(value: number) => [
              `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              'Valor Total'
            ]}
          />
          <Bar dataKey="valor" name="Valor Total (R$)">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
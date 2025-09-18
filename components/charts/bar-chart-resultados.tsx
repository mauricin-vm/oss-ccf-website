'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface BarChartResultadosProps {
  data: Array<{
    tipoDecisao: string | null
    valorTotal: number
  }>
}

export function BarChartResultados({ data }: BarChartResultadosProps) {
  const getTipoDecisaoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'DEFERIDO': 'Deferido',
      'INDEFERIDO': 'Indeferido',
      'PARCIAL': 'Deferido Parcial'
    }
    return labels[tipo] || tipo
  }
  const chartData = data.map(item => ({
    resultado: getTipoDecisaoLabel(item.tipoDecisao || ''),
    valor: Number(item.valorTotal)
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
            dataKey="resultado"
            tick={{ fontSize: 12 }}
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
          <Legend />
          <Bar
            dataKey="valor"
            fill="#10b981"
            name="Valor dos Acordos (R$)"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
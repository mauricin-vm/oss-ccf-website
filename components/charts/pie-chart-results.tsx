'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts'

interface PieChartResultsProps {
  data: Array<{
    tipoDecisao: string | null
    _count: { id: number }
  }>
  values?: Array<{
    tipoDecisao: string | null
    valorTotal: number
  }>
}

export function PieChartResults({ data, values }: PieChartResultsProps) {
  const getTipoDecisaoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'DEFERIDO': 'Deferido',
      'INDEFERIDO': 'Indeferido',
      'PARCIAL': 'Deferido Parcial'
    }
    return labels[tipo] || tipo
  }
  const getValueForTipo = (tipo: string | null) => {
    if (!values) return 0
    const valueItem = values.find(v => v.tipoDecisao === tipo)
    return Number(valueItem?.valorTotal || 0)
  }

  const chartData = Array.isArray(data) ? data.map(item => ({
    name: item.tipoDecisao,
    value: item._count.id,
    valorTotal: getValueForTipo(item.tipoDecisao),
    fill: item.tipoDecisao === 'DEFERIDO' ? '#10b981' :
          item.tipoDecisao === 'INDEFERIDO' ? '#ef4444' : '#f59e0b'
  })) : []

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fill}
              />
            ))}
          </Pie>
          <Tooltip
            labelFormatter={(label: string) => getTipoDecisaoLabel(label)}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
            formatter={(value: number, name: string, props: { payload?: { valorTotal?: number } }) => {
              const valorTotal = props.payload?.valorTotal || 0
              return [
                <div key="content" className="space-y-1">
                  <div className="font-medium">{getTipoDecisaoLabel(name || '')}</div>
                  <div>{value} decisões</div>
                  {values && (
                    <div className="text-green-600 font-medium">
                      R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>,
                null
              ]
            }}
          />
          <Legend
            formatter={(value: string) => getTipoDecisaoLabel(value)}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
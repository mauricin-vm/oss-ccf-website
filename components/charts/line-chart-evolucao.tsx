'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface LineChartEvolucaoProps {
  data: Array<{
    mes: number
    ano: number
    valor: number
    acordos: {
      valor: number
      quantidade: number
    }
    parcelas: {
      valor: number
      quantidade: number
    }
    total: {
      valor: number
      quantidade: number
    }
  }>
}

export function LineChartEvolucao({ data }: LineChartEvolucaoProps) {
  const getMesLabel = (mes: number) => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return meses[mes]
  }

  const chartData = data.map(item => ({
    mes: getMesLabel(item.mes),
    mesAno: `${getMesLabel(item.mes)}/${item.ano}`,
    mesNumero: item.mes,
    ano: item.ano,
    valor: item.valor,
    acordos: item.acordos,
    parcelas: item.parcelas,
    total: item.total
  }))

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="mesAno"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `R$ ${(value / 1000000).toFixed(1)}M`}
          />
          <Tooltip
            formatter={(value: number, name: string, props: { payload?: { acordos?: { valor: number; quantidade: number }; parcelas?: { valor: number; quantidade: number }; total?: { valor: number; quantidade: number }; mes: string } }) => {
              const data = props.payload
              return [
                <div key="content" className="space-y-2">
                  <div className="text-green-600 font-medium">
                    Valor Total: R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      Acordos: R$ {data?.acordos?.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                      <span className="text-gray-500"> ({data?.acordos?.quantidade || 0} acordos)</span>
                    </div>
                    <div>
                      Parcelas: R$ {data?.parcelas?.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                      <span className="text-gray-500"> ({data?.parcelas?.quantidade || 0} parcelas)</span>
                    </div>
                    <div className="border-t pt-1">
                      Total de Itens: {data?.total?.quantidade || 0}
                    </div>
                  </div>
                </div>,
                null
              ]
            }}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
          />
          <Line
            type="monotone"
            dataKey="valor"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
            name="Arrecadação Mensal"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
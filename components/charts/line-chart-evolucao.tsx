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
    compensacao: {
      valor: number
      quantidade: number
    }
    dacao: {
      valor: number
      quantidade: number
    }
    transacao: {
      valor: number
      quantidade: number
    }
    total: {
      valor: number
      quantidade: number
    }
  }>
  tiposVisiveis: {
    compensacao: boolean
    dacao: boolean
    transacao: boolean
  }
}

export function LineChartEvolucao({ data, tiposVisiveis }: LineChartEvolucaoProps) {
  const getMesLabel = (mes: number) => {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return meses[mes]
  }

  const chartData = Array.isArray(data) ? data.map(item => ({
    mes: getMesLabel(item.mes),
    mesAno: `${getMesLabel(item.mes)}/${item.ano}`,
    mesNumero: item.mes,
    ano: item.ano,
    valor: item.valor,
    compensacao: item.compensacao.valor,
    dacao: item.dacao.valor,
    transacao: item.transacao.valor,
    compensacaoQtd: item.compensacao.quantidade,
    dacaoQtd: item.dacao.quantidade,
    transacaoQtd: item.transacao.quantidade,
    total: item.total
  })) : []

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
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const compensacao = payload.find(p => p.dataKey === 'compensacao')?.value as number || 0
                const dacao = payload.find(p => p.dataKey === 'dacao')?.value as number || 0
                const transacao = payload.find(p => p.dataKey === 'transacao')?.value as number || 0

                // Calcular total apenas dos tipos visíveis
                let total = 0
                if (tiposVisiveis.compensacao) total += compensacao
                if (tiposVisiveis.dacao) total += dacao
                if (tiposVisiveis.transacao) total += transacao

                return (
                  <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
                    <p className="font-medium text-gray-700 mb-2">{label}</p>
                    <div className="space-y-1 text-sm">
                      {tiposVisiveis.compensacao && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-green-500"></span>
                            Compensação:
                          </span>
                          <span className="font-medium text-green-600">
                            R$ {compensacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {tiposVisiveis.dacao && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            Dação:
                          </span>
                          <span className="font-medium text-blue-600">
                            R$ {dacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {tiposVisiveis.transacao && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                            Transação:
                          </span>
                          <span className="font-medium text-orange-600">
                            R$ {transacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {(tiposVisiveis.compensacao || tiposVisiveis.dacao || tiposVisiveis.transacao) && (
                        <div className="border-t border-gray-200 mt-2 pt-2 flex items-center justify-between gap-4">
                          <span className="font-semibold">Total:</span>
                          <span className="font-bold text-gray-900">
                            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          {tiposVisiveis.compensacao && (
            <Line
              type="monotone"
              dataKey="compensacao"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5 }}
              name="Compensação"
            />
          )}
          {tiposVisiveis.dacao && (
            <Line
              type="monotone"
              dataKey="dacao"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5 }}
              name="Dação"
            />
          )}
          {tiposVisiveis.transacao && (
            <Line
              type="monotone"
              dataKey="transacao"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5 }}
              name="Transação"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Calculator, FileText, CreditCard, Check } from 'lucide-react'

interface InscricaoTransacao {
  id: string
  numeroInscricao: string
  tipoInscricao: string
  debitos: Array<{
    descricao: string
    valor: number
    dataVencimento: string
  }>
}

interface PropostaTransacao {
  valorTotalProposto: number
  metodoPagamento: string
  valorEntrada: number
  quantidadeParcelas: number
}

interface ValoresTransacao {
  inscricoes: InscricaoTransacao[]
  proposta: PropostaTransacao
  resumo: {
    valorTotalInscricoes: number
    valorTotalProposto: number
    valorDesconto: number
    percentualDesconto: number
  }
}

interface TransacaoExcepcionalSectionProps {
  valoresTransacao: ValoresTransacao
  onSelectionChange: (dadosSelecionados: Record<string, unknown>) => void
}

export default function TransacaoExcepcionalSection({
  valoresTransacao,
  onSelectionChange
}: TransacaoExcepcionalSectionProps) {
  const [inscricoesSelecionadas, setInscricoesSelecionadas] = useState<string[]>([])
  const [incluirProposta, setIncluirProposta] = useState(true)

  // Calcular totais baseado na seleção
  useEffect(() => {
    const valorInscricoesSelecionadas = valoresTransacao.inscricoes
      .filter(inscricao => inscricoesSelecionadas.includes(inscricao.id))
      .reduce((total, inscricao) => {
        return total + inscricao.debitos.reduce((subtotal, debito) => subtotal + debito.valor, 0)
      }, 0)

    const dadosSelecionados = {
      inscricoesSelecionadas: inscricoesSelecionadas,
      valorInscricoes: valorInscricoesSelecionadas,
      incluirProposta: incluirProposta,
      valorTotal: incluirProposta ? valoresTransacao.proposta.valorTotalProposto : valorInscricoesSelecionadas,
      valorFinal: incluirProposta ? valoresTransacao.proposta.valorTotalProposto : valorInscricoesSelecionadas,
      metodoPagamento: valoresTransacao.proposta.metodoPagamento,
      valorEntrada: valoresTransacao.proposta.valorEntrada,
      numeroParcelas: valoresTransacao.proposta.quantidadeParcelas
    }

    onSelectionChange(dadosSelecionados)
  }, [inscricoesSelecionadas, incluirProposta, valoresTransacao, onSelectionChange])

  const handleInscricaoChange = (inscricaoId: string, checked: boolean) => {
    setInscricoesSelecionadas(prev =>
      checked
        ? [...prev, inscricaoId]
        : prev.filter(id => id !== inscricaoId)
    )
  }

  const selecionarTodas = () => {
    setInscricoesSelecionadas(valoresTransacao.inscricoes.map(i => i.id))
  }

  const limparSelecao = () => {
    setInscricoesSelecionadas([])
  }

  const getTipoInscricaoLabel = (tipo: string) => {
    return tipo === 'imobiliaria' ? 'Imobiliária' : 'Econômica'
  }

  return (
    <div className="space-y-6">
      {/* Resumo da Transação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Resumo da Transação Excepcional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-600">Valor Original</span>
              <p className="text-lg font-bold text-blue-800">
                R$ {valoresTransacao.resumo.valorTotalInscricoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <span className="text-sm text-green-600">Valor Proposto</span>
              <p className="text-lg font-bold text-green-800">
                R$ {valoresTransacao.resumo.valorTotalProposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <span className="text-sm text-orange-600">Desconto</span>
              <p className="text-lg font-bold text-orange-800">
                R$ {valoresTransacao.resumo.valorDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <span className="text-sm text-purple-600">% Desconto</span>
              <p className="text-lg font-bold text-purple-800">
                {valoresTransacao.resumo.percentualDesconto.toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposta Configurada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Proposta da Parte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox
              id="incluir-proposta"
              checked={incluirProposta}
              onCheckedChange={(checked) => setIncluirProposta(checked as boolean)}
            />
            <label
              htmlFor="incluir-proposta"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Incluir proposta no acordo
            </label>
          </div>

          {incluirProposta && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Valor Total</span>
                  <p className="font-bold">
                    R$ {valoresTransacao.proposta.valorTotalProposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Método</span>
                  <p className="font-bold">
                    {valoresTransacao.proposta.metodoPagamento === 'parcelado' ? 'Parcelado' : 'À Vista'}
                  </p>
                </div>
                {valoresTransacao.proposta.metodoPagamento === 'parcelado' && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Parcelas</span>
                    <p className="font-bold">
                      {valoresTransacao.proposta.quantidadeParcelas}x de R$ {
                        ((valoresTransacao.proposta.valorTotalProposto - valoresTransacao.proposta.valorEntrada) /
                         valoresTransacao.proposta.quantidadeParcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                      }
                    </p>
                  </div>
                )}
              </div>

              {valoresTransacao.proposta.valorEntrada > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-sm text-blue-600">Valor de Entrada</span>
                  <p className="text-lg font-bold text-blue-800">
                    R$ {valoresTransacao.proposta.valorEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Inscrições */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Inscrições a Incluir no Acordo
          </CardTitle>
          <CardDescription>
            Selecione quais inscrições serão incluídas no acordo de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selecionarTodas}
            >
              Selecionar Todas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={limparSelecao}
            >
              Limpar Seleção
            </Button>
          </div>

          <div className="space-y-4">
            {valoresTransacao.inscricoes.map((inscricao) => {
              const totalInscricao = inscricao.debitos.reduce((total, debito) => total + debito.valor, 0)
              const isSelected = inscricoesSelecionadas.includes(inscricao.id)

              return (
                <div
                  key={inscricao.id}
                  className={`border rounded-lg p-4 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`inscricao-${inscricao.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleInscricaoChange(inscricao.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">Inscrição {inscricao.numeroInscricao}</h4>
                        <Badge variant="outline">
                          {getTipoInscricaoLabel(inscricao.tipoInscricao)}
                        </Badge>
                        {isSelected && (
                          <Badge className="bg-green-100 text-green-800">
                            <Check className="h-3 w-3 mr-1" />
                            Selecionada
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2">
                        {inscricao.debitos.map((debito, index) => (
                          <div key={index} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                            <span>{debito.descricao}</span>
                            <div className="text-right">
                              <span className="font-medium">
                                R$ {debito.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <br />
                              <span className="text-gray-500 text-xs">
                                Venc: {new Date(debito.dataVencimento).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total da Inscrição:</span>
                          <span className="font-bold text-lg">
                            R$ {totalInscricao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Resumo da Seleção */}
          {inscricoesSelecionadas.length > 0 && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <h5 className="font-medium text-green-900 mb-2">Resumo da Seleção:</h5>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-green-700">Inscrições Selecionadas:</span>
                  <p className="font-bold text-green-900">{inscricoesSelecionadas.length}</p>
                </div>
                <div>
                  <span className="text-green-700">Valor Total:</span>
                  <p className="font-bold text-green-900">
                    R$ {valoresTransacao.inscricoes
                      .filter(i => inscricoesSelecionadas.includes(i.id))
                      .reduce((total, i) => total + i.debitos.reduce((subtotal, d) => subtotal + d.valor, 0), 0)
                      .toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
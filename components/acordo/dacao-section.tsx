'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Calculator, FileText, DollarSign, Check, Home, ArrowRightLeft } from 'lucide-react'

interface InscricaoOferecida {
  id: string
  numeroInscricao: string
  tipoInscricao: string
  valor: number
  dataVencimento?: string
  descricao?: string
}

interface Debito {
  descricao: string
  valor: number
  dataVencimento: string
}

interface InscricaoCompensar {
  id: string
  numeroInscricao: string
  tipoInscricao: string
  debitos: Debito[]
}

interface ValoresDacao {
  inscricoesOferecidas: InscricaoOferecida[]
  inscricoesCompensar: InscricaoCompensar[]
}

interface DacaoSectionProps {
  valoresDacao: ValoresDacao
  onSelectionChange: (dadosSelecionados: Record<string, unknown>) => void
}

export default function DacaoSection({
  valoresDacao,
  onSelectionChange
}: DacaoSectionProps) {
  const [inscricoesOferecidasSelecionadas, setInscricoesOferecidasSelecionadas] = useState<string[]>([])
  const [inscricoesCompensarSelecionadas, setInscricoesCompensarSelecionadas] = useState<string[]>([])

  // Calcular totais baseado na seleção
  useEffect(() => {
    const valorOferecido = valoresDacao.inscricoesOferecidas
      .filter(inscricao => inscricoesOferecidasSelecionadas.includes(inscricao.id))
      .reduce((total, inscricao) => total + inscricao.valor, 0)

    const valorCompensar = valoresDacao.inscricoesCompensar
      .filter(inscricao => inscricoesCompensarSelecionadas.includes(inscricao.id))
      .reduce((total, inscricao) => {
        return total + inscricao.debitos.reduce((subtotal, debito) => subtotal + debito.valor, 0)
      }, 0)

    const valorDacao = Math.min(valorOferecido, valorCompensar)
    const saldoFinal = Math.abs(valorOferecido - valorCompensar)

    const dadosSelecionados = {
      inscricoesOferecidasSelecionadas: inscricoesOferecidasSelecionadas,
      inscricoesCompensarSelecionadas: inscricoesCompensarSelecionadas,
      valorOferecido: valorOferecido,
      valorCompensar: valorCompensar,
      valorDacao: valorDacao,
      saldoFinal: saldoFinal,
      valorTotal: valorDacao,
      valorFinal: saldoFinal
    }

    onSelectionChange(dadosSelecionados)
  }, [inscricoesOferecidasSelecionadas, inscricoesCompensarSelecionadas, valoresDacao, onSelectionChange])

  const handleInscricaoOferecidaChange = (inscricaoId: string, checked: boolean) => {
    setInscricoesOferecidasSelecionadas(prev =>
      checked
        ? [...prev, inscricaoId]
        : prev.filter(id => id !== inscricaoId)
    )
  }

  const handleInscricaoCompensarChange = (inscricaoId: string, checked: boolean) => {
    setInscricoesCompensarSelecionadas(prev =>
      checked
        ? [...prev, inscricaoId]
        : prev.filter(id => id !== inscricaoId)
    )
  }

  const selecionarTodasOferecidas = () => {
    setInscricoesOferecidasSelecionadas(valoresDacao.inscricoesOferecidas.map(i => i.id))
  }

  const selecionarTodasCompensar = () => {
    setInscricoesCompensarSelecionadas(valoresDacao.inscricoesCompensar.map(i => i.id))
  }

  const limparSelecaoOferecidas = () => {
    setInscricoesOferecidasSelecionadas([])
  }

  const limparSelecaoCompensar = () => {
    setInscricoesCompensarSelecionadas([])
  }

  const getTipoInscricaoLabel = (tipo: string) => {
    return tipo === 'imobiliaria' ? 'Imobiliária' : 'Econômica'
  }

  const valorOferecido = valoresDacao.inscricoesOferecidas
    .filter(i => inscricoesOferecidasSelecionadas.includes(i.id))
    .reduce((total, i) => total + i.valor, 0)

  const valorCompensar = valoresDacao.inscricoesCompensar
    .filter(i => inscricoesCompensarSelecionadas.includes(i.id))
    .reduce((total, i) => total + i.debitos.reduce((subtotal, d) => subtotal + d.valor, 0), 0)

  const valorDacao = Math.min(valorOferecido, valorCompensar)
  const saldoFinal = Math.abs(valorOferecido - valorCompensar)

  return (
    <div className="space-y-6">
      {/* Resumo da Dação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Resumo da Dação em Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <span className="text-sm text-green-600">Valor Oferecido</span>
              <p className="text-lg font-bold text-green-800">
                R$ {valorOferecido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <span className="text-sm text-red-600">Valor a Compensar</span>
              <p className="text-lg font-bold text-red-800">
                R$ {valorCompensar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-600">Valor da Dação</span>
              <p className="text-lg font-bold text-blue-800">
                R$ {valorDacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <span className="text-sm text-orange-600">Saldo Final</span>
              <p className="text-lg font-bold text-orange-800">
                R$ {saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Indicador do resultado */}
          {saldoFinal > 0 && (
            <div className="mt-4 p-3 rounded-lg border">
              {valorOferecido > valorCompensar ? (
                <div className="flex items-center gap-2 text-green-800">
                  <ArrowRightLeft className="h-4 w-4" />
                  <span>Valor oferecido excede o débito: Diferença a ser compensada ou restituída</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-800">
                  <DollarSign className="h-4 w-4" />
                  <span>Valor oferecido menor que o débito: Saldo remanescente a ser pago</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bens/Imóveis Oferecidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Bens/Imóveis Oferecidos em Dação
          </CardTitle>
          <CardDescription>
            Selecione quais bens/imóveis serão oferecidos em dação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selecionarTodasOferecidas}
            >
              Selecionar Todos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={limparSelecaoOferecidas}
            >
              Limpar Seleção
            </Button>
          </div>

          <div className="space-y-3">
            {valoresDacao.inscricoesOferecidas.map((inscricao) => {
              const isSelected = inscricoesOferecidasSelecionadas.includes(inscricao.id)

              return (
                <div
                  key={inscricao.id}
                  className={`border rounded-lg p-4 ${isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`oferecida-${inscricao.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleInscricaoOferecidaChange(inscricao.id, checked as boolean)}
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

                      {inscricao.descricao && (
                        <p className="text-sm text-gray-600 mb-2">{inscricao.descricao}</p>
                      )}

                      <div className="flex justify-between items-center">
                        <div>
                          {inscricao.dataVencimento && (
                            <span className="text-sm text-gray-500">
                              Data: {new Date(inscricao.dataVencimento).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-lg text-green-600">
                          R$ {inscricao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Débitos a Serem Compensados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Débitos a Serem Compensados
          </CardTitle>
          <CardDescription>
            Selecione quais débitos serão quitados com a dação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selecionarTodasCompensar}
            >
              Selecionar Todas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={limparSelecaoCompensar}
            >
              Limpar Seleção
            </Button>
          </div>

          <div className="space-y-4">
            {valoresDacao.inscricoesCompensar.map((inscricao) => {
              const totalInscricao = inscricao.debitos.reduce((total, debito) => total + debito.valor, 0)
              const isSelected = inscricoesCompensarSelecionadas.includes(inscricao.id)

              return (
                <div
                  key={inscricao.id}
                  className={`border rounded-lg p-4 ${isSelected ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`compensar-${inscricao.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleInscricaoCompensarChange(inscricao.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">Inscrição {inscricao.numeroInscricao}</h4>
                        <Badge variant="outline">
                          {getTipoInscricaoLabel(inscricao.tipoInscricao)}
                        </Badge>
                        {isSelected && (
                          <Badge className="bg-red-100 text-red-800">
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
                          <span className="font-bold text-lg text-red-600">
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
        </CardContent>
      </Card>

      {/* Resultado da Dação */}
      {(inscricoesOferecidasSelecionadas.length > 0 || inscricoesCompensarSelecionadas.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Resultado da Dação em Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg border">
                  <span className="text-sm text-green-600">Valor Oferecido</span>
                  <p className="text-xl font-bold text-green-800">
                    R$ {valorOferecido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg border">
                  <span className="text-sm text-red-600">Valor a Compensar</span>
                  <p className="text-xl font-bold text-red-800">
                    R$ {valorCompensar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg border">
                  <span className="text-sm text-blue-600">Valor da Dação</span>
                  <p className="text-xl font-bold text-blue-800">
                    R$ {valorDacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {saldoFinal > 0 && (
                <div className="p-4 rounded-lg border-2 border-dashed">
                  <div className="text-center">
                    <span className="text-lg font-medium">Saldo Remanescente:</span>
                    <p className="text-2xl font-bold mt-1">
                      R$ {saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      {valorOferecido > valorCompensar
                        ? 'Valor excedente da dação'
                        : 'Valor ainda devido pelo contribuinte'
                      }
                    </p>
                  </div>
                </div>
              )}

              {valorDacao > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h5 className="font-medium text-blue-900 mb-2">Detalhes do Acordo:</h5>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>• Transferência de {inscricoesOferecidasSelecionadas.length} bem(ns)/imóvel(is)</p>
                    <p>• Quitação de {inscricoesCompensarSelecionadas.length} inscrição(ões)</p>
                    <p>• Valor total da dação: R$ {valorDacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
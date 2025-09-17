'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Calculator, FileText, DollarSign, Check, Plus, Minus } from 'lucide-react'

interface Credito {
  id: string
  tipo: string
  numero: string
  valor: number
  dataVencimento?: string
  descricao?: string
}

interface Debito {
  descricao: string
  valor: number
  dataVencimento: string
}

interface InscricaoCompensacao {
  id: string
  numeroInscricao: string
  tipoInscricao: string
  debitos: Debito[]
}

interface ValoresCompensacao {
  creditos: Credito[]
  inscricoes: InscricaoCompensacao[]
}

interface DadosSelecionadosCompensacao {
  valorTotal: number
  valorFinal: number
  [key: string]: unknown
}

interface CompensacaoSectionProps {
  valoresCompensacao: ValoresCompensacao
  onSelectionChange: (dadosSelecionados: DadosSelecionadosCompensacao) => void
}

export default function CompensacaoSection({
  valoresCompensacao,
  onSelectionChange
}: CompensacaoSectionProps) {
  const [creditosSelecionados, setCreditosSelecionados] = useState<string[]>([])
  const [inscricoesSelecionadas, setInscricoesSelecionadas] = useState<string[]>([])

  // Calcular totais baseado na seleção
  useEffect(() => {
    const valorCreditosSelecionados = valoresCompensacao.creditos
      .filter(credito => creditosSelecionados.includes(credito.id))
      .reduce((total, credito) => total + credito.valor, 0)

    const valorInscricoesSelecionadas = valoresCompensacao.inscricoes
      .filter(inscricao => inscricoesSelecionadas.includes(inscricao.id))
      .reduce((total, inscricao) => {
        return total + inscricao.debitos.reduce((subtotal, debito) => subtotal + debito.valor, 0)
      }, 0)

    const valorCompensacao = Math.min(valorCreditosSelecionados, valorInscricoesSelecionadas)
    const saldoFinal = Math.abs(valorCreditosSelecionados - valorInscricoesSelecionadas)

    const dadosSelecionados: DadosSelecionadosCompensacao = {
      valorTotal: valorCompensacao,
      valorFinal: saldoFinal,
      creditosSelecionados: creditosSelecionados,
      inscricoesSelecionadas: inscricoesSelecionadas,
      valorCreditos: valorCreditosSelecionados,
      valorDebitos: valorInscricoesSelecionadas,
      valorCompensacao: valorCompensacao,
      saldoFinal: saldoFinal
    }

    onSelectionChange(dadosSelecionados)
  }, [creditosSelecionados, inscricoesSelecionadas, valoresCompensacao, onSelectionChange])

  const handleCreditoChange = (creditoId: string, checked: boolean) => {
    setCreditosSelecionados(prev =>
      checked
        ? [...prev, creditoId]
        : prev.filter(id => id !== creditoId)
    )
  }

  const handleInscricaoChange = (inscricaoId: string, checked: boolean) => {
    setInscricoesSelecionadas(prev =>
      checked
        ? [...prev, inscricaoId]
        : prev.filter(id => id !== inscricaoId)
    )
  }

  const selecionarTodosCreditos = () => {
    setCreditosSelecionados(valoresCompensacao.creditos.map(c => c.id))
  }

  const selecionarTodasInscricoes = () => {
    setInscricoesSelecionadas(valoresCompensacao.inscricoes.map(i => i.id))
  }

  const limparSelecaoCreditos = () => {
    setCreditosSelecionados([])
  }

  const limparSelecaoInscricoes = () => {
    setInscricoesSelecionadas([])
  }

  const getTipoCreditoLabel = (tipo: string) => {
    switch (tipo) {
      case 'precatorio': return 'Precatório'
      case 'credito_tributario': return 'Crédito Tributário'
      case 'alvara_judicial': return 'Alvará Judicial'
      case 'outro': return 'Outro'
      default: return tipo
    }
  }

  const getTipoInscricaoLabel = (tipo: string) => {
    return tipo === 'imobiliaria' ? 'Imobiliária' : 'Econômica'
  }

  const valorCreditosSelecionados = valoresCompensacao.creditos
    .filter(c => creditosSelecionados.includes(c.id))
    .reduce((total, c) => total + c.valor, 0)

  const valorInscricoesSelecionadas = valoresCompensacao.inscricoes
    .filter(i => inscricoesSelecionadas.includes(i.id))
    .reduce((total, i) => total + i.debitos.reduce((subtotal, d) => subtotal + d.valor, 0), 0)

  const valorCompensacao = Math.min(valorCreditosSelecionados, valorInscricoesSelecionadas)
  const saldoFinal = Math.abs(valorCreditosSelecionados - valorInscricoesSelecionadas)

  return (
    <div className="space-y-6">
      {/* Resumo da Compensação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Resumo da Compensação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <span className="text-sm text-green-600">Créditos Selecionados</span>
              <p className="text-lg font-bold text-green-800">
                R$ {valorCreditosSelecionados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <span className="text-sm text-red-600">Débitos Selecionados</span>
              <p className="text-lg font-bold text-red-800">
                R$ {valorInscricoesSelecionadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-600">Valor Compensado</span>
              <p className="text-lg font-bold text-blue-800">
                R$ {valorCompensacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg">
              <span className="text-sm text-orange-600">Saldo Final</span>
              <p className="text-lg font-bold text-orange-800">
                R$ {saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Indicador do tipo de saldo */}
          {saldoFinal > 0 && (
            <div className="mt-4 p-3 rounded-lg border">
              {valorCreditosSelecionados > valorInscricoesSelecionadas ? (
                <div className="flex items-center gap-2 text-green-800">
                  <Plus className="h-4 w-4" />
                  <span>Saldo credor: Município deve restituir ao contribuinte</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-800">
                  <Minus className="h-4 w-4" />
                  <span>Saldo devedor: Contribuinte deve pagar ao município</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Créditos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Créditos para Compensação
          </CardTitle>
          <CardDescription>
            Selecione quais créditos serão utilizados na compensação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selecionarTodosCreditos}
            >
              Selecionar Todos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={limparSelecaoCreditos}
            >
              Limpar Seleção
            </Button>
          </div>

          <div className="space-y-3">
            {valoresCompensacao.creditos.map((credito) => {
              const isSelected = creditosSelecionados.includes(credito.id)

              return (
                <div
                  key={credito.id}
                  className={`border rounded-lg p-4 ${isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`credito-${credito.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleCreditoChange(credito.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{credito.numero}</h4>
                        <Badge variant="outline">
                          {getTipoCreditoLabel(credito.tipo)}
                        </Badge>
                        {isSelected && (
                          <Badge className="bg-green-100 text-green-800">
                            <Check className="h-3 w-3 mr-1" />
                            Selecionado
                          </Badge>
                        )}
                      </div>

                      {credito.descricao && (
                        <p className="text-sm text-gray-600 mb-2">{credito.descricao}</p>
                      )}

                      <div className="flex justify-between items-center">
                        <div>
                          {credito.dataVencimento && (
                            <span className="text-sm text-gray-500">
                              Vencimento: {new Date(credito.dataVencimento).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-lg text-green-600">
                          R$ {credito.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

      {/* Lista de Inscrições */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Inscrições para Compensação
          </CardTitle>
          <CardDescription>
            Selecione quais inscrições serão compensadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selecionarTodasInscricoes}
            >
              Selecionar Todas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={limparSelecaoInscricoes}
            >
              Limpar Seleção
            </Button>
          </div>

          <div className="space-y-4">
            {valoresCompensacao.inscricoes.map((inscricao) => {
              const totalInscricao = inscricao.debitos.reduce((total, debito) => total + debito.valor, 0)
              const isSelected = inscricoesSelecionadas.includes(inscricao.id)

              return (
                <div
                  key={inscricao.id}
                  className={`border rounded-lg p-4 ${isSelected ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
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

      {/* Resultado da Compensação */}
      {(creditosSelecionados.length > 0 || inscricoesSelecionadas.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Resultado da Compensação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg border">
                  <span className="text-sm text-green-600">Total de Créditos</span>
                  <p className="text-xl font-bold text-green-800">
                    R$ {valorCreditosSelecionados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg border">
                  <span className="text-sm text-red-600">Total de Débitos</span>
                  <p className="text-xl font-bold text-red-800">
                    R$ {valorInscricoesSelecionadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg border">
                  <span className="text-sm text-blue-600">Valor Compensado</span>
                  <p className="text-xl font-bold text-blue-800">
                    R$ {valorCompensacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                      {valorCreditosSelecionados > valorInscricoesSelecionadas
                        ? 'A ser restituído ao contribuinte'
                        : 'A ser pago pelo contribuinte'
                      }
                    </p>
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
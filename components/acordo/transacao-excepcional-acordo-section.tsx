'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calculator, FileText, DollarSign, CreditCard, Plus, Edit3, Trash2 } from 'lucide-react'

interface InscricaoDebito {
  id: string
  descricao: string
  valor: number
  dataVencimento: string
  valorOriginal?: number
}

interface InscricaoTransacao {
  id: string
  numeroInscricao: string
  tipoInscricao: string
  debitos: InscricaoDebito[]
  selecionada?: boolean
  debitosSelecionados?: string[]
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

interface DadosSelecionadosTransacao {
  valorTotal: number
  valorFinal: number
  metodoPagamento?: string
  numeroParcelas?: number
  [key: string]: unknown
}

interface TransacaoExcepcionalAcordoSectionProps {
  valoresTransacao: ValoresTransacao
  onSelectionChange: (dadosSelecionados: DadosSelecionadosTransacao) => void
}

export default function TransacaoExcepcionalAcordoSection({
  valoresTransacao,
  onSelectionChange
}: TransacaoExcepcionalAcordoSectionProps) {
  // Estado para gerenciar as inscrições em memória (inicialmente cópia dos valores)
  const [inscricoesAcordo, setInscricoesAcordo] = useState<InscricaoTransacao[]>(
    valoresTransacao.inscricoes.map(inscricao => ({
      ...inscricao,
      debitos: [...inscricao.debitos] // Cópia profunda dos débitos
    }))
  )
  const [propostaFinal, setPropostaFinal] = useState(valoresTransacao.proposta)
  const [observacoesAcordo, setObservacoesAcordo] = useState('')
  const [showInscricaoModal, setShowInscricaoModal] = useState(false)
  const [editingInscricao, setEditingInscricao] = useState<InscricaoTransacao | null>(null)
  const [inscricaoForm, setInscricaoForm] = useState({
    numeroInscricao: '',
    tipoInscricao: 'imobiliaria' as 'imobiliaria' | 'economica',
    debitos: [] as InscricaoDebito[]
  })

  // Calcular valores dinâmicos para o resumo
  const valorTotalInscricoes = inscricoesAcordo.reduce((total, inscricao) => {
    const valorInscricao = inscricao.debitos.reduce((subtotal, debito) => subtotal + debito.valor, 0)
    return total + valorInscricao
  }, 0)

  const valorProposto = propostaFinal.valorTotalProposto
  const valorDesconto = valorTotalInscricoes - valorProposto
  const percentualDesconto = valorTotalInscricoes > 0 ? (valorDesconto / valorTotalInscricoes) * 100 : 0

  // Calcular totais baseado nas inscrições em memória
  useEffect(() => {
    const dadosAcordo: DadosSelecionadosTransacao = {
      valorTotal: propostaFinal.valorTotalProposto,
      valorFinal: propostaFinal.valorTotalProposto,
      metodoPagamento: propostaFinal.metodoPagamento,
      numeroParcelas: propostaFinal.quantidadeParcelas,
      inscricoesAcordo: inscricoesAcordo,
      valorInscricoes: valorTotalInscricoes,
      propostaFinal: propostaFinal,
      valorEntrada: propostaFinal.valorEntrada,
      observacoesAcordo: observacoesAcordo
    }


    onSelectionChange(dadosAcordo)
  }, [inscricoesAcordo, propostaFinal, observacoesAcordo, valorTotalInscricoes, onSelectionChange])

  const openInscricaoModal = () => {
    setEditingInscricao(null)
    setInscricaoForm({
      numeroInscricao: '',
      tipoInscricao: 'imobiliaria',
      debitos: []
    })
    setShowInscricaoModal(true)
  }

  const abrirModalEditarInscricao = (inscricao: InscricaoTransacao) => {
    setEditingInscricao(inscricao)
    setInscricaoForm({
      numeroInscricao: inscricao.numeroInscricao,
      tipoInscricao: inscricao.tipoInscricao as 'economica' | 'imobiliaria',
      debitos: [...inscricao.debitos]
    })
    setShowInscricaoModal(true)
  }

  const salvarInscricao = () => {
    if (inscricaoForm.numeroInscricao.trim() === '') return

    if (editingInscricao) {
      // Editando inscrição existente
      setInscricoesAcordo(prev => prev.map(inscricao =>
        inscricao.id === editingInscricao.id
          ? {
            ...inscricao,
            numeroInscricao: inscricaoForm.numeroInscricao,
            tipoInscricao: inscricaoForm.tipoInscricao,
            debitos: inscricaoForm.debitos
          }
          : inscricao
      ))
    } else {
      // Adicionando nova inscrição
      const novaInscricao: InscricaoTransacao = {
        id: `nova-${Date.now()}`,
        numeroInscricao: inscricaoForm.numeroInscricao,
        tipoInscricao: inscricaoForm.tipoInscricao,
        debitos: inscricaoForm.debitos
      }
      setInscricoesAcordo(prev => [...prev, novaInscricao])
    }

    setShowInscricaoModal(false)
    setEditingInscricao(null)
  }

  const removerInscricao = (inscricaoId: string) => {
    setInscricoesAcordo(prev => prev.filter(i => i.id !== inscricaoId))
  }

  const addDebito = () => {
    const novoDebito: InscricaoDebito = {
      id: `debito-${Date.now()}`,
      descricao: '',
      valor: 0,
      dataVencimento: '',
      valorOriginal: 0
    }
    setInscricaoForm(prev => ({
      ...prev,
      debitos: [...prev.debitos, novoDebito]
    }))
  }

  const removeDebito = (index: number) => {
    setInscricaoForm(prev => ({
      ...prev,
      debitos: prev.debitos.filter((_, i) => i !== index)
    }))
  }

  const formatCurrency = (value: string) => {
    // Remove tudo que não for número
    const numericValue = value.replace(/\D/g, '')

    // Se não há número, retorna vazio
    if (!numericValue) return ''

    // Converte para centavos
    const cents = parseInt(numericValue, 10)

    // Divide por 100 para ter o valor em reais
    const reais = cents / 100

    // Formata no padrão brasileiro
    return reais.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const parseCurrencyToNumber = (value: string): number => {
    // Remove tudo que não for número ou vírgula
    const cleanValue = value.replace(/[^\d,]/g, '')

    // Substitui vírgula por ponto para parseFloat
    const numericValue = cleanValue.replace(',', '.')

    return parseFloat(numericValue) || 0
  }

  const updateDebito = (index: number, field: keyof InscricaoDebito, value: string | number) => {
    setInscricaoForm(prev => ({
      ...prev,
      debitos: prev.debitos.map((debito, i) =>
        i === index
          ? {
              ...debito,
              [field]: field === 'valor'
                ? parseCurrencyToNumber(value as string)
                : value
            }
          : debito
      )
    }))
  }

  const getTipoInscricaoLabel = (tipo: string) => {
    return tipo === 'imobiliaria' ? 'Imobiliária' : 'Econômica'
  }


  return (
    <div className="space-y-6">
      {/* Resumo da Transação Original (Proposta Inicial) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Resumo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Total a Negociar</span>
              </div>
              <p className="text-lg font-bold text-green-700">
                R$ {valorTotalInscricoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-green-600">
                {inscricoesAcordo.length} {inscricoesAcordo.length === 1 ? 'inscrição' : 'inscrições'}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Valor Proposto</span>
              </div>
              <p className="text-lg font-bold text-blue-700">
                R$ {valorProposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-blue-600">
                {propostaFinal.metodoPagamento === 'a_vista' ? 'À vista' : `${propostaFinal.quantidadeParcelas}x`}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-800">Desconto</span>
              </div>
              <p className="text-lg font-bold text-gray-700">
                R$ {Math.max(0, valorDesconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-600">
                {Math.max(0, percentualDesconto).toFixed(1)}% de desconto
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inscrições a Negociar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Inscrições Incluídas no Acordo
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openInscricaoModal}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Inscrição
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {inscricoesAcordo.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">
                Nenhuma inscrição adicionada ainda
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Clique em &quot;Adicionar Inscrição&quot; para começar
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inscricoesAcordo.map((inscricao) => {
                const totalDebitos = inscricao.debitos.reduce((total, debito) => total + debito.valor, 0)

                return (
                  <div key={inscricao.id} className="p-4 border rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
                          <FileText className="h-4 w-4 text-green-700" />
                        </div>
                        <div>
                          <h5 className="font-medium text-green-800">{inscricao.numeroInscricao || 'Sem número'}</h5>
                          <p className="text-xs text-green-600 capitalize">{getTipoInscricaoLabel(inscricao.tipoInscricao)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirModalEditarInscricao(inscricao)}
                          className="h-6 w-6 p-0 text-green-700 hover:text-green-800 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removerInscricao(inscricao.id)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-green-600">
                        {inscricao.debitos.length} débito(s)
                      </p>
                      <p className="text-lg font-bold text-green-600">
                        Total: R$ {totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {inscricao.debitos.length > 0 && (
                        <div className="text-xs text-green-600 space-y-0.5">
                          {inscricao.debitos.slice(0, 2).map((debito, index) => (
                            <p key={index}>• {debito.descricao || 'Sem descrição'}</p>
                          ))}
                          {inscricao.debitos.length > 2 && (
                            <p>• +{inscricao.debitos.length - 2} mais...</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Inscrição */}
      <Dialog open={showInscricaoModal} onOpenChange={setShowInscricaoModal}>
        <DialogContent className="w-[95vw] !max-w-[1200px] max-h-[90vh] overflow-hidden" style={{ width: '95vw', maxWidth: '1200px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              {editingInscricao ? 'Editar Inscrição' : 'Adicionar Inscrição'}
            </DialogTitle>
            <DialogDescription>
              {editingInscricao ? 'Edite as informações da inscrição e seus débitos' : 'Adicione uma nova inscrição com múltiplos débitos'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modal-inscricao-numero">Número da Inscrição <span className="text-red-500">*</span></Label>
                <Input
                  id="modal-inscricao-numero"
                  value={inscricaoForm.numeroInscricao}
                  onChange={(e) => setInscricaoForm({ ...inscricaoForm, numeroInscricao: e.target.value })}
                  placeholder="Ex: 123.456.789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-inscricao-tipo">Tipo de Inscrição <span className="text-red-500">*</span></Label>
                <select
                  id="modal-inscricao-tipo"
                  value={inscricaoForm.tipoInscricao}
                  onChange={(e) => setInscricaoForm({ ...inscricaoForm, tipoInscricao: e.target.value as 'imobiliaria' | 'economica' })}
                  className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="imobiliaria">Imobiliária</option>
                  <option value="economica">Econômica</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Débitos da Inscrição</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDebito}
                  className="cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Débito
                </Button>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {inscricaoForm.debitos.map((debito, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <h6 className="text-sm font-medium">Débito {index + 1}</h6>
                      {inscricaoForm.debitos.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDebito(index)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`debito-desc-${index}`}>Descrição <span className="text-red-500">*</span></Label>
                        <Input
                          id={`debito-desc-${index}`}
                          value={debito.descricao}
                          onChange={(e) => updateDebito(index, 'descricao', e.target.value)}
                          placeholder="Ex: IPTU 2024"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`debito-valor-${index}`}>Valor Lançado <span className="text-red-500">*</span></Label>
                        <Input
                          id={`debito-valor-${index}`}
                          type="text"
                          value={debito.valor ? debito.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                          onChange={(e) => {
                            const formattedValue = formatCurrency(e.target.value)
                            const numericValue = parseCurrencyToNumber(formattedValue)
                            updateDebito(index, 'valor', formattedValue)
                            // Update the form state with the formatted value for display
                            setInscricaoForm(prev => ({
                              ...prev,
                              debitos: prev.debitos.map((d, i) =>
                                i === index ? { ...d, valor: numericValue } : d
                              )
                            }))
                          }}
                          placeholder="Ex: 1.500,00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`debito-vencimento-${index}`}>Data de Vencimento <span className="text-red-500">*</span></Label>
                        <Input
                          id={`debito-vencimento-${index}`}
                          type="date"
                          value={debito.dataVencimento}
                          onChange={(e) => updateDebito(index, 'dataVencimento', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInscricaoModal(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={salvarInscricao}
                disabled={!inscricaoForm.numeroInscricao.trim()}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                {editingInscricao ? 'Salvar Alterações' : 'Adicionar Inscrição'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Proposta Final do Acordo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Proposta Final
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valorTotalProposto">Valor Total Proposto <span className="text-red-500">*</span></Label>
              <Input
                id="valorTotalProposto"
                type="text"
                value={propostaFinal.valorTotalProposto ? propostaFinal.valorTotalProposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                onChange={(e) => {
                  const formattedValue = formatCurrency(e.target.value)
                  const numericValue = parseCurrencyToNumber(formattedValue)
                  setPropostaFinal(prev => ({
                    ...prev,
                    valorTotalProposto: numericValue
                  }))
                }}
                placeholder="Ex: 120.000,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="metodoPagamento">Método de Pagamento <span className="text-red-500">*</span></Label>
              <select
                id="metodoPagamento"
                value={propostaFinal.metodoPagamento}
                onChange={(e) => setPropostaFinal(prev => ({
                  ...prev,
                  metodoPagamento: e.target.value
                }))}
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="parcelado">Parcelado</option>
                <option value="a_vista">À Vista</option>
              </select>
            </div>
          </div>

          <div className={`grid grid-cols-1 ${propostaFinal.metodoPagamento === 'a_vista' ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
            <div className={`space-y-2 ${propostaFinal.metodoPagamento === 'a_vista' ? 'md:col-span-1' : ''}`}>
              <Label htmlFor="valorEntrada">Valor de Entrada</Label>
              <Input
                id="valorEntrada"
                type="text"
                value={propostaFinal.valorEntrada ? propostaFinal.valorEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                onChange={(e) => {
                  const formattedValue = formatCurrency(e.target.value)
                  const numericValue = parseCurrencyToNumber(formattedValue)
                  setPropostaFinal(prev => ({
                    ...prev,
                    valorEntrada: numericValue
                  }))
                }}
                placeholder="Ex: 20.000,00"
              />
            </div>

            {propostaFinal.metodoPagamento === 'parcelado' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="quantidadeParcelas">Quantidade de Parcelas (máx. 120)</Label>
                  <Input
                    id="quantidadeParcelas"
                    type="text"
                    value={propostaFinal.quantidadeParcelas}
                    onChange={(e) => setPropostaFinal(prev => ({
                      ...prev,
                      quantidadeParcelas: parseInt(e.target.value) || 1
                    }))}
                    placeholder="Ex: 12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valorParcela">Valor da Parcela</Label>
                  <Input
                    id="valorParcela"
                    type="number"
                    step="0.01"
                    value={((propostaFinal.valorTotalProposto - propostaFinal.valorEntrada) / propostaFinal.quantidadeParcelas).toFixed(2)}
                    disabled={true}
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500">
                    Calculado automaticamente: (Total - Entrada) ÷ Parcelas
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Simulação de Pagamento */}
          {propostaFinal.valorTotalProposto > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h5 className="font-medium mb-3 text-blue-800">Simulação do Pagamento:</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">Valor Original:</span>
                  <p className="font-medium text-blue-700">
                    R$ {valorTotalInscricoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <span className="text-blue-600">Valor Proposto:</span>
                  <p className="font-medium text-blue-700">
                    R$ {propostaFinal.valorTotalProposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <span className="text-blue-600">Desconto:</span>
                  <p className="font-medium text-blue-700">
                    R$ {Math.max(0, valorDesconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <span className="text-blue-600">Valor de Entrada:</span>
                  <p className="font-medium text-blue-700">
                    R$ {(propostaFinal.valorEntrada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <span className="text-blue-600">
                    {propostaFinal.metodoPagamento === 'parcelado' ? 'Valor das Parcelas:' : 'Valor Total:'}
                  </span>
                  <p className="font-medium text-blue-700">
                    {propostaFinal.metodoPagamento === 'parcelado' && propostaFinal.quantidadeParcelas > 0
                      ? `${propostaFinal.quantidadeParcelas}x de R$ ${((propostaFinal.valorTotalProposto - propostaFinal.valorEntrada) / propostaFinal.quantidadeParcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : `R$ ${propostaFinal.valorTotalProposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    }
                  </p>
                </div>
                <div>
                  <span className="text-blue-600">Total Final:</span>
                  <p className="font-bold text-blue-700">
                    R$ {propostaFinal.valorTotalProposto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Observações do Acordo */}
      <Card>
        <CardHeader>
          <CardTitle>Observações do Acordo</CardTitle>
          <CardDescription>
            Adicione observações específicas sobre este acordo de transação excepcional
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Descreva detalhes específicos sobre as negociações, condições especiais, ou qualquer informação relevante para este acordo..."
            value={observacoesAcordo}
            onChange={(e) => setObservacoesAcordo(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  )
}
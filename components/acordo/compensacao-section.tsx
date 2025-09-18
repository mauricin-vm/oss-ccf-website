'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calculator, FileText, DollarSign, Edit, Trash2, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

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

  // Estados para os modais
  const [showCreditoModal, setShowCreditoModal] = useState(false)
  const [showInscricaoModal, setShowInscricaoModal] = useState(false)
  const [editingCredito, setEditingCredito] = useState<{ index: number, credito: Credito } | null>(null)
  const [editingInscricao, setEditingInscricao] = useState<{ index: number, inscricao: InscricaoCompensacao } | null>(null)

  // Listas em memória para os novos itens
  const [creditosAdicionados, setCreditosAdicionados] = useState<Credito[]>([])
  const [inscricoesAdicionadas, setInscricoesAdicionadas] = useState<InscricaoCompensacao[]>([])
  const [observacoesAcordo, setObservacoesAcordo] = useState('')
  const [isLoadingData, setIsLoadingData] = useState(true)

  // Estados para formulários dos modais
  const [creditoForm, setCreditoForm] = useState({
    tipo: 'precatorio' as 'precatorio' | 'credito_tributario' | 'alvara_judicial' | 'outro',
    numero: '',
    valor: '',
    dataVencimento: '',
    descricao: ''
  })

  const [inscricaoForm, setInscricaoForm] = useState({
    numeroInscricao: '',
    tipoInscricao: 'imobiliaria' as 'imobiliaria' | 'economica',
    debitos: [{ descricao: '', valor: '', dataVencimento: '' }]
  })


  // Funções utilitárias
  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/\D/g, '')
    if (!numericValue) return ''
    const cents = parseInt(numericValue, 10)
    const reais = cents / 100
    return reais.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const parseCurrencyToNumber = (value: string): number => {
    const cleanValue = value.replace(/[^\d,]/g, '')
    const numericValue = cleanValue.replace(',', '.')
    return parseFloat(numericValue) || 0
  }

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'precatorio': return 'Precatório'
      case 'credito_tributario': return 'Crédito Tributário'
      case 'alvara_judicial': return 'Alvará Judicial'
      case 'outro': return 'Outro'
      default: return tipo
    }
  }

  useEffect(() => {
    // Só enviar dados se não estivermos carregando
    if (isLoadingData) return

    const valorCreditos = creditosAdicionados.reduce((total, credito) => total + credito.valor, 0)
    const valorDebitos = inscricoesAdicionadas.reduce((total, inscricao) => {
      return total + inscricao.debitos.reduce((subtotal, debito) => subtotal + debito.valor, 0)
    }, 0)

    const valorCompensacao = Math.min(valorCreditos, valorDebitos)
    const saldoFinal = Math.abs(valorCreditos - valorDebitos)

    const dadosSelecionados = {
      valorTotal: valorCreditos,
      valorFinal: valorCompensacao,
      creditosAdicionados: creditosAdicionados,
      inscricoesAdicionadas: inscricoesAdicionadas,
      valorCreditos: valorCreditos,
      valorDebitos: valorDebitos,
      valorCompensacao: valorCompensacao,
      saldoFinal: saldoFinal,
      observacoesAcordo: observacoesAcordo
    }

    onSelectionChange(dadosSelecionados)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditosAdicionados, inscricoesAdicionadas, observacoesAcordo, isLoadingData])

  // Carregar dados salvos do banco de dados
  useEffect(() => {
    const carregarDadosSalvos = async () => {
      try {
        // Simular um pequeno delay para mostrar o loading
        await new Promise(resolve => setTimeout(resolve, 500))

        // Os dados já vêm no valoresCompensacao, então vamos usá-los
        if (valoresCompensacao.creditos && valoresCompensacao.creditos.length > 0) {
          setCreditosAdicionados(valoresCompensacao.creditos)
        }

        if (valoresCompensacao.inscricoes && valoresCompensacao.inscricoes.length > 0) {
          setInscricoesAdicionadas(valoresCompensacao.inscricoes)
        }

      } catch (error) {
        console.error('Erro ao carregar dados de compensação:', error)
      } finally {
        setIsLoadingData(false)
      }
    }

    carregarDadosSalvos()
  }, [valoresCompensacao])



  // Funções para gerenciar créditos
  const openCreditoModal = () => {
    setEditingCredito(null)
    setCreditoForm({
      tipo: 'precatorio',
      numero: '',
      valor: '',
      dataVencimento: '',
      descricao: ''
    })
    setShowCreditoModal(true)
  }

  const openEditCreditoModal = (credito: Credito, index: number) => {
    setEditingCredito({ index, credito })
    setCreditoForm({
      tipo: credito.tipo as 'precatorio' | 'credito_tributario' | 'alvara_judicial' | 'outro',
      numero: credito.numero,
      valor: credito.valor ? credito.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
      dataVencimento: credito.dataVencimento || '',
      descricao: credito.descricao || ''
    })
    setShowCreditoModal(true)
  }

  const handleSaveCredito = () => {
    const valor = parseCurrencyToNumber(creditoForm.valor)
    if (!creditoForm.numero || valor <= 0) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    const creditoData: Credito = {
      id: Date.now().toString(), // ID temporário
      tipo: creditoForm.tipo,
      numero: creditoForm.numero,
      valor: valor,
      dataVencimento: creditoForm.dataVencimento,
      descricao: creditoForm.descricao
    }

    if (editingCredito) {
      // Editar crédito existente
      const novosCreditos = [...creditosAdicionados]
      const indexAdicionados = novosCreditos.findIndex(c => c.id === editingCredito.credito.id)
      if (indexAdicionados >= 0) {
        novosCreditos[indexAdicionados] = { ...creditoData, id: editingCredito.credito.id }
        setCreditosAdicionados(novosCreditos)
      }
    } else {
      // Adicionar novo crédito
      setCreditosAdicionados([...creditosAdicionados, creditoData])
    }

    setShowCreditoModal(false)
    toast.success(editingCredito ? 'Crédito atualizado' : 'Crédito adicionado')
  }

  const handleRemoveCredito = (credito: Credito) => {
    if (confirm(`Tem certeza que deseja remover o crédito "${credito.numero}"?`)) {
      setCreditosAdicionados(creditosAdicionados.filter(c => c.id !== credito.id))
      toast.success('Crédito removido')
    }
  }

  // Funções para gerenciar inscrições
  const openInscricaoModal = () => {
    setEditingInscricao(null)
    setInscricaoForm({
      numeroInscricao: '',
      tipoInscricao: 'imobiliaria',
      debitos: [{ descricao: '', valor: '', dataVencimento: '' }]
    })
    setShowInscricaoModal(true)
  }

  const openEditInscricaoModal = (inscricao: InscricaoCompensacao, index: number) => {
    setEditingInscricao({ index, inscricao })
    setInscricaoForm({
      numeroInscricao: inscricao.numeroInscricao,
      tipoInscricao: inscricao.tipoInscricao as 'imobiliaria' | 'economica',
      debitos: inscricao.debitos.map(d => ({
        descricao: d.descricao,
        valor: d.valor ? d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
        dataVencimento: d.dataVencimento
      }))
    })
    setShowInscricaoModal(true)
  }

  const handleSaveInscricao = () => {
    if (!inscricaoForm.numeroInscricao) {
      toast.error('Número da inscrição é obrigatório')
      return
    }

    const debitosValidos = inscricaoForm.debitos.filter(d =>
      d.descricao && d.valor && d.dataVencimento
    )

    if (debitosValidos.length === 0) {
      toast.error('Pelo menos um débito deve ser informado')
      return
    }

    const inscricaoData: InscricaoCompensacao = {
      id: Date.now().toString(), // ID temporário
      numeroInscricao: inscricaoForm.numeroInscricao,
      tipoInscricao: inscricaoForm.tipoInscricao,
      debitos: debitosValidos.map(d => ({
        descricao: d.descricao,
        valor: parseCurrencyToNumber(d.valor),
        dataVencimento: d.dataVencimento
      }))
    }

    if (editingInscricao) {
      // Editar inscrição existente
      const novasInscricoes = [...inscricoesAdicionadas]
      const indexAdicionadas = novasInscricoes.findIndex(i => i.id === editingInscricao.inscricao.id)
      if (indexAdicionadas >= 0) {
        novasInscricoes[indexAdicionadas] = { ...inscricaoData, id: editingInscricao.inscricao.id }
        setInscricoesAdicionadas(novasInscricoes)
      }
    } else {
      // Adicionar nova inscrição
      setInscricoesAdicionadas([...inscricoesAdicionadas, inscricaoData])
    }

    setShowInscricaoModal(false)
    toast.success(editingInscricao ? 'Inscrição atualizada' : 'Inscrição adicionada')
  }

  const handleRemoveInscricao = (inscricao: InscricaoCompensacao) => {
    if (confirm(`Tem certeza que deseja remover a inscrição "${inscricao.numeroInscricao}"?`)) {
      setInscricoesAdicionadas(inscricoesAdicionadas.filter(i => i.id !== inscricao.id))
      toast.success('Inscrição removida')
    }
  }

  const addDebito = () => {
    setInscricaoForm({
      ...inscricaoForm,
      debitos: [...inscricaoForm.debitos, { descricao: '', valor: '', dataVencimento: '' }]
    })
  }

  const removeDebito = (index: number) => {
    if (inscricaoForm.debitos.length > 1) {
      setInscricaoForm({
        ...inscricaoForm,
        debitos: inscricaoForm.debitos.filter((_, i) => i !== index)
      })
    }
  }

  const updateDebito = (index: number, field: string, value: string) => {
    const updatedDebitos = [...inscricaoForm.debitos]
    updatedDebitos[index] = { ...updatedDebitos[index], [field]: value }
    setInscricaoForm({ ...inscricaoForm, debitos: updatedDebitos })
  }


  // Calcular totais baseado nos itens adicionados
  const totalCreditos = creditosAdicionados.reduce((total, c) => total + c.valor, 0)
  const totalDebitos = inscricoesAdicionadas.reduce((total, i) =>
    total + i.debitos.reduce((subtotal, d) => subtotal + d.valor, 0), 0)

  // Se ainda está carregando, mostrar loading
  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Carregando dados de compensação...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Resumo da Compensação */}
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
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Créditos Oferecidos</span>
              </div>
              <p className="text-lg font-bold text-green-700">
                R$ {totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-green-600">
                {creditosAdicionados.length} {creditosAdicionados.length === 1 ? 'crédito' : 'créditos'}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">A Compensar</span>
              </div>
              <p className="text-lg font-bold text-blue-700">
                R$ {totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-blue-600">
                {inscricoesAdicionadas.length} {inscricoesAdicionadas.length === 1 ? 'inscrição' : 'inscrições'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Calculator className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-800">Saldo</span>
              </div>
              <p className={`text-lg font-bold ${totalCreditos >= totalDebitos ? 'text-green-600' : 'text-red-600'}`}>
                R$ {(totalCreditos - totalDebitos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-600">
                {totalCreditos >= totalDebitos ? 'Superávit' : 'Déficit'}
              </p>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Créditos para Compensação */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Créditos para Compensação
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCreditoModal}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Crédito
            </Button>
          </div>
          <CardDescription>
            Créditos que o contribuinte oferece para compensação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {creditosAdicionados.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">
                Nenhum crédito disponível ainda
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Clique em &quot;Adicionar Crédito&quot; para começar
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {creditosAdicionados.map((credito) => {
                return (
                  <div key={credito.id} className="p-4 border rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
                          <DollarSign className="h-4 w-4 text-green-700" />
                        </div>
                        <div>
                          <h5 className="font-medium text-green-800">{getTipoLabel(credito.tipo)}</h5>
                          <p className="text-xs text-green-600">{credito.numero || 'Sem número'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditCreditoModal(credito, 0)}
                          className="h-6 w-6 p-0 text-green-700 hover:text-green-800 cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCredito(credito)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-lg font-bold text-green-700">
                        R$ {credito.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {credito.dataVencimento && (
                        <p className="text-xs text-green-600">
                          Vence: {new Date(credito.dataVencimento).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                      {credito.descricao && (
                        <p className="text-xs text-green-600">
                          {credito.descricao}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inscrições a Compensar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Inscrições a Compensar
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
          <CardDescription>
            Inscrições municipais que serão compensadas pelos créditos oferecidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inscricoesAdicionadas.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">
                Nenhuma inscrição disponível ainda
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Clique em &quot;Adicionar Inscrição&quot; para começar
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inscricoesAdicionadas.map((inscricao) => {
                const totalDebitos = inscricao.debitos.reduce((total, debito) => total + debito.valor, 0)

                return (
                  <div key={inscricao.id} className="p-4 border rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
                          <FileText className="h-4 w-4 text-blue-700" />
                        </div>
                        <div>
                          <h5 className="font-medium text-blue-800">{inscricao.numeroInscricao || 'Sem número'}</h5>
                          <p className="text-xs text-blue-600 capitalize">{inscricao.tipoInscricao}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditInscricaoModal(inscricao, 0)}
                          className="h-6 w-6 p-0 text-blue-700 hover:text-blue-800 cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveInscricao(inscricao)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-blue-600">
                        {inscricao.debitos.length} débito(s)
                      </p>
                      <p className="text-lg font-bold text-blue-600">
                        Total: R$ {totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {inscricao.debitos.length > 0 && (
                        <div className="text-xs text-blue-600 space-y-0.5">
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

      {/* Observações do Acordo */}
      <Card>
        <CardHeader>
          <CardTitle>Observações do Acordo</CardTitle>
          <CardDescription>
            Adicione observações específicas sobre este acordo de compensação
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

      {/* Modal de Crédito */}
      <Dialog open={showCreditoModal} onOpenChange={setShowCreditoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              {editingCredito ? 'Editar Crédito' : 'Adicionar Crédito'}
            </DialogTitle>
            <DialogDescription>
              {editingCredito ? 'Edite as informações do crédito' : 'Adicione as informações do crédito'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-tipo">Tipo de Crédito <span className="text-red-500">*</span></Label>
              <select
                id="modal-tipo"
                value={creditoForm.tipo}
                onChange={(e) => setCreditoForm({ ...creditoForm, tipo: e.target.value as 'precatorio' | 'credito_tributario' | 'alvara_judicial' | 'outro' })}
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="precatorio">Precatório</option>
                <option value="credito_tributario">Crédito Tributário</option>
                <option value="alvara_judicial">Alvará Judicial</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-numero">Número do Crédito <span className="text-red-500">*</span></Label>
              <Input
                id="modal-numero"
                value={creditoForm.numero}
                onChange={(e) => setCreditoForm({ ...creditoForm, numero: e.target.value })}
                placeholder="Ex: PRE-2024-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-valor">Valor <span className="text-red-500">*</span></Label>
              <Input
                id="modal-valor"
                type="text"
                value={creditoForm.valor}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value)
                  setCreditoForm({ ...creditoForm, valor: formatted })
                }}
                placeholder="Ex: 50.000,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-vencimento">Data de Vencimento</Label>
              <Input
                id="modal-vencimento"
                type="date"
                value={creditoForm.dataVencimento}
                onChange={(e) => setCreditoForm({ ...creditoForm, dataVencimento: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-descricao">Descrição</Label>
              <Textarea
                id="modal-descricao"
                rows={2}
                value={creditoForm.descricao}
                onChange={(e) => setCreditoForm({ ...creditoForm, descricao: e.target.value })}
                placeholder="Informações adicionais sobre o crédito..."
              />
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreditoModal(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveCredito}
                disabled={!creditoForm.numero || !creditoForm.valor}
                className="cursor-pointer"
              >
                {editingCredito ? 'Atualizar' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Inscrição */}
      <Dialog open={showInscricaoModal} onOpenChange={setShowInscricaoModal}>
        <DialogContent className="w-[95vw] !max-w-[1200px] max-h-[90vh] overflow-hidden" style={{ width: '95vw', maxWidth: '1200px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
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
                          value={debito.valor}
                          onChange={(e) => {
                            const formatted = formatCurrency(e.target.value)
                            updateDebito(index, 'valor', formatted)
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

              <div className="p-3 bg-blue-50 rounded border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-blue-800">Total dos Débitos:</span>
                  <span className="text-lg font-bold text-blue-700">
                    R$ {inscricaoForm.debitos.reduce((total, d) => total + parseCurrencyToNumber(d.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInscricaoModal(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveInscricao}
                disabled={!inscricaoForm.numeroInscricao || inscricaoForm.debitos.some(d => !d.descricao || !d.valor || !d.dataVencimento)}
                className="cursor-pointer"
              >
                {editingInscricao ? 'Atualizar' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
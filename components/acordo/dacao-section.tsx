'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calculator, FileText, Home, Edit, Trash2, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

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

interface DadosSelecionadosDacao {
  valorTotal: number
  valorFinal: number
  [key: string]: unknown
}

interface DacaoSectionProps {
  valoresDacao: ValoresDacao
  onSelectionChange: (dadosSelecionados: DadosSelecionadosDacao) => void
}

export default function DacaoSection({
  valoresDacao,
  onSelectionChange
}: DacaoSectionProps) {

  // Estados para os modais
  const [showInscricaoOferecidaModal, setShowInscricaoOferecidaModal] = useState(false)
  const [showInscricaoCompensarModal, setShowInscricaoCompensarModal] = useState(false)
  const [editingInscricaoOferecida, setEditingInscricaoOferecida] = useState<{ index: number, inscricao: InscricaoOferecida } | null>(null)
  const [editingInscricaoCompensar, setEditingInscricaoCompensar] = useState<{ index: number, inscricao: InscricaoCompensar } | null>(null)

  // Listas em memória para os novos itens
  const [inscricoesOferecidasAdicionadas, setInscricoesOferecidasAdicionadas] = useState<InscricaoOferecida[]>([])
  const [inscricoesCompensarAdicionadas, setInscricoesCompensarAdicionadas] = useState<InscricaoCompensar[]>([])
  const [observacoesAcordo, setObservacoesAcordo] = useState('')
  const [isLoadingData, setIsLoadingData] = useState(true)

  // Estados para formulários dos modais
  const [inscricaoOferecidaForm, setInscricaoOferecidaForm] = useState({
    numeroInscricao: '',
    tipoInscricao: 'imobiliaria' as 'imobiliaria' | 'economica',
    valor: '',
    dataVencimento: '',
    descricao: ''
  })

  const [inscricaoCompensarForm, setInscricaoCompensarForm] = useState({
    numeroInscricao: '',
    tipoInscricao: 'imobiliaria' as 'imobiliaria' | 'economica',
    debitos: [{ descricao: '', valor: '', dataVencimento: '' }]
  })


  // Enviar dados para o formulário principal sempre que houver mudanças
  useEffect(() => {
    // Só enviar dados se não estivermos carregando
    if (isLoadingData) return


    const valorOferecido = inscricoesOferecidasAdicionadas.reduce((total, inscricao) => total + inscricao.valor, 0)
    const valorCompensar = inscricoesCompensarAdicionadas.reduce((total, inscricao) => {
      return total + inscricao.debitos.reduce((subtotal, debito) => subtotal + debito.valor, 0)
    }, 0)

    const valorDacao = Math.min(valorOferecido, valorCompensar)
    const saldoFinal = Math.abs(valorOferecido - valorCompensar)

    const dadosSelecionados = {
      valorTotal: valorOferecido,
      valorFinal: valorDacao,
      inscricoesOferecidasAdicionadas: inscricoesOferecidasAdicionadas,
      inscricoesCompensarAdicionadas: inscricoesCompensarAdicionadas,
      valorOferecido: valorOferecido,
      valorCompensar: valorCompensar,
      valorDacao: valorDacao,
      saldoFinal: saldoFinal,
      observacoesAcordo: observacoesAcordo
    }

    onSelectionChange(dadosSelecionados)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inscricoesOferecidasAdicionadas, inscricoesCompensarAdicionadas, observacoesAcordo, isLoadingData])

  // Carregar dados existentes quando os valores forem recebidos
  useEffect(() => {
    const carregarDadosSalvos = async () => {
      try {
        setIsLoadingData(true)

        // Carregar inscrições oferecidas
        if (valoresDacao.inscricoesOferecidas && valoresDacao.inscricoesOferecidas.length > 0) {
          setInscricoesOferecidasAdicionadas(valoresDacao.inscricoesOferecidas)
        }

        // Carregar inscrições a compensar
        if (valoresDacao.inscricoesCompensar && valoresDacao.inscricoesCompensar.length > 0) {
          setInscricoesCompensarAdicionadas(valoresDacao.inscricoesCompensar)
        }

      } catch (error) {
        console.error('Erro ao carregar dados de dação:', error)
      } finally {
        setIsLoadingData(false)
      }
    }

    carregarDadosSalvos()
  }, [valoresDacao])


  // Funções de formatação de moeda
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

  // Funções dos modais de Inscrições Oferecidas
  const openInscricaoOferecidaModal = () => {
    setInscricaoOferecidaForm({
      numeroInscricao: '',
      tipoInscricao: 'imobiliaria',
      valor: '',
      dataVencimento: '',
      descricao: ''
    })
    setEditingInscricaoOferecida(null)
    setShowInscricaoOferecidaModal(true)
  }

  const openEditInscricaoOferecidaModal = (index: number) => {
    const inscricao = inscricoesOferecidasAdicionadas[index]
    setEditingInscricaoOferecida({ index, inscricao })
    setInscricaoOferecidaForm({
      numeroInscricao: inscricao.numeroInscricao,
      tipoInscricao: inscricao.tipoInscricao as 'imobiliaria' | 'economica',
      valor: inscricao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      dataVencimento: inscricao.dataVencimento || '',
      descricao: inscricao.descricao || ''
    })
    setShowInscricaoOferecidaModal(true)
  }

  const handleSaveInscricaoOferecida = () => {
    const valor = parseCurrencyToNumber(inscricaoOferecidaForm.valor)
    if (!inscricaoOferecidaForm.numeroInscricao || valor <= 0) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    const inscricaoData: InscricaoOferecida = {
      id: editingInscricaoOferecida ? editingInscricaoOferecida.inscricao.id : `oferecida-${Date.now()}`,
      numeroInscricao: inscricaoOferecidaForm.numeroInscricao,
      tipoInscricao: inscricaoOferecidaForm.tipoInscricao,
      valor: valor,
      dataVencimento: inscricaoOferecidaForm.dataVencimento || undefined,
      descricao: inscricaoOferecidaForm.descricao || undefined
    }

    if (editingInscricaoOferecida) {
      const updated = [...inscricoesOferecidasAdicionadas]
      updated[editingInscricaoOferecida.index] = inscricaoData
      setInscricoesOferecidasAdicionadas(updated)
    } else {
      setInscricoesOferecidasAdicionadas([...inscricoesOferecidasAdicionadas, inscricaoData])
    }

    setShowInscricaoOferecidaModal(false)
    toast.success(editingInscricaoOferecida ? 'Inscrição atualizada' : 'Inscrição adicionada')
  }

  const handleRemoveInscricaoOferecida = (index: number) => {
    const inscricao = inscricoesOferecidasAdicionadas[index]
    if (confirm(`Tem certeza que deseja remover a inscrição "${inscricao.numeroInscricao}"?`)) {
      const updated = inscricoesOferecidasAdicionadas.filter((_, i) => i !== index)
      setInscricoesOferecidasAdicionadas(updated)
      toast.success('Inscrição removida')
    }
  }

  // Funções dos modais de Inscrições a Compensar
  const openInscricaoCompensarModal = () => {
    setInscricaoCompensarForm({
      numeroInscricao: '',
      tipoInscricao: 'imobiliaria',
      debitos: [{ descricao: '', valor: '', dataVencimento: '' }]
    })
    setEditingInscricaoCompensar(null)
    setShowInscricaoCompensarModal(true)
  }

  const openEditInscricaoCompensarModal = (index: number) => {
    const inscricao = inscricoesCompensarAdicionadas[index]
    setEditingInscricaoCompensar({ index, inscricao })
    setInscricaoCompensarForm({
      numeroInscricao: inscricao.numeroInscricao,
      tipoInscricao: inscricao.tipoInscricao as 'imobiliaria' | 'economica',
      debitos: inscricao.debitos.map(d => ({
        descricao: d.descricao,
        valor: d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        dataVencimento: d.dataVencimento
      }))
    })
    setShowInscricaoCompensarModal(true)
  }

  const updateDebito = (index: number, field: string, value: string) => {
    const updatedDebitos = [...inscricaoCompensarForm.debitos]
    updatedDebitos[index] = { ...updatedDebitos[index], [field]: value }
    setInscricaoCompensarForm({ ...inscricaoCompensarForm, debitos: updatedDebitos })
  }

  const addDebito = () => {
    setInscricaoCompensarForm({
      ...inscricaoCompensarForm,
      debitos: [...inscricaoCompensarForm.debitos, { descricao: '', valor: '', dataVencimento: '' }]
    })
  }

  const removeDebito = (index: number) => {
    if (inscricaoCompensarForm.debitos.length > 1) {
      const updatedDebitos = inscricaoCompensarForm.debitos.filter((_, i) => i !== index)
      setInscricaoCompensarForm({ ...inscricaoCompensarForm, debitos: updatedDebitos })
    }
  }

  const handleSaveInscricaoCompensar = () => {
    if (!inscricaoCompensarForm.numeroInscricao) {
      toast.error('Número da inscrição é obrigatório')
      return
    }

    const debitosValidos = inscricaoCompensarForm.debitos.filter(d =>
      d.descricao && d.valor && d.dataVencimento
    )

    if (debitosValidos.length === 0) {
      toast.error('Pelo menos um débito deve ser informado')
      return
    }

    const inscricaoData: InscricaoCompensar = {
      id: editingInscricaoCompensar ? editingInscricaoCompensar.inscricao.id : `compensar-${Date.now()}`,
      numeroInscricao: inscricaoCompensarForm.numeroInscricao,
      tipoInscricao: inscricaoCompensarForm.tipoInscricao,
      debitos: debitosValidos.map(d => ({
        descricao: d.descricao,
        valor: parseCurrencyToNumber(d.valor),
        dataVencimento: d.dataVencimento
      }))
    }

    if (editingInscricaoCompensar) {
      const updated = [...inscricoesCompensarAdicionadas]
      updated[editingInscricaoCompensar.index] = inscricaoData
      setInscricoesCompensarAdicionadas(updated)
    } else {
      setInscricoesCompensarAdicionadas([...inscricoesCompensarAdicionadas, inscricaoData])
    }

    setShowInscricaoCompensarModal(false)
    toast.success(editingInscricaoCompensar ? 'Inscrição atualizada' : 'Inscrição adicionada')
  }

  const handleRemoveInscricaoCompensar = (index: number) => {
    const inscricao = inscricoesCompensarAdicionadas[index]
    if (confirm(`Tem certeza que deseja remover a inscrição "${inscricao.numeroInscricao}"?`)) {
      const updated = inscricoesCompensarAdicionadas.filter((_, i) => i !== index)
      setInscricoesCompensarAdicionadas(updated)
      toast.success('Inscrição removida')
    }
  }

  const valorOferecido = inscricoesOferecidasAdicionadas.reduce((total, inscricao) => total + inscricao.valor, 0)
  const valorCompensar = inscricoesCompensarAdicionadas.reduce((total, inscricao) => {
    return total + inscricao.debitos.reduce((subtotal, debito) => subtotal + debito.valor, 0)
  }, 0)
  const saldoFinal = Math.abs(valorOferecido - valorCompensar)

  // Se ainda está carregando, mostrar loading
  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Carregando valores existentes...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Resumo da Dação */}
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
                  <span className="text-sm font-medium text-green-800">Inscrições Oferecidas</span>
                </div>
                <p className="text-lg font-bold text-green-700">
                  R$ {valorOferecido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-green-600">
                  {inscricoesOferecidasAdicionadas.length} {inscricoesOferecidasAdicionadas.length === 1 ? 'inscrição' : 'inscrições'}
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">A Compensar</span>
                </div>
                <p className="text-lg font-bold text-blue-700">
                  R$ {valorCompensar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-blue-600">
                  {inscricoesCompensarAdicionadas.length} {inscricoesCompensarAdicionadas.length === 1 ? 'inscrição' : 'inscrições'}
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-1">
                  <Calculator className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-800">Saldo</span>
                </div>
                <p className={`text-lg font-bold ${valorOferecido >= valorCompensar ? 'text-green-600' : 'text-red-600'}`}>
                  R$ {saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-600">
                  {valorOferecido >= valorCompensar ? 'Superávit' : 'Déficit'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bens/Imóveis Oferecidos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-green-600" />
                Inscrições Oferecidas em Dação
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openInscricaoOferecidaModal}
                className="cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Inscrição
              </Button>
            </div>
            <CardDescription>
              Inscrições que o contribuinte oferece para dação em pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inscricoesOferecidasAdicionadas.length === 0 ? (
              <div className="text-center py-8">
                <Home className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-gray-500">
                  Nenhuma inscrição adicionada ainda
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Clique em &quot;Adicionar Inscrição&quot; para começar
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inscricoesOferecidasAdicionadas.map((inscricao, inscricaoIndex) => (
                  <div key={inscricao.id} className="p-4 border rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
                          <Home className="h-4 w-4 text-green-700" />
                        </div>
                        <div>
                          <h5 className="font-medium text-green-800">{inscricao.tipoInscricao === 'imobiliaria' ? 'Imobiliária' : 'Econômica'}</h5>
                          <p className="text-xs text-green-600">{inscricao.numeroInscricao}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditInscricaoOferecidaModal(inscricaoIndex)}
                          className="h-6 w-6 p-0 text-green-700 hover:text-green-800 cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveInscricaoOferecida(inscricaoIndex)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-lg font-bold text-green-700">
                        R$ {inscricao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {inscricao.dataVencimento && (
                        <p className="text-xs text-green-600">
                          Vence: {new Date(inscricao.dataVencimento).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                      {inscricao.descricao && (
                        <p className="text-xs text-green-600">
                          {inscricao.descricao}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
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
                onClick={openInscricaoCompensarModal}
                className="cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Inscrição
              </Button>
            </div>
            <CardDescription>
              Inscrições municipais que serão quitadas pela dação em pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inscricoesCompensarAdicionadas.length === 0 ? (
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
                {inscricoesCompensarAdicionadas.map((inscricao, inscricaoIndex) => (
                  <div key={inscricao.id} className="p-4 border rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
                          <FileText className="h-4 w-4 text-blue-700" />
                        </div>
                        <div>
                          <h5 className="font-medium text-blue-800">{inscricao.tipoInscricao === 'imobiliaria' ? 'Imobiliária' : 'Econômica'}</h5>
                          <p className="text-xs text-blue-600">{inscricao.numeroInscricao}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditInscricaoCompensarModal(inscricaoIndex)}
                          className="h-6 w-6 p-0 text-blue-700 hover:text-blue-800 cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveInscricaoCompensar(inscricaoIndex)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-lg font-bold text-blue-700">
                        R$ {inscricao.debitos.reduce((total, debito) => total + debito.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-blue-600">
                        {inscricao.debitos.length} {inscricao.debitos.length === 1 ? 'débito' : 'débitos'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Observações do Acordo
            </CardTitle>
            <CardDescription>
              Informações adicionais sobre o acordo de dação em pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={observacoesAcordo}
              onChange={(e) => setObservacoesAcordo(e.target.value)}
              placeholder="Digite observações adicionais sobre o acordo..."
              rows={4}
            />
          </CardContent>
        </Card>
      </div>

      {/* Modal de Bem/Imóvel Oferecido */}
      <Dialog open={showInscricaoOferecidaModal} onOpenChange={setShowInscricaoOferecidaModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-green-600" />
              {editingInscricaoOferecida ? 'Editar Bem/Imóvel' : 'Adicionar Bem/Imóvel'}
            </DialogTitle>
            <DialogDescription>
              {editingInscricaoOferecida ? 'Edite as informações do bem/imóvel' : 'Adicione as informações do bem/imóvel'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modal-tipo-inscricao">Tipo de Inscrição <span className="text-red-500">*</span></Label>
              <select
                id="modal-tipo-inscricao"
                value={inscricaoOferecidaForm.tipoInscricao}
                onChange={(e) => setInscricaoOferecidaForm({ ...inscricaoOferecidaForm, tipoInscricao: e.target.value as 'imobiliaria' | 'economica' })}
                className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="imobiliaria">Imobiliária</option>
                <option value="economica">Econômica</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-numero-inscricao">Número da Inscrição <span className="text-red-500">*</span></Label>
              <Input
                id="modal-numero-inscricao"
                value={inscricaoOferecidaForm.numeroInscricao}
                onChange={(e) => setInscricaoOferecidaForm({ ...inscricaoOferecidaForm, numeroInscricao: e.target.value })}
                placeholder="Ex: IMOB-2024-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-valor-inscricao">Valor <span className="text-red-500">*</span></Label>
              <Input
                id="modal-valor-inscricao"
                type="text"
                value={inscricaoOferecidaForm.valor}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value)
                  setInscricaoOferecidaForm({ ...inscricaoOferecidaForm, valor: formatted })
                }}
                placeholder="Ex: 25.000,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-vencimento-inscricao">Data de Vencimento</Label>
              <Input
                id="modal-vencimento-inscricao"
                type="date"
                value={inscricaoOferecidaForm.dataVencimento}
                onChange={(e) => setInscricaoOferecidaForm({ ...inscricaoOferecidaForm, dataVencimento: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modal-descricao-inscricao">Descrição</Label>
              <Textarea
                id="modal-descricao-inscricao"
                rows={2}
                value={inscricaoOferecidaForm.descricao}
                onChange={(e) => setInscricaoOferecidaForm({ ...inscricaoOferecidaForm, descricao: e.target.value })}
                placeholder="Informações adicionais sobre o bem/imóvel..."
              />
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInscricaoOferecidaModal(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveInscricaoOferecida}
                className="cursor-pointer"
              >
                {editingInscricaoOferecida ? 'Salvar Alterações' : 'Adicionar Bem/Imóvel'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Inscrição a Compensar */}
      <Dialog open={showInscricaoCompensarModal} onOpenChange={setShowInscricaoCompensarModal}>
        <DialogContent className="w-[95vw] !max-w-[1200px] max-h-[90vh] overflow-hidden" style={{ width: '95vw', maxWidth: '1200px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              {editingInscricaoCompensar ? 'Editar Inscrição' : 'Adicionar Inscrição'}
            </DialogTitle>
            <DialogDescription>
              {editingInscricaoCompensar ? 'Edite as informações da inscrição e seus débitos' : 'Adicione uma nova inscrição com múltiplos débitos'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modal-inscricao-numero">Número da Inscrição <span className="text-red-500">*</span></Label>
                <Input
                  id="modal-inscricao-numero"
                  value={inscricaoCompensarForm.numeroInscricao}
                  onChange={(e) => setInscricaoCompensarForm({ ...inscricaoCompensarForm, numeroInscricao: e.target.value })}
                  placeholder="Ex: 123.456.789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="modal-inscricao-tipo">Tipo de Inscrição <span className="text-red-500">*</span></Label>
                <select
                  id="modal-inscricao-tipo"
                  value={inscricaoCompensarForm.tipoInscricao}
                  onChange={(e) => setInscricaoCompensarForm({ ...inscricaoCompensarForm, tipoInscricao: e.target.value as 'imobiliaria' | 'economica' })}
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
                {inscricaoCompensarForm.debitos.map((debito, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <h6 className="text-sm font-medium">Débito {index + 1}</h6>
                      {inscricaoCompensarForm.debitos.length > 1 && (
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
                    R$ {inscricaoCompensarForm.debitos.reduce((total, d) => total + parseCurrencyToNumber(d.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInscricaoCompensarModal(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveInscricaoCompensar}
                disabled={!inscricaoCompensarForm.numeroInscricao || inscricaoCompensarForm.debitos.some(d => !d.descricao || !d.valor || !d.dataVencimento)}
                className="cursor-pointer"
              >
                {editingInscricaoCompensar ? 'Atualizar' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
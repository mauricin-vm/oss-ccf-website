'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  HandCoins,
  DollarSign,
  FileText,
  ArrowLeft,
  AlertTriangle,
  Calculator,
  CreditCard,
  Check,
  X,
  Edit,
  AlertCircle,
  Receipt
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { SessionUser } from '@/types'
import AcordoActions from '@/components/acordo/acordo-actions'
import CumprimentoWrapper from '@/components/acordo/cumprimento-wrapper'

import { toast } from 'sonner'

interface AcordoPageProps {
  params: Promise<{ id: string }>
}

export default function AcordoPage({ params }: AcordoPageProps) {
  const { data: session } = useSession()
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const [acordo, setAcordo] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [modoRegistrarPagamento, setModoRegistrarPagamento] = useState(false)
  const [parcelasSelecionadas, setParcelasSelecionadas] = useState<Set<string>>(new Set())
  const [processandoPagamento, setProcessandoPagamento] = useState(false)
  const [parcelaEditando, setParcelaEditando] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [formEdicaoParcela, setFormEdicaoParcela] = useState({
    dataVencimento: '',
    dataPagamento: ''
  })
  const [errorEdit, setErrorEdit] = useState<string | null>(null)
  const [detalhesAcordo, setDetalhesAcordo] = useState<Record<string, unknown> | null>(null)
  const [processandoConclusao, setProcessandoConclusao] = useState(false)

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params
      setResolvedParams(resolved)
    }
    resolveParams()
  }, [params])

  const loadAcordo = useCallback(async () => {
    if (!resolvedParams) return

    try {
      setLoading(true)
      const [acordoResponse, detalhesResponse] = await Promise.all([
        fetch(`/api/acordos/${resolvedParams.id}`),
        fetch(`/api/acordos/${resolvedParams.id}/detalhes`)
      ])

      if (acordoResponse.ok) {
        const acordoData = await acordoResponse.json()
        setAcordo(acordoData)
      } else if (acordoResponse.status === 404) {
        notFound()
      }

      if (detalhesResponse.ok) {
        const detalhesData = await detalhesResponse.json()
        setDetalhesAcordo(detalhesData)
      }
    } catch (error) {
      console.error('Erro ao carregar acordo:', error)
    } finally {
      setLoading(false)
    }
  }, [resolvedParams])

  useEffect(() => {
    if (!session) {
      return
    }

    if (resolvedParams) {
      loadAcordo()
    }
  }, [session, resolvedParams, loadAcordo])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        <span className="ml-2">Carregando acordo...</span>
      </div>
    )
  }

  if (!acordo || !session) {
    return null
  }

  const user = session.user as SessionUser

  // Funções para gerenciar modo de pagamento
  const handleIniciarRegistroPagamento = () => {
    setModoRegistrarPagamento(true)
    setParcelasSelecionadas(new Set())
  }

  const handleCancelarRegistroPagamento = () => {
    setModoRegistrarPagamento(false)
    setParcelasSelecionadas(new Set())
  }

  const handleToggleParcela = (parcelaId: string) => {
    const novaSelecao = new Set(parcelasSelecionadas)
    if (novaSelecao.has(parcelaId)) {
      novaSelecao.delete(parcelaId)
    } else {
      novaSelecao.add(parcelaId)
    }
    setParcelasSelecionadas(novaSelecao)
  }

  const handleConfirmarPagamento = async () => {
    if (parcelasSelecionadas.size === 0) {
      toast.error('Selecione pelo menos uma parcela para registrar o pagamento')
      return
    }

    setProcessandoPagamento(true)
    try {
      const parcelasParaPagar = Array.from(parcelasSelecionadas)

      for (const parcelaId of parcelasParaPagar) {
        const parcela = (acordo.parcelas as Record<string, unknown>[])?.find((p: Record<string, unknown>) => p.id === parcelaId)
        if (!parcela) continue

        const valorPago = (parcela.pagamentos as Record<string, unknown>[])?.reduce((total: number, p: Record<string, unknown>) => total + Number(p.valorPago || 0), 0) || 0
        const valorRestante = Number(parcela.valor) - valorPago

        if (valorRestante <= 0) continue

        const response = await fetch(`/api/pagamentos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            parcelaId: parcela.id,
            dataPagamento: new Date(),
            valorPago: valorRestante,
            formaPagamento: 'dinheiro'
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erro ao registrar pagamento')
        }
      }

      toast.success(`Pagamento${parcelasSelecionadas.size > 1 ? 's' : ''} registrado${parcelasSelecionadas.size > 1 ? 's' : ''} com sucesso!`)

      // Recarregar dados e sair do modo de pagamento
      await loadAcordo()
      handleCancelarRegistroPagamento()
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar pagamento')
    } finally {
      setProcessandoPagamento(false)
    }
  }

  // Funções para edição de parcelas
  const handleEditarParcela = (parcela: Record<string, unknown>) => {
    setParcelaEditando(parcela.id as string)
    setFormEdicaoParcela({
      dataVencimento: new Date(parcela.dataVencimento as string).toISOString().split('T')[0],
      dataPagamento: parcela.dataPagamento ? new Date(parcela.dataPagamento as string).toISOString().split('T')[0] : ''
    })
    setErrorEdit(null)
    setShowEditModal(true)
  }

  const handleCancelarEdicao = () => {
    setParcelaEditando(null)
    setShowEditModal(false)
    setFormEdicaoParcela({
      dataVencimento: '',
      dataPagamento: ''
    })
    setErrorEdit(null)
  }

  const calcularStatusAutomatico = (dataVencimento: string, dataPagamento: string) => {
    if (dataPagamento) {
      return 'PAGO'
    }

    const hoje = new Date()
    const vencimento = new Date(dataVencimento)

    if (vencimento < hoje) {
      return 'VENCIDO'
    }

    return 'PENDENTE'
  }

  const handleSalvarEdicaoParcela = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!parcelaEditando) return

    if (!formEdicaoParcela.dataVencimento.trim()) {
      setErrorEdit('Data de vencimento é obrigatória')
      return
    }

    try {
      setProcessandoPagamento(true)
      setErrorEdit(null)

      const status = calcularStatusAutomatico(formEdicaoParcela.dataVencimento, formEdicaoParcela.dataPagamento)

      const response = await fetch(`/api/parcelas/${parcelaEditando}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataVencimento: new Date(formEdicaoParcela.dataVencimento),
          dataPagamento: formEdicaoParcela.dataPagamento ? new Date(formEdicaoParcela.dataPagamento) : null,
          status: status
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar parcela')
      }

      toast.success('Parcela atualizada com sucesso!')

      // Recarregar dados
      await loadAcordo()
      handleCancelarEdicao()
    } catch (error) {
      console.error('Erro ao atualizar parcela:', error)
      setErrorEdit(error instanceof Error ? error.message : 'Erro ao atualizar parcela')
    } finally {
      setProcessandoPagamento(false)
    }
  }

  // Função para concluir acordo (dação e compensação)
  const handleConcluirAcordo = async () => {
    if (!window.confirm('Tem certeza que deseja concluir este acordo? Esta ação não pode ser desfeita. O acordo e o processo serão marcados como concluídos.')) {
      return
    }

    setProcessandoConclusao(true)
    try {
      const response = await fetch(`/api/acordos/${resolvedParams?.id}/concluir`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          atualizarProcesso: true
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao concluir acordo')
      }

      toast.success('Acordo e processo concluídos com sucesso!')

      // Recarregar dados
      await loadAcordo()
    } catch (error) {
      console.error('Erro ao concluir acordo:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao concluir acordo')
    } finally {
      setProcessandoConclusao(false)
    }
  }

  // Helper para acessar propriedades do acordo
  const acordo_data = acordo as Record<string, unknown>

  const canEdit = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'
  const canRegisterPayment = canEdit && acordo_data?.status === 'ativo'

  // Verificar se é um tipo de processo que tem parcelas/pagamentos
  const tipoProcesso = (acordo_data.processo as Record<string, unknown>)?.tipo as string
  const temParcelas = tipoProcesso === 'TRANSACAO_EXCEPCIONAL'

  if (!acordo_data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        <span className="ml-2">Carregando acordo...</span>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-green-100 text-green-800'
      case 'cumprido': return 'bg-blue-100 text-blue-800'
      case 'vencido': return 'bg-red-100 text-red-800'
      case 'cancelado': return 'bg-orange-100 text-orange-800'
      case 'renegociado': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }


  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ativo': return 'Ativo'
      case 'cumprido': return 'Cumprido'
      case 'vencido': return 'Vencido'
      case 'cancelado': return 'Cancelado'
      case 'renegociado': return 'Renegociado'
      default: return status
    }
  }

  const getParcelaStatusColor = (status: string) => {
    switch (status) {
      case 'PENDENTE': return 'bg-yellow-100 text-yellow-800'
      case 'PAGO': return 'bg-green-100 text-green-800'
      case 'VENCIDO': return 'bg-red-100 text-red-800'
      case 'CANCELADO': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getParcelaStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDENTE': return 'Pendente'
      case 'PAGO': return 'Pago'
      case 'VENCIDO': return 'Vencido'
      case 'CANCELADO': return 'Cancelado'
      default: return status
    }
  }

  const getProgressoPagamento = () => {
    const valorTotal = Number(acordo_data.valorFinal || 0)
    const parcelas = (acordo_data.parcelas as Record<string, unknown>[]) || []
    const valorPago = parcelas.reduce((total: number, parcela: Record<string, unknown>) => {
      const pagamentos = (parcela.pagamentos as Record<string, unknown>[]) || []
      return total + pagamentos.reduce((subtotal: number, pagamento: Record<string, unknown>) => {
        return subtotal + Number(pagamento.valorPago || 0)
      }, 0)
    }, 0)
    const percentual = valorTotal > 0 ? Math.round((valorPago / valorTotal) * 100) : 0

    return {
      valorTotal,
      valorPago,
      valorPendente: valorTotal - valorPago,
      percentual
    }
  }

  // Função helper para formatar datas corretamente (evitando problema de timezone)
  const formatarData = (data: string | Date) => {
    const date = new Date(data)
    // Adicionar um dia para compensar o timezone
    date.setDate(date.getDate() + 1)
    return date.toLocaleDateString('pt-BR')
  }

  const isVencido = (dataVencimento: Date) => {
    return new Date(dataVencimento) < new Date() && acordo_data.status === 'ativo'
  }

  // Função para calcular o valor do acordo baseado no tipo (compensação/dação)
  const getValorAcordo = () => {
    if (temParcelas) {
      // Para transação excepcional, usar valorFinal padrão
      return Number(acordo_data.valorFinal || 0)
    }

    // Para compensação e dação, usar valorTotal que representa o valor original/base
    if (tipoProcesso === 'COMPENSACAO' || tipoProcesso === 'DACAO_PAGAMENTO') {
      // Primeiro tentar o valorTotal que foi corrigido no backend para representar o valor correto
      if (acordo_data.valorTotal) {
        return Number(acordo_data.valorTotal)
      }

    }

    // Fallback para detalhes do acordo
    if (!detalhesAcordo) {
      return Number(acordo_data.valorFinal || 0)
    }

    const detalhes = (detalhesAcordo as Record<string, unknown>).detalhes as Record<string, unknown>[]
    if (!detalhes || !Array.isArray(detalhes) || detalhes.length === 0) {
      return Number(acordo_data.valorFinal || 0)
    }

    let valorTotal = 0

    detalhes.forEach((detalhe: Record<string, unknown>) => {
      if (detalhe.tipo === 'compensacao') {
        // Para compensação: usar valorOriginal do detalhe
        valorTotal += Number(detalhe.valorOriginal || 0)
      } else if (detalhe.tipo === 'dacao') {
        // Para dação: usar valorOriginal do detalhe (que representa valor oferecido)
        valorTotal += Number(detalhe.valorOriginal || 0)
      }
    })

    return valorTotal > 0 ? valorTotal : Number(acordo_data.valorFinal || 0)
  }

  const progresso = acordo_data ? getProgressoPagamento() : null
  const vencido = acordo_data ? isVencido(acordo_data.dataVencimento as Date) : false

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/acordos">
          <Button variant="outline" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Acordo de Pagamento</h1>
            <Badge className={getStatusColor(acordo_data.status as string)}>
              {getStatusLabel(acordo_data.status as string)}
            </Badge>
            {vencido && (
              <Badge className="bg-red-100 text-red-800">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Vencido
              </Badge>
            )}
          </div>
          <p className="text-gray-600">
            Processo: {(acordo_data.processo as Record<string, unknown>)?.numero as string} - {((acordo_data.processo as Record<string, unknown>)?.contribuinte as Record<string, unknown>)?.nome as string}
          </p>
        </div>
        <div className="flex gap-2">
          {temParcelas && canRegisterPayment && (progresso?.valorPendente || 0) > 0 && !modoRegistrarPagamento && (
            <Button onClick={handleIniciarRegistroPagamento} className="cursor-pointer">
              <DollarSign className="mr-2 h-4 w-4" />
              Registrar Pagamento
            </Button>
          )}
          {!temParcelas && canEdit && acordo_data?.status === 'ativo' && (
            <Button
              onClick={handleConcluirAcordo}
              disabled={processandoConclusao}
              className="bg-green-600 hover:bg-green-700 cursor-pointer"
            >
              {processandoConclusao ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Processando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Concluir Acordo
                </>
              )}
            </Button>
          )}
          {temParcelas && modoRegistrarPagamento && (
            <>
              <Button
                onClick={handleConfirmarPagamento}
                disabled={parcelasSelecionadas.size === 0 || processandoPagamento}
                className="bg-green-600 hover:bg-green-700 cursor-pointer"
              >
                {processandoPagamento ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirmar Pagamento ({parcelasSelecionadas.size})
                  </>
                )}
              </Button>
              <Button
                onClick={handleCancelarRegistroPagamento}
                variant="outline"
                disabled={processandoPagamento}
                className="cursor-pointer"
              >
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </>
          )}
          {canEdit && !(
            !temParcelas &&
            acordo_data.status === 'cumprido' &&
            (tipoProcesso === 'COMPENSACAO' || tipoProcesso === 'DACAO_PAGAMENTO')
          ) && (
            <AcordoActions acordo={acordo as { id: string; status: string; parcelas: { id: string; pagamentos: { id: string; valorPago: number; }[]; }[]; valorFinal: number; }} />
          )}
        </div>
      </div>

      {/* Informações do Acordo */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5" />
              Informações do Acordo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Data de Assinatura:</span>
                <p className="font-medium">{formatarData(acordo_data.dataAssinatura as Date)}</p>
              </div>
              <div>
                <span className="text-gray-600">Data de Vencimento:</span>
                <p className="font-medium">{formatarData(acordo_data.dataVencimento as Date)}</p>
              </div>
              {/* Mostrar modalidade apenas para transação excepcional */}
              {temParcelas && (
                <div>
                  <span className="text-gray-600">Modalidade:</span>
                  <p className="font-medium">
                    {acordo_data.modalidadePagamento === 'avista' ? 'À Vista' : `Parcelamento (${acordo_data.numeroParcelas as number}x)`}
                  </p>
                </div>
              )}
              <div>
                <span className="text-gray-600">Status:</span>
                <p className="font-medium">{getStatusLabel(acordo_data.status as string)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Informações do Processo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Número do Processo:</span>
                <p className="font-medium">{(acordo_data.processo as Record<string, unknown>).numero as string}</p>
              </div>
              <div>
                <span className="text-gray-600">Contribuinte:</span>
                <p className="font-medium">{((acordo_data.processo as Record<string, unknown>).contribuinte as Record<string, unknown>).nome as string}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Tipo de Processo:</span>
                <p className="font-medium">
                  {(acordo_data.processo as Record<string, unknown>).tipo === 'TRANSACAO_EXCEPCIONAL' ? 'Transação Excepcional' :
                    (acordo_data.processo as Record<string, unknown>).tipo === 'COMPENSACAO' ? 'Compensação' :
                      (acordo_data.processo as Record<string, unknown>).tipo === 'DACAO_PAGAMENTO' ? 'Dação em Pagamento' :
                        (acordo_data.processo as Record<string, unknown>).tipo as string}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Valores e Progresso */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Valores e Progresso
          </CardTitle>
          <CardDescription>
            {temParcelas
              ? 'Acompanhamento dos valores e pagamentos do acordo'
              : tipoProcesso === 'COMPENSACAO'
                ? 'Detalhes da compensação entre créditos e débitos'
                : 'Detalhes da dação em pagamento'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Mostrar detalhamento apenas para transação excepcional */}
            {temParcelas && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h5 className="font-medium mb-3 text-blue-800">Detalhamento do Acordo:</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 text-sm">
                  <div>
                    <span className="text-blue-600">Valor Original:</span>
                    <p className="font-medium text-blue-700">
                      R$ {Number(acordo_data.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">Valor Proposto:</span>
                    <p className="font-medium text-blue-700">
                      R$ {Number(acordo_data.valorFinal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">Desconto:</span>
                    <p className="font-medium text-blue-700">
                      R$ {Number(acordo_data.valorDesconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">Valor de Entrada:</span>
                    <p className="font-medium text-blue-700">
                      R$ {Number(acordo_data.valorEntrada || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">
                      {acordo_data.modalidadePagamento === 'avista' ? 'Valor Total:' : 'Valor das Parcelas:'}
                    </span>
                    <p className="font-medium text-blue-700">
                      {acordo_data.modalidadePagamento === 'avista'
                        ? `R$ ${Number(acordo_data.valorFinal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : (acordo_data.numeroParcelas as number) > 0
                          ? `${acordo_data.numeroParcelas as number}x de R$ ${((Number(acordo_data.valorFinal) - Number(acordo_data.valorEntrada || 0)) / (acordo_data.numeroParcelas as number)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : `R$ ${Number(acordo_data.valorFinal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      }
                    </p>
                  </div>
                  <div>
                    <span className="text-blue-600">Total Final:</span>
                    <p className="font-bold text-blue-700">
                      R$ {Number(acordo_data.valorFinal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {temParcelas ? 'Progresso do Pagamento' : 'Status do Acordo'}
                </span>
                <span className="font-medium">
                  {temParcelas
                    ? `${(progresso?.percentual as number) || 0}%`
                    : acordo_data.status === 'cumprido' ? '100%' : '0%'
                  }
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{
                    width: temParcelas
                      ? `${progresso?.percentual || 0}%`
                      : acordo_data.status === 'cumprido' ? '100%' : '0%'
                  }}
                />
              </div>
              {temParcelas && (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-600">
                      R$ {(progresso?.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-600">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-yellow-600">
                      R$ {(progresso?.valorPendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-600">Pendente</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">
                      R$ {(progresso?.valorPago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-600">Pago</p>
                  </div>
                </div>
              )}
              {!temParcelas && (
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-600">
                      R$ {getValorAcordo().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-600">
                      {tipoProcesso === 'COMPENSACAO' ? 'Valor dos Créditos Ofertados' :
                        tipoProcesso === 'DACAO_PAGAMENTO' ? 'Valor do Imóvel Ofertado' :
                          'Valor do Acordo'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${acordo_data.status === 'cumprido' ? 'text-green-600' : acordo_data.status === 'ativo' ? 'text-yellow-600' : 'text-red-600'}`}>
                      {getStatusLabel(acordo_data.status as string)}
                    </p>
                    <p className="text-xs text-gray-600">Status Atual</p>
                  </div>
                </div>
              )}
            </div>

            {/* Observações do Acordo */}
            {(acordo_data.observacoes as string) && (
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900">Observações do Acordo</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {acordo_data.observacoes as string}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Parcelas - apenas para transação excepcional */}
      {temParcelas && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Parcelas do Acordo
            </CardTitle>
            <CardDescription>
              Cronograma de pagamento e status das parcelas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(acordo_data.parcelas as Record<string, unknown>[]).map((parcela: Record<string, unknown>) => {
                const isVencidaParcela = new Date(parcela.dataVencimento as string) < new Date() && parcela.status === 'PENDENTE'
                const totalPagoParcela = (parcela.pagamentos as Record<string, unknown>[]).reduce((total: number, p: Record<string, unknown>) => total + Number(p.valorPago), 0)
                const restanteParcela = Number(parcela.valor) - totalPagoParcela

                const isClickable = modoRegistrarPagamento && parcela.status === 'PENDENTE' && restanteParcela > 0

                return (
                  <div
                    key={parcela.id as string}
                    onClick={isClickable ? () => handleToggleParcela(parcela.id as string) : undefined}
                    className={`border rounded-lg p-4 ${parcela.status === 'PAGO' ? 'bg-green-50 border-green-200' :
                      isVencidaParcela ? 'bg-red-50 border-red-200' :
                        'bg-gray-50'
                      } ${isClickable ? 'cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {modoRegistrarPagamento && parcela.status === 'PENDENTE' && restanteParcela > 0 ? (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={parcelasSelecionadas.has(parcela.id as string)}
                              onCheckedChange={() => handleToggleParcela(parcela.id as string)}
                              className="w-6 h-6 cursor-pointer"
                            />
                          </div>
                        ) : (
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${parcela.status === 'PAGO' ? 'bg-green-100 text-green-800' :
                            isVencidaParcela ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                            {Number(parcela.numero) === 0 ? 'E' : parcela.numero as string}
                          </span>
                        )}
                        <div>
                          <p className="font-medium">
                            {Number(parcela.numero) === 0 ? 'Entrada' : `Parcela ${parcela.numero as string} de ${acordo_data.numeroParcelas as string}`}
                          </p>
                          <p className="text-sm text-gray-600">
                            Vencimento: {formatarData(parcela.dataVencimento as string)}
                          </p>
                          {(parcela.dataPagamento as string) && (
                            <p className="text-sm text-green-600">
                              Paga em: {formatarData(parcela.dataPagamento as string)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end mb-2">
                          <Badge className={getParcelaStatusColor(parcela.status as string)}>
                            {getParcelaStatusLabel(parcela.status as string)}
                          </Badge>
                          {canEdit && !modoRegistrarPagamento && acordo_data.status !== 'cancelado' && acordo_data.status !== 'cumprido' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditarParcela(parcela as Record<string, unknown>)
                              }}
                              className="cursor-pointer"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm font-medium">
                          R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        {parcela.status === 'PENDENTE' && totalPagoParcela > 0 && (
                          <p className="text-xs text-blue-600">
                            Pago: R$ {totalPagoParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Pagamentos da parcela */}
                    {(parcela.pagamentos as Record<string, unknown>[]).length > 0 && parcela.status !== 'PAGO' && parcelaEditando !== parcela.id && (
                      <div className="mt-3 pl-11 space-y-2">
                        <h5 className="text-sm font-medium">Pagamentos:</h5>
                        {(parcela.pagamentos as Record<string, unknown>[]).map((pagamento: Record<string, unknown>) => (
                          <div key={pagamento.id as string} className="text-sm bg-white p-2 rounded border">
                            <div className="flex justify-between items-center">
                              <span>
                                {formatarData(pagamento.dataPagamento as string)} -
                                {(pagamento.formaPagamento as string).replace('_', ' ').toLowerCase()}
                              </span>
                              <span className="font-medium">
                                R$ {Number(pagamento.valorPago).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            {(pagamento.numeroComprovante as string) && (
                              <p className="text-xs text-gray-500">
                                Comprovante: {pagamento.numeroComprovante as string}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Origem do Acordo */}
      {detalhesAcordo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Origem do Acordo
            </CardTitle>
            <CardDescription>
              Inscrições e débitos que originaram este acordo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Verificar se tem detalhes */}
              {(detalhesAcordo as Record<string, unknown>).detalhes && Array.isArray((detalhesAcordo as Record<string, unknown>).detalhes) && ((detalhesAcordo as Record<string, unknown>).detalhes as Record<string, unknown>[]).length > 0 ? (
                ((detalhesAcordo as Record<string, unknown>).detalhes as Record<string, unknown>[]).map((detalhe: Record<string, unknown>) => (
                  <div key={detalhe.id as string} className="border rounded-lg p-4">
                    {/* <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <h4 className="font-medium text-gray-900">
                        {(detalhe.tipo as string) === 'compensacao' ? '' :
                          (detalhe.tipo as string) === 'dacao' ? 'Dação em Pagamento' :
                            detalhe.descricao as string}
                      </h4>
                    </div> */}

                    {/* Para Compensação: Mostrar créditos oferecidos separadamente */}
                    {(detalhe.tipo as string) === 'compensacao' && (
                      <>
                        {/* Créditos Oferecidos */}
                        <div className="mb-6">
                          <h5 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Créditos Oferecidos
                          </h5>
                          {(() => {
                            try {
                              const observacoes = detalhe.observacoes as string
                              if (observacoes) {
                                const dadosCreditos = JSON.parse(observacoes)
                                if (dadosCreditos.creditosOferecidos && Array.isArray(dadosCreditos.creditosOferecidos)) {
                                  return (
                                    <div className="space-y-3">
                                      {dadosCreditos.creditosOferecidos.map((credito: Record<string, unknown>, idx: number) => (
                                        <div key={credito.id as string || `credito-${idx}`} className="p-3 bg-green-50 rounded-lg border border-green-200">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                              <div>
                                                <p className="font-medium text-sm text-green-900">{credito.numero as string}</p>
                                                <p className="text-xs text-green-700 capitalize">
                                                  {(credito.tipo as string).replace('_', ' ')}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-sm font-medium text-green-900">
                                                R$ {Number(credito.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </p>
                                            </div>
                                          </div>
                                          {(credito.descricao as string) && (
                                            <p className="text-xs text-green-600 mt-1">{credito.descricao as string}</p>
                                          )}
                                        </div>
                                      ))}
                                      <div className="p-3 bg-green-100 rounded-lg border border-green-300">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm font-medium text-green-800">Total dos Créditos:</span>
                                          <span className="text-sm font-bold text-green-900">
                                            R$ {Number(dadosCreditos.valorTotalCreditos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                }
                              }
                            } catch (e) {
                              // Se não conseguir fazer parse ou não tiver dados
                            }
                            return (
                              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                <p className="text-sm text-green-700">
                                  Os créditos configurados no momento da criação do acordo foram utilizados para esta compensação.
                                </p>
                              </div>
                            )
                          })()}
                        </div>
                      </>
                    )}

                    {/* Inscrições Incluídas - Layout padronizado para todos os tipos */}
                    {(detalhe.inscricoes as Record<string, unknown>) && Array.isArray(detalhe.inscricoes) && (detalhe.inscricoes as Record<string, unknown>[]).length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-blue-700 mb-3 flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          Inscrições Incluídas
                        </h5>
                        <div className="space-y-3">
                          {(detalhe.inscricoes as Record<string, unknown>[]).map((inscricao: Record<string, unknown>) => (
                            <div key={inscricao.id as string} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  <div>
                                    <p className="font-medium text-sm text-blue-900">{inscricao.numeroInscricao as string}</p>
                                    <p className="text-xs text-blue-700 capitalize">
                                      {(inscricao.tipoInscricao as string) === 'imobiliaria' ? 'Imobiliária' : 'Econômica'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium text-blue-900">
                                    Total: R$ {Number(inscricao.valorDebito || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>

                              {/* Débitos da inscrição */}
                              {(inscricao.descricaoDebitos as Record<string, unknown>[]) && Array.isArray(inscricao.descricaoDebitos) && (inscricao.descricaoDebitos as Record<string, unknown>[]).length > 0 && (
                                <div className="mt-3 pt-3 border-t border-blue-300">
                                  <h6 className="text-xs font-medium text-blue-700 mb-2">Débitos Incluídos:</h6>
                                  <div className="space-y-2">
                                    {(inscricao.descricaoDebitos as Record<string, unknown>[]).map((debito: Record<string, unknown>, idx: number) => (
                                      <div key={(debito.id as string) || `debito-${idx}`} className="flex items-center justify-between text-xs bg-white p-2 rounded">
                                        <span className="text-gray-700">{debito.descricao as string}</span>
                                        <div className="text-right">
                                          <span className="font-medium text-gray-900">
                                            R$ {Number(debito.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </span>
                                          {(debito.dataVencimento as string) && (
                                            <div className="text-gray-500">
                                              Venc: {new Date(debito.dataVencimento as string).toLocaleDateString('pt-BR')}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {/* Total das Inscrições */}
                          <div className="p-3 bg-blue-100 rounded-lg border border-blue-300">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-blue-800">Total das Inscrições:</span>
                              <span className="text-sm font-bold text-blue-900">
                                R$ {(detalhe.inscricoes as Record<string, unknown>[]).reduce((total: number, inscricao: Record<string, unknown>) => {
                                  return total + Number(inscricao.valorDebito || 0)
                                }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Para Dação em Pagamento: Layout igual à compensação */}
                    {(detalhe.tipo as string) === 'dacao' && (
                      <>
                        {/* Inscrições Oferecidas em Dação (equivalente aos Créditos na compensação) */}
                        <div className="mb-6">
                          <h5 className="text-sm font-medium text-green-700 mb-3 flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Inscrições Oferecidas em Dação
                          </h5>
                          {(() => {
                            try {
                              const observacoes = detalhe.observacoes as string
                              if (observacoes) {
                                const dadosDacao = JSON.parse(observacoes)
                                if (dadosDacao.inscricoesOferecidas && Array.isArray(dadosDacao.inscricoesOferecidas) && dadosDacao.inscricoesOferecidas.length > 0) {
                                  return (
                                    <div className="space-y-3">
                                      {dadosDacao.inscricoesOferecidas.map((inscricao: Record<string, unknown>, idx: number) => (
                                        <div key={inscricao.id as string || `inscricao-oferecida-${idx}`} className="p-3 bg-green-50 rounded-lg border border-green-200">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                              <div>
                                                <p className="font-medium text-sm text-green-900">{inscricao.numeroInscricao as string}</p>
                                                <p className="text-xs text-green-700 capitalize">
                                                  {(inscricao.tipoInscricao as string) === 'imobiliaria' ? 'Imobiliária' : 'Econômica'}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-sm font-medium text-green-900">
                                                R$ {Number(inscricao.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </p>
                                              {inscricao.dataVencimento && (
                                                <p className="text-xs text-green-600">
                                                  Venc: {new Date(inscricao.dataVencimento as string).toLocaleDateString('pt-BR')}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          {(inscricao.descricao as string) && (
                                            <p className="text-xs text-green-600 mt-1">{inscricao.descricao as string}</p>
                                          )}
                                        </div>
                                      ))}
                                      <div className="p-3 bg-green-100 rounded-lg border border-green-300">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm font-medium text-green-800">Total Oferecido:</span>
                                          <span className="text-sm font-bold text-green-900">
                                            R$ {Number(dadosDacao.valorTotalOferecido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                }
                              }
                            } catch (e) {
                              // Se não conseguir fazer parse ou não tiver dados
                            }
                            return (
                              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                <p className="text-sm text-green-700">
                                  Nenhuma inscrição oferecida foi configurada para este acordo de dação.
                                </p>
                              </div>
                            )
                          })()}
                        </div>
                      </>
                    )}

                    {/* Imóvel relacionado (para dação) */}
                    {(detalhe.imovel as Record<string, unknown>) && (
                      <div className="mt-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Imóvel:</h5>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="font-medium text-sm">{(detalhe.imovel as Record<string, unknown>).matricula as string}</p>
                          <p className="text-xs text-gray-600">{(detalhe.imovel as Record<string, unknown>).endereco as string}</p>
                          <p className="text-sm font-medium mt-1">
                            Valor Avaliado: R$ {Number((detalhe.imovel as Record<string, unknown>).valorAvaliado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Crédito relacionado (para compensação) */}
                    {(detalhe.credito as Record<string, unknown>) && (
                      <div className="mt-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Crédito:</h5>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="font-medium text-sm">{(detalhe.credito as Record<string, unknown>).numero as string}</p>
                          <p className="text-xs text-gray-600 capitalize">{((detalhe.credito as Record<string, unknown>).tipo as string).replace('_', ' ')}</p>
                          <p className="text-sm font-medium mt-1">
                            Valor: R$ {Number((detalhe.credito as Record<string, unknown>).valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p>Nenhum detalhe específico encontrado para este acordo.</p>
                  <p className="text-sm mt-1">Os detalhes podem não ter sido configurados ou carregados.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cláusulas Especiais */}
      {(acordo_data.clausulasEspeciais as string) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cláusulas Especiais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{acordo_data.clausulasEspeciais as string}</p>
          </CardContent>
        </Card>
      )}

      {/* Detalhes Específicos do Acordo */}
      <CumprimentoWrapper
        acordoId={acordo_data.id as string}
        detalhes={(acordo_data.detalhes as Record<string, unknown>[]) || []}
      />

      {/* Modal de Edição de Parcela */}
      <Dialog open={showEditModal} onOpenChange={handleCancelarEdicao}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Editar Parcela
            </DialogTitle>
            <DialogDescription>
              Edite as informações da parcela. O status será calculado automaticamente com base nas datas informadas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarEdicaoParcela} className="space-y-4">
            {errorEdit && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorEdit}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="dataVencimento">Data de Vencimento <span className="text-red-500">*</span></Label>
              <Input
                id="dataVencimento"
                type="date"
                value={formEdicaoParcela.dataVencimento}
                onChange={(e) => setFormEdicaoParcela(prev => ({ ...prev, dataVencimento: e.target.value }))}
                disabled={processandoPagamento}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataPagamento">Data de Pagamento (opcional)</Label>
              <Input
                id="dataPagamento"
                type="date"
                value={formEdicaoParcela.dataPagamento}
                onChange={(e) => setFormEdicaoParcela(prev => ({ ...prev, dataPagamento: e.target.value }))}
                disabled={processandoPagamento}
              />
              <p className="text-xs text-gray-500">
                Deixe em branco se a parcela não foi paga. O status será calculado automaticamente.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelarEdicao}
                disabled={processandoPagamento}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={processandoPagamento}
                className="cursor-pointer"
              >
                {processandoPagamento ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Edit className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}
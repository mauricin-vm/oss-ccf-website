'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { notFound, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Edit,
  FileText,
  Calendar,
  DollarSign,
  Mail,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  ArrowRight,
  History,
  User,
  Search,
  Pause,
  Eye,
  FilePlus,
  Gavel,
  Calculator,
  Home,
  CreditCard,
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser, ProcessoWithRelations, ProcessoDecisao, ProcessoPautaWithDetails, ProcessoVoto, ProcessoParcela, ProcessoPagamento } from '@/types'
import ProcessoDocumentos from '@/components/processo/processo-documentos'
import AdicionarHistoricoModal from '@/components/modals/adicionar-historico-modal'
import AlterarStatusModal from '@/components/modals/alterar-status-modal'
import ProcessoActions from '@/components/processo/processo-actions'
import ValoresProcessoModal from '@/components/modals/valores-processo-modal'



interface Props {
  params: Promise<{ id: string }>
}

export default function ProcessoDetalhesPage({ params }: Props) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const { data: session } = useSession()
  const router = useRouter()
  const [processo, setProcesso] = useState<ProcessoWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [showHistoricoModal, setShowHistoricoModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showValoresModal, setShowValoresModal] = useState(false)

  const formatCpfCnpj = (value: string) => {
    if (!value) return ''
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    } else {
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    }
  }

  const formatTelefone = (value: string) => {
    if (!value) return ''
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    }
  }

  const formatCep = (value: string) => {
    if (!value) return ''
    const numbers = value.replace(/\D/g, '')
    return numbers.replace(/(\d{5})(\d{3})/, '$1-$2')
  }

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params
      setResolvedParams(resolved)
    }
    resolveParams()
  }, [params])


  const loadProcesso = useCallback(async () => {
    if (!resolvedParams) return

    try {
      setLoading(true)
      const response = await fetch(`/api/processos/${resolvedParams.id}`)
      if (response.ok) {
        const data = await response.json()
        setProcesso(data.processo)
      } else if (response.status === 404) {
        notFound()
      }
    } catch (error) {
      console.error('Erro ao carregar processo:', error)
    } finally {
      setLoading(false)
    }
  }, [resolvedParams])

  useEffect(() => {
    if (!session) {
      // Não redirecionar manualmente - deixar o middleware fazer isso
      // router.push('/login')
      return
    }

    if (resolvedParams) {
      loadProcesso()
    }
  }, [session, resolvedParams, router, loadProcesso])


  const handleMarcarRecebida = async (tramitacaoId: string) => {
    try {
      const response = await fetch(`/api/tramitacoes/${tramitacaoId}/receber`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        toast.success('Tramitação marcada como recebida com sucesso')
        loadProcesso() // Recarregar dados para mostrar a mudança
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Erro ao marcar tramitação como recebida')
      }
    } catch (error) {
      console.error('Erro ao marcar tramitação como recebida:', error)
      toast.error('Erro ao marcar tramitação como recebida')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        <span className="ml-2">Carregando processo...</span>
      </div>
    )
  }

  if (!processo || !session) {
    return null
  }

  const user = session.user as SessionUser

  const tipoProcessoMap = {
    COMPENSACAO: { label: 'Compensação', color: 'bg-blue-100 text-blue-800' },
    DACAO_PAGAMENTO: { label: 'Dação em Pagamento', color: 'bg-purple-100 text-purple-800' },
    TRANSACAO_EXCEPCIONAL: { label: 'Transação Excepcional', color: 'bg-orange-100 text-orange-800' }
  }

  const statusMap = {
    RECEPCIONADO: { label: 'Recepcionado', color: 'bg-gray-100 text-gray-800', icon: Clock },
    EM_ANALISE: { label: 'Em Análise', color: 'bg-blue-100 text-blue-800', icon: Clock },
    AGUARDANDO_DOCUMENTOS: { label: 'Aguardando Docs', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
    EM_PAUTA: { label: 'Em Pauta', color: 'bg-purple-100 text-purple-800', icon: Calendar },
    EM_SESSAO: { label: 'Em Sessão', color: 'bg-purple-100 text-purple-800', icon: Calendar },
    SUSPENSO: { label: 'Suspenso', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
    PEDIDO_VISTA: { label: 'Pedido de Vista', color: 'bg-blue-100 text-blue-800', icon: Search },
    PEDIDO_DILIGENCIA: { label: 'Pedido de Diligência', color: 'bg-orange-100 text-orange-800', icon: Clock },
    JULGADO: { label: 'Julgado', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
    ACORDO_FIRMADO: { label: 'Acordo Firmado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    EM_CUMPRIMENTO: { label: 'Em Cumprimento', color: 'bg-orange-100 text-orange-800', icon: Clock },
    FINALIZADO: { label: 'Finalizado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    ARQUIVADO: { label: 'Arquivado', color: 'bg-gray-100 text-gray-800', icon: XCircle }
  }


  const canEdit = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'
  const statusInfo = statusMap[processo.status] || { label: processo.status, color: 'bg-gray-100 text-gray-800', icon: AlertCircle }
  const StatusIcon = statusInfo.icon

  const getResultadoBadge = (decisao: ProcessoDecisao) => {
    if (!decisao) return null

    switch (decisao.tipoResultado) {
      case 'SUSPENSO':
        return <Badge className="bg-yellow-100 text-yellow-800">Suspenso</Badge>
      case 'PEDIDO_VISTA':
        return <Badge className="bg-blue-100 text-blue-800">Pedido de vista</Badge>
      case 'PEDIDO_DILIGENCIA':
        return <Badge className="bg-orange-100 text-orange-800">Pedido de diligência</Badge>
      case 'JULGADO':
        const tipoDecisao = decisao.tipoDecisao
        return (
          <Badge
            className={
              tipoDecisao === 'DEFERIDO' ? 'bg-green-100 text-green-800' :
                tipoDecisao === 'INDEFERIDO' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
            }
          >
            {tipoDecisao === 'DEFERIDO' ? 'Deferido' :
              tipoDecisao === 'INDEFERIDO' ? 'Indeferido' :
                'Parcial'}
          </Badge>
        )
      default:
        return <Badge variant="outline">Aguardando</Badge>
    }
  }

  const getCardBackground = (decisao: ProcessoDecisao) => {
    if (!decisao) return 'bg-gray-50'

    switch (decisao.tipoResultado) {
      case 'SUSPENSO':
        return 'bg-yellow-50 border-yellow-200'
      case 'PEDIDO_VISTA':
        return 'bg-blue-50 border-blue-200'
      case 'PEDIDO_DILIGENCIA':
        return 'bg-orange-50 border-orange-200'
      case 'JULGADO':
        return 'bg-green-50 border-green-200'
      default:
        return 'bg-gray-50'
    }
  }

  const formatarListaNomes = (nomes: string[]): string => {
    if (nomes.length === 0) return ''
    if (nomes.length === 1) return nomes[0]
    if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`

    const todosExcetoUltimo = nomes.slice(0, -1).join(', ')
    const ultimo = nomes[nomes.length - 1]
    return `${todosExcetoUltimo} e ${ultimo}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/processos">
          <Button variant="outline" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{processo.numero}</h1>
          <p className="text-gray-600">
            {processo.contribuinte.nome}
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link href={`/processos/${processo.id}/editar`}>
              <Button className="cursor-pointer">
                <Edit className="mr-2 h-4 w-4" />
                Editar Processo
              </Button>
            </Link>
          )}
          {canEdit && (
            <ProcessoActions processo={processo} userRole={user.role} />
          )}
        </div>
      </div>

      {/* Status e Informações Principais */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIcon className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <Badge className={statusInfo.color}>
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStatusModal(true)}
                  className="cursor-pointer"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Tipo</p>
                <Badge className={tipoProcessoMap[processo.tipo].color}>
                  {tipoProcessoMap[processo.tipo].label}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Data Abertura</p>
                <p className="text-lg font-bold">
                  {new Date(processo.dataAbertura).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com Detalhes */}
      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="geral" className="cursor-pointer">Geral</TabsTrigger>
          <TabsTrigger value="tramitacoes" className="cursor-pointer">Tramitações</TabsTrigger>
          <TabsTrigger value="julgamento" className="cursor-pointer">Julgamento</TabsTrigger>
          <TabsTrigger value="acordo" className="cursor-pointer">Acordo</TabsTrigger>
          <TabsTrigger value="documentos" className="cursor-pointer">Documentos</TabsTrigger>
          <TabsTrigger value="historico" className="cursor-pointer">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Gerais</CardTitle>
                <CardDescription>
                  Dados básicos e informações principais do processo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Número do Processo</Label>
                    <p className="font-medium">{processo.numero}</p>
                  </div>
                  <div>
                    <Label>Tipo de Processo</Label>
                    <p className="font-medium">{tipoProcessoMap[processo.tipo].label}</p>
                  </div>
                  <div>
                    <Label>Data de Abertura</Label>
                    <p className="font-medium">{new Date(processo.dataAbertura).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <Label>Criado por</Label>
                    <p className="font-medium">{(processo as Record<string, unknown>).createdBy ? ((processo as Record<string, unknown>).createdBy as Record<string, unknown>).name as string : 'N/A'}</p>
                  </div>
                </div>

                {processo.observacoes && (
                  <div>
                    <Label>Observações</Label>
                    <p className="mt-1 text-gray-700">{processo.observacoes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dados do Contribuinte</CardTitle>
                <CardDescription>
                  Informações da pessoa física ou jurídica relacionada ao processo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome/Razão Social</Label>
                    <p className="font-medium">{processo.contribuinte.nome}</p>
                  </div>
                  <div>
                    <Label>CPF/CNPJ</Label>
                    <p className="font-medium">{processo.contribuinte.cpfCnpj ? formatCpfCnpj(processo.contribuinte.cpfCnpj) : 'N/A'}</p>
                  </div>
                  {processo.contribuinte.email && (
                    <div className="flex items-center gap-2">
                      <div>
                        <Label>Email</Label>
                        <p className="font-medium">{processo.contribuinte.email}</p>
                      </div>
                    </div>
                  )}
                  {processo.contribuinte.telefone && (
                    <div className="flex items-center gap-2">
                      <div>
                        <Label>Telefone</Label>
                        <p className="font-medium">{formatTelefone(processo.contribuinte.telefone)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {processo.contribuinte.endereco && (
                  <div className="flex items-start gap-2">
                    <div className="space-y-1">
                      <Label>Endereço</Label>
                      <p className="font-medium">{processo.contribuinte.endereco}</p>
                      {(processo.contribuinte.cidade || processo.contribuinte.estado || processo.contribuinte.cep) && (
                        <p className="text-sm text-gray-600">
                          {processo.contribuinte.cidade}, {processo.contribuinte.estado} - {processo.contribuinte.cep ? formatCep(processo.contribuinte.cep) : 'N/A'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card de Valores Específicos */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Valores do Processo
                    </CardTitle>
                    <CardDescription>
                      Valores a serem analisados no processo
                    </CardDescription>
                  </div>
                  {canEdit && (
                    <Button
                      onClick={() => setShowValoresModal(true)}
                      className="cursor-pointer"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Configurar Valores
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!processo.valoresEspecificos || (
                  (processo.tipo === 'COMPENSACAO' && (processo.valoresEspecificos.creditos?.length === 0 && processo.valoresEspecificos.inscricoes?.length === 0)) ||
                  (processo.tipo === 'DACAO_PAGAMENTO' && (processo.valoresEspecificos.imoveis?.length === 0 && processo.valoresEspecificos.inscricoes?.length === 0)) ||
                  (processo.tipo === 'TRANSACAO_EXCEPCIONAL' && (!(processo.valoresEspecificos as Record<string, unknown>).transacao || processo.valoresEspecificos.inscricoes?.length === 0))
                ) ? (
                  <div className="text-center py-8">
                    <Calculator className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-gray-500">
                      Nenhum valor configurado ainda
                    </p>
                    {canEdit && (
                      <p className="text-sm text-gray-400 mt-1">
                        Clique em &quot;Configurar Valores&quot; para definir os valores específicos
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Resumo dos valores */}
                    {processo.tipo === 'COMPENSACAO' && processo.valoresEspecificos.creditos && processo.valoresEspecificos.inscricoes && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">Créditos</span>
                          </div>
                          <p className="text-lg font-bold text-green-700">
                            R$ {processo.valoresEspecificos.creditos.reduce((total: number, credito: Record<string, unknown>) => total + Number(credito.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-green-600">
                            {processo.valoresEspecificos.creditos.length} {processo.valoresEspecificos.creditos.length === 1 ? 'crédito' : 'créditos'}
                          </p>
                        </div>

                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">A Compensar</span>
                          </div>
                          <p className="text-lg font-bold text-blue-700">
                            R$ {processo.valoresEspecificos.inscricoes.reduce((total: number, inscricao: Record<string, unknown>) =>
                              total + ((inscricao.debitos as Record<string, unknown>[])?.reduce((subtotal: number, debito: Record<string, unknown>) => subtotal + Number(debito.valor), 0) || 0), 0
                            ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-blue-600">
                            {processo.valoresEspecificos.inscricoes.length} {processo.valoresEspecificos.inscricoes.length === 1 ? 'inscrição' : 'inscrições'}
                          </p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Calculator className="h-4 w-4 text-gray-600" />
                            <span className="text-sm font-medium text-gray-800">Saldo</span>
                          </div>
                          {(() => {
                            const totalCreditos = processo.valoresEspecificos.creditos.reduce((total: number, credito: Record<string, unknown>) => total + Number(credito.valor), 0)
                            const totalDebitos = processo.valoresEspecificos.inscricoes.reduce((total: number, inscricao: Record<string, unknown>) =>
                              total + ((inscricao.debitos as Record<string, unknown>[])?.reduce((subtotal: number, debito: Record<string, unknown>) => subtotal + Number(debito.valor), 0) || 0), 0
                            )
                            const saldo = totalCreditos - totalDebitos
                            return (
                              <>
                                <p className={`text-lg font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {saldo >= 0 ? 'Superávit' : 'Déficit'}
                                </p>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Para Dação em Pagamento, mostrar resumo similar à compensação */}
                    {processo.tipo === 'DACAO_PAGAMENTO' && processo.valoresEspecificos?.imoveis && processo.valoresEspecificos?.inscricoes ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Home className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">Imóveis</span>
                          </div>
                          <p className="text-lg font-bold text-green-700">
                            R$ {(() => {
                              const total = processo.valoresEspecificos.imoveis.reduce((total: number, imovel: Record<string, unknown>) => {
                                const valor = Number((imovel.imovel as Record<string, unknown>)?.valorAvaliado || imovel.valorAvaliacao || 0);
                                console.log('Imovel debug:', { imovel, valor, valorAvaliado: (imovel.imovel as Record<string, unknown>)?.valorAvaliado, valorAvaliacao: imovel.valorAvaliacao });
                                return total + valor;
                              }, 0);
                              return total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                            })()}
                          </p>
                          <p className="text-xs text-green-600">
                            {processo.valoresEspecificos.imoveis.length} {processo.valoresEspecificos.imoveis.length === 1 ? 'imóvel' : 'imóveis'}
                          </p>
                        </div>

                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">A Compensar</span>
                          </div>
                          <p className="text-lg font-bold text-blue-700">
                            R$ {processo.valoresEspecificos.inscricoes.reduce((total: number, inscricao: Record<string, unknown>) =>
                              total + ((inscricao.debitos as Record<string, unknown>[])?.reduce((subtotal: number, debito: Record<string, unknown>) => subtotal + Number(debito.valor), 0) || 0), 0
                            ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-blue-600">
                            {processo.valoresEspecificos.inscricoes.length} {processo.valoresEspecificos.inscricoes.length === 1 ? 'inscrição' : 'inscrições'}
                          </p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Calculator className="h-4 w-4 text-gray-600" />
                            <span className="text-sm font-medium text-gray-800">Saldo</span>
                          </div>
                          {(() => {
                            const totalImoveis = processo.valoresEspecificos.imoveis.reduce((total: number, imovel: Record<string, unknown>) => {
                              const valor = Number((imovel.imovel as Record<string, unknown>)?.valorAvaliado || imovel.valorAvaliacao || 0);
                              return total + valor;
                            }, 0)
                            const totalDebitos = processo.valoresEspecificos.inscricoes.reduce((total: number, inscricao: Record<string, unknown>) =>
                              total + ((inscricao.debitos as Record<string, unknown>[])?.reduce((subtotal: number, debito: Record<string, unknown>) => subtotal + Number(debito.valor), 0) || 0), 0
                            )
                            const saldo = totalImoveis - totalDebitos
                            return (
                              <>
                                <p className={`text-lg font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {saldo >= 0 ? 'Superávit' : 'Déficit'}
                                </p>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    ) : null}

                    {/* Para Transação Excepcional, mostrar resumo específico */}
                    {processo.tipo === 'TRANSACAO_EXCEPCIONAL' && (processo.valoresEspecificos as Record<string, unknown>).transacao && processo.valoresEspecificos?.inscricoes ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">Total a Negociar</span>
                          </div>
                          <p className="text-lg font-bold text-green-700">
                            R$ {((processo.valoresEspecificos as Record<string, unknown>)?.transacao as Record<string, unknown>)?.valorTotalInscricoes ? Number(((processo.valoresEspecificos as Record<string, unknown>).transacao as Record<string, unknown>).valorTotalInscricoes).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                          </p>
                          <p className="text-xs text-green-600">
                            {processo.valoresEspecificos.inscricoes.length} {processo.valoresEspecificos.inscricoes.length === 1 ? 'inscrição' : 'inscrições'}
                          </p>
                        </div>

                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-2 mb-1">
                            <DollarSign className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">Valor Proposto</span>
                          </div>
                          <p className="text-lg font-bold text-blue-700">
                            R$ {((processo.valoresEspecificos as Record<string, unknown>)?.transacao as Record<string, unknown>)?.valorTotalProposto ? Number(((processo.valoresEspecificos as Record<string, unknown>).transacao as Record<string, unknown>).valorTotalProposto).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                          </p>
                          <p className="text-xs text-blue-600">
                            {((processo.valoresEspecificos as Record<string, unknown>)?.transacao as Record<string, unknown>)?.proposta ? (((processo.valoresEspecificos as Record<string, unknown>).transacao as Record<string, unknown>).proposta as Record<string, unknown>)?.metodoPagamento === 'a_vista' ? 'À vista' : `${((((processo.valoresEspecificos as Record<string, unknown>).transacao as Record<string, unknown>).proposta as Record<string, unknown>)?.quantidadeParcelas || 1)}x parcelas` : 'N/A'}
                          </p>
                        </div>

                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Calculator className="h-4 w-4 text-gray-600" />
                            <span className="text-sm font-medium text-gray-800">Desconto</span>
                          </div>
                          <p className="text-lg font-bold text-gray-700">
                            R$ {((processo.valoresEspecificos as Record<string, unknown>)?.transacao as Record<string, unknown>)?.valorDesconto ? Number(((processo.valoresEspecificos as Record<string, unknown>).transacao as Record<string, unknown>).valorDesconto).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                          </p>
                          <p className="text-xs text-gray-600">
                            {((processo.valoresEspecificos as Record<string, unknown>)?.transacao as Record<string, unknown>)?.percentualDesconto ? Number(((processo.valoresEspecificos as Record<string, unknown>).transacao as Record<string, unknown>).percentualDesconto).toFixed(1) : '0.0'}% de desconto
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {/* Para outros tipos de processo, mostrar resumo genérico */}
                    {!['COMPENSACAO', 'DACAO_PAGAMENTO', 'TRANSACAO_EXCEPCIONAL'].includes(processo.tipo) && (
                      <div className="text-center py-4">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Calculator className="h-5 w-5 text-gray-400" />
                          <span className="text-gray-500">Valores configurados</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Clique em &quot;Configurar Valores&quot; para visualizar ou editar
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tramitacoes">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Tramitações</CardTitle>
              <CardDescription>
                Acompanhe o fluxo do processo entre os setores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(processo.tramitacoes?.length || 0) === 0 ? (
                <div className="text-center py-8">
                  <ArrowRight className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-gray-500">
                    Nenhuma tramitação registrada
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {processo.tramitacoes?.map((tramitacao, index) => (
                    <div key={tramitacao.id} className="flex gap-4 pb-4 border-b last:border-b-0">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {(processo.tramitacoes?.length || 0) - index}
                        </span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{tramitacao.setorOrigem}</span>
                              <ArrowRight className="h-4 w-4" />
                              <span>{tramitacao.setorDestino}</span>
                            </div>
                          </h4>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <span className="text-sm text-gray-500">
                                Enviado: {new Date(tramitacao.dataEnvio).toLocaleDateString('pt-BR')}
                              </span>
                              {tramitacao.dataRecebimento && (
                                <p className="text-sm text-green-600 font-medium">
                                  ✓ Recebido: {new Date(tramitacao.dataRecebimento).toLocaleDateString('pt-BR')}
                                </p>
                              )}
                            </div>
                            {!tramitacao.dataRecebimento && canEdit && (
                              <Button
                                size="sm"
                                variant="default"
                                className="cursor-pointer ml-2"
                                onClick={() => handleMarcarRecebida(tramitacao.id)}
                              >
                                Marcar Recebida
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          {tramitacao.dataRecebimento ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">Recebida</Badge>
                          ) : tramitacao.prazoResposta && new Date(tramitacao.prazoResposta) < new Date() ? (
                            <Badge className="bg-red-100 text-red-800 text-xs">Atrasada</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800 text-xs">Pendente</Badge>
                          )}
                        </div>

                        {tramitacao.observacoes && (
                          <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{tramitacao.observacoes}</p>
                        )}

                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Por: {tramitacao.usuario?.name || 'Sistema'}</span>
                          {tramitacao.prazoResposta && (
                            <span className="text-orange-600">
                              Prazo: {new Date(tramitacao.prazoResposta).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="julgamento">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Julgamento</CardTitle>
              <CardDescription>
                Resultados dos julgamentos deste processo nas sessões
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!processo.decisoes || processo.decisoes.length === 0 ? (
                <div className="text-center py-8">
                  <Gavel className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-gray-500">
                    Nenhum julgamento registrado
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {processo.decisoes
                    .sort((a: ProcessoDecisao, b: ProcessoDecisao) => {
                      return new Date(a.dataDecisao).getTime() - new Date(b.dataDecisao).getTime()
                    })
                    .map((decisao: ProcessoDecisao, index: number) => {
                      const processoPauta = processo.pautas?.find((p: ProcessoPautaWithDetails) => p.pauta?.id === decisao.sessao?.pauta?.id)
                      const cardBackground = getCardBackground(decisao)

                      return (
                        <div
                          key={decisao.id}
                          className={`border rounded-lg p-4 ${cardBackground}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${decisao.tipoResultado === 'JULGADO' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                {index + 1}
                              </span>
                              <div>
                                <Link
                                  href={`/sessoes/${decisao.sessao?.id || ''}`}
                                  className="font-medium hover:text-blue-600"
                                >
                                  Sessão de {decisao.sessao?.pauta ? new Date(decisao.sessao.pauta.dataPauta).toLocaleDateString('pt-BR') : new Date(decisao.dataDecisao).toLocaleDateString('pt-BR')}
                                </Link>
                                <p className="text-sm text-gray-600">
                                  Pauta: {decisao.sessao?.pauta?.numero || 'N/A'}
                                </p>
                                {processoPauta?.relator && (
                                  <p className="text-sm text-blue-600">Relator: {processoPauta.relator}</p>
                                )}
                                {processoPauta?.revisores && Array.isArray(processoPauta.revisores) && processoPauta.revisores.length > 0 && (
                                  <p className="text-sm text-blue-600">
                                    Revisor{processoPauta.revisores.length > 1 ? 'es' : ''}: {processoPauta.revisores.join(', ')}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right space-y-2">
                              <div className="space-y-2">
                                {getResultadoBadge(decisao)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2">
                            <div className="p-3 bg-white rounded border">
                              <h5 className="text-sm font-medium mb-2">Ata:</h5>
                              <p className="text-sm text-gray-700">{processoPauta?.ataTexto || 'Texto da ata não informado'}</p>

                              {decisao.votos && decisao.votos.length > 0 && (
                                <div className="mt-3 pt-2 border-t">
                                  <h6 className="text-xs font-medium text-gray-600 mb-3">Votos registrados:</h6>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Relatores/Revisores */}
                                    {decisao.votos.filter((voto: ProcessoVoto) => ['RELATOR', 'REVISOR'].includes(voto.tipoVoto)).length > 0 && (
                                      <Card className="p-3">
                                        <div className="font-medium text-gray-800 mb-2 text-sm">Relatores/Revisores</div>
                                        <div className="space-y-1">
                                          {decisao.votos
                                            .filter((voto: ProcessoVoto) => ['RELATOR', 'REVISOR'].includes(voto.tipoVoto))
                                            .map((voto: ProcessoVoto, index: number) => (
                                              <div key={index} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                  <Badge variant={voto.tipoVoto === 'RELATOR' ? 'default' : 'secondary'} className="text-xs">
                                                    {voto.tipoVoto === 'RELATOR' ? 'Relator' : 'Revisor'}
                                                  </Badge>
                                                  <span className="truncate font-medium">{voto.nomeVotante}</span>
                                                </div>
                                                <span className={`font-medium text-xs ${voto.acompanhaVoto ? 'text-blue-600' :
                                                  voto.posicaoVoto === 'DEFERIDO' ? 'text-green-600' :
                                                    voto.posicaoVoto === 'INDEFERIDO' ? 'text-red-600' :
                                                      voto.posicaoVoto === 'PARCIAL' ? 'text-yellow-600' :
                                                        'text-blue-600'
                                                  }`}>
                                                  {voto.acompanhaVoto
                                                    ? `Acomp. ${voto.acompanhaVoto.split(' ')[0]}`
                                                    : voto.posicaoVoto}
                                                </span>
                                              </div>
                                            ))}
                                        </div>
                                      </Card>
                                    )}

                                    {/* Conselheiros */}
                                    <Card className="p-3">
                                      <div className="font-medium text-gray-800 mb-3 text-sm">Conselheiros</div>
                                      <div className="max-h-24 overflow-y-auto space-y-1">
                                        {/* Votos válidos agrupados */}
                                        {['DEFERIDO', 'INDEFERIDO', 'PARCIAL'].map(posicao => {
                                          const conselheirosComEssePosicao = (decisao.votos || [])
                                            .filter((voto: ProcessoVoto) => voto.tipoVoto === 'CONSELHEIRO' && voto.posicaoVoto === posicao)
                                            .map((voto: ProcessoVoto) => voto.nomeVotante)

                                          if (conselheirosComEssePosicao.length === 0) return null

                                          return (
                                            <div key={posicao} className="text-xs">
                                              <span className={`font-medium ${posicao === 'DEFERIDO' ? 'text-green-600' :
                                                posicao === 'INDEFERIDO' ? 'text-red-600' :
                                                  'text-yellow-600'
                                                }`}>
                                                {posicao}:
                                              </span>
                                              <span className="ml-1 text-gray-700">
                                                {formatarListaNomes(conselheirosComEssePosicao)}
                                              </span>
                                            </div>
                                          )
                                        })}

                                        {/* Abstenções agrupadas */}
                                        {(decisao.votos || []).filter((voto: ProcessoVoto) => voto.tipoVoto === 'CONSELHEIRO' && ['ABSTENCAO', 'AUSENTE', 'IMPEDIDO'].includes(voto.posicaoVoto)).length > 0 && (
                                          <div className="border-t pt-1 mt-1">
                                            {['AUSENTE', 'IMPEDIDO', 'ABSTENCAO'].map(posicao => {
                                              const conselheirosComEssePosicao = (decisao.votos || [])
                                                .filter((voto: ProcessoVoto) => voto.tipoVoto === 'CONSELHEIRO' && voto.posicaoVoto === posicao)
                                                .map((voto: ProcessoVoto) => voto.nomeVotante)

                                              if (conselheirosComEssePosicao.length === 0) return null

                                              return (
                                                <div key={posicao} className="text-xs">
                                                  <span className="font-medium text-gray-600">
                                                    {posicao === 'ABSTENCAO' ? 'ABSTENÇÃO' :
                                                      posicao === 'AUSENTE' ? 'AUSENTE' : 'IMPEDIDO'}:
                                                  </span>
                                                  <span className="ml-1 text-gray-600">
                                                    {formatarListaNomes(conselheirosComEssePosicao)}
                                                  </span>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </Card>
                                  </div>
                                </div>
                              )}

                              {/* Voto do Presidente se houve empate */}
                              {decisao.sessao?.presidente && (decisao.votos || []).find((voto: ProcessoVoto) =>
                                voto.conselheiroId === decisao.sessao?.presidente?.id ||
                                voto.nomeVotante === decisao.sessao?.presidente?.nome
                              ) && (
                                  <Card className="p-3 mt-4 border-yellow-300 bg-yellow-50">
                                    <div className="font-medium text-gray-800 mb-2 text-sm flex items-center gap-2">
                                      ⚖️ Voto de Desempate - Presidente
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-700">
                                          Presidente
                                        </Badge>
                                        <span className="truncate font-medium">{decisao.sessao.presidente.nome}</span>
                                      </div>
                                      <span className={`font-medium text-xs ${(decisao.votos || []).find((voto: ProcessoVoto) =>
                                        voto.conselheiroId === decisao.sessao?.presidente?.id ||
                                        voto.nomeVotante === decisao.sessao?.presidente?.nome
                                      )?.posicaoVoto === 'DEFERIDO' ? 'text-green-600' :
                                        (decisao.votos || []).find((voto: ProcessoVoto) =>
                                          voto.conselheiroId === decisao.sessao?.presidente?.id ||
                                          voto.nomeVotante === decisao.sessao?.presidente?.nome
                                        )?.posicaoVoto === 'INDEFERIDO' ? 'text-red-600' :
                                          'text-yellow-600'
                                        }`}>
                                        {(decisao.votos || []).find((voto: ProcessoVoto) =>
                                          voto.conselheiroId === decisao.sessao?.presidente?.id ||
                                          voto.nomeVotante === decisao.sessao?.presidente?.nome
                                        )?.posicaoVoto}
                                      </span>
                                    </div>
                                  </Card>
                                )}

                              <p className="text-xs text-gray-500 mt-2">
                                Registrada em {new Date(decisao.dataDecisao).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <ProcessoDocumentos
            processo={{
              id: processo.id,
              numero: processo.numero,
              documentos: processo.documentos?.map((doc) => ({
                id: String(doc.id),
                nome: String(doc.nome),
                tipo: String(doc.tipo),
                url: String(doc.url),
                tamanho: Number(doc.tamanho),
                createdAt: String(doc.createdAt)
              })) || []
            }}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="acordo">
          <Card>
            <CardHeader>
              <CardTitle>Acordo e Parcelas</CardTitle>
              <CardDescription>
                Informações sobre o acordo firmado e controle de pagamentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!processo.acordo ? (
                (() => {
                  // Verificar se há decisão que define acordo
                  const decisaoComAcordo = processo.decisoes?.find((d: ProcessoDecisao) => d.definirAcordo === true)

                  if (decisaoComAcordo) {
                    return (
                      <div className="space-y-6">
                        {/* Proposta da Sessão */}
                        <Card className="border-green-200 bg-green-50">
                          <CardHeader>
                            <CardTitle className="text-green-800 text-lg">
                              Proposta Aprovada em Sessão
                            </CardTitle>
                            <CardDescription className="text-green-700">
                              Esta proposta foi aprovada na sessão de {new Date(decisaoComAcordo.dataDecisao).toLocaleDateString('pt-BR')}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                              <div className="p-3 bg-white rounded-lg border">
                                <div className="text-sm text-gray-600 mb-1">Tipo de Acordo</div>
                                <p className="font-medium">
                                  {decisaoComAcordo.tipoAcordo === 'aceita_proposta' ? 'Aceita Proposta do Contribuinte' :
                                    decisaoComAcordo.tipoAcordo === 'contra_proposta' ? 'Contra-proposta do CCF' :
                                      'Sem Acordo'}
                                </p>
                              </div>

                              {processo.valoresEspecificos && (
                                <>
                                  {processo.tipo === 'TRANSACAO_EXCEPCIONAL' && processo.valoresEspecificos.transacao && (
                                    <>
                                      <div className="p-3 bg-white rounded-lg border">
                                        <div className="text-sm text-gray-600 mb-1">Valor Original</div>
                                        <p className="font-medium text-lg">
                                          R$ {((processo.valoresEspecificos as Record<string, unknown>)?.transacao as Record<string, unknown>)?.valorTotalInscricoes ? Number(((processo.valoresEspecificos as Record<string, unknown>).transacao as Record<string, unknown>).valorTotalInscricoes).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                                        </p>
                                      </div>
                                      <div className="p-3 bg-white rounded-lg border">
                                        <div className="text-sm text-gray-600 mb-1">Valor Proposto</div>
                                        <p className="font-medium text-lg text-green-600">
                                          R$ {((processo.valoresEspecificos as Record<string, unknown>)?.transacao as Record<string, unknown>)?.valorTotalProposto ? Number(((processo.valoresEspecificos as Record<string, unknown>).transacao as Record<string, unknown>).valorTotalProposto).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                                        </p>
                                      </div>
                                    </>
                                  )}

                                  {processo.tipo === 'COMPENSACAO' && processo.valoresEspecificos.creditos && processo.valoresEspecificos.inscricoes && (
                                    <>
                                      <div className="p-3 bg-white rounded-lg border">
                                        <div className="text-sm text-gray-600 mb-1">Total Créditos</div>
                                        <p className="font-medium text-lg">
                                          R$ {processo.valoresEspecificos.creditos.reduce((total, credito) => total + credito.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                      </div>
                                      <div className="p-3 bg-white rounded-lg border">
                                        <div className="text-sm text-gray-600 mb-1">Total a Compensar</div>
                                        <p className="font-medium text-lg text-green-600">
                                          R$ {processo.valoresEspecificos.inscricoes.reduce((total, inscricao) =>
                                            total + (inscricao.debitos?.reduce((subtotal, debito) => subtotal + debito.valor, 0) || 0), 0
                                          ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                      </div>
                                    </>
                                  )}

                                  {processo.tipo === 'DACAO_PAGAMENTO' && processo.valoresEspecificos.imoveis && processo.valoresEspecificos.inscricoes && (
                                    <>
                                      <div className="p-3 bg-white rounded-lg border">
                                        <div className="text-sm text-gray-600 mb-1">Total Imóveis</div>
                                        <p className="font-medium text-lg">
                                          R$ {processo.valoresEspecificos.imoveis.reduce((total, imovel) => total + (imovel.valorAvaliacao || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                      </div>
                                      <div className="p-3 bg-white rounded-lg border">
                                        <div className="text-sm text-gray-600 mb-1">Total a Compensar</div>
                                        <p className="font-medium text-lg text-green-600">
                                          R$ {processo.valoresEspecificos.inscricoes.reduce((total, inscricao) =>
                                            total + (inscricao.debitos?.reduce((subtotal, debito) => subtotal + debito.valor, 0) || 0), 0
                                          ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                      </div>
                                    </>
                                  )}
                                </>
                              )}
                            </div>

                            {canEdit && (
                              <div className="flex justify-center">
                                <Link href={`/acordos/novo?processo=${processo.id}`}>
                                  <Button className="cursor-pointer">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Criar Acordo Baseado na Proposta
                                  </Button>
                                </Link>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )
                  }

                  return (
                    <div className="text-center py-8">
                      <FileText className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-gray-500">
                        Nenhum acordo firmado ainda
                      </p>
                      {canEdit && processo.status === 'JULGADO' && (
                        <div className="mt-4">
                          <Link href={`/acordos/novo?processo=${processo.id}`}>
                            <Button variant="outline" className="cursor-pointer">
                              <Plus className="mr-2 h-4 w-4" />
                              Criar Acordo
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })()
              ) : (
                <div className="space-y-4">
                  {processo.acordos?.map((acordo) => {
                    // Calcular progresso do pagamento
                    const valorTotal = Number(acordo.valorFinal) || 0
                    const valorPago = (acordo.parcelas as ProcessoParcela[]).reduce((total: number, parcela: ProcessoParcela) => {
                      return total + (parcela.pagamentos || []).reduce((subtotal: number, pagamento: ProcessoPagamento) => {
                        return subtotal + (Number(pagamento.valorPago) || 0)
                      }, 0)
                    }, 0)
                    const percentual = valorTotal > 0 ? Math.round((valorPago / valorTotal) * 100) : 0
                    const progresso = {
                      valorTotal,
                      valorPago,
                      valorPendente: valorTotal - valorPago,
                      percentual
                    }

                    const vencido = new Date(String(acordo.dataVencimento)) < new Date() && acordo.status === 'ativo'

                    // Função para mostrar informações das parcelas
                    const getDisplayParcelasInfo = () => {
                      const totalParcelas = acordo.parcelas.length
                      if (processo.tipo === 'TRANSACAO_EXCEPCIONAL' && acordo.modalidadePagamento === 'parcelado' && totalParcelas > 1) {
                        const parcelasRestantes = totalParcelas - 1
                        return `Entrada + ${parcelasRestantes} parcela${parcelasRestantes !== 1 ? 's' : ''}`
                      }
                      return `${totalParcelas} parcela${totalParcelas !== 1 ? 's' : ''}`
                    }

                    return (
                      <Card key={acordo.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-3 flex-1">
                              {/* Cabeçalho do Acordo */}
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="font-semibold text-lg">
                                  {acordo.numeroTermo}
                                </span>
                                <Badge className={acordo.status === 'ativo' ? 'bg-green-100 text-green-800' : acordo.status === 'cancelado' ? 'bg-orange-100 text-orange-800' : acordo.status === 'cumprido' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}>
                                  {acordo.status === 'ativo' ? 'Ativo' : acordo.status === 'cancelado' ? 'Cancelado' : acordo.status === 'cumprido' ? 'Cumprido' : acordo.status}
                                </Badge>
                                {vencido && (
                                  <Badge className="bg-red-100 text-red-800">
                                    <AlertTriangle className="mr-1 h-3 w-3" />
                                    Vencido
                                  </Badge>
                                )}
                                <Badge variant="outline">
                                  {acordo.modalidadePagamento === 'avista' ? 'À Vista' : `${acordo.numeroParcelas}x`}
                                </Badge>
                                {/* Badge para tipo de processo */}
                                {processo.tipo === 'TRANSACAO_EXCEPCIONAL' && (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                    Transação Excepcional
                                  </Badge>
                                )}
                                {processo.tipo === 'DACAO_PAGAMENTO' && (
                                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                                    Dação em Pagamento
                                  </Badge>
                                )}
                                {processo.tipo === 'COMPENSACAO' && (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                                    Compensação
                                  </Badge>
                                )}
                              </div>

                              {/* Valores e Progresso */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">Progresso do Pagamento</span>
                                  <span className="font-medium">{progresso.percentual}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progresso.percentual}%` }}
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-gray-500">Total:</span>
                                    <p className="font-medium">
                                      R$ {progresso.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Pago:</span>
                                    <p className="font-medium text-green-600">
                                      R$ {progresso.valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Pendente:</span>
                                    <p className="font-medium text-yellow-600">
                                      R$ {progresso.valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Informações do Acordo */}
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4" />
                                  <span>Assinado: {new Date(String(acordo.dataAssinatura)).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4" />
                                  <span>Vence: {new Date(String(acordo.dataVencimento)).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  <span>{getDisplayParcelasInfo()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-4 w-4" />
                                  <span>{acordo.parcelas.reduce((total, p) => total + (p.pagamentos?.length || 0), 0)} pagamento{acordo.parcelas.reduce((total, p) => total + (p.pagamentos?.length || 0), 0) !== 1 ? 's' : ''}</span>
                                </div>
                              </div>

                              {/* Próximas Parcelas */}
                              {acordo.parcelas.filter(p => p.status === 'PENDENTE').length > 0 && (
                                <div className="border-t pt-3">
                                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                                    Próximas Parcelas:
                                  </h4>
                                  <div className="space-y-1">
                                    {acordo.parcelas
                                      .filter(p => p.status === 'PENDENTE')
                                      .slice(0, 2)
                                      .map((parcela) => (
                                        <div key={parcela.id} className="text-sm flex items-center justify-between">
                                          <span>
                                            {parcela.numero === 0 ? 'Entrada' : `Parcela ${parcela.numero}`} - {new Date(String(parcela.dataVencimento)).toLocaleDateString('pt-BR')}
                                          </span>
                                          <span className="font-medium">
                                            R$ {Number(parcela.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>
                                      ))}
                                    {acordo.parcelas.filter(p => p.status === 'PENDENTE').length > 2 && (
                                      <div className="text-xs text-gray-500">
                                        ... e mais {acordo.parcelas.filter(p => p.status === 'PENDENTE').length - 2} parcela{acordo.parcelas.filter(p => p.status === 'PENDENTE').length - 2 !== 1 ? 's' : ''}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Ações */}
                            <div className="flex flex-col gap-2 ml-4">
                              <Link href={`/acordos/${acordo.id}`}>
                                <Button variant="outline" size="sm" className="w-full cursor-pointer">
                                  Ver Detalhes
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Histórico Completo</CardTitle>
                  <CardDescription>
                    Timeline completa do processo
                  </CardDescription>
                </div>
                {canEdit && (
                  <Button
                    onClick={() => setShowHistoricoModal(true)}
                    className="cursor-pointer"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Histórico
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Históricos customizados */}
                {processo.historicos?.map((historico) => {
                  // Função para obter ícone específico baseado no título da decisão
                  const getDecisaoIcon = (titulo: string) => {
                    if (titulo.includes('Suspenso')) return Pause
                    if (titulo.includes('Vista')) return Eye
                    if (titulo.includes('Diligência')) return FilePlus
                    if (titulo.includes('Julgado')) return Gavel
                    return XCircle // ícone padrão para decisões
                  }

                  const tipoIcon = {
                    'EVENTO': CheckCircle,
                    'OBSERVACAO': AlertCircle,
                    'ALTERACAO': Edit,
                    'COMUNICACAO': Mail,
                    'DECISAO': historico.tipo === 'DECISAO' ? getDecisaoIcon(historico.titulo) : XCircle,
                    'SISTEMA': CheckCircle,
                    'PAUTA': Calendar,
                    'REPAUTAMENTO': Calendar,
                    'TRAMITACAO': ArrowRight,
                    'TRAMITACAO_ENTREGUE': ArrowRight,
                    'ACORDO': CreditCard
                  }[historico.tipo] || History

                  const tipoLabel = {
                    'EVENTO': 'Evento',
                    'OBSERVACAO': 'Observação',
                    'ALTERACAO': 'Alteração',
                    'COMUNICACAO': 'Comunicação',
                    'DECISAO': 'Decisão',
                    'SISTEMA': 'Sistema',
                    'PAUTA': 'Pauta',
                    'REPAUTAMENTO': 'Repautamento',
                    'TRAMITACAO': 'Tramitação',
                    'TRAMITACAO_ENTREGUE': 'Tramitação',
                    'ACORDO': 'Acordo'
                  }[historico.tipo] || historico.tipo

                  const Icon = tipoIcon

                  // Função para obter cor específica baseada no título da decisão
                  const getDecisaoCor = (titulo: string) => {
                    if (titulo.includes('Suspenso')) return { bg: 'bg-yellow-100', text: 'text-yellow-600' }
                    if (titulo.includes('Vista')) return { bg: 'bg-blue-100', text: 'text-blue-600' }
                    if (titulo.includes('Diligência')) return { bg: 'bg-orange-100', text: 'text-orange-600' }
                    if (titulo.includes('Julgado')) return { bg: 'bg-green-100', text: 'text-green-600' }
                    return { bg: 'bg-gray-100', text: 'text-gray-600' }
                  }

                  return (
                    <div key={historico.id} className="flex gap-4 pb-4 border-b last:border-b-0">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${historico.tipo === 'SISTEMA' ? 'bg-green-100' :
                        historico.tipo === 'PAUTA' || historico.tipo === 'REPAUTAMENTO' ? 'bg-purple-100' :
                          historico.tipo === 'DECISAO' ? getDecisaoCor(historico.titulo).bg :
                            historico.tipo === 'TRAMITACAO' || historico.tipo === 'TRAMITACAO_ENTREGUE' ? 'bg-orange-100' :
                              historico.tipo === 'ACORDO' ? 'bg-green-100' :
                                'bg-blue-100'
                        }`}>
                        <Icon className={`h-4 w-4 ${historico.tipo === 'SISTEMA' ? 'text-green-600' :
                          historico.tipo === 'PAUTA' || historico.tipo === 'REPAUTAMENTO' ? 'text-purple-600' :
                            historico.tipo === 'DECISAO' ? getDecisaoCor(historico.titulo).text :
                              historico.tipo === 'TRAMITACAO' || historico.tipo === 'TRAMITACAO_ENTREGUE' ? 'text-orange-600' :
                                historico.tipo === 'ACORDO' ? 'text-green-600' :
                                  'text-blue-600'
                          }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{historico.titulo}</h4>
                          <Badge variant="outline" className="text-xs">
                            {tipoLabel}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {historico.descricao}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{historico.usuario.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(historico.createdAt).toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {(processo.historicos?.length || 0) === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <History className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p>Nenhum histórico adicional registrado</p>
                    {canEdit && (
                      <p className="text-sm mt-1">
                        Clique em &quot;Adicionar Histórico&quot; para registrar eventos
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Adicionar Histórico */}
      {canEdit && resolvedParams && (
        <AdicionarHistoricoModal
          processoId={resolvedParams.id}
          open={showHistoricoModal}
          onOpenChange={setShowHistoricoModal}
          onSuccess={() => {
            loadProcesso()
          }}
        />
      )}

      {/* Modal de Alterar Status */}
      {canEdit && resolvedParams && processo && (
        <AlterarStatusModal
          processoId={resolvedParams.id}
          statusAtual={processo.status}
          open={showStatusModal}
          onOpenChange={setShowStatusModal}
          onSuccess={() => {
            loadProcesso()
          }}
        />
      )}

      {/* Modal de Valores do Processo */}
      {canEdit && resolvedParams && processo && (
        <ValoresProcessoModal
          open={showValoresModal}
          onOpenChange={setShowValoresModal}
          processo={{
            id: resolvedParams.id,
            tipo: processo.tipo
          }}
          onSuccess={() => {
            loadProcesso()
          }}
        />
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-gray-600 mb-1">{children}</p>
}
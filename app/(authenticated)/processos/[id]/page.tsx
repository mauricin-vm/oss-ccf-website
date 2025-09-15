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
  MapPin,
  Phone,
  Mail,
  Clock,
  AlertCircle,
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
  Gavel
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser, ProcessoWithRelations } from '@/types'
import ProcessoDocumentos from '@/components/processo/processo-documentos'
import AdicionarHistoricoModal from '@/components/modals/adicionar-historico-modal'
import AlterarStatusModal from '@/components/modals/alterar-status-modal'
import ProcessoActions from '@/components/processo/processo-actions'



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

  const statusParcelaMap = {
    PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
    PAGO: { label: 'Pago', color: 'bg-green-100 text-green-800' },
    ATRASADO: { label: 'Atrasado', color: 'bg-red-100 text-red-800' },
    CANCELADO: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' }
  }

  const canEdit = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'
  const statusInfo = statusMap[processo.status] || { label: processo.status, color: 'bg-gray-100 text-gray-800', icon: AlertCircle }
  const StatusIcon = statusInfo.icon

  const getResultadoBadge = (decisao: any) => {
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

  const getCardBackground = (decisao: any) => {
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
      <div className="grid gap-4 md:grid-cols-4">
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
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Original</p>
                <p className="text-lg font-bold">
                  {processo.valorOriginal ? Number(processo.valorOriginal).toLocaleString('pt-BR') : '0,00'}
                </p>
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
                    <Label>Valor Original</Label>
                    <p className="font-medium">R$ {processo.valorOriginal ? Number(processo.valorOriginal).toLocaleString('pt-BR') : '0,00'}</p>
                  </div>
                  {processo.valorNegociado && (
                    <div>
                      <Label>Valor Negociado</Label>
                      <p className="font-medium">R$ {Number(processo.valorNegociado).toLocaleString('pt-BR')}</p>
                    </div>
                  )}
                  <div>
                    <Label>Data de Abertura</Label>
                    <p className="font-medium">{new Date(processo.dataAbertura).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <Label>Criado por</Label>
                    <p className="font-medium">{processo.createdBy.name}</p>
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
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome/Razão Social</Label>
                    <p className="font-medium">{processo.contribuinte.nome}</p>
                  </div>
                  <div>
                    <Label>CPF/CNPJ</Label>
                    <p className="font-medium">{processo.contribuinte.cpfCnpj}</p>
                  </div>
                  {processo.contribuinte.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <div>
                        <Label>Email</Label>
                        <p className="font-medium">{processo.contribuinte.email}</p>
                      </div>
                    </div>
                  )}
                  {processo.contribuinte.telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <div>
                        <Label>Telefone</Label>
                        <p className="font-medium">{processo.contribuinte.telefone}</p>
                      </div>
                    </div>
                  )}
                </div>

                {processo.contribuinte.endereco && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-500 mt-1" />
                    <div className="space-y-1">
                      <Label>Endereço</Label>
                      <p className="font-medium">{processo.contribuinte.endereco}</p>
                      {(processo.contribuinte.cidade || processo.contribuinte.estado || processo.contribuinte.cep) && (
                        <p className="text-sm text-gray-600">
                          {processo.contribuinte.cidade}, {processo.contribuinte.estado} - {processo.contribuinte.cep}
                        </p>
                      )}
                    </div>
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
              {processo.tramitacoes.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  Nenhuma tramitação registrada
                </p>
              ) : (
                <div className="space-y-4">
                  {processo.tramitacoes.map((tramitacao, index) => (
                    <div key={tramitacao.id} className="flex gap-4 pb-4 border-b last:border-b-0">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {processo.tramitacoes.length - index}
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
                          <span>Por: {tramitacao.usuario.name}</span>
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
                  <Gavel className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum julgamento registrado
                  </h3>
                  <p className="text-gray-600">
                    Este processo ainda não foi julgado em nenhuma sessão.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {processo.decisoes
                    .sort((a, b) => {
                      return new Date(a.dataDecisao).getTime() - new Date(b.dataDecisao).getTime()
                    })
                    .map((decisao, index) => {
                    const processoPauta = processo.pautas.find(p => p.pauta.id === decisao.sessao?.pauta?.id)
                    const cardBackground = getCardBackground(decisao)

                    return (
                      <div
                        key={decisao.id}
                        className={`border rounded-lg p-4 ${cardBackground}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              decisao.tipoResultado === 'JULGADO' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {index + 1}
                            </span>
                            <div>
                              <Link
                                href={`/sessoes/${decisao.sessao?.id}`}
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
                              {processoPauta?.revisores && processoPauta.revisores.length > 0 && (
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
                                  {decisao.votos.filter((voto: any) => ['RELATOR', 'REVISOR'].includes(voto.tipoVoto)).length > 0 && (
                                    <Card className="p-3">
                                      <div className="font-medium text-gray-800 mb-2 text-sm">Relatores/Revisores</div>
                                      <div className="space-y-1">
                                        {decisao.votos
                                          .filter((voto: any) => ['RELATOR', 'REVISOR'].includes(voto.tipoVoto))
                                          .map((voto: any, index: number) => (
                                            <div key={index} className="flex items-center justify-between text-xs">
                                              <div className="flex items-center gap-2">
                                                <Badge variant={voto.tipoVoto === 'RELATOR' ? 'default' : 'secondary'} className="text-xs">
                                                  {voto.tipoVoto === 'RELATOR' ? 'Relator' : 'Revisor'}
                                                </Badge>
                                                <span className="truncate font-medium">{voto.nomeVotante}</span>
                                              </div>
                                              <span className={`font-medium text-xs ${
                                                voto.acompanhaVoto ? 'text-blue-600' :
                                                voto.posicaoVoto === 'DEFERIDO' ? 'text-green-600' :
                                                voto.posicaoVoto === 'INDEFERIDO' ? 'text-red-600' :
                                                voto.posicaoVoto === 'PARCIAL' ? 'text-yellow-600' :
                                                'text-blue-600'
                                              }`}>
                                                {voto.acompanhaVoto
                                                  ? `Acomp. ${voto.acompanhaVoto?.split(' ')[0]}`
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
                                        const conselheirosComEssePosicao = decisao.votos
                                          .filter((voto: any) => voto.tipoVoto === 'CONSELHEIRO' && voto.posicaoVoto === posicao)
                                          .map((voto: any) => voto.nomeVotante)

                                        if (conselheirosComEssePosicao.length === 0) return null

                                        return (
                                          <div key={posicao} className="text-xs">
                                            <span className={`font-medium ${
                                              posicao === 'DEFERIDO' ? 'text-green-600' :
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
                                      {decisao.votos.filter((voto: any) => voto.tipoVoto === 'CONSELHEIRO' && ['ABSTENCAO', 'AUSENTE', 'IMPEDIDO'].includes(voto.posicaoVoto)).length > 0 && (
                                        <div className="border-t pt-1 mt-1">
                                          {['AUSENTE', 'IMPEDIDO', 'ABSTENCAO'].map(posicao => {
                                            const conselheirosComEssePosicao = decisao.votos
                                              .filter((voto: any) => voto.tipoVoto === 'CONSELHEIRO' && voto.posicaoVoto === posicao)
                                              .map((voto: any) => voto.nomeVotante)

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
                            {decisao.sessao?.presidente && decisao.votos.find((voto: any) =>
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
                                  <span className={`font-medium text-xs ${
                                    decisao.votos.find((voto: any) =>
                                      voto.conselheiroId === decisao.sessao?.presidente?.id ||
                                      voto.nomeVotante === decisao.sessao?.presidente?.nome
                                    )?.posicaoVoto === 'DEFERIDO' ? 'text-green-600' :
                                    decisao.votos.find((voto: any) =>
                                      voto.conselheiroId === decisao.sessao?.presidente?.id ||
                                      voto.nomeVotante === decisao.sessao?.presidente?.nome
                                    )?.posicaoVoto === 'INDEFERIDO' ? 'text-red-600' :
                                    'text-yellow-600'
                                  }`}>
                                    {decisao.votos.find((voto: any) =>
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
              documentos: processo.documentos.map(doc => ({
                id: doc.id,
                nome: doc.nome,
                tipo: doc.tipo,
                url: doc.url,
                tamanho: doc.tamanho,
                createdAt: doc.createdAt
              }))
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
                <p className="text-center text-gray-500 py-4">
                  Nenhum acordo firmado ainda
                </p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Número do Termo</Label>
                      <p className="font-medium">{processo.acordo.numeroTermo}</p>
                    </div>
                    <div>
                      <Label>Data de Assinatura</Label>
                      <p className="font-medium">
                        {new Date(processo.acordo.dataAssinatura).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <Label>Valor Total</Label>
                      <p className="font-medium">
                        R$ {Number(processo.acordo.valorTotal).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Parcelas ({processo.acordo.parcelas.length})</h4>
                    <div className="space-y-2">
                      {processo.acordo.parcelas.map((parcela) => (
                        <div key={parcela.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <span className="font-medium">#{parcela.numero}</span>
                            <div>
                              <p className="font-medium">
                                R$ {Number(parcela.valor).toLocaleString('pt-BR')}
                              </p>
                              <p className="text-sm text-gray-500">
                                Vencimento: {new Date(parcela.dataVencimento).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <Badge className={statusParcelaMap[parcela.status].color}>
                            {statusParcelaMap[parcela.status].label}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
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
                {processo.historicos.map((historico) => {
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
                    'REPAUTAMENTO': Calendar
                  }[historico.tipo] || History
                  
                  const tipoLabel = {
                    'EVENTO': 'Evento',
                    'OBSERVACAO': 'Observação',
                    'ALTERACAO': 'Alteração',
                    'COMUNICACAO': 'Comunicação',
                    'DECISAO': 'Decisão',
                    'SISTEMA': 'Sistema',
                    'PAUTA': 'Pauta',
                    'REPAUTAMENTO': 'Repautamento'
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
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        historico.tipo === 'SISTEMA' ? 'bg-green-100' :
                        historico.tipo === 'PAUTA' || historico.tipo === 'REPAUTAMENTO' ? 'bg-purple-100' :
                        historico.tipo === 'DECISAO' ? getDecisaoCor(historico.titulo).bg :
                        'bg-blue-100'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          historico.tipo === 'SISTEMA' ? 'text-green-600' :
                          historico.tipo === 'PAUTA' || historico.tipo === 'REPAUTAMENTO' ? 'text-purple-600' :
                          historico.tipo === 'DECISAO' ? getDecisaoCor(historico.titulo).text :
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

                {processo.historicos.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <History className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p>Nenhum histórico adicional registrado</p>
                    {canEdit && (
                      <p className="text-sm mt-1">
                        Clique em &ldquo;Adicionar Histórico&rdquo; para registrar eventos
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
          onSuccess={loadProcesso}
        />
      )}

      {/* Modal de Alterar Status */}
      {canEdit && resolvedParams && processo && (
        <AlterarStatusModal
          processoId={resolvedParams.id}
          statusAtual={processo.status}
          open={showStatusModal}
          onOpenChange={setShowStatusModal}
          onSuccess={loadProcesso}
        />
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-gray-600 mb-1">{children}</p>
}
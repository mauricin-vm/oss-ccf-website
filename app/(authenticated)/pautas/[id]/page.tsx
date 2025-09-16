'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { notFound } from 'next/navigation'
import EditPautaModal from '@/components/modals/edit-pauta-modal'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Edit,
  Calendar,
  FileText,
  User,
  Gavel,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
  Plus,
  Check
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser, PautaWithRelations, ProcessoWithRelations } from '@/types'
import { User as PrismaUser } from '@prisma/client'
import PautaActions from '@/components/pauta/pauta-actions'
import { formatLocalDate } from '@/lib/utils/date'

export default function PautaDetalhesPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { data: session } = useSession()
  const [pauta, setPauta] = useState<PautaWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState<string>('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddProcessModalOpen, setIsAddProcessModalOpen] = useState(false)
  const [availableProcesses, setAvailableProcesses] = useState<ProcessoWithRelations[]>([])
  const [searchProcess, setSearchProcess] = useState('')
  const [selectedProcess, setSelectedProcess] = useState<ProcessoWithRelations | null>(null)
  const [conselheiro, setConselheiro] = useState('')
  const [conselheiros, setConselheiros] = useState<PrismaUser[]>([])
  const [distribuicaoInfo, setDistribuicaoInfo] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    params.then(p => setId(p.id))
  }, [params])

  useEffect(() => {
    if (!id) return

    const fetchPauta = async () => {
      try {
        const response = await fetch(`/api/pautas/${id}`)
        if (!response.ok) {
          if (response.status === 404) {
            notFound()
          }
          throw new Error('Erro ao carregar pauta')
        }
        const data = await response.json()
        setPauta(data)
      } catch (error) {
        console.error('Erro ao carregar pauta:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPauta()
  }, [id])


  const handleEditSuccess = () => {
    // Recarregar dados da pauta após edição
    const fetchPauta = async () => {
      try {
        const response = await fetch(`/api/pautas/${id}`)
        if (response.ok) {
          const data = await response.json()
          setPauta(data)
        }
      } catch (error) {
        console.error('Erro ao recarregar pauta:', error)
      }
    }
    fetchPauta()
  }

  const handleRemoveProcesso = async (processoId: string, numeroProcesso: string) => {
    if (!confirm(`Tem certeza que deseja remover o processo ${numeroProcesso} desta pauta?`)) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/pautas/${id}/processos/${processoId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao remover processo da pauta')
      }

      // Recarregar dados da pauta
      handleEditSuccess()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const searchAvailableProcesses = async (searchTerm: string) => {
    if (searchTerm.length < 3) {
      setAvailableProcesses([])
      return
    }

    try {
      // Buscar processos com informações de pautas anteriores (igual à criação de pauta)
      const response = await fetch(`/api/processos?search=${encodeURIComponent(searchTerm)}&limit=10&includePautas=true`)
      if (response.ok) {
        const data = await response.json()
        // Filtrar processos que já não estão na pauta
        const processosNaPauta = pauta?.processos.map((p) => p.processo.id) || []
        const processosDisponiveis = data.processos.filter((p: ProcessoWithRelations) => !processosNaPauta.includes(p.id))
        setAvailableProcesses(processosDisponiveis)
      }
    } catch (error) {
      console.error('Erro ao buscar processos:', error)
    }
  }

  const fetchDistribuicaoInfo = async (processoId: string, status: string) => {
    try {
      const response = await fetch(`/api/processos/${processoId}/distribuicao?status=${encodeURIComponent(status)}`)
      if (response.ok) {
        const data = await response.json()
        setDistribuicaoInfo(data)

        // Definir sugestão automaticamente se existir
        if (data.sugestao) {
          setConselheiro(data.sugestao)
        }
      }
    } catch (error) {
      console.error('Erro ao buscar informações de distribuição:', error)
      setDistribuicaoInfo(null)
    }
  }

  const handleSelectProcess = async (processo: ProcessoWithRelations) => {
    setSelectedProcess(processo)
    setDistribuicaoInfo(null)

    // Preencher automaticamente com conselheiro correto para distribuição
    const conselheiroParaDistribuicao = getConselheiroParaDistribuicao(processo)
    setConselheiro(conselheiroParaDistribuicao)

    // Ainda buscar informações de distribuição para contexto
    await fetchDistribuicaoInfo(processo.id, processo.status)
  }

  // Funções iguais às da criação de pauta
  const getUltimaPautaInfo = (processo: Record<string, unknown>) => {
    const pautas = processo.pautas as Record<string, unknown>[] | undefined
    if (!pautas || pautas.length === 0) return null
    return pautas[0] // Já vem ordenado por data desc na API
  }

  const getConselheiroParaDistribuicao = (processo: Record<string, unknown>) => {
    const ultimaPauta = getUltimaPautaInfo(processo)
    if (!ultimaPauta) return ''

    // Regra: Se houver revisores, pegar o último; senão pegar o relator
    const revisores = ultimaPauta.revisores as string[] | undefined
    if (revisores && revisores.length > 0) {
      return revisores[revisores.length - 1]
    }

    // Se não houver revisor, pegar o relator
    return (ultimaPauta.relator as string) || ''
  }

  const handleAddProcesso = async () => {
    if (!selectedProcess || !conselheiro.trim()) {
      alert('Selecione um processo e informe o conselheiro')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/pautas/${id}/processos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          processoId: selectedProcess.id,
          relator: conselheiro.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao adicionar processo à pauta')
      }

      // Limpar estados e fechar modal
      setSelectedProcess(null)
      setConselheiro('')
      setSearchProcess('')
      setAvailableProcesses([])
      setDistribuicaoInfo(null)
      setIsAddProcessModalOpen(false)

      // Recarregar dados da pauta
      handleEditSuccess()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>
  }

  if (!pauta) {
    return notFound()
  }

  const statusMap = {
    aberta: { label: 'Aberta', color: 'bg-blue-100 text-blue-800', icon: Calendar },
    em_julgamento: { label: 'Em Julgamento', color: 'bg-yellow-100 text-yellow-800', icon: Gavel },
    fechada: { label: 'Fechada', color: 'bg-green-100 text-green-800', icon: CheckCircle }
  }

  const tipoProcessoMap = {
    COMPENSACAO: 'Compensação',
    DACAO_PAGAMENTO: 'Dação em Pagamento',
    TRANSACAO_EXCEPCIONAL: 'Transação Excepcional'
  }

  const statusProcessoMap = {
    RECEPCIONADO: { label: 'Recepcionado', color: 'bg-gray-100 text-gray-800' },
    EM_ANALISE: { label: 'Em Análise', color: 'bg-blue-100 text-blue-800' },
    EM_PAUTA: { label: 'Em Pauta', color: 'bg-purple-100 text-purple-800' },
    SUSPENSO: { label: 'Suspenso', color: 'bg-yellow-100 text-yellow-800' },
    PEDIDO_VISTA: { label: 'Pedido de vista', color: 'bg-blue-100 text-blue-800' },
    PEDIDO_DILIGENCIA: { label: 'Pedido de diligência', color: 'bg-orange-100 text-orange-800' },
    JULGADO: { label: 'Julgado', color: 'bg-indigo-100 text-indigo-800' },
    ACORDO_FIRMADO: { label: 'Acordo Firmado', color: 'bg-green-100 text-green-800' },
    EM_CUMPRIMENTO: { label: 'Em Cumprimento', color: 'bg-orange-100 text-orange-800' },
    ARQUIVADO: { label: 'Arquivado', color: 'bg-gray-100 text-gray-800' }
  }


  const getResultadoBadge = (decisao: Record<string, unknown>) => {
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

  const getCardBackground = (decisao: Record<string, unknown>) => {
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

  const user = session?.user as SessionUser

  const loadConselheiros = async () => {
    try {
      const response = await fetch('/api/conselheiros?apenasAtivos=true')
      if (response.ok) {
        const data = await response.json()
        // Filtrar apenas conselheiros ativos
        setConselheiros(data.conselheiros || [])
      }
    } catch (error) {
      console.error('Erro ao carregar conselheiros:', error)
    }
  }

  const loadAvailableProcesses = async () => {
    try {
      const response = await fetch(`/api/pautas/${id}/processos`)
      if (response.ok) {
        const data = await response.json()
        setAvailableProcesses(data)
      }
    } catch (error) {
      console.error('Erro ao carregar processos disponíveis:', error)
    }
  }

  const openAddProcessModal = () => {
    setIsAddProcessModalOpen(true)
    loadConselheiros()
    loadAvailableProcesses()
  }
  const canEdit = user?.role === 'ADMIN' || user?.role === 'FUNCIONARIO'
  const StatusIcon = statusMap[pauta.status as keyof typeof statusMap].icon

  const totalProcessos = pauta.processos.length
  const processosJulgados = (pauta.sessao as Record<string, unknown>)?.decisoes ? ((pauta.sessao as Record<string, unknown>).decisoes as Record<string, unknown>[]).length : 0
  const processosPendentes = totalProcessos - processosJulgados

  const getDataStatus = (dataPauta: Date) => {
    const hoje = new Date()
    const pautaDate = new Date(dataPauta)

    hoje.setHours(0, 0, 0, 0)
    pautaDate.setHours(0, 0, 0, 0)

    if (pautaDate.getTime() === hoje.getTime()) {
      return { label: 'Hoje', color: 'text-orange-600 font-medium' }
    } else if (pautaDate < hoje) {
      return { label: 'Passada', color: 'text-gray-500' }
    } else {
      const diffTime = pautaDate.getTime() - hoje.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return {
        label: `Em ${diffDays} dia${diffDays > 1 ? 's' : ''}`,
        color: diffDays <= 3 ? 'text-orange-600' : 'text-green-600'
      }
    }
  }

  const dataStatus = getDataStatus(pauta.dataPauta)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/pautas">
            <Button variant="outline" size="icon" className="cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{pauta.numero}</h1>
            <p className="text-gray-600">
              {formatLocalDate(pauta.dataPauta)} - {dataStatus.label}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {pauta.status === 'aberta' && canEdit && (
            <Link href={`/sessoes/nova?pauta=${pauta.id}`}>
              <Button className="cursor-pointer">
                <Gavel className="mr-2 h-4 w-4" />
                Iniciar Sessão
              </Button>
            </Link>
          )}

          {pauta.sessao && (
            <Link href={`/sessoes/${pauta.sessao.id}`}>
              <Button variant="secondary" className="cursor-pointer">
                <Users className="mr-2 h-4 w-4" />
                Ver Sessão
              </Button>
            </Link>
          )}

          <PautaActions
            pauta={{
              id: pauta.id,
              numero: pauta.numero,
              status: pauta.status,
              dataPauta: pauta.dataPauta.toISOString(),
              processos: pauta.processos as Record<string, unknown>[]
            }}
            userRole={user.role}
            onEdit={() => setIsEditModalOpen(true)}
          />
        </div>
      </div>

      {/* Status e Informações Principais */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <StatusIcon className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                <Badge className={statusMap[pauta.status as keyof typeof statusMap].color}>
                  {statusMap[pauta.status as keyof typeof statusMap].label}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Processos</p>
                <p className="text-2xl font-bold">{totalProcessos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Julgados</p>
                <p className="text-2xl font-bold">{processosJulgados}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold">{processosPendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com Detalhes */}
      <Tabs defaultValue="processos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="processos" className="cursor-pointer">Processos</TabsTrigger>
          <TabsTrigger value="sessao" className="cursor-pointer">Sessão</TabsTrigger>
          <TabsTrigger value="decisoes" className="cursor-pointer">Decisões</TabsTrigger>
          <TabsTrigger value="historico" className="cursor-pointer">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="processos">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="mb-[0.3rem]">Processos na Pauta</CardTitle>
                  <CardDescription>
                    Lista ordenada dos processos para julgamento
                  </CardDescription>
                </div>
                {canEdit && pauta.status === 'aberta' && (
                  <Button
                    onClick={openAddProcessModal}
                    className="cursor-pointer"
                    disabled={loading}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pauta.processos.map((processoPauta) => {
                  const processo = processoPauta.processo
                  const foiJulgado = (pauta.sessao as Record<string, unknown>)?.decisoes ? ((pauta.sessao as Record<string, unknown>).decisoes as Record<string, unknown>[]).some((d: Record<string, unknown>) => d.processoId === processo.id) : false

                  return (
                    <div key={processoPauta.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full font-bold text-sm">
                              {processoPauta.ordem}
                            </span>
                            <Link
                              href={`/processos/${processo.id}`}
                              className="font-semibold text-lg hover:text-blue-600 transition-colors"
                            >
                              {processo.numero}
                            </Link>
                            <Badge className={statusProcessoMap[processo.status as keyof typeof statusProcessoMap]?.color || 'bg-gray-100 text-gray-800'}>
                              {statusProcessoMap[processo.status as keyof typeof statusProcessoMap]?.label || processo.status}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>{processo.contribuinte.nome}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span>{tipoProcessoMap[processo.tipo as keyof typeof tipoProcessoMap]}</span>
                            </div>
                          </div>

                          {(processoPauta.distribuidoPara as string) && (
                            <div className="text-sm">
                              <strong>Distribuição:</strong> {processoPauta.distribuidoPara as string}
                            </div>
                          )}

                          {/* Última tramitação */}
                          {processo.tramitacoes && processo.tramitacoes.length > 0 && (
                            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                              <strong>Última tramitação:</strong> {processo.tramitacoes[0].setorOrigem} → {processo.tramitacoes[0].setorDestino}
                              {((processo.tramitacoes[0] as Record<string, unknown>).usuario as Record<string, unknown>) && (
                                <span> (por {((processo.tramitacoes[0] as Record<string, unknown>).usuario as Record<string, unknown>).name as string})</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Ações do Processo */}
                        {canEdit && pauta.status === 'aberta' && !foiJulgado && (
                          <div className="flex flex-col gap-2 ml-4">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveProcesso(processo.id, processo.numero)}
                              className="cursor-pointer"
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessao">
          <Card>
            <CardHeader>
              <CardTitle>Sessão de Julgamento</CardTitle>
              <CardDescription>
                Informações sobre a sessão desta pauta
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!pauta.sessao ? (
                <div className="text-center py-8">
                  <Gavel className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-gray-500">
                    Nenhuma sessão iniciada
                  </p>
                  {pauta.status === 'aberta' && canEdit && (
                    <p className="text-sm text-gray-400 mt-1">
                      Esta pauta ainda não teve sua sessão de julgamento iniciada
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Data de Início</h4>
                      <p>{new Date(pauta.sessao.dataInicio).toLocaleString('pt-BR')}</p>
                    </div>
                    {pauta.sessao.dataFim && (
                      <div>
                        <h4 className="font-medium mb-2">Data de Fim</h4>
                        <p>{new Date(pauta.sessao.dataFim).toLocaleString('pt-BR')}</p>
                      </div>
                    )}
                    {((pauta.sessao as Record<string, unknown>).presidente as Record<string, unknown>) ? (
                      <div>
                        <h4 className="font-medium mb-2">Presidente</h4>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span>{String(((pauta.sessao as Record<string, unknown>).presidente as Record<string, unknown>).nome)}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {((pauta.sessao as Record<string, unknown>).conselheiros as Record<string, unknown>[]) && ((pauta.sessao as Record<string, unknown>).conselheiros as Record<string, unknown>[]).length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Conselheiros Participantes</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {((pauta.sessao as Record<string, unknown>).conselheiros as Record<string, unknown>[]).map((conselheiro: Record<string, unknown>) => (
                          <div key={conselheiro.id as string} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <Users className="h-4 w-4 text-gray-500" />
                            <span>{conselheiro.nome as string}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pauta.sessao.ata && (
                    <div>
                      <h4 className="font-medium mb-2">Ata da Sessão</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="whitespace-pre-wrap">{pauta.sessao.ata}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decisoes">
          <Card>
            <CardHeader>
              <CardTitle>Decisões</CardTitle>
              <CardDescription>
                Decisões tomadas durante o julgamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!(pauta.sessao as Record<string, unknown>)?.decisoes || ((pauta.sessao as Record<string, unknown>).decisoes as Record<string, unknown>[]).length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-gray-500">
                    Nenhuma decisão registrada
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    As decisões aparecerão aqui conforme forem tomadas durante a sessão
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {((pauta.sessao as Record<string, unknown>).decisoes as Record<string, unknown>[])
                    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
                      const ordemA = pauta.processos.find(p => p.processo.id === a.processoId)?.ordem || 999
                      const ordemB = pauta.processos.find(p => p.processo.id === b.processoId)?.ordem || 999
                      return ordemA - ordemB
                    })
                    .map((decisao: Record<string, unknown>) => {
                      const processoPauta = pauta.processos.find(p => p.processo.id === decisao.processoId)
                      const cardBackground = getCardBackground(decisao)

                      return (
                        <div
                          key={decisao.id as string}
                          className={`border rounded-lg p-4 ${cardBackground}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${decisao.tipoResultado === 'JULGADO' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                {processoPauta?.ordem || '?'}
                              </span>
                              <div>
                                <Link
                                  href={`/processos/${(decisao.processo as Record<string, unknown>).id as string}`}
                                  className="font-medium hover:text-blue-600"
                                >
                                  {(decisao.processo as Record<string, unknown>).numero as string}
                                </Link>
                                <p className="text-sm text-gray-600">{((decisao.processo as Record<string, unknown>).contribuinte as Record<string, unknown>).nome as string}</p>
                                {processoPauta?.relator && (
                                  <p className="text-sm text-blue-600">Relator: {processoPauta.relator}</p>
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

                              {(decisao.votos as Record<string, unknown>[]) && (decisao.votos as Record<string, unknown>[]).length > 0 && (
                                <div className="mt-3 pt-2 border-t">
                                  <h6 className="text-xs font-medium text-gray-600 mb-3">Votos registrados:</h6>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Relatores/Revisores */}
                                    {(decisao.votos as Record<string, unknown>[]).filter((voto: Record<string, unknown>) => ['RELATOR', 'REVISOR'].includes(voto.tipoVoto as string)).length > 0 && (
                                      <Card className="p-3">
                                        <div className="font-medium text-gray-800 mb-2 text-sm">Relatores/Revisores</div>
                                        <div className="space-y-1">
                                          {(decisao.votos as Record<string, unknown>[])
                                            .filter((voto: Record<string, unknown>) => ['RELATOR', 'REVISOR'].includes(voto.tipoVoto as string))
                                            .map((voto: Record<string, unknown>, index: number) => (
                                              <div key={index} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                  <Badge variant={voto.tipoVoto === 'RELATOR' ? 'default' : 'secondary'} className="text-xs">
                                                    {voto.tipoVoto === 'RELATOR' ? 'Relator' : 'Revisor'}
                                                  </Badge>
                                                  <span className="truncate font-medium">{voto.nomeVotante as string}</span>
                                                </div>
                                                <span className={`font-medium text-xs ${voto.posicaoVoto === 'DEFERIDO' ? 'text-green-600' :
                                                  voto.posicaoVoto === 'INDEFERIDO' ? 'text-red-600' :
                                                    voto.posicaoVoto === 'PARCIAL' ? 'text-yellow-600' :
                                                      'text-blue-600'
                                                  }`}>
                                                  {voto.acompanhaVoto
                                                    ? `Acomp. ${String(voto.acompanhaVoto).split(' ')[0]}`
                                                    : String(voto.posicaoVoto)}
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
                                          const conselheirosComEssePosicao = (decisao.votos as Record<string, unknown>[])
                                            .filter((voto: Record<string, unknown>) => voto.tipoVoto === 'CONSELHEIRO' && voto.posicaoVoto === posicao)
                                            .map((voto: Record<string, unknown>) => voto.nomeVotante as string)

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
                                        {(decisao.votos as Record<string, unknown>[]).filter((voto: Record<string, unknown>) => voto.tipoVoto === 'CONSELHEIRO' && ['ABSTENCAO', 'AUSENTE', 'IMPEDIDO'].includes(String(voto.posicaoVoto))).length > 0 && (
                                          <div className="border-t pt-1 mt-1">
                                            {['AUSENTE', 'IMPEDIDO', 'ABSTENCAO'].map(posicao => {
                                              const conselheirosComEssePosicao = (decisao.votos as Record<string, unknown>[])
                                                .filter((voto: Record<string, unknown>) => voto.tipoVoto === 'CONSELHEIRO' && voto.posicaoVoto === posicao)
                                                .map((voto: Record<string, unknown>) => String(voto.nomeVotante))

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
                              {(pauta.sessao as Record<string, unknown>)?.presidenteId && (decisao.votos as Record<string, unknown>[]).find((voto: Record<string, unknown>) =>
                                voto.conselheiroId === (pauta.sessao as Record<string, unknown>).presidenteId ||
                                voto.nomeVotante === 'Presidente'
                              ) ? (
                                  <Card className="p-3 mt-4 border-yellow-300 bg-yellow-50">
                                    <div className="font-medium text-gray-800 mb-2 text-sm flex items-center gap-2">
                                      ⚖️ Voto de Desempate - Presidente
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-700">
                                          Presidente
                                        </Badge>
                                        <span className="truncate font-medium">Presidente</span>
                                      </div>
                                      <span className={`font-medium text-xs ${(decisao.votos as Record<string, unknown>[]).find((voto: Record<string, unknown>) =>
                                        voto.conselheiroId === (pauta.sessao as Record<string, unknown>).presidenteId ||
                                        voto.nomeVotante === 'Presidente'
                                      )?.posicaoVoto === 'DEFERIDO' ? 'text-green-600' :
                                        (decisao.votos as Record<string, unknown>[]).find((voto: Record<string, unknown>) =>
                                          voto.conselheiroId === (pauta.sessao as Record<string, unknown>).presidenteId ||
                                          voto.nomeVotante === 'Presidente'
                                        )?.posicaoVoto === 'INDEFERIDO' ? 'text-red-600' :
                                          'text-yellow-600'
                                        }`}>
                                        {String((decisao.votos as Record<string, unknown>[]).find((voto: Record<string, unknown>) =>
                                          voto.conselheiroId === (pauta.sessao as Record<string, unknown>)?.presidenteId ||
                                          voto.nomeVotante === (pauta.sessao as Record<string, unknown>)?.presidenteId
                                        )?.posicaoVoto || 'N/A')}
                                      </span>
                                    </div>
                                  </Card>
                                ) : null}

                              <p className="text-xs text-gray-500 mt-2">
                                Registrada em {new Date(String(decisao.dataDecisao)).toLocaleString('pt-BR')}
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

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Histórico da Pauta</CardTitle>
              <CardDescription>
                Timeline completa de eventos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pauta.historicos && pauta.historicos.length > 0 ? (
                  pauta.historicos.map((historico: Record<string, unknown>, index: number) => {
                    const isLast = index === (pauta.historicos?.length || 0) - 1

                    // Definir ícone e cor baseado no tipo
                    const tipoConfig = {
                      'CRIACAO': { icon: CheckCircle, color: 'green' },
                      'PROCESSO_ADICIONADO': { icon: Plus, color: 'blue' },
                      'PROCESSO_REMOVIDO': { icon: Trash2, color: 'red' },
                      'ALTERACAO': { icon: Edit, color: 'yellow' },
                      'EXCLUSAO': { icon: AlertCircle, color: 'red' },
                      'EVENTO': { icon: FileText, color: 'gray' }
                    }

                    const config = tipoConfig[String(historico.tipo) as keyof typeof tipoConfig] || tipoConfig.EVENTO
                    const IconComponent = config.icon

                    return (
                      <div key={String(historico.id)} className={`flex gap-4 ${!isLast ? 'pb-4 border-b' : ''}`}>
                        <div className={`flex-shrink-0 w-8 h-8 bg-${config.color}-100 rounded-full flex items-center justify-center`}>
                          <IconComponent className={`h-4 w-4 text-${config.color}-600`} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{String(historico.titulo)}</h4>
                          <p className="text-sm text-gray-600">{String(historico.descricao)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-gray-500">
                              {new Date(String(historico.createdAt)).toLocaleString('pt-BR')}
                            </p>
                            <span className="text-xs text-gray-400">•</span>
                            <p className="text-xs text-gray-500">
                              por {String((historico.usuario as Record<string, unknown>)?.name || 'Usuário')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum histórico encontrado</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Edição */}
      {pauta && (
        <EditPautaModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={handleEditSuccess}
          pauta={{
            id: pauta.id,
            numero: pauta.numero,
            dataPauta: pauta.dataPauta.toISOString().split('T')[0],
            observacoes: pauta.observacoes || undefined
          }}
        />
      )}

      {/* Modal para Adicionar Processo */}
      <Dialog open={isAddProcessModalOpen} onOpenChange={setIsAddProcessModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Adicionar Processo à Pauta</DialogTitle>
            <DialogDescription>
              Busque e selecione um processo para incluir na pauta
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Buscar Processo</Label>
              <Input
                placeholder="Buscar por número ou contribuinte..."
                value={searchProcess}
                onChange={(e) => {
                  setSearchProcess(e.target.value)
                  searchAvailableProcesses(e.target.value)
                }}
              />
            </div>

            {availableProcesses.length > 0 && (
              <div className="space-y-2">
                <Label>Processos Disponíveis</Label>
                <p className="text-sm text-gray-600">Clique em um processo para selecioná-lo (apenas um por vez)</p>
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {availableProcesses.map((processo) => (
                    <div
                      key={processo.id}
                      onClick={() => handleSelectProcess(processo)}
                      className={`p-3 cursor-pointer border-b last:border-b-0 hover:bg-gray-50 ${selectedProcess?.id === processo.id ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{processo.numero}</p>
                            <Badge className={statusProcessoMap[processo.status as keyof typeof statusProcessoMap]?.color || 'bg-gray-100 text-gray-800'}>
                              {statusProcessoMap[processo.status as keyof typeof statusProcessoMap]?.label || processo.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{processo.contribuinte.nome}</p>
                          <p className="text-xs text-gray-500 mb-1">
                            {tipoProcessoMap[processo.tipo as keyof typeof tipoProcessoMap]} -
                            {new Date(processo.dataAbertura).toLocaleDateString('pt-BR')}
                          </p>

                          {/* Informações da última pauta - EXATAMENTE igual ao pauta-form */}
                          {(() => {
                            const ultimaPauta = getUltimaPautaInfo(processo)
                            if (ultimaPauta) {
                              return (
                                <div className="text-xs text-blue-600 bg-blue-50 p-1 rounded mt-1">
                                  <p className="font-medium">Já pautado em: {new Date(String(((ultimaPauta as Record<string, unknown>).pauta as Record<string, unknown>)?.dataPauta || '')).toLocaleDateString('pt-BR')}</p>
                                  {(ultimaPauta as Record<string, unknown>).relator ? (
                                    <p>Relator: {String((ultimaPauta as Record<string, unknown>).relator)}</p>
                                  ) : null}
                                  {(ultimaPauta as Record<string, unknown>).revisores && Array.isArray((ultimaPauta as Record<string, unknown>).revisores) && ((ultimaPauta as Record<string, unknown>).revisores as unknown[]).length > 0 ? (
                                    <p>Revisor{((ultimaPauta as Record<string, unknown>).revisores as unknown[]).length > 1 ? 'es' : ''}: {((ultimaPauta as Record<string, unknown>).revisores as string[]).join(', ')}</p>
                                  ) : null}
                                </div>
                              )
                            }
                            return null
                          })()}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {selectedProcess?.id === processo.id && (
                            <Check className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedProcess && (
              <div className="space-y-2">
                <Label>Processo Selecionado</Label>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{selectedProcess.numero}</p>
                    <Badge className={statusProcessoMap[selectedProcess.status as keyof typeof statusProcessoMap]?.color || 'bg-gray-100 text-gray-800'}>
                      {statusProcessoMap[selectedProcess.status as keyof typeof statusProcessoMap]?.label || selectedProcess.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{selectedProcess.contribuinte.nome}</p>
                  <p className="text-xs text-gray-500">
                    {tipoProcessoMap[selectedProcess.tipo as keyof typeof tipoProcessoMap]} -
                    {new Date(selectedProcess.dataAbertura).toLocaleDateString('pt-BR')}
                  </p>

                  {/* Informações da última pauta - igual ao pauta-form */}
                  {(() => {
                    const ultimaPauta = getUltimaPautaInfo(selectedProcess)
                    if (ultimaPauta) {
                      return (
                        <div className="text-xs text-blue-600 bg-blue-50 p-1 rounded mt-1">
                          <p className="font-medium">Já pautado em: {new Date(String(((ultimaPauta as Record<string, unknown>).pauta as Record<string, unknown>)?.dataPauta || '')).toLocaleDateString('pt-BR')}</p>
                          {(ultimaPauta as Record<string, unknown>).relator ? (
                            <p>Relator: {String((ultimaPauta as Record<string, unknown>).relator)}</p>
                          ) : null}
                          {(ultimaPauta as Record<string, unknown>).revisores && Array.isArray((ultimaPauta as Record<string, unknown>).revisores) && ((ultimaPauta as Record<string, unknown>).revisores as unknown[]).length > 0 ? (
                            <p>Revisor{((ultimaPauta as Record<string, unknown>).revisores as unknown[]).length > 1 ? 'es' : ''}: {((ultimaPauta as Record<string, unknown>).revisores as string[]).join(', ')}</p>
                          ) : null}
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Conselheiro Relator</Label>
              <Select value={conselheiro} onValueChange={setConselheiro} disabled={!selectedProcess}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um conselheiro..." />
                </SelectTrigger>
                <SelectContent>
                  {conselheiros.map((c) => (
                    <SelectItem key={c.id} value={String((c as Record<string, unknown>).nome || c.name)}>
                      {String((c as Record<string, unknown>).nome || c.name)} {(c as Record<string, unknown>).cargo ? `- ${(c as Record<string, unknown>).cargo}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddProcessModalOpen(false)
                setSelectedProcess(null)
                setConselheiro('')
                setSearchProcess('')
                setAvailableProcesses([])
                setDistribuicaoInfo(null)
              }}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddProcesso}
              disabled={!selectedProcess || !conselheiro.trim() || loading}
              className="cursor-pointer"
            >
              {loading ? 'Adicionando...' : 'Adicionar à Pauta'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
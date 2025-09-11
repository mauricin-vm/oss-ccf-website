'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
  DollarSign,
  Trash2,
  Plus,
  Search,
  Check
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'

export default function PautaDetalhesPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { data: session } = useSession()
  const router = useRouter()
  const [pauta, setPauta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [id, setId] = useState<string>('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddProcessModalOpen, setIsAddProcessModalOpen] = useState(false)
  const [availableProcesses, setAvailableProcesses] = useState<any[]>([])
  const [searchProcess, setSearchProcess] = useState('')
  const [selectedProcess, setSelectedProcess] = useState<any>(null)
  const [conselheiro, setConselheiro] = useState('')
  const [conselheiros, setConselheiros] = useState<any[]>([])

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

  const handleDeletePauta = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/pautas/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao excluir pauta')
      }

      router.push('/pautas')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erro inesperado')
      setLoading(false)
    }
  }

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
      const response = await fetch(`/api/processos?search=${encodeURIComponent(searchTerm)}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        // Filtrar processos que já não estão na pauta
        const processosNaPauta = pauta.processos.map((p: any) => p.processo.id)
        const processosDisponiveis = data.processos.filter((p: any) => !processosNaPauta.includes(p.id))
        setAvailableProcesses(processosDisponiveis)
      }
    } catch (error) {
      console.error('Erro ao buscar processos:', error)
    }
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
    EM_PAUTA: { label: 'Em Pauta', color: 'bg-purple-100 text-purple-800' },
    JULGADO: { label: 'Julgado', color: 'bg-indigo-100 text-indigo-800' }
  }

  const decisaoMap = {
    deferido: { label: 'Deferido', color: 'bg-green-100 text-green-800' },
    indeferido: { label: 'Indeferido', color: 'bg-red-100 text-red-800' },
    parcial: { label: 'Parcialmente Deferido', color: 'bg-yellow-100 text-yellow-800' }
  }

  const user = session?.user as SessionUser

  const loadConselheiros = async () => {
    try {
      const response = await fetch('/api/conselheiros')
      if (response.ok) {
        const data = await response.json()
        // Filtrar apenas conselheiros ativos
        setConselheiros(data.filter((c: any) => c.ativo))
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
  const processosJulgados = pauta.sessao?.decisoes?.length || 0
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
              {new Date(pauta.dataPauta).toLocaleDateString('pt-BR')} - {dataStatus.label}
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

          {canEdit && pauta.status === 'aberta' && (
            <>
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={() => setIsEditModalOpen(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button
                variant="destructive"
                className="cursor-pointer"
                onClick={() => {
                  if (confirm('Tem certeza que deseja excluir esta pauta? Esta ação não pode ser desfeita e os processos retornarão ao status anterior.')) {
                    handleDeletePauta()
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            </>
          )}
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Processos na Pauta</CardTitle>
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
                    Adicionar Processo
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pauta.processos.map((processoPauta) => {
                  const processo = processoPauta.processo
                  const foiJulgado = pauta.sessao?.decisoes?.some(d => d.processoId === processo.id)

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
                            {foiJulgado && (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Julgado
                              </Badge>
                            )}
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
                            <div className="flex items-center space-x-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span>{processo.valorOriginal.toLocaleString('pt-BR')}</span>
                            </div>
                          </div>

                          {processoPauta.relator && (
                            <div className="text-sm">
                              <strong>Distribuição:</strong> {processoPauta.relator}
                            </div>
                          )}

                          {/* Última tramitação */}
                          {processo.tramitacoes.length > 0 && (
                            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                              <strong>Última tramitação:</strong> {processo.tramitacoes[0].setorOrigem} → {processo.tramitacoes[0].setorDestino}
                              {processo.tramitacoes[0].usuario && (
                                <span> (por {processo.tramitacoes[0].usuario.name})</span>
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
                              <Trash2 className="mr-1 h-3 w-3" />
                              Remover
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
                  <Gavel className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhuma sessão iniciada
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Esta pauta ainda não teve sua sessão de julgamento iniciada.
                  </p>
                  {pauta.status === 'aberta' && canEdit && (
                    <Link href={`/sessoes/nova?pauta=${pauta.id}`}>
                      <Button className="cursor-pointer">
                        <Gavel className="mr-2 h-4 w-4" />
                        Iniciar Sessão
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>

                  {pauta.sessao.conselheiros.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Conselheiros Participantes</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {pauta.sessao.conselheiros.map((conselheiro) => (
                          <div key={conselheiro.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <Users className="h-4 w-4 text-gray-500" />
                            <span>{conselheiro.name}</span>
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
              {!pauta.sessao?.decisoes || pauta.sessao.decisoes.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhuma decisão registrada
                  </h3>
                  <p className="text-gray-600">
                    As decisões aparecerão aqui conforme forem tomadas durante a sessão.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pauta.sessao.decisoes.map((decisao) => (
                    <div key={decisao.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <Link
                            href={`/processos/${decisao.processo.id}`}
                            className="font-semibold hover:text-blue-600"
                          >
                            {decisao.processo.numero}
                          </Link>
                          <p className="text-sm text-gray-600">{decisao.processo.contribuinte.nome}</p>
                        </div>
                        <Badge className={decisaoMap[decisao.tipo as keyof typeof decisaoMap].color}>
                          {decisaoMap[decisao.tipo as keyof typeof decisaoMap].label}
                        </Badge>
                      </div>

                      <div className="bg-gray-50 p-3 rounded">
                        <h5 className="font-medium mb-2">Fundamentação:</h5>
                        <p className="text-sm whitespace-pre-wrap">{decisao.fundamentacao}</p>
                      </div>

                      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                        <span>Decidido em {new Date(decisao.dataDecisao).toLocaleString('pt-BR')}</span>
                        {decisao.numeroAcordao && (
                          <span>Acórdão: {decisao.numeroAcordao}</span>
                        )}
                      </div>
                    </div>
                  ))}
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
                  pauta.historicos.map((historico: any, index: number) => {
                    const isLast = index === pauta.historicos.length - 1

                    // Definir ícone e cor baseado no tipo
                    const tipoConfig = {
                      'CRIACAO': { icon: CheckCircle, color: 'green' },
                      'PROCESSO_ADICIONADO': { icon: Plus, color: 'blue' },
                      'PROCESSO_REMOVIDO': { icon: Trash2, color: 'red' },
                      'ALTERACAO': { icon: Edit, color: 'yellow' },
                      'EXCLUSAO': { icon: AlertCircle, color: 'red' },
                      'EVENTO': { icon: FileText, color: 'gray' }
                    }

                    const config = tipoConfig[historico.tipo as keyof typeof tipoConfig] || tipoConfig.EVENTO
                    const IconComponent = config.icon

                    return (
                      <div key={historico.id} className={`flex gap-4 ${!isLast ? 'pb-4 border-b' : ''}`}>
                        <div className={`flex-shrink-0 w-8 h-8 bg-${config.color}-100 rounded-full flex items-center justify-center`}>
                          <IconComponent className={`h-4 w-4 text-${config.color}-600`} />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{historico.titulo}</h4>
                          <p className="text-sm text-gray-600">{historico.descricao}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-gray-500">
                              {new Date(historico.createdAt).toLocaleString('pt-BR')}
                            </p>
                            <span className="text-xs text-gray-400">•</span>
                            <p className="text-xs text-gray-500">
                              por {historico.usuario.name}
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
            dataPauta: pauta.dataPauta,
            observacoes: pauta.observacoes
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
                      onClick={() => setSelectedProcess(processo)}
                      className={`p-3 cursor-pointer border-b last:border-b-0 hover:bg-gray-50 ${selectedProcess?.id === processo.id ? 'bg-blue-50 border-blue-200' : ''
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{processo.numero}</p>
                          <p className="text-sm text-gray-600">{processo.contribuinte.nome}</p>
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            R$ <span>{processo.valorOriginal.toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedProcess?.id === processo.id && (
                            <Check className="h-4 w-4 text-blue-600" />
                          )}
                          <Badge className="bg-gray-100 text-gray-800">
                            {processo.status}
                          </Badge>
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
                  <p className="font-medium">{selectedProcess.numero}</p>
                  <p className="text-sm text-gray-600">{selectedProcess.contribuinte.nome}</p>
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
                    <SelectItem key={c.id} value={c.nome}>
                      {c.nome} {c.cargo && `- ${c.cargo}`}
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
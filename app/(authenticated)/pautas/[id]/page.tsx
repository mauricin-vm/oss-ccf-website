import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
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
  DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'

async function getPauta(id: string) {
  return prisma.pauta.findUnique({
    where: { id },
    include: {
      processos: {
        include: {
          processo: {
            include: {
              contribuinte: true,
              tramitacoes: {
                orderBy: { createdAt: 'desc' },
                take: 3,
                include: {
                  usuario: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { ordem: 'asc' }
      },
      sessao: {
        include: {
          decisoes: {
            include: {
              processo: {
                include: {
                  contribuinte: true
                }
              }
            },
            orderBy: { dataDecisao: 'desc' }
          },
          conselheiros: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      }
    }
  })
}

export default async function PautaDetalhesPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser
  const { id } = await params
  const pauta = await getPauta(id)

  if (!pauta) {
    notFound()
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

  const canEdit = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'
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
            <Button variant="outline" size="icon">
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
              <Button>
                <Gavel className="mr-2 h-4 w-4" />
                Iniciar Sessão
              </Button>
            </Link>
          )}
          
          {pauta.sessao && (
            <Link href={`/sessoes/${pauta.sessao.id}`}>
              <Button variant="secondary">
                <Users className="mr-2 h-4 w-4" />
                Ver Sessão
              </Button>
            </Link>
          )}
          
          {canEdit && pauta.status === 'aberta' && (
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
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
          <TabsTrigger value="processos">Processos</TabsTrigger>
          <TabsTrigger value="sessao">Sessão</TabsTrigger>
          <TabsTrigger value="decisoes">Decisões</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="processos">
          <Card>
            <CardHeader>
              <CardTitle>Processos na Pauta</CardTitle>
              <CardDescription>
                Lista ordenada dos processos para julgamento
              </CardDescription>
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
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              <span>R$ {processo.valorOriginal.toLocaleString('pt-BR')}</span>
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
                      <Button>
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
                <div className="flex gap-4 pb-4 border-b">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">Pauta Criada</h4>
                    <p className="text-sm text-gray-600">
                      Pauta {pauta.numero} criada com {totalProcessos} processo{totalProcessos !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(pauta.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>

                {pauta.sessao && (
                  <div className="flex gap-4 pb-4 border-b">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Gavel className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Sessão Iniciada</h4>
                      <p className="text-sm text-gray-600">
                        Sessão de julgamento iniciada
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(pauta.sessao.dataInicio).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                )}

                {pauta.observacoes && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Observações</h4>
                    <p className="text-sm text-blue-700">{pauta.observacoes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
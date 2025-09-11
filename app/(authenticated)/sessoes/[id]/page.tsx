import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Gavel, 
  Calendar, 
  Users, 
  FileText, 
  Clock,
  CheckCircle,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'
import SessaoActions from '@/components/sessao/sessao-actions'
import EditarAtaForm from '@/components/forms/editar-ata-form'

interface SessaoPageProps {
  params: Promise<{ id: string }>
}

async function getSessao(id: string) {
  return prisma.sessaoJulgamento.findUnique({
    where: { id },
    include: {
      pauta: {
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
                          name: true,
                          email: true
                        }
                      }
                    }
                  }
                }
              }
            },
            orderBy: { ordem: 'asc' }
          }
        }
      },
      decisoes: {
        include: {
          processo: {
            include: {
              contribuinte: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
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
  })
}

export default async function SessaoPage({ params }: SessaoPageProps) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser
  const { id } = await params
  const sessao = await getSessao(id)

  if (!sessao) {
    notFound()
  }

  const canEdit = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'
  const isActive = !sessao.dataFim

  const getStatusSessao = () => {
    if (sessao.dataFim) {
      return { 
        label: 'Finalizada', 
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle
      }
    } else {
      return { 
        label: 'Em Andamento', 
        color: 'bg-yellow-100 text-yellow-800',
        icon: Clock
      }
    }
  }

  const getDuracaoSessao = () => {
    const inicio = new Date(sessao.dataInicio)
    const fim = sessao.dataFim ? new Date(sessao.dataFim) : new Date()
    
    const diffMs = fim.getTime() - inicio.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`
    } else {
      return `${diffMinutes}m`
    }
  }

  const getProgressoJulgamento = () => {
    const totalProcessos = sessao.pauta.processos.length
    const processosJulgados = sessao.decisoes.length
    const percentual = totalProcessos > 0 ? Math.round((processosJulgados / totalProcessos) * 100) : 0
    
    return {
      total: totalProcessos,
      julgados: processosJulgados,
      pendentes: totalProcessos - processosJulgados,
      percentual
    }
  }

  const status = getStatusSessao()
  const StatusIcon = status.icon
  const duracao = getDuracaoSessao()
  const progresso = getProgressoJulgamento()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sessoes">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Sessão de Julgamento</h1>
            <Badge className={status.color}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {status.label}
            </Badge>
          </div>
          <p className="text-gray-600">
            Pauta: {sessao.pauta.numero} - {new Date(sessao.pauta.dataPauta).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && isActive && progresso.pendentes > 0 && (
            <Link href={`/sessoes/${sessao.id}/decisoes/nova`}>
              <Button>
                <Gavel className="mr-2 h-4 w-4" />
                Julgar Processo
              </Button>
            </Link>
          )}
          {canEdit && isActive && (
            <SessaoActions sessao={sessao} />
          )}
        </div>
      </div>

      {/* Informações Gerais */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Informações da Sessão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Data de Início:</span>
                <p className="font-medium">{new Date(sessao.dataInicio).toLocaleString('pt-BR')}</p>
              </div>
              {sessao.dataFim && (
                <div>
                  <span className="text-gray-600">Data de Fim:</span>
                  <p className="font-medium">{new Date(sessao.dataFim).toLocaleString('pt-BR')}</p>
                </div>
              )}
              <div>
                <span className="text-gray-600">Duração:</span>
                <p className="font-medium">{duracao}</p>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <p className="font-medium">{status.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Conselheiros Participantes
            </CardTitle>
            <CardDescription>
              {sessao.conselheiros.length} conselheiro{sessao.conselheiros.length !== 1 ? 's' : ''} participando
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessao.conselheiros.map((conselheiro) => (
                <div key={conselheiro.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{conselheiro.name}</p>
                    <p className="text-sm text-gray-600">{conselheiro.email}</p>
                  </div>
                  <Badge variant="outline">
                    {conselheiro.role === 'ADMIN' ? 'Administrador' : 'Funcionário'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progresso do Julgamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Progresso do Julgamento
          </CardTitle>
          <CardDescription>
            {progresso.julgados} de {progresso.total} processos julgados ({progresso.percentual}%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progresso.percentual}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{progresso.total}</p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{progresso.julgados}</p>
                <p className="text-sm text-gray-600">Julgados</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{progresso.pendentes}</p>
                <p className="text-sm text-gray-600">Pendentes</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processos da Pauta */}
      <Card>
        <CardHeader>
          <CardTitle>Processos para Julgamento</CardTitle>
          <CardDescription>
            Lista de processos incluídos nesta sessão ordenados por ordem de julgamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sessao.pauta.processos.map((processoPauta) => {
              const decisao = sessao.decisoes.find(d => d.processoId === processoPauta.processo.id)
              const isJulgado = !!decisao
              
              return (
                <div 
                  key={processoPauta.processo.id} 
                  className={`border rounded-lg p-4 ${isJulgado ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        isJulgado ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {processoPauta.ordem}
                      </span>
                      <div>
                        <Link 
                          href={`/processos/${processoPauta.processo.id}`}
                          className="font-medium hover:text-blue-600"
                        >
                          {processoPauta.processo.numero}
                        </Link>
                        <p className="text-sm text-gray-600">{processoPauta.processo.contribuinte.nome}</p>
                        {processoPauta.relator && (
                          <p className="text-sm text-blue-600">Relator: {processoPauta.relator}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {isJulgado ? (
                        <Badge 
                          className={
                            decisao?.tipo === 'deferido' ? 'bg-green-100 text-green-800' :
                            decisao?.tipo === 'indeferido' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {decisao?.tipo === 'deferido' ? 'Deferido' :
                           decisao?.tipo === 'indeferido' ? 'Indeferido' :
                           'Parcial'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Aguardando</Badge>
                      )}
                      {canEdit && !isJulgado && isActive && (
                        <Link href={`/sessoes/${sessao.id}/decisoes/nova?processo=${processoPauta.processo.id}`}>
                          <Button size="sm" variant="outline" className="mt-2 cursor-pointer">
                            <Gavel className="mr-1 h-3 w-3" />
                            Julgar
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                  
                  {decisao && (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <h5 className="text-sm font-medium mb-1">Decisão:</h5>
                      <p className="text-sm text-gray-700">{decisao.descricao}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Registrada em {new Date(decisao.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Ata da Sessão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Ata da Sessão
          </CardTitle>
          <CardDescription>
            Registro das discussões e observações da sessão
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canEdit && isActive ? (
            <EditarAtaForm sessaoId={sessao.id} ataAtual={sessao.ata || ''} />
          ) : (
            <div className="bg-gray-50 p-4 rounded-lg">
              {sessao.ata ? (
                <p className="text-gray-700 whitespace-pre-wrap">{sessao.ata}</p>
              ) : (
                <p className="text-gray-500 italic">Nenhuma ata registrada ainda</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decisões Registradas */}
      {sessao.decisoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Decisões Registradas</CardTitle>
            <CardDescription>
              Histórico de decisões tomadas nesta sessão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sessao.decisoes.map((decisao) => (
                <div key={decisao.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Link 
                      href={`/processos/${decisao.processo.id}`}
                      className="font-medium hover:text-blue-600"
                    >
                      {decisao.processo.numero}
                    </Link>
                    <Badge 
                      className={
                        decisao.tipo === 'deferido' ? 'bg-green-100 text-green-800' :
                        decisao.tipo === 'indeferido' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }
                    >
                      {decisao.tipo === 'deferido' ? 'Deferido' :
                       decisao.tipo === 'indeferido' ? 'Indeferido' :
                       'Parcial'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{decisao.processo.contribuinte.nome}</p>
                  <p className="text-sm bg-gray-50 p-3 rounded">{decisao.descricao}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Registrada em {new Date(decisao.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
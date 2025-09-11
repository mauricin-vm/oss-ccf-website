import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Plus, 
  Search, 
  Gavel, 
  Users, 
  Clock,
  CheckCircle,
  Calendar,
  FileText,
  Filter
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'
import { SessaoJulgamento, Pauta, ProcessoPauta, Processo, Contribuinte, Decisao, User } from '@prisma/client'

type SessaoWithRelations = SessaoJulgamento & {
  pauta: Pauta & {
    processos: (ProcessoPauta & {
      processo: Processo & {
        contribuinte: Contribuinte
      }
    })[]
  }
  decisoes: (Decisao & {
    processo: Processo & {
      contribuinte: Contribuinte
    }
  })[]
  conselheiros: Pick<User, 'id' | 'name' | 'email' | 'role'>[]
}

async function getSessoes() {
  return prisma.sessaoJulgamento.findMany({
    include: {
      pauta: {
        include: {
          processos: {
            include: {
              processo: {
                include: {
                  contribuinte: true
                }
              }
            }
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
        }
      },
      conselheiros: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    },
    orderBy: {
      dataInicio: 'desc'
    }
  })
}

export default async function SessoesPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as SessionUser
  
  const sessoes = await getSessoes()

  const canCreate = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'

  // Estatísticas
  const totalSessoes = sessoes.length
  const sessoesAbertas = sessoes.filter(s => !s.dataFim).length
  const sessoesFechadas = sessoes.filter(s => s.dataFim).length
  const totalDecisoes = sessoes.reduce((total, s) => total + s.decisoes.length, 0)

  const getStatusSessao = (sessao: SessaoWithRelations) => {
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

  const getDuracaoSessao = (dataInicio: Date, dataFim?: Date) => {
    const inicio = new Date(dataInicio)
    const fim = dataFim ? new Date(dataFim) : new Date()
    
    const diffMs = fim.getTime() - inicio.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`
    } else {
      return `${diffMinutes}m`
    }
  }

  const getProgressoJulgamento = (sessao: SessaoWithRelations) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sessões de Julgamento</h1>
          <p className="text-gray-600">
            Gerencie as sessões de julgamento da CCF
          </p>
        </div>
        
        {canCreate && (
          <Link href="/sessoes/nova">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Sessão
            </Button>
          </Link>
        )}
      </div>

      {/* Filtros e Busca */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por pauta ou conselheiro..."
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sessões</p>
                <p className="text-2xl font-bold">{totalSessoes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Em Andamento</p>
                <p className="text-2xl font-bold">{sessoesAbertas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Finalizadas</p>
                <p className="text-2xl font-bold">{sessoesFechadas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Decisões</p>
                <p className="text-2xl font-bold">{totalDecisoes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Sessões */}
      <div className="space-y-4">
        {sessoes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Gavel className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma sessão encontrada
              </h3>
              <p className="text-gray-600 mb-4">
                Comece criando sua primeira sessão de julgamento.
              </p>
              {canCreate && (
                <Link href="/sessoes/nova">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Sessão
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          sessoes.map((sessao) => {
            const status = getStatusSessao(sessao)
            const StatusIcon = status.icon
            const progresso = getProgressoJulgamento(sessao)
            const duracao = getDuracaoSessao(sessao.dataInicio, sessao.dataFim)

            return (
              <Card key={sessao.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      {/* Cabeçalho da Sessão */}
                      <div className="flex items-center gap-3">
                        <Link 
                          href={`/pautas/${sessao.pauta.id}`}
                          className="font-semibold text-lg hover:text-blue-600 transition-colors"
                        >
                          {sessao.pauta.numero}
                        </Link>
                        <Badge className={status.color}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                        <Badge variant="outline">
                          {new Date(sessao.dataInicio).toLocaleDateString('pt-BR')}
                        </Badge>
                      </div>

                      {/* Progresso do Julgamento */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Progresso do Julgamento</span>
                          <span className="font-medium">{progresso.percentual}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progresso.percentual}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500">
                          {progresso.julgados} de {progresso.total} processos julgados
                        </div>
                      </div>

                      {/* Informações da Sessão */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Iniciada: {new Date(sessao.dataInicio).toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>Duração: {duracao}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>{sessao.conselheiros.length} conselheiro{sessao.conselheiros.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>{sessao.decisoes.length} decisão{sessao.decisoes.length !== 1 ? 'ões' : 'ão'}</span>
                        </div>
                      </div>

                      {/* Conselheiros */}
                      {sessao.conselheiros.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Conselheiros:</h4>
                          <div className="flex flex-wrap gap-2">
                            {sessao.conselheiros.slice(0, 3).map((conselheiro) => (
                              <Badge key={conselheiro.id} variant="outline" className="text-xs">
                                {conselheiro.name}
                              </Badge>
                            ))}
                            {sessao.conselheiros.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{sessao.conselheiros.length - 3} mais
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Últimas Decisões */}
                      {sessao.decisoes.length > 0 && (
                        <div className="border-t pt-3">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">
                            Últimas Decisões:
                          </h4>
                          <div className="space-y-1">
                            {sessao.decisoes.slice(0, 2).map((decisao) => (
                              <div key={decisao.id} className="text-sm flex items-center justify-between">
                                <Link 
                                  href={`/processos/${decisao.processo.id}`}
                                  className="text-blue-600 hover:text-blue-800"
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
                            ))}
                            {sessao.decisoes.length > 2 && (
                              <div className="text-xs text-gray-500">
                                ... e mais {sessao.decisoes.length - 2} decisão{sessao.decisoes.length - 2 !== 1 ? 'ões' : 'ão'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Ata da Sessão */}
                      {sessao.ata && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <h5 className="text-sm font-medium mb-1">Ata:</h5>
                          <p className="text-sm text-gray-700 line-clamp-2">{sessao.ata}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Ações */}
                    <div className="flex flex-col gap-2 ml-4">
                      <Link href={`/sessoes/${sessao.id}`}>
                        <Button variant="outline" size="sm" className="w-full cursor-pointer">
                          Ver Detalhes
                        </Button>
                      </Link>
                      
                      <Link href={`/pautas/${sessao.pauta.id}`}>
                        <Button variant="ghost" size="sm" className="w-full cursor-pointer">
                          Ver Pauta
                        </Button>
                      </Link>
                      
                      {!sessao.dataFim && canCreate && progresso.pendentes > 0 && (
                        <Link href={`/sessoes/${sessao.id}/decisoes/nova`}>
                          <Button size="sm" className="w-full cursor-pointer">
                            <Gavel className="mr-1 h-3 w-3" />
                            Julgar
                          </Button>
                        </Link>
                      )}
                      
                      {!sessao.dataFim && canCreate && progresso.pendentes === 0 && (
                        <Button size="sm" className="w-full cursor-pointer" variant="secondary">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Finalizar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Sessões em Andamento */}
      {sessoesAbertas > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Sessões em Andamento
            </CardTitle>
            <CardDescription>
              Sessões que precisam de atenção
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessoes
                .filter(s => !s.dataFim)
                .slice(0, 3)
                .map((sessao) => {
                  const progresso = getProgressoJulgamento(sessao)
                  const duracao = getDuracaoSessao(sessao.dataInicio)
                  
                  return (
                    <div key={sessao.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Link 
                          href={`/sessoes/${sessao.id}`}
                          className="font-medium hover:text-blue-600"
                        >
                          {sessao.pauta.numero}
                        </Link>
                        <p className="text-sm text-gray-600">
                          {progresso.julgados}/{progresso.total} processos • {duracao}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-yellow-100 text-yellow-800">
                          Em Andamento
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {progresso.percentual}% concluído
                        </p>
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
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
  Calendar, 
  FileText, 
  Gavel,
  Users,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'

async function getPautas() {
  return prisma.pauta.findMany({
    include: {
      processos: {
        include: {
          processo: {
            include: {
              contribuinte: true
            }
          }
        },
        orderBy: { ordem: 'asc' }
      },
      sessao: {
        include: {
          decisoes: true
        }
      }
    },
    orderBy: {
      dataPauta: 'desc'
    }
  })
}

export default async function PautasPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as SessionUser
  
  const pautas = await getPautas()

  const canCreate = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'

  // Estatísticas
  const totalPautas = pautas.length
  const pautasAbertas = pautas.filter(p => p.status === 'aberta').length
  const emJulgamento = pautas.filter(p => p.status === 'em_julgamento').length
  const fechadas = pautas.filter(p => p.status === 'fechada').length

  const getStatusPauta = (pauta: { status: string }) => {
    switch (pauta.status) {
      case 'aberta':
        return { 
          label: 'Aberta', 
          color: 'bg-blue-100 text-blue-800',
          icon: Calendar
        }
      case 'em_julgamento':
        return { 
          label: 'Em Julgamento', 
          color: 'bg-yellow-100 text-yellow-800',
          icon: Gavel
        }
      case 'fechada':
        return { 
          label: 'Fechada', 
          color: 'bg-green-100 text-green-800',
          icon: CheckCircle
        }
      default:
        return { 
          label: 'Indefinido', 
          color: 'bg-gray-100 text-gray-800',
          icon: AlertCircle
        }
    }
  }

  const getDataStatus = (dataPauta: Date) => {
    const hoje = new Date()
    const pauta = new Date(dataPauta)
    
    // Remover horas para comparar apenas datas
    hoje.setHours(0, 0, 0, 0)
    pauta.setHours(0, 0, 0, 0)
    
    if (pauta.getTime() === hoje.getTime()) {
      return { label: 'Hoje', color: 'text-orange-600 font-medium' }
    } else if (pauta < hoje) {
      return { label: 'Passada', color: 'text-gray-500' }
    } else {
      const diffTime = pauta.getTime() - hoje.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return { 
        label: `Em ${diffDays} dia${diffDays > 1 ? 's' : ''}`, 
        color: diffDays <= 3 ? 'text-orange-600' : 'text-green-600'
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pautas</h1>
          <p className="text-gray-600">
            Gerencie as pautas de julgamento da CCF
          </p>
        </div>
        
        {canCreate && (
          <Link href="/pautas/nova">
            <Button className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              Nova Pauta
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
                  placeholder="Buscar por número da pauta..."
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline" size="icon" className="cursor-pointer">
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
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold">{totalPautas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Abertas</p>
                <p className="text-2xl font-bold">{pautasAbertas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Em Julgamento</p>
                <p className="text-2xl font-bold">{emJulgamento}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Fechadas</p>
                <p className="text-2xl font-bold">{fechadas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Pautas */}
      <div className="space-y-4">
        {pautas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma pauta encontrada
              </h3>
              <p className="text-gray-600 mb-4">
                Comece criando sua primeira pauta de julgamento.
              </p>
              {canCreate && (
                <Link href="/pautas/nova">
                  <Button className="cursor-pointer">
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Pauta
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          pautas.map((pauta) => {
            const status = getStatusPauta(pauta)
            const dataStatus = getDataStatus(pauta.dataPauta)
            const StatusIcon = status.icon
            const totalProcessos = pauta.processos.length
            const processosJulgados = pauta.sessao?.decisoes?.length || 0

            return (
              <Card key={pauta.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      {/* Cabeçalho da Pauta */}
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{pauta.numero}</h3>
                        <Badge className={status.color}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                        <Badge variant="outline" className={dataStatus.color}>
                          {new Date(pauta.dataPauta).toLocaleDateString('pt-BR')} - {dataStatus.label}
                        </Badge>
                      </div>

                      {/* Informações da Pauta */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>{totalProcessos} processo{totalProcessos !== 1 ? 's' : ''}</span>
                        </div>
                        {pauta.sessao && (
                          <div className="flex items-center gap-2">
                            <Gavel className="h-4 w-4" />
                            <span>{processosJulgados} julgado{processosJulgados !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>Criada em {new Date(pauta.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>

                      {/* Observações */}
                      {pauta.observacoes && (
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                          {pauta.observacoes}
                        </p>
                      )}

                      {/* Lista de Processos */}
                      {pauta.processos.length > 0 && (
                        <div className="border-t pt-3">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">
                            Processos na Pauta:
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {pauta.processos.slice(0, 4).map((processoPauta) => (
                              <div key={processoPauta.id} className="text-sm">
                                <Link 
                                  href={`/processos/${processoPauta.processo.id}`}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  {processoPauta.processo.numero}
                                </Link>
                                <span className="text-gray-500 ml-1">
                                  - {processoPauta.processo.contribuinte.nome}
                                </span>
                                {processoPauta.relator && (
                                  <span className="text-xs text-gray-400 block">
                                    Distribuição: {processoPauta.relator}
                                  </span>
                                )}
                              </div>
                            ))}
                            {pauta.processos.length > 4 && (
                              <div className="text-sm text-gray-500">
                                ... e mais {pauta.processos.length - 4} processo{pauta.processos.length - 4 !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Ações */}
                    <div className="flex flex-col gap-2 ml-4">
                      <Link href={`/pautas/${pauta.id}`}>
                        <Button variant="outline" size="sm" className="w-full cursor-pointer">
                          Ver Detalhes
                        </Button>
                      </Link>
                      
                      {pauta.status === 'aberta' && canCreate && (
                        <Link href={`/sessoes/nova?pauta=${pauta.id}`}>
                          <Button size="sm" className="w-full cursor-pointer">
                            <Gavel className="mr-1 h-3 w-3" />
                            Iniciar Sessão
                          </Button>
                        </Link>
                      )}
                      
                      {pauta.sessao && (
                        <Link href={`/sessoes/${pauta.sessao.id}`}>
                          <Button variant="secondary" size="sm" className="w-full cursor-pointer">
                            <Users className="mr-1 h-3 w-3" />
                            Ver Sessão
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Próximas Pautas */}
      {pautas.filter(p => new Date(p.dataPauta) >= new Date() && p.status !== 'fechada').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximas Pautas
            </CardTitle>
            <CardDescription>
              Pautas agendadas para os próximos dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pautas
                .filter(p => new Date(p.dataPauta) >= new Date() && p.status !== 'fechada')
                .slice(0, 3)
                .map((pauta) => {
                  const dataStatus = getDataStatus(pauta.dataPauta)
                  return (
                    <div key={pauta.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Link 
                          href={`/pautas/${pauta.id}`}
                          className="font-medium hover:text-blue-600"
                        >
                          {pauta.numero}
                        </Link>
                        <p className="text-sm text-gray-600">
                          {pauta.processos.length} processo{pauta.processos.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {new Date(pauta.dataPauta).toLocaleDateString('pt-BR')}
                        </p>
                        <p className={`text-xs ${dataStatus.color}`}>
                          {dataStatus.label}
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
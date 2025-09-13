import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ExcluirDecisaoButton from '@/components/buttons/excluir-decisao-button'
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
import EditarInformacoesSessaoForm from '@/components/forms/editar-informacoes-sessao-form'
import AssuntosAdministrativosForm from '@/components/forms/assuntos-administrativos-form'
import EditarConselheirosForm from '@/components/forms/editar-conselheiros-sessao-form'
import { formatLocalDate } from '@/lib/utils/date'

interface SessaoPageProps {
  params: Promise<{ id: string }>
}

async function getSessao(id: string) {
  const sessao = await prisma.sessaoJulgamento.findUnique({
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
          },
          votos: {
            include: {
              conselheiro: true
            },
            orderBy: { ordemApresentacao: 'asc' }
          }
        },
        orderBy: { createdAt: 'asc' }
      },
      presidente: {
        select: {
          id: true,
          nome: true,
          email: true,
          cargo: true
        }
      },
      conselheiros: {
        select: {
          id: true,
          nome: true,
          email: true,
          cargo: true
        }
      }
    }
  })

  if (!sessao) return null

  // Converter valores Decimal para number
  return {
    ...sessao,
    pauta: {
      ...sessao.pauta,
      processos: sessao.pauta.processos.map(processoPauta => ({
        ...processoPauta,
        processo: {
          ...processoPauta.processo,
          valorOriginal: processoPauta.processo.valorOriginal ? Number(processoPauta.processo.valorOriginal) : null,
          valorNegociado: processoPauta.processo.valorNegociado ? Number(processoPauta.processo.valorNegociado) : null
        }
      }))
    },
    decisoes: sessao.decisoes.map(decisao => ({
      ...decisao,
      processo: {
        ...decisao.processo,
        valorOriginal: decisao.processo.valorOriginal ? Number(decisao.processo.valorOriginal) : null,
        valorNegociado: decisao.processo.valorNegociado ? Number(decisao.processo.valorNegociado) : null
      }
    }))
  }
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

    // Contar processos por categoria
    const contadores = {
      pendentes: 0,
      suspensos: 0,
      diligencias: 0,
      vistas: 0,
      julgados: 0
    }

    sessao.pauta.processos.forEach(processoPauta => {
      const decisao = sessao.decisoes.find(d => d.processoId === processoPauta.processo.id)
      
      if (!decisao) {
        contadores.pendentes++
      } else {
        switch (decisao.tipoResultado) {
          case 'SUSPENSO':
            contadores.suspensos++
            break
          case 'PEDIDO_DILIGENCIA':
            contadores.diligencias++
            break
          case 'PEDIDO_VISTA':
            contadores.vistas++
            break
          case 'JULGADO':
            contadores.julgados++
            break
          default:
            contadores.pendentes++
        }
      }
    })

    return {
      total: totalProcessos,
      julgados: processosJulgados,
      pendentes: totalProcessos - processosJulgados,
      percentual,
      contadores
    }
  }

  const getResultadoBadge = (decisao: any) => {
    if (!decisao) return null

    switch (decisao.tipoResultado) {
      case 'SUSPENSO':
        return <Badge className="bg-yellow-100 text-yellow-800">Suspenso</Badge>
      case 'PEDIDO_VISTA':
        return <Badge className="bg-blue-100 text-blue-800">Pedido de Vista</Badge>
      case 'PEDIDO_DILIGENCIA':
        return <Badge className="bg-orange-100 text-orange-800">Pedido de Diligência</Badge>
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

  const getResultadoDetails = (decisao: any) => {
    if (!decisao) return null

    const details = []

    switch (decisao.tipoResultado) {
      case 'SUSPENSO':
        if (decisao.motivoSuspensao) {
          details.push(`Motivo: ${decisao.motivoSuspensao}`)
        }
        break
      case 'PEDIDO_VISTA':
        if (decisao.conselheiroPedidoVista) {
          details.push(`Solicitado por: ${decisao.conselheiroPedidoVista}`)
        }
        if (decisao.prazoVista) {
          details.push(`Prazo: ${new Date(decisao.prazoVista).toLocaleDateString('pt-BR')}`)
        }
        break
      case 'PEDIDO_DILIGENCIA':
        if (decisao.especificacaoDiligencia) {
          details.push(`Especificação: ${decisao.especificacaoDiligencia}`)
        }
        if (decisao.prazoDiligencia) {
          details.push(`Prazo: ${new Date(decisao.prazoDiligencia).toLocaleDateString('pt-BR')}`)
        }
        break
      case 'JULGADO':
        if (decisao.definirAcordo) {
          details.push('Processo seguirá para análise de acordo')
          if (decisao.tipoAcordo) {
            const tiposAcordo = {
              'aceita_proposta': 'Aceita proposta da prefeitura',
              'contra_proposta': 'Fará contra-proposta',
              'sem_acordo': 'Não há possibilidade de acordo'
            }
            details.push(`Tipo: ${tiposAcordo[decisao.tipoAcordo] || decisao.tipoAcordo}`)
          }
        }
        break
    }

    return details
  }

  const formatarListaNomes = (nomes: string[]): string => {
    if (nomes.length === 0) return ''
    if (nomes.length === 1) return nomes[0]
    if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`

    const todosExcetoUltimo = nomes.slice(0, -1).join(', ')
    const ultimo = nomes[nomes.length - 1]
    return `${todosExcetoUltimo} e ${ultimo}`
  }

  const status = getStatusSessao()
  const StatusIcon = status.icon
  const duracao = getDuracaoSessao()
  const progresso = getProgressoJulgamento()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sessoes">
          <Button variant="outline" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
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
            Pauta: {sessao.pauta.numero} - {formatLocalDate(sessao.pauta.dataPauta.toISOString().split('T')[0])}
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && isActive && progresso.pendentes > 0 && (
            <Link href={`/sessoes/${sessao.id}/decisoes/nova`}>
              <Button className="cursor-pointer">
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
              {sessao.numeroAta && (
                <div>
                  <span className="text-gray-600">Número da Ata:</span>
                  <p className="font-medium">{sessao.numeroAta}</p>
                </div>
              )}
              {sessao.presidente && (
                <div>
                  <span className="text-gray-600">Presidente da Sessão:</span>
                  <p className="font-medium">{sessao.presidente.nome}</p>
                </div>
              )}
            </div>


            {canEdit && isActive && (
              <div className="flex gap-2 pt-4 border-t">
                <EditarInformacoesSessaoForm
                  sessaoId={sessao.id}
                  currentData={{
                    numeroAta: sessao.numeroAta,
                    presidenteId: sessao.presidenteId,
                    dataInicio: sessao.dataInicio,
                    conselheiros: sessao.conselheiros.map(c => ({ id: c.id, nome: c.nome }))
                  }}
                />
                <AssuntosAdministrativosForm
                  sessaoId={sessao.id}
                  currentText={sessao.assuntosAdministrativos || ''}
                />
              </div>
            )}
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
          <CardContent className="space-y-4">
            <div className="text-sm">
              {sessao.conselheiros
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map((conselheiro, index) => (
                  <span key={conselheiro.id}>
                    <span className="font-medium">{conselheiro.nome}</span>
                    {index < sessao.conselheiros.length - 1 && <span className="text-gray-400"> • </span>}
                  </span>
                ))}
            </div>

            {canEdit && isActive && (
              <div className="flex gap-2 pt-4 mt-8 border-t">
                <EditarConselheirosForm
                  sessaoId={sessao.id}
                  currentConselheiros={sessao.conselheiros.map(c => ({ id: c.id, nome: c.nome }))}
                  presidenteId={sessao.presidenteId || undefined}
                />
              </div>
            )}
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
            <div className="grid grid-cols-5 gap-3 text-center">
              <div>
                <p className="text-xl font-bold text-yellow-600">{progresso.contadores.pendentes}</p>
                <p className="text-xs text-gray-600">Pendentes</p>
              </div>
              <div>
                <p className="text-xl font-bold text-orange-600">{progresso.contadores.suspensos}</p>
                <p className="text-xs text-gray-600">Suspensos</p>
              </div>
              <div>
                <p className="text-xl font-bold text-red-600">{progresso.contadores.diligencias}</p>
                <p className="text-xs text-gray-600">Diligências</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600">{progresso.contadores.vistas}</p>
                <p className="text-xs text-gray-600">Vistas</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">{progresso.contadores.julgados}</p>
                <p className="text-xs text-gray-600">Julgados</p>
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
              const cardBackground = getCardBackground(decisao)
              const resultadoDetails = getResultadoDetails(decisao)

              return (
                <div
                  key={processoPauta.processo.id}
                  className={`border rounded-lg p-4 ${cardBackground}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        isJulgado ? 
                          (decisao.tipoResultado === 'JULGADO' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800') 
                          : 'bg-blue-100 text-blue-800'
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
                    <div className="text-right space-y-2">
                      {isJulgado ? (
                        <div className="space-y-2">
                          {getResultadoBadge(decisao)}
                          {canEdit && isActive && (
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/sessoes/${sessao.id}/decisoes/${decisao.id}/editar`}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Editar
                              </Link>
                              {user.role === 'ADMIN' && (
                                <ExcluirDecisaoButton 
                                  sessaoId={sessao.id} 
                                  decisaoId={decisao.id} 
                                />
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline">Aguardando</Badge>
                      )}
                      {canEdit && !isJulgado && isActive && (
                        <div>
                          <Link href={`/sessoes/${sessao.id}/decisoes/nova?processo=${processoPauta.processo.id}`}>
                            <Button size="sm" variant="outline" className="cursor-pointer">
                              <Gavel className="mr-1 h-3 w-3" />
                              Julgar
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>

                  {decisao && (
                    <div className="mt-3 space-y-2">
                      <div className="p-3 bg-white rounded border">
                        <h5 className="text-sm font-medium mb-2">Ata:</h5>
                        <p className="text-sm text-gray-700">{processoPauta.ataTexto || 'Texto da ata não informado'}</p>

                        {decisao.votos && decisao.votos.length > 0 && (
                          <div className="mt-3 pt-2 border-t">
                            <h6 className="text-xs font-medium text-gray-600 mb-3">Votos registrados:</h6>

                            {/* Layout organizado - mesmo da página de nova decisão */}
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
                        {sessao.presidente && decisao.votos.find((voto: any) =>
                          voto.conselheiroId === sessao.presidente?.id ||
                          voto.nomeVotante === sessao.presidente?.nome
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
                                <span className="truncate font-medium">{sessao.presidente.nome}</span>
                              </div>
                              <span className={`font-medium text-xs ${
                                decisao.votos.find((voto: any) =>
                                  voto.conselheiroId === sessao.presidente?.id ||
                                  voto.nomeVotante === sessao.presidente?.nome
                                )?.posicaoVoto === 'DEFERIDO' ? 'text-green-600' :
                                decisao.votos.find((voto: any) =>
                                  voto.conselheiroId === sessao.presidente?.id ||
                                  voto.nomeVotante === sessao.presidente?.nome
                                )?.posicaoVoto === 'INDEFERIDO' ? 'text-red-600' :
                                'text-yellow-600'
                              }`}>
                                {decisao.votos.find((voto: any) =>
                                  voto.conselheiroId === sessao.presidente?.id ||
                                  voto.nomeVotante === sessao.presidente?.nome
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
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
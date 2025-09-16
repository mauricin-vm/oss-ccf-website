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
  HandCoins, 
  Calendar, 
  AlertTriangle,
  DollarSign,
  FileText,
  Filter,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'
import { Acordo, Parcela, PagamentoParcela, Processo, Contribuinte, AcordoDetalhes, AcordoInscricao } from '@prisma/client'

type AcordoWithRelations = Acordo & {
  processo: Processo & {
    contribuinte: Contribuinte
  }
  parcelas: (Parcela & {
    pagamentos: PagamentoParcela[]
  })[]
  detalhes: (AcordoDetalhes & {
    inscricoes: AcordoInscricao[]
  })[]
}

async function getAcordos() {
  const acordos = await prisma.acordo.findMany({
    include: {
      processo: {
        include: {
          contribuinte: true
        }
      },
      parcelas: {
        orderBy: { numero: 'asc' },
        include: {
          pagamentos: true
        }
      },
      detalhes: {
        include: {
          inscricoes: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Serializar campos Decimal para Number
  return acordos.map(acordo => ({
    ...acordo,
    valorTotal: Number(acordo.valorTotal),
    valorDesconto: Number(acordo.valorDesconto),
    percentualDesconto: Number(acordo.percentualDesconto),
    valorFinal: Number(acordo.valorFinal),
    valorEntrada: acordo.valorEntrada ? Number(acordo.valorEntrada) : null,
    parcelas: acordo.parcelas.map(parcela => ({
      ...parcela,
      valor: Number(parcela.valor),
      pagamentos: parcela.pagamentos.map(pagamento => ({
        ...pagamento,
        valorPago: Number(pagamento.valorPago)
      }))
    })),
    detalhes: acordo.detalhes.map(detalhe => ({
      ...detalhe,
      valorOriginal: Number(detalhe.valorOriginal),
      valorNegociado: Number(detalhe.valorNegociado),
      inscricoes: detalhe.inscricoes.map(inscricao => ({
        ...inscricao,
        valorDebito: Number(inscricao.valorDebito),
        valorAbatido: Number(inscricao.valorAbatido),
        percentualAbatido: Number(inscricao.percentualAbatido)
      }))
    }))
  }))
}

export default async function AcordosPage() {
  const session = await getServerSession(authOptions)
  const user = session?.user as SessionUser
  
  const acordos = await getAcordos()

  const canCreate = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'

  // Estatísticas
  const totalAcordos = acordos.length
  const acordosAtivos = acordos.filter(a => a.status === 'ativo').length
  const acordosVencidos = acordos.filter(a => {
    const hoje = new Date()
    return a.status === 'ativo' && new Date(a.dataVencimento) < hoje
  }).length

  const valorTotalAcordos = acordos.reduce((total, acordo) => {
    return total + acordo.valorFinal
  }, 0)

  const acordosComDetalhes = acordos.filter(a => a.detalhes.length > 0).length


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-green-100 text-green-800'
      case 'cumprido': return 'bg-blue-100 text-blue-800'
      case 'vencido': return 'bg-red-100 text-red-800'
      case 'cancelado': return 'bg-gray-100 text-gray-800'
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

  const getProgressoPagamento = (acordo: AcordoWithRelations) => {
    const valorTotal = Number(acordo.valorFinal) || 0
    const valorPago = acordo.parcelas.reduce((total: number, parcela) => {
      return total + parcela.pagamentos.reduce((subtotal: number, pagamento) => {
        return subtotal + (Number(pagamento.valorPago) || 0)
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

  const getDetalhesAcordo = (acordo: AcordoWithRelations) => {
    if (acordo.detalhes.length === 0) return null

    const detalhe = acordo.detalhes[0]
    const tipoLabel = {
      'transacao': 'Transação Excepcional',
      'compensacao': 'Compensação',
      'dacao': 'Dação em Pagamento'
    }[detalhe.tipo] || detalhe.tipo

    return {
      tipo: tipoLabel,
      descricao: detalhe.descricao,
      valorOriginal: detalhe.valorOriginal,
      valorNegociado: detalhe.valorNegociado,
      totalInscricoes: detalhe.inscricoes.length,
      valorTotalInscricoes: detalhe.inscricoes.reduce((total, inscricao) => total + inscricao.valorDebito, 0)
    }
  }

  const isVencido = (dataVencimento: Date) => {
    return new Date(dataVencimento) < new Date()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Acordos e Pagamentos</h1>
          <p className="text-gray-600">
            Gerencie os acordos de pagamento e acompanhe o cumprimento
          </p>
        </div>
        
        {canCreate && (
          <Link href="/acordos/novo">
            <Button className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              Novo Acordo
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
                  placeholder="Buscar por processo, contribuinte ou número do acordo..."
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
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Acordos</p>
                <p className="text-2xl font-bold">{totalAcordos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Ativos</p>
                <p className="text-2xl font-bold">{acordosAtivos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Vencidos</p>
                <p className="text-2xl font-bold">{acordosVencidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Específicos</p>
                <p className="text-2xl font-bold">{acordosComDetalhes}</p>
                <p className="text-xs text-gray-500">Com detalhes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Total</p>
                <p className="text-2xl font-bold">
                  R$ {valorTotalAcordos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Acordos */}
      <div className="space-y-4">
        {acordos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <HandCoins className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum acordo encontrado
              </h3>
              <p className="text-gray-600 mb-4">
                Comece criando seu primeiro acordo de pagamento.
              </p>
              {canCreate && (
                <Link href="/acordos/novo">
                  <Button className="cursor-pointer">
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Acordo
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          acordos.map((acordo) => {
            const progresso = getProgressoPagamento(acordo)
            const vencido = isVencido(acordo.dataVencimento)
            const detalhes = getDetalhesAcordo(acordo)

            return (
              <Card key={acordo.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      {/* Cabeçalho do Acordo */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <Link
                          href={`/processos/${acordo.processo.id}`}
                          className="font-semibold text-lg hover:text-blue-600 transition-colors"
                        >
                          {acordo.processo.numero}
                        </Link>
                        <Badge className={getStatusColor(acordo.status)}>
                          {getStatusLabel(acordo.status)}
                        </Badge>
                        {vencido && acordo.status === 'ativo' && (
                          <Badge className="bg-red-100 text-red-800">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Vencido
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {acordo.modalidadePagamento === 'avista' ? 'À Vista' :
                           `${acordo.numeroParcelas}x`}
                        </Badge>
                        {detalhes && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            {detalhes.tipo}
                          </Badge>
                        )}
                      </div>

                      {/* Informações do Contribuinte */}
                      <div>
                        <p className="font-medium">{acordo.processo.contribuinte.nome}</p>
                        <p className="text-sm text-gray-600">{acordo.processo.contribuinte.cpfCnpj}</p>
                      </div>

                      {/* Detalhes Específicos do Acordo */}
                      {detalhes && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <h4 className="text-sm font-medium text-blue-900 mb-2">
                            Detalhes do {detalhes.tipo}
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-blue-700">Valor Original:</span>
                              <p className="font-medium">
                                R$ {detalhes.valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div>
                              <span className="text-blue-700">Valor Negociado:</span>
                              <p className="font-medium">
                                R$ {detalhes.valorNegociado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div>
                              <span className="text-blue-700">Inscrições:</span>
                              <p className="font-medium">
                                {detalhes.totalInscricoes} inscrição{detalhes.totalInscricoes !== 1 ? 'ões' : ''}
                              </p>
                            </div>
                          </div>
                          {detalhes.valorTotalInscricoes > 0 && (
                            <div className="mt-2 text-xs">
                              <span className="text-blue-700">Total das Inscrições:</span>
                              <span className="font-medium ml-1">
                                R$ {detalhes.valorTotalInscricoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

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
                          <span>Assinado: {new Date(acordo.dataAssinatura).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Vence: {new Date(acordo.dataVencimento).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span>{acordo.parcelas.length} parcela{acordo.parcelas.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          <span>{acordo.parcelas.reduce((total, p) => total + p.pagamentos.length, 0)} pagamento{acordo.parcelas.reduce((total, p) => total + p.pagamentos.length, 0) !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Próximas Parcelas */}
                      {acordo.parcelas.filter(p => p.status === 'pendente').length > 0 && (
                        <div className="border-t pt-3">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">
                            Próximas Parcelas:
                          </h4>
                          <div className="space-y-1">
                            {acordo.parcelas
                              .filter(p => p.status === 'pendente')
                              .slice(0, 2)
                              .map((parcela) => (
                                <div key={parcela.id} className="text-sm flex items-center justify-between">
                                  <span>
                                    {parcela.numero === 0 ? 'Entrada' : `Parcela ${parcela.numero}`} - {new Date(parcela.dataVencimento).toLocaleDateString('pt-BR')}
                                  </span>
                                  <span className="font-medium">
                                    R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              ))}
                            {acordo.parcelas.filter(p => p.status === 'pendente').length > 2 && (
                              <div className="text-xs text-gray-500">
                                ... e mais {acordo.parcelas.filter(p => p.status === 'pendente').length - 2} parcela{acordo.parcelas.filter(p => p.status === 'pendente').length - 2 !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Ações */}
                    <div className="flex flex-col gap-2 ml-4">
                      <Link href={`/acordos/${acordo.id}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          Ver Detalhes
                        </Button>
                      </Link>
                      
                      <Link href={`/processos/${acordo.processo.id}`}>
                        <Button variant="ghost" size="sm" className="w-full">
                          Ver Processo
                        </Button>
                      </Link>
                      
                      {canCreate && acordo.status === 'ativo' && progresso.valorPendente > 0 && (
                        <Link href={`/acordos/${acordo.id}/pagamentos/novo`}>
                          <Button size="sm" className="w-full">
                            <DollarSign className="mr-1 h-3 w-3" />
                            Registrar Pagamento
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

      {/* Acordos Vencidos */}
      {acordosVencidos > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Acordos Vencidos
            </CardTitle>
            <CardDescription>
              Acordos que precisam de atenção urgente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {acordos
                .filter(a => a.status === 'ativo' && isVencido(a.dataVencimento))
                .slice(0, 3)
                .map((acordo) => {
                  const progresso = getProgressoPagamento(acordo)
                  const diasVencido = Math.floor((new Date().getTime() - new Date(acordo.dataVencimento).getTime()) / (1000 * 60 * 60 * 24))
                  
                  return (
                    <div key={acordo.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Link 
                          href={`/acordos/${acordo.id}`}
                          className="font-medium hover:text-blue-600"
                        >
                          {acordo.processo.numero}
                        </Link>
                        <p className="text-sm text-gray-600">
                          {acordo.processo.contribuinte.nome} • Vencido há {diasVencido} dia{diasVencido !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-red-100 text-red-800">
                          Vencido
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          Pendente: R$ {progresso.valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  HandCoins, 
  DollarSign, 
  FileText,
  ArrowLeft,
  AlertTriangle,
  User,
  Building,
  Calculator,
  CreditCard
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'
import AcordoActions from '@/components/acordo/acordo-actions'

interface AcordoPageProps {
  params: Promise<{ id: string }>
}

async function getAcordo(id: string) {
  return prisma.acordo.findUnique({
    where: { id },
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
          },
          decisoes: {
            orderBy: { createdAt: 'desc' }
          }
        }
      },
      parcelas: {
        orderBy: { numero: 'asc' },
        include: {
          pagamentos: {
            orderBy: { createdAt: 'desc' }
          }
        }
      },
      pagamentos: {
        orderBy: { createdAt: 'desc' },
        include: {
          parcela: true
        }
      }
    }
  })
}

export default async function AcordoPage({ params }: AcordoPageProps) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser
  const { id } = await params
  const acordo = await getAcordo(id)

  if (!acordo) {
    notFound()
  }

  const canEdit = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'
  const canRegisterPayment = canEdit && acordo.status === 'ativo'

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

  const getParcelaStatusColor = (status: string) => {
    switch (status) {
      case 'pendente': return 'bg-yellow-100 text-yellow-800'
      case 'paga': return 'bg-green-100 text-green-800'
      case 'vencida': return 'bg-red-100 text-red-800'
      case 'cancelada': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getParcelaStatusLabel = (status: string) => {
    switch (status) {
      case 'pendente': return 'Pendente'
      case 'paga': return 'Paga'
      case 'vencida': return 'Vencida'
      case 'cancelada': return 'Cancelada'
      default: return status
    }
  }

  const getProgressoPagamento = () => {
    const valorTotal = acordo.valorFinal || 0
    const valorPago = acordo.pagamentos.reduce((total, p) => total + (p.valorPago || 0), 0)
    const percentual = valorTotal > 0 ? Math.round((valorPago / valorTotal) * 100) : 0
    
    return {
      valorTotal,
      valorPago,
      valorPendente: valorTotal - valorPago,
      percentual
    }
  }

  const isVencido = (dataVencimento: Date) => {
    return new Date(dataVencimento) < new Date() && acordo.status === 'ativo'
  }

  const progresso = getProgressoPagamento()
  const vencido = isVencido(acordo.dataVencimento)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/acordos">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Acordo de Pagamento</h1>
            <Badge className={getStatusColor(acordo.status)}>
              {getStatusLabel(acordo.status)}
            </Badge>
            {vencido && (
              <Badge className="bg-red-100 text-red-800">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Vencido
              </Badge>
            )}
          </div>
          <p className="text-gray-600">
            Processo: {acordo.processo.numero} - {acordo.processo.contribuinte.nome}
          </p>
        </div>
        <div className="flex gap-2">
          {canRegisterPayment && progresso.valorPendente > 0 && (
            <Link href={`/acordos/${acordo.id}/pagamentos/novo`}>
              <Button>
                <DollarSign className="mr-2 h-4 w-4" />
                Registrar Pagamento
              </Button>
            </Link>
          )}
          {canEdit && (
            <AcordoActions acordo={acordo} />
          )}
        </div>
      </div>

      {/* Informações do Acordo */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5" />
              Informações do Acordo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Data de Assinatura:</span>
                <p className="font-medium">{new Date(acordo.dataAssinatura).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <span className="text-gray-600">Data de Vencimento:</span>
                <p className="font-medium">{new Date(acordo.dataVencimento).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <span className="text-gray-600">Modalidade:</span>
                <p className="font-medium">
                  {acordo.modalidadePagamento === 'avista' ? 'À Vista' : `${acordo.numeroParcelas}x`}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <p className="font-medium">{getStatusLabel(acordo.status)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Dados do Contribuinte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <span>{acordo.processo.contribuinte.nome}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-gray-400" />
              <span>{acordo.processo.contribuinte.documento}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span>{acordo.processo.contribuinte.email}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Valores e Progresso */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Valores e Progresso
          </CardTitle>
          <CardDescription>
            Acompanhamento dos valores e pagamentos do acordo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Resumo dos Valores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <span className="text-sm text-gray-600">Valor Original:</span>
                <p className="font-medium">
                  R$ {acordo.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              {acordo.valorDesconto > 0 && (
                <div>
                  <span className="text-sm text-gray-600">Desconto:</span>
                  <p className="font-medium text-red-600">
                    - R$ {acordo.valorDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    {acordo.percentualDesconto > 0 && ` (${acordo.percentualDesconto.toFixed(1)}%)`}
                  </p>
                </div>
              )}
              <div>
                <span className="text-sm text-gray-600">Valor do Acordo:</span>
                <p className="font-bold text-lg">
                  R$ {acordo.valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Progresso do Pagamento */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Progresso do Pagamento</span>
                <span className="font-medium">{progresso.percentual}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progresso.percentual}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-blue-600">
                    R$ {progresso.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-600">Total</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">
                    R$ {progresso.valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-600">Pago</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-yellow-600">
                    R$ {progresso.valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-600">Pendente</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parcelas */}
      <Card>
        <CardHeader>
          <CardTitle>Parcelas do Acordo</CardTitle>
          <CardDescription>
            Cronograma de pagamento e status das parcelas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {acordo.parcelas.map((parcela) => {
              const isVencidaParcela = new Date(parcela.dataVencimento) < new Date() && parcela.status === 'pendente'
              const totalPagoParcela = parcela.pagamentos.reduce((total, p) => total + p.valorPago, 0)
              const restanteParcela = parcela.valor - totalPagoParcela
              
              return (
                <div 
                  key={parcela.id} 
                  className={`border rounded-lg p-4 ${
                    parcela.status === 'paga' ? 'bg-green-50 border-green-200' :
                    isVencidaParcela ? 'bg-red-50 border-red-200' :
                    'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        parcela.status === 'paga' ? 'bg-green-100 text-green-800' :
                        isVencidaParcela ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {parcela.numero}
                      </span>
                      <div>
                        <p className="font-medium">
                          Parcela {parcela.numero} de {acordo.numeroParcelas}
                        </p>
                        <p className="text-sm text-gray-600">
                          Vencimento: {new Date(parcela.dataVencimento).toLocaleDateString('pt-BR')}
                        </p>
                        {parcela.dataPagamento && (
                          <p className="text-sm text-green-600">
                            Paga em: {new Date(parcela.dataPagamento).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getParcelaStatusColor(parcela.status)}>
                        {getParcelaStatusLabel(parcela.status)}
                      </Badge>
                      <p className="text-sm font-medium mt-1">
                        R$ {parcela.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      {parcela.status === 'pendente' && totalPagoParcela > 0 && (
                        <p className="text-xs text-blue-600">
                          Pago: R$ {totalPagoParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                      {canRegisterPayment && parcela.status === 'pendente' && restanteParcela > 0 && (
                        <Link href={`/acordos/${acordo.id}/pagamentos/novo?parcela=${parcela.id}`}>
                          <Button size="sm" variant="outline" className="mt-2">
                            <DollarSign className="mr-1 h-3 w-3" />
                            Pagar
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                  
                  {/* Pagamentos da parcela */}
                  {parcela.pagamentos.length > 0 && (
                    <div className="mt-3 pl-11 space-y-2">
                      <h5 className="text-sm font-medium">Pagamentos:</h5>
                      {parcela.pagamentos.map((pagamento) => (
                        <div key={pagamento.id} className="text-sm bg-white p-2 rounded border">
                          <div className="flex justify-between items-center">
                            <span>
                              {new Date(pagamento.dataPagamento).toLocaleDateString('pt-BR')} - 
                              {pagamento.formaPagamento.replace('_', ' ').toLowerCase()}
                            </span>
                            <span className="font-medium">
                              R$ {pagamento.valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {pagamento.numeroComprovante && (
                            <p className="text-xs text-gray-500">
                              Comprovante: {pagamento.numeroComprovante}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Pagamentos */}
      {acordo.pagamentos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Pagamentos</CardTitle>
            <CardDescription>
              Todos os pagamentos registrados para este acordo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {acordo.pagamentos.map((pagamento) => (
                <div key={pagamento.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">
                        Parcela {pagamento.parcela.numero} - {new Date(pagamento.dataPagamento).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {pagamento.formaPagamento.replace('_', ' ').toLowerCase()}
                        {pagamento.numeroComprovante && ` • ${pagamento.numeroComprovante}`}
                      </p>
                      {pagamento.observacoes && (
                        <p className="text-sm text-gray-500">{pagamento.observacoes}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">
                      R$ {pagamento.valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observações e Cláusulas */}
      {(acordo.observacoes || acordo.clausulasEspeciais) && (
        <div className="grid gap-6 md:grid-cols-2">
          {acordo.observacoes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{acordo.observacoes}</p>
              </CardContent>
            </Card>
          )}
          
          {acordo.clausulasEspeciais && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cláusulas Especiais</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{acordo.clausulasEspeciais}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Informações do Processo */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Processo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Número:</span>
                <p className="font-medium">{acordo.processo.numero}</p>
              </div>
              <div>
                <span className="text-gray-600">Tipo:</span>
                <p className="font-medium">
                  {acordo.processo.tipo === 'compensacao' ? 'Compensação' :
                   acordo.processo.tipo === 'dacao' ? 'Dação em Pagamento' :
                   'Transação Excepcional'}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>
                <p className="font-medium">{acordo.processo.status.replace('_', ' ')}</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Ver detalhes completos:</span>
              <Link href={`/processos/${acordo.processo.id}`}>
                <Button variant="outline" size="sm">
                  Ver Processo
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
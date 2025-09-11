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
  FileText, 
  Calendar, 
  DollarSign,
  MapPin,
  Phone,
  Mail,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'

async function getProcesso(id: string) {
  return prisma.processo.findUnique({
    where: { id },
    include: {
      contribuinte: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      },
      tramitacoes: {
        include: {
          usuario: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      },
      documentos: {
        orderBy: { createdAt: 'desc' }
      },
      pautas: {
        include: {
          pauta: true
        },
        orderBy: { pauta: { dataPauta: 'desc' } }
      },
      decisoes: {
        include: {
          sessao: true
        },
        orderBy: { dataDecisao: 'desc' }
      },
      acordo: {
        include: {
          parcelas: {
            orderBy: { numero: 'asc' }
          }
        }
      },
      imoveis: {
        include: {
          imovel: true
        }
      },
      creditos: {
        include: {
          credito: true
        }
      }
    }
  })
}

export default async function ProcessoDetalhesPage({
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
  const processo = await getProcesso(id)

  if (!processo) {
    notFound()
  }

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
  const StatusIcon = statusMap[processo.status].icon

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/processos">
            <Button variant="outline" size="icon" className="cursor-pointer">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{processo.numero}</h1>
            <p className="text-gray-600">
              {processo.contribuinte.nome}
            </p>
          </div>
        </div>
        
        {canEdit && (
          <Link href={`/processos/${processo.id}/editar`}>
            <Button className="cursor-pointer">
              <Edit className="mr-2 h-4 w-4" />
              Editar Processo
            </Button>
          </Link>
        )}
      </div>

      {/* Status e Informações Principais */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <StatusIcon className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                <Badge className={statusMap[processo.status].color}>
                  {statusMap[processo.status].label}
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
                  R$ {processo.valorOriginal.toLocaleString('pt-BR')}
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
          <TabsTrigger value="contribuinte" className="cursor-pointer">Contribuinte</TabsTrigger>
          <TabsTrigger value="tramitacoes" className="cursor-pointer">Tramitações</TabsTrigger>
          <TabsTrigger value="documentos" className="cursor-pointer">Documentos</TabsTrigger>
          <TabsTrigger value="acordo" className="cursor-pointer">Acordo</TabsTrigger>
          <TabsTrigger value="historico" className="cursor-pointer">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
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
                  <p className="font-medium">R$ {processo.valorOriginal.toLocaleString('pt-BR')}</p>
                </div>
                {processo.valorNegociado && (
                  <div>
                    <Label>Valor Negociado</Label>
                    <p className="font-medium">R$ {processo.valorNegociado.toLocaleString('pt-BR')}</p>
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
        </TabsContent>

        <TabsContent value="contribuinte">
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
                            {tramitacao.setorOrigem} → {tramitacao.setorDestino}
                          </h4>
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

        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>
                Documentos anexados ao processo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {processo.documentos.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  Nenhum documento anexado
                </p>
              ) : (
                <div className="space-y-2">
                  {processo.documentos.map((documento) => (
                    <div key={documento.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-gray-500" />
                        <div>
                          <p className="font-medium">{documento.nome}</p>
                          <p className="text-sm text-gray-500">
                            {documento.tipo} • {(documento.tamanho / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="cursor-pointer">
                        Baixar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
                        R$ {processo.acordo.valorTotal.toLocaleString('pt-BR')}
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
                                R$ {parcela.valor.toLocaleString('pt-BR')}
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
              <CardTitle>Histórico Completo</CardTitle>
              <CardDescription>
                Timeline completa do processo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4 pb-4 border-b">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">Processo Criado</h4>
                    <p className="text-sm text-gray-600">
                      Processo {processo.numero} criado por {processo.createdBy.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(processo.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
                
                {/* Aqui você pode adicionar outros eventos do histórico */}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-gray-600 mb-1">{children}</p>
}
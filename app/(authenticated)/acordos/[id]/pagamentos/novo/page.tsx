import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import PagamentoForm from '@/components/forms/pagamento-form'
import { SessionUser } from '@/types'

interface NovoPagamentoPageProps {
  params: Promise<{ id: string }>
}

async function getAcordo(id: string) {
  return prisma.acordo.findUnique({
    where: { id },
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
      }
    }
  })
}

export default async function NovoPagamentoPage({ params }: NovoPagamentoPageProps) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser
  const { id } = await params

  // Apenas Admin e Funcionário podem registrar pagamentos
  if (user.role === 'VISUALIZADOR') {
    redirect(`/acordos/${id}`)
  }

  const acordo = await getAcordo(id)

  if (!acordo) {
    notFound()
  }

  // Verificar se o acordo está ativo
  if (acordo.status !== 'ativo') {
    redirect(`/acordos/${id}`)
  }

  // Verificar se há parcelas pendentes
  const parcelasPendentes = acordo.parcelas.filter(p => {
    const valorPago = p.pagamentos.reduce((total, pagamento) => total + pagamento.valorPago, 0)
    return p.status === 'pendente' && valorPago < p.valor
  })
  
  if (parcelasPendentes.length === 0) {
    redirect(`/acordos/${id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/acordos/${id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Novo Pagamento</h1>
          <p className="text-gray-600">
            Registre um pagamento para o acordo do processo {acordo.processo.numero}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Registrar Pagamento
          </CardTitle>
          <CardDescription>
            Selecione a parcela e registre os detalhes do pagamento recebido
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          }>
            <PagamentoForm acordoId={id} />
          </Suspense>
        </CardContent>
      </Card>

      {/* Informações do Acordo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações do Acordo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600 block">Processo:</span>
              <span className="font-medium">{acordo.processo.numero}</span>
            </div>
            <div>
              <span className="text-gray-600 block">Contribuinte:</span>
              <span className="font-medium">{acordo.processo.contribuinte.nome}</span>
            </div>
            <div>
              <span className="text-gray-600 block">Valor Total:</span>
              <span className="font-medium">
                R$ {acordo.valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-gray-600 block">Parcelas Pendentes:</span>
              <span className="font-medium text-yellow-600">
                {parcelasPendentes.length} de {acordo.numeroParcelas}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orientações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Orientações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Seleção de Parcela:</strong> Apenas parcelas pendentes com saldo em aberto aparecerão para seleção
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Valor do Pagamento:</strong> Pode ser menor que o valor da parcela (pagamento parcial) ou igual (quitação)
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Formas de Pagamento:</strong> Dação e Compensação seguem regras específicas definidas no processo
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Comprovante:</strong> O número do comprovante é opcional mas recomendado para controle
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Atualização Automática:</strong> O status da parcela e do acordo são atualizados automaticamente
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
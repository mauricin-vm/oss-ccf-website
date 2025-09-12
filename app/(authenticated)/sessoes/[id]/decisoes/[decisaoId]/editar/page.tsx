import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import EditarDecisaoForm from '@/components/forms/editar-decisao-form'
import { SessionUser } from '@/types'

interface EditarDecisaoPageProps {
  params: Promise<{ id: string; decisaoId: string }>
}

export default async function EditarDecisaoPage({ params }: EditarDecisaoPageProps) {
  const { id, decisaoId } = await params
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  // Apenas Admin e Funcionário podem editar decisões
  if (user.role === 'VISUALIZADOR') {
    redirect('/dashboard')
  }

  // Buscar a decisão com todos os dados necessários
  const decisao = await prisma.decisao.findUnique({
    where: { id: decisaoId },
    include: {
      sessao: {
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
          conselheiros: true
        }
      },
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
    }
  })

  if (!decisao || decisao.sessaoId !== id) {
    notFound()
  }

  // Verificar se a sessão está ativa
  const isActive = !decisao.sessao.dataFim

  if (!isActive) {
    redirect(`/sessoes/${id}`)
  }

  // Buscar o processo na pauta para obter relator e revisores
  const processoNaPauta = decisao.sessao.pauta.processos.find(
    p => p.processo.id === decisao.processoId
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/sessoes/${id}`}>
          <Button variant="outline" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Editar Decisão</h1>
          <p className="text-gray-600">
            Processo {decisao.processo.numero} - {decisao.processo.contribuinte.nome}
          </p>
        </div>
      </div>

      {/* Formulário de Edição */}
      <Card>
        <CardContent className="pt-6">
          <EditarDecisaoForm
            decisaoId={decisao.id}
            sessaoId={id}
            decisaoAtual={{
              processoId: decisao.processoId,
              tipoResultado: decisao.tipoResultado,
              tipoDecisao: decisao.tipoDecisao,
              observacoes: decisao.observacoes,
              motivoSuspensao: decisao.motivoSuspensao,
              conselheiroPedidoVista: decisao.conselheiroPedidoVista,
              prazoVista: decisao.prazoVista ? decisao.prazoVista.toString() : undefined,
              especificacaoDiligencia: decisao.especificacaoDiligencia,
              prazoDiligencia: decisao.prazoDiligencia?.toString(),
              definirAcordo: decisao.definirAcordo,
              tipoAcordo: decisao.tipoAcordo,
              ataTexto: processoNaPauta?.ataTexto || '',
              votos: decisao.votos || []
            }}
            processo={processoNaPauta ? {
              ...processoNaPauta,
              processo: {
                ...decisao.processo,
                valorOriginal: Number(decisao.processo.valorOriginal),
                valorNegociado: decisao.processo.valorNegociado ? Number(decisao.processo.valorNegociado) : undefined,
                contribuinte: decisao.processo.contribuinte
              }
            } : null}
            conselheiros={decisao.sessao.conselheiros}
          />
        </CardContent>
      </Card>
    </div>
  )
}
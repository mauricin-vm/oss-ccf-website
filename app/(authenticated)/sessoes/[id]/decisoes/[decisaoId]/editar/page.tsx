import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import EditarDecisaoForm from '@/components/forms/editar-decisao-form'
import { SessionUser } from '@/types'
import { BackButton } from '@/components/ui/back-button'

interface EditarDecisaoPageProps {
  params: Promise<{ id: string; decisaoId: string }>
}


export default async function EditarDecisaoPage({ params, searchParams }: EditarDecisaoPageProps & { searchParams?: { from?: string } }) {
  const { id, decisaoId } = await params
  const session = await getServerSession(authOptions)
  const fromProcess = searchParams?.from === 'process'
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  // Apenas Admin pode editar decisões dos processos
  if (user.role !== 'ADMIN') {
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
          conselheiros: true,
          presidente: {
            select: {
              id: true,
              nome: true,
              email: true,
              cargo: true
            }
          }
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
  const isActive = !decisao.sessao?.dataFim

  // Se a sessão não está ativa, só permite acesso se:
  // - Veio da página do processo E o processo está JULGADO
  if (!isActive && !(fromProcess && decisao.processo.status === 'JULGADO')) {
    redirect(`/sessoes/${id}`)
  }

  // Verificar se o processo tem status JULGADO (apenas estes podem ser editados)
  if (decisao.processo.status !== 'JULGADO') {
    redirect(`/processos/${decisao.processoId}`)
  }

  // Buscar o processo na pauta para obter relator e revisores
  const processoNaPauta = decisao.sessao?.pauta?.processos.find(
    p => p.processo.id === decisao.processoId
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton
          sessaoId={id}
          processoId={decisao.processoId}
        />
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
              detalhesNegociacao: decisao.detalhesNegociacao,
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
              relator: processoNaPauta.relator || '',
              ataTexto: processoNaPauta.ataTexto || undefined,
              processo: {
                ...processoNaPauta.processo,
                valorOriginal: 0,
                contribuinte: {
                  ...processoNaPauta.processo.contribuinte,
                  email: processoNaPauta.processo.contribuinte.email || undefined
                }
              }
            } : null}
            conselheiros={decisao.sessao?.conselheiros?.map(c => ({
              ...c,
              email: c.email || undefined,
              cargo: c.cargo || undefined
            })) || []}
            presidente={decisao.sessao?.presidente ? {
              ...decisao.sessao.presidente,
              email: decisao.sessao.presidente.email || undefined,
              cargo: decisao.sessao.presidente.cargo || undefined
            } : null}
          />
        </CardContent>
      </Card>
    </div>
  )
}
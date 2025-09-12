import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Gavel, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import DecisaoForm from '@/components/forms/decisao-form'
import { SessionUser } from '@/types'

interface NovaDecisaoPageProps {
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
                  contribuinte: true
                }
              }
            }
          }
        }
      },
      decisoes: true
    }
  })
}

export default async function NovaDecisaoPage({ params }: NovaDecisaoPageProps) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser
  const { id } = await params

  // Apenas Admin e Funcionário podem registrar decisões
  if (user.role === 'VISUALIZADOR') {
    redirect(`/sessoes/${id}`)
  }

  const sessao = await getSessao(id)

  if (!sessao) {
    notFound()
  }

  // Verificar se a sessão está ativa
  if (sessao.dataFim) {
    redirect(`/sessoes/${id}`)
  }

  // Verificar se ainda há processos para julgar
  const totalProcessos = sessao.pauta.processos.length
  const processosJulgados = sessao.decisoes.length
  
  if (processosJulgados >= totalProcessos) {
    redirect(`/sessoes/${id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/sessoes/${id}`}>
          <Button variant="outline" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Nova Decisão</h1>
          <p className="text-gray-600">
            Registre a decisão de julgamento para um processo da {sessao.pauta.numero}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Registrar Decisão
          </CardTitle>
          <CardDescription>
            Selecione o processo e registre a decisão tomada pelos conselheiros
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          }>
            <DecisaoForm sessaoId={id} />
          </Suspense>
        </CardContent>
      </Card>

      {/* Informações da Sessão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações da Sessão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600 block">Pauta:</span>
              <span className="font-medium">{sessao.pauta.numero}</span>
            </div>
            <div>
              <span className="text-gray-600 block">Progresso:</span>
              <span className="font-medium">
                {processosJulgados} de {totalProcessos} processos julgados
              </span>
            </div>
            <div>
              <span className="text-gray-600 block">Pendentes:</span>
              <span className="font-medium text-yellow-600">
                {totalProcessos - processosJulgados} processo{totalProcessos - processosJulgados !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
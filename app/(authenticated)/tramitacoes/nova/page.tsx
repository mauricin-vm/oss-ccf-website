import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'
import TramitacaoForm from '@/components/forms/tramitacao-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SessionUser } from '@/types'

export default async function NovaTramitacaoPage({
  searchParams
}: {
  searchParams: Promise<{ processo?: string }>
}) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  // Apenas Admin e Funcionário podem criar tramitações
  if (user.role === 'VISUALIZADOR') {
    redirect('/tramitacoes')
  }

  const resolvedParams = await searchParams

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tramitacoes">
          <Button variant="outline" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nova Tramitação</h1>
          <p className="text-gray-600">
            Envie um processo para outro setor ou pessoa
          </p>
        </div>
      </div>

      <TramitacaoForm processoId={resolvedParams.processo} />
    </div>
  )
}
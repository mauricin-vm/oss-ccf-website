import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'
import PautaForm from '@/components/forms/pauta-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SessionUser } from '@/types'

export default async function NovaPautaPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  // Apenas Admin e Funcionário podem criar pautas
  if (user.role === 'VISUALIZADOR') {
    redirect('/pautas')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/pautas">
          <Button variant="outline" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nova Pauta</h1>
          <p className="text-gray-600">
            Crie uma nova pauta de julgamento
          </p>
        </div>
      </div>

      <PautaForm />
    </div>
  )
}
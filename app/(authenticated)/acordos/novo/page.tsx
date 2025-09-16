import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HandCoins, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import AcordoForm from '@/components/forms/acordo-form'
import { SessionUser } from '@/types'

export default async function NovoAcordoPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  // Apenas Admin e Funcionário podem criar acordos
  if (user.role === 'VISUALIZADOR') {
    redirect('/acordos')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/acordos">
          <Button variant="outline" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Novo Acordo de Pagamento</h1>
          <p className="text-gray-600">
            Crie um acordo de pagamento para um processo deferido
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5" />
            Configurar Acordo
          </CardTitle>
          <CardDescription>
            Selecione o processo, configure valores, descontos e modalidade de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          }>
            <AcordoForm />
          </Suspense>
        </CardContent>
      </Card>

    </div>
  )
}
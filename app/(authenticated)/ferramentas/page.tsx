import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, Wrench } from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'

export default async function FerramentasPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser
  const canAccess = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'

  if (!canAccess) {
    redirect('/dashboard')
  }

  const ferramentas = [
    {
      title: 'Controle de Jetons',
      description: 'Gerencie o pagamento de jetons aos conselheiros por sessão',
      icon: Wallet,
      href: '/ferramentas/controle-jetons',
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    }
    // Futuras ferramentas podem ser adicionadas aqui
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wrench className="h-8 w-8 text-gray-700" />
        <div>
          <h1 className="text-3xl font-bold">Ferramentas</h1>
          <p className="text-gray-600">
            Recursos auxiliares para o gerenciamento do sistema
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {ferramentas.map((ferramenta) => {
          const Icon = ferramenta.icon
          return (
            <Link key={ferramenta.href} href={ferramenta.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className={`w-12 h-12 ${ferramenta.bgColor} rounded-lg flex items-center justify-center mb-4`}>
                    <Icon className={`h-6 w-6 ${ferramenta.color}`} />
                  </div>
                  <CardTitle>{ferramenta.title}</CardTitle>
                  <CardDescription>{ferramenta.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-blue-600 hover:text-blue-800">
                    Acessar ferramenta →
                  </span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

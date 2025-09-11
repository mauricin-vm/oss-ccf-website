import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Gavel, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import SessaoForm from '@/components/forms/sessao-form'
import { SessionUser } from '@/types'

export default async function NovaSessaoPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser

  // Apenas Admin e Funcionário podem criar sessões
  if (user.role === 'VISUALIZADOR') {
    redirect('/sessoes')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sessoes">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Nova Sessão de Julgamento</h1>
          <p className="text-gray-600">
            Crie uma nova sessão para julgar os processos de uma pauta
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Configurar Sessão
          </CardTitle>
          <CardDescription>
            Selecione a pauta, defina a data e escolha os conselheiros que participarão da sessão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          }>
            <SessaoForm />
          </Suspense>
        </CardContent>
      </Card>

      {/* Informações Importantes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Pautas Elegíveis:</strong> Apenas pautas com status &quot;aberta&quot; podem ser utilizadas para criar sessões
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Conselheiros:</strong> Apenas usuários com função &quot;Administrador&quot; ou &quot;Funcionário&quot; podem ser selecionados como conselheiros
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Data e Hora:</strong> A sessão será iniciada automaticamente na data e hora definidas. Certifique-se de que todos os conselheiros estarão disponíveis
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Ata da Sessão:</strong> As informações iniciais podem ser preenchidas agora e serão complementadas durante o andamento da sessão
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
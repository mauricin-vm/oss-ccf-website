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
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
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
                <strong>Processos Elegíveis:</strong> Apenas processos com decisão &quot;Deferido&quot; ou &quot;Deferido Parcial&quot; que ainda não possuem acordo podem ser selecionados
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Cálculo de Descontos:</strong> Você pode inserir o percentual ou o valor do desconto. O sistema calculará automaticamente o valor complementar
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Modalidade de Pagamento:</strong> Escolha entre pagamento à vista ou parcelado. Para parcelamento, defina o número de parcelas mensais
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Geração de Parcelas:</strong> Se escolher pagamento parcelado, as parcelas serão geradas automaticamente com vencimentos mensais
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <strong>Cláusulas Especiais:</strong> Use este campo para definir multas por atraso, correção monetária ou outras condições contratuais
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
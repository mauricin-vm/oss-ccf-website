import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SessionUser } from '@/types'
import EditProcessoForm from '@/components/forms/edit-processo-form'

async function getProcesso(id: string) {
  return prisma.processo.findUnique({
    where: { id },
    include: {
      contribuinte: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  })
}

export default async function EditarProcessoPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const user = session.user as SessionUser
  const { id } = await params
  
  // Apenas Admin e Funcionário podem editar processos
  if (user.role === 'VISUALIZADOR') {
    redirect(`/processos/${id}`)
  }

  const processo = await getProcesso(id)

  if (!processo) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/processos/${id}`}>
          <Button variant="outline" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Editar Processo</h1>
          <p className="text-gray-600">
            {processo.numero} - {processo.contribuinte.nome}
          </p>
        </div>
      </div>

      <EditProcessoForm processo={{
        ...processo,
        valorOriginal: Number(processo.valorOriginal),
        valorNegociado: processo.valorNegociado ? Number(processo.valorNegociado) : null
      }} />
    </div>
  )
}
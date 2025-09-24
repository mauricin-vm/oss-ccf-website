'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface BackButtonProps {
  sessaoId: string
  processoId: string
}

export function BackButton({ sessaoId, processoId }: BackButtonProps) {
  const searchParams = useSearchParams()
  const fromProcess = searchParams.get('from') === 'process'

  const href = fromProcess
    ? `/processos/${processoId}`
    : `/sessoes/${sessaoId}`

  return (
    <Link href={href}>
      <Button variant="outline" size="icon" className="cursor-pointer">
        <ArrowLeft className="h-4 w-4" />
      </Button>
    </Link>
  )
}
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (session) {
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, [session, status, router])

  // Show loading while checking session or redirecting
  if (status === 'loading' || status === 'authenticated' || status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">
            {status === 'loading' ? 'Verificando sessão...' : 'Redirecionando...'}
          </p>
        </div>
      </div>
    )
  }

  return null
}

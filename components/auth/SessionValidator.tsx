'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect } from 'react'
import { SessionUser } from '@/types'

export function SessionValidator() {
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Verifica se o usuário ainda existe no banco
      const validateUser = async () => {
        try {
          const response = await fetch('/api/auth/validate-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: (session.user as SessionUser).id })
          })

          if (!response.ok) {
            // Usuário não existe mais, fazer logout
            await signOut({ callbackUrl: '/login' })
          }
        } catch (error) {
          console.error('Erro ao validar usuário:', error)
        }
      }

      validateUser()
    }
  }, [session, status])

  return null
}
'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { SessionUser } from '@/types'

export function SessionValidator() {
  const { data: session, status } = useSession()
  const validationInProgress = useRef(false)
  const [hasValidated, setHasValidated] = useState(false)

  useEffect(() => {
    if (status === 'authenticated' && session?.user && !validationInProgress.current && !hasValidated) {
      validationInProgress.current = true

      // Verifica se o usuário ainda existe no banco
      const validateUser = async () => {
        try {
          const response = await fetch('/api/auth/validate-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: (session.user as SessionUser).id })
          })

          if (!response.ok) {
            // Usuário não existe mais ou está inativo, fazer logout imediatamente
            console.warn('Usuário inválido detectado, fazendo logout...')
            await signOut({
              callbackUrl: '/login?message=session-expired',
              redirect: true
            })
          } else {
            setHasValidated(true)
          }
        } catch (error) {
          console.error('Erro ao validar usuário:', error)
          // Em caso de erro na validação, assumir que usuário é inválido por segurança
          console.warn('Erro na validação, fazendo logout por segurança...')
          await signOut({
            callbackUrl: '/login?message=validation-error',
            redirect: true
          })
        } finally {
          validationInProgress.current = false
        }
      }

      // Executa imediatamente para usuários potencialmente inválidos
      validateUser()
    }
  }, [session, status, hasValidated])

  return null
}
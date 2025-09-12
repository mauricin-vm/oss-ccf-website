'use client'

import { SessionProvider } from 'next-auth/react'

export default function ClientSessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider
      refetchOnWindowFocus={false} // Desativado para evitar recarregamentos no foco
    >
      {children}
    </SessionProvider>
  )
}
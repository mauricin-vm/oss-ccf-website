'use client'

import { SessionProvider } from 'next-auth/react'

export default function ClientSessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider
      refetchInterval={5 * 60} // Refetch a cada 5 minutos
      refetchOnWindowFocus={true} // Refaz fetch quando a janela ganha foco
      refetchWhenOffline={false} // Não refaz fetch quando offline
    >
      {children}
    </SessionProvider>
  )
}
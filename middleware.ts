import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Rotas de admin - apenas ADMIN
    if (path.startsWith('/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Rotas de modificação - ADMIN e FUNCIONARIO
    if (
      (path.includes('/novo') || 
       path.includes('/editar') || 
       path.includes('/deletar')) &&
      token?.role === 'VISUALIZADOR'
    ) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/processos/:path*',
    '/tramitacoes/:path*',
    '/pautas/:path*',
    '/sessoes/:path*',
    '/acordos/:path*',
    '/pagamentos/:path*',
    '/relatorios/:path*'
  ]
}
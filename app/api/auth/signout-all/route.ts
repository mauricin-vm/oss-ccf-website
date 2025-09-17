import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Cria resposta que limpa todos os cookies de autenticação
    const response = NextResponse.json({ success: true })

    // Remove cookies do NextAuth
    response.cookies.delete('next-auth.session-token')
    response.cookies.delete('__Secure-next-auth.session-token')
    response.cookies.delete('next-auth.callback-url')
    response.cookies.delete('next-auth.csrf-token')
    response.cookies.delete('__Host-next-auth.csrf-token')

    return response
  } catch (error) {
    console.error('Erro ao fazer signout:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
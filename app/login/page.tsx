'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Loader2, AlertCircle, UserPlus } from 'lucide-react'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  accessCode: z.string().min(1, 'Código de acesso é obrigatório')
})

type RegisterInput = z.infer<typeof registerSchema>

function LoginContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [showRegisterDialog, setShowRegisterDialog] = useState(false)

  // Função para obter a URL de redirecionamento
  const getRedirectUrl = useCallback(() => {
    const callbackUrl = searchParams.get('callbackUrl')
    return callbackUrl || '/dashboard'
  }, [searchParams])

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    if (status === 'loading') return
    
    if (session) {
      router.replace(getRedirectUrl())
    }
  }, [session, status, router, searchParams, getRedirectUrl])

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema)
  })

  const {
    register: registerRegister,
    handleSubmit: handleRegisterSubmit,
    formState: { errors: registerErrors },
    reset: resetRegisterForm
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema)
  })

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false
      })

      if (result?.error) {
        setError('Email ou senha inválidos')
      } else if (result?.ok) {
        // Login bem-sucedido, usar router para redirecionamento suave
        const redirectUrl = getRedirectUrl()
        router.push(redirectUrl)
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Ocorreu um erro ao fazer login')
    } finally {
      setIsLoading(false)
    }
  }

  const onRegisterSubmit = async (data: RegisterInput) => {
    setIsRegistering(true)
    setRegisterError(null)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          accessCode: data.accessCode
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar conta')
      }

      // Fechar modal e fazer login automático
      setShowRegisterDialog(false)
      resetRegisterForm()

      // Fazer login automático
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false
      })

      if (result?.error) {
        setError('Conta criada, mas erro ao fazer login. Tente fazer login manualmente.')
      } else if (result?.ok) {
        // Login bem-sucedido após registro, usar router para redirecionamento suave
        const redirectUrl = getRedirectUrl()
        router.push(redirectUrl)
      }
    } catch (error) {
      setRegisterError(error instanceof Error ? error.message : 'Erro ao criar conta')
    } finally {
      setIsRegistering(false)
    }
  }

  // Mostrar loading enquanto verifica sessão ou se já está logado
  if (status === 'loading' || session) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            CCF
          </CardTitle>
          <CardDescription className="text-center">
            Câmara de Conciliação Fiscal
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@ccf.gov.br"
                autoComplete="email"
                {...register('email')}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="pt-6">
            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </CardFooter>
        </form>

        <div className="px-6 pb-4">
          <div className="text-center space-y-3">
            <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full cursor-pointer">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Criar Conta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Conta</DialogTitle>
                  <DialogDescription>
                    Preencha os dados abaixo e o código de acesso para criar sua conta
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRegisterSubmit(onRegisterSubmit)} className="space-y-4">
                  {registerError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{registerError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nome Completo</Label>
                    <Input
                      id="register-name"
                      autoComplete="name"
                      {...registerRegister('name')}
                      disabled={isRegistering}
                      placeholder="Seu nome completo"
                    />
                    {registerErrors.name && (
                      <p className="text-sm text-red-500">{registerErrors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      {...registerRegister('email')}
                      disabled={isRegistering}
                      placeholder="seu.email@ccf.gov.br"
                    />
                    {registerErrors.email && (
                      <p className="text-sm text-red-500">{registerErrors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Senha</Label>
                    <Input
                      id="register-password"
                      type="password"
                      autoComplete="new-password"
                      {...registerRegister('password')}
                      disabled={isRegistering}
                      placeholder="Mínimo 6 caracteres"
                    />
                    {registerErrors.password && (
                      <p className="text-sm text-red-500">{registerErrors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-code">Código de Acesso</Label>
                    <Input
                      id="register-code"
                      type="password"
                      {...registerRegister('accessCode')}
                      disabled={isRegistering}
                      placeholder="Código fornecido pelo administrador"
                    />
                    {registerErrors.accessCode && (
                      <p className="text-sm text-red-500">{registerErrors.accessCode.message}</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRegisterDialog(false)}
                      disabled={isRegistering}
                      className="flex-1 cursor-pointer"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={isRegistering}
                      className="flex-1 cursor-pointer"
                    >
                      {isRegistering ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        'Criar Conta'
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <div className="text-xs text-gray-500 text-center space-y-1">
              <p>Precisa de acesso? Entre em contato com o administrador</p>
              <p>(67) 3314-3490</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
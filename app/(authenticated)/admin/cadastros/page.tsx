'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Building2, UserCheck } from 'lucide-react'
import { SessionUser } from '@/types'
import SetoresTab from './components/setores-tab'
import ConselheirosTab from './components/conselheiros-tab'

export default function CadastrosAdminPage() {
  const { data: session, status } = useSession()

  // Verificar se é admin
  if (status === 'loading') {
    return <div>Carregando...</div>
  }
  
  if (!session) {
    redirect('/login')
  }
  
  const user = session.user as SessionUser
  if (user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          Cadastros do Sistema
        </h1>
        <p className="text-gray-600">
          Gerencie setores, conselheiros e outras informações do sistema
        </p>
      </div>

      <Tabs defaultValue="conselheiros" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="conselheiros" className="flex items-center gap-2 cursor-pointer">
            <UserCheck className="h-4 w-4" />
            Conselheiros
          </TabsTrigger>
          <TabsTrigger value="setores" className="flex items-center gap-2 cursor-pointer">
            <Building2 className="h-4 w-4" />
            Setores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conselheiros" className="space-y-6">
          <ConselheirosTab />
        </TabsContent>

        <TabsContent value="setores" className="space-y-6">
          <SetoresTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
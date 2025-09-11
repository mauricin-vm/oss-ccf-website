'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  FileText,
  Calendar,
  Gavel,
  HandCoins,
  BarChart3,
  Settings,
  Users,
  LogOut,
  ChevronRight,
  Building2,
  Shield,
  Activity
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SidebarProps {
  userRole: 'ADMIN' | 'FUNCIONARIO' | 'VISUALIZADOR'
  userName: string
}

export default function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname()

  const menuItems = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      roles: ['ADMIN', 'FUNCIONARIO', 'VISUALIZADOR']
    },
    {
      title: 'Processos',
      href: '/processos',
      icon: FileText,
      roles: ['ADMIN', 'FUNCIONARIO', 'VISUALIZADOR']
    },
    {
      title: 'Tramitações',
      href: '/tramitacoes',
      icon: ChevronRight,
      roles: ['ADMIN', 'FUNCIONARIO']
    },
    {
      title: 'Pautas',
      href: '/pautas',
      icon: Calendar,
      roles: ['ADMIN', 'FUNCIONARIO']
    },
    {
      title: 'Sessões',
      href: '/sessoes',
      icon: Gavel,
      roles: ['ADMIN', 'FUNCIONARIO', 'VISUALIZADOR']
    },
    {
      title: 'Acordos',
      href: '/acordos',
      icon: HandCoins,
      roles: ['ADMIN', 'FUNCIONARIO', 'VISUALIZADOR']
    },
    {
      title: 'Relatórios',
      href: '/relatorios',
      icon: BarChart3,
      roles: ['ADMIN', 'FUNCIONARIO', 'VISUALIZADOR']
    }
  ]

  const adminItems = [
    {
      title: 'Painel',
      href: '/admin',
      icon: Shield,
      roles: ['ADMIN']
    },
    {
      title: 'Usuários',
      href: '/admin/usuarios',
      icon: Users,
      roles: ['ADMIN']
    },
    {
      title: 'Cadastros',
      href: '/admin/cadastros',
      icon: Building2,
      roles: ['ADMIN']
    },
    {
      title: 'Logs do Sistema',
      href: '/admin/logs',
      icon: Activity,
      roles: ['ADMIN']
    },
    {
      title: 'Configurações',
      href: '/admin/configuracoes',
      icon: Settings,
      roles: ['ADMIN']
    }
  ]

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(userRole)
  )

  const filteredAdminItems = adminItems.filter(item => 
    item.roles.includes(userRole)
  )

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center justify-center border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">CCF</h1>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}

          {filteredAdminItems.length > 0 && (
            <>
              <div className="my-4 border-t border-gray-800" />
              <p className="mb-2 px-3 text-xs font-semibold text-gray-500">
                ADMINISTRAÇÃO
              </p>
              {filteredAdminItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                )
              })}
            </>
          )}
        </nav>
      </ScrollArea>

      <div className="border-t border-gray-800 p-4">
        <div className="mb-3 text-sm">
          <p className="text-gray-400">Conectado como:</p>
          <p className="font-medium text-white">{userName}</p>
          <p className="text-xs text-gray-500">
            {userRole === 'ADMIN' && 'Administrador'}
            {userRole === 'FUNCIONARIO' && 'Funcionário'}
            {userRole === 'VISUALIZADOR' && 'Visualizador'}
          </p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  )
}
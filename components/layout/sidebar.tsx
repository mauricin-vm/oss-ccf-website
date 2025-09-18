'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Home,
  FileText,
  Calendar,
  Gavel,
  HandCoins,
  BarChart3,
  Users,
  LogOut,
  ChevronRight,
  Building2,
  Shield,
  Activity,
  Menu
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
  const [isCollapsed, setIsCollapsed] = useState(false)

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
    // {
    //   title: 'Configurações',
    //   href: '/admin/configuracoes',
    //   icon: Settings,
    //   roles: ['ADMIN']
    // }
  ]

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(userRole)
  )

  const filteredAdminItems = adminItems.filter(item => 
    item.roles.includes(userRole)
  )

  return (
    <div className={cn(
      "flex h-full flex-col bg-gray-900 transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="flex h-16 items-center justify-between border-b border-gray-800 px-4">
        {!isCollapsed && (
          <h1 className="text-xl font-bold text-white">CCF</h1>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-gray-400 hover:text-white hover:bg-gray-800 cursor-pointer"
        >
          <Menu className="h-4 w-4" />
        </Button>
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
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isCollapsed ? 'justify-center gap-0' : 'gap-3',
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <Icon className="h-4 w-4" />
                {!isCollapsed && (
                  <span className="transition-opacity duration-300">{item.title}</span>
                )}
              </Link>
            )
          })}

          {filteredAdminItems.length > 0 && (
            <>
              <div className="my-4 border-t border-gray-800" />
              {!isCollapsed && (
                <p className="mb-2 px-3 text-xs font-semibold text-gray-500 transition-opacity duration-300">
                  ADMINISTRAÇÃO
                </p>
              )}
              {filteredAdminItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isCollapsed ? 'justify-center gap-0' : 'gap-3',
                      isActive
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    )}
                    title={isCollapsed ? item.title : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {!isCollapsed && (
                      <span className="transition-opacity duration-300">{item.title}</span>
                    )}
                  </Link>
                )
              })}
            </>
          )}
        </nav>
      </ScrollArea>

      <div className="border-t border-gray-800 p-4">
        {!isCollapsed && (
          <div className="mb-3 text-sm transition-opacity duration-300">
            <p className="text-gray-400">Conectado como:</p>
            <p className="font-medium text-white">{userName}</p>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full text-gray-400 hover:bg-gray-800 hover:text-white cursor-pointer transition-all duration-300",
            isCollapsed ? "justify-center px-2" : "justify-start"
          )}
          onClick={() => signOut({ callbackUrl: '/login' })}
          title={isCollapsed ? 'Sair' : undefined}
        >
          <LogOut className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
          {!isCollapsed && (
            <span className="transition-opacity duration-300">Sair</span>
          )}
        </Button>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  Plus, 
  Search, 
  Users, 
  UserCheck, 
  UserX,
  Edit,
  Trash2,
  Calendar,
  Mail,
  Shield,
  Activity
} from 'lucide-react'
import { toast } from 'sonner'
import { SessionUser } from '@/types'

interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'FUNCIONARIO' | 'VISUALIZADOR'
  active: boolean
  createdAt: string
  updatedAt: string
  _count: {
    processosCreated: number
    tramitacoes: number
    logs: number
  }
}

interface UsersResponse {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

const roleLabels = {
  ADMIN: 'Administrador',
  FUNCIONARIO: 'Funcionário',
  VISUALIZADOR: 'Visualizador'
}

const roleColors = {
  ADMIN: 'bg-red-100 text-red-800',
  FUNCIONARIO: 'bg-blue-100 text-blue-800',
  VISUALIZADOR: 'bg-gray-100 text-gray-800'
}

export default function UsuariosAdminPage() {
  const { data: session, status } = useSession()
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    pages: 0
  })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'FUNCIONARIO' as 'ADMIN' | 'FUNCIONARIO' | 'VISUALIZADOR',
    active: true
  })

  // Verificar se é admin
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirect('/login')
    }
    const user = session.user as SessionUser
    if (user.role !== 'ADMIN') {
      redirect('/dashboard')
    }
  }, [session, status])

  // Carregar todos os usuários uma vez
  const loadAllUsers = useCallback(async () => {
    try {
      setLoading(true)
      // Buscar todos os usuários sem filtros
      const response = await fetch('/api/users?limit=1000')
      if (!response.ok) {
        throw new Error('Erro ao carregar usuários')
      }

      const data: UsersResponse = await response.json()
      setAllUsers(data.users)
    } catch (error) {
      toast.error('Erro ao carregar usuários')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAllUsers()
  }, [loadAllUsers])

  // Filtragem local (client-side)
  const filteredUsers = allUsers.filter((user) => {
    // Filtro por texto de busca
    const searchMatch = !search ||
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())

    // Filtro por role
    const roleMatch = roleFilter === 'all' || user.role === roleFilter

    // Filtro por status ativo
    const activeMatch = activeFilter === 'all' ||
      (activeFilter === 'true' && user.active) ||
      (activeFilter === 'false' && !user.active)

    return searchMatch && roleMatch && activeMatch
  })

  // Paginação local
  const totalFilteredUsers = filteredUsers.length
  const totalPages = Math.ceil(totalFilteredUsers / pagination.limit)
  const startIndex = (pagination.page - 1) * pagination.limit
  const endIndex = startIndex + pagination.limit
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  // Atualizar paginação quando filtros mudarem
  useEffect(() => {
    const newTotalPages = Math.ceil(filteredUsers.length / pagination.limit)
    setPagination(prev => ({
      ...prev,
      total: filteredUsers.length,
      pages: newTotalPages,
      page: 1 // Reset to first page when filters change
    }))
  }, [filteredUsers.length, pagination.limit])

  // Criar usuário
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar usuário')
      }

      toast.success('Usuário criado com sucesso')
      setShowCreateDialog(false)
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'FUNCIONARIO',
        active: true
      })
      loadAllUsers()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar usuário'
      toast.error(errorMessage)
    }
  }

  // Editar usuário
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    try {
      const updateData = { ...formData }
      if (!updateData.password) {
        delete (updateData as Record<string, unknown>).password
      }

      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar usuário')
      }

      toast.success('Usuário atualizado com sucesso')
      setShowEditDialog(false)
      setSelectedUser(null)
      loadAllUsers()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar usuário'
      toast.error(errorMessage)
    }
  }

  // Deletar usuário
  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Tem certeza que deseja deletar o usuário ${user.name}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao deletar usuário')
      }

      const result = await response.json()
      toast.success(result.message)
      loadAllUsers()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao deletar usuário'
      toast.error(errorMessage)
    }
  }

  // Abrir dialog de edição
  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role as 'ADMIN' | 'FUNCIONARIO' | 'VISUALIZADOR',
      active: user.active
    })
    setShowEditDialog(true)
  }

  if (status === 'loading' || loading) {
    return <div>Carregando...</div>
  }

  const stats = {
    total: filteredUsers.length,
    active: filteredUsers.filter(u => u.active).length,
    inactive: filteredUsers.filter(u => !u.active).length,
    admins: filteredUsers.filter(u => u.role === 'ADMIN').length
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
          <p className="text-gray-600">
            Administre usuários do sistema
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer">
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Preencha os dados do novo usuário
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Função</Label>
                <Select
                  value={formData.role || 'FUNCIONARIO'}
                  onValueChange={(value: 'ADMIN' | 'FUNCIONARIO' | 'VISUALIZADOR') => setFormData({...formData, role: value})}
                  defaultValue="FUNCIONARIO"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                    <SelectItem value="FUNCIONARIO">Funcionário</SelectItem>
                    <SelectItem value="VISUALIZADOR">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({...formData, active: checked})}
                />
                <Label htmlFor="active">Usuário ativo</Label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} className="cursor-pointer">
                  Cancelar
                </Button>
                <Button type="submit" className="cursor-pointer">
                  Criar Usuário
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Inativos</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <Shield className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.admins}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={roleFilter || 'all'} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas as funções" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                <SelectItem value="ADMIN">Administrador</SelectItem>
                <SelectItem value="FUNCIONARIO">Funcionário</SelectItem>
                <SelectItem value="VISUALIZADOR">Visualizador</SelectItem>
              </SelectContent>
            </Select>
            <Select value={activeFilter || 'all'} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Ativos</SelectItem>
                <SelectItem value="false">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>
            Lista de todos os usuários do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paginatedUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{user.name}</h3>
                      <Badge className={roleColors[user.role]}>
                        {roleLabels[user.role]}
                      </Badge>
                      <Badge variant={user.active ? "default" : "secondary"}>
                        {user.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        {user._count.processosCreated} processos
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(user)}
                    className="cursor-pointer"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteUser(user)}
                    className="text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-gray-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, totalFilteredUsers)} de {totalFilteredUsers} usuários
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page <= 1}
                  className="cursor-pointer"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= totalPages}
                  className="cursor-pointer"
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere os dados do usuário
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nova Senha (deixe em branco para manter a atual)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Função</Label>
              <Select
                value={formData.role || 'FUNCIONARIO'}
                onValueChange={(value: 'ADMIN' | 'FUNCIONARIO' | 'VISUALIZADOR') => setFormData({...formData, role: value})}
                defaultValue="FUNCIONARIO"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="FUNCIONARIO">Funcionário</SelectItem>
                  <SelectItem value="VISUALIZADOR">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({...formData, active: checked})}
              />
              <Label htmlFor="edit-active">Usuário ativo</Label>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)} className="cursor-pointer">
                Cancelar
              </Button>
              <Button type="submit" className="cursor-pointer">
                Atualizar Usuário
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
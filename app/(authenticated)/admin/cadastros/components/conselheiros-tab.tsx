'use client'

import { useState, useEffect } from 'react'
import { useForm, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Pagination } from '@/components/ui/pagination'
import {
  Plus,
  Search,
  UserCheck,
  Edit,
  Trash2,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  Check,
  X,
  Filter
} from 'lucide-react'
import { toast } from 'sonner'

interface Conselheiro {
  id: string
  nome: string
  email?: string
  telefone?: string
  cargo?: string
  origem?: string
  ativo: boolean
  createdAt: string
  updatedAt: string
}

// Schemas de validação
const createConselheiroSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  cargo: z.string().optional(),
  origem: z.string().optional(),
  ativo: z.boolean()
})

const editConselheiroSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  cargo: z.string().optional(),
  origem: z.string().optional(),
  ativo: z.boolean()
})

type CreateConselheiroInput = z.infer<typeof createConselheiroSchema>
type EditConselheiroInput = z.infer<typeof editConselheiroSchema>

export default function ConselheirosTab() {
  const [conselheiros, setConselheiros] = useState<Conselheiro[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedConselheiro, setSelectedConselheiro] = useState<Conselheiro | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(15)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Form para criar conselheiro
  const {
    register: createRegister,
    handleSubmit: handleCreateSubmit,
    formState: { errors: createErrors },
    reset: resetCreateForm,
    setValue: setCreateValue
  } = useForm<CreateConselheiroInput>({
    resolver: zodResolver(createConselheiroSchema),
    defaultValues: {
      nome: '',
      email: '',
      telefone: '',
      cargo: '',
      origem: '',
      ativo: true
    }
  })

  // Form para editar conselheiro
  const {
    register: editRegister,
    handleSubmit: handleEditSubmit,
    formState: { errors: editErrors },
    reset: resetEditForm,
    setValue: setEditValue
  } = useForm<EditConselheiroInput>({
    resolver: zodResolver(editConselheiroSchema)
  })

  // Carregar conselheiros
  const loadConselheiros = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/conselheiros?limit=1000')
      if (!response.ok) {
        throw new Error('Erro ao carregar conselheiros')
      }
      const data = await response.json()
      setConselheiros(data.conselheiros || [])
    } catch (error) {
      toast.error('Erro ao carregar conselheiros')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConselheiros()
  }, [])

  // Função para lidar com erros de validação do formulário de criar conselheiro
  const onCreateInvalid = (errors: FieldErrors<z.infer<typeof createConselheiroSchema>>) => {
    if (errors.nome?.message) {
      toast.warning(errors.nome.message)
      return
    }
    if (errors.email?.message) {
      toast.warning(errors.email.message)
      return
    }
  }

  // Criar conselheiro
  const handleCreateConselheiro = async (data: CreateConselheiroInput) => {
    setIsCreating(true)
    try {
      const response = await fetch('/api/conselheiros', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar conselheiro')
      }

      toast.success('Conselheiro criado com sucesso')
      setShowCreateDialog(false)
      resetCreateForm()
      loadConselheiros()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar conselheiro'
      toast.error(errorMessage)
    } finally {
      setIsCreating(false)
    }
  }

  // Função para lidar com erros de validação do formulário de editar conselheiro
  const onEditInvalid = (errors: FieldErrors<z.infer<typeof editConselheiroSchema>>) => {
    if (errors.nome?.message) {
      toast.warning(errors.nome.message)
      return
    }
    if (errors.email?.message) {
      toast.warning(errors.email.message)
      return
    }
  }

  // Editar conselheiro
  const handleEditConselheiro = async (data: EditConselheiroInput) => {
    if (!selectedConselheiro) return

    setIsEditing(true)
    try {
      const response = await fetch(`/api/conselheiros/${selectedConselheiro.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar conselheiro')
      }

      toast.success('Conselheiro atualizado com sucesso')
      setShowEditDialog(false)
      setSelectedConselheiro(null)
      loadConselheiros()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar conselheiro'
      toast.error(errorMessage)
    } finally {
      setIsEditing(false)
    }
  }

  // Deletar conselheiro
  const handleDeleteConselheiro = async (conselheiro: Conselheiro) => {
    if (!confirm(`Tem certeza que deseja deletar o conselheiro ${conselheiro.nome}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/conselheiros/${conselheiro.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao deletar conselheiro')
      }

      toast.success('Conselheiro deletado com sucesso')
      loadConselheiros()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao deletar conselheiro'
      toast.error(errorMessage)
    }
  }

  // Abrir dialog de edição
  const openEditDialog = (conselheiro: Conselheiro) => {
    setSelectedConselheiro(conselheiro)
    resetEditForm()
    setEditValue('nome', conselheiro.nome)
    setEditValue('email', conselheiro.email || '')
    setEditValue('telefone', conselheiro.telefone || '')
    setEditValue('cargo', conselheiro.cargo || '')
    setEditValue('origem', conselheiro.origem || '')
    setEditValue('ativo', conselheiro.ativo)
    setShowEditDialog(true)
  }

  const filteredConselheiros = conselheiros.filter(conselheiro =>
    conselheiro.nome.toLowerCase().includes(search.toLowerCase()) ||
    (conselheiro.email && conselheiro.email.toLowerCase().includes(search.toLowerCase())) ||
    (conselheiro.cargo && conselheiro.cargo.toLowerCase().includes(search.toLowerCase())) ||
    (conselheiro.origem && conselheiro.origem.toLowerCase().includes(search.toLowerCase()))
  )

  // Paginação local
  const totalFilteredConselheiros = filteredConselheiros.length
  const totalPages = Math.ceil(totalFilteredConselheiros / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedConselheiros = filteredConselheiros.slice(startIndex, endIndex)

  // Reset para primeira página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  if (loading) {
    return <div>Carregando conselheiros...</div>
  }

  const stats = {
    total: conselheiros.length,
    ativos: conselheiros.filter(c => c.ativo).length,
    inativos: conselheiros.filter(c => !c.ativo).length
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Gerenciar Conselheiros</h2>
          <p className="text-gray-600">
            Administre os conselheiros que fazem análise dos processos
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer">
              <Plus className="h-4 w-4 mr-2" />
              Novo Conselheiro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Conselheiro</DialogTitle>
              <DialogDescription>
                Preencha os dados do novo conselheiro
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit(handleCreateConselheiro, onCreateInvalid)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="create-nome">
                  Nome do Conselheiro <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-nome"
                  {...createRegister('nome')}
                  disabled={isCreating}
                  placeholder="Nome completo do conselheiro"
                  className={createErrors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  {...createRegister('email')}
                  disabled={isCreating}
                  placeholder="email@exemplo.com"
                  className={createErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-telefone">Telefone</Label>
                <Input
                  id="create-telefone"
                  {...createRegister('telefone')}
                  disabled={isCreating}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-cargo">Cargo</Label>
                <Input
                  id="create-cargo"
                  {...createRegister('cargo')}
                  disabled={isCreating}
                  placeholder="Ex: Conselheiro Titular, Conselheiro Suplente"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-origem">Origem (Setor/Órgão/Entidade)</Label>
                <Input
                  id="create-origem"
                  {...createRegister('origem')}
                  disabled={isCreating}
                  placeholder="Ex: Secretaria da Fazenda, OAB, Sindicato dos Contadores"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="create-ativo"
                  onCheckedChange={(checked) => setCreateValue('ativo', checked)}
                  defaultChecked={true}
                  disabled={isCreating}
                />
                <Label htmlFor="create-ativo">Conselheiro ativo</Label>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={isCreating}
                  className="cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="cursor-pointer"
                >
                  {isCreating ? 'Criando...' : 'Criar Conselheiro'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Conselheiros</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conselheiros Ativos</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.ativos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conselheiros Inativos</CardTitle>
            <X className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.inativos}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nome, email, cargo ou origem..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="cursor-pointer"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4 pt-4 border-t">
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch('')
                      toast.info('Filtros limpos')
                    }}
                    className="cursor-pointer"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Limpar Filtros
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Conselheiros */}
      <Card>
        <CardHeader>
          <CardTitle>Conselheiros Cadastrados</CardTitle>
          <CardDescription>
            {filteredConselheiros.length} de {conselheiros.length} conselheiros
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {totalFilteredConselheiros === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhum conselheiro encontrado
              </div>
            ) : (
              <>
                {paginatedConselheiros.map((conselheiro) => (
              <div key={conselheiro.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <UserCheck className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{conselheiro.nome}</h3>
                      <Badge variant={conselheiro.ativo ? "default" : "secondary"}>
                        {conselheiro.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {conselheiro.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {conselheiro.email}
                        </div>
                      )}
                      {conselheiro.telefone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {conselheiro.telefone}
                        </div>
                      )}
                      {conselheiro.cargo && (
                        <div className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {conselheiro.cargo}
                        </div>
                      )}
                      {conselheiro.origem && (
                        <div className="flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          {conselheiro.origem}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(conselheiro)}
                    className="cursor-pointer"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteConselheiro(conselheiro)}
                    className="text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
                ))}

                {/* Paginação */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalFilteredConselheiros}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Conselheiro</DialogTitle>
            <DialogDescription>
              Altere os dados do conselheiro
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit(handleEditConselheiro, onEditInvalid)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="edit-nome">
                Nome do Conselheiro <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-nome"
                {...editRegister('nome')}
                disabled={isEditing}
                placeholder="Nome completo do conselheiro"
                className={editErrors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                {...editRegister('email')}
                disabled={isEditing}
                placeholder="email@exemplo.com"
                className={editErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-telefone">Telefone</Label>
              <Input
                id="edit-telefone"
                {...editRegister('telefone')}
                disabled={isEditing}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cargo">Cargo</Label>
              <Input
                id="edit-cargo"
                {...editRegister('cargo')}
                disabled={isEditing}
                placeholder="Ex: Conselheiro Titular, Conselheiro Suplente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-origem">Origem (Setor/Órgão/Entidade)</Label>
              <Input
                id="edit-origem"
                {...editRegister('origem')}
                disabled={isEditing}
                placeholder="Ex: Secretaria da Fazenda, OAB, Sindicato dos Contadores"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-ativo"
                onCheckedChange={(checked) => setEditValue('ativo', checked)}
                disabled={isEditing}
              />
              <Label htmlFor="edit-ativo">Conselheiro ativo</Label>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={isEditing}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isEditing}
                className="cursor-pointer"
              >
                {isEditing ? 'Atualizando...' : 'Atualizar Conselheiro'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
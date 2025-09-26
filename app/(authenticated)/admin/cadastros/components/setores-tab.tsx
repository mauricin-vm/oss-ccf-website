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
import {
  Plus,
  Search,
  Building2,
  Edit,
  Trash2,
  Mail,
  User,
  Check,
  X,
  Filter
} from 'lucide-react'
import { toast } from 'sonner'

interface Setor {
  id: string
  nome: string
  sigla: string
  email?: string
  responsavel?: string
  ativo: boolean
  createdAt: string
  updatedAt: string
}

// Schemas de validação
const createSetorSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  sigla: z.string().min(2, 'Sigla deve ter pelo menos 2 caracteres').max(10, 'Sigla deve ter no máximo 10 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  responsavel: z.string().optional(),
  ativo: z.boolean()
})

const editSetorSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  sigla: z.string().min(2, 'Sigla deve ter pelo menos 2 caracteres').max(10, 'Sigla deve ter no máximo 10 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  responsavel: z.string().optional(),
  ativo: z.boolean()
})

type CreateSetorInput = z.infer<typeof createSetorSchema>
type EditSetorInput = z.infer<typeof editSetorSchema>

export default function SetoresTab() {
  const [setores, setSetores] = useState<Setor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedSetor, setSelectedSetor] = useState<Setor | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Form para criar setor
  const {
    register: createRegister,
    handleSubmit: handleCreateSubmit,
    formState: { errors: createErrors },
    reset: resetCreateForm,
    setValue: setCreateValue
  } = useForm<CreateSetorInput>({
    resolver: zodResolver(createSetorSchema),
    defaultValues: {
      nome: '',
      sigla: '',
      email: '',
      responsavel: '',
      ativo: true
    }
  })

  // Form para editar setor
  const {
    register: editRegister,
    handleSubmit: handleEditSubmit,
    formState: { errors: editErrors },
    reset: resetEditForm,
    setValue: setEditValue
  } = useForm<EditSetorInput>({
    resolver: zodResolver(editSetorSchema)
  })

  // Carregar setores
  const loadSetores = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/setores')
      if (!response.ok) {
        throw new Error('Erro ao carregar setores')
      }
      const data = await response.json()
      setSetores(data)
    } catch (error) {
      toast.error('Erro ao carregar setores')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSetores()
  }, [])

  // Função para lidar com erros de validação do formulário de criar setor
  const onCreateInvalid = (errors: FieldErrors<z.infer<typeof createSetorSchema>>) => {
    if (errors.nome?.message) {
      toast.warning(errors.nome.message)
      return
    }
    if (errors.sigla?.message) {
      toast.warning(errors.sigla.message)
      return
    }
    if (errors.email?.message) {
      toast.warning(errors.email.message)
      return
    }
  }

  // Criar setor
  const handleCreateSetor = async (data: CreateSetorInput) => {
    setIsCreating(true)
    try {
      const response = await fetch('/api/setores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar setor')
      }

      toast.success('Setor criado com sucesso')
      setShowCreateDialog(false)
      resetCreateForm()
      loadSetores()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar setor'
      toast.error(errorMessage)
    } finally {
      setIsCreating(false)
    }
  }

  // Função para lidar com erros de validação do formulário de editar setor
  const onEditInvalid = (errors: FieldErrors<z.infer<typeof editSetorSchema>>) => {
    if (errors.nome?.message) {
      toast.warning(errors.nome.message)
      return
    }
    if (errors.sigla?.message) {
      toast.warning(errors.sigla.message)
      return
    }
    if (errors.email?.message) {
      toast.warning(errors.email.message)
      return
    }
  }

  // Editar setor
  const handleEditSetor = async (data: EditSetorInput) => {
    if (!selectedSetor) return

    setIsEditing(true)
    try {
      const response = await fetch(`/api/setores/${selectedSetor.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atualizar setor')
      }

      toast.success('Setor atualizado com sucesso')
      setShowEditDialog(false)
      setSelectedSetor(null)
      loadSetores()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar setor'
      toast.error(errorMessage)
    } finally {
      setIsEditing(false)
    }
  }

  // Deletar setor
  const handleDeleteSetor = async (setor: Setor) => {
    if (!confirm(`Tem certeza que deseja deletar o setor ${setor.nome}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/setores/${setor.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao deletar setor')
      }

      toast.success('Setor deletado com sucesso')
      loadSetores()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao deletar setor'
      toast.error(errorMessage)
    }
  }

  // Abrir dialog de edição
  const openEditDialog = (setor: Setor) => {
    setSelectedSetor(setor)
    resetEditForm()
    setEditValue('nome', setor.nome)
    setEditValue('sigla', setor.sigla)
    setEditValue('email', setor.email || '')
    setEditValue('responsavel', setor.responsavel || '')
    setEditValue('ativo', setor.ativo)
    setShowEditDialog(true)
  }

  const filteredSetores = setores.filter(setor =>
    setor.nome.toLowerCase().includes(search.toLowerCase()) ||
    setor.sigla.toLowerCase().includes(search.toLowerCase()) ||
    (setor.responsavel && setor.responsavel.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) {
    return <div>Carregando setores...</div>
  }

  const stats = {
    total: setores.length,
    ativos: setores.filter(s => s.ativo).length,
    inativos: setores.filter(s => !s.ativo).length
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Gerenciar Setores</h2>
          <p className="text-gray-600">
            Administre departamentos e setores do sistema
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer">
              <Plus className="h-4 w-4 mr-2" />
              Novo Setor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Setor</DialogTitle>
              <DialogDescription>
                Preencha os dados do novo setor
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit(handleCreateSetor, onCreateInvalid)} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="create-nome">
                  Nome do Setor <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-nome"
                  {...createRegister('nome')}
                  disabled={isCreating}
                  placeholder="Nome completo do setor"
                  className={createErrors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-sigla">
                  Sigla <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-sigla"
                  {...createRegister('sigla', {
                    onChange: (e) => {
                      e.target.value = e.target.value.toUpperCase()
                    }
                  })}
                  disabled={isCreating}
                  placeholder="SIGLA"
                  maxLength={10}
                  className={createErrors.sigla ? 'border-red-500 focus-visible:ring-red-500' : ''}
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
                <Label htmlFor="create-responsavel">Responsável</Label>
                <Input
                  id="create-responsavel"
                  {...createRegister('responsavel')}
                  disabled={isCreating}
                  placeholder="Nome do responsável pelo setor"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="create-ativo"
                  onCheckedChange={(checked) => setCreateValue('ativo', checked)}
                  defaultChecked={true}
                  disabled={isCreating}
                />
                <Label htmlFor="create-ativo">Setor ativo</Label>
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
                  {isCreating ? 'Criando...' : 'Criar Setor'}
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
            <CardTitle className="text-sm font-medium">Total de Setores</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Setores Ativos</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.ativos}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Setores Inativos</CardTitle>
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
                    placeholder="Buscar por nome, sigla ou responsável..."
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

      {/* Lista de Setores */}
      <Card>
        <CardHeader>
          <CardTitle>Setores Cadastrados</CardTitle>
          <CardDescription>
            {filteredSetores.length} de {setores.length} setores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredSetores.map((setor) => (
              <div key={setor.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="font-bold text-blue-600 text-sm">
                      {setor.sigla}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{setor.nome}</h3>
                      <Badge variant={setor.ativo ? "default" : "secondary"}>
                        {setor.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {setor.sigla}
                      </div>
                      {setor.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {setor.email}
                        </div>
                      )}
                      {setor.responsavel && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {setor.responsavel}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(setor)}
                    className="cursor-pointer"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteSetor(setor)}
                    className="text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filteredSetores.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhum setor encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Setor</DialogTitle>
            <DialogDescription>
              Altere os dados do setor
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit(handleEditSetor, onEditInvalid)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="edit-nome">
                Nome do Setor <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-nome"
                {...editRegister('nome')}
                disabled={isEditing}
                placeholder="Nome completo do setor"
                className={editErrors.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sigla">
                Sigla <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-sigla"
                {...editRegister('sigla', {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase()
                  }
                })}
                disabled={isEditing}
                placeholder="SIGLA"
                maxLength={10}
                className={editErrors.sigla ? 'border-red-500 focus-visible:ring-red-500' : ''}
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
              <Label htmlFor="edit-responsavel">Responsável</Label>
              <Input
                id="edit-responsavel"
                {...editRegister('responsavel')}
                disabled={isEditing}
                placeholder="Nome do responsável pelo setor"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-ativo"
                onCheckedChange={(checked) => setEditValue('ativo', checked)}
                disabled={isEditing}
              />
              <Label htmlFor="edit-ativo">Setor ativo</Label>
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
                {isEditing ? 'Atualizando...' : 'Atualizar Setor'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
'use client'

import { useState, useEffect } from 'react'
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
  X
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

export default function SetoresTab() {
  const [setores, setSetores] = useState<Setor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedSetor, setSelectedSetor] = useState<Setor | null>(null)
  const [formData, setFormData] = useState({
    nome: '',
    sigla: '',
    email: '',
    responsavel: '',
    ativo: true
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

  // Criar setor
  const handleCreateSetor = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/setores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar setor')
      }

      toast.success('Setor criado com sucesso')
      setShowCreateDialog(false)
      setFormData({
        nome: '',
        sigla: '',
        email: '',
        responsavel: '',
        ativo: true
      })
      loadSetores()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar setor'
      toast.error(errorMessage)
    }
  }

  // Editar setor
  const handleEditSetor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSetor) return

    try {
      const response = await fetch(`/api/setores/${selectedSetor.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
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
    setFormData({
      nome: setor.nome,
      sigla: setor.sigla,
      email: setor.email || '',
      responsavel: setor.responsavel || '',
      ativo: setor.ativo
    })
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
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open) {
            setFormData({
              nome: '',
              sigla: '',
              email: '',
              responsavel: '',
              ativo: true
            })
          }
        }}>
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
            <form onSubmit={handleCreateSetor} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Setor <span className="text-red-500">*</span></Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sigla">Sigla <span className="text-red-500">*</span></Label>
                <Input
                  id="sigla"
                  value={formData.sigla}
                  onChange={(e) => setFormData({ ...formData, sigla: e.target.value.toUpperCase() })}
                  maxLength={10}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsavel">Responsável</Label>
                <Input
                  id="responsavel"
                  value={formData.responsavel}
                  onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label htmlFor="ativo">Setor ativo</Label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} className="cursor-pointer">
                  Cancelar
                </Button>
                <Button type="submit" className="cursor-pointer">
                  Criar Setor
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

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Setores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nome, sigla ou responsável..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
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
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open)
        if (!open) {
          setSelectedSetor(null)
          setFormData({
            nome: '',
            sigla: '',
            email: '',
            responsavel: '',
            ativo: true
          })
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Setor</DialogTitle>
            <DialogDescription>
              Altere os dados do setor
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSetor} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome do Setor <span className="text-red-500">*</span></Label>
              <Input
                id="edit-nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sigla">Sigla <span className="text-red-500">*</span></Label>
              <Input
                id="edit-sigla"
                value={formData.sigla}
                onChange={(e) => setFormData({ ...formData, sigla: e.target.value.toUpperCase() })}
                maxLength={10}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-responsavel">Responsável</Label>
              <Input
                id="edit-responsavel"
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label htmlFor="edit-ativo">Setor ativo</Label>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)} className="cursor-pointer">
                Cancelar
              </Button>
              <Button type="submit" className="cursor-pointer">
                Atualizar Setor
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
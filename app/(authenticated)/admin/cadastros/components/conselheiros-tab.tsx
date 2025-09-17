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
  UserCheck,
  Edit,
  Trash2,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  Check,
  X
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

export default function ConselheirosTab() {
  const [conselheiros, setConselheiros] = useState<Conselheiro[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedConselheiro, setSelectedConselheiro] = useState<Conselheiro | null>(null)
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cargo: '',
    origem: '',
    ativo: true
  })

  // Carregar conselheiros
  const loadConselheiros = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/conselheiros')
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

  // Criar conselheiro
  const handleCreateConselheiro = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/conselheiros', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar conselheiro')
      }

      toast.success('Conselheiro criado com sucesso')
      setShowCreateDialog(false)
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        cargo: '',
        origem: '',
        ativo: true
      })
      loadConselheiros()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao criar conselheiro'
      toast.error(errorMessage)
    }
  }

  // Editar conselheiro
  const handleEditConselheiro = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConselheiro) return

    try {
      const response = await fetch(`/api/conselheiros/${selectedConselheiro.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
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
    setFormData({
      nome: conselheiro.nome,
      email: conselheiro.email || '',
      telefone: conselheiro.telefone || '',
      cargo: conselheiro.cargo || '',
      origem: conselheiro.origem || '',
      ativo: conselheiro.ativo
    })
    setShowEditDialog(true)
  }

  const filteredConselheiros = conselheiros.filter(conselheiro =>
    conselheiro.nome.toLowerCase().includes(search.toLowerCase()) ||
    (conselheiro.email && conselheiro.email.toLowerCase().includes(search.toLowerCase())) ||
    (conselheiro.cargo && conselheiro.cargo.toLowerCase().includes(search.toLowerCase())) ||
    (conselheiro.origem && conselheiro.origem.toLowerCase().includes(search.toLowerCase()))
  )

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
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open) {
            setFormData({
              nome: '',
              email: '',
              telefone: '',
              cargo: '',
              origem: '',
              ativo: true
            })
          }
        }}>
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
            <form onSubmit={handleCreateConselheiro} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Conselheiro *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
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
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo</Label>
                <Input
                  id="cargo"
                  value={formData.cargo}
                  onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                  placeholder="Ex: Conselheiro Titular, Conselheiro Suplente"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="origem">Origem (Setor/Órgão/Entidade)</Label>
                <Input
                  id="origem"
                  value={formData.origem}
                  onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
                  placeholder="Ex: Secretaria da Fazenda, OAB, Sindicato dos Contadores"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
                <Label htmlFor="ativo">Conselheiro ativo</Label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} className="cursor-pointer">
                  Cancelar
                </Button>
                <Button type="submit" className="cursor-pointer">
                  Criar Conselheiro
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

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Conselheiros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nome, email, cargo ou origem..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
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
            {filteredConselheiros.map((conselheiro) => (
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
          </div>

          {filteredConselheiros.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhum conselheiro encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open)
        if (!open) {
          setSelectedConselheiro(null)
          setFormData({
            nome: '',
            email: '',
            telefone: '',
            cargo: '',
            origem: '',
            ativo: true
          })
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Conselheiro</DialogTitle>
            <DialogDescription>
              Altere os dados do conselheiro
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditConselheiro} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome do Conselheiro *</Label>
              <Input
                id="edit-nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
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
              <Label htmlFor="edit-telefone">Telefone</Label>
              <Input
                id="edit-telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cargo">Cargo</Label>
              <Input
                id="edit-cargo"
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                placeholder="Ex: Conselheiro Titular, Conselheiro Suplente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-origem">Origem (Setor/Órgão/Entidade)</Label>
              <Input
                id="edit-origem"
                value={formData.origem}
                onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
                placeholder="Ex: Secretaria da Fazenda, OAB, Sindicato dos Contadores"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label htmlFor="edit-ativo">Conselheiro ativo</Label>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)} className="cursor-pointer">
                Cancelar
              </Button>
              <Button type="submit" className="cursor-pointer">
                Atualizar Conselheiro
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
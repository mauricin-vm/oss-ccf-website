'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Plus, 
  Search, 
  ArrowRight, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Filter,
  Calendar,
  Building,
  X
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'
import { Tramitacao, Processo, Contribuinte, User } from '@prisma/client'

type TramitacaoWithRelations = Tramitacao & {
  processo: Processo & {
    contribuinte: Contribuinte
  }
  usuario: Pick<User, 'id' | 'name' | 'email' | 'role'>
}

export default function TramitacoesPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser
  
  const [tramitacoes, setTramitacoes] = useState<TramitacaoWithRelations[]>([])
  const [setores, setSetores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [setorFilter, setSetorFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/tramitacoes')
      if (response.ok) {
        const data = await response.json()
        setTramitacoes(data.tramitacoes || [])
        setSetores(data.setores || [])
      }
    } catch (error) {
      console.error('Erro ao carregar tramitações:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarcarRecebida = async (tramitacaoId: string) => {
    try {
      const response = await fetch(`/api/tramitacoes/${tramitacaoId}/receber`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        // Recarregar dados para mostrar a mudança
        loadData()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Erro ao marcar tramitação como recebida')
      }
    } catch (error) {
      console.error('Erro ao marcar tramitação como recebida:', error)
      alert('Erro ao marcar tramitação como recebida')
    }
  }

  const canCreate = user?.role === 'ADMIN' || user?.role === 'FUNCIONARIO'

  // Filtragem
  const filteredTramitacoes = tramitacoes.filter(tramitacao => {
    const matchesSearch = !searchTerm || 
      tramitacao.processo.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tramitacao.setorOrigem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tramitacao.setorDestino.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tramitacao.processo.contribuinte.nome.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'pendente' && !tramitacao.dataRecebimento) ||
      (statusFilter === 'recebida' && tramitacao.dataRecebimento) ||
      (statusFilter === 'atrasada' && tramitacao.prazoResposta && !tramitacao.dataRecebimento && new Date(tramitacao.prazoResposta) < new Date())

    const matchesSetor = setorFilter === 'all' || 
      tramitacao.setorOrigem === setorFilter || 
      tramitacao.setorDestino === setorFilter

    return matchesSearch && matchesStatus && matchesSetor
  })

  // Estatísticas
  const totalTramitacoes = filteredTramitacoes.length
  const pendentes = filteredTramitacoes.filter(t => !t.dataRecebimento).length
  const comPrazo = filteredTramitacoes.filter(t => 
    t.prazoResposta && !t.dataRecebimento && new Date(t.prazoResposta) > new Date()
  ).length
  const atrasadas = filteredTramitacoes.filter(t => 
    t.prazoResposta && !t.dataRecebimento && new Date(t.prazoResposta) < new Date()
  ).length

  const getStatusTramitacao = (tramitacao: TramitacaoWithRelations) => {
    if (tramitacao.dataRecebimento) {
      return { 
        label: 'Recebida', 
        color: 'bg-green-100 text-green-800',
        icon: CheckCircle
      }
    } else if (tramitacao.prazoResposta && new Date(tramitacao.prazoResposta) < new Date()) {
      return { 
        label: 'Atrasada', 
        color: 'bg-red-100 text-red-800',
        icon: AlertTriangle
      }
    } else {
      return { 
        label: 'Pendente', 
        color: 'bg-yellow-100 text-yellow-800',
        icon: Clock
      }
    }
  }

  const getDiasPrazo = (tramitacao: TramitacaoWithRelations) => {
    if (!tramitacao.prazoResposta || tramitacao.dataRecebimento) return null
    
    const hoje = new Date()
    const prazo = new Date(tramitacao.prazoResposta)
    const diffTime = prazo.getTime() - hoje.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tramitações</h1>
          <p className="text-gray-600">
            Controle o fluxo de processos entre setores
          </p>
        </div>
        
        {canCreate && (
          <Link href="/tramitacoes/nova">
            <Button className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              Nova Tramitação
            </Button>
          </Link>
        )}
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
                    placeholder="Buscar por processo, setor..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="recebida">Recebida</SelectItem>
                      <SelectItem value="atrasada">Atrasada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Setor</label>
                  <Select value={setorFilter} onValueChange={setSetorFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os setores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os setores</SelectItem>
                      {setores.map((setor) => (
                        <SelectItem key={setor.id} value={setor.sigla}>
                          {setor.sigla} - {setor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchTerm('')
                      setStatusFilter('all')
                      setSetorFilter('all')
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

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold">{totalTramitacoes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold">{pendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">No Prazo</p>
                <p className="text-2xl font-bold">{comPrazo}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Atrasadas</p>
                <p className="text-2xl font-bold">{atrasadas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Tramitações */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
              <span className="ml-2">Carregando tramitações...</span>
            </CardContent>
          </Card>
        ) : filteredTramitacoes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ArrowRight className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {tramitacoes.length === 0 ? 'Nenhuma tramitação encontrada' : 'Nenhuma tramitação corresponde aos filtros'}
              </h3>
              <p className="text-gray-600 mb-4">
                {tramitacoes.length === 0 ? 'Comece criando sua primeira tramitação.' : 'Tente ajustar os filtros ou criar uma nova tramitação.'}
              </p>
              {canCreate && (
                <Link href="/tramitacoes/nova">
                  <Button className="cursor-pointer">
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Tramitação
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredTramitacoes.map((tramitacao) => {
            const status = getStatusTramitacao(tramitacao)
            const diasPrazo = getDiasPrazo(tramitacao)
            const StatusIcon = status.icon

            return (
              <Card key={tramitacao.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      {/* Processo e Status */}
                      <div className="flex items-center gap-3">
                        <Link 
                          href={`/processos/${tramitacao.processo.id}`}
                          className="font-semibold text-lg hover:text-blue-600 transition-colors"
                        >
                          {tramitacao.processo.numero}
                        </Link>
                        <Badge className={status.color}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                        {diasPrazo !== null && (
                          <Badge variant="outline" className={
                            diasPrazo < 0 ? 'border-red-500 text-red-600' :
                            diasPrazo <= 3 ? 'border-orange-500 text-orange-600' :
                            'border-green-500 text-green-600'
                          }>
                            {diasPrazo < 0 ? `${Math.abs(diasPrazo)} dias atrasado` :
                             diasPrazo === 0 ? 'Vence hoje' :
                             `${diasPrazo} dias restantes`}
                          </Badge>
                        )}
                      </div>

                      {/* Fluxo de Tramitação */}
                      <div className="flex items-center gap-2 text-gray-600">
                        <Building className="h-4 w-4" />
                        <span className="font-medium">{tramitacao.setorOrigem}</span>
                        <ArrowRight className="h-4 w-4" />
                        <span className="font-medium">{tramitacao.setorDestino}</span>
                      </div>

                      {/* Contribuinte */}
                      <p className="text-sm text-gray-600">
                        <strong>Contribuinte:</strong> {tramitacao.processo.contribuinte.nome}
                      </p>

                      {/* Observações */}
                      {tramitacao.observacoes && (
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                          {tramitacao.observacoes}
                        </p>
                      )}

                      {/* Informações de Data e Usuário */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Enviado: {new Date(tramitacao.dataEnvio).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {tramitacao.prazoResposta && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>Prazo: {new Date(tramitacao.prazoResposta).toLocaleDateString('pt-BR')}</span>
                          </div>
                        )}
                        <div>
                          <span>Por: {tramitacao.usuario.name}</span>
                        </div>
                      </div>

                      {tramitacao.dataRecebimento && (
                        <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                          ✓ Recebido em {new Date(tramitacao.dataRecebimento).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>
                    
                    {/* Ações */}
                    <div className="flex gap-2 ml-4">
                      <Link href={`/processos/${tramitacao.processo.id}`}>
                        <Button variant="outline" size="sm" className="cursor-pointer">
                          Ver Processo
                        </Button>
                      </Link>
                      {!tramitacao.dataRecebimento && canCreate && (
                        <Button 
                          size="sm" 
                          variant="default" 
                          className="cursor-pointer"
                          onClick={() => handleMarcarRecebida(tramitacao.id)}
                        >
                          Marcar Recebida
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Lista de Setores para Referência */}
      <Card>
        <CardHeader>
          <CardTitle>Setores Ativos</CardTitle>
          <CardDescription>
            Setores disponíveis para tramitação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {setores.map((setor) => (
              <div key={setor.id} className="flex items-center gap-2 p-3 border rounded-lg">
                <Building className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="font-medium text-sm">{setor.sigla}</p>
                  <p className="text-xs text-gray-600">{setor.nome}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
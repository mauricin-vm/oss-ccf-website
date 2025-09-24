'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import {
  Plus,
  Search,
  FileText,
  Calendar,
  User,
  DollarSign,
  Filter,
  X
} from 'lucide-react'
import Link from 'next/link'
import { SessionUser } from '@/types'
import { getStatusInfo } from '@/lib/constants/status'
import { getTipoProcessoInfo } from '@/lib/constants/tipos-processo'
import { toast } from 'sonner'

interface Processo {
  id: string
  numero: string
  tipo: 'COMPENSACAO' | 'DACAO_PAGAMENTO' | 'TRANSACAO_EXCEPCIONAL'
  status: string
  dataAbertura: string
  observacoes?: string
  contribuinte: {
    nome: string
  }
  tramitacoes: Array<{
    id: string
    createdAt: string
  }>
}

export default function ProcessosPage() {
  const { data: session } = useSession()
  const user = session?.user as SessionUser
  
  const [processos, setProcessos] = useState<Processo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tipoFilter, setTipoFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(15)

  // Carregamento inicial - buscar todos os processos
  useEffect(() => {
    loadAllProcessos()
  }, [])

  const loadAllProcessos = async () => {
    try {
      setLoading(true)
      
      // Buscar todos os processos sem filtros
      const response = await fetch('/api/processos?limit=1000', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error('Erro ao carregar processos')
      }
      
      const data = await response.json()
      
      // Mapear os dados para o formato esperado
      const processosFormatados = data.processos.map((processo: {
        id: string;
        numero: string;
        tipo: 'COMPENSACAO' | 'DACAO_PAGAMENTO' | 'TRANSACAO_EXCEPCIONAL';
        status: string;
        createdAt: string;
        observacoes?: string;
        contribuinte: { nome: string };
        tramitacoes: Array<{ id: string; createdAt: string }>;
      }) => ({
        id: processo.id,
        numero: processo.numero,
        tipo: processo.tipo,
        status: processo.status,
        dataAbertura: processo.createdAt,
        observacoes: processo.observacoes,
        contribuinte: { nome: processo.contribuinte.nome },
        tramitacoes: processo.tramitacoes
      }))
      
      setProcessos(processosFormatados)
    } catch (error) {
      console.error('Erro ao carregar processos:', error)
      toast.error('Erro ao carregar a lista de processos')
      setProcessos([])
    } finally {
      setLoading(false)
    }
  }

  // Filtragem local (client-side)
  const filteredProcessos = processos.filter((processo) => {
    // Filtro por texto de busca
    const searchMatch = !searchTerm ||
      processo.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      processo.contribuinte.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (processo.observacoes && processo.observacoes.toLowerCase().includes(searchTerm.toLowerCase()))

    // Filtro por status
    const statusMatch = statusFilter === 'all' || processo.status === statusFilter

    // Filtro por tipo
    const tipoMatch = tipoFilter === 'all' || processo.tipo === tipoFilter

    return searchMatch && statusMatch && tipoMatch
  })

  // Paginação local
  const totalFilteredProcessos = filteredProcessos.length
  const totalPages = Math.ceil(totalFilteredProcessos / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProcessos = filteredProcessos.slice(startIndex, endIndex)

  // Reset para primeira página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, tipoFilter])



  const canCreate = user?.role === 'ADMIN' || user?.role === 'FUNCIONARIO'

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Processos</h1>
          <p className="text-gray-600">
            Gerencie todos os processos da Câmara de Conciliação Fiscal
          </p>
        </div>
        
        {canCreate && (
          <Link href="/processos/novo">
            <Button className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4" />
              Novo Processo
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
                    placeholder="Buscar por número, contribuinte..."
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
                      <SelectItem value="RECEPCIONADO">Recepcionado</SelectItem>
                      <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
                      <SelectItem value="SUSPENSO">Suspenso</SelectItem>
                      <SelectItem value="PEDIDO_VISTA">Pedido de Vista</SelectItem>
                      <SelectItem value="PEDIDO_DILIGENCIA">Pedido de Diligência</SelectItem>
                      <SelectItem value="EM_PAUTA">Em Pauta</SelectItem>
                      <SelectItem value="JULGADO">Julgado</SelectItem>
                      <SelectItem value="EM_CUMPRIMENTO">Em Cumprimento</SelectItem>
                      <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo</label>
                  <Select value={tipoFilter} onValueChange={setTipoFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="COMPENSACAO">Compensação</SelectItem>
                      <SelectItem value="DACAO_PAGAMENTO">Dação em Pagamento</SelectItem>
                      <SelectItem value="TRANSACAO_EXCEPCIONAL">Transação Excepcional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('')
                      setStatusFilter('all')
                      setTipoFilter('all')
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

      {/* Estatísticas Rápidas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold">{totalFilteredProcessos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Em Análise</p>
                <p className="text-2xl font-bold">
                  {filteredProcessos.filter(p => p.status === 'EM_ANALISE').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Em Pauta</p>
                <p className="text-2xl font-bold">
                  {filteredProcessos.filter(p => p.status === 'EM_PAUTA').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Finalizados</p>
                <p className="text-2xl font-bold">
                  {filteredProcessos.filter(p => p.status === 'FINALIZADO').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Processos */}
      <Card>
        <CardHeader>
          <CardTitle>Processos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {totalFilteredProcessos === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {processos.length === 0 ? 'Nenhum processo encontrado' : 'Nenhum processo corresponde aos filtros'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {processos.length === 0 ? 'Comece criando seu primeiro processo.' : 'Tente ajustar os filtros ou criar um novo processo.'}
                </p>
                {canCreate && (
                  <Link href="/processos/novo">
                    <Button className="cursor-pointer">
                      <Plus className="mr-2 h-4 w-4" />
                      Criar Processo
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                {paginatedProcessos.map((processo) => (
                  <Card key={processo.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{processo.numero}</h3>
                            <Badge className={getTipoProcessoInfo(processo.tipo).color}>
                              {getTipoProcessoInfo(processo.tipo).label}
                            </Badge>
                            <Badge className={getStatusInfo(processo.status).color}>
                              {getStatusInfo(processo.status).label}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>{processo.contribuinte.nome}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(processo.dataAbertura).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>

                          {processo.observacoes && (
                            <p className="text-sm text-gray-700 mt-2">
                              {processo.observacoes}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Link href={`/processos/${processo.id}`}>
                            <Button variant="outline" size="sm" className="cursor-pointer">
                              Ver Detalhes
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Paginação */}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalFilteredProcessos}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
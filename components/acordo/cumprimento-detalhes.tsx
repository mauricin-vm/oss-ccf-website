'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Check, Clock, AlertCircle, FileText, DollarSign, Building, CreditCard } from 'lucide-react'

interface AcordoDetalhe {
  id: string
  tipo: string
  descricao: string
  valorOriginal: number
  valorNegociado: number
  status: string
  dataExecucao?: string
  observacoes?: string
  inscricoes?: Array<{
    id: string
    numeroInscricao: string
    tipoInscricao: string
    valorDebito: number
    valorAbatido: number
    situacao: string
  }>
}

interface CumprimentoDetalhesProps {
  acordoId: string
  detalhes: AcordoDetalhe[]
  onStatusUpdate: (detalheId: string, novoStatus: string, observacoes?: string) => void
}

export default function CumprimentoDetalhes({
  acordoId,
  detalhes,
  onStatusUpdate
}: CumprimentoDetalhesProps) {
  const [observacoes, setObservacoes] = useState<{ [key: string]: string }>({})

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CONCLUIDO':
        return <Check className="h-4 w-4 text-green-600" />
      case 'EM_ANDAMENTO':
        return <Clock className="h-4 w-4 text-blue-600" />
      case 'PENDENTE':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'CONCLUIDO':
        return 'Concluído'
      case 'EM_ANDAMENTO':
        return 'Em Andamento'
      case 'PENDENTE':
        return 'Pendente'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONCLUIDO':
        return 'bg-green-100 text-green-800'
      case 'EM_ANDAMENTO':
        return 'bg-blue-100 text-blue-800'
      case 'PENDENTE':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'transacao':
        return <FileText className="h-5 w-5" />
      case 'compensacao':
        return <DollarSign className="h-5 w-5" />
      case 'dacao':
        return <Building className="h-5 w-5" />
      default:
        return <CreditCard className="h-5 w-5" />
    }
  }

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'transacao':
        return 'Transação Excepcional'
      case 'compensacao':
        return 'Compensação'
      case 'dacao':
        return 'Dação em Pagamento'
      default:
        return tipo
    }
  }

  const handleStatusChange = (detalheId: string, novoStatus: string) => {
    const obs = observacoes[detalheId] || ''
    onStatusUpdate(detalheId, novoStatus, obs)
  }

  const updateObservacoes = (detalheId: string, valor: string) => {
    setObservacoes(prev => ({
      ...prev,
      [detalheId]: valor
    }))
  }

  if (!detalhes || detalhes.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Detalhes do Cumprimento do Acordo</CardTitle>
          <CardDescription>
            Acompanhe o progresso das ações específicas deste acordo
          </CardDescription>
        </CardHeader>
      </Card>

      {detalhes.map((detalhe) => (
        <Card key={detalhe.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTipoIcon(detalhe.tipo)}
              {getTipoLabel(detalhe.tipo)}
            </CardTitle>
            <CardDescription>{detalhe.descricao}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Status atual */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(detalhe.status)}
                  <span className="font-medium">Status:</span>
                  <Badge className={getStatusColor(detalhe.status)}>
                    {getStatusLabel(detalhe.status)}
                  </Badge>
                </div>
                {detalhe.dataExecucao && (
                  <span className="text-sm text-gray-500">
                    Executado em: {new Date(detalhe.dataExecucao).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>

              {/* Valores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <span className="text-sm text-blue-600">Valor Original</span>
                  <p className="font-bold text-blue-800">
                    R$ {detalhe.valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <span className="text-sm text-green-600">Valor Negociado</span>
                  <p className="font-bold text-green-800">
                    R$ {detalhe.valorNegociado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Lista de inscrições, se houver */}
              {detalhe.inscricoes && detalhe.inscricoes.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2">Inscrições Envolvidas:</h5>
                  <div className="space-y-2">
                    {detalhe.inscricoes.map((inscricao) => (
                      <div key={inscricao.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <span className="font-medium">Inscrição {inscricao.numeroInscricao}</span>
                          <Badge variant="outline" className="ml-2">
                            {inscricao.tipoInscricao === 'imobiliaria' ? 'Imobiliária' : 'Econômica'}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">
                            Débito: R$ {inscricao.valorDebito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-sm text-green-600">
                            Abatido: R$ {inscricao.valorAbatido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <Badge className={inscricao.situacao === 'quitado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {inscricao.situacao === 'quitado' ? 'Quitado' : 'Pendente'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observações atuais */}
              {detalhe.observacoes && (
                <div>
                  <Label className="text-sm font-medium">Observações:</Label>
                  <p className="text-sm text-gray-600 mt-1">{detalhe.observacoes}</p>
                </div>
              )}

              {/* Ações de controle de status */}
              {detalhe.status !== 'CONCLUIDO' && (
                <div className="border-t pt-4">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor={`obs-${detalhe.id}`}>Observações sobre o progresso:</Label>
                      <Textarea
                        id={`obs-${detalhe.id}`}
                        placeholder="Adicione observações sobre o andamento..."
                        value={observacoes[detalhe.id] || ''}
                        onChange={(e) => updateObservacoes(detalhe.id, e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2">
                      {detalhe.status === 'PENDENTE' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(detalhe.id, 'EM_ANDAMENTO')}
                        >
                          Iniciar Execução
                        </Button>
                      )}

                      {detalhe.status === 'EM_ANDAMENTO' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleStatusChange(detalhe.id, 'CONCLUIDO')}
                        >
                          Marcar como Concluído
                        </Button>
                      )}

                      {detalhe.status === 'EM_ANDAMENTO' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(detalhe.id, 'PENDENTE')}
                        >
                          Retornar para Pendente
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
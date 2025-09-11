'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Loader2, AlertCircle, Gavel, FileText, User, Building } from 'lucide-react'

const decisaoSchema = z.object({
  processoId: z.string().min(1, 'Processo é obrigatório'),
  tipo: z.enum(['deferido', 'indeferido', 'parcial'], {
    required_error: 'Tipo de decisão é obrigatório'
  }),
  descricao: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  observacoes: z.string().optional()
})

type DecisaoInput = z.infer<typeof decisaoSchema>

interface DecisaoFormProps {
  sessaoId: string
  onSuccess?: () => void
}

interface Processo {
  id: string
  numero: string
  tipo: string
  valor: number
  status: string
  contribuinte: {
    nome: string
    documento: string
    email: string
  }
  tramitacoes: Array<{
    id: string
    setor: string
    status: string
    observacoes: string
    prazo: Date
    createdAt: Date
  }>
}

interface ProcessoPauta {
  ordem: number
  relator: string
  processo: Processo
}

export default function DecisaoForm({ sessaoId, onSuccess }: DecisaoFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [processos, setProcessos] = useState<ProcessoPauta[]>([])
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoPauta | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<DecisaoInput>({
    resolver: zodResolver(decisaoSchema),
    defaultValues: {
      tipo: 'deferido'
    }
  })

  // Buscar processos da sessão que ainda não foram julgados
  useEffect(() => {
    const fetchProcessos = async () => {
      try {
        const response = await fetch(`/api/sessoes/${sessaoId}`)
        if (response.ok) {
          const sessao = await response.json()
          
          // Filtrar processos que ainda não foram julgados
          const processosNaoJulgados = sessao.pauta.processos.filter(
            (p: ProcessoPauta) => !sessao.decisoes.some(
              (d: { processoId: string }) => d.processoId === p.processo.id
            )
          )
          
          setProcessos(processosNaoJulgados)
          
          // Se processo foi especificado na URL, selecionar automaticamente
          const processoIdFromUrl = searchParams.get('processo')
          if (processoIdFromUrl) {
            const processo = processosNaoJulgados.find(
              p => p.processo.id === processoIdFromUrl
            )
            if (processo) {
              setSelectedProcesso(processo)
              setValue('processoId', processo.processo.id)
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar processos:', error)
      }
    }

    fetchProcessos()
  }, [sessaoId, searchParams, setValue])

  const onSubmit = async (data: DecisaoInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/sessoes/${sessaoId}/decisoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao registrar decisão')
      }

      await response.json()
      
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/dashboard/sessoes/${sessaoId}`)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectProcesso = (processo: ProcessoPauta) => {
    setSelectedProcesso(processo)
    setValue('processoId', processo.processo.id)
  }

  const getTipoProcessoLabel = (tipo: string) => {
    switch (tipo) {
      case 'compensacao': return 'Compensação'
      case 'dacao': return 'Dação em Pagamento'
      case 'transacao': return 'Transação Excepcional'
      default: return tipo
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'EM_PAUTA': return 'bg-blue-100 text-blue-800'
      case 'EM_ANALISE': return 'bg-yellow-100 text-yellow-800'
      case 'AGUARDANDO_DOCUMENTOS': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Seleção de Processo */}
      <Card>
        <CardHeader>
          <CardTitle>Processo para Julgamento</CardTitle>
          <CardDescription>
            Selecione o processo que será julgado nesta decisão
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedProcesso ? (
            <div className="space-y-3">
              {processos.length === 0 ? (
                <div className="text-center py-8">
                  <Gavel className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Todos os processos foram julgados
                  </h3>
                  <p className="text-gray-600">
                    Não há mais processos pendentes para julgamento nesta sessão.
                  </p>
                </div>
              ) : (
                processos.map((processoPauta) => (
                  <div
                    key={processoPauta.processo.id}
                    onClick={() => handleSelectProcesso(processoPauta)}
                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-bold">
                          {processoPauta.ordem}
                        </span>
                        <div>
                          <p className="font-medium">{processoPauta.processo.numero}</p>
                          <p className="text-sm text-gray-600">{processoPauta.processo.contribuinte.nome}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">
                              {getTipoProcessoLabel(processoPauta.processo.tipo)}
                            </Badge>
                            <Badge className={getStatusColor(processoPauta.processo.status)}>
                              {processoPauta.processo.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          R$ {processoPauta.processo.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        {processoPauta.relator && (
                          <p className="text-xs text-blue-600">Relator: {processoPauta.relator}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-bold">
                    {selectedProcesso.ordem}
                  </span>
                  <div>
                    <h4 className="font-medium text-blue-900">{selectedProcesso.processo.numero}</h4>
                    <p className="text-sm text-blue-700">{selectedProcesso.processo.contribuinte.nome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {getTipoProcessoLabel(selectedProcesso.processo.tipo)}
                      </Badge>
                      <span className="text-sm text-blue-700">
                        R$ {selectedProcesso.processo.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProcesso(null)
                    setValue('processoId', '')
                  }}
                >
                  Alterar
                </Button>
              </div>

              {/* Detalhes do Contribuinte */}
              <div className="mt-4 p-3 bg-white rounded border">
                <h5 className="text-sm font-medium text-blue-900 mb-2">Dados do Contribuinte:</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>{selectedProcesso.processo.contribuinte.nome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span>{selectedProcesso.processo.contribuinte.documento}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span>{selectedProcesso.processo.contribuinte.email}</span>
                  </div>
                </div>
              </div>

              {/* Última Tramitação */}
              {selectedProcesso.processo.tramitacoes.length > 0 && (
                <div className="mt-4 p-3 bg-white rounded border">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">Última Tramitação:</h5>
                  <div className="text-sm text-gray-700">
                    <p><strong>Setor:</strong> {selectedProcesso.processo.tramitacoes[0].setor}</p>
                    <p><strong>Status:</strong> {selectedProcesso.processo.tramitacoes[0].status}</p>
                    {selectedProcesso.processo.tramitacoes[0].observacoes && (
                      <p><strong>Observações:</strong> {selectedProcesso.processo.tramitacoes[0].observacoes}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {errors.processoId && (
            <p className="text-sm text-red-500">{errors.processoId.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Decisão */}
      {selectedProcesso && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Decisão</CardTitle>
              <CardDescription>
                Selecione o resultado do julgamento do processo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={watch('tipo')}
                onValueChange={(value) => setValue('tipo', value as 'deferido' | 'indeferido' | 'parcial')}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <div className="flex items-center space-x-2 p-4 border rounded-lg">
                  <RadioGroupItem value="deferido" id="deferido" />
                  <div className="space-y-1">
                    <Label htmlFor="deferido" className="font-medium text-green-700">Deferido</Label>
                    <p className="text-sm text-gray-600">Pedido aprovado integralmente</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg">
                  <RadioGroupItem value="indeferido" id="indeferido" />
                  <div className="space-y-1">
                    <Label htmlFor="indeferido" className="font-medium text-red-700">Indeferido</Label>
                    <p className="text-sm text-gray-600">Pedido rejeitado</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-4 border rounded-lg">
                  <RadioGroupItem value="parcial" id="parcial" />
                  <div className="space-y-1">
                    <Label htmlFor="parcial" className="font-medium text-yellow-700">Parcial</Label>
                    <p className="text-sm text-gray-600">Aprovado com condições</p>
                  </div>
                </div>
              </RadioGroup>
              {errors.tipo && (
                <p className="text-sm text-red-500 mt-2">{errors.tipo.message}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fundamentação da Decisão</CardTitle>
              <CardDescription>
                Descreva os motivos e fundamentos da decisão tomada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição da Decisão *</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva os fundamentos jurídicos, análise dos documentos e motivos da decisão..."
                  rows={6}
                  {...register('descricao')}
                  disabled={isLoading}
                />
                {errors.descricao && (
                  <p className="text-sm text-red-500">{errors.descricao.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações Adicionais</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações complementares, recomendações ou orientações..."
                  rows={3}
                  {...register('observacoes')}
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500">
                  Campo opcional para informações complementares
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Resumo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resumo da Decisão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Processo:</span>
                  <span className="font-medium">{selectedProcesso.processo.numero}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Contribuinte:</span>
                  <span className="font-medium">{selectedProcesso.processo.contribuinte.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo:</span>
                  <span className="font-medium">{getTipoProcessoLabel(selectedProcesso.processo.tipo)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor:</span>
                  <span className="font-medium">
                    R$ {selectedProcesso.processo.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Decisão:</span>
                  <Badge 
                    className={
                      watch('tipo') === 'deferido' ? 'bg-green-100 text-green-800' :
                      watch('tipo') === 'indeferido' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {watch('tipo') === 'deferido' ? 'Deferido' :
                     watch('tipo') === 'indeferido' ? 'Indeferido' :
                     'Parcial'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botões de Ação */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !selectedProcesso}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <Gavel className="mr-2 h-4 w-4" />
                  Registrar Decisão
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
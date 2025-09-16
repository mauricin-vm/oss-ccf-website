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
import { Loader2, AlertCircle, Gavel, FileText, User, Building, Clock, Pause, Search, CheckCircle } from 'lucide-react'

const votoSchema = z.object({
  tipoVoto: z.enum(['RELATOR', 'REVISOR', 'CONSELHEIRO']),
  nomeVotante: z.string().min(1, 'Nome do votante é obrigatório'),
  conselheiroId: z.string().optional(),
  textoVoto: z.string().optional(),
  posicaoVoto: z.enum(['DEFERIDO', 'INDEFERIDO', 'PARCIAL']).optional(),
  acompanhaVoto: z.string().optional(),
  ordemApresentacao: z.number().optional(),
  isPresidente: z.boolean().optional()
})

const decisaoSchema = z.object({
  processoId: z.string().min(1, 'Processo é obrigatório'),
  tipoResultado: z.enum(['SUSPENSO', 'PEDIDO_VISTA', 'PEDIDO_DILIGENCIA', 'JULGADO'], {
    required_error: 'Tipo de resultado é obrigatório'
  }),
  // Para JULGADO
  tipoDecisao: z.enum(['DEFERIDO', 'INDEFERIDO', 'PARCIAL']).optional(),
  // Para todos
  fundamentacao: z.string().min(10, 'Fundamentação deve ter pelo menos 10 caracteres'),
  // Para SUSPENSO
  motivoSuspensao: z.string().optional(),
  // Para PEDIDO_VISTA
  conselheiroPedidoVista: z.string().optional(),
  prazoVista: z.string().optional(),
  // Para PEDIDO_DILIGENCIA
  especificacaoDiligencia: z.string().optional(),
  prazoDiligencia: z.string().optional(),
  // Para acordos
  definirAcordo: z.boolean().optional(),
  tipoAcordo: z.enum(['aceita_proposta', 'contra_proposta', 'sem_acordo']).optional(),
  // Texto da ata específico do processo
  ataTexto: z.string().optional(),
  // Votos
  votos: z.array(votoSchema).optional()
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
      tipoResultado: 'JULGADO',
      tipoDecisao: 'DEFERIDO',
      definirAcordo: false
    }
  })

  // Buscar dados da sessão
  useEffect(() => {
    const fetchDados = async () => {
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
          setConselheiros(sessao.conselheiros || [])

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
        console.error('Erro ao buscar dados da sessão:', error)
      }
    }

    fetchDados()
  }, [sessaoId, searchParams, setValue])

  const onSubmit = async (data: DecisaoInput) => {
    setIsLoading(true)
    setError(null)

    try {
      // Adicionar votos ao payload se houver
      const payload = {
        ...data,
        votos: votos.length > 0 ? votos : undefined
      }

      const response = await fetch(`/api/sessoes/${sessaoId}/decisoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao registrar decisão')
      }

      await response.json()

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/sessoes/${sessaoId}`)
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
      case 'COMPENSACAO': return 'Compensação'
      case 'DACAO_PAGAMENTO': return 'Dação em Pagamento'
      case 'TRANSACAO_EXCEPCIONAL': return 'Transação Excepcional'
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




  const tipoResultado = watch('tipoResultado')


  const getTipoResultadoColor = (tipo: string) => {
    switch (tipo) {
      case 'SUSPENSO': return 'border-yellow-200 bg-yellow-50'
      case 'PEDIDO_VISTA': return 'border-blue-200 bg-blue-50'
      case 'PEDIDO_DILIGENCIA': return 'border-orange-200 bg-orange-50'
      case 'JULGADO': return 'border-green-200 bg-green-50'
      default: return 'border-gray-200 bg-gray-50'
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

      {/* Tipo de Resultado do Julgamento */}
      {selectedProcesso && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Resultado</CardTitle>
              <CardDescription>
                Selecione o resultado do julgamento do processo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={tipoResultado}
                onValueChange={(value) => setValue('tipoResultado', value as 'SUSPENSO' | 'PEDIDO_VISTA' | 'PEDIDO_DILIGENCIA' | 'JULGADO')}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer ${tipoResultado === 'SUSPENSO' ? getTipoResultadoColor('SUSPENSO') : 'border-gray-200'}`}>
                  <RadioGroupItem value="SUSPENSO" id="suspenso" className="mt-1" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Pause className="h-4 w-4 text-yellow-600" />
                      <Label htmlFor="suspenso" className="font-medium text-yellow-700">Suspenso</Label>
                    </div>
                    <p className="text-sm text-gray-600">
                      Processo retirado de pauta por motivo específico
                    </p>
                  </div>
                </div>

                <div className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer ${tipoResultado === 'PEDIDO_VISTA' ? getTipoResultadoColor('PEDIDO_VISTA') : 'border-gray-200'}`}>
                  <RadioGroupItem value="PEDIDO_VISTA" id="pedido-vista" className="mt-1" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-blue-600" />
                      <Label htmlFor="pedido-vista" className="font-medium text-blue-700">Pedido de Vista</Label>
                    </div>
                    <p className="text-sm text-gray-600">
                      Conselheiro solicita análise adicional do processo
                    </p>
                  </div>
                </div>

                <div className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer ${tipoResultado === 'PEDIDO_DILIGENCIA' ? getTipoResultadoColor('PEDIDO_DILIGENCIA') : 'border-gray-200'}`}>
                  <RadioGroupItem value="PEDIDO_DILIGENCIA" id="pedido-diligencia" className="mt-1" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-600" />
                      <Label htmlFor="pedido-diligencia" className="font-medium text-orange-700">Pedido de Diligência</Label>
                    </div>
                    <p className="text-sm text-gray-600">
                      Relator solicita nova documentação ou análise
                    </p>
                  </div>
                </div>

                <div className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer ${tipoResultado === 'JULGADO' ? getTipoResultadoColor('JULGADO') : 'border-gray-200'}`}>
                  <RadioGroupItem value="JULGADO" id="julgado" className="mt-1" />
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <Label htmlFor="julgado" className="font-medium text-green-700">Julgado</Label>
                    </div>
                    <p className="text-sm text-gray-600">
                      Decisão final com votação dos conselheiros
                    </p>
                  </div>
                </div>
              </RadioGroup>
              {errors.tipoResultado && (
                <p className="text-sm text-red-500 mt-2">{errors.tipoResultado.message}</p>
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
                  {...register('fundamentacao')}
                  disabled={isLoading}
                />
                {errors.fundamentacao && (
                  <p className="text-sm text-red-500">{errors.fundamentacao.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações Adicionais</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações complementares, recomendações ou orientações..."
                  rows={3}
                  {...register('ataTexto')}
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
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, AlertCircle, Gavel, Clock, Pause, Search, CheckCircle, Users, DollarSign } from 'lucide-react'
import VotacaoModal from '@/components/modals/votacao-modal'
import { toast } from 'sonner'

// Importar tipos do modal de votação para compatibilidade
type ResultadoVotacaoModal = {
  relatores: Array<{
    nome: string
    tipo: 'RELATOR' | 'REVISOR'
    posicao: 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL' | 'ACOMPANHA'
    acompanhaVoto?: string
  }>
  conselheiros: Array<{
    conselheiroId: string
    nome: string
    posicao: 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL' | 'ABSTENCAO' | 'AUSENTE' | 'IMPEDIDO'
    isPresidente?: boolean
  }>
  resultado: {
    deferidos: number
    indeferidos: number
    parciais: number
    abstencoes: number
    ausentes: number
    impedidos: number
    decisaoFinal: 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL'
  }
}

interface ProcessoNaPauta {
  processo: {
    id: string
    numero: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface VotoResultadoDecisao {
  tipo: string
  nome: string
  posicao: string
  acompanhaVoto?: string
  conselheiroId?: string
  isPresidente?: boolean
}

interface ResultadoVotacaoDecisao {
  relatores: VotoResultadoDecisao[]
  conselheiros: VotoResultadoDecisao[]
  resultado: {
    decisaoFinal: string
    deferidos: number
    indeferidos: number
    parciais: number
  }
}

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
  tipoResultado: z.enum(['SUSPENSO', 'PEDIDO_VISTA', 'PEDIDO_DILIGENCIA', 'EM_NEGOCIACAO', 'JULGADO'], {
    message: 'Tipo de resultado é obrigatório'
  }),
  tipoDecisao: z.enum(['DEFERIDO', 'INDEFERIDO', 'PARCIAL']).optional(),
  observacoes: z.string().optional(),
  motivoSuspensao: z.string().optional(),
  detalhesNegociacao: z.string().optional(),
  conselheiroPedidoVista: z.string().optional(),
  prazoVista: z.string().optional(),
  especificacaoDiligencia: z.string().optional(),
  prazoDiligencia: z.string().optional(),
  definirAcordo: z.boolean().optional(),
  tipoAcordo: z.enum(['aceita_proposta', 'contra_proposta', 'sem_acordo']).optional(),
  ataTexto: z.string().min(1, 'Texto da ata é obrigatório'),
  votos: z.array(votoSchema).optional()
}).superRefine((data, ctx) => {
  // Validações específicas por tipo de resultado
  if (data.tipoResultado === 'PEDIDO_DILIGENCIA') {
    if (!data.prazoDiligencia || data.prazoDiligencia.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Prazo para cumprimento é obrigatório',
        path: ['prazoDiligencia']
      })
    }
  }

  if (data.tipoResultado === 'PEDIDO_VISTA') {
    if (!data.conselheiroPedidoVista || data.conselheiroPedidoVista.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Conselheiro que pediu vista é obrigatório',
        path: ['conselheiroPedidoVista']
      })
    }
  }
})

type DecisaoInput = z.infer<typeof decisaoSchema>
type VotoInput = z.infer<typeof votoSchema>

interface DecisaoFormProps {
  sessaoId: string
  onSuccess?: () => void
}

interface Processo {
  id: string
  numero: string
  tipo: string
  valorOriginal: number
  valorNegociado?: number
  status: string
  contribuinte: {
    nome: string
    documento?: string
    email?: string
  }
}

interface ProcessoPauta {
  ordem: number
  relator: string
  revisores: string[]
  distribuidoPara: string
  processo: Processo
}

interface Conselheiro {
  id: string
  nome: string
  email?: string
  cargo?: string
}

export default function DecisaoForm({ sessaoId, onSuccess }: DecisaoFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [processos, setProcessos] = useState<ProcessoPauta[]>([])
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoPauta | null>(null)
  const [conselheiros, setConselheiros] = useState<Conselheiro[]>([])
  const [votos, setVotos] = useState<VotoInput[]>([])
  const [showVotacaoModal, setShowVotacaoModal] = useState(false)
  const [votacaoResultado, setVotacaoResultado] = useState<ResultadoVotacaoDecisao | null>(null)
  const [presidente, setPresidente] = useState<{ id: string; nome: string; email?: string; cargo?: string } | null>(null)

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
    },
    shouldFocusError: false
  })

  // Função para lidar com erros de validação do formulário
  const onInvalid = (errors: any) => {
    // Ordem lógica dos campos no formulário
    const fieldOrder = [
      'processoId',
      'tipoResultado',
      'tipoDecisao',
      'motivoSuspensao',
      'conselheiroPedidoVista',
      'prazoVista',
      'especificacaoDiligencia',
      'prazoDiligencia',
      'tipoAcordo',
      'ataTexto',
      'observacoes'
    ]

    // Procurar pelo primeiro erro na ordem dos campos
    for (const field of fieldOrder) {
      if (errors[field]?.message) {
        toast.warning(errors[field].message)

        // Focar no campo com erro após um pequeno delay
        setTimeout(() => {
          const element = document.getElementById(field)
          if (element) {
            element.focus()
            element.style.borderColor = '#ef4444'
            element.style.boxShadow = '0 0 0 1px #ef4444'
          }
        }, 100)
        break
      }
    }
  }

  const clearFieldError = (fieldId: string) => {
    const element = document.getElementById(fieldId)
    if (element) {
      element.style.borderColor = ''
      element.style.boxShadow = ''
    }
  }

  const tipoResultado = watch('tipoResultado')

  // Buscar dados da sessão
  useEffect(() => {
    const fetchDados = async () => {
      try {
        setIsLoadingData(true)
        const response = await fetch(`/api/sessoes/${sessaoId}`)
        if (response.ok) {
          const sessao = await response.json()

          const processosNaoJulgados = sessao.pauta?.processos?.filter(
            (p: ProcessoPauta) => !sessao.decisoes.some(
              (d: { processoId: string }) => d.processoId === p.processo.id
            )
          ) || []

          setProcessos(processosNaoJulgados)
          setConselheiros(sessao.conselheiros || [])
          setPresidente(sessao.presidente || null)

          const processoIdFromUrl = searchParams.get('processo')
          if (processoIdFromUrl) {
            const processo = processosNaoJulgados.find(
              (p: ProcessoNaPauta) => p.processo.id === processoIdFromUrl
            )
            if (processo) {
              setSelectedProcesso(processo)
              setValue('processoId', processo.processo.id)
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados da sessão:', error)
        toast.error('Erro ao carregar dados da sessão')
      } finally {
        setIsLoadingData(false)
      }
    }

    fetchDados()
  }, [sessaoId, searchParams, setValue])

  const onSubmit = async (data: DecisaoInput) => {
    setIsLoading(true)
    setError(null)

    // Validações específicas antes do envio
    if (data.tipoResultado === 'JULGADO' && !votacaoResultado) {
      toast.warning('Para processos julgados, é necessário ter a votação concluída.')
      setIsLoading(false)
      return
    }

    try {
      const payload = {
        ...data,
        // Limpar tipoDecisao se não for JULGADO
        tipoDecisao: data.tipoResultado === 'JULGADO' ? data.tipoDecisao : undefined,
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

      toast.success('Decisão registrada com sucesso!')

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/sessoes/${sessaoId}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro inesperado'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }




  const formatarListaNomes = (nomes: string[]): string => {
    if (nomes.length === 0) return ''
    if (nomes.length === 1) return nomes[0]
    if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`

    const todosExcetoUltimo = nomes.slice(0, -1).join(', ')
    const ultimo = nomes[nomes.length - 1]
    return `${todosExcetoUltimo} e ${ultimo}`
  }

  const handleVotacaoConfirm = (resultado: ResultadoVotacaoModal) => {
    // Converter ResultadoVotacaoModal para ResultadoVotacaoDecisao
    const resultadoConvertido: ResultadoVotacaoDecisao = {
      relatores: resultado.relatores.map(relator => ({
        tipo: relator.tipo,
        nome: relator.nome,
        posicao: relator.posicao,
        acompanhaVoto: relator.acompanhaVoto
      })),
      conselheiros: resultado.conselheiros.map(conselheiro => ({
        tipo: 'CONSELHEIRO',
        nome: conselheiro.nome,
        posicao: conselheiro.posicao,
        conselheiroId: conselheiro.conselheiroId,
        isPresidente: conselheiro.isPresidente
      })),
      resultado: {
        decisaoFinal: resultado.resultado.decisaoFinal,
        deferidos: resultado.resultado.deferidos,
        indeferidos: resultado.resultado.indeferidos,
        parciais: resultado.resultado.parciais
      }
    }
    setVotacaoResultado(resultadoConvertido)
    // Converter resultado para o formato de votos esperado
    const novosVotos: VotoInput[] = []

    // Adicionar votos dos relatores/revisores
    const relatores = resultado.relatores || []
    relatores.forEach((relator: VotoResultadoDecisao, index: number) => {
      novosVotos.push({
        tipoVoto: relator.tipo as 'RELATOR' | 'REVISOR' | 'CONSELHEIRO',
        nomeVotante: relator.nome,
        posicaoVoto: relator.posicao === 'ACOMPANHA' ? 'DEFERIDO' : relator.posicao as 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL',
        acompanhaVoto: relator.acompanhaVoto,
        ordemApresentacao: index + 1
      })
    })

    // Adicionar votos dos conselheiros
    const conselheiros = resultado.conselheiros || []
    conselheiros.forEach((conselheiro, index: number) => {
      if (conselheiro.posicao !== 'ABSTENCAO') {
        novosVotos.push({
          tipoVoto: 'CONSELHEIRO',
          nomeVotante: conselheiro.nome,
          conselheiroId: conselheiro.conselheiroId,
          posicaoVoto: conselheiro.posicao as 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL',
          ordemApresentacao: resultado.relatores.length + index + 1,
          isPresidente: conselheiro.isPresidente || false
        })
      }
    })

    setVotos(novosVotos)
    // Definir tipo de decisão baseado no resultado
    setValue('tipoDecisao', resultado.resultado.decisaoFinal as 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL')
  }

  const getTipoProcessoLabel = (tipo: string) => {
    switch (tipo) {
      case 'COMPENSACAO': return 'Compensação'
      case 'DACAO_PAGAMENTO': return 'Dação em Pagamento'
      case 'TRANSACAO_EXCEPCIONAL': return 'Transação Excepcional'
      default: return tipo
    }
  }

  const getTipoResultadoColor = (tipo: string) => {
    switch (tipo) {
      case 'SUSPENSO': return 'border-red-200 bg-red-50'
      case 'PEDIDO_VISTA': return 'border-blue-200 bg-blue-50'
      case 'PEDIDO_DILIGENCIA': return 'border-purple-200 bg-purple-50'
      case 'EM_NEGOCIACAO': return 'border-amber-200 bg-amber-50'
      case 'JULGADO': return 'border-green-200 bg-green-50'
      default: return 'border-gray-200 bg-gray-50'
    }
  }

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6" noValidate>

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
                    onClick={() => {
                      setSelectedProcesso(processoPauta)
                      setValue('processoId', processoPauta.processo.id)
                    }}
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
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {processoPauta.relator && (
                          <p className="text-xs text-blue-600">Relator: {processoPauta.relator}</p>
                        )}
                        {processoPauta.revisores && processoPauta.revisores.length > 0 && (
                          <p className="text-xs text-blue-600">
                            Revisor{processoPauta.revisores.length > 1 ? 'es' : ''}: {formatarListaNomes(processoPauta.revisores)}
                          </p>
                        )}
                        {processoPauta.distribuidoPara && (
                          <p className="text-xs text-green-600">Distribuição: {processoPauta.distribuidoPara}</p>
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
                    </div>
                    <div className="mt-2 space-y-1">
                      {selectedProcesso.relator && (
                        <p className="text-xs text-blue-600">Relator: {selectedProcesso.relator}</p>
                      )}
                      {selectedProcesso.revisores && selectedProcesso.revisores.length > 0 && (
                        <p className="text-xs text-blue-600">
                          Revisor{selectedProcesso.revisores.length > 1 ? 'es' : ''}: {formatarListaNomes(selectedProcesso.revisores)}
                        </p>
                      )}
                      {selectedProcesso.distribuidoPara && (
                        <p className="text-xs text-green-600">Distribuição: {selectedProcesso.distribuidoPara}</p>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedProcesso(null)
                    setValue('processoId', '')
                  }}
                >
                  Alterar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tipo de Resultado */}
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
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${tipoResultado === 'SUSPENSO' ? getTipoResultadoColor('SUSPENSO') : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => setValue('tipoResultado', 'SUSPENSO')}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Pause className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-700">Suspenso</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Processo retirado de pauta por motivo específico
                    </p>
                  </div>
                </div>

                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${tipoResultado === 'PEDIDO_VISTA' ? getTipoResultadoColor('PEDIDO_VISTA') : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => setValue('tipoResultado', 'PEDIDO_VISTA')}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-700">Pedido de Vista</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Conselheiro solicita análise adicional do processo
                    </p>
                  </div>
                </div>

                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${tipoResultado === 'PEDIDO_DILIGENCIA' ? getTipoResultadoColor('PEDIDO_DILIGENCIA') : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => setValue('tipoResultado', 'PEDIDO_DILIGENCIA')}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-600" />
                      <span className="font-medium text-purple-700">Pedido de Diligência</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Relator solicita nova documentação ou análise
                    </p>
                  </div>
                </div>

                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${tipoResultado === 'EM_NEGOCIACAO' ? getTipoResultadoColor('EM_NEGOCIACAO') : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => setValue('tipoResultado', 'EM_NEGOCIACAO')}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-amber-600" />
                      <span className="font-medium text-amber-700">Em Negociação</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Processo em fase de negociação de acordo
                    </p>
                  </div>
                </div>

                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${tipoResultado === 'JULGADO' ? getTipoResultadoColor('JULGADO') : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => setValue('tipoResultado', 'JULGADO')}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-700">Julgado</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Decisão final com votação dos conselheiros
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Campos específicos por tipo de resultado */}
          {tipoResultado === 'SUSPENSO' && (
            <Card>
              <CardHeader>
                <CardTitle>Detalhes da Suspensão</CardTitle>
                <CardDescription>
                  Campos opcionais para detalhar a suspensão
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    id="motivoSuspensao"
                    placeholder="Descreva detalhes adicionais sobre a suspensão..."
                    rows={4}
                    {...register('motivoSuspensao')}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {tipoResultado === 'EM_NEGOCIACAO' && (
            <Card>
              <CardHeader>
                <CardTitle>Detalhes da Negociação</CardTitle>
                <CardDescription>
                  Campos opcionais para detalhar a negociação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    id="detalhesNegociacao"
                    placeholder="Descreva detalhes sobre a negociação em andamento..."
                    rows={4}
                    {...register('detalhesNegociacao')}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {tipoResultado === 'PEDIDO_VISTA' && (
            <Card>
              <CardHeader>
                <CardTitle>Detalhes do Pedido de Vista</CardTitle>
                <CardDescription>
                  Conselheiro que pediu vista é obrigatório, observação é opcional
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="w-1/2">
                  <div className="space-y-2">
                    <Label htmlFor="conselheiroPedidoVista">Conselheiro que pediu vista <span className="text-red-500">*</span></Label>
                    <Select
                      value={watch('conselheiroPedidoVista') || ''}
                      onValueChange={(value) => setValue('conselheiroPedidoVista', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o conselheiro..." />
                      </SelectTrigger>
                      <SelectContent>
                        {conselheiros
                          .filter(conselheiro => {
                            // Excluir relator da lista
                            if (conselheiro.nome === selectedProcesso?.relator) {
                              return false
                            }
                            // Excluir revisores da lista
                            if (selectedProcesso?.revisores && selectedProcesso.revisores.includes(conselheiro.nome)) {
                              return false
                            }
                            return true
                          })
                          .map((conselheiro) => (
                            <SelectItem key={conselheiro.id} value={conselheiro.nome}>
                              {conselheiro.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {selectedProcesso?.relator && (
                      <p className="text-xs text-gray-500">
                        Nota: Relatores e revisores não podem pedir vista do próprio processo.
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observação</Label>
                  <Textarea
                    id="observacoes"
                    placeholder="Descreva detalhes adicionais sobre o pedido de vista..."
                    rows={4}
                    {...register('observacoes')}
                    disabled={isLoading}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {tipoResultado === 'PEDIDO_DILIGENCIA' && (
            <Card>
              <CardHeader>
                <CardTitle>Detalhes do Pedido de Diligência</CardTitle>
                <CardDescription>
                  Prazo para cumprimento é obrigatório, observação é opcional
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="especificacaoDiligencia">Observação</Label>
                  <Textarea
                    id="especificacaoDiligencia"
                    placeholder="Descreva detalhes adicionais sobre a diligência..."
                    rows={4}
                    {...register('especificacaoDiligencia')}
                  />
                </div>
                <div className="space-y-2 w-1/2">
                  <Label htmlFor="prazoDiligencia">Prazo para cumprimento <span className="text-red-500">*</span></Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="prazoDiligencia"
                      type="number"
                      min="1"
                      placeholder="Ex: 15"
                      {...register('prazoDiligencia')}
                    />
                    <span className="text-sm text-gray-600">dias</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {tipoResultado === 'JULGADO' && (
            <>
              {/* Sistema de Votação */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Sistema de Votação
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="cursor-pointer"
                      onClick={() => setShowVotacaoModal(true)}
                    >
                      <Users className="h-4 w-4 mr-1" />
                      Definir Votação
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Votação obrigatória: configure os votos de relatores, revisores e conselheiros
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {votacaoResultado ? (
                    <div className="space-y-4">
                      {/* Resumo do Resultado */}
                      <Card className="border-2 border-green-200 bg-green-50 p-4">
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-800 mb-3">
                            Resultado: {votacaoResultado.resultado.decisaoFinal}
                          </div>
                          <div className="grid grid-cols-3 gap-4 mb-3">
                            <div>
                              <div className="text-xl font-bold text-green-600">{votacaoResultado.resultado.deferidos}</div>
                              <div className="text-xs text-gray-600">Deferidos</div>
                            </div>
                            <div>
                              <div className="text-xl font-bold text-red-600">{votacaoResultado.resultado.indeferidos}</div>
                              <div className="text-xs text-gray-600">Indeferidos</div>
                            </div>
                            <div>
                              <div className="text-xl font-bold text-yellow-600">{votacaoResultado.resultado.parciais}</div>
                              <div className="text-xs text-gray-600">Parciais</div>
                            </div>
                          </div>

                        </div>
                      </Card>

                      {/* Resumo dos Votos - Layout Compacto */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {votacaoResultado.relatores.length > 0 && (
                          <Card className="p-3">
                            <div className="font-medium text-gray-800 mb-2 text-sm">Relatores/Revisores</div>
                            <div className="space-y-1">
                              {votacaoResultado.relatores.map((relator: VotoResultadoDecisao, index: number) => (
                                <div key={index} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={relator.tipo === 'RELATOR' ? 'default' : 'secondary'} className="text-xs">
                                      {relator.tipo === 'RELATOR' ? 'Relator' : 'Revisor'}
                                    </Badge>
                                    <span className="truncate font-medium">{relator.nome}</span>
                                  </div>
                                  <span className={`font-medium text-xs ${relator.posicao === 'DEFERIDO' ? 'text-green-600' :
                                    relator.posicao === 'INDEFERIDO' ? 'text-red-600' :
                                      relator.posicao === 'PARCIAL' ? 'text-yellow-600' :
                                        'text-blue-600'
                                    }`}>
                                    {relator.posicao === 'ACOMPANHA'
                                      ? `Acomp. ${relator.acompanhaVoto?.split(' ')[0]}`
                                      : relator.posicao}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </Card>
                        )}

                        <Card className="p-3">
                          <div className="font-medium text-gray-800 mb-3 text-sm">Conselheiros</div>
                          <div className="max-h-24 overflow-y-auto space-y-1">
                            {/* Votos válidos agrupados */}
                            {['DEFERIDO', 'INDEFERIDO', 'PARCIAL'].map(posicao => {
                              const conselheirosComEssePosicao = votacaoResultado.conselheiros.filter((conselheiro: VotoResultadoDecisao) => conselheiro.posicao === posicao)
                              if (conselheirosComEssePosicao.length === 0) return null

                              return (
                                <div key={posicao} className="text-xs">
                                  <span className={`font-medium ${posicao === 'DEFERIDO' ? 'text-green-600' :
                                    posicao === 'INDEFERIDO' ? 'text-red-600' :
                                      'text-yellow-600'
                                    }`}>
                                    {posicao}:
                                  </span>
                                  <span className="ml-1 text-gray-700">
                                    {formatarListaNomes(conselheirosComEssePosicao.map((conselheiro: VotoResultadoDecisao) => conselheiro.nome))}
                                  </span>
                                </div>
                              )
                            })}

                            {/* Abstenções agrupadas */}
                            {votacaoResultado.conselheiros.filter((conselheiro: VotoResultadoDecisao) => ['ABSTENCAO', 'AUSENTE', 'IMPEDIDO'].includes(conselheiro.posicao)).length > 0 && (
                              <div className="border-t pt-1 mt-1">
                                {['AUSENTE', 'IMPEDIDO', 'ABSTENCAO'].map(posicao => {
                                  const conselheirosComEssePosicao = votacaoResultado.conselheiros.filter((conselheiro: VotoResultadoDecisao) => conselheiro.posicao === posicao)
                                  if (conselheirosComEssePosicao.length === 0) return null

                                  return (
                                    <div key={posicao} className="text-xs">
                                      <span className="font-medium text-gray-600">
                                        {posicao === 'ABSTENCAO' ? 'ABSTENÇÃO' :
                                          posicao === 'AUSENTE' ? 'AUSENTE' : 'IMPEDIDO'}:
                                      </span>
                                      <span className="ml-1 text-gray-600">
                                        {formatarListaNomes(conselheirosComEssePosicao.map((conselheiro: VotoResultadoDecisao) => conselheiro.nome))}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </Card>
                      </div>

                      {/* Voto do Presidente (se houve empate e presidente votou) */}
                      {(() => {
                        // Verifica se existe um voto do presidente (conselheiro com mesmo nome/id do presidente)
                        const votoPresidente = presidente && votacaoResultado.conselheiros.find((conselheiro: VotoResultadoDecisao) =>
                          conselheiro.conselheiroId === presidente.id ||
                          conselheiro.nome === presidente.nome
                        )

                        if (!votoPresidente || !presidente) return null

                        return (
                          <Card className="p-3 mt-4 border-yellow-300 bg-yellow-50">
                            <div className="font-medium text-gray-800 mb-2 text-sm flex items-center gap-2">
                              ⚖️ Voto de Desempate - Presidente
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs border-yellow-600 text-yellow-700">
                                  Presidente
                                </Badge>
                                <span className="truncate font-medium">{presidente.nome}</span>
                              </div>
                              <span className={`font-medium text-xs ${votoPresidente.posicao === 'DEFERIDO' ? 'text-green-600' :
                                  votoPresidente.posicao === 'INDEFERIDO' ? 'text-red-600' :
                                    'text-yellow-600'
                                }`}>
                                {votoPresidente.posicao}
                              </span>
                            </div>
                          </Card>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p>Sistema de votação não configurado</p>
                      <p className="text-sm mt-1">Clique em &quot;Definir Votação&quot; para configurar os votos</p>
                    </div>
                  )}
                </CardContent>
              </Card>


              {/* Detalhes do Julgamento */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes do Julgamento</CardTitle>
                  <CardDescription>
                    Campos opcionais para fundamentar a decisão
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Textarea
                      id="observacoes"
                      placeholder="Descreva detalhes adicionais sobre a decisão..."
                      rows={4}
                      {...register('observacoes')}
                      disabled={isLoading}
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}


          {/* Texto da Ata */}
          <Card>
            <CardHeader>
              <CardTitle>Texto da Ata <span className="text-red-500">*</span></CardTitle>
              <CardDescription>
                Texto obrigatório que aparecerá na ata para este processo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  id="ataTexto"
                  placeholder="Texto detalhado do que ocorreu com o processo na sessão..."
                  rows={4}
                  {...register('ataTexto')}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botões de Ação */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="cursor-pointer"
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

      {/* Modal de Votação */}
      {selectedProcesso && (
        <VotacaoModal
          isOpen={showVotacaoModal}
          onClose={() => setShowVotacaoModal(false)}
          onConfirm={handleVotacaoConfirm}
          processo={selectedProcesso}
          conselheiros={conselheiros}
          relatoresRevisores={[
            ...(selectedProcesso.relator ? [{ nome: selectedProcesso.relator, tipo: 'RELATOR' as const }] : []),
            ...(selectedProcesso.revisores ? selectedProcesso.revisores.map(revisor => ({ nome: revisor, tipo: 'REVISOR' as const })) : [])
          ]}
          presidente={presidente}
        />
      )}
    </form>
  )
}
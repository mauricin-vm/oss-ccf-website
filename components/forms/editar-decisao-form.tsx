'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, AlertCircle, Gavel, FileText, User, Building, Clock, Pause, Search, CheckCircle, Plus, X, Users } from 'lucide-react'
import VotacaoModal from '@/components/modals/votacao-modal'
import { toast } from 'sonner'

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
  tipoDecisao: z.enum(['DEFERIDO', 'INDEFERIDO', 'PARCIAL']).optional(),
  observacoes: z.string().optional(),
  motivoSuspensao: z.string().optional(),
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
  ataTexto?: string
  processo: Processo
}

interface Conselheiro {
  id: string
  nome: string
  email?: string
  cargo?: string
}

interface EditarDecisaoFormProps {
  decisaoId: string
  sessaoId: string
  decisaoAtual: {
    processoId: string
    tipoResultado: string
    tipoDecisao?: string | null
    observacoes?: string | null
    motivoSuspensao?: string | null
    conselheiroPedidoVista?: string | null
    prazoVista?: string | null
    especificacaoDiligencia?: string | null
    prazoDiligencia?: string | null
    definirAcordo?: boolean | null
    tipoAcordo?: string | null
    ataTexto?: string | null
    votos: any[]
  }
  processo: ProcessoPauta | null
  conselheiros: Conselheiro[]
  presidente?: { id: string; nome: string; email?: string; cargo?: string } | null
}

export default function EditarDecisaoForm({
  decisaoId,
  sessaoId,
  decisaoAtual,
  processo,
  conselheiros,
  presidente = null
}: EditarDecisaoFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [votos, setVotos] = useState<VotoInput[]>([])
  const [showVotacaoModal, setShowVotacaoModal] = useState(false)
  const [votacaoResultado, setVotacaoResultado] = useState<any>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<DecisaoInput>({
    resolver: zodResolver(decisaoSchema),
    defaultValues: {
      processoId: decisaoAtual.processoId,
      tipoResultado: decisaoAtual.tipoResultado as any,
      tipoDecisao: (decisaoAtual.tipoDecisao as any) || undefined,
      observacoes: decisaoAtual.observacoes || '',
      motivoSuspensao: decisaoAtual.motivoSuspensao || '',
      conselheiroPedidoVista: decisaoAtual.conselheiroPedidoVista || '',
      prazoVista: decisaoAtual.prazoVista ? (() => {
        try {
          const date = new Date(decisaoAtual.prazoVista);
          return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
        } catch {
          return '';
        }
      })() : '',
      especificacaoDiligencia: decisaoAtual.especificacaoDiligencia || '',
      prazoDiligencia: decisaoAtual.prazoDiligencia || '',
      definirAcordo: decisaoAtual.definirAcordo || false,
      tipoAcordo: (decisaoAtual.tipoAcordo as any) || undefined,
      ataTexto: decisaoAtual.ataTexto || ''
    }
  })

  const tipoResultado = watch('tipoResultado')
  const definirAcordo = watch('definirAcordo')

  // Inicializar votos se existirem
  useEffect(() => {
    if (decisaoAtual.votos && decisaoAtual.votos.length > 0) {
      const votosConvertidos: VotoInput[] = decisaoAtual.votos.map((voto: any) => ({
        tipoVoto: voto.tipoVoto,
        nomeVotante: voto.nomeVotante,
        conselheiroId: voto.conselheiroId || undefined,
        textoVoto: voto.textoVoto || undefined,
        posicaoVoto: voto.posicaoVoto || undefined,
        acompanhaVoto: voto.acompanhaVoto || undefined,
        ordemApresentacao: voto.ordemApresentacao || undefined,
        isPresidente: voto.isPresidente || false
      }))
      setVotos(votosConvertidos)
      
      // Se há votos, criar resultado de votação simulado para exibição
      if (tipoResultado === 'JULGADO') {
        // Simular resultado baseado nos votos existentes
        const deferidos = votosConvertidos.filter(v => v.posicaoVoto === 'DEFERIDO').length
        const indeferidos = votosConvertidos.filter(v => v.posicaoVoto === 'INDEFERIDO').length
        const parciais = votosConvertidos.filter(v => v.posicaoVoto === 'PARCIAL').length
        
        let decisaoFinal = 'DEFERIDO'
        if (indeferidos > deferidos && indeferidos > parciais) {
          decisaoFinal = 'INDEFERIDO'
        } else if (parciais > deferidos && parciais > indeferidos) {
          decisaoFinal = 'PARCIAL'
        }

        // Criar estrutura de relatores com propriedades corretas
        const relatores = votosConvertidos
          .filter(v => v.tipoVoto === 'RELATOR' || v.tipoVoto === 'REVISOR')
          .map(voto => ({
            nome: voto.nomeVotante,
            tipo: voto.tipoVoto,
            posicao: voto.acompanhaVoto ? 'ACOMPANHA' : voto.posicaoVoto,
            acompanhaVoto: voto.acompanhaVoto
          }))

        // Criar estrutura de conselheiros com propriedades corretas
        const conselheiros = votosConvertidos
          .filter(v => v.tipoVoto === 'CONSELHEIRO')
          .map(voto => ({
            nome: voto.nomeVotante,
            conselheiroId: voto.conselheiroId,
            posicao: voto.posicaoVoto || 'DEFERIDO'
          }))

        setVotacaoResultado({
          resultado: { decisaoFinal, deferidos, indeferidos, parciais },
          relatores,
          conselheiros
        })
      }
    }
  }, [decisaoAtual.votos, tipoResultado])

  const onSubmit = async (data: DecisaoInput) => {
    setIsLoading(true)
    setError(null)

    // Validações específicas antes do envio
    if (data.tipoResultado === 'JULGADO' && !votacaoResultado) {
      setError('Para processos julgados, é necessário ter a votação concluída.')
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

      const response = await fetch(`/api/sessoes/${sessaoId}/decisoes/${decisaoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar decisão')
      }

      toast.success('Decisão atualizada com sucesso!')
      router.push(`/sessoes/${sessaoId}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVotacaoConfirm = (resultado: any) => {
    setVotacaoResultado(resultado)
    // Converter resultado para o formato de votos esperado
    const novosVotos: VotoInput[] = []

    // Adicionar votos dos relatores/revisores
    resultado.relatores.forEach((relator: any, index: number) => {
      novosVotos.push({
        tipoVoto: relator.tipo,
        nomeVotante: relator.nome,
        posicaoVoto: relator.posicao === 'ACOMPANHA' ? 'DEFERIDO' : relator.posicao,
        acompanhaVoto: relator.acompanhaVoto,
        ordemApresentacao: index + 1
      })
    })

    // Adicionar votos dos conselheiros
    resultado.conselheiros.forEach((conselheiro: any, index: number) => {
      if (conselheiro.posicao !== 'ABSTENCAO') {
        novosVotos.push({
          tipoVoto: 'CONSELHEIRO',
          nomeVotante: conselheiro.nome,
          conselheiroId: conselheiro.conselheiroId,
          posicaoVoto: conselheiro.posicao,
          ordemApresentacao: resultado.relatores.length + index + 1,
          isPresidente: conselheiro.isPresidente || false
        })
      }
    })

    setVotos(novosVotos)
    // Definir tipo de decisão baseado no resultado
    setValue('tipoDecisao', resultado.resultado.decisaoFinal)
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
      case 'SUSPENSO': return 'border-yellow-200 bg-yellow-50'
      case 'PEDIDO_VISTA': return 'border-blue-200 bg-blue-50'
      case 'PEDIDO_DILIGENCIA': return 'border-orange-200 bg-orange-50'
      case 'JULGADO': return 'border-green-200 bg-green-50'
      default: return 'border-gray-200 bg-gray-50'
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

  if (!processo) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro: Não foi possível carregar os dados do processo.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Informações do Processo */}
      <Card>
        <CardHeader>
          <CardTitle>Processo Selecionado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-bold">
                {processo.ordem}
              </span>
              <div>
                <h4 className="font-medium text-blue-900">{processo.processo.numero}</h4>
                <p className="text-sm text-blue-700">{processo.processo.contribuinte.nome}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">
                    {getTipoProcessoLabel(processo.processo.tipo)}
                  </Badge>
                  <span className="text-sm text-blue-700">
                    R$ {(processo.processo.valorOriginal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tipo de Resultado */}
      <Card>
        <CardHeader>
          <CardTitle>Tipo de Resultado</CardTitle>
          <CardDescription>
            Selecione o resultado do julgamento do processo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${tipoResultado === 'SUSPENSO' ? getTipoResultadoColor('SUSPENSO') : 'border-gray-200 hover:border-gray-300'}`}
              onClick={() => setValue('tipoResultado', 'SUSPENSO')}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Pause className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium text-yellow-700">Suspenso</span>
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
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-700">Pedido de Diligência</span>
                </div>
                <p className="text-sm text-gray-600">
                  Relator solicita nova documentação ou análise
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
          {errors.tipoResultado && (
            <p className="text-sm text-red-500 mt-2">{errors.tipoResultado.message}</p>
          )}
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
              {errors.motivoSuspensao && (
                <p className="text-sm text-red-500">{errors.motivoSuspensao.message}</p>
              )}
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
                <Label htmlFor="conselheiroPedidoVista">Conselheiro que pediu vista *</Label>
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
                        if (conselheiro.nome === processo?.relator) {
                          return false
                        }
                        // Excluir revisores da lista
                        if (processo?.revisores && processo.revisores.includes(conselheiro.nome)) {
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
                {errors.conselheiroPedidoVista && (
                  <p className="text-sm text-red-500">{errors.conselheiroPedidoVista.message}</p>
                )}
                {processo?.relator && (
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
              {errors.observacoes && (
                <p className="text-sm text-red-500">{errors.observacoes.message}</p>
              )}
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
              {errors.especificacaoDiligencia && (
                <p className="text-sm text-red-500">{errors.especificacaoDiligencia.message}</p>
              )}
            </div>
            <div className="space-y-2 w-1/2">
              <Label htmlFor="prazoDiligencia">Prazo para cumprimento *</Label>
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
              {errors.prazoDiligencia && (
                <p className="text-sm text-red-500">{errors.prazoDiligencia.message}</p>
              )}
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
                  {votacaoResultado ? 'Alterar Votação' : 'Definir Votação'}
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
                    {votacaoResultado.relatores && votacaoResultado.relatores.length > 0 && (
                      <Card className="p-3">
                        <div className="font-medium text-gray-800 mb-2 text-sm">Relatores/Revisores</div>
                        <div className="space-y-1">
                          {votacaoResultado.relatores.map((relator: any, index: number) => (
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
                          const conselheirosComEssePosicao = votacaoResultado.conselheiros?.filter((conselheiro: any) => conselheiro.posicao === posicao) || []
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
                                {formatarListaNomes(conselheirosComEssePosicao.map((conselheiro: any) => conselheiro.nome))}
                              </span>
                            </div>
                          )
                        })}

                        {/* Abstenções agrupadas */}
                        {votacaoResultado.conselheiros?.filter((conselheiro: any) => ['ABSTENCAO', 'AUSENTE', 'IMPEDIDO'].includes(conselheiro.posicao)).length > 0 && (
                          <div className="border-t pt-1 mt-1">
                            {['AUSENTE', 'IMPEDIDO', 'ABSTENCAO'].map(posicao => {
                              const conselheirosComEssePosicao = votacaoResultado.conselheiros?.filter((conselheiro: any) => conselheiro.posicao === posicao) || []
                              if (conselheirosComEssePosicao.length === 0) return null

                              return (
                                <div key={posicao} className="text-xs">
                                  <span className="font-medium text-gray-600">
                                    {posicao === 'ABSTENCAO' ? 'ABSTENÇÃO' :
                                      posicao === 'AUSENTE' ? 'AUSENTE' : 'IMPEDIDO'}:
                                  </span>
                                  <span className="ml-1 text-gray-600">
                                    {formatarListaNomes(conselheirosComEssePosicao.map((conselheiro: any) => conselheiro.nome))}
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
                    const votoPresidente = presidente && votacaoResultado.conselheiros?.find((conselheiro: any) =>
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
                          <span className={`font-medium text-xs ${
                            votoPresidente.posicao === 'DEFERIDO' ? 'text-green-600' :
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
                  <p className="text-sm mt-1">Clique em "Definir Votação" para configurar os votos</p>
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
                {errors.observacoes && (
                  <p className="text-sm text-red-500">{errors.observacoes.message}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Texto da Ata */}
      <Card>
        <CardHeader>
          <CardTitle>Texto da Ata *</CardTitle>
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
            {errors.ataTexto && (
              <p className="text-sm text-red-500">{errors.ataTexto.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex gap-4 justify-end">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={() => router.push(`/sessoes/${sessaoId}`)}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="cursor-pointer"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Gavel className="mr-2 h-4 w-4" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>

      {/* Modal de Votação */}
      {processo && (
        <VotacaoModal
          isOpen={showVotacaoModal}
          onClose={() => setShowVotacaoModal(false)}
          onConfirm={handleVotacaoConfirm}
          processo={processo}
          conselheiros={conselheiros}
          relatoresRevisores={processo.relator ? [{ nome: processo.relator, tipo: 'RELATOR' as const }] : []}
          presidente={presidente}
        />
      )}
    </form>
  )
}
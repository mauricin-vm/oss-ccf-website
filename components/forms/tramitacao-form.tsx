'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { tramitacaoSchema, type TramitacaoInput } from '@/lib/validations/processo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Search, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface TramitacaoFormProps {
  onSuccess?: () => void
  processoId?: string
}

interface Processo {
  id: string
  numero: string
  tipo: string
  status: string
  contribuinte: {
    nome: string
  }
  tramitacoes: Array<{
    setorDestino: string
    dataEnvio: Date
  }>
}

interface Setor {
  id: string
  nome: string
  sigla: string
}

export default function TramitacaoForm({ onSuccess, processoId }: TramitacaoFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [processos, setProcessos] = useState<Processo[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [searchProcess, setSearchProcess] = useState('')
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<TramitacaoInput>({
    resolver: zodResolver(tramitacaoSchema),
    defaultValues: {
      processoId: processoId || '',
      setorOrigem: '',
      setorDestino: '',
      prazoResposta: '',
      observacoes: ''
    }
  })

  // Buscar setores
  useEffect(() => {
    const fetchSetores = async () => {
      try {
        const response = await fetch('/api/setores')
        if (response.ok) {
          const data = await response.json()
          setSetores(data)
        }
      } catch (error) {
        console.error('Erro ao buscar setores:', error)
      }
    }

    fetchSetores()
  }, [])

  // Buscar processos quando há busca
  useEffect(() => {
    const fetchProcessos = async () => {
      if (searchProcess.length < 3) {
        setProcessos([])
        return
      }

      try {
        const response = await fetch(`/api/processos?search=${encodeURIComponent(searchProcess)}`)
        if (response.ok) {
          const data = await response.json()
          setProcessos(data.processos || [])
        }
      } catch (error) {
        console.error('Erro ao buscar processos:', error)
      }
    }

    const timeoutId = setTimeout(fetchProcessos, 300)
    return () => clearTimeout(timeoutId)
  }, [searchProcess])

  // Se processoId for fornecido, buscar o processo específico
  useEffect(() => {
    const fetchProcesso = async () => {
      if (!processoId) return

      try {
        const response = await fetch(`/api/processos/${processoId}`)
        if (response.ok) {
          const processo = await response.json()
          setSelectedProcesso(processo)
          setValue('processoId', processo.id)
          
          // Definir setor de origem baseado na última tramitação
          if (processo.tramitacoes.length > 0) {
            setValue('setorOrigem', processo.tramitacoes[0].setorDestino, { shouldValidate: true })
          }
        }
      } catch (error) {
        console.error('Erro ao buscar processo:', error)
      }
    }

    fetchProcesso()
  }, [processoId, setValue])

  const onSubmit = async (data: TramitacaoInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/tramitacoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar tramitação')
      }

      await response.json()
      
      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/tramitacoes')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectProcesso = (processo: Processo) => {
    setSelectedProcesso(processo)
    setValue('processoId', processo.id)
    setSearchProcess('')
    setProcessos([])
    
    // Definir setor de origem baseado na última tramitação
    if (processo.tramitacoes.length > 0) {
      setValue('setorOrigem', processo.tramitacoes[0].setorDestino, { shouldValidate: true })
    }
  }

  const tipoProcessoMap = {
    COMPENSACAO: 'Compensação',
    DACAO_PAGAMENTO: 'Dação em Pagamento',
    TRANSACAO_EXCEPCIONAL: 'Transação Excepcional'
  }

  const statusMap = {
    RECEPCIONADO: { label: 'Recepcionado', color: 'bg-gray-100 text-gray-800' },
    EM_ANALISE: { label: 'Em Análise', color: 'bg-blue-100 text-blue-800' },
    AGUARDANDO_DOCUMENTOS: { label: 'Aguardando Docs', color: 'bg-yellow-100 text-yellow-800' },
    EM_PAUTA: { label: 'Em Pauta', color: 'bg-purple-100 text-purple-800' },
    JULGADO: { label: 'Julgado', color: 'bg-indigo-100 text-indigo-800' },
    ACORDO_FIRMADO: { label: 'Acordo Firmado', color: 'bg-green-100 text-green-800' },
    EM_CUMPRIMENTO: { label: 'Em Cumprimento', color: 'bg-orange-100 text-orange-800' },
    FINALIZADO: { label: 'Finalizado', color: 'bg-green-100 text-green-800' },
    ARQUIVADO: { label: 'Arquivado', color: 'bg-gray-100 text-gray-800' }
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
          <CardTitle>Processo</CardTitle>
          <CardDescription>
            Selecione o processo para tramitar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedProcesso ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar processo por número ou contribuinte..."
                  value={searchProcess}
                  onChange={(e) => setSearchProcess(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>

              {processos.length > 0 && (
                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {processos.map((processo) => (
                    <div
                      key={processo.id}
                      onClick={() => handleSelectProcesso(processo)}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{processo.numero}</p>
                          <p className="text-sm text-gray-600">{processo.contribuinte.nome}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={statusMap[processo.status as keyof typeof statusMap].color}>
                            {statusMap[processo.status as keyof typeof statusMap].label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-blue-900">{selectedProcesso.numero}</h4>
                  <p className="text-sm text-blue-700">{selectedProcesso.contribuinte.nome}</p>
                  <p className="text-xs text-blue-600">
                    {tipoProcessoMap[selectedProcesso.tipo as keyof typeof tipoProcessoMap]}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedProcesso(null)
                    setValue('processoId', '')
                    setValue('setorOrigem', '')
                    setValue('setorDestino', '')
                    setValue('prazoResposta', '')
                  }}
                >
                  Alterar
                </Button>
              </div>
            </div>
          )}
          {errors.processoId && (
            <p className="text-sm text-red-500">{errors.processoId.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Informações da Tramitação */}
      {selectedProcesso && (
        <Card>
          <CardHeader>
            <CardTitle>Dados da Tramitação</CardTitle>
            <CardDescription>
              Configure o destino e prazos da tramitação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="setorOrigem">Setor de Origem</Label>
                <Select 
                  value={watch('setorOrigem')}
                  onValueChange={(value) => setValue('setorOrigem', value, { shouldValidate: true })} 
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {setores.map((setor) => (
                      <SelectItem key={setor.id} value={setor.sigla}>
                        {setor.sigla} - {setor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.setorOrigem && (
                  <p className="text-sm text-red-500">{errors.setorOrigem.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="setorDestino">Setor de Destino</Label>
                <Select 
                  value={watch('setorDestino')}
                  onValueChange={(value) => setValue('setorDestino', value, { shouldValidate: true })} 
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {setores.map((setor) => (
                      <SelectItem key={setor.id} value={setor.sigla}>
                        {setor.sigla} - {setor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.setorDestino && (
                  <p className="text-sm text-red-500">{errors.setorDestino.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prazoResposta">Prazo para Resposta</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="prazoResposta"
                  type="date"
                  {...register('prazoResposta')}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              {errors.prazoResposta && (
                <p className="text-sm text-red-500">{errors.prazoResposta.message}</p>
              )}
              <p className="text-xs text-gray-500">
                Data limite para resposta ou retorno do setor de destino
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Informações adicionais sobre a tramitação..."
                rows={3}
                {...register('observacoes')}
                disabled={isLoading}
              />
              {errors.observacoes && (
                <p className="text-sm text-red-500">{errors.observacoes.message}</p>
              )}
            </div>

            {/* Histórico de Tramitações do Processo */}
            {selectedProcesso.tramitacoes.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Última Tramitação</h4>
                <div className="text-sm text-gray-600">
                  <p>
                    <strong>Destino Atual:</strong> {selectedProcesso.tramitacoes[0].setorDestino}
                  </p>
                  <p>
                    <strong>Data:</strong> {new Date(selectedProcesso.tramitacoes[0].dataEnvio).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              Criando...
            </>
          ) : (
            'Criar Tramitação'
          )}
        </Button>
      </div>
    </form>
  )
}
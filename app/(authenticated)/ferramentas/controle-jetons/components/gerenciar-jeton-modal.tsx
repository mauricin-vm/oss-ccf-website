'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { CheckCircle, X } from 'lucide-react'

interface Conselheiro {
  id: string
  nome: string
  email?: string
  cargo?: string
}

interface MembroConfig {
  conselheiroId: string
  nome: string
  valorJeton: number
  presente: boolean
  observacoes?: string
}

interface Sessao {
  id: string
  dataInicio: string
  dataFim: string | null
  conselheiros: Conselheiro[]
  folhaJeton?: {
    id: string
    status: 'PENDENTE' | 'ENTREGUE'
    dataEntrega: string | null
    observacoes?: string | null
    membros: Array<{
      id: string
      conselheiroId: string
      valorJeton: number
      presente: boolean
      observacoes?: string | null
      conselheiro: Conselheiro
    }>
  } | null
}

interface GerenciarJetonModalProps {
  sessao: Sessao
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// Funções de formatação de moeda
const formatCurrency = (value: string) => {
  // Remove tudo que não for número
  const numericValue = value.replace(/\D/g, '')

  // Se não há número, retorna vazio
  if (!numericValue) return ''

  // Converte para centavos
  const cents = parseInt(numericValue, 10)

  // Divide por 100 para ter o valor em reais
  const reais = cents / 100

  // Formata no padrão brasileiro
  return reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const parseCurrencyToNumber = (value: string): number => {
  // Remove tudo que não for número ou vírgula
  const cleanValue = value.replace(/[^\d,]/g, '')

  // Substitui vírgula por ponto para parseFloat
  const numericValue = cleanValue.replace(',', '.')

  return parseFloat(numericValue) || 0
}

export default function GerenciarJetonModal({ sessao, open, onClose, onSuccess }: GerenciarJetonModalProps) {
  const [membros, setMembros] = useState<MembroConfig[]>([])
  const [valorPadrao, setValorPadrao] = useState('850,00')
  const [status, setStatus] = useState<'PENDENTE' | 'ENTREGUE'>('PENDENTE')
  const [dataEntrega, setDataEntrega] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Inicializar membros
  useEffect(() => {
    if (sessao.folhaJeton) {
      // Se já tem folha, carregar membros configurados
      const membrosConfig: MembroConfig[] = sessao.folhaJeton.membros.map(m => ({
        conselheiroId: m.conselheiroId,
        nome: m.conselheiro.nome,
        valorJeton: Number(m.valorJeton),
        presente: m.presente,
        observacoes: m.observacoes || undefined
      }))
      setMembros(membrosConfig)
      setStatus(sessao.folhaJeton.status)
      setDataEntrega(sessao.folhaJeton.dataEntrega ? sessao.folhaJeton.dataEntrega.split('T')[0] : '')
      setObservacoes(sessao.folhaJeton.observacoes || '')
    } else {
      // Se não tem folha, inicializar com conselheiros da sessão
      const valorInicial = parseCurrencyToNumber(valorPadrao)
      const membrosInicial: MembroConfig[] = sessao.conselheiros.map(c => ({
        conselheiroId: c.id,
        nome: c.nome,
        valorJeton: valorInicial,
        presente: true,
        observacoes: undefined
      }))
      setMembros(membrosInicial)
    }
  }, [sessao, valorPadrao])

  // Toggle presença
  const togglePresenca = (conselheiroId: string) => {
    setMembros(prev => prev.map(m =>
      m.conselheiroId === conselheiroId
        ? { ...m, presente: !m.presente }
        : m
    ))
  }

  // Atualizar valor individual
  const updateValor = (conselheiroId: string, valor: string) => {
    const valorNum = parseCurrencyToNumber(valor)
    setMembros(prev => prev.map(m =>
      m.conselheiroId === conselheiroId
        ? { ...m, valorJeton: valorNum }
        : m
    ))
  }

  // Salvar
  const handleSalvar = async () => {
    setIsSubmitting(true)
    try {
      // Criar/atualizar folha (tudo em uma única requisição)
      const responseFolha = await fetch('/api/folhas-jeton', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessaoId: sessao.id,
          membros: membros.map(m => ({
            conselheiroId: m.conselheiroId,
            valorJeton: m.valorJeton,
            presente: m.presente,
            observacoes: m.observacoes
          })),
          observacoes,
          status,
          dataEntrega: dataEntrega || null
        })
      })

      if (!responseFolha.ok) {
        const error = await responseFolha.json()
        throw new Error(error.error || 'Erro ao salvar folha')
      }

      toast.success('Folha de jeton salva com sucesso')
      onSuccess()
      onClose()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalPresentes = membros.filter(m => m.presente).length
  const valorTotal = membros
    .filter(m => m.presente)
    .reduce((sum, m) => sum + m.valorJeton, 0)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Folha de Jeton</DialogTitle>
          <DialogDescription>
            Configure os membros presentes, valores e status da folha
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Controles Gerais */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="valor-padrao">Valor Padrão (R$)</Label>
              <Input
                id="valor-padrao"
                value={valorPadrao}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value)
                  setValorPadrao(formatted)
                  // Aplicar automaticamente aos presentes
                  const novoValor = parseCurrencyToNumber(formatted)
                  if (novoValor > 0) {
                    setMembros(prev => prev.map(m => ({
                      ...m,
                      valorJeton: m.presente ? novoValor : m.valorJeton
                    })))
                  }
                }}
                disabled={isSubmitting}
                placeholder="Ex: 850,00"
              />
            </div>

            {sessao.folhaJeton && (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as 'PENDENTE' | 'ENTREGUE')}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="ENTREGUE">Entregue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {status === 'ENTREGUE' && sessao.folhaJeton && (
              <div className="space-y-2">
                <Label htmlFor="data-entrega">Data de Entrega</Label>
                <Input
                  id="data-entrega"
                  type="date"
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            )}
          </div>

          {/* Lista de Membros */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Membros da Sessão</Label>
              <div className="text-sm text-gray-600">
                {totalPresentes} de {membros.length} presentes • Total:{' '}
                <span className="font-semibold text-green-600">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                  }).format(valorTotal)}
                </span>
              </div>
            </div>

            <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
              {membros.map((membro) => (
                <div key={membro.conselheiroId} className="p-3 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      id={`membro-${membro.conselheiroId}`}
                      checked={membro.presente}
                      onCheckedChange={() => togglePresenca(membro.conselheiroId)}
                      disabled={isSubmitting}
                    />
                    <div className="flex-1">
                      <label
                        htmlFor={`membro-${membro.conselheiroId}`}
                        className="font-medium cursor-pointer"
                      >
                        {membro.nome}
                      </label>
                    </div>
                    <div className="w-32">
                      <Input
                        value={membro.valorJeton.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        onChange={(e) => updateValor(membro.conselheiroId, formatCurrency(e.target.value))}
                        disabled={isSubmitting || !membro.presente}
                        placeholder="Valor"
                        className="text-right"
                      />
                    </div>
                    <div className="w-16 text-right">
                      {membro.presente ? (
                        <CheckCircle className="h-5 w-5 text-green-600 inline" />
                      ) : (
                        <X className="h-5 w-5 text-gray-400 inline" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={isSubmitting}
              placeholder="Informações adicionais sobre a folha de jeton..."
              rows={3}
            />
          </div>

          {/* Ações */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSalvar}
              disabled={isSubmitting || totalPresentes === 0}
              className="cursor-pointer"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Folha'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

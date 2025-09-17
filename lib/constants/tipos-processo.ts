import {
  FileText,
  Home,
  Calculator,
  type LucideIcon
} from 'lucide-react'

export type TipoProcesso =
  | 'COMPENSACAO'
  | 'DACAO_PAGAMENTO'
  | 'TRANSACAO_EXCEPCIONAL'

export interface TipoProcessoInfo {
  label: string
  color: string // classe com borda padrão
  icon: LucideIcon
  description?: string
}

export const TIPOS_PROCESSO_MAP: Record<TipoProcesso, TipoProcessoInfo> = {
  COMPENSACAO: {
    label: 'Compensação',
    color: 'border-gray-300 text-gray-700 bg-white',
    icon: Calculator,
    description: 'Processo de compensação tributária'
  },
  DACAO_PAGAMENTO: {
    label: 'Dação em Pagamento',
    color: 'border-gray-300 text-gray-700 bg-white',
    icon: Home,
    description: 'Processo de dação de bens em pagamento'
  },
  TRANSACAO_EXCEPCIONAL: {
    label: 'Transação Excepcional',
    color: 'border-gray-300 text-gray-700 bg-white',
    icon: FileText,
    description: 'Processo de transação tributária excepcional'
  }
}

// Função utilitária para obter informações do tipo
export function getTipoProcessoInfo(tipo: string): TipoProcessoInfo {
  return TIPOS_PROCESSO_MAP[tipo as TipoProcesso] || {
    label: tipo,
    color: 'border border-gray-300 text-gray-700 bg-white',
    icon: FileText,
    description: 'Tipo de processo desconhecido'
  }
}

// Função para obter opções de tipos disponíveis
export function getTiposProcessoOptions(): Array<{ value: TipoProcesso; label: string; color: string }> {
  const tipos: TipoProcesso[] = ['COMPENSACAO', 'DACAO_PAGAMENTO', 'TRANSACAO_EXCEPCIONAL']

  return tipos.map(tipo => ({
    value: tipo,
    label: TIPOS_PROCESSO_MAP[tipo].label,
    color: TIPOS_PROCESSO_MAP[tipo].color
  }))
}
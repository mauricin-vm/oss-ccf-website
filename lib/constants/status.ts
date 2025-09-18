import {
  Clock,
  AlertCircle,
  Calendar,
  Search,
  DollarSign,
  CheckCircle,
  XCircle,
  Pause,
  Eye,
  AlertTriangle,
  Gavel,
  Scale,
  Ban,
  type LucideIcon
} from 'lucide-react'

export type StatusProcesso =
  | 'RECEPCIONADO'
  | 'EM_ANALISE'
  | 'EM_PAUTA'
  | 'SUSPENSO'
  | 'PEDIDO_VISTA'
  | 'PEDIDO_DILIGENCIA'
  | 'EM_NEGOCIACAO'
  | 'JULGADO'
  | 'EM_CUMPRIMENTO'
  | 'CONCLUIDO'

export interface StatusInfo {
  label: string
  color: string
  icon: LucideIcon
  description?: string
}

export const STATUS_MAP: Record<StatusProcesso, StatusInfo> = {
  RECEPCIONADO: {
    label: 'Recepcionado',
    color: 'bg-gray-100 text-gray-800',
    icon: Clock,
    description: 'Processo recebido, aguardando análise inicial'
  },
  EM_ANALISE: {
    label: 'Em Análise',
    color: 'bg-sky-100 text-sky-800',
    icon: Search,
    description: 'Processo sendo analisado pela equipe técnica'
  },
  EM_PAUTA: {
    label: 'Em Pauta',
    color: 'bg-red-100 text-red-800',
    icon: Calendar,
    description: 'Processo incluído em pauta para julgamento'
  },
  SUSPENSO: {
    label: 'Suspenso',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Pause,
    description: 'Processo suspenso temporariamente'
  },
  PEDIDO_VISTA: {
    label: 'Pedido de Vista',
    color: 'bg-blue-500 text-white',
    icon: Eye,
    description: 'Conselheiro solicitou vista do processo'
  },
  PEDIDO_DILIGENCIA: {
    label: 'Pedido de Diligência',
    color: 'bg-purple-200 text-purple-800',
    icon: AlertTriangle,
    description: 'Solicitada diligência para complementação'
  },
  EM_NEGOCIACAO: {
    label: 'Em Negociação',
    color: 'bg-orange-600 text-white',
    icon: DollarSign,
    description: 'Processo em fase de negociação de acordo'
  },
  JULGADO: {
    label: 'Julgado',
    color: 'bg-green-600 text-white',
    icon: CheckCircle,
    description: 'Processo julgado pela Câmara'
  },
  EM_CUMPRIMENTO: {
    label: 'Em Cumprimento',
    color: 'bg-sky-200 text-sky-800',
    icon: Clock,
    description: 'Acordo em fase de cumprimento'
  },
  CONCLUIDO: {
    label: 'Concluído',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    description: 'Processo totalmente concluído'
  }
}

// Função utilitária para obter informações do status
export function getStatusInfo(status: string): StatusInfo {
  return STATUS_MAP[status as StatusProcesso] || {
    label: status,
    color: 'bg-gray-100 text-gray-800',
    icon: AlertCircle,
    description: 'Status desconhecido'
  }
}

// Função para obter apenas as opções de status disponíveis (excluindo legados)
export function getStatusOptions(): Array<{ value: StatusProcesso; label: string; color: string }> {
  const availableStatus: StatusProcesso[] = [
    'RECEPCIONADO',
    'EM_ANALISE',
    'EM_PAUTA',
    'SUSPENSO',
    'PEDIDO_VISTA',
    'PEDIDO_DILIGENCIA',
    'EM_NEGOCIACAO',
    'JULGADO',
    'EM_CUMPRIMENTO',
    'CONCLUIDO'
  ]

  return availableStatus.map(status => ({
    value: status,
    label: STATUS_MAP[status].label,
    color: STATUS_MAP[status].color
  }))
}

// Grupos de status para análises
export const STATUS_GROUPS = {
  EM_ANALISE_GERAL: ['RECEPCIONADO', 'EM_ANALISE', 'EM_PAUTA'],
  PENDENTES: ['RECEPCIONADO', 'EM_ANALISE', 'EM_PAUTA', 'SUSPENSO', 'PEDIDO_VISTA', 'PEDIDO_DILIGENCIA', 'EM_NEGOCIACAO'],
  FINALIZADOS: ['CONCLUIDO'],
  COM_ACORDO: ['EM_CUMPRIMENTO', 'CONCLUIDO']
} as const

// === RESULTADOS DA SESSÃO ===

export type TipoResultado =
  | 'SUSPENSO'
  | 'PEDIDO_VISTA'
  | 'PEDIDO_DILIGENCIA'
  | 'EM_NEGOCIACAO'
  | 'JULGADO'

export type TipoDecisao =
  | 'DEFERIDO'
  | 'INDEFERIDO'
  | 'PARCIAL'

export type PosicaoVoto =
  | 'DEFERIDO'
  | 'INDEFERIDO'
  | 'PARCIAL'
  | 'ABSTENCAO'
  | 'AUSENTE'
  | 'IMPEDIDO'
  | 'ACOMPANHA'

export const TIPO_RESULTADO_MAP: Record<TipoResultado, StatusInfo> = {
  SUSPENSO: {
    label: 'Suspenso',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Pause,
    description: 'Processo suspenso durante a sessão'
  },
  PEDIDO_VISTA: {
    label: 'Pedido de Vista',
    color: 'bg-blue-500 text-white',
    icon: Eye,
    description: 'Conselheiro solicitou vista do processo'
  },
  PEDIDO_DILIGENCIA: {
    label: 'Pedido de Diligência',
    color: 'bg-purple-200 text-purple-800',
    icon: AlertTriangle,
    description: 'Solicitada diligência para complementação'
  },
  EM_NEGOCIACAO: {
    label: 'Em Negociação',
    color: 'bg-orange-600 text-white',
    icon: DollarSign,
    description: 'Processo em fase de negociação de acordo'
  },
  JULGADO: {
    label: 'Julgado',
    color: 'bg-green-600 text-white',
    icon: Gavel,
    description: 'Processo julgado com decisão final'
  }
}

export const TIPO_DECISAO_MAP: Record<TipoDecisao, StatusInfo> = {
  DEFERIDO: {
    label: 'Deferido',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    description: 'Pedido totalmente aprovado'
  },
  INDEFERIDO: {
    label: 'Indeferido',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
    description: 'Pedido totalmente negado'
  },
  PARCIAL: {
    label: 'Parcialmente Deferido',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Scale,
    description: 'Pedido parcialmente aprovado'
  }
}

export const POSICAO_VOTO_MAP: Record<PosicaoVoto, StatusInfo> = {
  DEFERIDO: {
    label: 'Deferido',
    color: 'text-green-600',
    icon: CheckCircle,
    description: 'Voto favorável ao deferimento'
  },
  INDEFERIDO: {
    label: 'Indeferido',
    color: 'text-red-600',
    icon: XCircle,
    description: 'Voto favorável ao indeferimento'
  },
  PARCIAL: {
    label: 'Parcial',
    color: 'text-yellow-600',
    icon: Scale,
    description: 'Voto favorável ao deferimento parcial'
  },
  ABSTENCAO: {
    label: 'Abstenção',
    color: 'text-gray-600',
    icon: Ban,
    description: 'Conselheiro se absteve de votar'
  },
  AUSENTE: {
    label: 'Ausente',
    color: 'text-gray-600',
    icon: XCircle,
    description: 'Conselheiro ausente na votação'
  },
  IMPEDIDO: {
    label: 'Impedido',
    color: 'text-gray-600',
    icon: Ban,
    description: 'Conselheiro impedido de votar'
  },
  ACOMPANHA: {
    label: 'Acompanha',
    color: 'text-blue-600',
    icon: Eye,
    description: 'Acompanha voto do relator/revisor'
  }
}

// Funções utilitárias para resultados da sessão
export function getTipoResultadoInfo(tipo: string): StatusInfo {
  return TIPO_RESULTADO_MAP[tipo as TipoResultado] || {
    label: tipo,
    color: 'bg-gray-100 text-gray-800',
    icon: AlertCircle,
    description: 'Resultado desconhecido'
  }
}

export function getTipoDecisaoInfo(tipo: string): StatusInfo {
  return TIPO_DECISAO_MAP[tipo as TipoDecisao] || {
    label: tipo,
    color: 'bg-gray-100 text-gray-800',
    icon: AlertCircle,
    description: 'Decisão desconhecida'
  }
}

export function getPosicaoVotoInfo(posicao: string): StatusInfo {
  return POSICAO_VOTO_MAP[posicao as PosicaoVoto] || {
    label: posicao,
    color: 'text-gray-600',
    icon: AlertCircle,
    description: 'Posição desconhecida'
  }
}

// Função para obter badge do resultado com base no tipo e decisão
export function getResultadoBadge(tipoResultado: string, tipoDecisao?: string) {
  if (tipoResultado === 'JULGADO' && tipoDecisao) {
    const info = getTipoDecisaoInfo(tipoDecisao)
    return {
      label: info.label,
      color: info.color,
      icon: info.icon
    }
  }

  const info = getTipoResultadoInfo(tipoResultado)
  return {
    label: info.label,
    color: info.color,
    icon: info.icon
  }
}

// Função para obter cor de fundo do card baseada no tipo de resultado
export function getCardBackground(tipoResultado: string) {
  if (!tipoResultado) return 'bg-gray-50'

  // Mapear as cores dos badges para cores de fundo (-50) e bordas (-300)
  const colorMap: Record<string, string> = {
    'SUSPENSO': 'bg-yellow-50 border-yellow-300',
    'PEDIDO_VISTA': 'bg-blue-50 border-blue-400',
    'PEDIDO_DILIGENCIA': 'bg-purple-50 border-purple-300',
    'EM_NEGOCIACAO': 'bg-orange-50 border-orange-400',
    'JULGADO': 'bg-green-50 border-green-400'
  }

  return colorMap[tipoResultado] || 'bg-gray-50'
}
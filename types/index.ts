import { User, Processo, Contribuinte, Tramitacao, Acordo, Parcela, Pauta, SessaoJulgamento, ProcessoPauta } from '@prisma/client'

export type UserWithoutPassword = Omit<User, 'password'>

export type ProcessoWithRelations = Processo & {
  contribuinte: Contribuinte
  tramitacoes?: (Tramitacao & {
    usuario?: { name: string }
  })[]
  acordo?: Acordo & {
    parcelas: Parcela[]
    detalhes?: Record<string, unknown>[]
  }
  decisoes?: Record<string, unknown>[]
  acordos?: Record<string, unknown>[]
  documentos?: Record<string, unknown>[]
  pautas?: Record<string, unknown>[]
  imoveis?: Record<string, unknown>[]
  creditos?: Record<string, unknown>[]
  valoresEspecificos?: {
    id: string
    creditos?: Array<{
      id: string
      valor: number
      credito: Record<string, unknown>
    }>
    inscricoes?: Array<{
      id: string
      inscricao: Record<string, unknown>
      debitos?: Array<{
        id: string
        valor: number
        debito: Record<string, unknown>
      }>
    }>
    imoveis?: Array<{
      id: string
      valorAvaliacao: number
      imovel: {
        id: string
        endereco: string
        valorAvaliacao?: number
        [key: string]: unknown
      }
    }>
    debitos?: Array<{
      id: string
      valor: number
      debito: Record<string, unknown>
    }>
    valorOriginal?: number
    valorNegociado?: number
    valorEntrada?: number | null
    transacao?: Record<string, unknown>
  }
}

export type PautaWithRelations = Pauta & {
  processos: (ProcessoPauta & {
    processo: ProcessoWithRelations
  })[]
  sessao?: SessaoJulgamento & {
    presidente?: Record<string, unknown>
    conselheiros?: Record<string, unknown>[]
    decisoes?: Record<string, unknown>[]
  }
  conselheiros?: User[]
  historicos?: Record<string, unknown>[]
}

export type SessaoWithRelations = SessaoJulgamento & {
  pauta: Pauta
  conselheiros: User[]
}

export type SessionUser = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'FUNCIONARIO' | 'VISUALIZADOR'
}

// Interfaces para filtros de busca nas APIs
export interface PrismaWhereFilter {
  OR?: Array<{
    numero?: { contains: string; mode: 'insensitive' }
    nome?: { contains: string; mode: 'insensitive' }
    email?: { contains: string; mode: 'insensitive' }
    ativo?: boolean
  }>
  status?: string
  ativo?: boolean
  numero?: { contains: string; mode: 'insensitive' }
  nome?: { contains: string; mode: 'insensitive' }
  email?: { contains: string; mode: 'insensitive' }
  dataPauta?: {
    gte?: Date
    lte?: Date
  }
  dataInicio?: {
    gte?: Date
    lte?: Date
  }
  dataFim?: null | { not: null }
  setorOrigem?: string
  setorDestino?: string
  dataRecebimento?: null | { not: null }
  prazoResposta?: null | { gte: Date } | { lt: Date }
  pauta?: {
    numero?: { contains: string; mode: 'insensitive' }
  }
  conselheiros?: {
    some: {
      name?: { contains: string; mode: 'insensitive' }
    }
  }
  processo?: {
    numero?: { contains: string; mode: 'insensitive' }
    contribuinte?: {
      nome?: { contains: string; mode: 'insensitive' }
      cpfCnpj?: { contains: string }
    }
  }
}

export interface AcordoWhereFilter {
  OR?: Array<{
    processo?: {
      numero?: { contains: string; mode: 'insensitive' }
      contribuinte?: {
        nome?: { contains: string; mode: 'insensitive' }
      }
    }
  }>
  status?: string
  dataAssinatura?: {
    gte?: Date
    lte?: Date
  }
}

export interface ProcessoWhereFilter {
  OR?: Array<{
    numero?: { contains: string; mode: 'insensitive' }
    contribuinte?: {
      nome?: { contains: string; mode: 'insensitive' }
      cpfCnpj?: { contains: string }
    }
  }>
  tipo?: string
  status?: string
}

export interface UserWhereFilter {
  OR?: Array<{
    name?: { contains: string; mode: 'insensitive' }
    email?: { contains: string; mode: 'insensitive' }
  }>
  role?: string
  active?: boolean
}

// Interfaces para operações de atualização nas APIs
export interface AcordoUpdateData {
  dataVencimento?: Date
  observacoes?: string
  clausulasEspeciais?: string
  status?: 'ativo' | 'vencido' | 'cancelado' | 'cumprido'
  updatedAt?: Date
}

export interface ProcessoUpdateData {
  numero?: string
  tipo?: string
  status?: string
  valorOriginal?: number
  valorNegociado?: number
  observacoes?: string
  updatedAt?: Date
}

export interface UserUpdateData {
  name?: string
  email?: string
  password?: string
  role?: 'ADMIN' | 'FUNCIONARIO' | 'VISUALIZADOR'
  active?: boolean
}

export interface PautaUpdateData {
  numero?: string
  dataPauta?: Date
  status?: string
  observacoes?: string
  updatedAt?: Date
}

export interface SessaoUpdateData {
  ata?: string
  dataFim?: Date
  conselheiros?: {
    set: Array<{ id: string }>
  }
  updatedAt?: Date
}

export interface TramitacaoUpdateData {
  setorOrigem?: string
  setorDestino?: string
  prazoResposta?: Date
  observacoes?: string
  dataRecebimento?: Date
  updatedAt?: Date
}
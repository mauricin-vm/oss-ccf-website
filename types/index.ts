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
  acordao?: ProcessoAcordao
  decisoes?: ProcessoDecisao[]
  acordos?: ProcessoAcordo[]
  documentos?: ProcessoDocumento[]
  pautas?: ProcessoPautaWithDetails[]
  historicos?: ProcessoHistorico[]
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
  pauta?: Pauta | null
  conselheiros: User[]
}

export type SessionUser = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'FUNCIONARIO' | 'VISUALIZADOR'
}

export type TipoSessao = 'JULGAMENTO' | 'ADMINISTRATIVA'

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
  tipoSessao?: TipoSessao
  pautaId?: string | null
  agenda?: string
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

// Tipos específicos para evitar Record<string, unknown>
export interface ProcessoDecisao {
  id: string
  tipoResultado: 'JULGADO' | 'SUSPENSO' | 'PEDIDO_VISTA' | 'PEDIDO_DILIGENCIA'
  tipoDecisao?: 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL'
  dataDecisao: string
  definirAcordo?: boolean
  tipoAcordo?: string
  sessao?: {
    id: string
    pauta?: {
      id: string
      numero: string
      dataPauta: string
    }
    presidente?: {
      id: string
      nome: string
    }
  }
  votos?: ProcessoVoto[]
}

export interface ProcessoVoto {
  id: string
  tipoVoto: 'RELATOR' | 'REVISOR' | 'CONSELHEIRO'
  posicaoVoto: 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL' | 'ABSTENCAO' | 'AUSENTE' | 'IMPEDIDO'
  nomeVotante: string
  conselheiroId?: string
  acompanhaVoto?: string
}

export interface ProcessoAcordo {
  id: string
  numeroTermo: string
  status: 'ativo' | 'cancelado' | 'cumprido' | 'vencido'
  dataAssinatura: string
  dataVencimento: string
  modalidadePagamento: 'avista' | 'parcelado'
  numeroParcelas: number
  valorFinal: number
  parcelas: ProcessoParcela[]
  transacao?: boolean | {
    custasAdvocaticias: number
    custasDataVencimento: string
    custasDataPagamento: string
    honorariosValor: number
    honorariosMetodoPagamento: string
    honorariosParcelas: number
    valorTotalProposto: number
    valorEntrada: number
  }
  transacaoDetails?: {
    tipoTransacao: string
    valorTransacao: number
    percentualDesconto: number
    modalidadePagamento: string
    numeroParcelas: number
    valorParcela: number
    custasAdvocaticias?: number
    custasDataVencimento?: string
    custasDataPagamento?: string
    honorariosValor?: number
    honorariosMetodoPagamento?: string
    honorariosParcelas?: number
    valorTotalProposto?: number
    entrada?: number
    totalGeral?: number
  }
  compensacao?: boolean | {
    custasAdvocaticias: number
    honorariosValor: number
    valorTotalCreditos: number
    valorTotalDebitos: number
    valorLiquido: number
    custasDataVencimento: string
    custasDataPagamento: string
    honorariosMetodoPagamento: string
    honorariosParcelas: number
    honorariosDataVencimento: string
    honorariosDataPagamento: string
  }
  compensacaoDetails?: {
    tipoCompensacao: string
    valorCompensacao: number
    numeroCredito: string
    valorCredito: number
    valorTotalCreditos?: number
    valorTotalDebitos?: number
    valorLiquido?: number
    custasAdvocaticias?: number
    honorariosValor?: number
    custasDataVencimento?: string
    custasDataPagamento?: string
    honorariosMetodoPagamento?: string
    honorariosParcelas?: number
    honorariosDataVencimento?: string
    honorariosDataPagamento?: string
  }
  dacao?: boolean | {
    custasAdvocaticias: number
    honorariosValor: number
    valorAvaliado: number
    valorLiquido: number
    valorTotalOferecido: number
    valorTotalCompensar: number
    custasDataVencimento: string
    custasDataPagamento: string
    honorariosMetodoPagamento: string
    honorariosParcelas: number
    honorariosDataVencimento: string
    honorariosDataPagamento: string
  }
  dacaoDetails?: {
    tipoDacao: string
    valorDacao: number
    descricaoBem: string
    valorAvaliado: number
    valorLiquido?: number
    custasAdvocaticias?: number
    honorariosValor?: number
    valorTotalOferecido?: number
    valorTotalCompensar?: number
    custasDataVencimento?: string
    custasDataPagamento?: string
    honorariosMetodoPagamento?: string
    honorariosParcelas?: number
    honorariosDataVencimento?: string
    honorariosDataPagamento?: string
  }
  detalhes?: {
    id: string
    tipo: string
    descricao: string
    valorOriginal: number
    valorNegociado: number
    observacoes?: string
    valorAvaliado?: number
    [key: string]: unknown
  }[]
}

export interface ProcessoParcela {
  id: string
  numero: number
  valor: number
  dataVencimento: string
  status: 'PENDENTE' | 'PAGA' | 'VENCIDA' | 'CANCELADA'
  tipoParcela?: string
  pagamentos?: ProcessoPagamento[]
}

export interface ProcessoPagamento {
  id: string
  valorPago: number
  dataPagamento: string
}

// Interfaces para Relatórios
export interface EvolucaoMensalItem {
  mes: number
  ano: number
  valor: number
  acordos: {
    valor: number
    quantidade: number
  }
  parcelas: {
    valor: number
    quantidade: number
  }
  total: {
    valor: number
    quantidade: number
  }
}

export interface ValorPorTipoProcesso {
  tipo: 'COMPENSACAO' | 'DACAO_PAGAMENTO' | 'TRANSACAO_EXCEPCIONAL'
  _count: number
  _sum: {
    valorTotal: number
  }
}

export interface ValorPorResultado {
  tipoDecisao: 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL'
  valorTotal: number
}

export interface ProcessoDocumento {
  id: string
  nome: string
  tipo: string
  url: string
  tamanho: number
  createdAt: string
}

export interface ProcessoPautaWithDetails {
  id: string
  ordem: number
  relator?: string
  revisores?: string[]
  distribuidoPara?: string
  ataTexto?: string
  pauta: {
    id: string
    numero: string
    dataPauta: string
  }
}

export interface ProcessoHistorico {
  id: string
  tipo: 'EVENTO' | 'OBSERVACAO' | 'ALTERACAO' | 'COMUNICACAO' | 'DECISAO' | 'SISTEMA' | 'PAUTA' | 'REPAUTAMENTO' | 'TRAMITACAO' | 'TRAMITACAO_ENTREGUE' | 'ACORDO' | 'ACORDO_CONCLUIDO'
  titulo: string
  descricao: string
  createdAt: string
  usuario: {
    name: string
  }
}

export interface AcordoDetalhe {
  id: string
  tipo: string
  descricao: string
  valorOriginal: number
  valorNegociado: number
  status: string
  dataExecucao?: string
  observacoes?: string
  imovel?: {
    id: string
    endereco?: string
    valorAvaliado?: number
    [key: string]: unknown
  }
  inscricoes?: Array<{
    id: string
    numeroInscricao: string
    tipoInscricao: string
    valorDebito: number
    valorAbatido: number
    situacao: string
  }>
}

export interface ProcessoAcordao {
  id: string
  numeroAcordao?: string | null
  dataPublicacao?: string | null
  numeroPublicacao?: string | null
}
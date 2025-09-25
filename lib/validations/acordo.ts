import { z } from 'zod'

// Enums
export const tipoProcessoEnum = z.enum(['TRANSACAO_EXCEPCIONAL', 'COMPENSACAO', 'DACAO_PAGAMENTO'])
export const tipoInscricaoEnum = z.enum(['IMOBILIARIA', 'ECONOMICA'])
export const finalidadeInscricaoEnum = z.enum(['INCLUIDA_ACORDO', 'OFERECIDA_COMPENSACAO', 'OFERECIDA_DACAO'])
export const tipoParcelaEnum = z.enum(['ENTRADA', 'PARCELA_ACORDO', 'PARCELA_HONORARIOS'])

// Schema base para acordo
export const acordoBaseSchema = z.object({
  processoId: z.string().min(1, 'Processo é obrigatório'),
  numeroTermo: z.string().optional(),
  tipoProcesso: tipoProcessoEnum,
  dataAssinatura: z.date({
    message: 'Data de assinatura é obrigatória'
  }),
  dataVencimento: z.date({
    message: 'Data de vencimento é obrigatória'
  }),
  observacoes: z.string().optional()
})

// Schema para débitos
export const acordoDebitoSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  valorLancado: z.number().min(0.01, 'Valor deve ser maior que zero'),
  dataVencimento: z.date({
    message: 'Data de vencimento é obrigatória'
  })
})

// Schema para inscrições
export const acordoInscricaoSchema = z.object({
  numeroInscricao: z.string().min(1, 'Número da inscrição é obrigatório'),
  tipoInscricao: tipoInscricaoEnum,
  finalidade: finalidadeInscricaoEnum,
  valorTotal: z.number().min(0.01, 'Valor total deve ser maior que zero'),
  descricao: z.string().optional(),
  dataVencimento: z.date().optional(),
  debitos: z.array(acordoDebitoSchema).min(1, 'Pelo menos um débito é obrigatório')
})

// Schema para créditos (compensação)
export const acordoCreditoSchema = z.object({
  tipoCredito: z.string().min(1, 'Tipo de crédito é obrigatório'),
  numeroCredito: z.string().min(1, 'Número do crédito é obrigatório'),
  valor: z.number().min(0.01, 'Valor deve ser maior que zero'),
  descricao: z.string().optional(),
  dataVencimento: z.date().optional()
})

// Schema para transação excepcional
export const acordoTransacaoSchema = z.object({
  valorTotalProposto: z.number().min(0.01, 'Valor total proposto deve ser maior que zero'),
  metodoPagamento: z.enum(['avista', 'parcelado'], {
    message: 'Método de pagamento é obrigatório'
  }),
  valorEntrada: z.number().min(0).optional(),
  quantidadeParcelas: z.number().min(1, 'Quantidade de parcelas deve ser maior que zero'),
  valorParcela: z.number().min(0).optional(),
  custasAdvocaticias: z.number().min(0).optional(),
  honorariosValor: z.number().min(0).optional(),
  honorariosMetodoPagamento: z.enum(['avista', 'parcelado']).optional(),
  honorariosParcelas: z.number().min(1).optional(),
  honorariosValorParcela: z.number().min(0).optional()
}).refine((data) => {
  if (data.metodoPagamento === 'parcelado') {
    return data.quantidadeParcelas >= 1
  }
  return true
}, {
  message: 'Parcelamento deve ter pelo menos 1 parcela',
  path: ['quantidadeParcelas']
})

// Schema para compensação
export const acordoCompensacaoSchema = z.object({
  valorTotalCreditos: z.number().min(0.01, 'Valor total dos créditos deve ser maior que zero'),
  valorTotalDebitos: z.number().min(0.01, 'Valor total dos débitos deve ser maior que zero'),
  valorLiquido: z.number()
})

// Schema para dação
export const acordoDacaoSchema = z.object({
  valorTotalOferecido: z.number().min(0.01, 'Valor total oferecido deve ser maior que zero'),
  valorTotalCompensar: z.number().min(0.01, 'Valor total a compensar deve ser maior que zero'),
  valorLiquido: z.number()
})

// Schema principal unificado
export const acordoSchema = z.discriminatedUnion('tipoProcesso', [
  // Transação Excepcional
  z.object({
    ...acordoBaseSchema.shape,
    tipoProcesso: z.literal('TRANSACAO_EXCEPCIONAL'),
    transacao: acordoTransacaoSchema,
    inscricoes: z.array(acordoInscricaoSchema.extend({
      finalidade: z.literal('INCLUIDA_ACORDO')
    })).min(1, 'Pelo menos uma inscrição deve ser incluída')
  }),

  // Compensação
  z.object({
    ...acordoBaseSchema.shape,
    tipoProcesso: z.literal('COMPENSACAO'),
    compensacao: acordoCompensacaoSchema,
    creditos: z.array(acordoCreditoSchema).min(1, 'Pelo menos um crédito é obrigatório'),
    inscricoes: z.array(acordoInscricaoSchema.extend({
      finalidade: z.literal('INCLUIDA_ACORDO')
    })).min(1, 'Pelo menos uma inscrição deve ser incluída')
  }),

  // Dação em Pagamento
  z.object({
    ...acordoBaseSchema.shape,
    tipoProcesso: z.literal('DACAO_PAGAMENTO'),
    dacao: acordoDacaoSchema,
    inscricoes: z.array(acordoInscricaoSchema).min(2, 'Dação requer inscrições oferecidas e a compensar')
  })
])

// Schema para parcelas
export const parcelaSchema = z.object({
  acordoId: z.string().min(1, 'Acordo é obrigatório'),
  tipoParcela: tipoParcelaEnum.default('PARCELA_ACORDO'),
  numero: z.number().min(1, 'Número da parcela deve ser maior que zero'),
  valor: z.number().min(0.01, 'Valor da parcela deve ser maior que zero'),
  dataVencimento: z.date({
    message: 'Data de vencimento é obrigatória'
  }),
  dataPagamento: z.date().optional(),
  status: z.enum(['PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO']).default('PENDENTE')
})

// Schema para pagamentos
export const pagamentoParcelaSchema = z.object({
  parcelaId: z.string().min(1, 'Parcela é obrigatória'),
  valorPago: z.number().min(0.01, 'Valor pago deve ser maior que zero'),
  dataPagamento: z.date({
    message: 'Data de pagamento é obrigatória'
  }),
  formaPagamento: z.enum(['PIX', 'TED', 'DINHEIRO', 'BOLETO', 'CARTAO', 'DACAO', 'COMPENSACAO'], {
    message: 'Forma de pagamento é obrigatória'
  }),
  numeroComprovante: z.string().optional(),
  observacoes: z.string().optional()
})

// Tipos TypeScript
export type AcordoInput = z.infer<typeof acordoSchema>
export type AcordoBaseInput = z.infer<typeof acordoBaseSchema>
export type AcordoTransacaoInput = z.infer<typeof acordoTransacaoSchema>
export type AcordoCompensacaoInput = z.infer<typeof acordoCompensacaoSchema>
export type AcordoDacaoInput = z.infer<typeof acordoDacaoSchema>
export type AcordoInscricaoInput = z.infer<typeof acordoInscricaoSchema>
export type AcordoDebitoInput = z.infer<typeof acordoDebitoSchema>
export type AcordoCreditoInput = z.infer<typeof acordoCreditoSchema>
export type ParcelaInput = z.infer<typeof parcelaSchema>
export type PagamentoParcelaInput = z.infer<typeof pagamentoParcelaSchema>
import { z } from 'zod'

export const acordoSchema = z.object({
  processoId: z.string().min(1, 'Processo é obrigatório'),
  valorTotal: z.number().min(0.01, 'Valor total deve ser maior que zero'),
  valorDesconto: z.number().min(0, 'Valor do desconto não pode ser negativo').optional(),
  percentualDesconto: z.number().min(0).max(100, 'Percentual deve estar entre 0 e 100').optional(),
  valorFinal: z.number().min(0.01, 'Valor final deve ser maior que zero'),
  dataAssinatura: z.date({
    required_error: 'Data de assinatura é obrigatória'
  }),
  dataVencimento: z.date({
    required_error: 'Data de vencimento é obrigatória'
  }),
  modalidadePagamento: z.enum(['avista', 'parcelado'], {
    required_error: 'Modalidade de pagamento é obrigatória'
  }),
  numeroParcelas: z.number().min(1, 'Número de parcelas deve ser maior que zero'),
  observacoes: z.string().optional(),
  clausulasEspeciais: z.string().optional(),
  // Dados específicos por tipo de processo
  dadosEspecificos: z.object({
    // Transação Excepcional
    inscricoesSelecionadas: z.array(z.string()).optional(),
    debitosSelecionados: z.record(z.array(z.string())).optional(),
    inscricoesSelecionadasDetalhes: z.array(z.any()).optional(),
    propostaFinal: z.object({
      valorTotalProposto: z.number(),
      metodoPagamento: z.string(),
      valorEntrada: z.number(),
      quantidadeParcelas: z.number()
    }).optional(),
    observacoesAcordo: z.string().optional(),
    // Compensação
    creditosSelecionados: z.array(z.string()).optional(),
    valorCreditos: z.number().optional(),
    valorDebitos: z.number().optional(),
    valorCompensacao: z.number().optional(),
    saldoFinal: z.number().optional(),
    // Dação em Pagamento
    inscricoesOferecidas: z.array(z.string()).optional(),
    inscricoesCompensar: z.array(z.string()).optional(),
    valorOferecido: z.number().optional(),
    valorCompensar: z.number().optional(),
    valorDacao: z.number().optional()
  }).optional()
}).refine((data) => {
  if (data.modalidadePagamento === 'parcelado') {
    return data.numeroParcelas >= 2
  }
  return true
}, {
  message: 'Parcelamento deve ter pelo menos 2 parcelas',
  path: ['numeroParcelas']
})

export const parcelaSchema = z.object({
  acordoId: z.string().min(1, 'Acordo é obrigatório'),
  numero: z.number().min(1, 'Número da parcela deve ser maior que zero'),
  valor: z.number().min(0.01, 'Valor da parcela deve ser maior que zero'),
  dataVencimento: z.date({
    required_error: 'Data de vencimento é obrigatória'
  }),
  dataPagamento: z.date().optional(),
  valorPago: z.number().min(0, 'Valor pago não pode ser negativo').optional(),
  status: z.enum(['pendente', 'paga', 'vencida', 'cancelada']).default('pendente'),
  observacoes: z.string().optional()
})

export const pagamentoSchema = z.object({
  parcelaId: z.string().min(1, 'Parcela é obrigatória'),
  dataPagamento: z.date({
    required_error: 'Data de pagamento é obrigatória'
  }),
  valorPago: z.number().min(0.01, 'Valor pago deve ser maior que zero'),
  formaPagamento: z.enum(['dinheiro', 'pix', 'transferencia', 'boleto', 'cartao', 'dacao', 'compensacao'], {
    required_error: 'Forma de pagamento é obrigatória'
  }),
  numeroComprovante: z.string().optional(),
  observacoes: z.string().optional()
})

export const renovacaoAcordoSchema = z.object({
  acordoId: z.string().min(1, 'Acordo é obrigatório'),
  novoValorTotal: z.number().min(0.01, 'Novo valor total deve ser maior que zero'),
  novaDataVencimento: z.date({
    required_error: 'Nova data de vencimento é obrigatória'
  }),
  motivo: z.string().min(10, 'Motivo deve ter pelo menos 10 caracteres'),
  observacoes: z.string().optional()
})

export type AcordoInput = z.infer<typeof acordoSchema>
export type ParcelaInput = z.infer<typeof parcelaSchema>
export type PagamentoInput = z.infer<typeof pagamentoSchema>
export type RenovacaoAcordoInput = z.infer<typeof renovacaoAcordoSchema>
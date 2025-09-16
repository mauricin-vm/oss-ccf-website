import { z } from 'zod'

// Esquema base para inscrições
export const inscricaoSchema = z.object({
  numeroInscricao: z.string().min(1, 'Número da inscrição é obrigatório'),
  tipoInscricao: z.enum(['imobiliaria', 'economica'], {
    message: 'Tipo de inscrição é obrigatório'
  }),
  valorDebito: z.number().min(0.01, 'Valor do débito deve ser maior que zero'),
  percentualAbatido: z.number().min(0).max(100, 'Percentual deve estar entre 0 e 100'),
  situacao: z.string().default('pendente')
})

// Schema para Dação em Pagamento
export const imovelDacaoSchema = z.object({
  matricula: z.string().min(1, 'Matrícula é obrigatória'),
  endereco: z.string().min(1, 'Endereço é obrigatório'),
  cidade: z.string().min(1, 'Cidade é obrigatória'),
  estado: z.string().min(1, 'Estado é obrigatório'),
  valorAvaliado: z.number().min(0.01, 'Valor avaliado deve ser maior que zero'),
  descricao: z.string().optional(),
  inscricoes: z.array(inscricaoSchema).min(1, 'Pelo menos uma inscrição deve ser informada')
})

export const valoresDacaoSchema = z.object({
  imoveis: z.array(imovelDacaoSchema).min(1, 'Pelo menos um imóvel deve ser cadastrado'),
  observacoes: z.string().optional()
}).refine(
  (data) => {
    // Validar que o valor total dos imóveis cobre os débitos a serem abatidos
    const valorTotalImoveis = data.imoveis.reduce((total, imovel) => total + imovel.valorAvaliado, 0)
    const valorTotalDebitos = data.imoveis.reduce((total, imovel) => {
      return total + imovel.inscricoes.reduce((subtotal, inscricao) => {
        return subtotal + (inscricao.valorDebito * inscricao.percentualAbatido / 100)
      }, 0)
    }, 0)
    return valorTotalImoveis >= valorTotalDebitos
  },
  {
    message: "O valor total dos imóveis deve ser maior ou igual ao valor total dos débitos a serem abatidos"
  }
)

// Schema para Compensação
export const creditoCompensacaoSchema = z.object({
  tipo: z.enum(['precatorio', 'credito_tributario', 'alvara_judicial', 'outro'], {
    message: 'Tipo de crédito é obrigatório'
  }),
  numero: z.string().min(1, 'Número do crédito é obrigatório'),
  valor: z.number().min(0.01, 'Valor deve ser maior que zero'),
  dataVencimento: z.string().optional(),
  descricao: z.string().optional(),
  inscricoes: z.array(inscricaoSchema).min(1, 'Pelo menos uma inscrição deve ser informada')
})

export const valoresCompensacaoSchema = z.object({
  creditos: z.array(creditoCompensacaoSchema).min(1, 'Pelo menos um crédito deve ser cadastrado'),
  observacoes: z.string().optional()
}).refine(
  (data) => {
    // Validar que o valor total dos créditos cobre os débitos a serem compensados
    const valorTotalCreditos = data.creditos.reduce((total, credito) => total + credito.valor, 0)
    const valorTotalDebitos = data.creditos.reduce((total, credito) => {
      return total + credito.inscricoes.reduce((subtotal, inscricao) => {
        return subtotal + (inscricao.valorDebito * inscricao.percentualAbatido / 100)
      }, 0)
    }, 0)
    return valorTotalCreditos >= valorTotalDebitos
  },
  {
    message: "O valor total dos créditos deve ser maior ou igual ao valor total dos débitos a serem compensados"
  }
)

// Schema para Transação Excepcional
export const condicaoEspecialSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  tipo: z.enum(['desconto', 'parcelamento', 'prazo', 'outro'], {
    message: 'Tipo de condição é obrigatório'
  }),
  valor: z.number().min(0, 'Valor não pode ser negativo').optional(),
  percentual: z.number().min(0).max(100, 'Percentual deve estar entre 0 e 100').optional(),
  prazoMeses: z.number().min(1, 'Prazo deve ser maior que zero').optional(),
  observacoes: z.string().optional()
}).refine(
  (data) => {
    // Para descontos, deve ter valor OU percentual
    if (data.tipo === 'desconto') {
      return (data.valor !== undefined && data.valor > 0) || (data.percentual !== undefined && data.percentual > 0)
    }
    // Para prazos e parcelamentos, deve ter prazoMeses
    if (data.tipo === 'prazo' || data.tipo === 'parcelamento') {
      return data.prazoMeses !== undefined && data.prazoMeses > 0
    }
    return true
  },
  {
    message: "Condições especiais devem ter os campos obrigatórios preenchidos"
  }
)

export const valoresTransacaoSchema = z.object({
  valorOriginal: z.number().min(0.01, 'Valor original deve ser maior que zero'),
  modalidadeEscolhida: z.enum(['avista', 'parcelado'], {
    message: 'Modalidade é obrigatória'
  }),
  valorEntrada: z.number().min(0, 'Valor da entrada não pode ser negativo').optional(),
  numeroParcelas: z.number().min(1, 'Número de parcelas deve ser maior que zero').optional(),
  valorFinal: z.number().min(0.01, 'Valor final deve ser maior que zero'),
  condicoesEspeciais: z.array(condicaoEspecialSchema).min(0),
  observacoes: z.string().optional()
}).refine(
  (data) => {
    // Se modalidade é parcelada, numeroParcelas é obrigatório e deve ser > 1
    if (data.modalidadeEscolhida === 'parcelado') {
      return data.numeroParcelas !== undefined && data.numeroParcelas > 1
    }
    return true
  },
  {
    message: "Para modalidade parcelada, número de parcelas deve ser maior que 1"
  }
).refine(
  (data) => {
    // Valor final deve ser menor ou igual ao valor original
    return data.valorFinal <= data.valorOriginal
  },
  {
    message: "Valor final não pode ser maior que o valor original"
  }
)

// Schemas para uso nos tipos
export type InscricaoInput = z.infer<typeof inscricaoSchema>
export type ImovelDacaoInput = z.infer<typeof imovelDacaoSchema>
export type ValoresDacaoInput = z.infer<typeof valoresDacaoSchema>
export type CreditoCompensacaoInput = z.infer<typeof creditoCompensacaoSchema>
export type ValoresCompensacaoInput = z.infer<typeof valoresCompensacaoSchema>
export type CondicaoEspecialInput = z.infer<typeof condicaoEspecialSchema>
export type ValoresTransacaoInput = z.infer<typeof valoresTransacaoSchema>

// Schemas auxiliares para validações específicas
export const validarEquilibrioDacao = (valorImoveis: number, valorDebitos: number) => {
  return z.object({
    valorImoveis: z.number(),
    valorDebitos: z.number()
  }).refine(
    (data) => data.valorImoveis >= data.valorDebitos,
    { message: "Valor dos imóveis deve cobrir os débitos" }
  ).parse({ valorImoveis, valorDebitos })
}

export const validarEquilibrioCompensacao = (valorCreditos: number, valorDebitos: number) => {
  return z.object({
    valorCreditos: z.number(),
    valorDebitos: z.number()
  }).refine(
    (data) => data.valorCreditos >= data.valorDebitos,
    { message: "Valor dos créditos deve cobrir os débitos" }
  ).parse({ valorCreditos, valorDebitos })
}

export const validarCondicoesTransacao = (valorOriginal: number, valorFinal: number, percentualDesconto: number) => {
  return z.object({
    valorOriginal: z.number(),
    valorFinal: z.number(),
    percentualDesconto: z.number()
  }).refine(
    (data) => data.valorFinal <= data.valorOriginal,
    { message: "Valor final deve ser menor ou igual ao original" }
  ).refine(
    (data) => data.percentualDesconto >= 0 && data.percentualDesconto <= 100,
    { message: "Percentual de desconto deve estar entre 0 e 100%" }
  ).parse({ valorOriginal, valorFinal, percentualDesconto })
}
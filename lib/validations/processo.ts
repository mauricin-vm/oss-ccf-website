import { z } from 'zod'

export const contribuinteSchema = z.object({
  cpfCnpj: z.string().optional(),
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional()
})

export const processoSchema = z.object({
  numero: z.string().min(1, 'Número do processo é obrigatório'),
  tipo: z.string()
    .min(1, 'Selecione um tipo de processo')
    .refine(
      (val) => ['COMPENSACAO', 'DACAO_PAGAMENTO', 'TRANSACAO_EXCEPCIONAL'].includes(val),
      { message: 'Selecione um tipo válido de processo' }
    ),
  valorOriginal: z.string().or(z.number()).transform(val => Number(val)),
  valorNegociado: z.string().or(z.number()).transform(val => Number(val)).optional(),
  observacoes: z.string().optional(),
  contribuinte: contribuinteSchema
})

export const tramitacaoSchema = z.object({
  processoId: z.string().min(1, 'Processo é obrigatório'),
  setorOrigem: z.string({
    required_error: 'Selecione o setor de origem',
    invalid_type_error: 'Selecione o setor de origem'
  }).min(1, 'Selecione o setor de origem'),
  setorDestino: z.string({
    required_error: 'Selecione o setor de destino',
    invalid_type_error: 'Selecione o setor de destino'
  }).min(1, 'Selecione o setor de destino'),
  prazoResposta: z.string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Data inválida'
    })
    .transform((val) => val ? new Date(val) : undefined),
  observacoes: z.string().optional()
})

export type ContribuinteInput = z.infer<typeof contribuinteSchema>
export type ProcessoInput = z.infer<typeof processoSchema>
export type TramitacaoInput = z.infer<typeof tramitacaoSchema>
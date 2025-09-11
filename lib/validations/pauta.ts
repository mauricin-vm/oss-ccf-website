import { z } from 'zod'

export const pautaSchema = z.object({
  numero: z.string().min(1, 'Número da pauta é obrigatório'),
  dataPauta: z.date({
    required_error: 'Data da pauta é obrigatória'
  }),
  observacoes: z.string().optional(),
  processos: z.array(z.object({
    processoId: z.string().min(1, 'ID do processo é obrigatório'),
    ordem: z.number().positive('Ordem deve ser um número positivo'),
    relator: z.string().min(1, 'Distribuição (relator ou revisor) é obrigatória')
  }), {
    required_error: 'Lista de processos é obrigatória',
    invalid_type_error: 'Lista de processos deve ser um array'
  }).min(1, 'Pelo menos um processo deve ser incluído na pauta')
})

export const sessaoSchema = z.object({
  pautaId: z.string().min(1, 'Pauta é obrigatória'),
  dataInicio: z.date({
    required_error: 'Data de início é obrigatória'
  }),
  conselheiros: z.array(z.string()).min(1, 'Pelo menos um conselheiro deve participar'),
  ata: z.string().optional()
})

export const decisaoSchema = z.object({
  processoId: z.string().min(1, 'Processo é obrigatório'),
  sessaoId: z.string().optional(),
  tipo: z.enum(['deferido', 'indeferido', 'parcial'], {
    required_error: 'Tipo de decisão é obrigatório'
  }),
  descricao: z.string().min(10, 'Descrição deve ter pelo menos 10 caracteres'),
  observacoes: z.string().optional(),
  fundamentacao: z.string().optional(),
  numeroAcordao: z.string().optional(),
  dataPublicacao: z.date().optional()
})

export type PautaInput = z.infer<typeof pautaSchema>
export type SessaoInput = z.infer<typeof sessaoSchema>
export type DecisaoInput = z.infer<typeof decisaoSchema>
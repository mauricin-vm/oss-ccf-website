import { z } from 'zod'

export const pautaSchema = z.object({
  numero: z.string().min(1, 'Número da pauta é obrigatório'),
  dataPauta: z.date({
    message: 'Data da pauta é obrigatória'
  }),
  observacoes: z.string().optional(),
  processos: z.array(z.object({
    processoId: z.string().min(1, 'ID do processo é obrigatório'),
    ordem: z.number().positive('Ordem deve ser um número positivo'),
    relator: z.string().min(1, 'Distribuição (relator ou revisor) é obrigatória')
  })).min(1, 'Pelo menos um processo deve ser incluído na pauta')
})

export const sessaoSchema = z.object({
  tipoSessao: z.enum(['JULGAMENTO', 'ADMINISTRATIVA'], {
    message: 'Tipo de sessão é obrigatório'
  }),
  pautaId: z.string().optional(),
  agenda: z.string().optional(),
  dataInicio: z.date({
    message: 'Data de início é obrigatória'
  }),
  presidenteId: z.string().min(1, 'Presidente da sessão é obrigatório'),
  conselheiros: z.array(z.string()).min(1, 'Pelo menos um conselheiro deve participar'),
  ata: z.string().optional()
}).refine(
  (data) => {
    // Se é sessão de julgamento, pauta é obrigatória
    if (data.tipoSessao === 'JULGAMENTO') {
      return data.pautaId && data.pautaId.length > 0
    }
    // Se é sessão administrativa, agenda é opcional
    return true
  },
  {
    message: 'Pauta é obrigatória para sessões de julgamento',
    path: ['pautaId']
  }
)

export const decisaoSchema = z.object({
  processoId: z.string().min(1, 'Processo é obrigatório'),
  sessaoId: z.string().optional(),
  tipo: z.enum(['deferido', 'indeferido', 'parcial'], {
    message: 'Tipo de decisão é obrigatório'
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
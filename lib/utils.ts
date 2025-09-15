import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatarStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'RECEPCIONADO': 'recepcionado',
    'EM_ANALISE': 'em análise',
    'EM_PAUTA': 'em pauta',
    'SUSPENSO': 'suspenso',
    'PEDIDO_VISTA': 'pedido de vista',
    'PEDIDO_DILIGENCIA': 'pedido de diligência',
    'JULGADO': 'julgado',
    'ACORDO_FIRMADO': 'acordo firmado',
    'EM_CUMPRIMENTO': 'em cumprimento',
    'ARQUIVADO': 'arquivado'
  }
  
  return statusMap[status] || status.toLowerCase().replace(/_/g, ' ')
}

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

export function formatarCpfCnpj(cpfCnpj: string): string {
  if (!cpfCnpj) return ''

  // Remove caracteres não numéricos
  const apenasNumeros = cpfCnpj.replace(/\D/g, '')

  // CPF: 11 dígitos - formato: 000.000.000-00
  if (apenasNumeros.length === 11) {
    return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  // CNPJ: 14 dígitos - formato: 00.000.000/0000-00
  if (apenasNumeros.length === 14) {
    return apenasNumeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  }

  // Se não for CPF nem CNPJ válido, retorna o valor original
  return cpfCnpj
}

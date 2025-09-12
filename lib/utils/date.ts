/**
 * Converte uma data do formato ISO string para Date no timezone local
 * evitando problemas de conversão UTC que podem alterar o dia
 */
export function parseLocalDate(dateString: string | Date): Date {
  if (dateString instanceof Date) return dateString
  
  // Se a string tem formato YYYY-MM-DD (sem timezone), criar no timezone local
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString.split('T')[0])) {
    const [year, month, day] = dateString.split('T')[0].split('-')
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }
  
  // Para outros formatos, usar new Date() normal
  return new Date(dateString)
}

/**
 * Formata uma data para string localized brasileira
 * usando a função parseLocalDate para evitar problemas de timezone
 */
export function formatLocalDate(dateString: string | Date): string {
  return parseLocalDate(dateString).toLocaleDateString('pt-BR')
}

/**
 * Formata uma data e hora para string localized brasileira
 */
export function formatLocalDateTime(dateString: string | Date): string {
  return parseLocalDate(dateString).toLocaleString('pt-BR')
}
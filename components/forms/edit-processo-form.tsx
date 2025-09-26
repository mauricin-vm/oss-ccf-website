'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { processoSchema, type ProcessoInput } from '@/lib/validations/processo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

interface EditProcessoFormProps {
  processo: {
    id: string
    numero: string
    tipo: string
    observacoes?: string | null
    contribuinte: {
      id: string
      cpfCnpj: string
      nome: string
      email?: string | null
      telefone?: string | null
      endereco?: string | null
      cidade?: string | null
      estado?: string | null
      cep?: string | null
    }
  }
}

export default function EditProcessoForm({ processo }: EditProcessoFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const formatCpfCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    } else {
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    }
  }

  const formatCep = (value: string) => {
    return value.replace(/(\d{5})(\d{3})/, '$1-$2')
  }

  const formatTelefone = (value: string) => {
    const numbers = value.replace(/\D/g, '')

    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    }
  }

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<ProcessoInput>({
    resolver: zodResolver(processoSchema),
    defaultValues: {
      numero: processo.numero,
      tipo: processo.tipo,
      observacoes: processo.observacoes || '',
      contribuinte: {
        cpfCnpj: formatCpfCnpj(processo.contribuinte.cpfCnpj || ''),
        nome: processo.contribuinte.nome,
        email: processo.contribuinte.email || '',
        telefone: formatTelefone(processo.contribuinte.telefone || ''),
        endereco: processo.contribuinte.endereco || '',
        cidade: processo.contribuinte.cidade || '',
        estado: processo.contribuinte.estado || '',
        cep: formatCep((processo.contribuinte.cep || '').replace(/\D/g, ''))
      }
    },
    shouldFocusError: false // Desabilitar foco automático para controlarmos manualmente
  })

  // Função para lidar com erros de validação do formulário
  const onInvalid = (errors: FieldErrors<ProcessoInput>) => {
    // Verificar erros de forma type-safe
    if (errors.numero?.message) {
      toast.warning(errors.numero.message)
      setTimeout(() => {
        const element = document.getElementById('numero')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }
    if (errors.tipo?.message) {
      toast.warning(errors.tipo.message)
      setTimeout(() => {
        const element = document.getElementById('tipo')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }
    if (errors.observacoes?.message) {
      toast.warning(errors.observacoes.message)
      setTimeout(() => {
        const element = document.getElementById('observacoes')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }
    if (errors.contribuinte?.cpfCnpj?.message) {
      toast.warning(errors.contribuinte.cpfCnpj.message)
      setTimeout(() => {
        const element = document.getElementById('contribuinte.cpfCnpj')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }
    if (errors.contribuinte?.nome?.message) {
      toast.warning(errors.contribuinte.nome.message)
      setTimeout(() => {
        const element = document.getElementById('contribuinte.nome')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
      return
    }
  }


  const onSubmit = async (data: ProcessoInput) => {
    setIsLoading(true)

    const processedData = {
      ...data,
      contribuinte: {
        ...data.contribuinte,
        cpfCnpj: data.contribuinte.cpfCnpj?.replace(/\D/g, '') || '',
        telefone: data.contribuinte.telefone?.replace(/\D/g, '') || '',
        cep: data.contribuinte.cep?.replace(/\D/g, '') || ''
      }
    }

    try {
      const response = await fetch(`/api/processos/${processo.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(processedData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar processo')
      }

      toast.success('Processo atualizado com sucesso!')
      router.push(`/processos/${processo.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTelefone(e.target.value)
    setValue('contribuinte.telefone', formatted)
  }

  const handleTelefoneFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const unformatted = e.target.value.replace(/\D/g, '')
    setValue('contribuinte.telefone', unformatted)
  }

  const handleTelefoneBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const formatted = formatTelefone(e.target.value)
    setValue('contribuinte.telefone', formatted)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6" noValidate>

      {/* Informações do Processo */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Processo</CardTitle>
          <CardDescription>
            Dados básicos do processo administrativo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero">Número do Processo <span className="text-red-500">*</span></Label>
              <Input
                id="numero"
                placeholder="CCF-2024-001"
                {...register('numero')}
                disabled={isLoading}
                className={errors.numero ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Processo <span className="text-red-500">*</span></Label>
              <Select
                onValueChange={(value) => setValue('tipo', value, { shouldValidate: true })}
                disabled={isLoading}
                defaultValue={processo.tipo}
              >
                <SelectTrigger className={errors.tipo ? 'w-full border-red-500 focus:ring-red-500' : 'w-full'}>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPENSACAO">Compensação</SelectItem>
                  <SelectItem value="DACAO_PAGAMENTO">Dação em Pagamento</SelectItem>
                  <SelectItem value="TRANSACAO_EXCEPCIONAL">Transação Excepcional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>


          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Informações adicionais sobre o processo..."
              rows={3}
              {...register('observacoes')}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Dados do Contribuinte */}
      <Card>
        <CardHeader>
          <CardTitle>Dados do Contribuinte</CardTitle>
          <CardDescription>
            Informações da pessoa física ou jurídica
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contribuinte.cpfCnpj">CPF/CNPJ</Label>
              <Input
                id="contribuinte.cpfCnpj"
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                {...register('contribuinte.cpfCnpj')}
                onChange={(e) => {
                  const formatted = formatCpfCnpj(e.target.value)
                  setValue('contribuinte.cpfCnpj', formatted)
                }}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contribuinte.nome">Nome/Razão Social <span className="text-red-500">*</span></Label>
              <Input
                id="contribuinte.nome"
                placeholder="Nome completo ou razão social"
                {...register('contribuinte.nome')}
                disabled={isLoading}
                className={errors.contribuinte?.nome ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contribuinte.email">Email</Label>
              <Input
                id="contribuinte.email"
                type="email"
                placeholder="email@exemplo.com"
                {...register('contribuinte.email')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contribuinte.telefone">Telefone</Label>
              <Input
                id="contribuinte.telefone"
                placeholder="(11) 99999-9999"
                {...register('contribuinte.telefone')}
                onChange={handleTelefoneChange}
                onFocus={handleTelefoneFocus}
                onBlur={handleTelefoneBlur}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contribuinte.endereco">Endereço</Label>
            <Input
              id="contribuinte.endereco"
              placeholder="Rua, número, complemento"
              {...register('contribuinte.endereco')}
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contribuinte.cidade">Cidade</Label>
              <Input
                id="contribuinte.cidade"
                placeholder="São Paulo"
                {...register('contribuinte.cidade')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contribuinte.estado">Estado</Label>
              <Input
                id="contribuinte.estado"
                placeholder="SP"
                maxLength={2}
                {...register('contribuinte.estado')}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contribuinte.cep">CEP</Label>
              <Input
                id="contribuinte.cep"
                placeholder="01234-567"
                {...register('contribuinte.cep')}
                onChange={(e) => {
                  const formatted = formatCep(e.target.value.replace(/\D/g, ''))
                  setValue('contribuinte.cep', formatted)
                }}
                disabled={isLoading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex gap-4 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
          className="cursor-pointer"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Atualizando...
            </>
          ) : (
            'Atualizar Processo'
          )}
        </Button>
      </div>
    </form>
  )
}
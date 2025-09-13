'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { processoSchema, type ProcessoInput } from '@/lib/validations/processo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

interface ProcessoFormProps {
  onSuccess?: () => void
}

export default function ProcessoForm({ onSuccess }: ProcessoFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<ProcessoInput>({
    resolver: zodResolver(processoSchema),
    defaultValues: {
      tipo: '',
      valorOriginal: undefined,
      valorNegociado: undefined
    }
  })


  const onSubmit = async (data: ProcessoInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/processos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar processo')
      }

      const resultado = await response.json()

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/processos/${resultado.id}`)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
              />
              {errors.numero && (
                <p className="text-sm text-red-500">{errors.numero.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Processo <span className="text-red-500">*</span></Label>
              <Select
                onValueChange={(value) => setValue('tipo', value, { shouldValidate: true })}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COMPENSACAO">Compensação</SelectItem>
                  <SelectItem value="DACAO_PAGAMENTO">Dação em Pagamento</SelectItem>
                  <SelectItem value="TRANSACAO_EXCEPCIONAL">Transação Excepcional</SelectItem>
                </SelectContent>
              </Select>
              {errors.tipo && (
                <p className="text-sm text-red-500">{errors.tipo.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valorOriginal">Valor Original (R$) <span className="text-gray-500 text-sm"></span></Label>
              <Input
                id="valorOriginal"
                type="number"
                step="0.01"
                placeholder="150000.00"
                {...register('valorOriginal')}
                disabled={isLoading}
              />
              {errors.valorOriginal && (
                <p className="text-sm text-red-500">{errors.valorOriginal.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="valorNegociado">Valor Negociado (R$) <span className="text-gray-500 text-sm"></span></Label>
              <Input
                id="valorNegociado"
                type="number"
                step="0.01"
                placeholder="120000.00"
                {...register('valorNegociado')}
                disabled={isLoading}
              />
              {errors.valorNegociado && (
                <p className="text-sm text-red-500">{errors.valorNegociado.message}</p>
              )}
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
            {errors.observacoes && (
              <p className="text-sm text-red-500">{errors.observacoes.message}</p>
            )}
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
              {errors.contribuinte?.cpfCnpj && (
                <p className="text-sm text-red-500">{errors.contribuinte.cpfCnpj.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contribuinte.nome">Nome/Razão Social <span className="text-red-500">*</span></Label>
              <Input
                id="contribuinte.nome"
                placeholder="Nome completo ou razão social"
                {...register('contribuinte.nome')}
                disabled={isLoading}
              />
              {errors.contribuinte?.nome && (
                <p className="text-sm text-red-500">{errors.contribuinte.nome.message}</p>
              )}
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
              {errors.contribuinte?.email && (
                <p className="text-sm text-red-500">{errors.contribuinte.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contribuinte.telefone">Telefone</Label>
              <Input
                id="contribuinte.telefone"
                placeholder="(11) 99999-9999"
                {...register('contribuinte.telefone')}
                disabled={isLoading}
              />
              {errors.contribuinte?.telefone && (
                <p className="text-sm text-red-500">{errors.contribuinte.telefone.message}</p>
              )}
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
            {errors.contribuinte?.endereco && (
              <p className="text-sm text-red-500">{errors.contribuinte.endereco.message}</p>
            )}
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
              {errors.contribuinte?.cidade && (
                <p className="text-sm text-red-500">{errors.contribuinte.cidade.message}</p>
              )}
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
              {errors.contribuinte?.estado && (
                <p className="text-sm text-red-500">{errors.contribuinte.estado.message}</p>
              )}
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
              {errors.contribuinte?.cep && (
                <p className="text-sm text-red-500">{errors.contribuinte.cep.message}</p>
              )}
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
              Criando...
            </>
          ) : (
            'Criar Processo'
          )}
        </Button>
      </div>
    </form>
  )
}
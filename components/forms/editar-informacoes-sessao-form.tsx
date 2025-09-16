'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Edit3, Calendar, User } from 'lucide-react'
import { toast } from 'sonner'

const editarInformacoesSessaoSchema = z.object({
  numeroAta: z.string().optional(),
  presidenteId: z.string().optional(),
  dataInicio: z.string(),
  horario: z.string()
})

type EditarInformacoesSessaoInput = z.infer<typeof editarInformacoesSessaoSchema>

interface Conselheiro {
  id: string
  nome: string
  email?: string
  cargo?: string
  ativo?: boolean
}

interface EditarInformacoesSessaoFormProps {
  sessaoId: string
  currentData: {
    numeroAta?: string
    presidenteId?: string
    dataInicio: Date
    horario?: string
    conselheiros?: Array<{id: string, nome: string}>
  }
}

export default function EditarInformacoesSessaoForm({ 
  sessaoId, 
  currentData
}: EditarInformacoesSessaoFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [conselheiros, setConselheiros] = useState<Conselheiro[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<EditarInformacoesSessaoInput>({
    resolver: zodResolver(editarInformacoesSessaoSchema),
    defaultValues: {
      numeroAta: currentData.numeroAta || '',
      presidenteId: currentData.presidenteId || '',
      dataInicio: new Date(currentData.dataInicio).toISOString().split('T')[0],
      horario: currentData.horario || new Date(currentData.dataInicio).toTimeString().slice(0, 5)
    }
  })

  const selectedPresidenteId = watch('presidenteId')

  // Buscar conselheiros ativos
  useEffect(() => {
    const fetchConselheiros = async () => {
      try {
        const response = await fetch('/api/conselheiros')
        if (response.ok) {
          const data = await response.json()
          const conselheirosAtivos = (data.conselheiros || []).filter((conselheiro: Conselheiro) => conselheiro.ativo)
          setConselheiros(conselheirosAtivos)
        }
      } catch (error) {
        console.error('Erro ao buscar conselheiros:', error)
      }
    }

    if (open) {
      fetchConselheiros()
    }
  }, [open])

  const onSubmit = async (data: EditarInformacoesSessaoInput) => {
    setIsLoading(true)
    setError(null)

    try {
      // Primeiro, atualizar os dados da sessão
      const response = await fetch(`/api/sessoes/${sessaoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          numeroAta: data.numeroAta,
          presidenteId: data.presidenteId === '' ? null : data.presidenteId,
          dataInicio: new Date(`${data.dataInicio}T${data.horario}:00.000Z`)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar informações da sessão')
      }

      // Se um presidente foi selecionado e estava na lista de participantes, removê-lo
      if (data.presidenteId && currentData.conselheiros) {
        const isParticipante = currentData.conselheiros.some(c => c.id === data.presidenteId)
        if (isParticipante) {
          const removeResponse = await fetch(`/api/sessoes/${sessaoId}/conselheiros/${data.presidenteId}`, {
            method: 'DELETE'
          })
          
          if (!removeResponse.ok) {
            console.warn('Não foi possível remover o conselheiro da lista de participantes')
          }
        }
      }

      toast.success('Informações da sessão atualizadas com sucesso!')
      setOpen(false)
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      reset({
        numeroAta: currentData.numeroAta || '',
        presidenteId: currentData.presidenteId || '',
        dataInicio: new Date(currentData.dataInicio).toISOString().split('T')[0],
        horario: currentData.horario || new Date(currentData.dataInicio).toTimeString().slice(0, 5)
      })
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="cursor-pointer">
          <Edit3 className="h-4 w-4 mr-2" />
          Editar Informações
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Editar Informações da Sessão</DialogTitle>
          <DialogDescription>
            Altere o número da ata, presidente, data de início e horário da sessão.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="numeroAta">Número da Ata</Label>
              <Input
                id="numeroAta"
                placeholder="Ex: 001/2024"
                {...register('numeroAta')}
                disabled={isLoading}
                className="w-full"
              />
              {errors.numeroAta && (
                <p className="text-sm text-red-500">{errors.numeroAta.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="presidenteId">Presidente</Label>
              <Select
                value={selectedPresidenteId || ''}
                onValueChange={(value) => setValue('presidenteId', value === 'none' ? '' : value)}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <SelectValue placeholder="Selecionar presidente (opcional)" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="cursor-pointer">Nenhum presidente</SelectItem>
                  {conselheiros.map((conselheiro) => (
                    <SelectItem key={conselheiro.id} value={conselheiro.id} className="cursor-pointer">
                      {conselheiro.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.presidenteId && (
                <p className="text-sm text-red-500">{errors.presidenteId.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataInicio">Data de Início</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="dataInicio"
                  type="date"
                  className="pl-10"
                  {...register('dataInicio')}
                  disabled={isLoading}
                />
              </div>
              {errors.dataInicio && (
                <p className="text-sm text-red-500">{errors.dataInicio.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="horario">Horário</Label>
              <Input
                id="horario"
                type="time"
                {...register('horario')}
                disabled={isLoading}
              />
              {errors.horario && (
                <p className="text-sm text-red-500">{errors.horario.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="cursor-pointer">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
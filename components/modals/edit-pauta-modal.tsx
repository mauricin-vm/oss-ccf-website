'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Calendar } from 'lucide-react'

const editPautaSchema = z.object({
  numero: z.string().min(1, 'Número da pauta é obrigatório'),
  dataPauta: z.string().min(1, 'Data da pauta é obrigatória'),
  observacoes: z.string().optional()
})

type EditPautaInput = z.infer<typeof editPautaSchema>

interface EditPautaModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  pauta: {
    id: string
    numero: string
    dataPauta: string
    observacoes?: string
  }
}

export default function EditPautaModal({
  isOpen,
  onClose,
  onSuccess,
  pauta
}: EditPautaModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<EditPautaInput>({
    resolver: zodResolver(editPautaSchema),
    defaultValues: {
      numero: pauta.numero,
      dataPauta: new Date(pauta.dataPauta).toISOString().split('T')[0],
      observacoes: pauta.observacoes || ''
    }
  })

  // Reset form when pauta changes
  useEffect(() => {
    if (pauta) {
      reset({
        numero: pauta.numero,
        dataPauta: new Date(pauta.dataPauta).toISOString().split('T')[0],
        observacoes: pauta.observacoes || ''
      })
    }
  }, [pauta, reset])

  const onSubmit = async (data: EditPautaInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/pautas/${pauta.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...data,
          dataPauta: (() => {
            // Criar data no timezone local para evitar problemas de UTC
            const [year, month, day] = data.dataPauta.split('-')
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
          })()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar pauta')
      }

      onSuccess()
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      onClose()
      setError(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Pauta</DialogTitle>
          <DialogDescription>
            Altere as informações da pauta de julgamento
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="numero">Número da Pauta <span className="text-red-500">*</span></Label>
            <Input
              id="numero"
              {...register('numero')}
              disabled={isLoading}
              placeholder="Ex: Pauta 11-09-2025"
            />
            {errors.numero && (
              <p className="text-sm text-red-500">{errors.numero.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataPauta">Data da Pauta <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="dataPauta"
                type="date"
                {...register('dataPauta')}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
            {errors.dataPauta && (
              <p className="text-sm text-red-500">{errors.dataPauta.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Informações adicionais sobre a pauta..."
              rows={3}
              {...register('observacoes')}
              disabled={isLoading}
            />
            {errors.observacoes && (
              <p className="text-sm text-red-500">{errors.observacoes.message}</p>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
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
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
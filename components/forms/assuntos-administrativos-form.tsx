'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Loader2, AlertCircle, FileText, Users } from 'lucide-react'
import { toast } from 'sonner'

const assuntosAdministrativosSchema = z.object({
  assuntosAdministrativos: z.string().min(10, 'Os assuntos administrativos devem ter pelo menos 10 caracteres')
})

type AssuntosAdministrativosInput = z.infer<typeof assuntosAdministrativosSchema>

interface AssuntosAdministrativosFormProps {
  sessaoId: string
  currentText?: string
}

export default function AssuntosAdministrativosForm({ 
  sessaoId, 
  currentText = ''
}: AssuntosAdministrativosFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
    watch
  } = useForm<AssuntosAdministrativosInput>({
    resolver: zodResolver(assuntosAdministrativosSchema),
    defaultValues: {
      assuntosAdministrativos: currentText
    },
    shouldFocusError: false
  })

  // Função para lidar com erros de validação do formulário
  const onInvalid = (errors: any) => {
    if (errors.assuntosAdministrativos?.message) {
      toast.warning(errors.assuntosAdministrativos.message)

      // Focar no campo com erro após um pequeno delay
      setTimeout(() => {
        const element = document.getElementById('assuntosAdministrativos')
        if (element) {
          element.focus()
          element.style.borderColor = '#ef4444'
          element.style.boxShadow = '0 0 0 1px #ef4444'
        }
      }, 100)
    }
  }

  const clearFieldError = (fieldId: string) => {
    const element = document.getElementById(fieldId)
    if (element) {
      element.style.borderColor = ''
      element.style.boxShadow = ''
    }
  }

  const watchedText = watch('assuntosAdministrativos')

  const onSubmit = async (data: AssuntosAdministrativosInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/sessoes/${sessaoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assuntosAdministrativos: data.assuntosAdministrativos
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar assuntos administrativos')
      }

      toast.success('Assuntos administrativos salvos com sucesso!')
      setOpen(false)
      router.refresh()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro inesperado'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      reset({ assuntosAdministrativos: currentText })
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="cursor-pointer">
          <Users className="h-4 w-4 mr-2" />
          Assuntos Administrativos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Assuntos Administrativos</DialogTitle>
          <DialogDescription>
            Registre os assuntos administrativos discutidos na sessão. Este texto será usado futuramente para compor a ata.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4" noValidate>

          <div className="space-y-2">
            <Label htmlFor="assuntosAdministrativos">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Assuntos Administrativos
              </div>
            </Label>
            <Textarea
              id="assuntosAdministrativos"
              placeholder="Descreva os assuntos administrativos discutidos na sessão..."
              rows={8}
              className={`resize-none ${errors.assuntosAdministrativos ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              {...register('assuntosAdministrativos')}
              onChange={(e) => {
                setValue('assuntosAdministrativos', e.target.value)
                clearFieldError('assuntosAdministrativos')
              }}
              onFocus={() => clearFieldError('assuntosAdministrativos')}
              disabled={isLoading}
            />
            <div className="flex justify-end">
              <p className="text-sm text-gray-500">
                {watchedText?.length || 0} caracteres
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-blue-900 mb-1">Dica:</h4>
            <p className="text-sm text-blue-700">
              Registre decisões administrativas, comunicações importantes, alterações de cronograma, 
              e outros assuntos relevantes que não estão relacionados aos processos específicos em julgamento.
            </p>
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
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
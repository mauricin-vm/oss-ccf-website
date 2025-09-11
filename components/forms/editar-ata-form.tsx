'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Edit, Save, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface EditarAtaFormProps {
  sessaoId: string
  ataAtual: string
}

export default function EditarAtaForm({ sessaoId, ataAtual }: EditarAtaFormProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [ata, setAta] = useState(ataAtual)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/sessoes/${sessaoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ata })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar ata')
      }

      toast.success('Ata atualizada com sucesso!')
      setIsEditing(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setAta(ataAtual)
    setIsEditing(false)
  }

  if (!isEditing) {
    return (
      <div className="space-y-3">
        <div className="bg-gray-50 p-4 rounded-lg min-h-[100px]">
          {ataAtual ? (
            <p className="text-gray-700 whitespace-pre-wrap">{ataAtual}</p>
          ) : (
            <p className="text-gray-500 italic">Nenhuma ata registrada ainda</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(true)}
        >
          <Edit className="mr-2 h-4 w-4" />
          {ataAtual ? 'Editar Ata' : 'Adicionar Ata'}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={ata}
        onChange={(e) => setAta(e.target.value)}
        placeholder="Digite as informações, discussões e observações da sessão..."
        rows={8}
        className="resize-none"
      />
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isLoading}
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isLoading}
          size="sm"
        >
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Users, Edit3 } from 'lucide-react'
import { toast } from 'sonner'

interface Conselheiro {
  id: string
  nome: string
  email?: string
  cargo?: string
  ativo?: boolean
}

interface EditarConselheirosFormProps {
  sessaoId: string
  currentConselheiros: Array<{id: string, nome: string}>
  presidenteId?: string
}

export default function EditarConselheirosForm({ 
  sessaoId, 
  currentConselheiros,
  presidenteId
}: EditarConselheirosFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [conselheiros, setConselheiros] = useState<Conselheiro[]>([])
  const [selectedConselheiros, setSelectedConselheiros] = useState<string[]>([])

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
      // Inicializar com conselheiros atuais (excluindo o presidente)
      const conselheirosParticipantes = currentConselheiros
        .filter(c => c.id !== presidenteId)
        .map(c => c.id)
      setSelectedConselheiros(conselheirosParticipantes)
    }
  }, [open, currentConselheiros, presidenteId])

  const handleConselheiroToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedConselheiros(prev => [...prev, userId])
    } else {
      setSelectedConselheiros(prev => prev.filter(id => id !== userId))
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/sessoes/${sessaoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conselheiros: selectedConselheiros
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar conselheiros')
      }

      toast.success('Conselheiros atualizados com sucesso!')
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
      setError(null)
      // Resetar para conselheiros atuais
      const conselheirosParticipantes = currentConselheiros
        .filter(c => c.id !== presidenteId)
        .map(c => c.id)
      setSelectedConselheiros(conselheirosParticipantes)
    }
  }

  // Filtrar conselheiros disponíveis (excluir presidente)
  const conselheirosDisponiveis = conselheiros.filter(c => c.id !== presidenteId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="cursor-pointer">
          <Edit3 className="h-4 w-4 mr-2" />
          Alterar Conselheiros
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alterar Conselheiros Participantes</DialogTitle>
          <DialogDescription>
            Selecione os conselheiros que participarão desta sessão. O presidente não aparece na lista pois já foi selecionado.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto">
            {conselheirosDisponiveis.map((conselheiro) => (
              <div key={conselheiro.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                <Checkbox
                  id={`conselheiro-${conselheiro.id}`}
                  checked={selectedConselheiros.includes(conselheiro.id)}
                  onCheckedChange={(checked) =>
                    handleConselheiroToggle(conselheiro.id, checked as boolean)
                  }
                  disabled={isLoading}
                  className="cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`conselheiro-${conselheiro.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {conselheiro.nome}
                    </label>
                    {conselheiro.cargo && (
                      <Badge variant="outline" className="text-xs">
                        {conselheiro.cargo}
                      </Badge>
                    )}
                  </div>
                  {conselheiro.email && (
                    <p className="text-xs text-gray-600">{conselheiro.email}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedConselheiros.length > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <Users className="inline h-4 w-4 mr-1" />
                {selectedConselheiros.length} conselheiro{selectedConselheiros.length !== 1 ? 's' : ''} selecionado{selectedConselheiros.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {presidenteId && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800">
                <strong>Nota:</strong> O presidente da sessão não aparece na lista acima pois já está definido como participante.
              </p>
            </div>
          )}
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
          <Button 
            onClick={handleSubmit} 
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
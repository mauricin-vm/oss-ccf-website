'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ValoresDacaoForm from '@/components/forms/valores-dacao-form'
import ValoresCompensacaoForm from '@/components/forms/valores-compensacao-form'
import ValoresTransacaoForm from '@/components/forms/valores-transacao-form'
import { Home, CreditCard, Settings } from 'lucide-react'

interface ValoresProcessoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  processo: {
    id: string
    tipo: string
  }
  onSuccess: () => void
}

export default function ValoresProcessoModal({
  open,
  onOpenChange,
  processo,
  onSuccess
}: ValoresProcessoModalProps) {
  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'DACAO_PAGAMENTO': return 'Dação em Pagamento'
      case 'COMPENSACAO': return 'Compensação'
      case 'TRANSACAO_EXCEPCIONAL': return 'Transação Excepcional'
      default: return tipo
    }
  }

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'DACAO_PAGAMENTO': return <Home className="h-5 w-5" />
      case 'COMPENSACAO': return <CreditCard className="h-5 w-5" />
      case 'TRANSACAO_EXCEPCIONAL': return <Settings className="h-5 w-5" />
      default: return <Settings className="h-5 w-5" />
    }
  }

  const handleSuccess = () => {
    onSuccess()
    onOpenChange(false)
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] !max-w-[1400px] max-h-[90vh] overflow-hidden" style={{ width: '95vw', maxWidth: '1400px' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTipoIcon(processo.tipo)}
            Configurar Valores - {getTipoLabel(processo.tipo)}
          </DialogTitle>
          <DialogDescription>
            Configure os valores específicos para este tipo de processo
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-120px)] pr-2">
          {/* Conteúdo específico por tipo */}
          {processo.tipo === 'DACAO_PAGAMENTO' && (
            <div className="space-y-4">
              <ValoresDacaoForm
                processoId={processo.id}
                onSuccess={handleSuccess}
              />
            </div>
          )}

          {processo.tipo === 'COMPENSACAO' && (
            <div className="space-y-4">
              <ValoresCompensacaoForm
                processoId={processo.id}
                onSuccess={handleSuccess}
              />
            </div>
          )}

          {processo.tipo === 'TRANSACAO_EXCEPCIONAL' && (
            <div className="space-y-4">
              <ValoresTransacaoForm
                processoId={processo.id}
                onSuccess={handleSuccess}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
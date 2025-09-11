'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Plus, Download, Calendar, User, Trash2 } from 'lucide-react'
import AnexarDocumentoModal from '@/components/modals/anexar-documento-modal'
import { toast } from 'sonner'

interface Documento {
  id: string
  nome: string
  tipo: string
  url: string
  tamanho: number
  createdAt: string
}

interface Processo {
  id: string
  numero: string
  documentos: Documento[]
}

interface ProcessoDocumentosProps {
  processo: Processo
  canEdit: boolean
}

export default function ProcessoDocumentos({ processo, canEdit }: ProcessoDocumentosProps) {
  const [documentos, setDocumentos] = useState(processo.documentos)
  const [showAnexarModal, setShowAnexarModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = async (documento: Documento) => {
    try {
      setIsLoading(true)
      
      const response = await fetch(`/api/processos/${processo.id}/documentos/${documento.id}/download`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao fazer download')
      }

      // Criar blob e fazer download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = documento.nome
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Download realizado com sucesso')
    } catch (error) {
      console.error('Erro no download:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao fazer download')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshDocumentos = async () => {
    try {
      const response = await fetch(`/api/processos/${processo.id}/documentos`)
      if (response.ok) {
        const data = await response.json()
        setDocumentos(data.documentos)
      }
    } catch (error) {
      console.error('Erro ao atualizar lista de documentos:', error)
    }
  }

  const handleDelete = async (documento: Documento) => {
    if (!confirm(`Tem certeza que deseja deletar o documento "${documento.nome}"?`)) {
      return
    }

    try {
      setIsLoading(true)
      
      const response = await fetch(`/api/processos/${processo.id}/documentos/${documento.id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao deletar documento')
      }

      toast.success('Documento deletado com sucesso')
      refreshDocumentos()
    } catch (error) {
      console.error('Erro ao deletar documento:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao deletar documento')
    } finally {
      setIsLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getFileTypeIcon = (tipo: string) => {
    if (tipo.includes('pdf')) return '📄'
    if (tipo.includes('word') || tipo.includes('document')) return '📝'
    if (tipo.includes('excel') || tipo.includes('sheet')) return '📊'
    if (tipo.includes('image')) return '🖼️'
    if (tipo.includes('text')) return '📃'
    return '📎'
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Documentos</CardTitle>
              <CardDescription>
                Documentos anexados ao processo ({documentos.length})
              </CardDescription>
            </div>
            {canEdit && (
              <Button 
                onClick={() => setShowAnexarModal(true)}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                Anexar Documento
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {documentos.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">
                Nenhum documento anexado ainda
              </p>
              {canEdit && (
                <p className="text-sm text-gray-400 mt-1">
                  Clique em "Anexar Documento" para adicionar arquivos
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {documentos.map((documento) => (
                <div key={documento.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">
                          {getFileTypeIcon(documento.tipo)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">
                          {documento.nome}
                        </h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span>{formatFileSize(documento.tamanho)}</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(documento.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(documento)}
                      disabled={isLoading}
                      className="cursor-pointer"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar
                    </Button>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(documento)}
                        disabled={isLoading}
                        className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Deletar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Anexar Documento */}
      {canEdit && (
        <AnexarDocumentoModal
          processoId={processo.id}
          open={showAnexarModal}
          onOpenChange={setShowAnexarModal}
          onSuccess={refreshDocumentos}
        />
      )}
    </>
  )
}
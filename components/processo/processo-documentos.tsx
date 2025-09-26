'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Plus, Download, Calendar, Trash2 } from 'lucide-react'
import AnexarDocumentoModal from '@/components/modals/anexar-documento-modal'
import { toast } from 'sonner'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFilePdf,
  faFileWord,
  faFileExcel,
  faFilePowerpoint,
  faFileAlt,
  faFileImage,
  faFileVideo,
  faFileAudio,
  faFileArchive,
  faFile
} from '@fortawesome/free-regular-svg-icons'

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
      toast.error('Erro ao atualizar lista de documentos')
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

  const getFileTypeInfo = (mime: string) => {
    if (mime.includes('pdf')) return { type: 'PDF', icon: faFilePdf, color: 'bg-red-500', badgeColor: 'bg-red-50 text-red-700 border-red-200' }
    if (mime.includes('word') || mime.includes('msword')) return { type: 'Word', icon: faFileWord, color: 'bg-blue-500', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' }
    if (mime.includes('excel') || mime.includes('spreadsheet')) return { type: 'Excel', icon: faFileExcel, color: 'bg-green-500', badgeColor: 'bg-green-50 text-green-700 border-green-200' }
    if (mime.includes('powerpoint') || mime.includes('presentation')) return { type: 'PowerPoint', icon: faFilePowerpoint, color: 'bg-orange-500', badgeColor: 'bg-orange-50 text-orange-700 border-orange-200' }
    if (mime.includes('text')) return { type: 'Texto', icon: faFileAlt, color: 'bg-gray-500', badgeColor: 'bg-gray-50 text-gray-700 border-gray-200' }
    if (mime.includes('image')) return { type: 'Imagem', icon: faFileImage, color: 'bg-purple-500', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' }
    if (mime.includes('video')) return { type: 'Vídeo', icon: faFileVideo, color: 'bg-pink-500', badgeColor: 'bg-pink-50 text-pink-700 border-pink-200' }
    if (mime.includes('audio')) return { type: 'Áudio', icon: faFileAudio, color: 'bg-yellow-500', badgeColor: 'bg-yellow-50 text-yellow-700 border-yellow-200' }
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('archive')) return { type: 'Arquivo', icon: faFileArchive, color: 'bg-indigo-500', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
    return { type: 'Documento', icon: faFile, color: 'bg-gray-500', badgeColor: 'bg-gray-50 text-gray-700 border-gray-200' }
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
                  Clique em &ldquo;Anexar Documento&rdquo; para adicionar arquivos
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {documentos.map((documento) => {
                const fileInfo = getFileTypeInfo(documento.tipo)

                return (
                  <div key={documento.id} className="group flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 hover:shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${fileInfo.color} text-white shadow-sm`}>
                          <FontAwesomeIcon
                            icon={fileInfo.icon}
                            className="text-lg"
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">
                            {documento.nome}
                          </h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${fileInfo.badgeColor}`}>
                            {fileInfo.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="font-medium">{formatFileSize(documento.tamanho)}</span>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(documento.createdAt).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(documento)}
                        disabled={isLoading}
                        className="cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
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
                          className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Deletar
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
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
'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Upload, FileText, X, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface AnexarDocumentoModalProps {
  processoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface FileUpload {
  file: File
  nome: string
  preview: string
}

export default function AnexarDocumentoModal({
  processoId,
  open,
  onOpenChange,
  onSuccess
}: AnexarDocumentoModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileUpload[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const allowedTypes = [
    '.pdf',
    '.doc', 
    '.docx',
    '.xls',
    '.xlsx',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.txt'
  ]

  const maxFileSize = 10 * 1024 * 1024 // 10MB

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setError(null)

    const validFiles: FileUpload[] = []
    const errors: string[] = []

    files.forEach(file => {
      // Validar tipo
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedTypes.includes(fileExtension)) {
        errors.push(`${file.name}: tipo de arquivo não permitido`)
        return
      }

      // Validar tamanho
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: arquivo muito grande (máximo 10MB)`)
        return
      }

      // Verificar duplicatas
      if (selectedFiles.some(f => f.file.name === file.name)) {
        errors.push(`${file.name}: arquivo já selecionado`)
        return
      }

      validFiles.push({
        file,
        nome: file.name.split('.').slice(0, -1).join('.'), // Nome sem extensão
        preview: URL.createObjectURL(file)
      })
    })

    if (errors.length > 0) {
      setError(errors.join(', '))
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles])
    }

    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const updateFileName = (index: number, novoNome: string) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev]
      newFiles[index].nome = novoNome
      return newFiles
    })
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Selecione pelo menos um arquivo')
      return
    }

    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      let uploadedCount = 0
      const errors: string[] = []

      for (const fileUpload of selectedFiles) {
        try {
          const formData = new FormData()
          formData.append('file', fileUpload.file)
          formData.append('nome', fileUpload.nome)

          const response = await fetch(`/api/processos/${processoId}/documentos`, {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            const errorData = await response.json()
            errors.push(`${fileUpload.nome}: ${errorData.error}`)
          } else {
            uploadedCount++
          }
        } catch {
          errors.push(`${fileUpload.nome}: erro no upload`)
        }

        // Atualizar progresso
        const progress = ((uploadedCount + errors.length) / selectedFiles.length) * 100
        setUploadProgress(progress)
      }

      if (errors.length > 0) {
        setError(`Alguns arquivos falharam: ${errors.join(', ')}`)
        
        if (uploadedCount > 0) {
          toast.success(`${uploadedCount} arquivo(s) enviado(s) com sucesso`)
        }
      } else {
        toast.success(`${uploadedCount} arquivo(s) anexado(s) com sucesso`)
        onSuccess()
        handleClose()
      }
    } catch {
      setError('Erro inesperado durante o upload')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleClose = () => {
    // Limpar previews
    selectedFiles.forEach(file => URL.revokeObjectURL(file.preview))
    setSelectedFiles([])
    setError(null)
    setUploadProgress(0)
    onOpenChange(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      // Simular evento de input
      const mockEvent = {
        target: { files }
      } as unknown as React.ChangeEvent<HTMLInputElement>
      handleFileSelect(mockEvent)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Anexar Documentos</DialogTitle>
          <DialogDescription>
            Selecione os arquivos que deseja anexar ao processo. 
            Tipos permitidos: PDF, DOC, XLS, imagens e TXT (máximo 10MB cada).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Área de Upload */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-medium">Clique para selecionar</span> ou arraste arquivos aqui
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {allowedTypes.join(', ')} - Máximo 10MB por arquivo
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={allowedTypes.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Arquivos Selecionados */}
          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Arquivos Selecionados ({selectedFiles.length})</h4>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {selectedFiles.map((fileUpload, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-1" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{fileUpload.file.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={isUploading}
                          className="cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(fileUpload.file.size)}
                      </p>
                      <div className="space-y-1">
                        <Label htmlFor={`nome-${index}`} className="text-xs">
                          Nome do documento (opcional)
                        </Label>
                        <Input
                          id={`nome-${index}`}
                          value={fileUpload.nome}
                          onChange={(e) => updateFileName(index, e.target.value)}
                          placeholder="Nome personalizado do documento"
                          disabled={isUploading}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progresso do Upload */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Enviando arquivos...</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
            className="cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="cursor-pointer"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Anexar {selectedFiles.length > 0 && `(${selectedFiles.length})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
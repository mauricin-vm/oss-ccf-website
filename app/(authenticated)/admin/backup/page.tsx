'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Database, 
  Download, 
  Upload,
  Trash2,
  RefreshCw,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  Archive,
  Settings,
  Calendar,
  FileText,
  Zap
} from 'lucide-react'
import { toast } from 'sonner'
import { SessionUser } from '@/types'

interface BackupFile {
  id: string
  filename: string
  size: number
  date: string
  type: 'manual' | 'automatic'
  status: 'completed' | 'failed' | 'in_progress'
  downloadUrl?: string
}

interface SystemInfo {
  databaseSize: number
  totalFiles: number
  lastBackup: string
  nextScheduledBackup: string
  backupStatus: 'running' | 'idle' | 'error'
  diskSpace: {
    total: number
    used: number
    available: number
  }
}

export default function BackupAdminPage() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([])
  const [systemInfo] = useState<SystemInfo>({
    databaseSize: 156.7,
    totalFiles: 1234,
    lastBackup: '2024-01-15T10:30:00Z',
    nextScheduledBackup: '2024-01-16T10:30:00Z',
    backupStatus: 'idle',
    diskSpace: {
      total: 500,
      used: 320,
      available: 180
    }
  })
  const [currentBackup, setCurrentBackup] = useState<{
    isRunning: boolean
    progress: number
    step: string
  }>({
    isRunning: false,
    progress: 0,
    step: ''
  })

  // Verificar se é admin
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      redirect('/login')
    }
    const user = session.user as SessionUser
    if (user.role !== 'ADMIN') {
      redirect('/dashboard')
    }
  }, [session, status])

  // Carregar dados
  const loadData = async () => {
    try {
      setLoading(true)
      // Simular dados de backup
      const mockBackups: BackupFile[] = [
        {
          id: '1',
          filename: 'backup_sistema_2024-01-15_103000.sql',
          size: 45.2,
          date: '2024-01-15T10:30:00Z',
          type: 'automatic',
          status: 'completed',
          downloadUrl: '/api/backup/download/1'
        },
        {
          id: '2',
          filename: 'backup_manual_2024-01-14_153000.sql',
          size: 44.8,
          date: '2024-01-14T15:30:00Z',
          type: 'manual',
          status: 'completed',
          downloadUrl: '/api/backup/download/2'
        },
        {
          id: '3',
          filename: 'backup_sistema_2024-01-14_103000.sql',
          size: 44.1,
          date: '2024-01-14T10:30:00Z',
          type: 'automatic',
          status: 'completed',
          downloadUrl: '/api/backup/download/3'
        },
        {
          id: '4',
          filename: 'backup_sistema_2024-01-13_103000.sql',
          size: 0,
          date: '2024-01-13T10:30:00Z',
          type: 'automatic',
          status: 'failed'
        }
      ]
      setBackupFiles(mockBackups)
    } catch {
      toast.error('Erro ao carregar dados de backup')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Executar backup manual
  const handleManualBackup = async () => {
    try {
      setCurrentBackup({
        isRunning: true,
        progress: 0,
        step: 'Iniciando backup...'
      })

      // Simular progresso do backup
      const steps = [
        'Conectando ao banco de dados...',
        'Exportando dados de usuários...',
        'Exportando dados de processos...',
        'Exportando dados de acordos...',
        'Exportando arquivos anexos...',
        'Compactando arquivos...',
        'Verificando integridade...',
        'Backup concluído!'
      ]

      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        setCurrentBackup({
          isRunning: i < steps.length - 1,
          progress: ((i + 1) / steps.length) * 100,
          step: steps[i]
        })
      }

      toast.success('Backup manual executado com sucesso!')
      loadData()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao executar backup'
      toast.error(errorMessage)
      setCurrentBackup({
        isRunning: false,
        progress: 0,
        step: ''
      })
    }
  }

  // Fazer download do backup
  const handleDownloadBackup = async (backup: BackupFile) => {
    if (!backup.downloadUrl) return
    
    try {
      // Simular download
      toast.success(`Download iniciado: ${backup.filename}`)
      // window.open(backup.downloadUrl, '_blank')
    } catch {
      toast.error('Erro ao fazer download do backup')
    }
  }

  // Deletar backup
  const handleDeleteBackup = async (backup: BackupFile) => {
    if (!confirm(`Tem certeza que deseja deletar o backup ${backup.filename}?`)) {
      return
    }

    try {
      // Aqui você implementaria a chamada para deletar o backup
      toast.success('Backup deletado com sucesso')
      loadData()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao deletar backup'
      toast.error(errorMessage)
    }
  }

  // Restaurar backup
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRestoreBackup = async (backup: BackupFile) => {
    if (!confirm(`ATENÇÃO: Restaurar este backup substituirá todos os dados atuais. Tem certeza que deseja continuar?`)) {
      return
    }

    try {
      // Aqui você implementaria a restauração
      toast.success('Restauração iniciada. O sistema será reiniciado.')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao restaurar backup'
      toast.error(errorMessage)
    }
  }

  const formatFileSize = (sizeInMB: number) => {
    if (sizeInMB === 0) return 'N/A'
    if (sizeInMB < 1024) return `${sizeInMB.toFixed(1)} MB`
    return `${(sizeInMB / 1024).toFixed(1)} GB`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'failed': return 'text-red-600'
      case 'in_progress': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed': return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-600" />
      default: return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  if (status === 'loading' || loading) {
    return <div>Carregando...</div>
  }

  const diskUsagePercent = (systemInfo.diskSpace.used / systemInfo.diskSpace.total) * 100

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-8 w-8" />
            Backup e Manutenção
          </h1>
          <p className="text-gray-600">
            Gerencie backups e manutenção do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={handleManualBackup} disabled={currentBackup.isRunning}>
            <Play className="h-4 w-4 mr-2" />
            Backup Manual
          </Button>
        </div>
      </div>

      {/* Status do Sistema */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              Tamanho do BD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFileSize(systemInfo.databaseSize)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total de Arquivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemInfo.totalFiles.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Último Backup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {new Date(systemInfo.lastBackup).toLocaleDateString()}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(systemInfo.lastBackup).toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Próximo Backup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {new Date(systemInfo.nextScheduledBackup).toLocaleDateString()}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(systemInfo.nextScheduledBackup).toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Espaço em Disco */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Espaço em Disco
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Usado: {formatFileSize(systemInfo.diskSpace.used * 1024)}</span>
              <span>Disponível: {formatFileSize(systemInfo.diskSpace.available * 1024)}</span>
            </div>
            <Progress value={diskUsagePercent} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0 GB</span>
              <span>{formatFileSize(systemInfo.diskSpace.total * 1024)}</span>
            </div>
          </div>
          {diskUsagePercent > 80 && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Espaço em disco baixo. Considere deletar backups antigos ou aumentar o armazenamento.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Backup em Progresso */}
      {currentBackup.isRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Backup em Execução
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{currentBackup.step}</span>
                <span>{Math.round(currentBackup.progress)}%</span>
              </div>
              <Progress value={currentBackup.progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Backups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Histórico de Backups
          </CardTitle>
          <CardDescription>
            {backupFiles.length} backups disponíveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {backupFiles.map((backup) => (
              <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  {getStatusIcon(backup.status)}
                  <div>
                    <div className="font-medium">{backup.filename}</div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{formatFileSize(backup.size)}</span>
                      <span>{new Date(backup.date).toLocaleString()}</span>
                      <Badge variant={backup.type === 'manual' ? 'default' : 'secondary'}>
                        {backup.type === 'manual' ? 'Manual' : 'Automático'}
                      </Badge>
                      <span className={getStatusColor(backup.status)}>
                        {backup.status === 'completed' ? 'Concluído' : 
                         backup.status === 'failed' ? 'Falhou' : 'Em progresso'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {backup.status === 'completed' && backup.downloadUrl && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadBackup(backup)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestoreBackup(backup)}
                        className="text-orange-600 hover:text-orange-700"
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteBackup(backup)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ferramentas de Manutenção */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Ferramentas de Manutenção
          </CardTitle>
          <CardDescription>
            Ferramentas para manutenção e otimização do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-5 w-5" />
                <span className="font-medium">Otimizar Banco de Dados</span>
              </div>
              <span className="text-sm text-gray-600">
                Executa otimização e limpeza do banco de dados
              </span>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="h-5 w-5" />
                <span className="font-medium">Limpar Logs Antigos</span>
              </div>
              <span className="text-sm text-gray-600">
                Remove logs de auditoria antigos conforme configuração
              </span>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <Archive className="h-5 w-5" />
                <span className="font-medium">Compactar Arquivos</span>
              </div>
              <span className="text-sm text-gray-600">
                Compacta arquivos antigos para economizar espaço
              </span>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start cursor-pointer">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Verificar Integridade</span>
              </div>
              <span className="text-sm text-gray-600">
                Verifica a integridade dos dados e arquivos
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
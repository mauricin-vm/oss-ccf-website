'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { 
  Settings, 
  Save, 
  RefreshCw,
  Shield,
  Database,
  Globe,
  Bell,
  AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { SessionUser } from '@/types'

interface SystemConfig {
  sistema: {
    nomeOrganizacao: string
    emailContato: string
    telefoneContato: string
    enderecoCompleto: string
    logoUrl?: string
  }
  notificacoes: {
    emailNotificacoes: boolean
    notificacaoProcessos: boolean
    notificacaoAcordos: boolean
    notificacaoSessoes: boolean
    emailRemetente: string
  }
  seguranca: {
    sessaoExpiraMinutos: number
    tentativasLoginMax: number
    senhaMinCaracteres: number
    exigirSenhaCompleta: boolean
    permitirMultiplosSessions: boolean
  }
  sistema_geral: {
    manterLogsAuditoriaDias: number
    permitirCadastroPublico: boolean
    modoManutencao: boolean
    mensagemManutencao: string
  }
  backup: {
    backupAutomatico: boolean
    intervaloBkpHoras: number
    manterBackupsDias: number
    emailBackupStatus: string
  }
}

export default function ConfiguracoesAdminPage() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<SystemConfig>({
    sistema: {
      nomeOrganizacao: 'Câmara de Conciliação Fiscal',
      emailContato: 'contato@ccf.gov.br',
      telefoneContato: '(11) 3000-0000',
      enderecoCompleto: '',
      logoUrl: ''
    },
    notificacoes: {
      emailNotificacoes: true,
      notificacaoProcessos: true,
      notificacaoAcordos: true,
      notificacaoSessoes: true,
      emailRemetente: 'noreply@ccf.gov.br'
    },
    seguranca: {
      sessaoExpiraMinutos: 480,
      tentativasLoginMax: 5,
      senhaMinCaracteres: 8,
      exigirSenhaCompleta: true,
      permitirMultiplosSessions: false
    },
    sistema_geral: {
      manterLogsAuditoriaDias: 90,
      permitirCadastroPublico: false,
      modoManutencao: false,
      mensagemManutencao: 'Sistema em manutenção. Tente novamente em alguns minutos.'
    },
    backup: {
      backupAutomatico: true,
      intervaloBkpHoras: 24,
      manterBackupsDias: 30,
      emailBackupStatus: 'admin@ccf.gov.br'
    }
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

  // Carregar configurações
  const loadConfig = async () => {
    try {
      setLoading(true)
      // Aqui você implementaria a chamada para carregar as configurações
      // const response = await fetch('/api/config')
      // const data = await response.json()
      // setConfig(data)
    } catch (error) {
      toast.error('Erro ao carregar configurações')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  // Salvar configurações
  const handleSaveConfig = async () => {
    try {
      setSaving(true)
      // Aqui você implementaria a chamada para salvar as configurações
      // const response = await fetch('/api/config', {
      //   method: 'PUT',
      //   headers: {
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify(config)
      // })
      // 
      // if (!response.ok) {
      //   throw new Error('Erro ao salvar configurações')
      // }

      toast.success('Configurações salvas com sucesso')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar configurações'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  // Resetar configurações
  const handleResetConfig = () => {
    if (confirm('Tem certeza que deseja resetar todas as configurações?')) {
      loadConfig()
      toast.success('Configurações resetadas')
    }
  }

  const updateConfig = (section: keyof SystemConfig, field: string, value: string | number | boolean) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }))
  }

  if (status === 'loading' || loading) {
    return <div>Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Configurações do Sistema
          </h1>
          <p className="text-gray-600">
            Gerencie configurações gerais e parâmetros do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleResetConfig} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Resetar
          </Button>
          <Button onClick={handleSaveConfig} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Configurações da Organização */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Informações da Organização
          </CardTitle>
          <CardDescription>
            Configurações básicas da organização
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nomeOrganizacao">Nome da Organização</Label>
              <Input
                id="nomeOrganizacao"
                value={config.sistema.nomeOrganizacao}
                onChange={(e) => updateConfig('sistema', 'nomeOrganizacao', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="emailContato">Email de Contato</Label>
              <Input
                id="emailContato"
                type="email"
                value={config.sistema.emailContato}
                onChange={(e) => updateConfig('sistema', 'emailContato', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="telefoneContato">Telefone de Contato</Label>
              <Input
                id="telefoneContato"
                value={config.sistema.telefoneContato}
                onChange={(e) => updateConfig('sistema', 'telefoneContato', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="logoUrl">URL do Logo</Label>
              <Input
                id="logoUrl"
                value={config.sistema.logoUrl || ''}
                onChange={(e) => updateConfig('sistema', 'logoUrl', e.target.value)}
                placeholder="https://exemplo.com/logo.png"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="enderecoCompleto">Endereço Completo</Label>
            <Textarea
              id="enderecoCompleto"
              value={config.sistema.enderecoCompleto}
              onChange={(e) => updateConfig('sistema', 'enderecoCompleto', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações
          </CardTitle>
          <CardDescription>
            Configure as notificações do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emailRemetente">Email Remetente</Label>
              <Input
                id="emailRemetente"
                type="email"
                value={config.notificacoes.emailRemetente}
                onChange={(e) => updateConfig('notificacoes', 'emailRemetente', e.target.value)}
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificações por Email</Label>
                <p className="text-sm text-gray-600">Ativar sistema de notificações por email</p>
              </div>
              <Switch
                checked={config.notificacoes.emailNotificacoes}
                onCheckedChange={(checked) => updateConfig('notificacoes', 'emailNotificacoes', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificações de Processos</Label>
                <p className="text-sm text-gray-600">Notificar sobre alterações em processos</p>
              </div>
              <Switch
                checked={config.notificacoes.notificacaoProcessos}
                onCheckedChange={(checked) => updateConfig('notificacoes', 'notificacaoProcessos', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificações de Acordos</Label>
                <p className="text-sm text-gray-600">Notificar sobre acordos firmados</p>
              </div>
              <Switch
                checked={config.notificacoes.notificacaoAcordos}
                onCheckedChange={(checked) => updateConfig('notificacoes', 'notificacaoAcordos', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Notificações de Sessões</Label>
                <p className="text-sm text-gray-600">Notificar sobre sessões de julgamento</p>
              </div>
              <Switch
                checked={config.notificacoes.notificacaoSessoes}
                onCheckedChange={(checked) => updateConfig('notificacoes', 'notificacaoSessoes', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Segurança */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Segurança
          </CardTitle>
          <CardDescription>
            Configurações de segurança e autenticação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sessaoExpiraMinutos">Expiração da Sessão (minutos)</Label>
              <Input
                id="sessaoExpiraMinutos"
                type="number"
                min="30"
                max="1440"
                value={config.seguranca.sessaoExpiraMinutos}
                onChange={(e) => updateConfig('seguranca', 'sessaoExpiraMinutos', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="tentativasLoginMax">Máximo Tentativas de Login</Label>
              <Input
                id="tentativasLoginMax"
                type="number"
                min="3"
                max="10"
                value={config.seguranca.tentativasLoginMax}
                onChange={(e) => updateConfig('seguranca', 'tentativasLoginMax', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="senhaMinCaracteres">Senha Mínima (caracteres)</Label>
              <Input
                id="senhaMinCaracteres"
                type="number"
                min="6"
                max="20"
                value={config.seguranca.senhaMinCaracteres}
                onChange={(e) => updateConfig('seguranca', 'senhaMinCaracteres', parseInt(e.target.value))}
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Exigir Senha Complexa</Label>
                <p className="text-sm text-gray-600">Requer letras maiúsculas, números e símbolos</p>
              </div>
              <Switch
                checked={config.seguranca.exigirSenhaCompleta}
                onCheckedChange={(checked) => updateConfig('seguranca', 'exigirSenhaCompleta', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Permitir Múltiplas Sessões</Label>
                <p className="text-sm text-gray-600">Usuário pode estar logado em múltiplos dispositivos</p>
              </div>
              <Switch
                checked={config.seguranca.permitirMultiplosSessions}
                onCheckedChange={(checked) => updateConfig('seguranca', 'permitirMultiplosSessions', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações Gerais do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Sistema Geral
          </CardTitle>
          <CardDescription>
            Configurações gerais de funcionamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="manterLogsAuditoriaDias">Manter Logs de Auditoria (dias)</Label>
              <Input
                id="manterLogsAuditoriaDias"
                type="number"
                min="30"
                max="365"
                value={config.sistema_geral.manterLogsAuditoriaDias}
                onChange={(e) => updateConfig('sistema_geral', 'manterLogsAuditoriaDias', parseInt(e.target.value))}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="mensagemManutencao">Mensagem de Manutenção</Label>
            <Textarea
              id="mensagemManutencao"
              value={config.sistema_geral.mensagemManutencao}
              onChange={(e) => updateConfig('sistema_geral', 'mensagemManutencao', e.target.value)}
              rows={3}
            />
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Permitir Cadastro Público</Label>
                <p className="text-sm text-gray-600">Usuários podem se cadastrar sem aprovação</p>
              </div>
              <Switch
                checked={config.sistema_geral.permitirCadastroPublico}
                onCheckedChange={(checked) => updateConfig('sistema_geral', 'permitirCadastroPublico', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <div>
                  <Label>Modo Manutenção</Label>
                  <p className="text-sm text-gray-600">Sistema indisponível para usuários</p>
                </div>
              </div>
              <Switch
                checked={config.sistema_geral.modoManutencao}
                onCheckedChange={(checked) => updateConfig('sistema_geral', 'modoManutencao', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup Automático
          </CardTitle>
          <CardDescription>
            Configurações de backup do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="intervaloBkpHoras">Intervalo do Backup (horas)</Label>
              <Select 
                value={config.backup.intervaloBkpHoras.toString()} 
                onValueChange={(value) => updateConfig('backup', 'intervaloBkpHoras', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 horas</SelectItem>
                  <SelectItem value="12">12 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                  <SelectItem value="72">3 dias</SelectItem>
                  <SelectItem value="168">1 semana</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="manterBackupsDias">Manter Backups (dias)</Label>
              <Input
                id="manterBackupsDias"
                type="number"
                min="7"
                max="365"
                value={config.backup.manterBackupsDias}
                onChange={(e) => updateConfig('backup', 'manterBackupsDias', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="emailBackupStatus">Email para Status</Label>
              <Input
                id="emailBackupStatus"
                type="email"
                value={config.backup.emailBackupStatus}
                onChange={(e) => updateConfig('backup', 'emailBackupStatus', e.target.value)}
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Backup Automático</Label>
              <p className="text-sm text-gray-600">Executar backups automaticamente</p>
            </div>
            <Switch
              checked={config.backup.backupAutomatico}
              onCheckedChange={(checked) => updateConfig('backup', 'backupAutomatico', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/documentos'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Tipos de arquivo permitidos
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain'
]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser
    const { id: processoId } = await params

    // Apenas Admin e Funcionário podem anexar documentos
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para anexar documentos' },
        { status: 403 }
      )
    }

    // Verificar se o processo existe
    const processo = await prisma.processo.findUnique({
      where: { id: processoId },
      select: { id: true, numero: true, status: true }
    })

    if (!processo) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const nomePersonalizado = formData.get('nome') as string

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      )
    }

    // Validar tipo de arquivo
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido' },
        { status: 400 }
      )
    }

    // Validar tamanho do arquivo
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Arquivo muito grande (máximo 10MB)' },
        { status: 400 }
      )
    }

    // Criar diretório se não existir (substituir '/' por '-' no nome da pasta)
    const processoDirName = processo.numero.replace(/\//g, '-')
    const processoDir = join(UPLOAD_DIR, processoDirName)
    if (!existsSync(processoDir)) {
      await mkdir(processoDir, { recursive: true })
    }

    // Gerar nome único para o arquivo
    const fileExtension = file.name.split('.').pop()
    const uniqueFileName = `${uuidv4()}.${fileExtension}`
    const filePath = join(processoDir, uniqueFileName)

    // Salvar arquivo no sistema de arquivos
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Usar transação para salvar documento e atualizar status
    const resultado = await prisma.$transaction(async (tx) => {
      // Salvar referência no banco de dados
      const documento = await tx.documento.create({
        data: {
          processoId: processoId,
          nome: nomePersonalizado || file.name,
          tipo: file.type,
          url: `/uploads/documentos/${processoDirName}/${uniqueFileName}`,
          tamanho: file.size
        }
      })

      // Atualizar status para EM_ANALISE se for RECEPCIONADO
      if (processo.status === 'RECEPCIONADO') {
        await tx.processo.update({
          where: { id: processoId },
          data: { status: 'EM_ANALISE' }
        })
      }

      return documento
    })

    const documento = resultado

    // Log de auditoria
    const userExists = await prisma.user.findUnique({
      where: { id: user.id }
    })
    
    if (userExists) {
      await prisma.logAuditoria.create({
        data: {
          usuarioId: user.id,
          acao: 'CREATE',
          entidade: 'Documento',
          entidadeId: documento.id,
          dadosNovos: {
            nome: documento.nome,
            tipo: documento.tipo,
            tamanho: documento.tamanho,
            processo: processo.numero
          }
        }
      })
    }

    return NextResponse.json({
      message: 'Documento anexado com sucesso',
      documento: documento
    }, { status: 201 })

  } catch (error) {
    console.error('Erro ao anexar documento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET - Listar documentos do processo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: processoId } = await params

    const documentos = await prisma.documento.findMany({
      where: { processoId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ documentos })
  } catch (error) {
    console.error('Erro ao listar documentos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
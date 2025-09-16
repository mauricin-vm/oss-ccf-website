import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/documentos'
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentoId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const user = session.user as SessionUser
    const { id: processoId, documentoId } = await params
    // Apenas Admin e Funcionário podem deletar documentos
    if (user.role === 'VISUALIZADOR') {
      return NextResponse.json(
        { error: 'Sem permissão para deletar documentos' },
        { status: 403 }
      )
    }
    // Buscar o documento
    const documento = await prisma.documento.findUnique({
      where: { 
        id: documentoId,
        processoId: processoId
      },
      include: {
        processo: {
          select: {
            numero: true
          }
        }
      }
    })
    if (!documento) {
      return NextResponse.json(
        { error: 'Documento não encontrado' },
        { status: 404 }
      )
    }
    // Montar caminho do arquivo (substituir '/' por '-' no nome da pasta)
    const processoDirName = documento.processo.numero.replace(/\//g, '-')
    const filePath = join(process.cwd(), UPLOAD_DIR, processoDirName, documento.url.split('/').pop()!)
    // Deletar arquivo do sistema de arquivos se existir
    if (existsSync(filePath)) {
      try {
        await unlink(filePath)
      } catch (fileError) {
        console.error('Erro ao deletar arquivo do sistema:', fileError)
        // Continua mesmo se não conseguir deletar o arquivo físico
      }
    }
    // Deletar referência do banco de dados
    await prisma.documento.delete({
      where: { id: documentoId }
    })
    // Log de auditoria
    const userExists = await prisma.user.findUnique({
      where: { id: user.id }
    })
    if (userExists) {
      await prisma.logAuditoria.create({
        data: {
          usuarioId: user.id,
          acao: 'DELETE',
          entidade: 'Documento',
          entidadeId: documento.id,
          dadosAnteriores: {
            nome: documento.nome,
            tipo: documento.tipo,
            tamanho: documento.tamanho,
            processo: documento.processo.numero,
            ip: request.headers.get('x-forwarded-for') || 'unknown'
          }
        }
      })
    }
    return NextResponse.json({
      message: 'Documento deletado com sucesso'
    }, { status: 200 })
  } catch (error) {
    console.error('Erro ao deletar documento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
export async function GET(
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
    // Usar o caminho direto salvo no banco (compatibilidade com projeto anterior)
    const filePath = documento.url
    // Verificar se arquivo existe
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado no sistema' },
        { status: 404 }
      )
    }
    try {
      // Ler arquivo
      const fileBuffer = await readFile(filePath)
      // Log de auditoria
      const userExists = await prisma.user.findUnique({
        where: { id: user.id }
      })
      if (userExists) {
        await prisma.logAuditoria.create({
          data: {
            usuarioId: user.id,
            acao: 'DOWNLOAD',
            entidade: 'Documento',
            entidadeId: documento.id,
            dadosNovos: {
              nome: documento.nome,
              processo: documento.processo.numero,
              ip: request.headers.get('x-forwarded-for') || 'unknown'
            }
          }
        })
      }
      // Determinar Content-Type baseado no tipo do arquivo
      let contentType = documento.tipo
      if (!contentType || contentType === 'application/octet-stream') {
        const extension = documento.nome.split('.').pop()?.toLowerCase()
        switch (extension) {
          case 'pdf':
            contentType = 'application/pdf'
            break
          case 'doc':
            contentType = 'application/msword'
            break
          case 'docx':
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            break
          case 'xls':
            contentType = 'application/vnd.ms-excel'
            break
          case 'xlsx':
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            break
          case 'jpg':
          case 'jpeg':
            contentType = 'image/jpeg'
            break
          case 'png':
            contentType = 'image/png'
            break
          case 'gif':
            contentType = 'image/gif'
            break
          case 'txt':
            contentType = 'text/plain'
            break
          default:
            contentType = 'application/octet-stream'
        }
      }
      // Preparar nome do arquivo para download (sanitizar)
      const sanitizedFileName = documento.nome.replace(/[^a-zA-Z0-9.-]/g, '_')
      // Retornar arquivo
      return new NextResponse(fileBuffer as unknown as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${sanitizedFileName}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    } catch (fileError) {
      console.error('Erro ao ler arquivo:', fileError)
      return NextResponse.json(
        { error: 'Erro ao ler arquivo do sistema' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Erro ao fazer download do documento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
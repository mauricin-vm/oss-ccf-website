import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import fs from 'fs'
import path from 'path'

// GET - Download folha de jeton como documento Word
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = session.user as SessionUser
    const canAccess = user.role === 'ADMIN' || user.role === 'FUNCIONARIO'

    if (!canAccess) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { id } = await params

    // Buscar folha de jeton com dados relacionados
    const folha = await prisma.folhaJeton.findUnique({
      where: { id },
      include: {
        sessao: {
          include: {
            pauta: true,
            presidente: true
          }
        },
        membros: {
          where: { presente: true },
          include: {
            conselheiro: true
          }
        }
      }
    })

    if (!folha) {
      return NextResponse.json({ error: 'Folha não encontrada' }, { status: 404 })
    }

    // Carregar template
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'folha-jeton-template.docx')

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({
        error: 'Template não encontrado. Por favor, coloque o arquivo folha-jeton-template.docx em public/templates/'
      }, { status: 404 })
    }

    const content = fs.readFileSync(templatePath, 'binary')
    const zip = new PizZip(content)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    })

    // Preparar dados para o template
    const dataSessao = new Date(folha.sessao.dataInicio)

    // Formato: MÊS/ANO (ex: JANEIRO/2025)
    const meses = [
      'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
      'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
    ]
    const mesAno = `${meses[dataSessao.getMonth()]}/${dataSessao.getFullYear()}`

    // Formato: DD/MM/YYYY
    const dia = String(dataSessao.getDate()).padStart(2, '0')
    const mes = String(dataSessao.getMonth() + 1).padStart(2, '0')
    const ano = dataSessao.getFullYear()
    const dataFormatada = `${dia}/${mes}/${ano}`

    // Ordenar membros conforme regra:
    // 1° - Presidente da sessão
    // 2° - Membros SEFAZ (ordem alfabética)
    // 3° - Membros PGM (ordem alfabética)
    // 4° - Outros membros (ordem alfabética)
    const presidenteId = folha.sessao.presidente?.id

    const membrosOrdenados = [...folha.membros].sort((a, b) => {
      // Presidente sempre primeiro
      const aEhPresidente = a.conselheiroId === presidenteId
      const bEhPresidente = b.conselheiroId === presidenteId

      if (aEhPresidente) return -1
      if (bEhPresidente) return 1

      // Siglas
      const siglaA = a.conselheiro.sigla || ''
      const siglaB = b.conselheiro.sigla || ''

      // SEFAZ vem antes de todos (exceto presidente)
      const aEhSefaz = siglaA === 'SEFAZ'
      const bEhSefaz = siglaB === 'SEFAZ'

      if (aEhSefaz && !bEhSefaz) return -1
      if (!aEhSefaz && bEhSefaz) return 1

      // Se ambos são SEFAZ, ordenar alfabeticamente por nome
      if (aEhSefaz && bEhSefaz) {
        return a.conselheiro.nome.localeCompare(b.conselheiro.nome)
      }

      // PGM vem depois de SEFAZ
      const aEhPgm = siglaA === 'PGM'
      const bEhPgm = siglaB === 'PGM'

      if (aEhPgm && !bEhPgm) return -1
      if (!aEhPgm && bEhPgm) return 1

      // Se ambos são PGM, ordenar alfabeticamente por nome
      if (aEhPgm && bEhPgm) {
        return a.conselheiro.nome.localeCompare(b.conselheiro.nome)
      }

      // Demais membros ordenados alfabeticamente
      return a.conselheiro.nome.localeCompare(b.conselheiro.nome)
    })

    // Preparar lista com numeração sequencial após ordenação
    const membros = membrosOrdenados.map((membro, index) => ({
      n: index + 1,
      mat: membro.conselheiro.matricula || 'N/A',
      nome: membro.conselheiro.nome.toUpperCase(),
      s: membro.conselheiro.sigla || membro.conselheiro.origem || 'N/A'
    }))

    // Preencher template
    doc.setData({
      mesAno,
      dataSessao: dataFormatada,
      m: membros
    })

    try {
      doc.render()
    } catch (error) {
      console.error('Erro ao renderizar template:', error)
      return NextResponse.json({
        error: 'Erro ao preencher template. Verifique se os placeholders estão corretos.'
      }, { status: 500 })
    }

    const buffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    })

    // Nome do arquivo (formato: DD MM YYYY)
    const nomeArquivo = `${dia} ${mes} ${ano}.docx`

    // Retornar arquivo Word
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      },
    })
  } catch (error) {
    console.error('Erro ao gerar documento:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar documento' },
      { status: 500 }
    )
  }
}

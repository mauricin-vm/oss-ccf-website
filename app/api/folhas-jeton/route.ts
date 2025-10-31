import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/db'
import { SessionUser } from '@/types'

// GET - Lista folhas de jeton ou calcula valores das sessões
export async function GET(req: NextRequest) {
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

    const searchParams = req.nextUrl.searchParams
    const sessaoId = searchParams.get('sessaoId')

    // Se solicitar uma sessão específica
    if (sessaoId) {
      const folha = await prisma.folhaJeton.findUnique({
        where: { sessaoId },
        include: {
          sessao: {
            include: {
              pauta: true,
              conselheiros: true
            }
          },
          membros: {
            include: {
              conselheiro: true
            }
          }
        }
      })

      return NextResponse.json({ folha })
    }

    // Listar todas as sessões com informações de jeton
    const sessoes = await prisma.sessaoJulgamento.findMany({
      include: {
        pauta: {
          include: {
            processos: {
              include: {
                processo: {
                  select: {
                    id: true,
                    tipo: true,
                    transacao: {
                      select: {
                        valorTotalProposto: true
                      }
                    },
                    inscricoes: {
                      select: {
                        numeroInscricao: true,
                        debitos: {
                          select: {
                            valor: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        conselheiros: true,
        presidente: true,
        folhaJeton: {
          include: {
            membros: {
              include: {
                conselheiro: true
              }
            }
          }
        }
      },
      orderBy: {
        dataInicio: 'desc'
      }
    })

    // Calcular valor total discutido para cada sessão
    // Usa sempre os valores propostos/oferecidos, pois no momento da sessão ainda não há acordos
    const sessoesComValores = sessoes.map(sessao => {
      let valorTotalDiscutido = 0

      if (sessao.pauta) {
        sessao.pauta.processos.forEach(processoPauta => {
          const processo = processoPauta.processo
          let valorProcesso = 0

          if (processo.tipo === 'TRANSACAO_EXCEPCIONAL' && processo.transacao) {
            // Para transação: Valor Total Proposto (o que foi discutido)
            valorProcesso = Number(processo.transacao.valorTotalProposto || 0)
          } else if (processo.tipo === 'COMPENSACAO') {
            // Para compensação: somar débitos de todas as inscrições do processo
            // (no momento da sessão ainda não há acordos, então usamos o que foi registrado no processo)
            processo.inscricoes.forEach(inscricao => {
              inscricao.debitos.forEach(debito => {
                valorProcesso += Number(debito.valor || 0)
              })
            })
          } else if (processo.tipo === 'DACAO_PAGAMENTO') {
            // Para dação: somar débitos de todas as inscrições do processo
            // (no momento da sessão ainda não há acordos, então usamos o que foi registrado no processo)
            processo.inscricoes.forEach(inscricao => {
              inscricao.debitos.forEach(debito => {
                valorProcesso += Number(debito.valor || 0)
              })
            })
          }

          valorTotalDiscutido += valorProcesso
        })
      }

      // Calcular valor total de jetons
      let valorTotalJetons = 0
      if (sessao.folhaJeton) {
        sessao.folhaJeton.membros.forEach(membro => {
          if (membro.presente) {
            valorTotalJetons += Number(membro.valorJeton || 0)
          }
        })
      }

      return {
        ...sessao,
        valorTotalDiscutido,
        valorTotalJetons,
        quantidadeMembros: sessao.conselheiros.length
      }
    })

    return NextResponse.json({
      sessoes: sessoesComValores
    })
  } catch (error) {
    console.error('Erro ao buscar folhas de jeton:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar folhas de jeton' },
      { status: 500 }
    )
  }
}

// POST - Cria ou atualiza folha de jeton
export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { sessaoId, membros, observacoes, status, dataEntrega } = body

    // Validações
    if (!sessaoId) {
      return NextResponse.json({ error: 'Sessão é obrigatória' }, { status: 400 })
    }

    if (!membros || !Array.isArray(membros) || membros.length === 0) {
      return NextResponse.json({ error: 'Pelo menos um membro deve ser incluído' }, { status: 400 })
    }

    // Validar status se fornecido
    if (status && !['PENDENTE', 'ENTREGUE'].includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    // Verificar se sessão existe
    const sessao = await prisma.sessaoJulgamento.findUnique({
      where: { id: sessaoId }
    })

    if (!sessao) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    // Verificar se já existe folha para essa sessão
    const folhaExistente = await prisma.folhaJeton.findUnique({
      where: { sessaoId }
    })

    if (folhaExistente) {
      // Atualizar folha existente
      await prisma.membroJeton.deleteMany({
        where: { folhaJetonId: folhaExistente.id }
      })

      const membrosData = membros.map((membro: {
        conselheiroId: string
        valorJeton: number
        presente: boolean
        observacoes?: string
      }) => ({
        folhaJetonId: folhaExistente.id,
        conselheiroId: membro.conselheiroId,
        valorJeton: membro.valorJeton,
        presente: membro.presente,
        observacoes: membro.observacoes
      }))

      await prisma.membroJeton.createMany({
        data: membrosData
      })

      await prisma.folhaJeton.update({
        where: { id: folhaExistente.id },
        data: {
          observacoes,
          ...(status && { status }),
          ...(dataEntrega !== undefined && {
            dataEntrega: dataEntrega ? new Date(dataEntrega) : null
          })
        }
      })

      return NextResponse.json({
        message: 'Folha de jeton atualizada com sucesso',
        folhaId: folhaExistente.id
      })
    } else {
      // Criar nova folha
      const folha = await prisma.folhaJeton.create({
        data: {
          sessaoId,
          observacoes,
          ...(status && { status }),
          ...(dataEntrega && { dataEntrega: new Date(dataEntrega) }),
          membros: {
            create: membros.map((membro: {
              conselheiroId: string
              valorJeton: number
              presente: boolean
              observacoes?: string
            }) => ({
              conselheiroId: membro.conselheiroId,
              valorJeton: membro.valorJeton,
              presente: membro.presente,
              observacoes: membro.observacoes
            }))
          }
        }
      })

      return NextResponse.json({
        message: 'Folha de jeton criada com sucesso',
        folhaId: folha.id
      }, { status: 201 })
    }
  } catch (error) {
    console.error('Erro ao criar/atualizar folha de jeton:', error)
    return NextResponse.json(
      { error: 'Erro ao processar folha de jeton' },
      { status: 500 }
    )
  }
}

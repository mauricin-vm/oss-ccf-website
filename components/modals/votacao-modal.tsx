'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ChevronRight, ChevronLeft, Users, Gavel, CheckCircle, AlertCircle } from 'lucide-react'

interface ProcessoPauta {
  ordem: number
  relator?: string
  processo: {
    id: string
    numero: string
    contribuinte: {
      nome: string
    }
  }
}

interface Conselheiro {
  id: string
  nome: string
  email?: string
  cargo?: string
}

interface VotoRelator {
  nome: string
  tipo: 'RELATOR' | 'REVISOR'
  posicao: 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL' | 'ACOMPANHA'
  acompanhaVoto?: string
}

interface VotoConselheiro {
  conselheiroId: string
  nome: string
  posicao: 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL' | 'ABSTENCAO' | 'AUSENTE' | 'IMPEDIDO'
}

interface ResultadoVotacao {
  relatores: VotoRelator[]
  conselheiros: VotoConselheiro[]
  resultado: {
    deferidos: number
    indeferidos: number
    parciais: number
    abstencoes: number
    ausentes: number
    impedidos: number
    decisaoFinal: 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL'
  }
}

interface VotacaoModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (resultado: ResultadoVotacao) => void
  processo: ProcessoPauta
  conselheiros: Conselheiro[]
  relatoresRevisores?: { nome: string; tipo: 'RELATOR' | 'REVISOR' }[]
}

export default function VotacaoModal({
  isOpen,
  onClose,
  onConfirm,
  processo,
  conselheiros,
  relatoresRevisores = []
}: VotacaoModalProps) {
  const [etapaAtual, setEtapaAtual] = useState(1)
  const [votosRelatores, setVotosRelatores] = useState<VotoRelator[]>([])
  const [votosConselheiros, setVotosConselheiros] = useState<VotoConselheiro[]>([])

  // Preparar lista de relatores/revisores
  const relatoresData = relatoresRevisores.length > 0
    ? relatoresRevisores
    : processo.relator
      ? [{ nome: processo.relator, tipo: 'RELATOR' as const }]
      : []

  useEffect(() => {
    if (isOpen) {
      // Reset dos dados quando o modal é aberto
      setEtapaAtual(1)
      setVotosRelatores(relatoresData.map(r => ({
        nome: r.nome,
        tipo: r.tipo,
        posicao: 'DEFERIDO' as const
      })))
      setVotosConselheiros(conselheiros.map(c => ({
        conselheiroId: c.id,
        nome: c.nome,
        posicao: 'DEFERIDO' as const
      })))
    }
  }, [isOpen, relatoresData, conselheiros])

  const atualizarVotoRelator = (index: number, posicao: string, acompanhaVoto?: string) => {
    const novosVotos = [...votosRelatores]
    novosVotos[index] = {
      ...novosVotos[index],
      posicao: posicao as any,
      acompanhaVoto: posicao === 'ACOMPANHA' ? acompanhaVoto : undefined
    }
    setVotosRelatores(novosVotos)
  }

  const atualizarVotoConselheiro = (index: number, posicao: string) => {
    const novosVotos = [...votosConselheiros]
    novosVotos[index] = {
      ...novosVotos[index],
      posicao: posicao as any
    }
    setVotosConselheiros(novosVotos)
  }

  const calcularResultado = (): ResultadoVotacao['resultado'] => {
    let deferidos = 0
    let indeferidos = 0
    let parciais = 0
    let abstencoes = 0
    let ausentes = 0
    let impedidos = 0

    // Contar votos dos relatores (convertendo ACOMPANHA para o voto correspondente)
    votosRelatores.forEach(voto => {
      if (voto.posicao === 'ACOMPANHA') {
        // Se acompanha alguém, precisa ver o voto dessa pessoa
        // Por simplicidade, vamos contar como deferido se não especificado
        deferidos++
      } else if (voto.posicao === 'DEFERIDO') {
        deferidos++
      } else if (voto.posicao === 'INDEFERIDO') {
        indeferidos++
      } else if (voto.posicao === 'PARCIAL') {
        parciais++
      }
    })

    // Contar votos dos conselheiros incluindo todas as situações
    votosConselheiros.forEach(voto => {
      if (voto.posicao === 'DEFERIDO') {
        deferidos++
      } else if (voto.posicao === 'INDEFERIDO') {
        indeferidos++
      } else if (voto.posicao === 'PARCIAL') {
        parciais++
      } else if (voto.posicao === 'ABSTENCAO') {
        abstencoes++
      } else if (voto.posicao === 'AUSENTE') {
        ausentes++
      } else if (voto.posicao === 'IMPEDIDO') {
        impedidos++
      }
    })

    // Determinar decisão final (maioria simples dos votos válidos)
    const totalVotos = deferidos + indeferidos + parciais
    let decisaoFinal: 'DEFERIDO' | 'INDEFERIDO' | 'PARCIAL' = 'DEFERIDO'

    if (indeferidos > deferidos && indeferidos > parciais) {
      decisaoFinal = 'INDEFERIDO'
    } else if (parciais > deferidos && parciais > indeferidos) {
      decisaoFinal = 'PARCIAL'
    }

    return { deferidos, indeferidos, parciais, abstencoes, ausentes, impedidos, decisaoFinal }
  }

  const podeAvancar = () => {
    if (etapaAtual === 1) {
      // Todos os relatores devem ter votado
      return votosRelatores.every(voto =>
        voto.posicao && (voto.posicao !== 'ACOMPANHA' || voto.acompanhaVoto)
      )
    }
    if (etapaAtual === 2) {
      // Todos os conselheiros devem ter votado
      return votosConselheiros.every(voto => voto.posicao)
    }
    return true
  }

  const handleConfirmar = () => {
    const resultado = calcularResultado()
    const resultadoCompleto: ResultadoVotacao = {
      relatores: votosRelatores,
      conselheiros: votosConselheiros,
      resultado
    }
    onConfirm(resultadoCompleto)
    onClose()
  }

  const renderEtapa1 = () => (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-gray-600">
          Defina como cada relator e revisor votou neste processo
        </p>
      </div>

      <div className="space-y-3">
        {votosRelatores.map((voto, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center gap-6">
              {/* Nome e Tipo */}
              <div className="flex items-center gap-2 min-w-[200px]">
                <Badge variant={voto.tipo === 'RELATOR' ? 'default' : 'secondary'} className="text-xs">
                  {voto.tipo === 'RELATOR' ? 'Relator' : 'Revisor'}
                </Badge>
                <span className="font-medium">{voto.nome}</span>
              </div>

              {/* Opções de Voto */}
              <div className="flex-1">
                <RadioGroup
                  value={voto.posicao}
                  onValueChange={(value) => atualizarVotoRelator(index, value)}
                  className="flex items-center gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="DEFERIDO" id={`relator-${index}-deferido`} />
                    <Label htmlFor={`relator-${index}-deferido`} className="text-green-700 font-medium">
                      Deferimento
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="INDEFERIDO" id={`relator-${index}-indeferido`} />
                    <Label htmlFor={`relator-${index}-indeferido`} className="text-red-700 font-medium">
                      Indeferimento
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PARCIAL" id={`relator-${index}-parcial`} />
                    <Label htmlFor={`relator-${index}-parcial`} className="text-yellow-700 font-medium">
                      Parcial
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ACOMPANHA" id={`relator-${index}-acompanha`} />
                    <Label htmlFor={`relator-${index}-acompanha`} className="text-blue-700 font-medium">
                      Acompanha outro
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Opção de acompanhar */}
            {voto.posicao === 'ACOMPANHA' && (
              <div className="mt-3 pl-6 border-l-2 border-blue-200">
                <Label className="text-sm text-gray-600 mb-2 block">Acompanha o voto de:</Label>
                <RadioGroup
                  value={voto.acompanhaVoto || ''}
                  onValueChange={(value) => atualizarVotoRelator(index, 'ACOMPANHA', value)}
                  className="flex items-center gap-4"
                >
                  {votosRelatores
                    .filter((_, i) => i !== index)
                    .map((outroVoto, i) => (
                      <div key={i} className="flex items-center space-x-2">
                        <RadioGroupItem value={outroVoto.nome} id={`acompanha-${index}-${i}`} />
                        <Label htmlFor={`acompanha-${index}-${i}`} className="text-sm">
                          {outroVoto.nome}
                        </Label>
                      </div>
                    ))}
                </RadioGroup>
              </div>
            )}
          </Card>
        ))}

        {relatoresData.length === 0 && (
          <div className="text-center py-6">
            <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Nenhum relator ou revisor definido para este processo</p>
            <p className="text-sm text-gray-500 mt-1">Pule para a próxima etapa</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderEtapa2 = () => {
    // Obter opções de voto baseadas nos votos dos relatores
    const opcoesVoto = Array.from(new Set(votosRelatores.map(r => r.posicao === 'ACOMPANHA' ? 'DEFERIDO' : r.posicao)))

    // Se não há relatores, usar opções padrão
    const colunas = opcoesVoto.length > 0 ? opcoesVoto : ['DEFERIDO', 'INDEFERIDO', 'PARCIAL']

    // Mapear cada coluna com os relatores que votaram assim
    const colunasComRelatores = colunas.map(posicao => {
      const relatoresComEssePosicao = votosRelatores.filter(r =>
        (r.posicao === 'ACOMPANHA' ? 'DEFERIDO' : r.posicao) === posicao
      )
      return { posicao, relatores: relatoresComEssePosicao }
    })

    const marcarTodosColuna = (posicao: string) => {
      const novosVotos = votosConselheiros.map(voto => ({
        ...voto,
        posicao: posicao as any
      }))
      setVotosConselheiros(novosVotos)
    }

    const getCorColuna = (posicao: string) => {
      switch (posicao) {
        case 'DEFERIDO': return 'text-green-700 bg-green-50 border-green-200'
        case 'INDEFERIDO': return 'text-red-700 bg-red-50 border-red-200'
        case 'PARCIAL': return 'text-yellow-700 bg-yellow-50 border-yellow-200'
        default: return 'text-gray-700 bg-gray-50 border-gray-200'
      }
    }

    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-gray-600">
            Registre como cada conselheiro acompanhou os votos dos relatores/revisores
          </p>
        </div>

        <div className="space-y-2">
          {/* Cabeçalho da tabela */}
          <div className={`grid gap-2 p-3 bg-gray-50 rounded-lg text-sm font-medium text-gray-700`}
            style={{ gridTemplateColumns: `2fr ${colunas.map(() => '1fr').join(' ')} min-content min-content min-content` }}>
            <div>Conselheiro</div>
            {colunasComRelatores.map(({ posicao, relatores }) => (
              <div key={posicao} className="text-center">
                {/* Nomes dos relatores acima do botão */}
                {relatores.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {relatores
                      .sort((a, b) => {
                        // Relator sempre primeiro, depois revisores
                        if (a.tipo === 'RELATOR' && b.tipo === 'REVISOR') return -1
                        if (a.tipo === 'REVISOR' && b.tipo === 'RELATOR') return 1
                        return 0
                      })
                      .map((relator, index) => (
                        <div key={index} className="text-xs text-gray-600">
                          <div className="flex items-center justify-center">
                            <span className="font-medium text-center">{relator.nome}</span>
                          </div>
                          {relator.posicao === 'ACOMPANHA' && relator.acompanhaVoto && (
                            <div className="text-xs text-blue-600 italic mt-1 text-center">
                              (acompanha {relator.acompanhaVoto})
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => marcarTodosColuna(posicao)}
                  className={`w-full p-1 rounded text-xs font-medium hover:opacity-80 transition-opacity ${getCorColuna(posicao)
                    }`}
                  title={`Marcar todos como ${posicao}`}
                >
                  {posicao}
                </button>
              </div>
            ))}

            {/* Colunas com largura reduzida */}
            <div className="text-center">
              <div className="mb-2 space-y-1" style={{ minHeight: '16px' }}></div>
              <button
                type="button"
                onClick={() => marcarTodosColuna('AUSENTE')}
                className="px-1 py-1 rounded text-xs font-medium text-gray-700 bg-gray-100 border-gray-200 hover:opacity-80 transition-opacity whitespace-nowrap"
                title="Marcar todos como AUSENTE"
              >
                AUS
              </button>
            </div>

            <div className="text-center">
              <div className="mb-2 space-y-1" style={{ minHeight: '16px' }}></div>
              <button
                type="button"
                onClick={() => marcarTodosColuna('IMPEDIDO')}
                className="px-1 py-1 rounded text-xs font-medium text-gray-700 bg-gray-100 border-gray-200 hover:opacity-80 transition-opacity whitespace-nowrap"
                title="Marcar todos como IMPEDIDO"
              >
                IMP
              </button>
            </div>

            <div className="text-center mr-1">
              <div className="mb-2 space-y-1" style={{ minHeight: '16px' }}></div>
              <button
                type="button"
                onClick={() => marcarTodosColuna('ABSTENCAO')}
                className="px-1 py-1 rounded text-xs font-medium text-gray-700 bg-gray-100 border-gray-200 hover:opacity-80 transition-opacity whitespace-nowrap"
                title="Marcar todos como ABSTENÇÃO"
              >
                ABS
              </button>
            </div>
          </div>

          {/* Linhas dos conselheiros */}
          {votosConselheiros.map((voto, index) => (
            <div key={voto.conselheiroId}
              className={`grid gap-2 p-3 border rounded-lg`}
              style={{ gridTemplateColumns: `2fr ${colunas.map(() => '1fr').join(' ')} min-content min-content min-content` }}>
              <div className="flex items-center">
                <span className="font-medium">{voto.nome}</span>
              </div>
              {colunasComRelatores.map(({ posicao }) => (
                <div key={posicao} className="flex justify-center items-center">
                  <RadioGroup
                    value={voto.posicao}
                    onValueChange={(value) => atualizarVotoConselheiro(index, value)}
                  >
                    <RadioGroupItem
                      value={posicao}
                      id={`conselheiro-${index}-${posicao.toLowerCase()}`}
                      className={`${voto.posicao === posicao ?
                        posicao === 'DEFERIDO' ? 'text-green-600 border-green-600' :
                          posicao === 'INDEFERIDO' ? 'text-red-600 border-red-600' :
                            'text-yellow-600 border-yellow-600'
                        : ''
                        }`}
                    />
                  </RadioGroup>
                </div>
              ))}

              <div className="flex gap-4 ml-2">

                {/* Ausente */}
                <div className="flex justify-center items-center">
                  <RadioGroup
                    value={voto.posicao}
                    onValueChange={(value) => atualizarVotoConselheiro(index, value)}
                  >
                    <RadioGroupItem
                      value="AUSENTE"
                      id={`conselheiro-${index}-ausente`}
                      className={voto.posicao === 'AUSENTE' ? 'text-gray-600 border-gray-600' : ''}
                    />
                  </RadioGroup>
                </div>

                {/* Impedido */}
                <div className="flex justify-center items-center">
                  <RadioGroup
                    value={voto.posicao}
                    onValueChange={(value) => atualizarVotoConselheiro(index, value)}
                  >
                    <RadioGroupItem
                      value="IMPEDIDO"
                      id={`conselheiro-${index}-impedido`}
                      className={voto.posicao === 'IMPEDIDO' ? 'text-gray-600 border-gray-600' : ''}
                    />
                  </RadioGroup>
                </div>

                {/* Abstenção */}
                <div className="flex justify-center items-center">
                  <RadioGroup
                    value={voto.posicao}
                    onValueChange={(value) => atualizarVotoConselheiro(index, value)}
                  >
                    <RadioGroupItem
                      value="ABSTENCAO"
                      id={`conselheiro-${index}-abstencao`}
                      className={voto.posicao === 'ABSTENCAO' ? 'text-gray-600 border-gray-600' : ''}
                    />
                  </RadioGroup>
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>
    )
  }

  const formatarListaNomes = (nomes: string[]): string => {
    if (nomes.length === 0) return ''
    if (nomes.length === 1) return nomes[0]
    if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`
    
    const todosExcetoUltimo = nomes.slice(0, -1).join(', ')
    const ultimo = nomes[nomes.length - 1]
    return `${todosExcetoUltimo} e ${ultimo}`
  }

  const renderEtapa3 = () => {
    const resultado = calcularResultado()

    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-gray-600">
            Revise o resultado final da votação antes de confirmar
          </p>
        </div>

        {/* Resultado Final */}
        <Card className="border-2 border-green-200 bg-green-50 p-4">
          <div className="text-center">
            <div className="text-xl font-bold text-green-800 mb-3">
              Resultado: {resultado.decisaoFinal}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <div className="text-xl font-bold text-green-600">{resultado.deferidos}</div>
                <div className="text-xs text-gray-600">Deferidos</div>
              </div>
              <div>
                <div className="text-xl font-bold text-red-600">{resultado.indeferidos}</div>
                <div className="text-xs text-gray-600">Indeferidos</div>
              </div>
              <div>
                <div className="text-xl font-bold text-yellow-600">{resultado.parciais}</div>
                <div className="text-xs text-gray-600">Parciais</div>
              </div>
            </div>

          </div>
        </Card>

        {/* Resumo dos Votos - Layout Compacto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {votosRelatores.length > 0 && (
            <Card className="p-3">
              <div className="font-medium text-gray-800 mb-2 text-sm">Relatores/Revisores</div>
              <div className="space-y-1">
                {votosRelatores.map((voto, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={voto.tipo === 'RELATOR' ? 'default' : 'secondary'} className="text-xs">
                        {voto.tipo === 'RELATOR' ? 'Relator' : 'Revisor'}
                      </Badge>
                      <span className="truncate font-medium">{voto.nome}</span>
                    </div>
                    <span className={`font-medium text-xs ${voto.posicao === 'DEFERIDO' ? 'text-green-600' :
                      voto.posicao === 'INDEFERIDO' ? 'text-red-600' :
                        voto.posicao === 'PARCIAL' ? 'text-yellow-600' :
                          'text-blue-600'
                      }`}>
                      {voto.posicao === 'ACOMPANHA'
                        ? `Acomp. ${voto.acompanhaVoto?.split(' ')[0]}`
                        : voto.posicao}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-3">
            <div className="font-medium text-gray-800 mb-3 text-sm">Conselheiros</div>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {/* Votos válidos agrupados */}
              {['DEFERIDO', 'INDEFERIDO', 'PARCIAL'].map(posicao => {
                const conselheirosComEssePosicao = votosConselheiros.filter(voto => voto.posicao === posicao)
                if (conselheirosComEssePosicao.length === 0) return null

                return (
                  <div key={posicao} className="text-xs">
                    <span className={`font-medium ${posicao === 'DEFERIDO' ? 'text-green-600' :
                      posicao === 'INDEFERIDO' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>
                      {posicao}:
                    </span>
                    <span className="ml-1 text-gray-700">
                      {formatarListaNomes(conselheirosComEssePosicao.map(voto => voto.nome))}
                    </span>
                  </div>
                )
              })}

              {/* Abstenções agrupadas */}
              {votosConselheiros.filter(voto => ['ABSTENCAO', 'AUSENTE', 'IMPEDIDO'].includes(voto.posicao)).length > 0 && (
                <div className="border-t pt-1 mt-1">
                  {['AUSENTE', 'IMPEDIDO', 'ABSTENCAO'].map(posicao => {
                    const conselheirosComEssePosicao = votosConselheiros.filter(voto => voto.posicao === posicao)
                    if (conselheirosComEssePosicao.length === 0) return null

                    return (
                      <div key={posicao} className="text-xs">
                        <span className="font-medium text-gray-600">
                          {posicao === 'ABSTENCAO' ? 'ABSTENÇÃO' :
                            posicao === 'AUSENTE' ? 'AUSENTE' : 'IMPEDIDO'}:
                        </span>
                        <span className="ml-1 text-gray-600">
                          {formatarListaNomes(conselheirosComEssePosicao.map(voto => voto.nome))}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-6xl sm:max-w-6xl min-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Sistema de Votação
          </DialogTitle>
          <DialogDescription>
            Processo: {processo.processo.numero} - {processo.processo.contribuinte.nome}
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de Etapas */}
        <div className="flex items-center justify-center space-x-1 py-2">
          {[1, 2, 3].map((etapa) => (
            <div key={etapa} className="flex items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${etapa < etapaAtual
                ? 'bg-green-600 text-white'
                : etapa === etapaAtual
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
                }`}>
                {etapa < etapaAtual ? '✓' : etapa}
              </div>
              {etapa < 3 && (
                <div className={`w-6 h-0.5 mx-1 ${etapa < etapaAtual ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-6">
          {etapaAtual === 1 && renderEtapa1()}
          {etapaAtual === 2 && renderEtapa2()}
          {etapaAtual === 3 && renderEtapa3()}
        </div>

        <Separator />

        {/* Botões de Navegação */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => etapaAtual > 1 ? setEtapaAtual(etapaAtual - 1) : onClose()}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {etapaAtual > 1 ? 'Anterior' : 'Cancelar'}
          </Button>

          <div className="flex gap-2">
            {etapaAtual < 3 ? (
              <Button
                onClick={() => setEtapaAtual(etapaAtual + 1)}
                disabled={!podeAvancar()}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleConfirmar} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-1" />
                Confirmar Votação
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
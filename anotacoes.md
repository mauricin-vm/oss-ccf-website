corrigir timezone

corrigir script de migrar acordo para aproveitar informações do processo cadastrado, sem precisar preencher coisa repetida (tipoProcesso)



● ✅ Reformulação das Tabelas de Acordos - CONCLUÍDA

  A reformulação das tabelas de acordos foi implementada com sucesso! Aqui está um resumo do que foi realizado:

  📊 Estrutura Implementada

  ✅ Tabelas Criadas/Modificadas:

  1. Acordo (reformulada) - Tabela principal simplificada
  2. AcordoTransacao (nova) - Dados específicos de transação excepcional
  3. AcordoCompensacao (nova) - Dados específicos de compensação
  4. AcordoDacao (nova) - Dados específicos de dação em pagamento
  5. AcordoInscricao (reformulada) - Inscrições unificadas com finalidade
  6. AcordoDebito (nova) - Débitos das inscrições
  7. AcordoCredito (nova) - Créditos para compensação
  8. Parcela (atualizada) - Adicionado campo tipoParcela

  🗑️ Removidas:

  - AcordoDetalhes - Substituída pelas tabelas específicas
  - StatusAcordoDetalhe - Enum não mais necessário

  🔧 Componentes Atualizados:

  ✅ Prisma Schema

  - Novos models com relacionamentos corretos
  - Enums apropriados (TipoParcela, TipoInscricao, FinalidadeInscricao)
  - Índices para performance

  ✅ Validações Zod

  - Schema discriminativo por tipo de processo
  - Validações específicas para cada tipo
  - Tipos TypeScript atualizados

  ✅ API Principal (/api/acordos)

  - GET: Listagem com nova estrutura
  - POST: Criação com transações atômicas
  - Lógica específica para cada tipo de processo
  - Criação automática de parcelas para transações

  🎯 Benefícios Alcançados:

  - ✅ Estrutura limpa: Dados organizados por tipo sem JSON
  - ✅ Performance: Queries tipadas e otimizadas
  - ✅ Manutenibilidade: Código mais claro e extensível
  - ✅ Integridade: Transações atômicas garantem consistência
  - ✅ Padronização: Nomenclatura consistente (PascalCase)

  📝 Próximos Passos:

  Os formulários e componentes precisarão ser adaptados para usar a nova estrutura de dados. A API está funcional e pronta para receber dados no novo formato. Os componentes atuais continuarão
  funcionando com os acordos existentes, mas novos acordos seguirão a estrutura reformulada.

  A infraestrutura está estabelecida e funcionando corretamente! 🚀

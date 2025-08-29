# Changelog do Aplicativo Financeiro

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [1.0.0] - 2025-08-29

### Adicionado

* **Geração de Despesas Aleatórias:** Funcionalidade para popular a aplicação com despesas geradas aleatoriamente para todos os meses, facilitando testes e demonstrações.

* **Modal de Limpeza de Dados Aprimorado:** Um modal de exclusão de dados foi adicionado, permitindo a seleção de opções específicas de limpeza (apenas receitas, apenas despesas, apenas cartões, ou todos os dados).

* **Limpeza Suave de Dados por Mês/Ano:** Implementada a capacidade de "limpar suavemente" (soft delete) dados de receitas e despesas para um mês e ano específicos, marcando-os como inativos em vez de excluí-los permanentemente.

* **Função `getLastDayOfMonth`:** Função auxiliar adicionada para determinar o último dia de um mês específico, utilizada no cálculo de datas de vencimento.

* **Funções para Datas de Vencimento de Crédito:** Novas funções `getFirstCreditDueDate` e `getNextInstallmentDueDate` para calcular e ajustar as datas de vencimento das parcelas de crédito, considerando o dia de vencimento do cartão e a data da compra.

### Melhorado

* **Exibição de Despesas Fixas:** Despesas do tipo "Fixa" agora são exibidas na `HomeScreen` com o sufixo "(Fixa)" para identificação clara.

* **Organização de Comentários no `HomeScreen.js`:** Os comentários foram otimizados para estudo, com um cabeçalho mais conciso, detalhes em `useState` e explicações nas dependências dos hooks (`useCallback`, `useMemo`, `useEffect`).

* **Lógica de Edição de Despesas de Crédito:** A tela de edição de despesas (`DespesaScreen.js`) agora recalcula corretamente as datas das parcelas de crédito com base na "Data da Compra" selecionada, resolvendo um bug anterior.

* **Estrutura de Comentários no `DespesaScreen.js`:** Comentários foram reorganizados e padronizados para melhor legibilidade e entendimento do código.

* **Exibição de Status de Despesas:** A função `getStatusText` foi aprimorada para incluir o status "Atrasado", além de "Pago", "Pendente", "Vence Hoje" e "Vence Amanhã".

* **Layout da Lista de Despesas (`HomeScreen.js`):**

  * A coluna "Status/Vencimento" foi removida do cabeçalho da lista.

  * Informações de status foram movidas para um "rodapézinho" abaixo da descrição da despesa, com fonte menor e cor mais discreta.

  * Ajustes de `marginRight` e `paddingVertical` para melhorar o espaçamento e a área de toque dos itens da lista.

* **Experiência de Edição de Despesas:** Um *toque longo* em um item da lista de despesas na `HomeScreen` agora navega para a tela de edição, enquanto o *toque simples* continua a alternar o status de pago/pendente, eliminando "miss clicks".

* **Rolagem Inicial da `FlatList` (`HomeScreen.js`):** A lógica de inicialização da rolagem foi reestruturada para garantir que a `FlatList` sempre renderize no mês atual do sistema desde o primeiro carregamento, eliminando o "flicker".

* **Picker de Mês/Ano no Modal de Limpeza:** O picker de mês/ano para limpeza suave de dados agora exibe meses e anos de forma mais intuitiva, usando nomes de meses em português.

### Corrigido

* **Bug na Data da Compra (Edição de Crédito):** Corrigido um bug onde a data da compra alterada na edição de despesas de crédito não era utilizada para recalcular as parcelas, resultando em datas incorretas.

* **Erro de Digitação `ASYC_STORAGE_KEYS`:** Corrigido o erro de digitação de `ASYC_STORAGE_KEYS` para `ASYNC_STORAGE_KEYS` em várias partes do `HomeScreen.js`, garantindo o uso correto das constantes de armazenamento.

* **Avisos de `Text strings must be rendered within a <Text> component`:** Revisão em todos os componentes `<Text>` para garantir a correta renderização de strings, eliminando avisos no console.

* **Duplicação de "(Fixa)" na Descrição:** Corrigido o problema de despesas fixas exibirem "(Fixa)" duas vezes na `HomeScreen`, garantindo que apareça apenas uma vez e no local correto.
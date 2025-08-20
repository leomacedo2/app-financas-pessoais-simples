// screens/HomeScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, ActivityIndicator, Alert, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Importa os estilos comuns para reutilização
import commonStyles from '../utils/commonStyles';
// Importa as chaves de AsyncStorage como constantes
import { ASYNC_STORAGE_KEYS } from '../utils/constants';

// Funções auxiliares para manipulação de datas
const { width } = Dimensions.get('window'); // Largura da tela para rolagem paginada

/**
 * Converte uma string de data no formato "DD/MM/AAAA" para um objeto Date.
 * @param {string} dateString - A string de data a ser parseada.
 * @returns {Date} Um objeto Date.
 */
const parseDateString = (dateString) => {
  const [day, month, year] = dateString.split('/').map(Number);
  // O mês em Date é 0-indexado (Janeiro é 0, Dezembro é 11)
  return new Date(year, month - 1, day);
};

/**
 * Formata um objeto Date para exibição no formato "DD/MM/AAAA".
 * @param {Date} date - O objeto Date a ser formatado.
 * @returns {string} A data formatada.
 */
const formatDateForDisplay = (date) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0'); // Mês + 1 para exibir corretamente
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Retorna o nome do mês de um objeto Date em português.
 * @param {Date} date - O objeto Date.
 * @returns {string} O nome do mês.
 */
const getMonthName = (date) => {
  const d = new Date(date);
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return monthNames[d.getMonth()];
};

/**
 * Gera uma lista de objetos Date representando os meses a serem exibidos.
 * Inclui o mês atual, 12 meses anteriores e 12 meses posteriores.
 * @returns {Date[]} Um array de objetos Date, cada um representando o primeiro dia de um mês.
 */
const generateMonthsToDisplay = () => {
  const today = new Date();
  const months = [];
  const numPastMonths = 12; // 12 meses anteriores ao atual
  const numFutureMonths = 12; // 12 meses posteriores ao atual

  // Adiciona os meses passados
  for (let i = numPastMonths; i > 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(date);
  }

  // Adiciona o mês atual
  months.push(new Date(today.getFullYear(), today.getMonth(), 1));

  // Adiciona os meses futuros
  for (let i = 1; i <= numFutureMonths; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push(date);
  }
  return months;
};

/**
 * Gera um conjunto de despesas iniciais para demonstração, espalhadas pelos meses.
 * @param {Date[]} monthsToDisplay - Array de objetos Date dos meses a serem considerados.
 * @returns {object[]} Um array de objetos de despesa gerados aleatoriamente.
 */
const generateInitialExpenses = (monthsToDisplay) => {
  let generatedExpenses = [];
  const expenseDescriptions = [
    'Aluguel', 'Conta de Luz', 'Internet', 'Supermercado', 'Academia',
    'Telefone', 'Transporte', 'Lazer', 'Educação', 'Saúde', 'Restaurante', 'Roupas'
  ];
  monthsToDisplay.forEach(monthDate => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const numExpenses = Math.floor(Math.random() * 5) + 3; // Gera entre 3 e 7 despesas por mês
    for (let i = 0; i < numExpenses; i++) {
      const day = Math.floor(Math.random() * 28) + 1; // Dia aleatório do mês
      const value = parseFloat((Math.random() * 480 + 20).toFixed(2)); // Valor aleatório entre 20 e 500
      const description = expenseDescriptions[Math.floor(Math.random() * expenseDescriptions.length)];
      const createdAtDate = new Date(year, month, day); // Data de criação da despesa
      generatedExpenses.push({
        id: `${year}-${month}-${i}-${Math.random()}`, // ID único
        description,
        value,
        createdAt: createdAtDate.toISOString(), // Salva como ISO string para fácil conversão
        status: 'active', // Despesas iniciais também são ativas por padrão
        paymentMethod: 'Débito', // Assume débito para despesas geradas automaticamente
        dueDate: createdAtDate.toISOString(), // Para despesas geradas, dueDate é createdAt
      });
    }
  });
  // Ordena as despesas pela data de criação
  return generatedExpenses.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};


export default function HomeScreen() {
  const insets = useSafeAreaInsets(); // Hook para obter os insets da área segura (barra de status, etc.)

  const [loadingApp, setLoadingApp] = useState(true); // Estado para controlar o carregamento dos dados
  const [allIncomes, setAllIncomes] = useState([]); // Estado para todas as receitas (ativas e inativas)
  const [allExpenses, setAllExpenses] = useState([]); // Estado para todas as despesas (ativas e inativas)
  const [hasScrolled, setHasScrolled] = useState(false); // Flag para controlar a rolagem inicial da lista de meses

  // 'useRef' para manter uma referência estável dos meses a exibir, evitando recriações desnecessárias.
  const monthsToDisplay = useRef(generateMonthsToDisplay()).current;

  // Calcula o índice do mês atual para a rolagem inicial do FlatList
  const today = new Date();
  const initialMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const initialScrollIndex = monthsToDisplay.findIndex(monthDate =>
    monthDate.getMonth() === initialMonthDate.getMonth() &&
    monthDate.getFullYear() === initialMonthDate.getFullYear()
  );

  /**
   * Filtra as despesas relevantes para um determinado mês.
   * Agora inclui lógica para despesas 'Fixa' e 'Crédito'.
   * @param {Date} monthDate - O objeto Date representando o mês a ser filtrado.
   * @returns {object[]} Um array de despesas para o mês especificado.
   */
  const getExpensesForMonth = (monthDate) => {
    const targetMonth = monthDate.getMonth(); // Mês alvo (0-indexado)
    const targetYear = monthDate.getFullYear(); // Ano alvo
    const displayMonthStartTimestamp = new Date(targetYear, targetMonth, 1).getTime();
    
    let expensesForThisMonth = [];

    allExpenses.forEach(item => {
      // Regra comum de exclusão suave: se inativo e data de exclusão é no ou antes do mês exibido, ignora.
      if (item.status === 'inactive' && item.deletedAt) {
        const deletionDate = new Date(item.deletedAt);
        const deletionMonthStart = new Date(deletionDate.getFullYear(), deletionDate.getMonth(), 1);
        if (deletionMonthStart.getTime() <= displayMonthStartTimestamp) {
          return; // Ignora despesas inativas que foram deletadas antes ou no mês atual
        }
      }

      if (item.paymentMethod === 'Fixa') {
        // Para despesas Fixas:
        // Elas devem aparecer em todos os meses a partir da sua data de criação,
        // até (e incluindo) o mês em que foram marcadas como 'inactive'.
        const createdAtDate = new Date(item.createdAt);
        const createdAtMonthStart = new Date(createdAtDate.getFullYear(), createdAtDate.getMonth(), 1).getTime();

        if (createdAtMonthStart <= displayMonthStartTimestamp) {
          // Usa o dueDayOfMonth salvo para construir a data de vencimento
          const fixedDueDate = new Date(targetYear, targetMonth, item.dueDayOfMonth || 1); // Garante dia 1 como fallback
          
          expensesForThisMonth.push({
            ...item,
            dueDate: fixedDueDate.toISOString(), // Salva a data de vencimento como ISO string
            id: `${item.id}-${targetYear}-${targetMonth}`, // ID único para cada projeção
            description: `${item.description} (Fixo)` 
          });
        }
      } else if (item.paymentMethod === 'Débito' || item.paymentMethod === 'Crédito') {
        // Para despesas de Débito e Crédito (parcelas):
        // Verifica se a dueDate está dentro do mês e ano alvo.
        if (item.dueDate) {
          const itemDueDate = new Date(item.dueDate);
          if (itemDueDate.getMonth() === targetMonth && itemDueDate.getFullYear() === targetYear) {
            expensesForThisMonth.push(item);
          }
        }
      }
    });

    // Ordena as despesas encontradas por data de vencimento (ou data de projeção para fixas)
    return expensesForThisMonth.sort((a, b) => {
      // Usa a data de vencimento para ordenar. Se não houver, usa a data de criação.
      const dateA = new Date(a.dueDate || a.createdAt); 
      const dateB = new Date(b.dueDate || b.createdAt);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const flatListRef = useRef(null); // Ref para o FlatList, usado para controlar a rolagem
  const [currentMonthIndex, setCurrentMonthIndex] = useState(initialScrollIndex); // Índice do mês atualmente visível

  /**
   * Carrega todos os dados (receitas e despesas) do AsyncStorage.
   * Usado com `useCallback` para otimização.
   */
  const loadData = useCallback(async () => {
    setLoadingApp(true); // Ativa o estado de carregamento
    try {
      // Carrega as receitas
      const storedIncomesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.INCOMES);
      const storedIncomes = storedIncomesJson ? JSON.parse(storedIncomesJson) : [];
      setAllIncomes(storedIncomes);
      console.log("HomeScreen: Receitas carregadas do AsyncStorage. Total:", storedIncomes.length);
      
      // Carrega ou gera as despesas iniciais
      const storedExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES); // CORRIGIDO: ASYC_STORAGE_KEYS para ASYNC_STORAGE_KEYS
      let currentExpenses;
      if (!storedExpensesJson) {
        // Se não houver despesas salvas, gera algumas iniciais para demonstração
        currentExpenses = generateInitialExpenses(monthsToDisplay);
        await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(currentExpenses));
        console.log("HomeScreen: Despesas geradas e salvas no AsyncStorage.");
      } else {
        // Caso contrário, carrega as despesas existentes
        currentExpenses = JSON.parse(storedExpensesJson);
        console.log("HomeScreen: Despesas carregadas do AsyncStorage. Total:", currentExpenses.length);
      }
      setAllExpenses(currentExpenses);
      
    } catch (error) {
      console.error("HomeScreen: Erro ao carregar dados do AsyncStorage:", error);
      Alert.alert('Erro de Carregamento', 'Não foi possível carregar os dados de finanças do armazenamento local.');
    } finally {
      setLoadingApp(false); // Desativa o estado de carregamento
    }
  }, []); // Array de dependências vazio para useCallback: a função só é criada uma vez.

  /**
   * Hook para garantir que os dados sejam recarregados sempre que a tela Home entra em foco.
   */
  useFocusEffect(
    useCallback(() => {
      loadData(); // Chama a função para carregar os dados
      return () => {
        // Lógica de limpeza, se necessário, ao sair do foco da tela.
      };
    }, [loadData]) // Garante que o efeito seja reexecutado se 'loadData' mudar (o que não deve acontecer com [] dependências)
  );

  /**
   * Efeito para rolar o FlatList para o mês atual na montagem inicial.
   * É executado apenas uma vez após o carregamento dos dados.
   */
  useEffect(() => {
    // Verifica se a referência do FlatList está disponível, se o índice inicial é válido,
    // se o app já carregou e se ainda não rolamos.
    if (flatListRef.current && initialScrollIndex !== -1 && !loadingApp && !hasScrolled) {
      console.log("HomeScreen: Tentando rolar para o initialScrollIndex:", initialScrollIndex);
      // Pequeno delay para garantir que o FlatList esteja completamente renderizado
      setTimeout(() => {
        if (flatListRef.current && !hasScrolled) {
          flatListRef.current.scrollToIndex({ index: initialScrollIndex, animated: false });
          setHasScrolled(true); // Marca como já rolou para evitar rolagens futuras desnecessárias
          console.log("HomeScreen: Rolagem para initialScrollIndex concluída.");
        } else {
          console.log("HomeScreen: Rolagem já tentada ou FlatList ref nulo.");
        }
      }, 200); // 200ms de atraso
    } else if (flatListRef.current === null) {
        console.log("HomeScreen: Não rolou para o initialScrollIndex. flatListRef.current é null.");
    } else {
        console.log("HomeScreen: Não rolou para o initialScrollIndex. Condições: initialScrollIndex: ", initialScrollIndex, "loadingApp: ", loadingApp, "hasScrolled: ", hasScrolled);
    }
  }, [initialScrollIndex, loadingApp, hasScrolled]); // Dependências do efeito

  /**
   * Calcula a receita total para um mês específico, aplicando a lógica de exclusão suave.
   * @param {Date} monthDate - O objeto Date representando o mês para o qual calcular a receita.
   * @returns {number} O valor total da receita para o mês.
   */
  const calculateTotalIncomeForMonth = (monthDate) => {
    const targetMonth = monthDate.getMonth(); // Mês 0-indexado do mês exibido
    const targetYear = monthDate.getFullYear(); // Ano do mês exibido
    let totalIncome = 0;

    // Converte o mês exibido para um objeto Date no primeiro dia do mês para comparações de timestamp
    const displayMonthStart = new Date(targetYear, targetMonth, 1);
    
    allIncomes.forEach(income => {
      const incomeCreationDate = new Date(income.createdAt);
      const creationMonthStart = new Date(incomeCreationDate.getFullYear(), incomeCreationDate.getMonth(), 1);

      // --- Regra para Receitas Fixas ---
      if (income.type === 'Fixo') {
        // 1. Receita fixa só deve ser considerada se sua data de criação for no ou antes do mês exibido.
        const isCreatedBeforeOrInDisplayMonth = creationMonthStart.getTime() <= displayMonthStart.getTime();
        
        let isActiveInDisplayMonth = true;
        // 2. Verifica o status e a data de exclusão suave
        if (income.status === 'inactive' && income.deletedAt) {
          const deletionDate = new Date(income.deletedAt);
          const deletionMonthStart = new Date(deletionDate.getFullYear(), deletionDate.getMonth(), 1);
          
          // Se a receita foi inativada ANTES ou NO MÊS exibido, ela NÃO é mais ativa para este mês.
          if (deletionMonthStart.getTime() <= displayMonthStart.getTime()) {
            isActiveInDisplayMonth = false;
          }
        }

        // Se a receita fixa foi criada a tempo e ainda está ativa para este mês
        if (isCreatedBeforeOrInDisplayMonth && isActiveInDisplayMonth) {
          totalIncome += income.value;
        }
      } 
      // --- Regra para Receitas de Ganho Pontual ---
      else if (income.type === 'Ganho' && income.month === targetMonth && income.year === targetYear) {
        // Receita de ganho é pontual para um mês/ano específico, mas também respeita a exclusão suave.
        let isActiveInDisplayMonth = true;
        if (income.status === 'inactive' && income.deletedAt) {
          const deletionDate = new Date(income.deletedAt);
          const deletionMonthStart = new Date(deletionDate.getFullYear(), deletionDate.getMonth(), 1);

          // Para ganhos, se a data de exclusão é no mesmo mês do ganho (ou antes), ela não conta.
          if (deletionMonthStart.getTime() <= displayMonthStart.getTime()) {
              isActiveInDisplayMonth = false;
          }
        }
        if (isActiveInDisplayMonth) {
          totalIncome += income.value;
        }
      }
    });
    return totalIncome;
  };

  // Calcula a receita total do mês atualmente visível
  const currentMonthTotalIncome = calculateTotalIncomeForMonth(monthsToDisplay[currentMonthIndex]);

  // Obtém e calcula o total das despesas do mês atualmente visível
  const currentDisplayedMonthExpenses = getExpensesForMonth(monthsToDisplay[currentMonthIndex]);
  const totalDespesasDisplayedMonth = currentDisplayedMonthExpenses.reduce((sum, item) => sum + item.value, 0);

  // Calcula o valor final (Receita - Despesa) para o mês visível
  const valorFinalDisplayedMonth = currentMonthTotalIncome - totalDespesasDisplayedMonth;

  /**
   * Renderiza a seção de cada mês no FlatList.
   * @param {object} param0 - Contém o item (objeto Date do mês) e o índice.
   */
  const renderMonthSection = ({ item: monthDate, index }) => {
    const expenses = getExpensesForMonth(monthDate);
    const monthName = getMonthName(monthDate);
    const year = monthDate.getFullYear();

    // Verifica se este é o mês atual do sistema para aplicar o destaque visual
    const isSystemCurrentMonth = monthDate.getMonth() === initialMonthDate.getMonth() &&
                                 monthDate.getFullYear() === initialMonthDate.getFullYear();

    return (
      <View style={styles.monthPage}>
        <View style={[
          styles.section,
          isSystemCurrentMonth && styles.currentMonthHighlight // Aplica destaque se for o mês atual
        ]}>
          {/* Título do mês, que deve permanecer fixo */}
          <Text style={styles.sectionTitle}>{`${String(monthName)} ${String(year)}`}</Text>

          {/* Cabeçalho da Tabela */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.descriptionColumn]}>Despesa</Text>
            <Text style={[styles.headerText, styles.dateColumn]}>Data de Vencimento</Text>
            <Text style={[styles.headerText, styles.valueColumn]}>Valor</Text>
          </View>

          {/* Adicionado ScrollView para permitir rolagem vertical da lista de despesas */}
          {expenses.length > 0 ? (
            <ScrollView style={styles.expensesScrollView}>
              {expenses.map((item) => (
                // Use o ID da despesa + data do mês para a chave, para evitar conflitos com despesas fixas
                // que aparecem em vários meses. Se a despesa é fixa, use o ID gerado na getExpensesForMonth
                <View key={String(item.id)} style={styles.debitItemRow}>
                  <Text style={[styles.debitText, styles.descriptionColumn]}>{String(item.description)}</Text>
                  {/* Usa item.dueDate, que agora será um ISO string válido para despesas fixas também */}
                  <Text style={[styles.debitText, styles.dateColumn]}>{String(formatDateForDisplay(new Date(item.dueDate)))}</Text> 
                  <Text style={[styles.debitValue, styles.valueColumn]}>
                    {`${String(item.value.toFixed(2)).replace('.', ',')} R$`}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            // Mensagem se não houver despesas para o mês
            <Text style={styles.noExpensesText}>Nenhuma despesa para este mês.</Text>
          )}
        </View>
      </View>
    );
  };

  /**
   * Lida com o evento de término da rolagem do FlatList.
   * Atualiza o índice do mês atualmente visível.
   * @param {object} event - O evento de rolagem.
   */
  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / width); // Calcula o novo índice com base na rolagem
    if (newIndex !== currentMonthIndex) {
      setCurrentMonthIndex(newIndex); // Atualiza o índice do mês
    }
  };

  /**
   * Limpa todos os dados de receitas, despesas e cartões do AsyncStorage.
   * Usado para testes.
   */
  const clearAllData = async () => {
    Alert.alert(
      "Confirmar Limpeza",
      "Tem certeza que deseja apagar TODOS os seus dados (receitas, despesas, cartões)? Esta ação é irreversível.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar Tudo",
          onPress: async () => {
            try {
              await AsyncStorage.clear(); // Limpa todo o AsyncStorage
              await loadData(); // Recarrega os dados (irá gerar dados iniciais se não houver)
              Alert.alert("Sucesso", "Todos os dados foram apagados e recarregados.");
              console.log("AsyncStorage limpo e dados recarregados.");
            } catch (error) {
              console.error("Erro ao limpar AsyncStorage:", error);
              Alert.alert("Erro", `Não foi possível limpar os dados: ${error.message}`);
            }
          },
          style: "destructive", // Estilo para indicar uma ação destrutiva
        },
      ]
    );
  };


  // Exibe um indicador de carregamento enquanto o aplicativo está inicializando
  if (loadingApp) {
    return (
      <View style={commonStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Carregando dados de finanças locais...</Text>
      </View>
    );
  }

  return (
    // Container principal da tela, aplicando o padding superior para respeitar a barra de status
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Botão de Limpar Dados no topo da tela */}
      <TouchableOpacity onPress={clearAllData} style={styles.clearDataButton}>
        <Text style={styles.clearDataButtonText}>Limpar Todos os Dados</Text>
      </TouchableOpacity>

      {/* FlatList para rolar entre os meses horizontalmente */}
      <FlatList
        ref={flatListRef}
        data={monthsToDisplay} // Dados: array de meses
        renderItem={renderMonthSection} // Componente para renderizar cada mês
        keyExtractor={item => String(item.toISOString())} // Chave única para cada item (ISO string da data do mês)
        horizontal // Habilita rolagem horizontal
        pagingEnabled // Faz a rolagem "parar" em cada página (mês)
        showsHorizontalScrollIndicator={false} // Esconde a barra de rolagem horizontal
        onMomentumScrollEnd={handleScroll} // Chama a função ao final da rolagem
        initialScrollIndex={initialScrollIndex} // Rola para o mês atual na inicialização
        extraData={currentMonthIndex} // Garante re-renderização quando o mês atual muda
        getItemLayout={(data, index) => ({ // Otimização para listas longas
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* Container de resumo financeiro na parte inferior da tela */}
      <View style={styles.summaryContainer}>
        {/* Linha para Receita Total */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Receita total:</Text>
          <Text style={styles.summaryValue}>
            {`${String(currentMonthTotalIncome.toFixed(2)).replace('.', ',')} R$`}
          </Text>
        </View>
        {/* Linha para Valor Final (Receita - Despesa) */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Valor final:</Text>
          <Text style={[styles.summaryValue, valorFinalDisplayedMonth < 0 ? styles.negativeValue : styles.positiveValue]}>
            {String(valorFinalDisplayedMonth.toFixed(2)).replace('.', ',') + ' R$'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Herda o estilo base do container dos commonStyles e adiciona estilos específicos.
  container: {
    ...commonStyles.container,
  },
  clearDataButton: {
    backgroundColor: '#dc3545', // Vermelho para indicar perigo
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignSelf: 'center', // Centraliza o botão
    marginTop: 10,
    marginBottom: 15, // Espaçamento antes do FlatList
  },
  clearDataButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthPage: {
    width: width, // Cada página ocupa a largura total da tela
    paddingHorizontal: 15,
    paddingTop: 15, // Padding interno da página do mês
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    // Remover minHeight: 250 se a seção se ajustar ao conteúdo dinamicamente
    // e flex: 1 para que o ScrollView interno possa ter uma altura definida
    flex: 1, 
  },
  currentMonthHighlight: {
    backgroundColor: 'lightblue',
    borderColor: '#007bff',
    borderWidth: 4,
    shadowColor: '#007bff',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#ccc',
    marginBottom: 5,
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  expensesScrollView: { // Novo estilo para o ScrollView das despesas
    flex: 1, // Ocupa o restante do espaço na seção
  },
  debitItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  debitText: {
    fontSize: 16,
    color: '#555',
  },
  debitValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  descriptionColumn: {
    flex: 2,
    textAlign: 'left',
  },
  dateColumn: {
    flex: 2,
    textAlign: 'center',
  },
  valueColumn: {
    flex: 1.5,
    textAlign: 'right',
  },
  noExpensesText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#888',
  },
  summaryContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  negativeValue: {
    color: 'red',
  },
  positiveValue: {
    color: '#007bff',
  },
});

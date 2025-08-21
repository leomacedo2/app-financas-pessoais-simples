// screens/HomeScreen.js

/**
 * @file HomeScreen.js
 * @description Esta tela é a principal do aplicativo, exibindo um resumo financeiro
 * e uma lista horizontal rolável de despesas por mês.
 *
 * Funcionalidades principais:
 * - Exibição paginada de despesas para meses passados e futuros.
 * - Cálculo e exibição da receita total e valor final para o mês visível.
 * - Geração de despesas aleatórias para teste via botão dedicado.
 * - Ocultação de meses sem despesas (exceto o mês atual do sistema).
 * - Sincronização de dados de receitas e despesas com AsyncStorage.
 *
 * Correção de Bug: Resolvido o TypeError "Cannot read property 'forEach' of undefined"
 * na função `generateRandomExpensesData` ao garantir que a lista de meses seja
 * passada corretamente (`monthsToDisplay.current`).
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, ActivityIndicator, Alert, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native'; // Hook para executar efeitos quando a tela está em foco
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Para lidar com a área segura do dispositivo

// Importa os estilos comuns para reutilização em todo o aplicativo
import commonStyles from '../utils/commonStyles';
// Importa as chaves de AsyncStorage como constantes, para evitar "magic strings"
import { ASYNC_STORAGE_KEYS } from '../utils/constants';

// Obtém a largura da tela do dispositivo para configurar a rolagem paginada do FlatList
const { width } = Dimensions.get('window');

/**
 * Converte uma string de data no formato "DD/MM/AAAA" para um objeto Date.
 * Essencial para manipular e comparar datas corretamente.
 * @param {string} dateString - A string de data a ser parseada (ex: "20/08/2025").
 * @returns {Date} Um objeto Date representando a data.
 */
const parseDateString = (dateString) => {
  const [day, month, year] = dateString.split('/').map(Number);
  // O mês em JavaScript é 0-indexado (Janeiro é 0, Dezembro é 11).
  return new Date(year, month - 1, day);
};

/**
 * Formata um objeto Date para exibição no formato "DD/MM/AAAA".
 * Útil para apresentar datas de forma legível na interface.
 * @param {Date} date - O objeto Date a ser formatado.
 * @returns {string} A data formatada como string.
 */
const formatDateForDisplay = (date) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0'); // Mês + 1 para exibir corretamente
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Retorna o nome do mês (em português) de um objeto Date.
 * @param {Date} date - O objeto Date.
 * @returns {string} O nome do mês (ex: "Janeiro").
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
 * Gera uma lista de objetos Date representando os meses a serem considerados na aplicação.
 * Inclui o mês atual, um número configurável de meses anteriores e posteriores.
 * Esta lista é a base para a FlatList e a geração de despesas aleatórias.
 * @returns {Date[]} Um array de objetos Date, cada um representando o primeiro dia de um mês.
 */
const generateMonthsToDisplay = () => {
  const today = new Date();
  const months = [];
  const numPastMonths = 12; // Número de meses anteriores ao atual a serem incluídos
  const numFutureMonths = 12; // Número de meses posteriores ao atual a serem incluídos

  // Adiciona os meses passados ao array
  for (let i = numPastMonths; i > 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(date);
  }

  // Adiciona o mês atual
  months.push(new Date(today.getFullYear(), today.getMonth(), 1));

  // Adiciona os meses futuros ao array
  for (let i = 1; i <= numFutureMonths; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push(date);
  }
  return months;
};

/**
 * Gera um conjunto de despesas aleatórias para fins de demonstração/teste.
 * Esta função é agora chamada manualmente por um botão na tela.
 * @param {Date[]} monthsToConsider - Array de objetos Date dos meses para os quais gerar despesas.
 * @returns {object[]} Um array de objetos de despesa gerados aleatoriamente.
 */
const generateRandomExpensesData = (monthsToConsider) => {
  let generatedExpenses = [];
  const expenseDescriptions = [
    'Aluguel', 'Conta de Luz', 'Internet', 'Supermercado', 'Academia',
    'Telefone', 'Transporte', 'Lazer', 'Educação', 'Saúde', 'Restaurante', 'Roupas'
  ];

  // Verifica se monthsToConsider é um array válido antes de usar forEach
  if (!Array.isArray(monthsToConsider)) {
    console.error("generateRandomExpensesData: monthsToConsider não é um array válido.");
    return []; // Retorna um array vazio para evitar o erro
  }

  monthsToConsider.forEach(monthDate => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const numExpenses = Math.floor(Math.random() * 5) + 3; // Gera entre 3 e 7 despesas por mês

    for (let i = 0; i < numExpenses; i++) {
      const day = Math.floor(Math.random() * 28) + 1; // Dia aleatório do mês (até 28 para evitar problemas de meses curtos)
      const value = parseFloat((Math.random() * 480 + 20).toFixed(2)); // Valor aleatório entre 20 e 500 (com 2 casas decimais)
      const description = expenseDescriptions[Math.floor(Math.random() * expenseDescriptions.length)];
      const createdAtDate = new Date(year, month, day); // Data de criação da despesa gerada

      generatedExpenses.push({
        id: `${year}-${month}-${i}-${Math.random()}`, // ID único para a despesa
        description,
        value,
        createdAt: createdAtDate.toISOString(), // Salva a data de criação como string ISO para fácil armazenamento
        status: 'active', // Define o status como 'active' por padrão
        paymentMethod: 'Débito', // Assume 'Débito' para as despesas geradas automaticamente
        dueDate: createdAtDate.toISOString(), // Para despesas geradas, a data de vencimento é a de criação
      });
    }
  });
  // Ordena as despesas geradas pela data de criação em ordem crescente
  return generatedExpenses.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};


export default function HomeScreen() {
  const insets = useSafeAreaInsets(); // Hook para obter os insets da área segura (barra de status, notch)

  // Estados locais para controlar o carregamento, receitas e despesas
  const [loadingApp, setLoadingApp] = useState(true); // Indica se os dados iniciais estão sendo carregados
  const [allIncomes, setAllIncomes] = useState([]); // Armazena todas as receitas (ativas e inativas)
  const [allExpenses, setAllExpenses] = useState([]); // Armazena todas as despesas (ativas e inativas)
  const [hasScrolled, setHasScrolled] = useState(false); // Flag para garantir que a rolagem inicial ocorra apenas uma vez

  // Usa useRef para armazenar a lista COMPLETA de meses.
  // Isso evita que a lista seja recriada em cada re-renderização,
  // mas o 'current' sempre aponta para o mesmo array estável.
  // A inicialização foi corrigida para armazenar o array diretamente no .current
  const monthsToDisplay = useRef(generateMonthsToDisplay());

  // Calcula a data do primeiro dia do mês atual do sistema.
  // Usado para identificar o mês atual na FlatList e na lógica de filtragem.
  const today = new Date();
  const initialMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);

  // Estado para o índice do mês atualmente visível na FlatList FILTRADA.
  // Inicializa em 0 e será ajustado após a filtragem e rolagem inicial.
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const flatListRef = useRef(null); // Ref para controlar o FlatList (rolagem programática)

  /**
   * Filtra as despesas do array 'allExpenses' que são relevantes para um mês específico.
   * Inclui lógica para despesas 'Fixa', 'Débito' e 'Crédito', e respeita a exclusão suave.
   * Usa useCallback para memorizar a função e evitar recriações desnecessárias,
   * melhorando o desempenho, especialmente em listas grandes.
   * @param {Date} monthDate - O objeto Date representando o primeiro dia do mês a ser filtrado.
   * @returns {object[]} Um array de objetos de despesa que pertencem ao mês especificado.
   */
  const getExpensesForMonth = useCallback((monthDate) => {
    const targetMonth = monthDate.getMonth(); // Mês alvo (0-indexado)
    const targetYear = monthDate.getFullYear(); // Ano alvo
    // Timestamp do início do mês alvo, usado para comparação eficiente de datas.
    const displayMonthStartTimestamp = new Date(targetYear, targetMonth, 1).getTime();
    
    let expensesForThisMonth = [];

    // Itera sobre todas as despesas carregadas
    allExpenses.forEach(item => {
      // Regra de exclusão suave: se a despesa está inativa E tem uma data de exclusão
      // E essa data de exclusão é anterior ou no mesmo mês que o mês atual da exibição,
      // então esta despesa não deve ser mostrada.
      if (item.status === 'inactive' && item.deletedAt) {
        const deletionDate = new Date(item.deletedAt);
        const deletionMonthStart = new Date(deletionDate.getFullYear(), deletionDate.getMonth(), 1);
        if (deletionMonthStart.getTime() <= displayMonthStartTimestamp) {
          return; // Pula para a próxima despesa
        }
      }

      // Lógica para despesas do tipo 'Fixa'
      if (item.paymentMethod === 'Fixa') {
        const createdAtDate = new Date(item.createdAt);
        const createdAtMonthStart = new Date(createdAtDate.getFullYear(), createdAtDate.getMonth(), 1).getTime();

        // Despesas fixas só aparecem a partir do mês em que foram criadas.
        if (createdAtMonthStart <= displayMonthStartTimestamp) {
          let dayForFixedExpense = item.dueDayOfMonth || 1; // Pega o dia de vencimento salvo, ou 1 como padrão
          // Calcula o último dia do mês alvo para evitar datas inválidas (ex: 31 de fevereiro)
          const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

          // Se o dia salvo for maior que o último dia do mês, ajusta para o último dia válido.
          if (dayForFixedExpense > lastDayOfTargetMonth) {
            dayForFixedExpense = lastDayOfTargetMonth;
          }

          // Cria a data de vencimento ajustada para a despesa fixa neste mês.
          const fixedDueDate = new Date(targetYear, targetMonth, dayForFixedExpense);
          
          // Adiciona a despesa fixa ao array, com um ID único para esta projeção mensal
          // e uma descrição que indica que é uma despesa fixa.
          expensesForThisMonth.push({
            ...item,
            dueDate: fixedDueDate.toISOString(), // Salva a data de vencimento como ISO string
            id: `${item.id}-${targetYear}-${targetMonth}`, // ID único para cada projeção mensal
            description: `${item.description} (Fixo)` 
          });
        }
      }
      // Lógica para despesas do tipo 'Débito' ou 'Crédito' (parcelas)
      else if (item.paymentMethod === 'Débito' || item.paymentMethod === 'Crédito') {
        // Verifica se a despesa tem uma data de vencimento (dueDate) e se ela pertence ao mês alvo.
        if (item.dueDate) {
          const itemDueDate = new Date(item.dueDate);
          if (itemDueDate.getMonth() === targetMonth && itemDueDate.getFullYear() === targetYear) {
            expensesForThisMonth.push(item);
          }
        }
      }
    });

    // Ordena as despesas encontradas para o mês por data de vencimento (ou data de criação se dueDate não existir)
    return expensesForThisMonth.sort((a, b) => {
      const dateA = new Date(a.dueDate || a.createdAt); 
      const dateB = new Date(b.dueDate || b.createdAt);
      return dateA.getTime() - dateB.getTime();
    });
  }, [allExpenses]); // Esta função será recriada apenas se 'allExpenses' mudar.


  /**
   * Filtra a lista completa de meses (`monthsToDisplay.current`) para exibir apenas os meses
   * que contêm despesas OU o mês atual do sistema.
   * Usa useMemo para otimizar: a lista filtrada só será recalculada se suas dependências mudarem.
   * Isso é crucial para o desempenho, evitando re-renderizações desnecessárias do FlatList.
   */
  const filteredMonthsToDisplay = useMemo(() => {
    return monthsToDisplay.current.filter(monthDate => { // Acessando .current aqui
      // Verifica se o mês atual da iteração é o mês atual do sistema
      const isCurrentMonth = monthDate.getMonth() === initialMonthDate.getMonth() &&
                             monthDate.getFullYear() === initialMonthDate.getFullYear();
      // Verifica se o mês atual da iteração tem alguma despesa registrada
      const hasExpenses = getExpensesForMonth(monthDate).length > 0;
      // Um mês será exibido se for o mês atual OU se tiver despesas.
      return isCurrentMonth || hasExpenses;
    });
  }, [monthsToDisplay, initialMonthDate, getExpensesForMonth]); // Depende dessas variáveis


  /**
   * Recalcula o índice para rolagem inicial, mas agora com base na lista FILTRADA de meses.
   * Isso garante que a FlatList role para a posição correta, mesmo que meses anteriores
   * sem despesas tenham sido ocultados.
   */
  const initialScrollIndexFiltered = useMemo(() => {
    return filteredMonthsToDisplay.findIndex(monthDate =>
      monthDate.getMonth() === initialMonthDate.getMonth() &&
      monthDate.getFullYear() === initialMonthDate.getFullYear()
    );
  }, [filteredMonthsToDisplay, initialMonthDate]);


  /**
   * Carrega todos os dados (receitas e despesas) do AsyncStorage.
   * Esta função NÃO gera despesas aleatórias por padrão no carregamento inicial.
   * Usa useCallback para memorização.
   */
  const loadData = useCallback(async () => {
    setLoadingApp(true); // Ativa o estado de carregamento
    try {
      // Carrega as receitas do AsyncStorage
      const storedIncomesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.INCOMES);
      const storedIncomes = storedIncomesJson ? JSON.parse(storedIncomesJson) : [];
      setAllIncomes(storedIncomes);
      console.log("HomeScreen: Receitas carregadas do AsyncStorage. Total:", storedIncomes.length);
      
      // Carrega as despesas do AsyncStorage
      const storedExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      let currentExpenses;
      if (!storedExpensesJson) {
        // Se não houver despesas salvas, começa com um array vazio.
        // A geração de despesas aleatórias agora é feita via botão.
        currentExpenses = [];
        console.log("HomeScreen: Nenhuma despesa encontrada, iniciando com lista vazia.");
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
      setLoadingApp(false); // Desativa o estado de carregamento, mesmo em caso de erro
    }
  }, []); // Array de dependências vazio para useCallback: a função só é criada uma vez.

  /**
   * Função para gerar despesas aleatórias e salvá-las no AsyncStorage.
   * Esta função é vinculada ao novo botão "Gerar Despesas Aleatórias".
   * Após a geração, os dados são recarregados para atualizar a interface.
   * Usa useCallback para memorização.
   */
  const handleGenerateRandomExpenses = useCallback(async () => {
    setLoadingApp(true); // Ativa o indicador de carregamento enquanto gera
    try {
      // CORREÇÃO: Passando monthsToDisplay.current para a função de geração de dados
      const generated = generateRandomExpensesData(monthsToDisplay.current); 
      // Salva as despesas geradas no AsyncStorage
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(generated));
      Alert.alert('Sucesso', `${generated.length} despesas aleatórias geradas e salvas!`);
      await loadData(); // Recarrega os dados para que a interface reflita as novas despesas
    } catch (error) {
      console.error("HomeScreen: Erro ao gerar despesas aleatórias:", error);
      Alert.alert('Erro', `Não foi possível gerar despesas aleatórias: ${error.message}`);
    } finally {
      setLoadingApp(false); // Desativa o indicador de carregamento
    }
  }, [loadData, monthsToDisplay]); // Depende de 'loadData' e 'monthsToDisplay' (ref. current)

  /**
   * Hook `useFocusEffect` do React Navigation.
   * Garante que os dados sejam recarregados sempre que a tela Home entra em foco.
   * Isso resolve problemas de sincronização quando o usuário navega de volta para esta tela.
   */
  useFocusEffect(
    useCallback(() => {
      loadData(); // Chama a função para carregar os dados
      return () => {
        // Lógica de limpeza, se necessário, ao sair do foco da tela (ex: limpar listeners).
      };
    }, [loadData]) // Garante que o efeito seja reexecutado se 'loadData' mudar.
  );

  /**
   * Efeito para rolar o FlatList para o mês atual (na lista FILTRADA) na montagem inicial.
   * É executado apenas uma vez após o carregamento dos dados e quando as condições são atendidas.
   */
  useEffect(() => {
    // Verifica se a referência do FlatList está disponível, se o índice inicial é válido,
    // se o app já carregou (loadingApp é false) e se ainda não rolamos (hasScrolled é false).
    if (flatListRef.current && initialScrollIndexFiltered !== -1 && !loadingApp && !hasScrolled) {
      console.log("HomeScreen: Tentando rolar para o initialScrollIndexFiltered:", initialScrollIndexFiltered);
      // Pequeno delay para garantir que o FlatList esteja completamente renderizado
      setTimeout(() => {
        if (flatListRef.current && !hasScrolled) {
          flatListRef.current.scrollToIndex({ index: initialScrollIndexFiltered, animated: false });
          setHasScrolled(true); // Marca como já rolou para evitar rolagens futuras desnecessárias
          console.log("HomeScreen: Rolagem para initialScrollIndexFiltered concluída.");
        } else {
          console.log("HomeScreen: Rolagem já tentada ou FlatList ref nulo.");
        }
      }, 200); // 200ms de atraso para dar tempo de renderizar
    } else if (flatListRef.current === null) {
        console.log("HomeScreen: Não rolou para o initialScrollIndexFiltered. flatListRef.current é null.");
    } else {
        console.log("HomeScreen: Não rolou para o initialScrollIndexFiltered. Condições: initialScrollIndexFiltered: ", initialScrollIndexFiltered, "loadingApp: ", loadingApp, "hasScrolled: ", hasScrolled);
    }
  }, [initialScrollIndexFiltered, loadingApp, hasScrolled]); // Dependências do efeito

  /**
   * Calcula a receita total para um mês específico, considerando receitas fixas e ganhos pontuais,
   * e aplicando a lógica de exclusão suave.
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

        // Se a receita fixa foi criada a tempo e ainda está ativa para este mês, adiciona seu valor.
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

  // Calcula a receita total do mês atualmente visível na FlatList filtrada.
  // Usa `initialMonthDate` como fallback seguro caso `filteredMonthsToDisplay[currentMonthIndex]` seja indefinido (lista vazia).
  const currentMonthTotalIncome = calculateTotalIncomeForMonth(filteredMonthsToDisplay[currentMonthIndex] || initialMonthDate);

  // Obtém e calcula o total das despesas do mês atualmente visível na FlatList filtrada.
  const currentDisplayedMonthExpenses = getExpensesForMonth(filteredMonthsToDisplay[currentMonthIndex] || initialMonthDate);
  const totalDespesasDisplayedMonth = currentDisplayedMonthExpenses.reduce((sum, item) => sum + item.value, 0);

  // Calcula o valor final (Receita - Despesa) para o mês atualmente visível.
  const valorFinalDisplayedMonth = currentMonthTotalIncome - totalDespesasDisplayedMonth;

  /**
   * Componente de renderização para cada seção de mês na FlatList.
   * @param {object} param0 - Contém o `item` (objeto Date do mês) e o `index`.
   */
  const renderMonthSection = ({ item: monthDate, index }) => {
    const expenses = getExpensesForMonth(monthDate); // Obtém as despesas para este mês
    const monthName = getMonthName(monthDate); // Nome do mês
    const year = monthDate.getFullYear(); // Ano

    // Verifica se este é o mês atual do sistema para aplicar um destaque visual.
    const isSystemCurrentMonth = monthDate.getMonth() === initialMonthDate.getMonth() &&
                                 monthDate.getFullYear() === initialMonthDate.getFullYear();

    return (
      <View style={styles.monthPage}>
        <View style={[
          styles.section,
          isSystemCurrentMonth && styles.currentMonthHighlight // Aplica estilo de destaque condicional
        ]}>
          {/* Título da seção, exibindo o nome do mês e o ano */}
          <Text style={styles.sectionTitle}>{`${String(monthName)} ${String(year)}`}</Text>

          {/* Cabeçalho da Tabela de Despesas */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.descriptionColumn]}>Despesa</Text>
            <Text style={[styles.headerText, styles.dateColumn]}>Data de Vencimento</Text>
            <Text style={[styles.headerText, styles.valueColumn]}>Valor</Text>
          </View>

          {/* ScrollView para permitir rolagem vertical da lista de despesas dentro de cada mês */}
          {expenses.length > 0 ? (
            <ScrollView style={styles.expensesScrollView}>
              {expenses.map((item) => (
                // Cada item de despesa na lista. Usa o ID da despesa como key.
                // Para despesas fixas que aparecem em vários meses, o ID é concatenado com ano/mês
                // para garantir unicidade visual dentro da FlatList.
                <View key={String(item.id)} style={styles.debitItemRow}>
                  <Text style={[styles.debitText, styles.descriptionColumn]}>{String(item.description)}</Text>
                  {/* Exibe a data de vencimento formatada */}
                  <Text style={[styles.debitText, styles.dateColumn]}>{String(formatDateForDisplay(new Date(item.dueDate)))}</Text> 
                  {/* Exibe o valor da despesa formatado para moeda brasileira */}
                  <Text style={[styles.debitValue, styles.valueColumn]}>
                    {`${String(item.value.toFixed(2)).replace('.', ',')} R$`}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            // Mensagem exibida se não houver despesas para o mês atual
            <Text style={styles.noExpensesText}>Nenhuma despesa para este mês.</Text>
          )}
        </View>
      </View>
    );
  };

  /**
   * Lida com o evento de término da rolagem do FlatList horizontal.
   * Atualiza o `currentMonthIndex` para refletir o mês que está agora visível.
   * @param {object} event - O objeto de evento de rolagem nativo.
   */
  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    // Calcula o novo índice do mês arredondando a posição da rolagem pela largura da tela.
    const newIndex = Math.round(contentOffsetX / width);
    // Se o índice mudou, atualiza o estado.
    if (newIndex !== currentMonthIndex) {
      setCurrentMonthIndex(newIndex);
    }
  };

  /**
   * Limpa todos os dados de receitas, despesas e cartões do AsyncStorage.
   * Usado para fins de teste e reset do aplicativo.
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
              await loadData(); // Recarrega os dados (irá começar com listas vazias novamente)
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
  // (carregando dados do AsyncStorage ou gerando os iniciais).
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
      {/* Container para os botões de ação no topo da tela */}
      <View style={styles.topButtonsContainer}>
        {/* Botão "Limpar Todos os Dados" */}
        <TouchableOpacity onPress={clearAllData} style={styles.clearDataButton}>
          <Text style={styles.clearDataButtonText}>Limpar Todos os Dados</Text>
        </TouchableOpacity>
        {/* Novo Botão "Gerar Despesas Aleatórias" */}
        <TouchableOpacity onPress={handleGenerateRandomExpenses} style={styles.generateRandomButton}>
          <Text style={styles.generateRandomButtonText}>Gerar Despesas Aleatórias</Text>
        </TouchableOpacity>
      </View>

      {/* FlatList para rolar entre os meses horizontalmente */}
      <FlatList
        ref={flatListRef}
        data={filteredMonthsToDisplay} // Agora usa a lista FILTRADA de meses para exibir
        renderItem={renderMonthSection} // Renderiza a seção de cada mês
        keyExtractor={item => String(item.toISOString())} // Chave única para cada item (ISO string da data do mês)
        horizontal // Habilita rolagem horizontal
        pagingEnabled // Faz a rolagem "parar" em cada página (mês)
        showsHorizontalScrollIndicator={false} // Esconde a barra de rolagem horizontal
        onMomentumScrollEnd={handleScroll} // Chama a função ao final da rolagem
        initialScrollIndex={initialScrollIndexFiltered} // Rola para o mês atual na lista FILTRADA
        extraData={currentMonthIndex} // Garante re-renderização quando o mês atual muda (para o resumo)
        // Otimização para listas longas: informa à FlatList o tamanho de cada item para otimizar a renderização
        getItemLayout={(data, index) => ({
          length: width, // Cada item tem a largura total da tela
          offset: width * index, // O deslocamento é a largura vezes o índice
          index,
        })}
      />

      {/* Container de resumo financeiro na parte inferior da tela */}
      <View style={styles.summaryContainer}>
        {/* Linha para Receita Total do mês visível */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Receita total:</Text>
          <Text style={styles.summaryValue}>
            {`${String(currentMonthTotalIncome.toFixed(2)).replace('.', ',')} R$`}
          </Text>
        </View>
        {/* Linha para Valor Final (Receita - Despesa) do mês visível */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Valor final:</Text>
          {/* Aplica cor vermelha se o valor final for negativo, azul se for positivo */}
          <Text style={[styles.summaryValue, valorFinalDisplayedMonth < 0 ? styles.negativeValue : styles.positiveValue]}>
            {String(valorFinalDisplayedMonth.toFixed(2)).replace('.', ',') + ' R$'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Definição dos estilos do componente HomeScreen
const styles = StyleSheet.create({
  // Estilo base do container, herdando de commonStyles
  container: {
    ...commonStyles.container,
  },
  // Container para agrupar os botões de ação no topo da tela
  topButtonsContainer: {
    flexDirection: 'row', // Organiza os botões em linha
    justifyContent: 'space-around', // Distribui o espaço igualmente entre os botões
    paddingHorizontal: 15, // Espaçamento horizontal
    marginTop: 10, // Margem superior
    marginBottom: 15, // Margem inferior antes da lista de meses
  },
  // Estilo para o botão "Limpar Todos os Dados"
  clearDataButton: {
    backgroundColor: '#dc3545', // Cor vermelha para indicar uma ação destrutiva
    paddingVertical: 10, // Preenchimento vertical
    paddingHorizontal: 15, // Preenchimento horizontal
    borderRadius: 8, // Cantos arredondados
    flex: 1, // Ocupa espaço flexível, dividindo com o outro botão
    marginRight: 10, // Margem à direita para separar do próximo botão
    alignItems: 'center', // Centraliza o texto horizontalmente
  },
  // Estilo para o texto do botão "Limpar Todos os Dados"
  clearDataButtonText: {
    color: '#fff', // Cor do texto branca
    fontSize: 16, // Tamanho da fonte
    fontWeight: 'bold', // Negrito
  },
  // Estilo para o botão "Gerar Despesas Aleatórias"
  generateRandomButton: {
    backgroundColor: '#28a745', // Cor verde
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    flex: 1, // Ocupa espaço flexível
    alignItems: 'center',
  },
  // Estilo para o texto do botão "Gerar Despesas Aleatórias"
  generateRandomButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Estilo para cada "página" de mês na FlatList horizontal
  monthPage: {
    width: width, // Cada página ocupa a largura total da tela
    paddingHorizontal: 15, // Espaçamento horizontal interno
    paddingTop: 15, // Espaçamento superior interno
  },
  // Estilo geral para as seções de conteúdo (onde as despesas são listadas)
  section: {
    backgroundColor: '#ffffff', // Fundo branco
    borderRadius: 10, // Cantos arredondados
    padding: 15, // Preenchimento interno
    marginBottom: 15, // Margem inferior
    shadowColor: '#000', // Cor da sombra
    shadowOffset: { width: 0, height: 2 }, // Deslocamento da sombra
    shadowOpacity: 0.1, // Opacidade da sombra
    shadowRadius: 3, // Raio da sombra
    elevation: 3, // Elevação para Android (simula sombra)
    flex: 1, // Permite que ocupe o espaço disponível
  },
  // Estilo adicional para destacar o mês atual do sistema
  currentMonthHighlight: {
    backgroundColor: 'lightblue', // Fundo azul claro
    borderColor: '#007bff', // Borda azul
    borderWidth: 4, // Borda mais espessa
    shadowColor: '#007bff', // Sombra azul
    shadowOpacity: 0.8, // Sombra mais opaca
    shadowRadius: 10, // Raio maior para a sombra
    elevation: 10, // Elevação maior para Android
  },
  // Estilo para o título de cada seção de mês
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center', // Centraliza o título
  },
  // Estilo para o cabeçalho da tabela de despesas
  tableHeader: {
    flexDirection: 'row', // Itens em linha
    justifyContent: 'space-between', // Distribui o espaço entre os itens
    paddingVertical: 10, // Preenchimento vertical
    borderBottomWidth: 2, // Borda inferior mais grossa
    borderBottomColor: '#ccc', // Cor da borda
    marginBottom: 5, // Margem inferior
  },
  // Estilo para o texto do cabeçalho da tabela
  headerText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#666',
    textAlign: 'center', // Centraliza o texto do cabeçalho
  },
  // Estilo para o ScrollView que contém a lista de despesas de um mês
  expensesScrollView: {
    flex: 1, // Ocupa todo o espaço disponível verticalmente
  },
  // Estilo para cada linha de item de débito na lista
  debitItemRow: {
    flexDirection: 'row', // Itens em linha
    justifyContent: 'space-between', // Distribui o espaço
    alignItems: 'center', // Alinha verticalmente ao centro
    paddingVertical: 10, // Preenchimento vertical
    borderBottomWidth: 1, // Borda inferior fina
    borderBottomColor: '#eee', // Cor da borda
  },
  // Estilo para o texto da descrição/data do débito
  debitText: {
    fontSize: 16,
    color: '#555',
  },
  // Estilo para o valor do débito
  debitValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  // Estilo de coluna para a descrição (ocupa mais espaço)
  descriptionColumn: {
    flex: 2,
    textAlign: 'left', // Alinha texto à esquerda
  },
  // Estilo de coluna para a data (ocupa mais espaço, centralizado)
  dateColumn: {
    flex: 2,
    textAlign: 'center', // Alinha texto ao centro
  },
  // Estilo de coluna para o valor (ocupa menos espaço, alinhado à direita)
  valueColumn: {
    flex: 1.5,
    textAlign: 'right', // Alinha texto à direita
  },
  // Estilo para a mensagem exibida quando não há despesas para um mês
  noExpensesText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#888',
  },
  // Container para a seção de resumo financeiro (fixa na parte inferior)
  summaryContainer: {
    backgroundColor: '#ffffff', // Fundo branco
    borderTopLeftRadius: 10, // Cantos superiores arredondados
    borderTopRightRadius: 10,
    padding: 20, // Preenchimento interno
    shadowColor: '#000', // Sombra
    shadowOffset: { width: 0, height: -2 }, // Sombra para cima
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  // Estilo para cada linha do resumo (receita total, valor final)
  summaryRow: {
    flexDirection: 'row', // Itens em linha
    justifyContent: 'space-between', // Distribui o espaço
    marginBottom: 10, // Margem inferior entre as linhas
  },
  // Estilo para os rótulos do resumo (ex: "Receita total:")
  summaryLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  // Estilo para os valores do resumo
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Estilo específico para valores negativos no resumo (vermelho)
  negativeValue: {
    color: 'red',
  },
  // Estilo específico para valores positivos no resumo (azul)
  positiveValue: {
    color: '#007bff',
  },
});

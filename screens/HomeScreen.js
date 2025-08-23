// screens/HomeScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, ActivityIndicator, Alert, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker'; // Para o seletor de mês/ano no modal

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
 * Formata um objeto Date para o formato "MM/YYYY" (usado para `excludedMonths`).
 * @param {Date} date - O objeto Date.
 * @returns {string} A data formatada como string "MM/YYYY".
 */
const formatMonthYearForExclusion = (date) => {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${year}`;
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

  if (!Array.isArray(monthsToConsider)) {
    console.error("generateRandomExpensesData: monthsToConsider não é um array válido.");
    return [];
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

  // Estados para o modal de limpeza de dados
  const [isClearDataModalVisible, setIsClearDataModalVisible] = useState(false);
  const [selectedClearOption, setSelectedClearOption] = useState('4'); // Padrão: "Limpar TODOS os dados"

  // Estados para o novo modal de seleção de Mês/Ano para limpeza suave
  const [isMonthYearPickerVisible, setIsMonthYearYearPickerVisible] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0')); // Mês atual
  const [pickerYear, setPickerYear] = useState(String(new Date().getFullYear())); // Ano atual

  // Usa useRef para armazenar a lista COMPLETA de meses.
  const monthsToDisplay = useRef(generateMonthsToDisplay());

  // Calcula a data do primeiro dia do mês atual do sistema.
  const today = new Date();
  const initialMonthDate = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), []);

  // Estado para o índice do mês atualmente visível na FlatList FILTRADA.
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const flatListRef = useRef(null); // Ref para controlar o FlatList (rolagem programática)

  // Flag para controlar se a rolagem para o mês atual já foi tentada desde o último foco/loadData
  const scrollAttempted = useRef(false);

  /**
   * Função auxiliar para obter o último dia de um determinado mês e ano.
   * @param {number} year - O ano.
   * @param {number} month - O mês (0-indexado).
   * @returns {number} O último dia do mês.
   */
  const getLastDayOfMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  /**
   * Filtra as despesas do array 'expensesData' que são relevantes para um mês específico.
   * Inclui lógica para despesas 'Fixa', 'Débito' e 'Crédito', e respeita a exclusão suave.
   * Também verifica se o item fixo está excluído para o mês atual.
   * Usa useCallback para memorizar a função e evitar recriações desnecessárias,
   * melhorando o desempenho, especialmente em listas grandes.
   * @param {Date} monthDate - O objeto Date representando o primeiro dia do mês a ser filtrado.
   * @param {Array} expensesData - O array de despesas a ser filtrado.
   * @param {boolean} onlyActive - Se verdadeiro, retorna apenas despesas com status 'active' ou 'pending' (não 'inactive').
   * @returns {object[]} Um array de objetos de despesa que pertencem ao mês especificado.
   */
  const getExpensesForMonth = useCallback((monthDate, expensesData, onlyActive = false) => {
    const targetMonth = monthDate.getMonth(); // Mês alvo (0-indexado)
    const targetYear = monthDate.getFullYear(); // Ano alvo
    const displayMonthStartTimestamp = new Date(targetYear, targetMonth, 1).getTime();
    const currentMonthYearString = formatMonthYearForExclusion(monthDate);
    
    let expensesForThisMonth = [];

    expensesData.forEach(item => { // Usa expensesData passado como argumento
      // Se onlyActive for true, pula itens inativos
      if (onlyActive && item.status === 'inactive') {
        return;
      }

      // Regra de exclusão suave para itens inativos já marcados como tal
      if (item.status === 'inactive' && item.deletedAt) {
        const deletionDate = new Date(item.deletedAt);
        const deletionMonthStart = new Date(deletionDate.getFullYear(), deletionDate.getMonth(), 1);
        if (deletionMonthStart.getTime() <= displayMonthStartTimestamp) {
          return; // Pula para a próxima despesa se a inativação ocorreu antes ou no mês de exibição
        }
      }

      // Lógica para despesas do tipo 'Fixa'
      if (item.paymentMethod === 'Fixa') {
        if (item.excludedMonths && item.excludedMonths.includes(currentMonthYearString)) {
          return; // Pula se o mês estiver na lista de exclusão
        }

        const createdAtDate = new Date(item.createdAt);
        const createdAtMonthStart = new Date(createdAtDate.getFullYear(), createdAtDate.getMonth(), 1).getTime();

        // Despesas fixas só aparecem a partir do mês em que foram criadas.
        if (createdAtMonthStart <= displayMonthStartTimestamp) {
          let dayForFixedExpense = item.dueDayOfMonth || 1;
          const lastDayOfTargetMonth = getLastDayOfMonth(targetYear, targetMonth); // Usa getLastDayOfMonth
          
          if (dayForFixedExpense > lastDayOfTargetMonth) {
            dayForFixedExpense = lastDayOfTargetMonth; // Ajusta para o último dia do mês
          }

          const fixedDueDate = new Date(targetYear, targetMonth, dayForFixedExpense);
          
          expensesForThisMonth.push({
            ...item,
            dueDate: fixedDueDate.toISOString(), // Usa o dueDate calculado para despesas fixas
            id: `${item.id}-${targetYear}-${targetMonth}`, // ID único para a despesa fixa do mês
            description: `${item.description}` 
          });
        }
      }
      // Lógica para despesas do tipo 'Débito' ou 'Crédito' (parcelas)
      else if (item.paymentMethod === 'Débito' || item.paymentMethod === 'Crédito') {
        if (item.dueDate) {
          const itemDueDate = new Date(item.dueDate);
          if (itemDueDate.getMonth() === targetMonth && itemDueDate.getFullYear() === targetYear) {
            expensesForThisMonth.push(item);
          }
        }
      }
    });    
    return expensesForThisMonth.sort((a, b) => {
      const dateA = new Date(a.dueDate || a.createdAt); 
      const dateB = new Date(b.dueDate || b.createdAt);
      return dateA.getTime() - dateB.getTime();
    });
  }, []); // Dependências para esta função: nenhuma, pois os dados são passados como argumento.

  /**
   * Filtra as receitas do array 'incomesData' que são relevantes para um mês específico.
   * Considera receitas fixas e ganhos pontuais.
   * @param {Date} monthDate - O objeto Date representando o primeiro dia do mês a ser filtrado.
   * @param {Array} incomesData - O array de receitas a ser filtrado.
   * @param {boolean} onlyActive - Se verdadeiro, retorna apenas receitas com status 'active' (não 'inactive').
   * @returns {object[]} Um array de objetos de receita que pertencem ao mês especificado (ativas ou inativas).
   */
  const getIncomesForMonth = useCallback((monthDate, incomesData, onlyActive = false) => {
    const targetMonth = monthDate.getMonth();
    const targetYear = monthDate.getFullYear();
    const displayMonthStartTimestamp = new Date(targetYear, targetMonth, 1).getTime();
    const currentMonthYearString = formatMonthYearForExclusion(monthDate);

    let incomesForThisMonth = [];

    incomesData.forEach(item => { // Usa incomesData passado como argumento
      if (onlyActive && item.status === 'inactive') {
        return;
      }

      // Regra de exclusão suave para itens inativos já marcados como tal
      if (item.status === 'inactive' && item.deletedAt) {
        const deletionDate = new Date(item.deletedAt);
        const deletionMonthStart = new Date(deletionDate.getFullYear(), deletionDate.getMonth(), 1);
        if (deletionMonthStart.getTime() <= displayMonthStartTimestamp) {
          return; // Pula para a próxima receita se a inativação ocorreu antes ou no mês de exibição
        }
      }

      if (item.type === 'Fixo') {
        if (item.excludedMonths && item.excludedMonths.includes(currentMonthYearString)) {
          return;
        }

        const createdAtDate = new Date(item.createdAt);
        const createdAtMonthStart = new Date(createdAtDate.getFullYear(), createdAtDate.getMonth(), 1).getTime();
        if (createdAtMonthStart <= displayMonthStartTimestamp) {
          incomesForThisMonth.push(item);
        }
      } else if (item.type === 'Ganho') {
        if (item.month === targetMonth && item.year === targetYear) {
          incomesForThisMonth.push(item);
        }
      }
    });    
    return incomesForThisMonth;
  }, []); // Dependências para esta função: nenhuma, pois os dados são passados como argumento.

  /**
   * Filtra a lista completa de meses (`monthsToDisplay.current`) para exibir apenas os meses
   * que contêm despesas OU receitas ATIVAS, OU O MÊS ATUAL DO SISTEMA.
   * O mês atual do sistema sempre será incluído, mesmo que vazio.
   * Usa useMemo para otimizar.
   */
  const filteredMonthsToDisplay = useMemo(() => {
    const allGeneratedMonths = monthsToDisplay.current;
    const todayMonth = initialMonthDate.getMonth();
    const todayYear = initialMonthDate.getFullYear();

    const filtered = allGeneratedMonths.filter(monthDate => {
      const isCurrentSystemMonth = monthDate.getMonth() === todayMonth && monthDate.getFullYear() === todayYear;
      
      // Passa os estados 'allExpenses' e 'allIncomes' para as funções de filtro
      const activeExpensesForMonth = getExpensesForMonth(monthDate, allExpenses, true);
      const hasActiveExpenses = activeExpensesForMonth.length > 0;
      
      const activeIncomesForMonth = getIncomesForMonth(monthDate, allIncomes, true);
      const hasActiveIncomes = activeIncomesForMonth.length > 0;

      // O mês será exibido se for o mês atual do sistema OU se tiver alguma movimentação ativa
      return isCurrentSystemMonth || hasActiveExpenses || hasActiveIncomes;
    });

    // Garante que o mês atual do sistema esteja sempre incluído, mesmo que não tenha dados ativos.
    const isTodayMonthIncluded = filtered.some(monthDate =>
      monthDate.getMonth() === todayMonth && monthDate.getFullYear() === todayYear
    );
    if (!isTodayMonthIncluded) {
      filtered.push(initialMonthDate);
    }

    // Ordena para garantir que a ordem cronológica seja mantida
    return filtered.sort((a, b) => a.getTime() - b.getTime());

  }, [monthsToDisplay, initialMonthDate, allExpenses, allIncomes, getExpensesForMonth, getIncomesForMonth]);


  // ************* NOVO: Opções de mês e ano para o Picker do modal de limpeza inteligente *************
  // Gera as opções de mês para o Picker baseadas nos meses visíveis
  const pickerMonthOptions = useMemo(() => {
    const uniqueMonths = new Set();
    filteredMonthsToDisplay.forEach(date => uniqueMonths.add(String(date.getMonth() + 1).padStart(2, '0')));
    return Array.from(uniqueMonths).sort();
  }, [filteredMonthsToDisplay]);

  // Gera as opções de ano para o Picker baseadas nos anos visíveis
  const pickerYearOptions = useMemo(() => {
    const uniqueYears = new Set();
    filteredMonthsToDisplay.forEach(date => uniqueYears.add(String(date.getFullYear())));
    return Array.from(uniqueYears).sort();
  }, [filteredMonthsToDisplay]);
  // ************* FIM NOVO *************


  /**
   * Carrega todos os dados (receitas e despesas) do AsyncStorage.
   * Usa useCallback para memorização.
   * Agora também calcula e define o `currentMonthIndex` após o carregamento.
   */
  const loadData = useCallback(async () => {
    setLoadingApp(true); // Ativa o estado de carregamento
    try {
      const storedIncomesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.INCOMES);
      const storedIncomes = storedIncomesJson ? JSON.parse(storedIncomesJson) : [];
      setAllIncomes(storedIncomes);
      
      const storedExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      const currentExpenses = storedExpensesJson ? JSON.parse(storedExpensesJson) : [];
      setAllExpenses(currentExpenses);

      // --- NOVO: Cálculo e definição do initialScrollIndex após o carregamento dos dados ---
      // Re-calcula filteredMonthsToDisplay *com os dados recém-carregados* para encontrar o índice correto
      const tempFilteredMonths = monthsToDisplay.current.filter(monthDate => {
        const isCurrentSystemMonth = monthDate.getMonth() === initialMonthDate.getMonth() && monthDate.getFullYear() === initialMonthDate.getFullYear();
        const activeExpensesForMonth = getExpensesForMonth(monthDate, currentExpenses, true);
        const hasActiveExpenses = activeExpensesForMonth.length > 0;
        const activeIncomesForMonth = getIncomesForMonth(monthDate, storedIncomes, true);
        const hasActiveIncomes = activeIncomesForMonth.length > 0;
        return isCurrentSystemMonth || hasActiveExpenses || hasActiveIncomes;
      });
      // Garante que o initialMonthDate esteja presente
      if (!tempFilteredMonths.some(m => m.getTime() === initialMonthDate.getTime())) {
        tempFilteredMonths.push(initialMonthDate);
      }
      tempFilteredMonths.sort((a, b) => a.getTime() - b.getTime());

      const targetIndex = tempFilteredMonths.findIndex(monthDate =>
        monthDate.getMonth() === initialMonthDate.getMonth() &&
        monthDate.getFullYear() === initialMonthDate.getFullYear()
      );
      
      if (targetIndex !== -1) {
        setCurrentMonthIndex(targetIndex); // Define o estado para que FlatList use como initialScrollIndex
        console.log(`[DEBUG - loadData]: Índice inicial do mês atual calculado: ${targetIndex}`);
      } else {
        setCurrentMonthIndex(0); // Fallback para o primeiro item se não encontrar (situação improvável)
        console.warn(`[DEBUG - loadData]: Mês atual do sistema não encontrado na lista filtrada, padrão para índice 0.`);
      }
      // --- FIM NOVO ---

    } catch (error) {
      console.error("HomeScreen: Erro ao carregar dados do AsyncStorage:", error);
      Alert.alert('Erro de Carregamento', 'Não foi possível carregar os dados de finanças do armazenamento local.');
    } finally {
      setLoadingApp(false); // Desativa o estado de carregamento
      scrollAttempted.current = false; // Reset the scroll flag after all data is loaded and index set.
    }
  }, [initialMonthDate, monthsToDisplay, getExpensesForMonth, getIncomesForMonth]);


  /**
   * Função para gerar despesas aleatórias e salvá-las no AsyncStorage,
   * para TODOS os meses no range.
   * Após a geração, os dados são recarregados.
   * Usa useCallback para memorização.
   */
  const handleGenerateRandomExpenses = useCallback(async () => {
    setLoadingApp(true);
    try {
      // Gera despesas para TODOS os meses no range
      const generated = generateRandomExpensesData(monthsToDisplay.current); 

      const storedExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      const existingExpenses = storedExpensesJson ? JSON.parse(storedExpensesJson) : [];
      
      const combinedExpenses = [...existingExpenses, ...generated];

      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(combinedExpenses));
      Alert.alert('Sucesso', `${generated.length} despesas aleatórias geradas e adicionadas para todos os meses!`);
      // Após a geração e salvamento, a flag scrollAttempted deve ser resetada
      // para que a rolagem para o mês atual ocorra na próxima renderização.
      await loadData(); // Recarrega os dados, o que desencadeará a rolagem via useEffect
    } catch (error) {
      console.error("HomeScreen: Erro ao gerar despesas aleatórias:", error);
      Alert.alert('Erro', `Não foi possível gerar despesas aleatórias: ${error.message}`);
    } finally {
      setLoadingApp(false);
    }
  }, [loadData, monthsToDisplay]);


  /**
   * Hook `useFocusEffect` do React Navigation.
   * Garante que os dados sejam recarregados sempre que a tela Home entra em foco.
   * Ele reseta a flag `scrollAttempted` para permitir que a rolagem para o mês atual
   * ocorra novamente após o carregamento dos dados.
   */
  useFocusEffect(
    useCallback(() => {
      // Quando a tela é focada, resetamos a flag para que a rolagem seja reavaliada
      // na próxima vez que os dados estiverem carregados e estáveis.
      scrollAttempted.current = false; 
      loadData(); 
      return () => {
        // Lógica de limpeza, se necessário, ao sair do foco da tela.
      };
    }, [loadData]) // Dependências de useFocusEffect
  );

  /**
   * useEffect para lidar com a rolagem para o mês correto.
   * Este efeito é disparado quando `loadingApp` se torna `false` e
   * `filteredMonthsToDisplay` é atualizado. Ele agora age como uma garantia de correção,
   * caso o `initialScrollIndex` não seja perfeito na primeira renderização,
   * ou para scrolls subsequentes acionados por operações que não o `loadData` inicial.
   */
  useEffect(() => {
    // Só executa se o app não está carregando, há meses filtrados e a rolagem ainda não foi marcada como "tentada".
    if (!loadingApp && filteredMonthsToDisplay.length > 0 && !scrollAttempted.current) {
        const targetIndex = filteredMonthsToDisplay.findIndex(monthDate =>
            monthDate.getMonth() === initialMonthDate.getMonth() &&
            monthDate.getFullYear() === initialMonthDate.getFullYear()
        );

        if (flatListRef.current && targetIndex !== -1 && currentMonthIndex === targetIndex) {
            // Se já estamos no índice correto (o que deveria acontecer com o novo loadData),
            // apenas marcamos como tentado e logamos. Não há necessidade de re-rolar.
            scrollAttempted.current = true;
            console.log(`[DEBUG - Scroll useEffect]: Já no mês alvo: ${getMonthName(initialMonthDate)}/${initialMonthDate.getFullYear()} (Index: ${targetIndex})`);
        } else if (flatListRef.current && targetIndex !== -1) {
            // Se por alguma razão o currentMonthIndex não estava no alvo, ou precisamos corrigir,
            // fazemos o scroll. Um pequeno timeout ainda pode ser útil aqui para garantir
            // que o layout da FlatList esteja 100% estabilizado, especialmente após re-renders.
            setTimeout(() => {
                if (flatListRef.current) {
                    flatListRef.current.scrollToIndex({ index: targetIndex, animated: false });
                    setCurrentMonthIndex(targetIndex);
                    scrollAttempted.current = true;
                    console.log(`[DEBUG - Scroll useEffect]: Corrigindo rolagem para o mês alvo: ${getMonthName(initialMonthDate)}/${initialMonthDate.getFullYear()} (Index: ${targetIndex})`);
                }
            }, 100); // Pequeno delay
        }
    }
  }, [loadingApp, filteredMonthsToDisplay, initialMonthDate, currentMonthIndex]);


  /**
   * Calcula a receita total para um mês específico, considerando receitas fixas e ganhos pontuais,
   * e aplicando a lógica de exclusão suave.
   * @param {Date} monthDate - O objeto Date representando o mês para o qual calcular a receita.
   * @returns {number} O valor total da receita para o mês.
   */
  const calculateTotalIncomeForMonth = (monthDate) => {
    const targetMonth = monthDate.getMonth();
    const targetYear = monthDate.getFullYear();
    let totalIncome = 0;

    const displayMonthStart = new Date(targetYear, targetMonth, 1);
    const currentMonthYearString = formatMonthYearForExclusion(monthDate);
    
    allIncomes.forEach(income => {
      if (income.type === 'Fixo' && income.excludedMonths && income.excludedMonths.includes(currentMonthYearString)) {
        return;
      }

      const incomeCreationDate = new Date(income.createdAt);
      const creationMonthStart = new Date(incomeCreationDate.getFullYear(), incomeCreationDate.getMonth(), 1);

      if (income.type === 'Fixo') {
        const isCreatedBeforeOrInDisplayMonth = creationMonthStart.getTime() <= displayMonthStart.getTime();
        
        let isActiveInDisplayMonth = true;
        if (income.status === 'inactive' && income.deletedAt) {
          const deletionDate = new Date(income.deletedAt);
          const deletionMonthStart = new Date(deletionDate.getFullYear(), deletionDate.getMonth(), 1);
          
          if (deletionMonthStart.getTime() <= displayMonthStart.getTime()) {
            isActiveInDisplayMonth = false;
          }
        }

        if (isCreatedBeforeOrInDisplayMonth && isActiveInDisplayMonth) {
          totalIncome += income.value;
        }
      } 
      else if (income.type === 'Ganho' && income.month === targetMonth && income.year === targetYear) {
        let isActiveInDisplayMonth = true;
        if (income.status === 'inactive' && income.deletedAt) {
          const deletionDate = new Date(income.deletedAt);
          const deletionMonthStart = new Date(deletionDate.getFullYear(), deletionDate.getMonth(), 1);

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

  // Pega o objeto Date do mês atualmente exibido na tela.
  const currentDisplayedMonthDate = filteredMonthsToDisplay[currentMonthIndex] || initialMonthDate;

  // Calcula a receita total do mês atualmente visível.
  const currentMonthTotalIncome = calculateTotalIncomeForMonth(currentDisplayedMonthDate);

  // Obtém e calcula o total das despesas do mês atualmente visível.
  const currentDisplayedMonthExpenses = getExpensesForMonth(currentDisplayedMonthDate, allExpenses, true); // Passa allExpenses aqui
  const totalDespesasDisplayedMonth = currentDisplayedMonthExpenses.reduce((sum, item) => sum + item.value, 0);

  // Calcula o valor final (Receita - Despesa) para o mês atualmente visível.
  const valorFinalDisplayedMonth = currentMonthTotalIncome - totalDespesasDisplayedMonth;

  /**
   * Componente de renderização para cada seção de mês na FlatList.
   * @param {object} param0 - Contém o `item` (objeto Date do mês) e o `index`.
   */
  const renderMonthSection = ({ item: monthDate, index }) => {
    const expenses = getExpensesForMonth(monthDate, allExpenses, true); // Passa allExpenses aqui
    const monthName = getMonthName(monthDate);
    const year = monthDate.getFullYear();

    const isSystemCurrentMonth = monthDate.getMonth() === initialMonthDate.getMonth() &&
                                 initialMonthDate.getFullYear() === year;

    return (
      <View style={styles.monthPage}>
        <View style={[
          styles.section,
          isSystemCurrentMonth && styles.currentMonthHighlight
        ]}>
          <Text style={styles.sectionTitle}>{`${String(monthName)} ${String(year)}`}</Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.descriptionColumn]}>Despesa</Text>
            <Text style={[styles.headerText, styles.dateColumn]}>Data de Vencimento</Text>
            <Text style={[styles.headerText, styles.valueColumn]}>Valor</Text>
          </View>

          {expenses.length > 0 ? (
            <ScrollView style={styles.expensesScrollView}>
              {expenses.map((item) => (
                <View key={String(item.id)} style={styles.debitItemRow}>
                  <Text style={[styles.debitText, styles.descriptionColumn]}>{String(item.description)}</Text>
                  <Text style={[styles.debitText, styles.dateColumn]}>
                    {/* Exibe sempre a data formatada, seja de débito/crédito ou fixa */}
                    {String(formatDateForDisplay(new Date(item.dueDate)))}
                  </Text> 
                  <Text style={[styles.debitValue, styles.valueColumn]}>
                    {`${String(item.value.toFixed(2)).replace('.', ',')} R$`}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : (
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
    const newIndex = Math.round(contentOffsetX / width);
    if (newIndex !== currentMonthIndex) {
      setCurrentMonthIndex(newIndex);
    }
  };

  /**
   * Função para manipular a confirmação da limpeza de dados.
   * Agora, se a opção "Limpar dados de um mês específico" for selecionada,
   * ele abre o seletor de Mês/Ano. Caso contrário, executa a limpeza direta.
   */
  const handleConfirmClearData = async () => {
    if (selectedClearOption === '0') {
      // Define os valores iniciais do picker para o mês/ano atualmente visível no FlatList
      // Isso é importante para que o picker já inicie no contexto do usuário
      setPickerMonth(String(currentDisplayedMonthDate.getMonth() + 1).padStart(2, '0'));
      setPickerYear(String(currentDisplayedMonthDate.getFullYear()));

      setIsClearDataModalVisible(false); // Fecha o primeiro modal
      setIsMonthYearYearPickerVisible(true); // Abre o modal de seleção de mês/ano
      return; // Sai da função, a limpeza real acontecerá no novo modal
    }

    setIsClearDataModalVisible(false); // Fecha o modal
    setLoadingApp(true); // Inicia o indicador de carregamento
    
    // Assegura que o mês alvo seja o currentDisplayedMonthDate para logs de debug se não for opção 0
    const monthBeforeAction = currentDisplayedMonthDate;
    const targetMonth = monthBeforeAction.getMonth();
    const targetYear = monthBeforeAction.getFullYear();
    
    console.log(`[DEBUG - Limpeza]: Tentando limpar dados (opção ${selectedClearOption}) para ${getMonthName(monthBeforeAction)}/${targetYear}`);

    try {
      switch (selectedClearOption) {
        case '1': // Limpar todas as receitas (exclusão permanente)
          await AsyncStorage.removeItem(ASYNC_STORAGE_KEYS.INCOMES);
          Alert.alert('Sucesso', 'Todas as receitas foram limpas permanentemente.');
          break;
        case '2': // Limpar todas as despesas (exclusão permanente)
          await AsyncStorage.removeItem(ASYNC_STORAGE_KEYS.EXPENSES);
          Alert.alert('Sucesso', 'Todas as despesas foram limpas permanentemente.');
          break;
        case '3': // Limpar todos os cartões (exclusão permanente)
          await AsyncStorage.removeItem(ASYNC_STORAGE_KEYS.CARDS);
          Alert.alert('Sucesso', 'Todos os cartões foram limpos permanentemente.');
          break;
        case '4': // Limpar todos os dados (exclusão permanente)
        default:
          await AsyncStorage.clear();
          Alert.alert('Sucesso', 'TODOS os dados foram apagados permanentemente e recarregados.');
          break;
      }
      await loadData(); // Recarrega os dados, o que desencadeará a rolagem para o mês atual
      
    } catch (error) {
      console.error("HomeScreen: Erro ao limpar dados:", error);
      Alert.alert('Erro', `Não foi possível limpar os dados: ${error.message}`);
    } finally {
      setLoadingApp(false);
    }
  };

  /**
   * Função que executa a exclusão suave para o mês/ano selecionado no Picker.
   */
  const performMonthYearClear = async () => {
    setIsMonthYearYearPickerVisible(false); // Fecha o modal de seleção de mês/ano
    setLoadingApp(true);

    const monthToClear = parseInt(pickerMonth, 10) - 1; // Converte para 0-indexado
    const yearToClear = parseInt(pickerYear, 10);
    const targetDateToClear = new Date(yearToClear, monthToClear, 1);
    const targetMonthYearString = formatMonthYearForExclusion(targetDateToClear);

    console.log(`[DEBUG - Limpeza]: Limpando dados para ${getMonthName(targetDateToClear)}/${yearToClear} (selecionado pelo usuário)`);

    const lastDayOfTargetMonth = new Date(yearToClear, monthToClear + 1, 0); 

    try {
      // Atualiza receitas:
      const updatedIncomes = allIncomes.map(income => {
        if (income.type === 'Fixo') {
          // Se o mês já está excluído, não adiciona novamente para evitar duplicidade
          const newExcludedMonths = income.excludedMonths ? [...income.excludedMonths, targetMonthYearString] : [targetMonthYearString];
          return { ...income, excludedMonths: Array.from(new Set(newExcludedMonths)) };
        } else if (income.type === 'Ganho' && 
                   income.month === monthToClear && // <--- CORREÇÃO AQUI: Usa income.month
                   income.year === yearToClear &&   // <--- CORREÇÃO AQUI: Usa income.year
                   income.status !== 'inactive') {
          return { ...income, status: 'inactive', deletedAt: lastDayOfTargetMonth.toISOString() };
        }
        return income;
      });
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.INCOMES, JSON.stringify(updatedIncomes));

      // Atualiza despesas:
      const updatedExpenses = allExpenses.map(expense => {
        if (expense.paymentMethod === 'Fixa') {
          // Se o mês já está excluído, não adiciona novamente para evitar duplicidade
          const newExcludedMonths = expense.excludedMonths ? [...expense.excludedMonths, targetMonthYearString] : [targetMonthYearString];
          return { ...expense, excludedMonths: Array.from(new Set(newExcludedMonths)) };
        } else if (expense.paymentMethod === 'Débito' || expense.paymentMethod === 'Crédito') {
            const expenseDueDate = new Date(expense.dueDate);
            const expenseMonth = expenseDueDate.getMonth();
            const expenseYear = expenseDueDate.getFullYear();

            if (expenseMonth === monthToClear &&
                expenseYear === yearToClear &&
                expense.status !== 'inactive') {
                return { ...expense, status: 'inactive', deletedAt: lastDayOfTargetMonth.toISOString() };
            }
        }
        return expense;
      });
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(updatedExpenses));

      Alert.alert('Sucesso', `Dados do mês ${getMonthName(targetDateToClear)}/${yearToClear} marcados como inativos.`);
      await loadData(); // Recarrega os dados, o que desencadeará a rolagem para o mês atual
      
    } catch (error) {
      console.error("HomeScreen: Erro ao limpar dados do mês selecionado:", error);
      Alert.alert('Erro', `Não foi possível limpar os dados do mês selecionado: ${error.message}`);
    } finally {
      setLoadingApp(false);
    }
  };


  const clearAllData = () => {
    setIsClearDataModalVisible(true);
  };

  if (loadingApp) {
    return (
      <View style={commonStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Carregando dados de finanças locais...</Text>
      </View>
    );
  }

  const clearOptions = [
    { label: "Limpar dados de um mês específico (exclusão suave)", value: "0" }, // Opção que abre o novo modal
    { label: "Limpar todas as receitas (permanente)", value: "1" },
    { label: "Limpar todas as despesas (permanente)", value: "2" },
    { label: "Limpar todos os cartões (permanente)", value: "3" },
    { label: "Limpar TODOS os dados (permanente)", value: "4" },
  ];

  return (
    // Container principal da tela, aplicando o padding superior para respeitar a barra de status
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Container para os botões de ação no topo da tela */}
      <View style={styles.topButtonsContainer}>
        {/* Botão "Limpar Dados (Teste)" agora abre o modal */}
        <TouchableOpacity onPress={clearAllData} style={styles.clearDataButton}>
          <Text style={styles.clearDataButtonText}>Limpar Dados (Teste)</Text>
        </TouchableOpacity>
        {/* Botão "Gerar Despesas Aleatórias" */}
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
        initialScrollIndex={currentMonthIndex} // Usa o índice já calculado para a rolagem inicial
        extraData={currentMonthIndex} // Garante re-renderização quando o mês atual muda (para o resumo)
        // Otimização para listas longas: informa à FlatList o tamanho de cada item para otimiza a renderização
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

      {/* Modal Principal para opções de limpeza de dados */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isClearDataModalVisible}
        onRequestClose={() => {
          setIsClearDataModalVisible(false);
          setSelectedClearOption('4');
        }}
      >
        {/* Área que pode ser tocada fora do modal para fechá-lo */}
        <Pressable
          style={commonStyles.centeredView}
          onPressOut={() => {
            setIsClearDataModalVisible(false);
            setSelectedClearOption('4');
          }}
        >
          {/* Conteúdo do modal */}
          {/* Novo Pressable para o conteúdo do modal que impede a propagação de toques */}
          <Pressable style={[commonStyles.modalView, { zIndex: 100 }]} onPress={(e) => e.stopPropagation()}>
            <Text style={commonStyles.modalTitle}>Opções de Limpeza de Dados</Text>

            <View style={styles.clearOptionsContainer}> {/* Este container gerencia o layout vertical */}
              {clearOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    commonStyles.optionButton, // Usando o estilo comum aqui
                    selectedClearOption === option.value ? commonStyles.optionButtonSelected : {}
                  ]}
                  onPress={() => setSelectedClearOption(option.value)}
                >
                  <Text style={[ // GARANTIA DE TEXTO WRAPPADO
                    commonStyles.optionButtonText, // Usando o estilo comum aqui
                    selectedClearOption === option.value ? commonStyles.optionButtonTextSelected : {}
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={commonStyles.modalActionButtonsContainer}> {/* Usando o novo container de AÇÕES (lado a lado) */}
              <TouchableOpacity
                style={[commonStyles.modalButton, commonStyles.buttonEdit]} // Usando estilos do commonStyles
                onPress={handleConfirmClearData}
              >
                <Text style={commonStyles.buttonTextStyle}>Confirmar</Text> {/* GARANTIA DE TEXTO WRAPPADO */}
              </TouchableOpacity>
              <TouchableOpacity
                style={[commonStyles.modalButton, commonStyles.buttonClose]} // Usando estilos do commonStyles
                onPress={() => {
                  setIsClearDataModalVisible(false);
                  setSelectedClearOption('4');
                }}
              >
                <Text style={commonStyles.buttonTextStyle}>Cancelar</Text> {/* GARANTIA DE TEXTO WRAPPADO */}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* NOVO MODAL: Seleção de Mês e Ano para Limpeza Suave */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isMonthYearPickerVisible}
        onRequestClose={() => setIsMonthYearYearPickerVisible(false)}
      >
        <Pressable
          style={commonStyles.centeredView}
          onPressOut={() => setIsMonthYearYearPickerVisible(false)}
        >
          <Pressable style={[commonStyles.modalView, { zIndex: 100 }]} onPress={(e) => e.stopPropagation()}>
            <Text style={commonStyles.modalTitle}>Limpar Dados de Mês Específico</Text>
            <Text style={commonStyles.modalText}>Selecione o mês e ano para exclusão suave:</Text>

            <View style={commonStyles.pickerWrapper}>
              {/* Picker para Mês */}
              <View style={commonStyles.halfPickerContainer}>
                <Text style={commonStyles.pickerLabel}>Mês:</Text>
                <Picker
                  selectedValue={pickerMonth}
                  onValueChange={(itemValue) => setPickerMonth(itemValue)}
                  style={commonStyles.picker}
                >
                  {pickerMonthOptions.map(month => (
                    <Picker.Item key={String(month)} label={getMonthName(new Date(initialMonthDate.getFullYear(), parseInt(month, 10) -1, 1))} value={String(month)} />
                  ))}
                </Picker>
              </View>

              {/* Picker para Ano */}
              <View style={commonStyles.halfPickerContainer}>
                <Text style={commonStyles.pickerLabel}>Ano:</Text>
                <Picker
                  selectedValue={pickerYear}
                  onValueChange={(itemValue) => setPickerYear(itemValue)}
                  style={commonStyles.picker}
                >
                  {pickerYearOptions.map(year => (
                    <Picker.Item key={String(year)} label={String(year)} value={String(year)} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={commonStyles.modalActionButtonsContainer}> {/* Usando o novo container de AÇÕES (lado a lado) */}
              <TouchableOpacity
                style={[commonStyles.modalButton, commonStyles.buttonEdit]}
                onPress={performMonthYearClear}
              >
                <Text style={commonStyles.buttonTextStyle}>Confirmar Limpeza</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[commonStyles.modalButton, commonStyles.buttonClose]}
                onPress={() => setIsMonthYearYearPickerVisible(false)}
              >
                <Text style={commonStyles.buttonTextStyle}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

// Definição dos estilos do componente HomeScreen
const styles = StyleSheet.create({
  container: {
    ...commonStyles.container,
  },
  topButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 15,
  },
  clearDataButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    flex: 1, // Faz o botão ocupar o espaço disponível
    marginRight: 10, // Espaçamento entre os botões
    alignItems: 'center',
  },
  clearDataButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  generateRandomButton: {
    backgroundColor: '#28a745',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    flex: 1, // Faz o botão ocupar o espaço disponível
    alignItems: 'center',
  },
  generateRandomButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthPage: {
    width: width,
    paddingHorizontal: 15,
    paddingTop: 15,
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
    flex: 1,
  },
  currentMonthHighlight: {
    backgroundColor: '#e0f7fa', // Azul claro para destaque
    borderColor: '#00bcd4', // Ciano para borda
    borderWidth: 2, // Borda mais fina e visível
    shadowColor: '#00bcd4',
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
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
  expensesScrollView: {
    flex: 1,
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
  clearOptionsContainer: {
    width: '100%',
    marginBottom: 20,
  },
});

// screens/HomeScreen.js

/**
 * @file HomeScreen.js
 * @description Esta tela é a principal do aplicativo. Ela exibe um resumo financeiro do mês atual,
 * uma lista horizontal paginada de despesas por mês (passados e futuros),
 * e funcionalidades para adicionar/editar despesas, gerar dados de teste e limpar informações.
 *
 * Principais funcionalidades:
 * - Exibição paginada de despesas e receitas por mês, permitindo navegar entre eles.
 * - Cálculo e exibição da receita total e valor final para o mês atualmente visível.
 * - Gerenciamento de despesas de Débito, Crédito (com parcelamento) e Fixas, incluindo status de pago/pendente.
 * - Suporte a toque longo para edição de despesas e toque simples para alternar status de pagamento.
 * - Sincronização e persistência de dados de receitas, despesas e cartões com AsyncStorage.
 * - Modais para geração de despesas aleatórias e limpeza de dados (geral ou por mês específico).
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, ActivityIndicator, Alert, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons'; // Importa Ionicons para os ícones de checkbox

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
  if (d.getMonth() >= 0 && d.getMonth() < monthNames.length) {
    return monthNames[d.getMonth()];
  }
  return 'Mês Desconhecido'; // Fallback
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
  const numPastMonths = 12;
  const numFutureMonths = 12;

  // Adiciona meses anteriores
  for (let i = numPastMonths; i > 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(date);
  }

  // Adiciona o mês atual
  months.push(new Date(today.getFullYear(), today.getMonth(), 1));

  // Adiciona meses futuros
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

  console.log("[DEBUG] Iniciando generateRandomExpensesData");
  console.log("[DEBUG] monthsToConsider:", monthsToConsider);

  if (!Array.isArray(monthsToConsider)) {
    console.error("generateRandomExpensesData: monthsToConsider não é um array válido.");
    return [];
  }

  // Define limites para o número de despesas por mês
  const minDespesasPorMes = 3;  // Mínimo de despesas por mês
  const maxDespesasPorMes = 8;  // Máximo de despesas por mês
  
  console.log("[DEBUG] Meses disponíveis:", monthsToConsider.map(d => `${d.getMonth() + 1}/${d.getFullYear()}`));
  
  // Filtra apenas os meses atuais e futuros
  const today = new Date();
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const futureMeses = monthsToConsider.filter(monthDate => {
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    return startOfMonth >= currentMonth;
  }).sort((a, b) => a.getTime() - b.getTime());
  
  console.log("[DEBUG] Meses futuros:", futureMeses.map(d => `${d.getMonth() + 1}/${d.getFullYear()}`));
  
  // Para cada mês disponível, gera algumas despesas
  futureMeses.forEach((monthDate, monthIndex) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    
    // Gera um número aleatório de despesas para este mês
    const numDespesasDesteMes = Math.floor(
      Math.random() * (maxDespesasPorMes - minDespesasPorMes + 1) + minDespesasPorMes
    );
    
    console.log(`[DEBUG] Gerando ${numDespesasDesteMes} despesas para ${month + 1}/${year}`);
    
    // Gera as despesas para este mês
    for (let i = 0; i < numDespesasDesteMes; i++) {
      // Gera um dia aleatório para a despesa, evitando datas inválidas
      const maxDaysInMonth = new Date(year, month + 1, 0).getDate();
      const day = Math.floor(Math.random() * maxDaysInMonth) + 1;
      
      // Gera um valor aleatório entre R$ 20 e R$ 500
      const value = parseFloat((Math.random() * 480 + 20).toFixed(2));
      
      // Seleciona uma descrição aleatória
      const description = expenseDescriptions[Math.floor(Math.random() * expenseDescriptions.length)];
      
      const createdAtDate = new Date(year, month, day);
      const today = new Date();
      
      // Se for o mês atual, marca como pago apenas despesas até o dia atual
      const isPaidRandom = month === today.getMonth() && year === today.getFullYear()
        ? day <= today.getDate() && Math.random() > 0.3  // 70% de chance de estar pago se for até hoje
        : Math.random() > 0.5;  // 50% de chance para meses futuros

      const expense = {
        id: Date.now().toString() + monthIndex + i, // ID único com índice do mês e da despesa
        description,
        value,
        createdAt: createdAtDate.toISOString(),
        status: isPaidRandom ? 'paid' : 'pending',
        paidAt: isPaidRandom ? new Date().toISOString() : null,
        paymentMethod: 'Débito',
        dueDate: createdAtDate.toISOString(),
        deletedAt: null
      };

      console.log("[DEBUG] Despesa gerada:", expense);
      generatedExpenses.push(expense);
    }
  });

  console.log("[DEBUG] Total de despesas geradas:", generatedExpenses.length);

  return generatedExpenses.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets(); // Hook para obter os insets da área segura da tela

  // Estado para controlar o carregamento inicial da aplicação
  const [loadingApp, setLoadingApp] = useState(true);
  // Estado para armazenar todas as receitas carregadas
  const [allIncomes, setAllIncomes] = useState([]);
  // Estado para armazenar todas as despesas carregadas
  const [allExpenses, setAllExpenses] = useState([]);

  // Estados para controlar a visibilidade e seleção do modal de limpeza de dados
  const [isClearDataModalVisible, setIsClearDataModalVisible] = useState(false);
  const [selectedClearOption, setSelectedClearOption] = useState('4'); // Opção padrão: limpar todos os dados

  // Estados para controlar a visibilidade e seleção do picker de mês/ano no modal de limpeza específica
  const [isMonthYearPickerVisible, setIsMonthYearYearPickerVisible] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [pickerYear, setPickerYear] = useState(String(new Date().getFullYear()));

  // Referência para a lista completa de meses que podem ser exibidos
  const monthsToDisplay = useRef(generateMonthsToDisplay());

  // Objeto Date para representar o primeiro dia do mês atual do sistema
  const today = new Date();
  const initialMonthDate = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), []);

  // Estado para o índice do mês atualmente visível na FlatList
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  // Referência para a FlatList, usada para controle de rolagem programática
  const flatListRef = useRef(null);

  // Referência para controlar se uma tentativa de rolagem já foi feita (evita múltiplos scrolls)
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
   * Filtra e processa as despesas para um mês específico.
   * Considera despesas fixas (com seus meses de exclusão) e despesas de débito/crédito.
   * @param {Date} monthDate - O objeto Date representando o mês alvo.
   * @param {Array<object>} expensesData - Array de todas as despesas.
   * @param {boolean} onlyActive - Se deve retornar apenas despesas ativas (não soft-deleted).
   * @returns {Array<object>} Array de despesas filtradas e processadas para o mês.
   */
  const getExpensesForMonth = useCallback((monthDate, expensesData, onlyActive = false) => {
    const targetMonth = monthDate.getMonth();
    const targetYear = monthDate.getFullYear();
    const displayMonthStartTimestamp = new Date(targetYear, targetMonth, 1).getTime();
    const currentMonthYearString = formatMonthYearForExclusion(monthDate);
    
    let expensesForThisMonth = [];

    expensesData.forEach(item => {
      // Ignora itens marcados para exclusão suave
      if (item.deletedAt) {
        return;
      }

      // Se `onlyActive` é true, ignora itens com status 'inactive'
      if (onlyActive && item.status === 'inactive') {
        return;
      }

      // Lógica específica para despesas fixas
      if (item.paymentMethod === 'Fixa') {
        // Verifica se o mês/ano atual está na lista de meses excluídos para essa despesa fixa
        if (item.excludedMonths && item.excludedMonths.includes(currentMonthYearString)) {
          return;
        }

        // Verifica se a despesa fixa já deve começar a ser exibida
        const startDate = new Date(item.startYear || item.createdAt.getFullYear(), 
                                 item.startMonth || item.createdAt.getMonth(), 1);
        const targetDate = new Date(targetYear, targetMonth, 1);

        // Só exibe a despesa fixa se o mês/ano alvo for igual ou posterior ao mês/ano inicial
        if (targetDate.getTime() >= startDate.getTime()) {
          let dayForFixedExpense = item.dueDayOfMonth || 1;
          const lastDayOfTargetMonth = getLastDayOfMonth(targetYear, targetMonth);
          
          // Ajusta o dia de vencimento se for maior que o número de dias do mês alvo
          if (dayForFixedExpense > lastDayOfTargetMonth) {
            dayForFixedExpense = lastDayOfTargetMonth;
          }

          const fixedDueDate = new Date(targetYear, targetMonth, dayForFixedExpense);
          
          // Define se a despesa está atrasada baseado na data atual
          const today = new Date();
          const isDueDateBeforeToday = fixedDueDate < today;

          // Encontra o status específico para este mês/ano (se houver um status mensal)
          const monthYearKey = `${targetYear}-${targetMonth}`;
          const monthStatus = item.monthlyStatus?.find(
            status => status.monthYear === monthYearKey
          );

          expensesForThisMonth.push({
            ...item,
            dueDate: fixedDueDate.toISOString(), // Define a data de vencimento ajustada para o mês
            id: `${item.id}-${targetYear}-${targetMonth}`, // ID único por mês para despesas fixas
            originalId: item.id, // Referência ao ID original da despesa fixa
            description: item.description, // Descrição original (o "(Fixa)" é adicionado na renderização)
            status: monthStatus?.status || 'pending', // Usa o status mensal ou 'pending'
            paidAt: monthStatus?.paidAt || null
          });
        }
      }
      // Lógica para despesas de Débito e Crédito
      else {
        if (item.dueDate) {
          const itemDueDate = new Date(item.dueDate);
          // Inclui a despesa se a data de vencimento for no mês/ano atual
          if (itemDueDate.getMonth() === targetMonth && itemDueDate.getFullYear() === targetYear) {
            // Para despesas de crédito, garante que o ID e número da parcela sejam mantidos
            if (item.paymentMethod === 'Crédito') {
              expensesForThisMonth.push({
                ...item,
                id: item.id,
                installmentNumber: item.installmentNumber
              });
            } else {
              expensesForThisMonth.push(item);
            }
          }
        }
      }
    });    
    // Ordena as despesas pela data de vencimento ou criação para exibição consistente
    return expensesForThisMonth.sort((a, b) => {
      const dateA = new Date(a.dueDate || a.createdAt); 
      const dateB = new Date(b.dueDate || b.createdAt);
      return dateA.getTime() - dateB.getTime();
    });
  }, []); // Depende apenas de si mesmo para evitar recriação desnecessária

  /**
   * Filtra e processa as receitas para um mês específico.
   * Considera receitas fixas (com seus meses de exclusão) e receitas de ganho.
   * @param {Date} monthDate - O objeto Date representando o mês alvo.
   * @param {Array<object>} incomesData - Array de todas as receitas.
   * @param {boolean} onlyActive - Se deve retornar apenas receitas ativas (não soft-deleted).
   * @returns {Array<object>} Array de receitas filtradas e processadas para o mês.
   */
  const getIncomesForMonth = useCallback((monthDate, incomesData, onlyActive = false) => {
    const targetMonth = monthDate.getMonth();
    const targetYear = monthDate.getFullYear();
    const displayMonthStartTimestamp = new Date(targetYear, targetMonth, 1).getTime();
    const currentMonthYearString = formatMonthYearForExclusion(monthDate);

    let incomesForThisMonth = [];

    incomesData.forEach(item => {
      // Ignora itens marcados para exclusão suave
      if (item.deletedAt) {
        return;
      }

      // Se `onlyActive` é true, ignora itens com status 'inactive'
      if (onlyActive && item.status === 'inactive') {
        return;
      }

      // Lógica específica para receitas fixas
      if (item.type === 'Fixo') {
        // Verifica se o mês/ano atual está na lista de meses excluídos para essa receita fixa
        if (item.excludedMonths && item.excludedMonths.includes(currentMonthYearString)) {
          return;
        }

        const createdAtDate = new Date(item.createdAt);
        const createdAtMonthStart = new Date(createdAtDate.getFullYear(), createdAtDate.getMonth(), 1).getTime();
        // A receita fixa só aparece se foi criada antes ou no mês atual de exibição
        if (createdAtMonthStart <= displayMonthStartTimestamp) {
          incomesForThisMonth.push(item);
        }
      }
      // Lógica para receitas de ganho (receitas pontuais)
      else if (item.type === 'Ganho') {
        // Inclui a receita se o mês e ano da receita corresponderem ao mês/ano atual
        if (item.month === targetMonth && item.year === targetYear) {
          incomesForThisMonth.push(item);
        }
      }
    });    
    return incomesForThisMonth;
  }, []); // Depende apenas de si mesmo

  /**
   * `useMemo` para filtrar os meses a serem exibidos na FlatList horizontal.
   * Garante que apenas meses com receitas ou despesas ativas, ou o mês atual do sistema, sejam mostrados.
   * Recomputa apenas quando `monthsToDisplay`, `initialMonthDate`, `allExpenses` ou `allIncomes` mudam.
   */
  const filteredMonthsToDisplay = useMemo(() => {
    const allGeneratedMonths = monthsToDisplay.current;
    const todayMonth = initialMonthDate.getMonth();
    const todayYear = initialMonthDate.getFullYear();

    const filtered = allGeneratedMonths.filter(monthDate => {
      const isCurrentSystemMonth = monthDate.getMonth() === todayMonth && monthDate.getFullYear() === todayYear;
      
      const activeExpensesForMonth = getExpensesForMonth(monthDate, allExpenses, true);
      const hasActiveExpenses = activeExpensesForMonth.length > 0;
      
      const activeIncomesForMonth = getIncomesForMonth(monthDate, allIncomes, true);
      const hasActiveIncomes = activeIncomesForMonth.length > 0;

      // Retorna true se for o mês atual, ou se tiver despesas/receitas ativas
      return isCurrentSystemMonth || hasActiveExpenses || hasActiveIncomes;
    });

    // Garante que o mês atual do sistema esteja sempre incluído, mesmo que não tenha movimentos
    const isTodayMonthIncluded = filtered.some(monthDate =>
      monthDate.getMonth() === todayMonth && monthDate.getFullYear() === todayYear
    );
    if (!isTodayMonthIncluded) {
      filtered.push(initialMonthDate);
    }

    // Ordena os meses cronologicamente
    return filtered.sort((a, b) => a.getTime() - b.getTime());

  }, [monthsToDisplay, initialMonthDate, allExpenses, allIncomes, getExpensesForMonth, getIncomesForMonth]);

  /**
   * `useMemo` para gerar as opções de meses para o Picker no modal de limpeza de dados.
   * Obtém meses únicos dos meses filtrados.
   */
  const pickerMonthOptions = useMemo(() => {
    const uniqueMonths = new Set();
    filteredMonthsToDisplay.forEach(date => uniqueMonths.add(String(date.getMonth() + 1).padStart(2, '0')));
    return Array.from(uniqueMonths).sort();
  }, [filteredMonthsToDisplay]);

  /**
   * `useMemo` para gerar as opções de anos para o Picker no modal de limpeza de dados.
   * Obtém anos únicos dos meses filtrados.
   */
  const pickerYearOptions = useMemo(() => {
    const uniqueYears = new Set();
    filteredMonthsToDisplay.forEach(date => uniqueYears.add(String(date.getFullYear())));
    return Array.from(uniqueYears).sort();
  }, [filteredMonthsToDisplay]);

  /**
   * Carrega os dados de receitas e despesas do AsyncStorage.
   * Calcula o índice do mês atual para a rolagem inicial da FlatList.
   * É um `useCallback` para evitar recriações desnecessárias.
   */
  const loadData = useCallback(async () => {
    setLoadingApp(true); // Inicia o indicador de carregamento
    try {
      // Carrega receitas
      const storedIncomesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.INCOMES);
      const storedIncomes = storedIncomesJson ? JSON.parse(storedIncomesJson) : [];
      setAllIncomes(storedIncomes);
      
      // Carrega despesas
      const storedExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      const currentExpenses = storedExpensesJson ? JSON.parse(storedExpensesJson) : [];
      setAllExpenses(currentExpenses);

      // --- Lógica para determinar o `initialScrollIndex` ---
      // Recria a lista de meses filtrados temporariamente para encontrar o índice correto
      const tempFilteredMonths = monthsToDisplay.current.filter(monthDate => {
        const isCurrentSystemMonth = monthDate.getMonth() === initialMonthDate.getMonth() && monthDate.getFullYear() === initialMonthDate.getFullYear();
        const activeExpensesForMonth = getExpensesForMonth(monthDate, currentExpenses, true);
        const hasActiveExpenses = activeExpensesForMonth.length > 0;
        const activeIncomesForMonth = getIncomesForMonth(monthDate, storedIncomes, true);
        const hasActiveIncomes = activeIncomesForMonth.length > 0;
        return isCurrentSystemMonth || hasActiveExpenses || hasActiveIncomes;
      });
      // Garante que o mês atual esteja na lista, mesmo que não tenha movimentos
      if (!tempFilteredMonths.some(m => m.getTime() === initialMonthDate.getTime())) {
        tempFilteredMonths.push(initialMonthDate);
      }
      tempFilteredMonths.sort((a, b) => a.getTime() - b.getTime()); // Re-ordena

      // Encontra o índice do mês atual na lista filtrada para a rolagem
      const targetIndex = tempFilteredMonths.findIndex(monthDate =>
        monthDate.getMonth() === initialMonthDate.getMonth() &&
        monthDate.getFullYear() === initialMonthDate.getFullYear()
      );
      
      if (targetIndex !== -1) {
        setCurrentMonthIndex(targetIndex);
        console.log(`[DEBUG - loadData]: Índice inicial do mês atual calculado: ${targetIndex}`);
      } else {
        setCurrentMonthIndex(0); // Fallback para índice 0
        console.warn(`[DEBUG - loadData]: Mês atual do sistema não encontrado na lista filtrada, padrão para índice 0.`);
      }

    } catch (error) {
      console.error("HomeScreen: Erro ao carregar dados do AsyncStorage:", error);
      Alert.alert('Erro de Carregamento', 'Não foi possível carregar os dados de finanças do armazenamento local.');
    } finally {
      setLoadingApp(false); // Finaliza o indicador de carregamento
      scrollAttempted.current = false; // Reseta a flag de rolagem para permitir um novo scroll
    }
  }, [initialMonthDate, monthsToDisplay, getExpensesForMonth, getIncomesForMonth]); // Depende dessas funções/variáveis

  /**
   * Função para gerar despesas aleatórias para fins de teste e demonstração.
   * Adiciona essas despesas às existentes no AsyncStorage.
   * É um `useCallback` para evitar recriações desnecessárias.
   */
  const handleGenerateRandomExpenses = useCallback(async () => {
    setLoadingApp(true);
    try {
      console.log("[DEBUG] Iniciando geração de despesas aleatórias");
      const generated = generateRandomExpensesData(monthsToDisplay.current);
      console.log("[DEBUG] Despesas geradas:", generated);

      const storedExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      const existingExpenses = storedExpensesJson ? JSON.parse(storedExpensesJson) : [];
      console.log("[DEBUG] Despesas existentes:", existingExpenses);
      
      const combinedExpenses = [...existingExpenses, ...generated]; // Combina as despesas
      console.log("[DEBUG] Total de despesas após combinação:", combinedExpenses.length);

      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(combinedExpenses));
      console.log("[DEBUG] Despesas salvas no AsyncStorage");

      setAllExpenses(combinedExpenses); // Atualiza o estado diretamente
      console.log("[DEBUG] Estado de allExpenses atualizado");

      Alert.alert('Sucesso', `${generated.length} despesas aleatórias geradas e adicionadas!`);
      await loadData(); // Recarrega os dados para que as novas despesas sejam exibidas
    } catch (error) {
      console.error("HomeScreen: Erro ao gerar despesas aleatórias:", error);
      Alert.alert('Erro', `Não foi possível gerar despesas aleatórias: ${error.message}`);
    } finally {
      setLoadingApp(false);
    }
  }, [loadData, monthsToDisplay]); // Depende de `loadData` e `monthsToDisplay`

  /**
   * `useFocusEffect` para garantir que os dados sejam recarregados e a tela seja atualizada
   * sempre que a `HomeScreen` for focada (ex: ao navegar de volta para ela).
   */
  useFocusEffect(
    useCallback(() => {
      scrollAttempted.current = false; // Reseta a flag para permitir rolagem no foco
      const fetchData = async () => {
        console.log("HomeScreen: Recarregando dados após foco");
        await loadData();
      };
      fetchData();
      return () => {}; // Cleanup function
    }, [loadData]) // Depende de `loadData`
  );

  /**
   * `useEffect` para corrigir a rolagem da FlatList para o mês atual.
   * É acionado na montagem ou quando `loadingApp`, `filteredMonthsToDisplay`, `initialMonthDate` ou `currentMonthIndex` mudam.
   * Garante que a `FlatList` inicie no mês correto, evitando o "flicker".
   */
  useEffect(() => {
    // Só tenta rolar se o app não estiver carregando, houver meses para exibir e a rolagem ainda não foi tentada
    if (!loadingApp && filteredMonthsToDisplay.length > 0 && !scrollAttempted.current) {
        const targetIndex = filteredMonthsToDisplay.findIndex(monthDate =>
            monthDate.getMonth() === initialMonthDate.getMonth() &&
            monthDate.getFullYear() === initialMonthDate.getFullYear()
        );

        if (flatListRef.current && targetIndex !== -1 && currentMonthIndex === targetIndex) {
            // Se já está no mês alvo e o índice já está correto, marca como rolado
            scrollAttempted.current = true;
            console.log(`[DEBUG - Scroll useEffect]: Já no mês alvo: ${getMonthName(initialMonthDate)}/${initialMonthDate.getFullYear()} (Index: ${targetIndex})`);
        } else if (flatListRef.current && targetIndex !== -1) {
            // Se não está no mês alvo ou o índice precisa ser ajustado, realiza a rolagem
            setTimeout(() => {
                if (flatListRef.current) {
                    flatListRef.current.scrollToIndex({ index: targetIndex, animated: false });
                    setCurrentMonthIndex(targetIndex); // Atualiza o estado do índice
                    scrollAttempted.current = true;
                    console.log(`[DEBUG - Scroll useEffect]: Corrigindo rolagem para o mês alvo: ${getMonthName(initialMonthDate)}/${initialMonthDate.getFullYear()} (Index: ${targetIndex})`);
                }
            }, 100); // Pequeno atraso para garantir que a FlatList esteja renderizada
        }
    }
  }, [loadingApp, filteredMonthsToDisplay, initialMonthDate, currentMonthIndex]); // Depende desses estados/refs

  /**
   * Calcula o total de receitas para o mês atualmente exibido.
   * Considera receitas fixas e de ganho, e a lógica de exclusão suave.
   * @param {Date} monthDate - O objeto Date do mês alvo.
   * @returns {number} O valor total das receitas para o mês.
   */
  const calculateTotalIncomeForMonth = (monthDate) => {
    const targetMonth = monthDate.getMonth();
    const targetYear = monthDate.getFullYear();
    let totalIncome = 0;

    const displayMonthStart = new Date(targetYear, targetMonth, 1);
    const currentMonthYearString = formatMonthYearForExclusion(monthDate);
    
    allIncomes.forEach(income => {
      // Ignora receitas fixas que foram excluídas para este mês específico
      if (income.type === 'Fixo' && income.excludedMonths && income.excludedMonths.includes(currentMonthYearString)) {
        return;
      }

      const incomeCreationDate = new Date(income.createdAt);
      const creationMonthStart = new Date(incomeCreationDate.getFullYear(), incomeCreationDate.getMonth(), 1);

      // Lógica para receitas fixas
      if (income.type === 'Fixo') {
        const isCreatedBeforeOrInDisplayMonth = creationMonthStart.getTime() <= displayMonthStart.getTime();
        
        let isActiveInDisplayMonth = true;
        // Verifica se a receita fixa foi desativada (soft deleted) antes ou no mês de exibição
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
      // Lógica para receitas de ganho
      else if (income.type === 'Ganho' && income.month === targetMonth && income.year === targetYear) {
        let isActiveInDisplayMonth = true;
        // Verifica se a receita de ganho foi desativada (soft deleted) antes ou no mês de exibição
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

  // Obtém a data do mês atualmente exibido na FlatList (baseado em `currentMonthIndex`)
  const currentDisplayedMonthDate = filteredMonthsToDisplay[currentMonthIndex] || initialMonthDate;

  // Calcula a receita total para o mês atualmente exibido
  const currentMonthTotalIncome = calculateTotalIncomeForMonth(currentDisplayedMonthDate);

  // Obtém as despesas ativas para o mês atualmente exibido
  const currentDisplayedMonthExpenses = getExpensesForMonth(currentDisplayedMonthDate, allExpenses, true);
  
  // Calcula o total das despesas do mês atualmente exibido
  const totalDespesasDisplayedMonth = currentDisplayedMonthExpenses.reduce((sum, item) => sum + item.value, 0);

  // Calcula o valor final (Receita Total - Despesa Total) para o mês atualmente exibido
  const valorFinalDisplayedMonth = currentMonthTotalIncome - totalDespesasDisplayedMonth;

  /**
   * Handler para navegar para a tela de edição de despesa.
   * Acionado por um *toque longo* em um item da lista de despesas.
   * @param {object} expense - O objeto de despesa a ser editado.
   */
  const handleEditExpense = (expense) => {
    // Prepara o objeto de despesa para edição mantendo informações importantes
    let expenseToEdit = {
      ...expense,
      originalExpenseId: expense.originalExpenseId || expense.id.split('-')[0], // Mantém o ID original para parcelas de crédito
    };

    // Se for uma despesa fixa, mantém o ID completo para preservar o mês
    if (expense.paymentMethod === 'Fixa') {
      expenseToEdit.id = expense.id; // Mantém o ID completo com o mês
    } else if (expense.paymentMethod === 'Crédito') {
      // Para despesas de crédito, mantém informações das parcelas
      expenseToEdit.id = expense.originalExpenseId || expense.id.split('-')[0];
      expenseToEdit.installmentNumber = expense.installmentNumber;
      expenseToEdit.totalInstallments = expense.totalInstallments;
    } else {
      // Para despesas de débito, usa o ID base
      expenseToEdit.id = expense.id.split('-')[0];
    }
    
    navigation.navigate('DespesaTab', {
      screen: 'DespesaScreenInternal',
      params: { expenseToEdit: expenseToEdit }, // Passa a despesa para a tela de edição
    });
  };

  /**
   * Handler para alternar o status de uma despesa entre 'paga' e 'pendente'.
   * Atualiza o estado local e persiste a mudança no AsyncStorage.
   * @param {string} expenseId - O ID da despesa a ser atualizada.
   */
  const handleTogglePaidStatus = useCallback(async (expenseId) => {
    // Extrai o ID base e quaisquer sufixos do ID completo (ex: "ID_BASE-ANO-MES")
    const [baseId, ...suffixes] = expenseId.split('-');
    
    let expenseIndex = -1;
    // Busca a despesa correspondente no array `allExpenses`
    const originalExpense = allExpenses.find((exp, index) => {
      // Para despesas de crédito, procura pela parcela específica
      if (exp.paymentMethod === 'Crédito') {
        const isMatch = exp.id === expenseId || // ID exato da parcela
                       (exp.originalExpenseId === baseId && exp.installmentNumber === parseInt(suffixes[0], 10)); // ID base e número da parcela
        if (isMatch) {
          expenseIndex = index;
          return true;
        }
      }
      // Para despesas fixas, usa o ID base
      else if (exp.paymentMethod === 'Fixa') {
        const isMatch = exp.id === baseId;
        if (isMatch) {
          expenseIndex = index;
          return true;
        }
      }
      // Para outras despesas (débito), verifica o ID exato
      else {
        const isMatch = exp.id === expenseId;
        if (isMatch) {
          expenseIndex = index;
          return true;
        }
      }
      return false;
    });

    if (!originalExpense) {
      console.warn(`[DEBUG - handleTogglePaidStatus]: Despesa com ID ${expenseId} não encontrada.`);
      return;
    }

    console.log(`[DEBUG - handleTogglePaidStatus]: Encontrada despesa tipo ${originalExpense.paymentMethod}, ID: ${expenseId}`);

    if (expenseIndex === -1) {
      console.warn(`[DEBUG - handleTogglePaidStatus]: Despesa com ID ${expenseId} não encontrada.`);
      return;
    }

    const updatedExpenses = [...allExpenses];
    const expenseToUpdate = { ...updatedExpenses[expenseIndex] };

    // --- Lógica para alternar status de acordo com o tipo de despesa ---
    // Se for uma despesa fixa com sufixo de mês/ano (indicando uma instância mensal)
    if (expenseToUpdate.paymentMethod === 'Fixa' && suffixes.length === 2) {
      const [year, month] = suffixes;
      // Inicializa o array `monthlyStatus` se não existir
      if (!expenseToUpdate.monthlyStatus) {
        expenseToUpdate.monthlyStatus = [];
      }

      const monthYearKey = `${year}-${month}`;
      // Procura se já existe um status para este mês/ano específico
      const existingStatusIndex = expenseToUpdate.monthlyStatus.findIndex(
        status => status.monthYear === monthYearKey
      );

      if (existingStatusIndex >= 0) {
        // Se já existe, alterna o status e a data de pagamento
        const currentStatus = expenseToUpdate.monthlyStatus[existingStatusIndex].status;
        expenseToUpdate.monthlyStatus[existingStatusIndex] = {
          monthYear: monthYearKey,
          status: currentStatus === 'paid' ? 'pending' : 'paid',
          paidAt: currentStatus === 'paid' ? null : new Date().toISOString()
        };
      } else {
        // Se não existe, adiciona um novo status 'paid'
        expenseToUpdate.monthlyStatus.push({
          monthYear: monthYearKey,
          status: 'paid',
          paidAt: new Date().toISOString()
        });
      }
    }
    // Se for uma despesa de crédito
    else if (expenseToUpdate.paymentMethod === 'Crédito') {
      // Alterna o status e a data de pagamento para a parcela específica
      if (expenseToUpdate.status === 'pending') {
        expenseToUpdate.status = 'paid';
        expenseToUpdate.paidAt = new Date().toISOString();
      } else {
        expenseToUpdate.status = 'pending';
        expenseToUpdate.paidAt = null;
      }
      console.log(`[DEBUG - handleTogglePaidStatus]: Atualizando parcela ${expenseToUpdate.installmentNumber} para status: ${expenseToUpdate.status}`);
    }
    // Para despesas normais (débito)
    else {
      // Alterna o status e a data de pagamento
      if (expenseToUpdate.status === 'pending') {
        expenseToUpdate.status = 'paid';
        expenseToUpdate.paidAt = new Date().toISOString();
      } else {
        expenseToUpdate.status = 'pending';
        expenseToUpdate.paidAt = null;
      }
    }

    updatedExpenses[expenseIndex] = expenseToUpdate; // Atualiza a despesa no array
    setAllExpenses(updatedExpenses); // Atualiza o estado local com as despesas modificadas

    // Persiste a mudança no AsyncStorage
    try {
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(updatedExpenses));
      console.log(`[DEBUG - handleTogglePaidStatus]: Despesa ${expenseId} atualizada para status: ${expenseToUpdate.status}`);
    } catch (error) {
      console.error('Erro ao salvar status da despesa:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao atualizar o status da despesa. Tente novamente.');
    }
  }, [allExpenses]); // Depende de `allExpenses` para obter o estado mais recente

  /**
   * Retorna o texto de status formatado para uma despesa, considerando sua data de vencimento.
   * Pode ser "Pago", "Vence Hoje", "Vence Amanhã", "Atrasado" ou "Vence".
   * @param {object} expense - O objeto de despesa.
   * @returns {string} O texto de status formatado.
   */
  const getStatusText = (expense) => {
    if (expense.status === 'paid') {
      return 'Pago';
    } else {
      // Cria objetos Date para comparação, zerando horas para evitar problemas de fuso horário/horário exato
      const dueDate = parseDateString(formatDateForDisplay(new Date(expense.dueDate)));
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Se for uma despesa fixa, verifica se estamos no mês inicial
      if (expense.paymentMethod === 'Fixa' && expense.startMonth !== undefined && expense.startYear !== undefined) {
        const startDate = new Date(expense.startYear, expense.startMonth, expense.dueDayOfMonth || 1);
        const firstMonth = startDate.getMonth() === dueDate.getMonth() && 
                         startDate.getFullYear() === dueDate.getFullYear();
        
        // Se for o mês inicial e o dia de vencimento for menor que o dia atual,
        // não mostra como atrasado, pois a despesa começa apenas no próximo mês
        if (firstMonth && dueDate < today) {
          return `Começa no próximo mês`;
        }
      }

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // Compara as datas para determinar o status
      if (dueDate.getTime() === today.getTime()) {
        return `Vence Hoje: ${formatDateForDisplay(new Date(expense.dueDate))}`;
      } else if (dueDate.getTime() === tomorrow.getTime()) {
        return `Vence Amanhã: ${formatDateForDisplay(new Date(expense.dueDate))}`;
      } else if (dueDate < today) {
        return `Atrasado: ${formatDateForDisplay(new Date(expense.dueDate))}`;
      } else {
        return `Vence: ${formatDateForDisplay(new Date(expense.dueDate))}`;
      }
    }
  };


  /**
   * Renderiza cada seção de mês na FlatList horizontal.
   * Exibe o título do mês/ano, um cabeçalho de tabela e a lista de despesas.
   * @param {object} param0 - Objeto contendo o item (monthDate) e o índice.
   * @returns {JSX.Element} Componente de visualização para o mês.
   */
  const renderMonthSection = ({ item: monthDate, index }) => {
    // Filtra as despesas ativas para o mês atual da seção
    const expenses = getExpensesForMonth(monthDate, allExpenses, true);
    const monthName = getMonthName(monthDate);
    const year = monthDate.getFullYear();

    // Verifica se a seção atual corresponde ao mês atual do sistema para aplicar destaque
    const isSystemCurrentMonth = monthDate.getMonth() === initialMonthDate.getMonth() &&
                                 initialMonthDate.getFullYear() === year;

    return (
      <View style={styles.monthPage}>
        <View style={[
          styles.section,
          isSystemCurrentMonth && styles.currentMonthHighlight // Aplica destaque se for o mês atual
        ]}>
          <Text style={styles.sectionTitle}>{String(monthName)} {String(year)}</Text>

          {/* Cabeçalho da tabela de despesas com colunas para checkbox, descrição e valor */}
          <View style={styles.tableHeader}>
            <View style={styles.checkboxHeaderColumn}></View> 
            <Text style={[styles.headerText, styles.descriptionColumnAdjusted]}>Despesa</Text>
            <Text style={[styles.headerText, styles.valueColumn]}>Valor</Text>
          </View>

          {expenses.length > 0 ? (
            // Exibe a lista de despesas em um ScrollView
            <ScrollView style={styles.expensesScrollView}>
              {expenses.map((item) => (
                <TouchableOpacity 
                  key={String(item.id)} 
                  style={styles.debitItemRowAdjusted} // Estilo ajustado para espaçamento vertical
                  onLongPress={() => handleEditExpense(item)} // Toque longo para editar a despesa
                  activeOpacity={0.7} // Adiciona um feedback visual ao toque
                >
                  {/* Checkbox para marcar/desmarcar despesa como paga */}
                  <TouchableOpacity onPress={() => handleTogglePaidStatus(item.id)} style={styles.checkboxContainerAdjusted}>
                    <Ionicons
                      name={item.status === 'paid' ? 'checkbox' : 'square-outline'} 
                      size={24}
                      color={item.status === 'paid' ? '#28a745' : '#6c757d'} 
                    />
                  </TouchableOpacity>

                  <View style={styles.descriptionAndFooterContainer}>
                    <Text style={styles.debitText}>
                      {String(item.description)}
                      {/* Adiciona "(Fixa)" à descrição se o método de pagamento for 'Fixa' */}
                      {item.paymentMethod === 'Fixa' && " (Fixa)"}
                      {/* Adiciona número da parcela para despesas de crédito */}
                      {item.paymentMethod === 'Crédito' && item.installmentNumber && item.totalInstallments && 
                        ` (${item.installmentNumber}/${item.totalInstallments})`}
                    </Text>
                    {/* Rodapé com informações de Status/Vencimento */}
                    <Text style={styles.expenseStatusFooter}>{getStatusText(item)}</Text>
                  </View>

                  {/* Valor da despesa formatado */}
                  <Text style={[styles.debitValue, styles.valueColumn]}>
                    {`${String(item.value.toFixed(2)).replace('.', ',')} R$`}
                  </Text>
                </TouchableOpacity>
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
   * Handler para quando a FlatList termina de rolar.
   * Calcula o novo índice do mês atualmente visível e atualiza o estado `currentMonthIndex`.
   * @param {object} event - O objeto de evento nativo da rolagem.
   */
  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / width); // Calcula o índice baseado na largura da tela
    if (newIndex !== currentMonthIndex) {
      setCurrentMonthIndex(newIndex);
    }
  };

  /**
   * Handler para confirmar a limpeza de dados.
   * Realiza a ação de limpeza com base na opção selecionada no modal (limpeza geral ou por mês).
   */
  const handleConfirmClearData = async () => {
    // Se a opção for limpar dados de um mês específico, abre o picker de mês/ano
    if (selectedClearOption === '0') {
      setPickerMonth(String(currentDisplayedMonthDate.getMonth() + 1).padStart(2, '0'));
      setPickerYear(String(currentDisplayedMonthDate.getFullYear()));

      setIsClearDataModalVisible(false); // Fecha o modal de opções
      setIsMonthYearYearPickerVisible(true); // Abre o modal de seleção de mês/ano
      return;
    }

    setIsClearDataModalVisible(false);
    setLoadingApp(true); // Inicia o indicador de carregamento
    
    // Captura o mês atual antes da ação de limpeza, caso a limpeza afete o mês atualmente exibido
    const monthBeforeAction = currentDisplayedMonthDate;
    const targetMonth = monthBeforeAction.getMonth();
    const targetYear = monthBeforeAction.getFullYear();
    
    console.log(`[DEBUG - Limpeza]: Tentando limpar dados (opção ${selectedClearOption}) para ${getMonthName(monthBeforeAction)}/${targetYear}`);

    try {
      // Executa a ação de limpeza com base na opção selecionada
      switch (selectedClearOption) {
        case '1': // Limpar todas as receitas
          await AsyncStorage.removeItem(ASYNC_STORAGE_KEYS.INCOMES);
          Alert.alert('Sucesso', 'Todas as receitas foram limpas permanentemente.');
          break;
        case '2': // Limpar todas as despesas
          await AsyncStorage.removeItem(ASYNC_STORAGE_KEYS.EXPENSES);
          Alert.alert('Sucesso', 'Todas as despesas foram limpas permanentemente.');
          break;
        case '3': // Limpar todos os cartões
          await AsyncStorage.removeItem(ASYNC_STORAGE_KEYS.CARDS);
          Alert.alert('Sucesso', 'Todos os cartões foram limpos permanentemente.');
          break;
        case '4': // Limpar TODOS os dados
        default:
          await AsyncStorage.clear();
          Alert.alert('Sucesso', 'TODOS os dados foram apagados permanentemente e recarregados.');
          break;
      }
      await loadData(); // Recarrega todos os dados para refletir as alterações
      
    } catch (error) {
      console.error("HomeScreen: Erro ao limpar dados:", error);
      Alert.alert('Erro', `Ocorreu um erro ao limpar os dados: ${error.message}`);
    } finally {
      setLoadingApp(false); // Finaliza o indicador de carregamento
    }
  };

  /**
   * Realiza a limpeza suave de dados para um mês e ano específicos selecionados pelo usuário.
   * Marca receitas e despesas como inativas ou as adiciona a uma lista de meses excluídos.
   */
  const performMonthYearClear = async () => {
    setIsMonthYearYearPickerVisible(false);
    setLoadingApp(true);

    const monthToClear = parseInt(pickerMonth, 10) - 1; // Mês é 0-indexado em JS
    const yearToClear = parseInt(pickerYear, 10);
    const targetDateToClear = new Date(yearToClear, monthToClear, 1);
    const targetMonthYearString = formatMonthYearForExclusion(targetDateToClear);

    console.log(`[DEBUG - Limpeza]: Limpando dados para ${getMonthName(targetDateToClear)}/${yearToClear} (selecionado pelo usuário)`);

    // Define o último dia do mês alvo para usar como `deletedAt` para itens não-fixos
    const lastDayOfTargetMonth = new Date(yearToClear, monthToClear + 1, 0); 

    try {
      // --- Atualiza as receitas ---
      const updatedIncomes = allIncomes.map(income => {
        // Para receitas fixas, adiciona o mês atual à lista de `excludedMonths`
        if (income.type === 'Fixo') {
          const newExcludedMonths = income.excludedMonths ? [...income.excludedMonths, targetMonthYearString] : [targetMonthYearString];
          return { ...income, excludedMonths: Array.from(new Set(newExcludedMonths)) };
        }
        // Para receitas de ganho que correspondem ao mês/ano, marca como inativa
        else if (income.type === 'Ganho' && 
                   income.month === monthToClear &&
                   income.year === yearToClear &&
                   income.status !== 'inactive') {
          return { ...income, status: 'inactive', deletedAt: lastDayOfTargetMonth.toISOString() };
        }
        return income;
      });
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.INCOMES, JSON.stringify(updatedIncomes));

      // --- Atualiza as despesas ---
      const updatedExpenses = allExpenses.map(expense => {
        // Para despesas fixas, adiciona o mês atual à lista de `excludedMonths`
        if (expense.paymentMethod === 'Fixa') {
          const newExcludedMonths = expense.excludedMonths ? [...expense.excludedMonths, targetMonthYearString] : [targetMonthYearString];
          return { ...expense, excludedMonths: Array.from(new Set(newExcludedMonths)) };
        }
        // Para despesas de débito/crédito que vencem no mês/ano, marca como inativa
        else if (expense.paymentMethod === 'Débito' || expense.paymentMethod === 'Crédito') {
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
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(updatedExpenses)); // Persiste as despesas atualizadas

      Alert.alert('Sucesso', `Dados do mês ${getMonthName(targetDateToClear)}/${yearToClear} marcados como inativos.`);
      await loadData(); // Recarrega os dados da Home Screen para refletir as mudanças
      
    } catch (error) {
      console.error("HomeScreen: Erro ao limpar dados do mês selecionado:", error);
      Alert.alert('Erro', `Não foi possível limpar os dados do mês selecionado: ${error.message}`);
    } finally {
      setLoadingApp(false); // Finaliza o indicador de carregamento
    }
  };

  /** Abre o modal de opções de limpeza de dados. */
  const clearAllData = () => {
    setIsClearDataModalVisible(true);
  };

  // Exibe um indicador de carregamento enquanto o app está carregando dados
  if (loadingApp) {
    return (
      <View style={commonStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Carregando dados de finanças locais...</Text>
      </View>
    );
  }

  // Opções para o Picker do modal de limpeza de dados (predefinidas)
  const clearOptions = [
    { label: "Limpar dados de um mês específico (exclusão suave)", value: "0" },
    { label: "Limpar todas as receitas (permanente)", value: "1" },
    { label: "Limpar todas as despesas (permanente)", value: "2" },
    { label: "Limpar todos os cartões (permanente)", value: "3" },
    { label: "Limpar TODOS os dados (permanente)", value: "4" },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topButtonsContainer}>
        <TouchableOpacity onPress={clearAllData} style={styles.clearDataButton}>
          <Text style={styles.clearDataButtonText}>Limpar Dados (Teste)</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleGenerateRandomExpenses} style={styles.generateRandomButton}>
          <Text style={styles.generateRandomButtonText}>Gerar Despesas Aleatórias</Text>
        </TouchableOpacity>
      </View>

      {/* FlatList horizontal para exibir os meses paginados */}
      <FlatList
        ref={flatListRef}
        data={filteredMonthsToDisplay}
        renderItem={renderMonthSection}
        keyExtractor={item => String(item.toISOString())}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll} // Acionado ao final da rolagem para atualizar o mês
        initialScrollIndex={currentMonthIndex} // Define o mês inicial na montagem
        extraData={currentMonthIndex} // Força re-renderização quando o índice do mês visível muda
        getItemLayout={(data, index) => ({ // Otimização para performance da FlatList
          length: width, // Cada item ocupa a largura total da tela
          offset: width * index,
          index,
        })}
      />

      {/* Container de resumo financeiro do mês atual */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Receita total:</Text>
          <Text style={styles.summaryValue}>
            {String(currentMonthTotalIncome.toFixed(2)).replace('.', ',') + ' R$'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Valor final:</Text>
          {/* Altera a cor do valor final com base se é positivo ou negativo */}
          <Text style={[styles.summaryValue, valorFinalDisplayedMonth < 0 ? styles.negativeValue : styles.positiveValue]}>
            {String(valorFinalDisplayedMonth.toFixed(2)).replace('.', ',') + ' R$'}
          </Text>
        </View>
      </View>

      {/* Modal para opções de limpeza de dados */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isClearDataModalVisible}
        onRequestClose={() => {
          setIsClearDataModalVisible(false);
          setSelectedClearOption('4'); // Reseta a opção selecionada ao fechar
        }}
      >
        <Pressable
          style={commonStyles.centeredView}
          onPressOut={() => {
            setIsClearDataModalVisible(false);
            setSelectedClearOption('4');
          }}
        >
          <Pressable style={[commonStyles.modalView, { zIndex: 100 }]} onPress={(e) => e.stopPropagation()}>
            <Text style={commonStyles.modalTitle}>Opções de Limpeza de Dados</Text>

            <View style={styles.clearOptionsContainer}>
              {clearOptions.map((option) => (
                <TouchableOpacity
                  key={String(option.value)}
                  style={[
                    commonStyles.optionButton,
                    selectedClearOption === option.value && commonStyles.optionButtonSelected
                  ].filter(Boolean)}
                  onPress={() => setSelectedClearOption(String(option.value))}
                >
                  <Text style={[ 
                    commonStyles.optionButtonText,
                    selectedClearOption === option.value && commonStyles.optionButtonTextSelected
                  ].filter(Boolean)}>
                    {String(option.label)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={commonStyles.modalActionButtonsContainer}>
              <TouchableOpacity
                style={[commonStyles.modalButton, commonStyles.buttonEdit]}
                onPress={handleConfirmClearData}
              >
                <Text style={commonStyles.buttonTextStyle}>Confirmar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[commonStyles.modalButton, commonStyles.buttonClose]}
                onPress={() => {
                  setIsClearDataModalVisible(false);
                  setSelectedClearOption('4');
                }}
              >
                <Text style={commonStyles.buttonTextStyle}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal para seleção de Mês/Ano para limpeza suave */}
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
              <View style={commonStyles.halfPickerContainer}>
                <Text style={commonStyles.pickerLabel}>Mês:</Text>
                <Picker
                  selectedValue={pickerMonth}
                  onValueChange={(itemValue) => setPickerMonth(String(itemValue))}
                  style={commonStyles.picker}
                >
                  {pickerMonthOptions.map(month => {
                    const dateForMonth = new Date(initialMonthDate.getFullYear(), parseInt(month, 10) - 1, 1);
                    return (
                      <Picker.Item 
                        key={String(month)} 
                        label={String(getMonthName(dateForMonth))}
                        value={String(month)}
                      />
                    );
                  })}
                </Picker>
              </View>

              <View style={commonStyles.halfPickerContainer}>
                <Text style={commonStyles.pickerLabel}>Ano:</Text>
                <Picker
                  selectedValue={pickerYear}
                  onValueChange={(itemValue) => setPickerYear(String(itemValue))}
                  style={commonStyles.picker}
                >
                  {pickerYearOptions.map(year => (
                    <Picker.Item 
                      key={String(year)} 
                      label={String(year)}
                      value={String(year)}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={commonStyles.modalActionButtonsContainer}>
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

const styles = StyleSheet.create({
  container: {
    ...commonStyles.container,
  },
  monthPage: {
    width: width,
    ...commonStyles.scrollContent,
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
    flex: 1,
    marginRight: 10,
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
    flex: 1,
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
    backgroundColor: '#e0f7fa',
    borderColor: '#00bcd4',
    borderWidth: 2,
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
  // Estilo para a coluna da descrição no cabeçalho, ajustado para flexibilidade
  descriptionColumnAdjusted: {
    flex: 3, 
    textAlign: 'left',
  },
  expensesScrollView: {
    flex: 1,
  },
  // Estilo da linha de item de despesa, ajustado para maior espaçamento e área de toque
  debitItemRowAdjusted: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15, // Aumentado para mais "respiro" entre os itens
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingHorizontal: 5,
  },
  // Container para agrupar descrição e rodapé de status
  descriptionAndFooterContainer: {
    flex: 3, // Ocupa o espaço que a descrição e o rodapé precisam
    justifyContent: 'center',
  },
  debitText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 2, // Pequena margem para separar da informação de status
  },
  // Estilo para o rodapé de status/vencimento (fonte menor e cor mais suave)
  expenseStatusFooter: {
    fontSize: 12, // Fonte menor para o rodapé
    color: '#666', // Cor mais suave
  },
  debitValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  // Estilo para a coluna do checkbox no cabeçalho (largura fixa)
  checkboxHeaderColumn: {
    width: 30, 
  },
  // Estilo para o container do checkbox (espaçamento e centralização)
  checkboxContainerAdjusted: {
    paddingRight: 15, // Aumentado o espaçamento entre checkbox e descrição
    width: 45, // Garante que o checkbox e o espaçamento ocupem uma largura definida
    alignItems: 'center', // Centraliza o ícone dentro do espaço
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

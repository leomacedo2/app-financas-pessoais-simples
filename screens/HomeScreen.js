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
import { useAppContext } from '../AppContext';
import { View, Text, StyleSheet, FlatList, Dimensions, ActivityIndicator, Alert, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScrollOptimizer } from '../utils/useScrollOptimizer';
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
  try {
    if (!date || !(date instanceof Date)) {
      return 'Mês Inválido';
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return 'Mês Inválido';
    }
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const month = d.getMonth();
    if (month >= 0 && month < monthNames.length) {
      return monthNames[month];
    }
    return 'Mês Desconhecido'; // Fallback
  } catch (error) {
    console.warn('Erro ao obter nome do mês:', error);
    return 'Mês Inválido';
  }
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
const generateMonthsToDisplay = async () => {
  let storedExpenses = [];
  try {
    const expensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
    if (expensesJson) {
      const allExpenses = JSON.parse(expensesJson);
      // Filtra apenas despesas não deletadas e ativas
      storedExpenses = allExpenses.filter(expense => {
        const isDeleted = expense.deletedAt || expense.status === 'inactive';
        return !isDeleted;
      });
    }
  } catch (error) {
    console.error('Erro ao carregar despesas:', error);
    return [new Date()];
  }

  const today = new Date();
  // Armazenamos meses como chaves "YYYY-M" (mês 0-indexado) para evitar chamadas a toISOString()
  const monthsToShow = new Set();

  // Primeiro passo: Encontrar a data mais antiga e mais futura entre todas as despesas ativas
  let earliestDate = new Date(today);
  let latestDate = new Date(today);

  // Como já filtramos as despesas inativas/deletadas anteriormente, 
  // aqui só processamos as que estão em storedExpenses
  storedExpenses.forEach(expense => {
    if (expense.paymentMethod === 'Crédito' && expense.dueDate) {
      const dueDate = new Date(expense.dueDate);
      const purchaseDate = new Date(expense.purchaseDate);
      if (purchaseDate < earliestDate) earliestDate = new Date(purchaseDate);
      if (dueDate > latestDate) latestDate = new Date(dueDate);
    } else if (expense.paymentMethod === 'Débito' && expense.purchaseDate) {
      const purchaseDate = new Date(expense.purchaseDate);
      if (purchaseDate < earliestDate) earliestDate = new Date(purchaseDate);
      if (purchaseDate > latestDate) latestDate = new Date(purchaseDate);
    }
  });

  // Calcula o período máximo baseado na diferença entre a data mais futura e hoje
  const monthsDiff = (latestDate.getFullYear() - today.getFullYear()) * 12 
                  + (latestDate.getMonth() - today.getMonth());
  let maxFutureMonths = Math.max(12, monthsDiff + 1);

  // Primeiro, processa despesas de crédito (parceladas)
  storedExpenses.forEach(expense => {
    if (expense.paymentMethod === 'Crédito' && expense.dueDate) {
      const dueDate = new Date(expense.dueDate);
      const purchaseDate = new Date(expense.purchaseDate);
      let currentDate = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);
      // safety guard para evitar loops infinitos
      let safety = 0;
      while (currentDate <= dueDate && safety < 120) {
        monthsToShow.add(`${currentDate.getFullYear()}-${currentDate.getMonth()}`);
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        safety++;
      }
    }
  });

  // Depois processamos as despesas fixas
  const absoluteMaxMonths = 99;
  const effectiveMaxMonths = Math.min(maxFutureMonths, absoluteMaxMonths);

  storedExpenses.forEach(expense => {
    if (expense.paymentMethod === 'Fixa') {
      let currentDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
      let endDate = new Date(today.getFullYear(), today.getMonth() + effectiveMaxMonths, 1);
      let safety = 0;
      while (currentDate <= endDate && safety < 120) {
        monthsToShow.add(`${currentDate.getFullYear()}-${currentDate.getMonth()}`);
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        safety++;
      }
    }
  });

  // Por fim, processamos as despesas de débito
  storedExpenses.forEach(expense => {
    if (expense.paymentMethod === 'Débito' && expense.purchaseDate) {
      const purchaseDate = new Date(expense.purchaseDate);
      const monthDate = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);
      monthsToShow.add(`${monthDate.getFullYear()}-${monthDate.getMonth()}`);
    }
  });

  // Sempre garante que o mês atual está incluído
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  monthsToShow.add(`${currentMonth.getFullYear()}-${currentMonth.getMonth()}`);

  // Converte todas as chaves de volta para objetos Date e ordena
  const converted = Array.from(monthsToShow).map(key => {
    try {
      const parts = String(key).split('-');
      if (parts.length !== 2) return null;
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
      // limite razoável para mês (avoid obviously wrong values)
      if (Math.abs(m) > 1200) return null;
      // Validação adicional: mês deve estar entre 0-11 e ano entre 1900-2100
      if (m < 0 || m > 11) return null;
      if (y < 1900 || y > 2100) return null;
      const d = new Date(y, m, 1);
      if (isNaN(d.getTime())) return null;
      // Verifica se a data criada corresponde aos valores esperados
      if (d.getFullYear() !== y || d.getMonth() !== m) return null;
      return d;
    } catch (e) {
      console.warn('Erro ao converter chave para Date:', key, e);
      return null;
    }
  });

  const invalidCount = converted.filter(c => c === null).length;
  if (invalidCount > 0) {
    console.warn(`generateMonthsToDisplay: ignored ${invalidCount} invalid month keys`);
  }

  const sortedMonths = converted
    .filter(Boolean)
    .sort((a, b) => a - b);

  // Se não houver nenhum mês com despesas, gera um período de 25 meses
  if (sortedMonths.length === 0) {
    const mesesPadrao = [];
    // Gera 12 meses para trás e 12 para frente
    for (let i = -12; i <= 12; i++) {
      mesesPadrao.push(new Date(today.getFullYear(), today.getMonth() + i, 1));
    }
    return mesesPadrao.sort((a, b) => a - b);
  }

  return sortedMonths;
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

  // Debug logs removed to improve performance in production

  if (!Array.isArray(monthsToConsider)) {
    console.error("generateRandomExpensesData: monthsToConsider não é um array válido.");
    return [];
  }

  // Define limites para o número de despesas por mês
  const minDespesasPorMes = 3;  // Mínimo de despesas por mês
  const maxDespesasPorMes = 8;  // Máximo de despesas por mês
  
  // meses disponíveis (debug omitted)
  
  // Usa todos os meses disponíveis para geração de despesas
  const mesesParaGerar = [...monthsToConsider].sort((a, b) => a.getTime() - b.getTime());
  
  // meses para gerar (debug omitted)
  
  // Para cada mês disponível, gera algumas despesas
  mesesParaGerar.forEach((monthDate, monthIndex) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    
    // Gera um número aleatório de despesas para este mês
    const numDespesasDesteMes = Math.floor(
      Math.random() * (maxDespesasPorMes - minDespesasPorMes + 1) + minDespesasPorMes
    );
    
  // geração de despesas para o mês (debug omitted)
    
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
        createdAt: createdAtDate.toISOString(), // Timestamp de criação do registro
        purchaseDate: createdAtDate.toISOString(), // Data da compra
        dueDate: createdAtDate.toISOString(), // Para débito, a data de vencimento é igual à data de compra
        status: isPaidRandom ? 'paid' : 'pending',
        paidAt: isPaidRandom ? new Date().toISOString() : null,
        paymentMethod: 'Débito',
        deletedAt: null
      };

  // despesa gerada (omitted)
      generatedExpenses.push(expense);
    }
  });

  // total de despesas geradas (omitted)

  return generatedExpenses.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets(); // Hook para obter os insets da área segura da tela
  const { mostrarBotoesTeste } = useAppContext(); // Obtém o estado do modo de desenvolvedor do contexto

  // Estado para controlar o carregamento inicial da aplicação
  const [loadingApp, setLoadingApp] = useState(true);
  // Estado para armazenar todas as receitas carregadas
  const [allIncomes, setAllIncomes] = useState([]);
  // Estado para armazenar todas as despesas carregadas
  const [allExpenses, setAllExpenses] = useState([]);
  
  // Estados para controlar a ordenação das despesas
  const [activeFilter, setActiveFilter] = useState('date'); // Começa ordenando por data
  const [filterOrder, setFilterOrder] = useState('asc'); // Começa em ordem ascendente

  // Handler para o filtro alfabético
  const handleToggleAlphaOrder = useCallback(() => {
    if (activeFilter === 'alpha') {
      // Se já está ordenando alfabeticamente, apenas inverte a ordem
      setFilterOrder(current => {
        return current === 'asc' ? 'desc' : 'asc';
      });
    } else {
      // Se não está ordenando alfabeticamente, ativa o filtro alfabético sempre com ordem ascendente
      setActiveFilter('alpha');
      setFilterOrder('asc'); // Sempre começa ascendente (A->Z) para ordem alfabética
    }
  }, [activeFilter]);

  // Estados para controlar a visibilidade e seleção do modal de limpeza de dados
  const [isClearDataModalVisible, setIsClearDataModalVisible] = useState(false);
  const [selectedClearOption, setSelectedClearOption] = useState('4'); // Opção padrão: limpar todos os dados

  // Estados para controlar a visibilidade e seleção do picker de mês/ano no modal de limpeza específica
  const [isMonthYearPickerVisible, setIsMonthYearYearPickerVisible] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [pickerYear, setPickerYear] = useState(String(new Date().getFullYear()));

  // Estado para armazenar a lista de meses (inicializado com o mês atual)
  const today = new Date();
  const initialMonthDate = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), []);
  const [monthsToDisplay, setMonthsToDisplay] = useState([initialMonthDate]);

  // useEffect para o carregamento inicial e atualizações
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingApp(true);
        console.log('=== Carregando dados iniciais e atualizando meses ===');
        
        // Carrega as despesas
        const storedExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
        const currentExpenses = storedExpensesJson ? JSON.parse(storedExpensesJson) : [];
        setAllExpenses(currentExpenses);
        
        // Carrega as receitas
        const storedIncomesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.INCOMES);
        const currentIncomes = storedIncomesJson ? JSON.parse(storedIncomesJson) : [];
        setAllIncomes(currentIncomes);
        
        // Gera os meses com base nas despesas carregadas
        const months = await generateMonthsToDisplay();
        setMonthsToDisplay(months);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoadingApp(false);
      }
    };
    
    loadData();
  }, []); // Executa apenas na montagem inicial do componente

  // useEffect para atualizar os meses quando houver mudanças nas despesas ou receitas
  useEffect(() => {
    const updateMonths = async () => {
      if (!loadingApp) { // Evita executar durante o carregamento inicial
        console.log('=== Atualizando meses devido a mudanças em despesas/receitas ===');
        const months = await generateMonthsToDisplay();
        setMonthsToDisplay(months);
      }
    };
    updateMonths();
  }, [allExpenses, allIncomes, loadingApp]);

  // Estado para o índice do mês atualmente visível na FlatList
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  // Referência para a FlatList, usada para controle de rolagem programática
  const flatListRef = useRef(null);

  // Referência para controlar se uma tentativa de rolagem já foi feita (evita múltiplos scrolls)
  const scrollAttempted = useRef(false);

  // Referências para manter as posições de scroll por mês (chave: "YYYY-MM")
  const scrollPositionsRef = useRef({});
  
  // Referências para os ScrollViews de cada mês (chave: "YYYY-MM")
  const scrollViewRefsRef = useRef({});

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
      // Primeiro verifica se o item está deletado ou inativo
      if (item.deletedAt || (onlyActive && item.status === 'inactive')) {
        console.log(`Ignorando despesa ${item.id} pois está deletada ou inativa`);
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
   * Função auxiliar para validar se uma data é válida
   * @param {Date} date - A data a ser validada
   * @returns {boolean} true se a data é válida, false caso contrário
   */
  const isValidDate = (date) => {
    if (!date || !(date instanceof Date)) return false;
    if (isNaN(date.getTime())) return false;
    // Verifica se a data está em um range razoável (entre 1900 e 2100)
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) return false;
    return true;
  };

  /**
   * `useMemo` para filtrar os meses a serem exibidos na FlatList horizontal.
   * Garante que apenas meses com receitas ou despesas ativas, ou o mês atual do sistema, sejam mostrados.
   * Recomputa apenas quando `monthsToDisplay`, `initialMonthDate`, `allExpenses` ou `allIncomes` mudam.
   */
  const filteredMonthsToDisplay = useMemo(() => {
    // Use o estado monthsToDisplay diretamente
    if (!monthsToDisplay || monthsToDisplay.length === 0) {
      return [initialMonthDate];
    }
    
    // Filtra datas inválidas primeiro
    const validMonths = monthsToDisplay.filter(monthDate => isValidDate(monthDate));
    
    if (validMonths.length === 0) {
      console.warn('Nenhum mês válido encontrado, usando mês atual como fallback');
      return [initialMonthDate];
    }
    
    const todayMonth = initialMonthDate.getMonth();
    const todayYear = initialMonthDate.getFullYear();

    // Se não houver despesas ou receitas ativas, mostra todos os meses disponíveis
    const hasAnyActiveExpenses = allExpenses.some(exp => !exp.deletedAt && exp.status !== 'inactive');
    const hasAnyActiveIncomes = allIncomes.some(inc => !inc.deletedAt && inc.status !== 'inactive');

    if (!hasAnyActiveExpenses && !hasAnyActiveIncomes) {
      console.log('Nenhuma movimentação encontrada, mostrando todos os meses disponíveis');
      return validMonths.sort((a, b) => a.getTime() - b.getTime());
    }

    // Se houver movimentações, filtra os meses que têm algo
    const filtered = validMonths.filter(monthDate => {
      if (!isValidDate(monthDate)) return false;
      
      const isCurrentSystemMonth = monthDate.getMonth() === todayMonth && monthDate.getFullYear() === todayYear;
      
      const activeExpensesForMonth = getExpensesForMonth(monthDate, allExpenses, true);
      const hasActiveExpenses = activeExpensesForMonth.length > 0;
      
      const activeIncomesForMonth = getIncomesForMonth(monthDate, allIncomes, true);
      const hasActiveIncomes = activeIncomesForMonth.length > 0;

      return isCurrentSystemMonth || hasActiveExpenses || hasActiveIncomes;
    });

    // Garante que o mês atual do sistema esteja sempre incluído
    const isTodayMonthIncluded = filtered.some(monthDate =>
      isValidDate(monthDate) &&
      monthDate.getMonth() === todayMonth && monthDate.getFullYear() === todayYear
    );
    if (!isTodayMonthIncluded) {
      filtered.push(initialMonthDate);
    }

    // Ordena os meses cronologicamente e filtra novamente para garantir que todas as datas são válidas
    const finalFiltered = filtered
      .filter(monthDate => isValidDate(monthDate))
      .sort((a, b) => a.getTime() - b.getTime());

    // Log para debug
    if (finalFiltered.length === 0) {
      console.warn('filteredMonthsToDisplay: Nenhum mês válido após filtragem, usando mês atual');
      return [initialMonthDate];
    }

    // Valida cada data uma última vez antes de retornar
    const validated = finalFiltered.filter(monthDate => {
      try {
        if (!isValidDate(monthDate)) return false;
        // Testa se os métodos básicos funcionam
        const testYear = monthDate.getFullYear();
        const testMonth = monthDate.getMonth();
        if (!Number.isFinite(testYear) || !Number.isFinite(testMonth)) return false;
        if (testYear < 1900 || testYear > 2100) return false;
        if (testMonth < 0 || testMonth > 11) return false;
        return true;
      } catch (error) {
        console.warn('filteredMonthsToDisplay: Erro ao validar data:', error);
        return false;
      }
    });

    if (validated.length === 0) {
      console.warn('filteredMonthsToDisplay: Nenhum mês válido após validação final, usando mês atual');
      return [initialMonthDate];
    }

    return validated;

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
      const tempFilteredMonths = monthsToDisplay.filter(monthDate => {
        const activeExpensesForMonth = getExpensesForMonth(monthDate, currentExpenses, true);
        const hasActiveExpenses = activeExpensesForMonth.length > 0;
        return hasActiveExpenses;
      });
      
      // Se não houver nenhum mês com despesas ativas, mostra apenas o mês atual
      if (tempFilteredMonths.length === 0) {
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
  }, [initialMonthDate, getExpensesForMonth, getIncomesForMonth]); // Depende dessas funções/variáveis

  /**
   * Função para gerar despesas aleatórias para fins de teste e demonstração.
   * Adiciona essas despesas às existentes no AsyncStorage.
   * É um `useCallback` para evitar recriações desnecessárias.
   */
  const handleGenerateRandomExpenses = useCallback(async () => {
    setLoadingApp(true);
    try {
      // Gera despesas apenas para o mês atual e 12 meses futuros
      const today = new Date();
      const mesesParaGerar = [];
      
      // Adiciona mês atual e 12 meses para frente
      for (let i = 0; i <= 12; i++) {
        const data = new Date(today.getFullYear(), today.getMonth() + i, 1);
        mesesParaGerar.push(data);
      }

      console.log("[DEBUG] Iniciando geração de despesas aleatórias");
      console.log("[DEBUG] Meses para gerar:", mesesParaGerar.map(d => `${d.getMonth() + 1}/${d.getFullYear()}`));
      
      const generated = generateRandomExpensesData(mesesParaGerar);
      console.log("[DEBUG] Despesas geradas:", generated);

      const storedExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      const existingExpenses = storedExpensesJson ? JSON.parse(storedExpensesJson) : [];
      console.log("[DEBUG] Despesas existentes:", existingExpenses);
      
      const combinedExpenses = [...existingExpenses, ...generated]; // Combina as despesas
      console.log("[DEBUG] Total de despesas após combinação:", combinedExpenses.length);

      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(combinedExpenses));
      console.log("[DEBUG] Despesas salvas no AsyncStorage");

      // Primeiro atualiza as despesas no estado
      setAllExpenses(combinedExpenses);
      console.log("[DEBUG] Estado de allExpenses atualizado");

      // Força a atualização da lista de meses
      const newMonths = await generateMonthsToDisplay();
      setMonthsToDisplay(newMonths);
      console.log("[DEBUG] Lista de meses atualizada:", newMonths.map(d => `${d.getMonth() + 1}/${d.getFullYear()}`));

      Alert.alert('Sucesso', `${generated.length} despesas aleatórias geradas e adicionadas!`);
    } catch (error) {
      console.error("HomeScreen: Erro ao gerar despesas aleatórias:", error);
      Alert.alert('Erro', `Não foi possível gerar despesas aleatórias: ${error.message}`);
    } finally {
      setLoadingApp(false);
    }
  }, [loadData]); // Depende apenas de loadData

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
    // Reseta a tentativa de rolagem quando a lista de meses muda
    if (filteredMonthsToDisplay.length !== currentMonthIndex + 1) {
      scrollAttempted.current = false;
    }

    // Só tenta rolar se o app não estiver carregando e houver meses para exibir
    if (!loadingApp && filteredMonthsToDisplay.length > 0) {
      // Garante que o índice está sempre dentro dos bounds válidos
      const safeIndex = Math.max(0, Math.min(
        currentMonthIndex,
        filteredMonthsToDisplay.length - 1
      ));

      // Se o índice atual está fora do range, ajusta para um valor válido
      if (currentMonthIndex !== safeIndex) {
        setCurrentMonthIndex(safeIndex);
      }

      if (flatListRef.current && !scrollAttempted.current && safeIndex >= 0 && safeIndex < filteredMonthsToDisplay.length) {
        setTimeout(() => {
          if (flatListRef.current && filteredMonthsToDisplay.length > 0) {
            try {
              const finalIndex = Math.max(0, Math.min(safeIndex, filteredMonthsToDisplay.length - 1));
              flatListRef.current.scrollToIndex({ 
                index: finalIndex, 
                animated: false 
              });
              scrollAttempted.current = true;
              console.log(`[DEBUG - Scroll useEffect]: Ajustando para índice seguro: ${finalIndex}`);
            } catch (error) {
              console.warn('[DEBUG - Scroll useEffect]: Erro ao rolar:', error);
              // Fallback: usa scrollToOffset se scrollToIndex falhar
              try {
                flatListRef.current.scrollToOffset({ 
                  offset: safeIndex * width, 
                  animated: false 
                });
                scrollAttempted.current = true;
              } catch (fallbackError) {
                console.warn('[DEBUG - Scroll useEffect]: Erro no fallback de scroll:', fallbackError);
              }
            }
          }
        }, 100);
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
  const currentMonthTotalExpense = currentDisplayedMonthExpenses.reduce((sum, item) => sum + item.value, 0);

  // Calcula o valor final (Receita Total - Despesa Total) para o mês atualmente exibido
  const valorFinalDisplayedMonth = currentMonthTotalIncome - currentMonthTotalExpense;

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
      console.warn(`[DEBUG - handleTogglePaidStatus]: Despesa com ID ${expenseId} não encontrada no array de despesas.`);
      console.warn(`[DEBUG - handleTogglePaidStatus]: ID Base: ${baseId}, Sufixos: ${suffixes.join(', ')}`);
      return;
    }

    console.log(`[DEBUG - handleTogglePaidStatus]: Despesa encontrada:`, {
      tipo: originalExpense.paymentMethod,
      id: expenseId,
      baseId,
      descricao: originalExpense.description,
      status: originalExpense.status,
      valor: originalExpense.value
    });

    if (expenseIndex === -1) {
      console.warn(`[DEBUG - handleTogglePaidStatus]: Índice da despesa não encontrado para ID ${expenseId}`);
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
      console.log(`[DEBUG - handleTogglePaidStatus]: Atualizando parcela de crédito:`, {
        parcela: expenseToUpdate.installmentNumber,
        total: expenseToUpdate.totalInstallments,
        novoStatus: expenseToUpdate.status,
        valor: expenseToUpdate.value,
        pago: expenseToUpdate.paidAt ? 'Sim' : 'Não'
      });
    }
    // Para despesas normais (débito)
    else {
      // Alterna o status e a data de pagamento
      const statusAnterior = expenseToUpdate.status;
      if (expenseToUpdate.status === 'pending') {
        expenseToUpdate.status = 'paid';
        expenseToUpdate.paidAt = new Date().toISOString();
      } else {
        expenseToUpdate.status = 'pending';
        expenseToUpdate.paidAt = null;
      }
      console.log(`[DEBUG - handleTogglePaidStatus]: Atualizando despesa de ${expenseToUpdate.paymentMethod}:`, {
        descricao: expenseToUpdate.description,
        statusAnterior,
        novoStatus: expenseToUpdate.status,
        valor: expenseToUpdate.value,
        data: expenseToUpdate.dueDate
      });
    }

    updatedExpenses[expenseIndex] = expenseToUpdate; // Atualiza a despesa no array
    setAllExpenses(updatedExpenses); // Atualiza o estado local com as despesas modificadas
    console.log('[DEBUG - handleTogglePaidStatus]: Estado local atualizado com sucesso');

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
   * Calcula a cor de fundo baseada no status e data de vencimento da despesa
   * @param {object} expense - O objeto de despesa
   * @returns {string} Código da cor em hexadecimal
   */
  const getExpenseBackgroundColor = (expense) => {
    // Se já está paga, retorna verde suave
    if (expense.status === 'paid') {
      return '#e8f5e9'; // Verde suave
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = parseDateString(formatDateForDisplay(new Date(expense.dueDate)));
    const diffDays = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

    // Se está atrasada
    if (diffDays < 0) {
      return '#ef9a9a'; // Vermelho médio para atrasadas - mais suave que antes, mas ainda destacado
    }

    // Se vence hoje
    if (diffDays === 0) {
      return '#ffcdd2'; // Vermelho médio (anterior das atrasadas)
    }

    // Se vence amanhã
    if (diffDays === 1) {
      return '#ffebee'; // Vermelho suave (anterior do "vence hoje")
    }

    // Se vence em até 4 dias
    if (diffDays <= 4) {
      return '#fff3e0'; // Laranja bem suave
    }

    // Se vence em até 8 dias
    if (diffDays <= 8) {
      return '#fff8e1'; // Amarelo suave
    }

    // Se vence em até 16 dias
    if (diffDays <= 16) {
      return '#fffde7'; // Amarelo mais suave ainda
    }

    // Se vence depois de 16 dias
    return '#ffffff'; // Branco
  };

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
  // Função para ordenar as despesas por data ou valor
  const sortExpenses = useCallback((expenses) => {
    if (!activeFilter) return expenses; // Se não há filtro ativo, retorna a lista original

    // ordenando despesas (debug logs removed)
    
    // Cria uma cópia do array para não modificar o original
    return [...expenses].sort((a, b) => {
      if (activeFilter === 'value') {
        const valueA = parseFloat(a.value) || 0;
        const valueB = parseFloat(b.value) || 0;
        
        // comparação de valores (omitted)
        
        return filterOrder === 'asc' ? valueA - valueB : valueB - valueA;
      } else if (activeFilter === 'alpha') {
        const descA = (a.description || '').toLowerCase().trim();
        const descB = (b.description || '').toLowerCase().trim();
        
        return filterOrder === 'asc' 
          ? descA.localeCompare(descB, 'pt-BR') 
          : descB.localeCompare(descA, 'pt-BR');
      } else { // date
        // Usa dueDate (data de vencimento) como prioridade, fallback para createdAt ou purchaseDate
        // Isso é consistente com a ordenação padrão em getExpensesForMonth
        const dateA = new Date(a.dueDate || a.createdAt || a.purchaseDate || 0);
        const dateB = new Date(b.dueDate || b.createdAt || b.purchaseDate || 0);
        
        // Valida as datas e trata casos inválidos
        const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
        const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
        
        // Se ambas as datas forem inválidas (time = 0), mantém a ordem original
        if (timeA === 0 && timeB === 0) return 0;
        // Se apenas uma for inválida, coloca no final
        if (timeA === 0) return 1;
        if (timeB === 0) return -1;
        
        return filterOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
    });
  }, [activeFilter, filterOrder]);

  // Handlers para alternar as ordens
  const handleToggleDataOrder = useCallback(() => {
    if (activeFilter === 'date') {
      // Se já está ordenando por data, apenas inverte a ordem
      setFilterOrder(current => {
        return current === 'asc' ? 'desc' : 'asc';
      });
    } else {
      // Se não está ordenando por data, ativa o filtro de data sempre com ordem ascendente
      setActiveFilter('date');
      setFilterOrder('asc'); // Sempre começa ascendente para datas
    }
  }, [activeFilter]);

  const handleToggleValueOrder = useCallback(() => {
    if (activeFilter === 'value') {
      // Se já está ordenando por valor, apenas inverte a ordem
      setFilterOrder(current => {
        return current === 'asc' ? 'desc' : 'asc';
      });
    } else {
      // Se não está ordenando por valor, ativa o filtro de valor sempre com ordem descendente
      setActiveFilter('value');
      setFilterOrder('desc'); // Sempre começa descendente para valores
    }
  }, [activeFilter]);

  const MonthSection = React.memo(({ monthDate, index }) => {
    // Cria uma ref para o ScrollView deste mês
    const scrollViewRef = useRef(null);
    
    // Gera a chave única para este mês (formato: "YYYY-MM")
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Registra a ref no objeto global quando o componente é montado
    useEffect(() => {
      scrollViewRefsRef.current[monthKey] = scrollViewRef;
      return () => {
        // Limpa a ref quando o componente é desmontado
        delete scrollViewRefsRef.current[monthKey];
        delete scrollPositionsRef.current[monthKey];
      };
    }, [monthKey]);
    
    // Restaura a posição do scroll após atualizações
    useEffect(() => {
      if (scrollViewRef.current && scrollPositionsRef.current[monthKey] !== undefined) {
        const savedPosition = scrollPositionsRef.current[monthKey];
        // Usa setTimeout para garantir que o DOM foi atualizado
        setTimeout(() => {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: savedPosition, animated: false });
          }
        }, 50);
      }
    }, [allExpenses, monthKey]); // Restaura quando allExpenses mudar
    
    // Valida a data antes de usar
    if (!monthDate || !(monthDate instanceof Date) || isNaN(monthDate.getTime())) {
      console.warn(`MonthSection: Data inválida no índice ${index}`, monthDate);
      return (
        <View style={styles.monthPage}>
          <View style={styles.section}>
            <Text style={styles.noExpensesText}>Erro ao carregar mês</Text>
          </View>
        </View>
      );
    }

    // Filtra as despesas ativas para o mês atual da seção
    const monthExpenses = getExpensesForMonth(monthDate, allExpenses, true);
  // Aplica a ordenação com base no filtro ativo
  const expenses = sortExpenses(monthExpenses);
    
    // Valida novamente antes de usar métodos da data
    let monthName, year;
    try {
      monthName = getMonthName(monthDate);
      year = monthDate.getFullYear();
      // Valida se o ano está em um range válido
      if (!Number.isFinite(year) || year < 1900 || year > 2100) {
        throw new Error('Ano fora do range válido');
      }
    } catch (error) {
      console.warn(`MonthSection: Erro ao processar data no índice ${index}:`, error);
      monthName = 'Mês Inválido';
      year = new Date().getFullYear();
    }

    // Verifica se a seção atual corresponde ao mês atual do sistema para aplicar destaque
    let isSystemCurrentMonth = false;
    try {
      isSystemCurrentMonth = monthDate.getMonth() === initialMonthDate.getMonth() &&
                             initialMonthDate.getFullYear() === year;
    } catch (error) {
      console.warn('MonthSection: Erro ao comparar datas:', error);
    }

    return (
      <View style={styles.monthPage}>
        <View style={styles.section}>
          {/* Título do mês com ícone quando for o mês atual */}
          <View style={[
            styles.monthTitleContainer,
            isSystemCurrentMonth && styles.currentMonthTitleContainer
          ]}>
            <Text style={isSystemCurrentMonth ? styles.currentMonthTitle : styles.regularMonthTitle}>
              {String(monthName)} {String(year)}
            </Text>
          </View>

          {/* Barra de Filtros */}
          <View style={styles.filtersBar}>
            <TouchableOpacity 
              style={[
                styles.filterItem,
                activeFilter === 'date' && styles.filterItemActive
              ]} 
              onPress={handleToggleDataOrder}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[
                styles.filterText,
                activeFilter === 'date' && styles.filterTextActive
              ]}>Data</Text>
              {activeFilter === 'date' && (
                <Ionicons 
                  name={filterOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
                  size={16} 
                  color="#1976d2"
                />
              )}
            </TouchableOpacity>
            
            <View style={styles.filterDivider} />

            <TouchableOpacity 
              style={[
                styles.filterItem,
                activeFilter === 'alpha' && styles.filterItemActive
              ]} 
              onPress={handleToggleAlphaOrder}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[
                styles.filterText,
                activeFilter === 'alpha' && styles.filterTextActive
              ]}>A-Z</Text>
              {activeFilter === 'alpha' && (
                <Ionicons 
                  name={filterOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
                  size={16} 
                  color="#1976d2"
                />
              )}
            </TouchableOpacity>
            
            <View style={styles.filterDivider} />
            
            <TouchableOpacity 
              style={[
                styles.filterItem,
                activeFilter === 'value' && styles.filterItemActive
              ]} 
              onPress={handleToggleValueOrder}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[
                styles.filterText,
                activeFilter === 'value' && styles.filterTextActive
              ]}>Valor</Text>
              {activeFilter === 'value' && (
                <Ionicons 
                  name={filterOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
                  size={16} 
                  color="#1976d2"
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Cabeçalho da tabela de despesas com colunas para checkbox, descrição e valor */}
          <View style={styles.tableHeader}>
            <View style={styles.checkboxHeaderColumn}></View> 
            <Text style={[styles.headerText, styles.descriptionColumnAdjusted]}>Despesa</Text>
            <Text style={[styles.headerText, styles.valueColumn]}>Valor</Text>
          </View>

          {expenses.length > 0 ? (
            // Exibe a lista de despesas em um ScrollView
            <ScrollView 
              ref={scrollViewRef}
              style={styles.expensesScrollView}
              onScroll={(event) => {
                // Salva a posição do scroll continuamente
                const scrollY = event.nativeEvent.contentOffset.y;
                scrollPositionsRef.current[monthKey] = scrollY;
              }}
              scrollEventThrottle={16}
            >
              {expenses.map((item) => (
                <TouchableOpacity 
                  key={String(item.id)} 
                  style={[
                    styles.debitItemRowAdjusted, // Estilo base
                    { backgroundColor: getExpenseBackgroundColor(item) } // Aplica cor condicional
                  ]}
                  onPress={() => handleTogglePaidStatus(item.id)} // Toque simples para alternar status
                  onLongPress={() => handleEditExpense(item)} // Toque longo para editar a despesa
                  activeOpacity={0.7} // Adiciona um feedback visual ao toque
                >
                  {/* Checkbox (não mais interativo) */}
                  <View style={styles.checkboxContainerAdjusted}>
                    <Ionicons
                      name={item.status === 'paid' ? 'checkbox' : 'square-outline'} 
                      size={24}
                      color={item.status === 'paid' ? '#28a745' : '#6c757d'} 
                    />
                  </View>

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
  });

  /**
   * Handler para quando a FlatList termina de rolar.
   * Calcula o novo índice do mês atualmente visível e atualiza o estado `currentMonthIndex`.
   * @param {object} event - O objeto de evento nativo da rolagem.
   */
    const { handleScroll, isCurrentlyScrolling } = useScrollOptimizer(width, useCallback((newIndex) => {
    if (newIndex !== currentMonthIndex) {
      setCurrentMonthIndex(newIndex);
    }
  }, [currentMonthIndex]));

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
      {mostrarBotoesTeste && (
      <View style={styles.topButtonsContainer}>
        <TouchableOpacity onPress={clearAllData} style={styles.clearDataButton}>
          <Text style={styles.clearDataButtonText}>Limpar Dados (Teste)</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleGenerateRandomExpenses} style={styles.generateRandomButton}>
          <Text style={styles.generateRandomButtonText}>Gerar Despesas Aleatórias</Text>
        </TouchableOpacity>
      </View>
    )}

      {/* FlatList horizontal para exibir os meses paginados */}
      {(() => {
        // LOG ÚNICO PARA CONFIRMAR VERSÃO - Se você ver isso, está testando a versão correta!
        console.log('🔵🔵🔵 VERSÃO COM LOGS MELHORADOS - TESTE ' + new Date().getTime() + ' 🔵🔵🔵');
        
        // Log de debug para verificar os dados antes de renderizar
        console.log('[DEBUG V2] filteredMonthsToDisplay antes de renderizar:', {
          length: filteredMonthsToDisplay.length,
          firstItem: filteredMonthsToDisplay[0],
          lastItem: filteredMonthsToDisplay[filteredMonthsToDisplay.length - 1],
          allValid: filteredMonthsToDisplay.every(d => {
            try {
              return d instanceof Date && !isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100;
            } catch {
              return false;
            }
          }),
          firstItemType: typeof filteredMonthsToDisplay[0],
          firstItemIsDate: filteredMonthsToDisplay[0] instanceof Date,
          firstItemGetTime: filteredMonthsToDisplay[0]?.getTime?.(),
          firstItemGetFullYear: filteredMonthsToDisplay[0]?.getFullYear?.(),
        });

        // Valida todos os itens antes de renderizar
        const validData = filteredMonthsToDisplay.filter((item, idx) => {
          try {
            if (!item || !(item instanceof Date)) {
              console.warn(`[DEBUG] Item ${idx} não é uma Date:`, item);
              return false;
            }
            if (isNaN(item.getTime())) {
              console.warn(`[DEBUG] Item ${idx} tem data inválida (NaN):`, item);
              return false;
            }
            const year = item.getFullYear();
            if (!Number.isFinite(year) || year < 1900 || year > 2100) {
              console.warn(`[DEBUG] Item ${idx} tem ano inválido:`, year);
              return false;
            }
            return true;
          } catch (error) {
            console.warn(`[DEBUG] Erro ao validar item ${idx}:`, error);
            return false;
          }
        });

        if (validData.length === 0) {
          console.error('[DEBUG] Nenhum item válido encontrado após validação!');
          return (
            <View style={styles.monthPage}>
              <View style={styles.section}>
                <Text style={styles.noExpensesText}>Erro: Nenhum mês válido encontrado</Text>
              </View>
            </View>
          );
        }

        if (validData.length !== filteredMonthsToDisplay.length) {
          console.warn(`[DEBUG] Filtrados ${filteredMonthsToDisplay.length - validData.length} itens inválidos`);
        }

        console.log('[DEBUG V2] Criando FlatList com validData.length:', validData.length);
        console.log('[DEBUG V2] Primeiro item validData:', {
          item: validData[0],
          type: typeof validData[0],
          isDate: validData[0] instanceof Date,
          getTime: validData[0]?.getTime?.(),
          getFullYear: validData[0]?.getFullYear?.(),
          getMonth: validData[0]?.getMonth?.(),
        });

        return (
          <FlatList
            ref={flatListRef}
            data={validData}
            renderItem={({ item: monthDate, index }) => {
              console.log(`[DEBUG V2] renderItem chamado para índice ${index}`);
              // Valida a data antes de renderizar
              if (!monthDate || !(monthDate instanceof Date) || isNaN(monthDate.getTime())) {
                console.warn(`[DEBUG V2] FlatList renderItem: Data inválida no índice ${index}`, monthDate);
                return (
                  <View style={[styles.monthPage, { width }]}>
                    <View style={styles.section}>
                      <Text style={styles.noExpensesText}>Erro ao carregar mês</Text>
                    </View>
                  </View>
                );
              }
              try {
                // Testa se os métodos básicos funcionam antes de renderizar
                const testYear = monthDate.getFullYear();
                const testMonth = monthDate.getMonth();
                if (!Number.isFinite(testYear) || !Number.isFinite(testMonth)) {
                  throw new Error('Ano ou mês não são números finitos');
                }
                console.log(`[DEBUG V2] Renderizando MonthSection para índice ${index}, ano: ${testYear}, mês: ${testMonth}`);
                return <MonthSection monthDate={monthDate} index={index} />;
              } catch (error) {
                console.error(`[DEBUG V2] Erro ao renderizar item ${index}:`, error);
                return (
                  <View style={[styles.monthPage, { width }]}>
                    <View style={styles.section}>
                      <Text style={styles.noExpensesText}>Erro: {error.message}</Text>
                    </View>
                  </View>
                );
              }
            }}
            keyExtractor={(item, index) => {
              console.log(`[DEBUG V2] keyExtractor chamado para índice ${index}`);
              // Valida a data antes de usar toISOString para evitar erros
              if (!item || !(item instanceof Date) || isNaN(item.getTime())) {
                const fallbackKey = `month-${index}-${Date.now()}`;
                console.warn(`[DEBUG V2] keyExtractor: usando fallback key: ${fallbackKey}`);
                return fallbackKey;
              }
              try {
                // Usa getTime() em vez de toISOString() para evitar problemas
                const key = `month-${item.getTime()}-${index}`;
                console.log(`[DEBUG V2] keyExtractor: key gerada: ${key}`);
                return key;
              } catch (error) {
                console.warn('[DEBUG V2] Erro ao gerar key para item da FlatList:', error);
                return `month-${index}-${Date.now()}`;
              }
            }}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            extraData={[currentMonthIndex, activeFilter, filterOrder, allExpenses.length]}
            maxToRenderPerBatch={3}
            windowSize={5}
            initialNumToRender={1}
            removeClippedSubviews={false}
            decelerationRate="fast"
            onScroll={() => {}}
          />
        );
      })()}

      {/* Container de resumo financeiro do mês atual */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Receita total:</Text>
          <Text style={styles.summaryValue}>
            {String(currentMonthTotalIncome.toFixed(2)).replace('.', ',') + ' R$'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Despesas pendentes:</Text>
          <Text style={[styles.summaryValue, { color: '#dc3545' }]}>
            {String(currentMonthTotalExpense.toFixed(2)).replace('.', ',') + ' R$'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Saldo:</Text>
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
  // Estilos para títulos dos meses
  monthTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  // Container da barra de filtros
  filtersBar: {
    flexDirection: 'row',
    alignItems: 'stretch', // Mudado para stretch para que os filtros ocupem toda a altura
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#f8f9fa',
    marginBottom: 15,
    borderRadius: 8,
  },
  // Container para cada filtro individual
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16, // Aumentado o padding horizontal
    paddingVertical: 12,   // Aumentado o padding vertical
    borderRadius: 6,
    minWidth: 80, // Largura mínima para garantir área clicável
    flex: 1, // Faz com que todos os filtros tenham a mesma largura
  },
  filterItemActive: {
    backgroundColor: '#e3f2fd', // Azul claro para destacar
  },
  // Texto do filtro
  filterText: {
    fontSize: 13,
    color: '#666',
    marginRight: 4,
  },
  filterTextActive: {
    color: '#1976d2', // Azul mais escuro para o texto quando ativo
    fontWeight: 'bold',
  },
  // Separador vertical entre filtros
  filterDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#dee2e6',
    marginVertical: 8,
  },
  // Container especial para o mês atual (apenas muda a cor de fundo)
  currentMonthTitleContainer: {
    backgroundColor: '#e3f2fd', // Azul bem suave
  },
  currentMonthTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2', // Azul um pouco mais escuro para contraste
  },
  regularMonthTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  // Estilo para despesas pagas
  paidExpenseRow: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
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

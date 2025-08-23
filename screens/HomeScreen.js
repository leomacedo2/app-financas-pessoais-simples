// screens/HomeScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, ActivityIndicator, Alert, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';

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
  // Garante que o índice seja válido para evitar 'undefined'
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

  for (let i = numPastMonths; i > 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(date);
  }

  months.push(new Date(today.getFullYear(), today.getMonth(), 1));

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
    const numExpenses = Math.floor(Math.random() * 5) + 3;

    for (let i = 0; i < numExpenses; i++) {
      const day = Math.floor(Math.random() * 28) + 1;
      const value = parseFloat((Math.random() * 480 + 20).toFixed(2));
      const description = expenseDescriptions[Math.floor(Math.random() * expenseDescriptions.length)];
      const createdAtDate = new Date(year, month, day);

      generatedExpenses.push({
        id: `${year}-${month}-${i}-${Math.random()}`,
        description,
        value,
        createdAt: createdAtDate.toISOString(),
        status: 'active',
        paymentMethod: 'Débito',
        dueDate: createdAtDate.toISOString(),
      });
    }
  });
  return generatedExpenses.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};


export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const [loadingApp, setLoadingApp] = useState(true);
  const [allIncomes, setAllIncomes] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);

  const [isClearDataModalVisible, setIsClearDataModalVisible] = useState(false);
  const [selectedClearOption, setSelectedClearOption] = useState('4');

  const [isMonthYearPickerVisible, setIsMonthYearYearPickerVisible] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [pickerYear, setPickerYear] = useState(String(new Date().getFullYear()));

  const monthsToDisplay = useRef(generateMonthsToDisplay());

  const today = new Date();
  const initialMonthDate = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), []);

  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const flatListRef = useRef(null);

  const scrollAttempted = useRef(false);

  const getLastDayOfMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getExpensesForMonth = useCallback((monthDate, expensesData, onlyActive = false) => {
    const targetMonth = monthDate.getMonth();
    const targetYear = monthDate.getFullYear();
    const displayMonthStartTimestamp = new Date(targetYear, targetMonth, 1).getTime();
    const currentMonthYearString = formatMonthYearForExclusion(monthDate);
    
    let expensesForThisMonth = [];

    expensesData.forEach(item => {
      if (onlyActive && item.status === 'inactive') {
        return;
      }

      if (item.status === 'inactive' && item.deletedAt) {
        const deletionDate = new Date(item.deletedAt);
        const deletionMonthStart = new Date(deletionDate.getFullYear(), deletionDate.getMonth(), 1);
        if (deletionMonthStart.getTime() <= displayMonthStartTimestamp) {
          return;
        }
      }

      if (item.paymentMethod === 'Fixa') {
        if (item.excludedMonths && item.excludedMonths.includes(currentMonthYearString)) {
          return;
        }

        const createdAtDate = new Date(item.createdAt);
        const createdAtMonthStart = new Date(createdAtDate.getFullYear(), createdAtDate.getMonth(), 1).getTime();

        if (createdAtMonthStart <= displayMonthStartTimestamp) {
          let dayForFixedExpense = item.dueDayOfMonth || 1;
          const lastDayOfTargetMonth = getLastDayOfMonth(targetYear, targetMonth);
          
          if (dayForFixedExpense > lastDayOfTargetMonth) {
            dayForFixedExpense = lastDayOfTargetMonth;
          }

          const fixedDueDate = new Date(targetYear, targetMonth, dayForFixedExpense);
          
          expensesForThisMonth.push({
            ...item,
            dueDate: fixedDueDate.toISOString(),
            id: `${item.id}-${targetYear}-${targetMonth}`,
            description: `${item.description}` 
          });
        }
      }
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
  }, []);

  const getIncomesForMonth = useCallback((monthDate, incomesData, onlyActive = false) => {
    const targetMonth = monthDate.getMonth();
    const targetYear = monthDate.getFullYear();
    const displayMonthStartTimestamp = new Date(targetYear, targetMonth, 1).getTime();
    const currentMonthYearString = formatMonthYearForExclusion(monthDate);

    let incomesForThisMonth = [];

    incomesData.forEach(item => {
      if (onlyActive && item.status === 'inactive') {
        return;
      }

      if (item.status === 'inactive' && item.deletedAt) {
        const deletionDate = new Date(item.deletedAt);
        const deletionMonthStart = new Date(deletionDate.getFullYear(), deletionDate.getMonth(), 1);
        if (deletionMonthStart.getTime() <= displayMonthStartTimestamp) {
          return;
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
  }, []);

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

      return isCurrentSystemMonth || hasActiveExpenses || hasActiveIncomes;
    });

    const isTodayMonthIncluded = filtered.some(monthDate =>
      monthDate.getMonth() === todayMonth && monthDate.getFullYear() === todayYear
    );
    if (!isTodayMonthIncluded) {
      filtered.push(initialMonthDate);
    }

    return filtered.sort((a, b) => a.getTime() - b.getTime());

  }, [monthsToDisplay, initialMonthDate, allExpenses, allIncomes, getExpensesForMonth, getIncomesForMonth]);

  const pickerMonthOptions = useMemo(() => {
    const uniqueMonths = new Set();
    filteredMonthsToDisplay.forEach(date => uniqueMonths.add(String(date.getMonth() + 1).padStart(2, '0')));
    return Array.from(uniqueMonths).sort();
  }, [filteredMonthsToDisplay]);

  const pickerYearOptions = useMemo(() => {
    const uniqueYears = new Set();
    filteredMonthsToDisplay.forEach(date => uniqueYears.add(String(date.getFullYear())));
    return Array.from(uniqueYears).sort();
  }, [filteredMonthsToDisplay]);

  const loadData = useCallback(async () => {
    setLoadingApp(true);
    try {
      const storedIncomesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.INCOMES);
      const storedIncomes = storedIncomesJson ? JSON.parse(storedIncomesJson) : [];
      setAllIncomes(storedIncomes);
      
      const storedExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      const currentExpenses = storedExpensesJson ? JSON.parse(storedExpensesJson) : [];
      setAllExpenses(currentExpenses);

      const tempFilteredMonths = monthsToDisplay.current.filter(monthDate => {
        const isCurrentSystemMonth = monthDate.getMonth() === initialMonthDate.getMonth() && monthDate.getFullYear() === initialMonthDate.getFullYear();
        const activeExpensesForMonth = getExpensesForMonth(monthDate, currentExpenses, true);
        const hasActiveExpenses = activeExpensesForMonth.length > 0;
        const activeIncomesForMonth = getIncomesForMonth(monthDate, storedIncomes, true);
        const hasActiveIncomes = activeIncomesForMonth.length > 0;
        return isCurrentSystemMonth || hasActiveExpenses || hasActiveIncomes;
      });
      if (!tempFilteredMonths.some(m => m.getTime() === initialMonthDate.getTime())) {
        tempFilteredMonths.push(initialMonthDate);
      }
      tempFilteredMonths.sort((a, b) => a.getTime() - b.getTime());

      const targetIndex = tempFilteredMonths.findIndex(monthDate =>
        monthDate.getMonth() === initialMonthDate.getMonth() &&
        monthDate.getFullYear() === initialMonthDate.getFullYear()
      );
      
      if (targetIndex !== -1) {
        setCurrentMonthIndex(targetIndex);
        console.log(`[DEBUG - loadData]: Índice inicial do mês atual calculado: ${targetIndex}`);
      } else {
        setCurrentMonthIndex(0);
        console.warn(`[DEBUG - loadData]: Mês atual do sistema não encontrado na lista filtrada, padrão para índice 0.`);
      }

    } catch (error) {
      console.error("HomeScreen: Erro ao carregar dados do AsyncStorage:", error);
      Alert.alert('Erro de Carregamento', 'Não foi possível carregar os dados de finanças do armazenamento local.');
    } finally {
      setLoadingApp(false);
      scrollAttempted.current = false;
    }
  }, [initialMonthDate, monthsToDisplay, getExpensesForMonth, getIncomesForMonth]);

  const handleGenerateRandomExpenses = useCallback(async () => {
    setLoadingApp(true);
    try {
      const generated = generateRandomExpensesData(monthsToDisplay.current); 

      const storedExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      const existingExpenses = storedExpensesJson ? JSON.parse(storedExpensesJson) : [];
      
      const combinedExpenses = [...existingExpenses, ...generated];

      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(combinedExpenses));
      Alert.alert('Sucesso', `${generated.length} despesas aleatórias geradas e adicionadas para todos os meses!`);
      await loadData();
    } catch (error) {
      console.error("HomeScreen: Erro ao gerar despesas aleatórias:", error);
      Alert.alert('Erro', `Não foi possível gerar despesas aleatórias: ${error.message}`);
    } finally {
      setLoadingApp(false);
    }
  }, [loadData, monthsToDisplay]);

  useFocusEffect(
    useCallback(() => {
      scrollAttempted.current = false; 
      loadData(); 
      return () => {
      };
    }, [loadData])
  );

  useEffect(() => {
    if (!loadingApp && filteredMonthsToDisplay.length > 0 && !scrollAttempted.current) {
        const targetIndex = filteredMonthsToDisplay.findIndex(monthDate =>
            monthDate.getMonth() === initialMonthDate.getMonth() &&
            monthDate.getFullYear() === initialMonthDate.getFullYear()
        );

        if (flatListRef.current && targetIndex !== -1 && currentMonthIndex === targetIndex) {
            scrollAttempted.current = true;
            console.log(`[DEBUG - Scroll useEffect]: Já no mês alvo: ${getMonthName(initialMonthDate)}/${initialMonthDate.getFullYear()} (Index: ${targetIndex})`);
        } else if (flatListRef.current && targetIndex !== -1) {
            setTimeout(() => {
                if (flatListRef.current) {
                    flatListRef.current.scrollToIndex({ index: targetIndex, animated: false });
                    setCurrentMonthIndex(targetIndex);
                    scrollAttempted.current = true;
                    console.log(`[DEBUG - Scroll useEffect]: Corrigindo rolagem para o mês alvo: ${getMonthName(initialMonthDate)}/${initialMonthDate.getFullYear()} (Index: ${targetIndex})`);
                }
            }, 100);
        }
    }
  }, [loadingApp, filteredMonthsToDisplay, initialMonthDate, currentMonthIndex]);

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

  const currentDisplayedMonthDate = filteredMonthsToDisplay[currentMonthIndex] || initialMonthDate;

  const currentMonthTotalIncome = calculateTotalIncomeForMonth(currentDisplayedMonthDate);

  const currentDisplayedMonthExpenses = getExpensesForMonth(currentDisplayedMonthDate, allExpenses, true);
  const totalDespesasDisplayedMonth = currentDisplayedMonthExpenses.reduce((sum, item) => sum + item.value, 0);

  const valorFinalDisplayedMonth = currentMonthTotalIncome - totalDespesasDisplayedMonth;

  const renderMonthSection = ({ item: monthDate, index }) => {
    const expenses = getExpensesForMonth(monthDate, allExpenses, true);
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
          <Text style={styles.sectionTitle}>{String(monthName)} {String(year)}</Text>

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

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / width);
    if (newIndex !== currentMonthIndex) {
      setCurrentMonthIndex(newIndex);
    }
  };

  const handleConfirmClearData = async () => {
    if (selectedClearOption === '0') {
      setPickerMonth(String(currentDisplayedMonthDate.getMonth() + 1).padStart(2, '0'));
      setPickerYear(String(currentDisplayedMonthDate.getFullYear()));

      setIsClearDataModalVisible(false);
      setIsMonthYearYearPickerVisible(true);
      return;
    }

    setIsClearDataModalVisible(false);
    setLoadingApp(true);
    
    const monthBeforeAction = currentDisplayedMonthDate;
    const targetMonth = monthBeforeAction.getMonth();
    const targetYear = monthBeforeAction.getFullYear();
    
    console.log(`[DEBUG - Limpeza]: Tentando limpar dados (opção ${selectedClearOption}) para ${getMonthName(monthBeforeAction)}/${targetYear}`);

    try {
      switch (selectedClearOption) {
        case '1':
          await AsyncStorage.removeItem(ASYNC_STORAGE_KEYS.INCOMES);
          Alert.alert('Sucesso', 'Todas as receitas foram limpas permanentemente.');
          break;
        case '2':
          await AsyncStorage.removeItem(ASYNC_STORAGE_KEYS.EXPENSES);
          Alert.alert('Sucesso', 'Todas as despesas foram limpas permanentemente.');
          break;
        case '3':
          await AsyncStorage.removeItem(ASYNC_STORAGE_KEYS.CARDS);
          Alert.alert('Sucesso', 'Todos os cartões foram limpos permanentemente.');
          break;
        case '4':
        default:
          await AsyncStorage.clear();
          Alert.alert('Sucesso', 'TODOS os dados foram apagados permanentemente e recarregados.');
          break;
      }
      await loadData();
      
    } catch (error) {
      console.error("HomeScreen: Erro ao limpar dados:", error);
      Alert.alert('Erro', `Não foi possível limpar os dados: ${error.message}`);
    } finally {
      setLoadingApp(false);
    }
  };

  const performMonthYearClear = async () => {
    setIsMonthYearYearPickerVisible(false);
    setLoadingApp(true);

    const monthToClear = parseInt(pickerMonth, 10) - 1;
    const yearToClear = parseInt(pickerYear, 10);
    const targetDateToClear = new Date(yearToClear, monthToClear, 1);
    const targetMonthYearString = formatMonthYearForExclusion(targetDateToClear);

    console.log(`[DEBUG - Limpeza]: Limpando dados para ${getMonthName(targetDateToClear)}/${yearToClear} (selecionado pelo usuário)`);

    const lastDayOfTargetMonth = new Date(yearToClear, monthToClear + 1, 0); 

    try {
      const updatedIncomes = allIncomes.map(income => {
        if (income.type === 'Fixo') {
          const newExcludedMonths = income.excludedMonths ? [...income.excludedMonths, targetMonthYearString] : [targetMonthYearString];
          return { ...income, excludedMonths: Array.from(new Set(newExcludedMonths)) };
        } else if (income.type === 'Ganho' && 
                   income.month === monthToClear &&
                   income.year === yearToClear &&
                   income.status !== 'inactive') {
          return { ...income, status: 'inactive', deletedAt: lastDayOfTargetMonth.toISOString() };
        }
        return income;
      });
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.INCOMES, JSON.stringify(updatedIncomes));

      const updatedExpenses = allExpenses.map(expense => {
        if (expense.paymentMethod === 'Fixa') {
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
      await loadData();
      
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

      <FlatList
        ref={flatListRef}
        data={filteredMonthsToDisplay}
        renderItem={renderMonthSection}
        keyExtractor={item => String(item.toISOString())}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        initialScrollIndex={currentMonthIndex}
        extraData={currentMonthIndex}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Receita total:</Text>
          <Text style={styles.summaryValue}>
            {String(currentMonthTotalIncome.toFixed(2)).replace('.', ',') + ' R$'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Valor final:</Text>
          <Text style={[styles.summaryValue, valorFinalDisplayedMonth < 0 ? styles.negativeValue : styles.positiveValue]}>
            {String(valorFinalDisplayedMonth.toFixed(2)).replace('.', ',') + ' R$'}
          </Text>
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isClearDataModalVisible}
        onRequestClose={() => {
          setIsClearDataModalVisible(false);
          setSelectedClearOption('4');
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

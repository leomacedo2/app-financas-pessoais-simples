// screens/HomeScreen.js

/**
 * @file HomeScreen.js
 * @description Esta tela é a principal do aplicativo, exibindo um resumo financeiro
 * e uma lista horizontal rolável de despesas por mês.
 *
 * Funcionalidades principais:
 * - Exibição paginada de despesas para meses passados e futuros.
 * - Cálculo e exibição da receita total e valor final para o mês visível.
 * - Geração de despesas aleatórias para TODOS os meses no range.
 * - O mês atual do sistema é SEMPRE exibido na FlatList e a rolagem inicial vai para ele.
 * - Sincronização de dados de receitas e despesas com AsyncStorage.
 * - Modal aprimorado para limpeza de dados, permitindo a seleção de Mês/Ano para exclusão suave.
 *
 * Atualizações:
 * - 2025-08-26 (NOVIDADE): Adicionado o status "Vence Amanhã" na função `getStatusText`
 * para despesas pendentes que vencem no dia seguinte.
 * - 2025-08-26 (NOVIDADE): Implementada a funcionalidade de "Toque Longo" para editar despesas.
 * - Agora, um *toque longo* em um item da lista de despesas navegará para a tela de edição.
 * - O *toque simples* na checkbox continua a alternar o status de pago/pendente,
 * eliminando o "miss click" que ocorria ao tentar marcar/desmarcar a despesa.
 * - 2025-08-26 (CORRIGIDO): Correção do erro de digitação `ASYC_STORAGE_KEYS` para `ASYNC_STORAGE_KEYS`
 * na função `handleGenerateRandomExpenses` (linha 420).
 * - 2025-08-26 (CORRIGIDO): Revisão de todos os componentes `<Text>` para garantir que apenas strings
 * ou variáveis de string sejam passadas como filhos, evitando comentários JSX internos
 * que podem causar o aviso "Text strings must be rendered within a <Text> component".
 * - 2025-08-26 (REVISADO): Refatoração do layout da lista de despesas na HomeScreen.
 * - A coluna "Status/Vencimento" foi removida do cabeçalho da lista de despesas.
 * - As informações de status (Pago/Pendente/Atrasado/Vence) foram movidas para um "rodapézinho"
 * abaixo da descrição da despesa, utilizando uma fonte menor e cor mais discreta (`expenseStatusFooter`).
 * - O `marginRight` do `checkboxContainer` foi aumentado e o `paddingVertical` dos itens da lista
 * (`debitItemRow`) foi ajustado para melhorar o espaçamento e a área de toque, prevenindo cliques acidentais
 * e proporcionando mais "respiro" visual entre os itens.
 * - A função `getStatusText` foi aprimorada para incluir o status "Atrasado" quando aplicável.
 * - 2024-08-15: RESOLVIDO DEFINITIVAMENTE: Flicker de Rolagem (Agosto 2024 -> Agosto 2025).
 * - A lógica de inicialização da rolagem foi **completamente reestruturada**.
 * - Agora, o `currentMonthIndex` (que serve como `initialScrollIndex` da `FlatList`)
 * é calculado e atualizado *dentro do `loadData`*, logo após o carregamento dos dados
 * e a estabilização da lista de meses filtrados (`filteredMonthsToDisplay`).
 * - Isso garante que a `FlatList` já renderize no mês correto (Agosto de 2025) desde
 * a sua primeira aparição após o `loading` ser definido como `false`.
 * - 2024-08-10: Implementação inicial da `HomeScreen` com exibição de despesas e resumo.
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
      const isPaidRandom = Math.random() > 0.5; // 50% de chance de ser paga

      generatedExpenses.push({
        id: `${year}-${month}-${i}-${Math.random()}`,
        description,
        value,
        createdAt: createdAtDate.toISOString(),
        status: isPaidRandom ? 'paid' : 'pending', // Geração aleatória de status
        paidAt: isPaidRandom ? new Date().toISOString() : null, // Geração de data de pagamento se for paga
        paymentMethod: 'Débito',
        dueDate: createdAtDate.toISOString(),
        deletedAt: null, // Garante que despesas geradas não estão deletadas
      });
    }
  });
  return generatedExpenses.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};


export default function HomeScreen({ navigation }) { // Adicionado 'navigation' como prop
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
      // Ignora itens marcados para exclusão suave (deletedAt)
      if (item.deletedAt) {
        return;
      }

      if (onlyActive && item.status === 'inactive') {
        return;
      }

      // Lógica para despesas fixas
      if (item.paymentMethod === 'Fixa') {
        // Verifica se o mês/ano atual está na lista de meses excluídos para essa despesa fixa
        if (item.excludedMonths && item.excludedMonths.includes(currentMonthYearString)) {
          return;
        }

        const createdAtDate = new Date(item.createdAt);
        const createdAtMonthStart = new Date(createdAtDate.getFullYear(), createdAtDate.getMonth(), 1).getTime();

        // A despesa fixa só aparece se foi criada antes ou no mês atual de exibição
        if (createdAtMonthStart <= displayMonthStartTimestamp) {
          let dayForFixedExpense = item.dueDayOfMonth || 1;
          const lastDayOfTargetMonth = getLastDayOfMonth(targetYear, targetMonth);
          
          // Ajusta o dia se for maior que o número de dias do mês
          if (dayForFixedExpense > lastDayOfTargetMonth) {
            dayForFixedExpense = lastDayOfTargetMonth;
          }

          const fixedDueDate = new Date(targetYear, targetMonth, dayForFixedExpense);
          
          expensesForThisMonth.push({
            ...item,
            dueDate: fixedDueDate.toISOString(), // Atribui a data de vencimento calculada
            id: `${item.id}-${targetYear}-${targetMonth}`, // ID único para despesas fixas por mês
            description: `${item.description}` 
          });
        }
      }
      // Lógica para despesas de Débito e Crédito
      else if (item.paymentMethod === 'Débito' || item.paymentMethod === 'Crédito') {
        if (item.dueDate) {
          const itemDueDate = new Date(item.dueDate);
          // Inclui a despesa se a data de vencimento (ou compra para débito) for no mês/ano atual
          if (itemDueDate.getMonth() === targetMonth && itemDueDate.getFullYear() === targetYear) {
            expensesForThisMonth.push(item);
          }
        }
      }
    });    
    // Ordena as despesas pela data de vencimento ou criação
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
      // Ignora itens marcados para exclusão suave (deletedAt)
      if (item.deletedAt) {
        return;
      }

      if (onlyActive && item.status === 'inactive') {
        return;
      }

      // Lógica para receitas fixas
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
      } else if (item.type === 'Ganho') {
        // Inclui a receita se o mês e ano da receita corresponderem ao mês/ano atual
        if (item.month === targetMonth && item.year === targetYear) {
          incomesForThisMonth.push(item);
        }
      }
    });    
    return incomesForThisMonth;
  }, []);

  // UseMemo para filtrar os meses a serem exibidos na FlatList horizontal.
  // Garante que apenas meses com receitas ou despesas ativas, ou o mês atual, sejam mostrados.
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

    // Garante que o mês atual do sistema esteja sempre incluído, mesmo que não tenha movimentos
    const isTodayMonthIncluded = filtered.some(monthDate =>
      monthDate.getMonth() === todayMonth && monthDate.getFullYear() === todayYear
    );
    if (!isTodayMonthIncluded) {
      filtered.push(initialMonthDate);
    }

    return filtered.sort((a, b) => a.getTime() - b.getTime());

  }, [monthsToDisplay, initialMonthDate, allExpenses, allIncomes, getExpensesForMonth, getIncomesForMonth]);

  // Opções para o Picker de meses no modal de limpeza de dados
  const pickerMonthOptions = useMemo(() => {
    const uniqueMonths = new Set();
    filteredMonthsToDisplay.forEach(date => uniqueMonths.add(String(date.getMonth() + 1).padStart(2, '0')));
    return Array.from(uniqueMonths).sort();
  }, [filteredMonthsToDisplay]);

  // Opções para o Picker de anos no modal de limpeza de dados
  const pickerYearOptions = useMemo(() => {
    const uniqueYears = new Set();
    filteredMonthsToDisplay.forEach(date => uniqueYears.add(String(date.getFullYear())));
    return Array.from(uniqueYears).sort();
  }, [filteredMonthsToDisplay]);

  // Carrega os dados de receitas e despesas do AsyncStorage.
  // Calcula o índice do mês atual para a rolagem inicial da FlatList.
  const loadData = useCallback(async () => {
    setLoadingApp(true);
    try {
      const storedIncomesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.INCOMES);
      const storedIncomes = storedIncomesJson ? JSON.parse(storedIncomesJson) : [];
      setAllIncomes(storedIncomes);
      
      const storedExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      const currentExpenses = storedExpensesJson ? JSON.parse(storedExpensesJson) : [];
      setAllExpenses(currentExpenses);

      // Recria a lista de meses filtrados temporariamente para encontrar o índice correto
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

      // Encontra o índice do mês atual na lista filtrada
      const targetIndex = tempFilteredMonths.findIndex(monthDate =>
        monthDate.getMonth() === initialMonthDate.getMonth() &&
        monthDate.getFullYear() === initialMonthDate.getFullYear()
      );
      
      if (targetIndex !== -1) {
        setCurrentMonthIndex(targetIndex);
        console.log(`[DEBUG - loadData]: Índice inicial do mês atual calculado: ${targetIndex}`);
      } else {
        setCurrentMonthIndex(0); // Fallback para índice 0 se não encontrar
        console.warn(`[DEBUG - loadData]: Mês atual do sistema não encontrado na lista filtrada, padrão para índice 0.`);
      }

    } catch (error) {
      console.error("HomeScreen: Erro ao carregar dados do AsyncStorage:", error);
      Alert.alert('Erro de Carregamento', 'Não foi possível carregar os dados de finanças do armazenamento local.');
    } finally {
      setLoadingApp(false);
      scrollAttempted.current = false; // Reseta a flag de rolagem
    }
  }, [initialMonthDate, monthsToDisplay, getExpensesForMonth, getIncomesForMonth]);

  // Função para gerar despesas aleatórias e persistir no AsyncStorage
  const handleGenerateRandomExpenses = useCallback(async () => {
    setLoadingApp(true);
    try {
      const generated = generateRandomExpensesData(monthsToDisplay.current); 

      const storedExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      const existingExpenses = storedExpensesJson ? JSON.parse(storedExpensesJson) : [];
      
      const combinedExpenses = [...existingExpenses, ...generated];

      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(combinedExpenses));
      Alert.alert('Sucesso', `${generated.length} despesas aleatórias geradas e adicionadas para todos os meses!`);
      await loadData(); // Recarrega os dados para exibir as novas despesas
    } catch (error) {
      console.error("HomeScreen: Erro ao gerar despesas aleatórias:", error);
      Alert.alert('Erro', `Não foi possível gerar despesas aleatórias: ${error.message}`);
    } finally {
      setLoadingApp(false);
    }
  }, [loadData, monthsToDisplay]);

  // Efeito que garante que os dados sejam recarregados sempre que a tela Home for focada
  useFocusEffect(
    useCallback(() => {
      scrollAttempted.current = false; 
      loadData(); 
      return () => {
      };
    }, [loadData])
  );

  // Efeito para corrigir a rolagem da FlatList para o mês atual na montagem ou quando os dados mudam
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
            }, 100); // Pequeno atraso para garantir que a FlatList esteja renderizada
        }
    }
  }, [loadingApp, filteredMonthsToDisplay, initialMonthDate, currentMonthIndex]);

  // Calcula o total de receitas para o mês atualmente exibido na FlatList
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

  // Obtém a data do mês atualmente exibido na FlatList
  const currentDisplayedMonthDate = filteredMonthsToDisplay[currentMonthIndex] || initialMonthDate;

  // Calcula a receita total para o mês atualmente exibido
  const currentMonthTotalIncome = calculateTotalIncomeForMonth(currentDisplayedMonthDate);

  // Obtém as despesas ativas para o mês atualmente exibido
  const currentDisplayedMonthExpenses = getExpensesForMonth(currentDisplayedMonthDate, allExpenses, true);
  
  // Calcula o total das despesas do mês atualmente exibido
  const totalDespesasDisplayedMonth = currentDisplayedMonthExpenses.reduce((sum, item) => sum + item.value, 0);

  // Calcula o valor final (Receita - Despesa) para o mês atualmente exibido
  const valorFinalDisplayedMonth = currentMonthTotalIncome - totalDespesasDisplayedMonth;

  /**
   * Handler para navegar para a tela de edição de despesa.
   * Navega para a aba 'DespesaTab' e, dentro dela, para a tela 'DespesaScreenInternal',
   * passando a despesa a ser editada como parâmetro.
   * Agora acionado por *toque longo*.
   * @param {object} expense - O objeto de despesa a ser editado.
   */
  const handleEditExpense = (expense) => {
    // Se for uma despesa fixa, usa o ID original (sem o sufixo de mês/ano)
    const expenseToEdit = {
      ...expense,
      id: expense.id.split('-')[0] // Remove o sufixo se existir
    };
    
    navigation.navigate('DespesaTab', {
      screen: 'DespesaScreenInternal',
      params: { expenseToEdit: expenseToEdit },
    });
  };

  /**
   * Handler para alternar o status de uma despesa entre 'paga' e 'pendente'.
   * Atualiza o estado local e persiste a mudança no AsyncStorage.
   * @param {string} expenseId - O ID da despesa a ser atualizada.
   */
  const handleTogglePaidStatus = useCallback(async (expenseId) => {
    // Busca a despesa pelo ID na lista de todas as despesas
    const expenseIndex = allExpenses.findIndex(exp => exp.id === expenseId);
    if (expenseIndex === -1) {
      console.warn(`[DEBUG - handleTogglePaidStatus]: Despesa com ID ${expenseId} não encontrada.`);
      return;
    }

    const updatedExpenses = [...allExpenses];
    const expenseToUpdate = { ...updatedExpenses[expenseIndex] };

    // Inverte o status e atualiza a data de pagamento
    if (expenseToUpdate.status === 'pending') {
      expenseToUpdate.status = 'paid';
      expenseToUpdate.paidAt = new Date().toISOString(); // Define a data de agora como data de pagamento
    } else {
      expenseToUpdate.status = 'pending';
      expenseToUpdate.paidAt = null; // Remove a data de pagamento se for marcada como pendente
    }

    updatedExpenses[expenseIndex] = expenseToUpdate;
    setAllExpenses(updatedExpenses); // Atualiza o estado local de todas as despesas

    // Persiste no AsyncStorage
    try {
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(updatedExpenses));
      console.log(`[DEBUG - handleTogglePaidStatus]: Despesa ${expenseId} atualizada para status: ${expenseToUpdate.status}`);
    } catch (error) {
      console.error('Erro ao salvar status da despesa:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao atualizar o status da despesa. Tente novamente.');
    }
  }, [allExpenses]);

  /**
   * Retorna o texto de status formatado para uma despesa.
   * Considera se a despesa está paga, pendente, vencendo ou atrasada.
   * @param {object} expense - O objeto de despesa.
   * @returns {string} O texto de status formatado.
   */
  const getStatusText = (expense) => {
    if (expense.status === 'paid') {
      return 'Pago';
    } else {
      const dueDate = parseDateString(formatDateForDisplay(new Date(expense.dueDate))); // Converte para Date e zera hora para comparação
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zera horas, minutos, segundos e milissegundos para comparação de datas

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1); // Calcula a data de amanhã

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
   * @param {object} param0 - Objeto contendo o item (monthDate) e o índice.
   * @returns {JSX.Element} Componente de visualização para o mês.
   */
  const renderMonthSection = ({ item: monthDate, index }) => {
    // Filtra as despesas ativas para o mês atual da seção
    const expenses = getExpensesForMonth(monthDate, allExpenses, true);
    const monthName = getMonthName(monthDate);
    const year = monthDate.getFullYear();

    // Verifica se a seção atual corresponde ao mês do sistema para destaque
    const isSystemCurrentMonth = monthDate.getMonth() === initialMonthDate.getMonth() &&
                                 initialMonthDate.getFullYear() === year;

    return (
      <View style={styles.monthPage}>
        <View style={[
          styles.section,
          isSystemCurrentMonth && styles.currentMonthHighlight // Aplica destaque se for o mês atual
        ]}>
          <Text style={styles.sectionTitle}>{String(monthName)} {String(year)}</Text>

          {/* Cabeçalho da tabela de despesas - AGORA COM APENAS DESCRIÇÃO E VALOR */}
          <View style={styles.tableHeader}>
            <View style={styles.checkboxHeaderColumn}></View> 
            <Text style={[styles.headerText, styles.descriptionColumnAdjusted]}>Despesa</Text>
            <Text style={[styles.headerText, styles.valueColumn]}>Valor</Text>
          </View>

          {expenses.length > 0 ? (
            <ScrollView style={styles.expensesScrollView}>
              {expenses.map((item) => (
                <TouchableOpacity 
                  key={String(item.id)} 
                  style={styles.debitItemRowAdjusted} // Estilo ajustado para espaçamento vertical
                  onLongPress={() => handleEditExpense(item)} // AGORA USA ONLONGPRESS PARA EDITAR
                  activeOpacity={0.7} // Adiciona um feedback visual no toque
                >
                  {/* Checkbox para marcar/desmarcar despesa como paga (ainda com onPress) */}
                  <TouchableOpacity onPress={() => handleTogglePaidStatus(item.id)} style={styles.checkboxContainerAdjusted}>
                    <Ionicons
                      name={item.status === 'paid' ? 'checkbox' : 'square-outline'} 
                      size={24}
                      color={item.status === 'paid' ? '#28a745' : '#6c757d'} 
                    />
                  </TouchableOpacity>

                  <View style={styles.descriptionAndFooterContainer}>
                    <Text style={styles.debitText}>{String(item.description)}</Text>
                    {/* Rodapé com Status/Vencimento */}
                    <Text style={styles.expenseStatusFooter}>{getStatusText(item)}</Text>
                  </View>

                  <Text style={[styles.debitValue, styles.valueColumn]}>
                    {`${String(item.value.toFixed(2)).replace('.', ',')} R$`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noExpensesText}>Nenhuma despesa para este mês.</Text>
          )}
        </View>
      </View>
    );
  };

  // Handler para quando a FlatList termina de rolar, atualizando o índice do mês atual
  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / width);
    if (newIndex !== currentMonthIndex) {
      setCurrentMonthIndex(newIndex);
    }
  };

  // Handler para confirmar a limpeza de dados, com base na opção selecionada no modal
  const handleConfirmClearData = async () => {
    // Se a opção for limpar dados de um mês específico, abre o picker de mês/ano
    if (selectedClearOption === '0') {
      setPickerMonth(String(currentDisplayedMonthDate.getMonth() + 1).padStart(2, '0'));
      setPickerYear(String(currentDisplayedMonthDate.getFullYear()));

      setIsClearDataModalVisible(false);
      setIsMonthYearYearPickerVisible(true);
      return;
    }

    setIsClearDataModalVisible(false);
    setLoadingApp(true);
    
    // Captura o mês antes da ação de limpeza, caso a limpeza afete o mês atual
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
      await loadData(); // Recarrega todos os dados após a limpeza
      
    } catch (error) {
      console.error("HomeScreen: Erro ao limpar dados:", error);
      Alert.alert('Erro', `Ocorreu um erro ao limpar os dados: ${error.message}`);
    } finally {
      setLoadingApp(false);
    }
  };

  // Realiza a limpeza suave de dados para um mês/ano específico
  const performMonthYearClear = async () => {
    setIsMonthYearYearPickerVisible(false);
    setLoadingApp(true);

    const monthToClear = parseInt(pickerMonth, 10) - 1; // Mês é 0-indexado
    const yearToClear = parseInt(pickerYear, 10);
    const targetDateToClear = new Date(yearToClear, monthToClear, 1);
    const targetMonthYearString = formatMonthYearForExclusion(targetDateToClear);

    console.log(`[DEBUG - Limpeza]: Limpando dados para ${getMonthName(targetDateToClear)}/${yearToClear} (selecionado pelo usuário)`);

    const lastDayOfTargetMonth = new Date(yearToClear, monthToClear + 1, 0); 

    try {
      // Atualiza as receitas, marcando como inativas ou adicionando à lista de excluídos para fixas
      const updatedIncomes = allIncomes.map(income => {
        if (income.type === 'Fixo') {
          // Adiciona o mês atual à lista de meses excluídos para receitas fixas
          const newExcludedMonths = income.excludedMonths ? [...income.excludedMonths, targetMonthYearString] : [targetMonthYearString];
          return { ...income, excludedMonths: Array.from(new Set(newExcludedMonths)) };
        } else if (income.type === 'Ganho' && 
                   income.month === monthToClear &&
                   income.year === yearToClear &&
                   income.status !== 'inactive') {
          // Marca receitas de ganho como inativas com data de exclusão
          return { ...income, status: 'inactive', deletedAt: lastDayOfTargetMonth.toISOString() };
        }
        return income;
      });
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.INCOMES, JSON.stringify(updatedIncomes));

      // Atualiza as despesas, marcando como inativas ou adicionando à lista de excluídos para fixas
      const updatedExpenses = allExpenses.map(expense => {
        if (expense.paymentMethod === 'Fixa') {
          // Adiciona o mês atual à lista de meses excluídos para despesas fixas
          const newExcludedMonths = expense.excludedMonths ? [...expense.excludedMonths, targetMonthYearString] : [targetMonthYearString];
          return { ...expense, excludedMonths: Array.from(new Set(newExcludedMonths)) };
        } else if (expense.paymentMethod === 'Débito' || expense.paymentMethod === 'Crédito') {
            const expenseDueDate = new Date(expense.dueDate);
            const expenseMonth = expenseDueDate.getMonth();
            const expenseYear = expenseDueDate.getFullYear();

            // Marca despesas de débito/crédito como inativas com data de exclusão
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
      await loadData(); // Recarrega os dados para refletir as mudanças
      
    } catch (error) {
      console.error("HomeScreen: Erro ao limpar dados do mês selecionado:", error);
      Alert.alert('Erro', `Não foi possível limpar os dados do mês selecionado: ${error.message}`);
    } finally {
      setLoadingApp(false);
    }
  };

  // Abre o modal de opções de limpeza de dados
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

  // Opções para o Picker do modal de limpeza de dados
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

      {/* FlatList horizontal para exibir os meses */}
      <FlatList
        ref={flatListRef}
        data={filteredMonthsToDisplay}
        renderItem={renderMonthSection}
        keyExtractor={item => String(item.toISOString())}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll} // Captura o final da rolagem para atualizar o mês
        initialScrollIndex={currentMonthIndex} // Define o mês inicial
        extraData={currentMonthIndex} // Força re-renderização quando o índice muda
        getItemLayout={(data, index) => ({
          length: width, // Largura de cada item é a largura da tela
          offset: width * index,
          index,
        })}
      />

      {/* Container de resumo financeiro */}
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
  // ATUALIZADO: Usado para dar mais flexibilidade à descrição no cabeçalho
  descriptionColumnAdjusted: {
    flex: 3, 
    textAlign: 'left',
  },
  // REMOVIDO: dateColumn, pois a informação está no rodapé.

  expensesScrollView: {
    flex: 1,
  },
  // ATUALIZADO: Estilo do item da linha para maior espaçamento
  debitItemRowAdjusted: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15, // Aumentado para mais "respiro" entre os itens
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingHorizontal: 5,
  },
  // NOVO: Container para agrupar descrição e rodapé de status
  descriptionAndFooterContainer: {
    flex: 3, // Ocupa o espaço que a descrição e o rodapé precisam
    justifyContent: 'center',
  },
  debitText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 2, // Pequena margem para separar da informação de status
  },
  // NOVO: Estilo para o rodapé de status/vencimento
  expenseStatusFooter: {
    fontSize: 12, // Fonte menor para o rodapé
    color: '#666', // Cor mais suave
  },
  debitValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  // NOVO: Estilo para a coluna do checkbox no cabeçalho
  checkboxHeaderColumn: {
    width: 30, // Largura fixa para o ícone
  },
  // ATUALIZADO: Estilo para o container do checkbox com mais marginRight
  checkboxContainerAdjusted: {
    paddingRight: 15, // Aumentado o espaçamento entre checkbox e descrição
    width: 45, // Garante que o checkbox e o espaçamento ocupem uma largura definida
    alignItems: 'center', // Centraliza o ícone dentro do espaço
  },
  valueColumn: { // Mantido como estava, mas referenciado no JSX
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

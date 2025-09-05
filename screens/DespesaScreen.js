// screens/DespesaScreen.js

/**
 * @file Tela para adicionar ou editar despesas.
 * Este componente React Native funciona como um formulário dinâmico,
 * permitindo ao usuário registrar novas despesas ou modificar existentes.
 * Ele gerencia despesas de Débito, Crédito (com parcelamento) e Fixas,
 * com lógica de data inteligente e funcionalidade de exclusão suave.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert, ActivityIndicator, ScrollView, Modal, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';

// Importa os estilos comuns e as chaves de armazenamento como constantes para reutilização
import commonStyles from '../utils/commonStyles';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';

// Importa useFocusEffect para reagir ao foco da tela (navegação)
import { useFocusEffect } from '@react-navigation/native';

/**
 * Função auxiliar para obter o último dia de um determinado mês e ano.
 * @param {number} year - O ano.
 * @param {number} month - O mês (0-indexado, 0 para Janeiro, 11 para Dezembro).
 * @returns {number} O último dia do mês.
 */
const getLastDayOfMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
};

/**
 * Função auxiliar para calcular a primeira data de vencimento de uma compra de crédito,
 * considerando o dia de vencimento do cartão e a data da compra.
 * Se a data da compra for APÓS o dia de vencimento do cartão no mês atual,
 * a primeira parcela é registrada para o próximo ciclo de fatura.
 * Garante que o dia de vencimento não extrapole o último dia do mês.
 * @param {Date} purchaseDate - Data da compra (objeto Date).
 * @param {number} cardDueDayOfMonth - Dia de vencimento da fatura do cartão (1-31).
 * @returns {Date} O objeto Date da primeira data de vencimento da parcela.
 */
const getFirstCreditDueDate = (purchaseDate, cardDueDayOfMonth) => {
  const pDate = new Date(purchaseDate);
  let year = pDate.getFullYear();
  let month = pDate.getMonth();
  let day = cardDueDayOfMonth;

  // Se a data da compra for APÓS o dia de vencimento do cartão no mês atual,
  // a primeira parcela começa no próximo ciclo de fatura.
  if (pDate.getDate() >= cardDueDayOfMonth) {
    month += 1; // Avança para o próximo mês
    if (month > 11) {
      month = 0; // Janeiro do próximo ano
      year += 1;
    }
  }

  // Garante que o dia não exceda o último dia do mês alvo.
  const lastDayInTargetMonth = getLastDayOfMonth(year, month);
  if (day > lastDayInTargetMonth) {
    day = lastDayInTargetMonth;
  }

  return new Date(year, month, day);
};

/**
 * Função auxiliar para calcular a data de vencimento da próxima parcela de crédito,
 * ajustando para o último dia do mês se o `cardDueDayOfMonth` não existir.
 * @param {Date} previousDueDate - A data de vencimento da parcela anterior.
 * @param {number} cardDueDayOfMonth - O dia de vencimento original do cartão (1-31).
 * @returns {Date} O objeto Date da próxima data de vencimento da parcela.
 */
const getNextInstallmentDueDate = (previousDueDate, cardDueDayOfMonth) => {
    let year = previousDueDate.getFullYear();
    let month = previousDueDate.getMonth();
    
    // Avança para o próximo mês
    month += 1;
    if (month > 11) {
        month = 0;
        year += 1;
    }

    let day = cardDueDayOfMonth;
    const lastDayInTargetMonth = getLastDayOfMonth(year, month);
    if (day > lastDayInTargetMonth) {
        day = lastDayInTargetMonth; // Ajusta para o último dia do mês
    }

    return new Date(year, month, day);
};

export default function DespesaScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  // Estados para os campos do formulário de despesas
  const [expenseName, setExpenseName] = useState('');
  const [expenseValue, setExpenseValue] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState('Débito');
  
  // Estados para gerenciamento de cartões de crédito e parcelas
  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [numInstallments, setNumInstallments] = useState('1');

  // Estado para o dia de vencimento de despesas fixas
  const [fixedExpenseDueDay, setFixedExpenseDueDay] = useState('1');

  // Estados de UI e controle
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [savingExpense, setSavingExpense] = useState(false); // Indicador de carregamento/salvamento

  // Estados para controle de edição de despesas
  const [isEditing, setIsEditing] = useState(false);
  const [currentExpenseId, setCurrentExpenseId] = useState(null); // ID da despesa sendo editada (baseId para crédito)
  const [currentExpenseDeletedAt, setCurrentExpenseDeletedAt] = useState(null); // Timestamp se a despesa foi excluída suavemente
  
  const [showDeleteModal, setShowDeleteModal] = useState(false); // Estado para o modal de confirmação de exclusão
  const [isInstallmentsEditable, setIsInstallmentsEditable] = useState(true); // Controla se o campo de parcelas pode ser editado

  /**
   * Carrega os cartões ativos do AsyncStorage para exibição no Picker.
   * Seleciona o primeiro cartão ativo ou mantém o `selectedCardId` se ainda for válido.
   */
  const loadCards = useCallback(async () => {
    try {
      const storedCardsJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CARDS);
      const storedCards = storedCardsJson ? JSON.parse(storedCardsJson) : [];
      const activeCards = storedCards.filter(card => card.status !== 'inactive');
      setCards(activeCards);
      
      console.log("DespesaScreen: Cartões ativos carregados:", activeCards.map(c => ({id: c.id, alias: c.alias, dueDayOfMonth: c.dueDayOfMonth})));

      setSelectedCardId(prevSelectedCardId => {
        // Se já existe um cartão selecionado e ele ainda é ativo, mantém.
        if (prevSelectedCardId && activeCards.some(card => card.id === prevSelectedCardId)) {
          return prevSelectedCardId;
        } else if (activeCards.length > 0) {
          // Caso contrário, seleciona o primeiro cartão ativo.
          return activeCards[0].id;
        } else {
          // Se não há cartões ativos, limpa a seleção.
          return '';
        }
      });
    } catch (error) {
      console.error("DespesaScreen: Erro ao carregar cartões do AsyncStorage:", error);
    }
  }, []); // Dependências vazias para que `loadCards` não mude e cause loops indesejados

  /**
   * Hook para inicializar/resetar o estado da tela ao focar nela (navegação).
   * Popula o formulário se `expenseToEdit` for passado via `route.params`.
   */
  useFocusEffect(
    useCallback(() => {
      loadCards(); // Recarrega os cartões sempre que a tela ganha foco

      if (route.params?.expenseToEdit) {
        // Modo de edição: preenche o formulário com os dados da despesa
        const expense = route.params.expenseToEdit;
        const baseId = expense.originalExpenseId || expense.id.split('-')[0]; // Obtém o ID base

        console.log('Recebendo despesa para edição:', {
          id: expense.id,
          baseId,
          description: expense.description,
          paymentMethod: expense.paymentMethod
        });
        
        setIsEditing(true);
        setCurrentExpenseId(baseId);
        setExpenseName(expense.description);
        
        // Ajusta o valor para despesas de crédito (exibe o total se for parcelado)
        if (expense.paymentMethod === 'Crédito') {
          const valorTotal = expense.value * (expense.totalInstallments || 1);
          setExpenseValue(valorTotal.toFixed(2).replace('.', ','));
        } else {
          setExpenseValue(expense.value.toFixed(2).replace('.', ','));
        }

        setPaymentMethod(expense.paymentMethod || 'Débito');
        setIsInstallmentsEditable(true); // Permite editar parcelas em modo de edição

        // Define estados específicos para cada método de pagamento
        if (expense.paymentMethod === 'Débito') {
          setPurchaseDate(new Date(expense.purchaseDate || expense.createdAt));
          setFixedExpenseDueDay('1'); // Reseta para o padrão
        } else if (expense.paymentMethod === 'Crédito') {
          setPurchaseDate(new Date(expense.purchaseDate || expense.createdAt));
          setSelectedCardId(expense.cardId || '');
          setNumInstallments(String(expense.totalInstallments || '1'));
          setFixedExpenseDueDay('1'); // Reseta para o padrão
        } else if (expense.paymentMethod === 'Fixa') {
          setPurchaseDate(new Date()); // Data atual como padrão
          setSelectedCardId(''); // Limpa seleção de cartão
          setNumInstallments('1'); // Reseta para o padrão
          setFixedExpenseDueDay(String(expense.dueDayOfMonth || '1'));
        }

        setCurrentExpenseDeletedAt(expense.deletedAt || null);

      } else {
        // Modo de adição: reseta o formulário para um novo item
        setIsEditing(false);
        setCurrentExpenseId(null);
        setExpenseName('');
        setExpenseValue('');
        setPurchaseDate(new Date());
        setPaymentMethod('Débito');
        setSelectedCardId(''); 
        setNumInstallments('1');
        setFixedExpenseDueDay('1');
        setCurrentExpenseDeletedAt(null);
        setIsInstallmentsEditable(true);
      }

      // Limpa os parâmetros da rota ao sair para evitar que a tela entre em modo de edição novamente
      return () => {
        navigation.setParams({ expenseToEdit: undefined });
      };
    }, [navigation, route.params?.expenseToEdit, loadCards])
  );

  /**
   * Handler para a mudança de data no DateTimePicker.
   * @param {object} event - O evento do DateTimePicker.
   * @param {Date} selectedDate - A data selecionada.
   */
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios'); // Fecha o picker no iOS após seleção
    if (selectedDate) {
      setPurchaseDate(selectedDate);
    }
  };

  /** Exibe o DateTimePicker. */
  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  /**
   * Handler principal para salvar ou atualizar uma despesa.
   * Realiza validações e persistência dos dados no AsyncStorage.
   */
  const handleSaveExpense = async () => {
    console.log('Estado atual ao salvar:', {
      isEditing,
      currentExpenseId,
      paymentMethod,
      expenseName: expenseName.trim()
    });

    // --- Validações Comuns ---
    if (!expenseName.trim() || !expenseValue.trim()) {
      Alert.alert('Erro', 'Por favor, preencha a descrição e o valor da despesa.');
      return;
    }
    const value = parseFloat(expenseValue.replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      Alert.alert('Erro', 'Por favor, insira um valor válido para a despesa.');
      return;
    }

    // --- Validações Específicas para Crédito ---
    if (paymentMethod === 'Crédito') {
      if (!selectedCardId) {
        Alert.alert('Erro', 'Por favor, selecione um cartão para despesas de crédito.');
        return;
      }
      const numParcelas = parseInt(numInstallments, 10);
      if (isNaN(numParcelas) || numParcelas < 1) {
        Alert.alert('Erro', 'Por favor, insira um número válido de parcelas (mínimo 1).');
        return;
      }
    }

    // --- Validações Específicas para Fixa ---
    if (paymentMethod === 'Fixa') {
      const day = parseInt(fixedExpenseDueDay, 10);
      if (isNaN(day) || day < 1 || day > 31) {
        Alert.alert('Erro', 'Para despesas fixas, por favor, selecione um dia de pagamento válido (entre 1 e 31).');
        return;
      }
    }

    setSavingExpense(true); // Inicia o indicador de carregamento

    try {
      const existingExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      let expenses = existingExpensesJson ? JSON.parse(existingExpensesJson) : [];

      // Template básico para os dados da despesa
      let expenseDataTemplate = {
        description: expenseName.trim(),
        value: value,
        paymentMethod: isEditing ? route.params?.expenseToEdit?.paymentMethod : paymentMethod, // Mantém o método original em edição
        deletedAt: currentExpenseDeletedAt,
      };

      // --- Lógica para Edição de Despesa Existente ---
      if (isEditing && currentExpenseId) {
        const expenseToEdit = route.params?.expenseToEdit;
        
        console.log("DEBUG - Dados da despesa para edição:", expenseToEdit);
        
        if (!expenseToEdit) {
          console.warn("Nenhuma despesa para editar encontrada nos parâmetros da rota");
          return;
        }

        // --- Edição de Despesa de Crédito ---
        if (paymentMethod === 'Crédito') {
            const novoNumParcelas = parseInt(numInstallments, 10);
            const valorParcela = value / novoNumParcelas;
            const now = new Date().toISOString();

            const selectedCard = cards.find(card => card.id === selectedCardId);
            if (!selectedCard) {
                Alert.alert('Erro', 'Cartão selecionado não encontrado. Por favor, tente novamente.');
                setSavingExpense(false);
                return;
            }
            const dueDayOfMonthCard = selectedCard.dueDayOfMonth;

            // Remove todas as parcelas antigas desta despesa (usando originalExpenseId)
            expenses = expenses.filter(e => e.originalExpenseId !== expenseToEdit.originalExpenseId);
            
            // Recalcula a primeira data de vencimento com base na `purchaseDate` do estado atual
            let currentDueDate = getFirstCreditDueDate(purchaseDate, dueDayOfMonthCard);

            // Cria novas parcelas com o número correto e as datas de vencimento ajustadas
            for (let i = 1; i <= novoNumParcelas; i++) {
                const novaParcela = {
                    id: `${expenseToEdit.originalExpenseId}-${i}`, // Mantém o ID base original
                    description: expenseName.trim(),
                    value: valorParcela,
                    paymentMethod: 'Crédito',
                    purchaseDate: purchaseDate.toISOString(), // Usa a nova data de compra
                    dueDate: currentDueDate.toISOString(),
                    cardId: selectedCardId,
                    installmentNumber: i,
                    totalInstallments: novoNumParcelas,
                    originalExpenseId: expenseToEdit.originalExpenseId,
                    createdAt: expenseToEdit.createdAt, // Mantém o createdAt original
                    modifiedAt: now,
                    status: 'pending', // Assume novas parcelas como pendentes
                    paidAt: null
                };

                expenses.push(novaParcela);
                
                // Calcula a data da próxima parcela
                currentDueDate = getNextInstallmentDueDate(currentDueDate, dueDayOfMonthCard);
            }
        
            Alert.alert('Sucesso', 'Despesa de crédito atualizada com sucesso!');

        } else {
            // --- Edição de Despesa de Débito e Fixa (atualiza a despesa única) ---
            const expenseToUpdate = expenses.find(exp => exp.id === currentExpenseId);
            if (expenseToUpdate) {
                const now = new Date().toISOString();
                let updatedExpense = {
                    ...expenseToUpdate,
                    description: expenseName.trim(),
                    value: value,
                    modifiedAt: now
                };

                if (paymentMethod === 'Débito') {
                    updatedExpense.purchaseDate = purchaseDate.toISOString();
                    updatedExpense.dueDate = purchaseDate.toISOString();
                    // Limpa campos específicos de crédito/fixa
                    delete updatedExpense.cardId;
                    delete updatedExpense.installmentNumber;
                    delete updatedExpense.totalInstallments;
                    delete updatedExpense.originalExpenseId;
                    delete updatedExpense.dueDayOfMonth;
                } else if (paymentMethod === 'Fixa') {
                    let dayForFixedExpense = parseInt(fixedExpenseDueDay, 10);
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();
                    const lastDayOfCurrentMonth = getLastDayOfMonth(currentYear, currentMonth);
                    if (dayForFixedExpense > lastDayOfCurrentMonth) {
                        dayForFixedExpense = lastDayOfCurrentMonth;
                    }
                    updatedExpense.dueDayOfMonth = dayForFixedExpense;
                    // Limpa campos específicos de débito/crédito
                    delete updatedExpense.purchaseDate;
                    delete updatedExpense.cardId;
                    delete updatedExpense.installmentNumber;
                    delete updatedExpense.totalInstallments;
                    delete updatedExpense.originalExpenseId;
                    delete updatedExpense.dueDate;
                }
                // Encontra e atualiza a despesa no array
                const index = expenses.findIndex(e => e.id === currentExpenseId);
                if (index !== -1) {
                    expenses[index] = updatedExpense;
                }
            }
            Alert.alert('Sucesso', 'Despesa atualizada com sucesso!');
        }
        
        // Salva todas as alterações no AsyncStorage
        try {
          await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
          await AsyncStorage.setItem('LAST_UPDATE', new Date().toISOString());
          navigation.navigate('Home', {
            refresh: true,
            timestamp: Date.now() // Força um refresh na tela Home
          });
        } catch (error) {
          console.error("DespesaScreen: Erro ao salvar despesa no AsyncStorage:", error);
          Alert.alert('Erro', 'Houve um erro ao salvar a despesa. Por favor, tente novamente.');
        }

      } else {
        // --- Lógica para Adicionar Nova Despesa ---
        expenseDataTemplate.createdAt = new Date().toISOString(); // Define o timestamp de criação

        if (paymentMethod === 'Débito') {
          const newExpense = {
            ...expenseDataTemplate,
            id: Date.now().toString(), // ID único
            purchaseDate: purchaseDate.toISOString(),
            dueDate: purchaseDate.toISOString(), // Para débito, data de compra = data de vencimento
          };
          expenses.push(newExpense);
          Alert.alert('Sucesso', 'Despesa de débito adicionada com sucesso!');
          console.log("Nova despesa de débito adicionada:", newExpense);

        } else if (paymentMethod === 'Crédito') {
          const totalNumInstallments = parseInt(numInstallments, 10);
          const installmentValue = value / totalNumInstallments;
          const originalExpenseUniqueId = Date.now().toString(); // ID base para todas as parcelas

          const selectedCreditCard = cards.find(card => card.id === selectedCardId);
          if (!selectedCreditCard) {
            Alert.alert('Erro', 'Cartão selecionado não encontrado. Por favor, tente novamente.');
            setSavingExpense(false);
            return;
          }
          const dueDayOfMonthCard = selectedCreditCard.dueDayOfMonth;

          // Calcula a primeira data de vencimento da parcela
          let currentDueDate = getFirstCreditDueDate(purchaseDate, dueDayOfMonthCard);

          for (let i = 1; i <= totalNumInstallments; i++) {
            const installmentData = {
              ...expenseDataTemplate,
              id: `${originalExpenseUniqueId}-${i}`, // ID da parcela
              value: installmentValue,
              paymentMethod: 'Crédito',
              cardId: selectedCardId,
              installmentNumber: i,
              totalInstallments: totalNumInstallments,
              originalExpenseId: originalExpenseUniqueId,
              dueDate: currentDueDate.toISOString(),
              purchaseDate: purchaseDate.toISOString(),
              status: 'pending', // Novas parcelas são sempre pendentes
            };
            expenses.push(installmentData);
            if (i < totalNumInstallments) {
                // Calcula a data da próxima parcela
                currentDueDate = getNextInstallmentDueDate(currentDueDate, dueDayOfMonthCard);
            }
          }
          Alert.alert('Sucesso', `${totalNumInstallments} parcelas de crédito adicionadas com sucesso!`);
          console.log("Parcelas de crédito adicionadas, originalExpenseId:", originalExpenseUniqueId);
        } else if (paymentMethod === 'Fixa') {
          let dayForFixedExpense = parseInt(fixedExpenseDueDay, 10);
          const today = new Date();
          let startMonth = today.getMonth();
          let startYear = today.getFullYear();

          // Se o dia escolhido for menor que o dia atual, começa no próximo mês
          if (dayForFixedExpense <= today.getDate()) {
            startMonth += 1;
            if (startMonth > 11) {
              startMonth = 0;
              startYear += 1;
            }
          }

          // Ajusta o dia caso seja maior que o último dia do mês inicial
          const lastDayOfStartMonth = getLastDayOfMonth(startYear, startMonth);
          if (dayForFixedExpense > lastDayOfStartMonth) {
              dayForFixedExpense = lastDayOfStartMonth;
          }

          const newExpense = {
            ...expenseDataTemplate,
            id: Date.now().toString(),
            status: 'pending', // Novas despesas fixas são pendentes por padrão
            dueDayOfMonth: dayForFixedExpense, // Dia de vencimento fixo mensal
            startMonth: startMonth,    // Adiciona mês inicial
            startYear: startYear,      // Adiciona ano inicial
          };
          expenses.push(newExpense);
          Alert.alert('Sucesso', 'Despesa fixa adicionada com sucesso!');
          console.log("Nova despesa fixa adicionada:", newExpense);
        }
      }

      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(expenses)); // Persiste no AsyncStorage
      await AsyncStorage.setItem('LAST_UPDATE', new Date().toISOString()); // Atualiza o timestamp de última modificação
      
      // Reseta o formulário após salvar com sucesso
      setExpenseName('');
      setExpenseValue('');
      setPaymentMethod('Débito');
      setPurchaseDate(new Date());
      setSelectedCardId(''); 
      setNumInstallments('1');
      setFixedExpenseDueDay('1');
      setIsEditing(false);
      setCurrentExpenseId(null);
      setCurrentExpenseDeletedAt(null); 
      setIsInstallmentsEditable(true);

      setTimeout(() => {
        navigation.goBack(); // Volta para a tela anterior
      }, 100);

    } catch (error) {
      console.error("DespesaScreen: Erro ao salvar despesa no AsyncStorage:", error);
      Alert.alert('Erro', `Ocorreu um erro ao salvar a despesa: ${error.message}. Tente novamente.`);
    } finally {
      setSavingExpense(false); // Finaliza o indicador de carregamento
    }
  };

  /**
   * Função para lidar com a exclusão suave (soft delete) de uma despesa.
   * Marca a despesa como inativa e adiciona um timestamp de exclusão.
   * Para despesas de crédito, inativa todas as parcelas relacionadas.
   */
  const handleDeleteExpense = async () => {
    if (!currentExpenseId) {
      console.warn('Tentativa de excluir despesa sem ID.');
      return;
    }

    setSavingExpense(true); // Usa o mesmo indicador de loading para exclusão
    setShowDeleteModal(false); // Fecha o modal de confirmação

    try {
      const baseId = currentExpenseId.split('-')[0]; // Extrai o ID base
      console.log('Tentando excluir despesa - ID base:', baseId, 'ID completo:', currentExpenseId);
      
      let expenses = JSON.parse(await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES)) || [];
      console.log('Total de despesas encontradas:', expenses.length);
      console.log('IDs das despesas disponíveis:', expenses.map(e => e.id));
      
      // Encontra a despesa original ou qualquer parcela relacionada para determinar o tipo
      const currentExpense = expenses.find(exp => 
        exp.id === baseId || 
        exp.id.startsWith(baseId + '-') || 
        exp.originalExpenseId === baseId
      );
      
      if (!currentExpense) {
        console.error('Despesa não encontrada. ID procurado:', currentExpenseId);
        throw new Error('Despesa não encontrada.');
      }

      console.log('Excluindo despesa:', currentExpense);
      
      const updatedExpenses = expenses.map(exp => {
        // Se for despesa de Crédito, marca todas as parcelas com o mesmo `originalExpenseId` como inativas
        if (currentExpense.paymentMethod === 'Crédito' && 
            (exp.id.startsWith(baseId + '-') || exp.originalExpenseId === baseId)) {
          return {
            ...exp,
            status: 'inactive',
            deletedAt: new Date().toISOString(),
          };
        } 
        // Para despesas Fixas ou de Débito, marca apenas a despesa específica como inativa
        else if (exp.id === currentExpenseId) {
          console.log('Marcando despesa como inativa:', {
            id: exp.id,
            tipo: exp.paymentMethod,
            descricao: exp.description
          });
          
          if (exp.paymentMethod === 'Fixa') {
            // Para despesas fixas, pode-se adicionar lógica futura para meses excluídos
            return {
              ...exp,
              status: 'inactive',
              deletedAt: new Date().toISOString(),
              excludedMonths: exp.excludedMonths || []
            };
          }
          
          return {
            ...exp,
            status: 'inactive',
            deletedAt: new Date().toISOString(),
          };
        }
        return exp; // Retorna despesas inalteradas
      });

      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(updatedExpenses));
      Alert.alert('Sucesso', 'Despesa excluída com sucesso (marcada como inativa)!');
      navigation.goBack(); // Volta para a tela anterior
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao excluir a despesa. Tente novamente.');
    } finally {
      setSavingExpense(false); // Finaliza o indicador de carregamento
    }
  };

  // Array de dias do mês para o Picker de despesas fixas
  const daysInMonth = Array.from({ length: 31 }, (_, i) => String(i + 1));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={commonStyles.title}>{isEditing ? "Editar Despesa" : "Adicionar Nova Despesa"}</Text>

        <TextInput
          style={commonStyles.input}
          placeholder="Descrição da Despesa (Ex: Supermercado, Aluguel)"
          value={expenseName}
          onChangeText={setExpenseName}
        />

        <TextInput
          style={styles.currencyInput}
          placeholder="R$ 0,00"
          keyboardType="numeric"
          value={expenseValue ? `R$ ${expenseValue}` : ''}
          onChangeText={(text) => {
            // Remove tudo exceto números
            const numbers = text.replace(/\D/g, '');
            
            // Converte para centavos (divide por 100 para ter 2 casas decimais)
            const amount = (parseInt(numbers || '0') / 100).toFixed(2);
            
            // Formata sem o prefixo R$ para o estado
            if (numbers) {
              setExpenseValue(amount.replace('.', ','));
            } else {
              setExpenseValue('');
            }
          }}
        />

        {/* Seletor/Exibição de método de pagamento */}
        <View style={commonStyles.typeSelectionContainer}>
          <Text style={commonStyles.pickerLabel}>Método de Pagamento:</Text>
          {isEditing ? (
            // Em modo de edição, apenas exibe o método atual (não editável)
            <View style={[commonStyles.typeButtonsWrapper, { opacity: 0.7 }]}>
              <View style={[commonStyles.typeButton, commonStyles.typeButtonSelected]}>
                <Text style={[commonStyles.typeButtonText, commonStyles.typeButtonTextSelected]}>
                  {paymentMethod}
                </Text>
              </View>
            </View>
          ) : (
            // Em modo de adição, permite selecionar o método de pagamento
            <View style={commonStyles.typeButtonsWrapper}>
              <TouchableOpacity
                style={[
                  commonStyles.typeButton,
                  paymentMethod === 'Débito' ? commonStyles.typeButtonSelected : commonStyles.typeButtonUnselected
                ]}
                onPress={() => setPaymentMethod('Débito')}
              >
                <Text style={[
                  commonStyles.typeButtonText,
                  paymentMethod === 'Débito' ? commonStyles.typeButtonTextSelected : commonStyles.typeButtonTextUnselected
                ]}>Débito</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  commonStyles.typeButton,
                  paymentMethod === 'Crédito' ? commonStyles.typeButtonSelected : commonStyles.typeButtonUnselected
                ]}
                onPress={() => setPaymentMethod('Crédito')}
              >
                <Text style={[
                  commonStyles.typeButtonText,
                  paymentMethod === 'Crédito' ? commonStyles.typeButtonTextSelected : commonStyles.typeButtonTextUnselected
                ]}>Crédito</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  commonStyles.typeButton,
                  paymentMethod === 'Fixa' ? commonStyles.typeButtonSelected : commonStyles.typeButtonUnselected
                ]}
                onPress={() => setPaymentMethod('Fixa')}
              >
                <Text style={[
                  commonStyles.typeButtonText,
                  paymentMethod === 'Fixa' ? commonStyles.typeButtonTextSelected : commonStyles.typeButtonTextUnselected
                ]}>Fixa</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Campos de Data da Compra (exibidos para Débito e Crédito) */}
        {(paymentMethod === 'Débito' || paymentMethod === 'Crédito') && (
          <>
            <View style={commonStyles.datePickerSection}>
              <Text style={commonStyles.pickerLabel}>Data da Compra:</Text>
              <TouchableOpacity onPress={showDatepicker} style={commonStyles.dateDisplayButton}>
                <Text style={commonStyles.dateDisplayText}>
                  {purchaseDate.toLocaleDateString('pt-BR')}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  testID="datePicker"
                  value={purchaseDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                />
              )}
            </View>
          </>
        )}

        {/* Campos específicos para Despesas de Crédito */}
        {paymentMethod === 'Crédito' && (
          <View style={styles.creditOptionsContainer}>
            {cards.length > 0 ? (
              // Se há cartões cadastrados, exibe o seletor de cartão e o input de parcelas
              <>
                <View style={commonStyles.pickerContainer}>
                  <Text style={commonStyles.pickerLabel}>Selecione o Cartão:</Text>
                  <Picker
                    selectedValue={selectedCardId}
                    onValueChange={(itemValue) => setSelectedCardId(itemValue)}
                    style={commonStyles.picker}
                  >
                    <Picker.Item label="Selecione um Cartão" value="" />
                    {cards.map(card => (
                      <Picker.Item key={card.id} label={String(card.alias || '')} value={card.id} />
                    ))}
                  </Picker>
                </View>

                <View style={styles.installmentInputContainer}>
                  <Text style={commonStyles.pickerLabel}>Número de Parcelas:</Text>
                  <TextInput
                    style={commonStyles.input}
                    placeholder="Ex: 1, 3, 12"
                    keyboardType="numeric"
                    value={numInstallments}
                    onChangeText={(text) => setNumInstallments(text.replace(/[^0-9]/g, ''))}
                    editable={isInstallmentsEditable}
                  />
                </View>
              </>
            ) : (
              // Mensagem se não houver cartões cadastrados
              <View style={styles.noCardsMessageContainer}>
                <Text style={styles.noCardsText}>Nenhum cartão cadastrado. Cadastre um para usar o crédito!</Text>
                <TouchableOpacity
                  style={styles.goToCardsButton}
                  onPress={() => navigation.navigate('CartaoTab')}
                >
                  <Text style={styles.goToCardsButtonText}>Ir para Meus Cartões</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Campos específicos para Despesa Fixa */}
        {paymentMethod === 'Fixa' && (
          <View style={styles.fixedExpenseDayContainer}>
            <Text style={commonStyles.pickerLabel}>Dia do Pagamento (1-31):</Text>
            <View style={commonStyles.pickerContainer}>
              <Picker
                selectedValue={fixedExpenseDueDay}
                onValueChange={(itemValue) => setFixedExpenseDueDay(itemValue)}
                style={commonStyles.picker}
              >
                {daysInMonth.map(day => (
                  <Picker.Item key={day} label={day} value={day} />
                ))}
              </Picker>
            </View>
          </View>
        )}

        {/* Botão para Salvar/Adicionar Despesa */}
        <TouchableOpacity
          style={commonStyles.addButton}
          onPress={handleSaveExpense}
          disabled={savingExpense}
        >
          {savingExpense ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={commonStyles.buttonText}>{isEditing ? "Salvar Alterações" : "Adicionar Despesa"}</Text>
          )}
        </TouchableOpacity>

        {/* Botão para Excluir Despesa (aparece apenas em modo de edição) */}
        {isEditing && (
          <TouchableOpacity
            style={commonStyles.deleteButton} // Estilo para o botão de exclusão
            onPress={() => setShowDeleteModal(true)} // Abre o modal de confirmação
            disabled={savingExpense} // Desabilita enquanto salva/exclui
          >
            <Text style={commonStyles.buttonText}>Excluir Despesa</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showDeleteModal}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable style={commonStyles.centeredView} onPressOut={() => setShowDeleteModal(false)}>
          <Pressable style={commonStyles.modalView} onPress={(e) => e.stopPropagation()}>
            <Text style={commonStyles.modalTitle}>Confirmar Exclusão</Text>
            <Text style={commonStyles.modalText}>
              Tem certeza que deseja excluir esta despesa?
              Ela será marcada como inativa e não aparecerá nos resumos.
            </Text>
            <View style={commonStyles.modalActionButtonsContainer}>
              <TouchableOpacity
                style={[commonStyles.modalButton, commonStyles.buttonDanger]}
                onPress={handleDeleteExpense}
              >
                <Text style={commonStyles.buttonTextStyle}>Excluir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[commonStyles.modalButton, commonStyles.buttonClose]}
                onPress={() => setShowDeleteModal(false)}
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

// --- Estilos da Tela ---
const styles = StyleSheet.create({
  container: {
    ...commonStyles.container,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  creditOptionsContainer: {
    marginBottom: 15,
  },
  installmentInputContainer: {
    marginBottom: 15,
  },
  fixedExpenseDayContainer: {
    marginBottom: 15,
  },
  currencyInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  noCardsMessageContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffeb3b',
  },
  noCardsText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 10,
  },
  goToCardsButton: {
    backgroundColor: '#007bff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  goToCardsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickerStyleOverride: {
    height: 50,
    width: '100%',
  },
  statusToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
});

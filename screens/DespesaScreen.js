// screens/DespesaScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert, ActivityIndicator, ScrollView, Modal, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';

// Importa os estilos comuns e as chaves de armazenamento como constantes para reutilização
import commonStyles from '../utils/commonStyles';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';

// Importa useFocusEffect
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

  const [expenseName, setExpenseName] = useState('');
  const [expenseValue, setExpenseValue] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState('Débito');
  
  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [numInstallments, setNumInstallments] = useState('1');

  // Estado para o dia de vencimento de despesas fixas
  const [fixedExpenseDueDay, setFixedExpenseDueDay] = useState('1');

  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [savingExpense, setSavingExpense] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [currentExpenseId, setCurrentExpenseId] = useState(null);
  const [currentExpenseDeletedAt, setCurrentExpenseDeletedAt] = useState(null);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false); // Estado para o modal de exclusão

  const [isInstallmentsEditable, setIsInstallmentsEditable] = useState(true);

  // Carrega os cartões ativos do AsyncStorage para exibição no Picker
  const loadCards = useCallback(async () => {
    try {
      const storedCardsJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CARDS);
      const storedCards = storedCardsJson ? JSON.parse(storedCardsJson) : [];
      const activeCards = storedCards.filter(card => card.status !== 'inactive');
      setCards(activeCards);
      
      console.log("DespesaScreen: Cartões ativos carregados:", activeCards.map(c => ({id: c.id, alias: c.alias, dueDayOfMonth: c.dueDayOfMonth})));

      // Logic to set/update selectedCardId
      setSelectedCardId(prevSelectedCardId => {
        if (activeCards.length > 0) {
          if (prevSelectedCardId && activeCards.some(card => card.id === prevSelectedCardId)) {
            return prevSelectedCardId;
          } else {
            return activeCards[0].id;
          }
        } else {
          return '';
        }
      });
    } catch (error) {
      console.error("DespesaScreen: Erro ao carregar cartões do AsyncStorage:", error);
    }
  }, []);

  // useFocusEffect para inicializar/resetar a tela ao focar
  useFocusEffect(
    useCallback(() => {
      loadCards();

      if (route.params?.expenseToEdit) {
        const expense = route.params.expenseToEdit;
        // Extrai o ID base (removendo sufixos de parcela ou mês/ano)
        const baseId = expense.originalExpenseId || expense.id.split('-')[0];
        
        console.log('Recebendo despesa para edição:', {
          id: expense.id,
          baseId,
          description: expense.description,
          paymentMethod: expense.paymentMethod
        });
        
        setIsEditing(true);
        setCurrentExpenseId(baseId); // Usa o ID base
        setExpenseName(expense.description);
        
        // Para despesas de crédito, calcula o valor total
        if (expense.paymentMethod === 'Crédito') {
          const valorTotal = expense.value * (expense.totalInstallments || 1);
          setExpenseValue(valorTotal.toFixed(2).replace('.', ','));
        } else {
          setExpenseValue(expense.value.toFixed(2).replace('.', ','));
        }

        setPaymentMethod(expense.paymentMethod || 'Débito');
        setIsInstallmentsEditable(true); // Sempre permite editar parcelas

        if (expense.paymentMethod === 'Débito') {
          setPurchaseDate(new Date(expense.purchaseDate || expense.createdAt));
          setFixedExpenseDueDay('1');
        } else if (expense.paymentMethod === 'Crédito') {
          setPurchaseDate(new Date(expense.purchaseDate || expense.createdAt));
          setSelectedCardId(expense.cardId || '');
          setNumInstallments(String(expense.totalInstallments || '1')); // Garante que seja string
          setFixedExpenseDueDay('1');
        } else if (expense.paymentMethod === 'Fixa') {
          setPurchaseDate(new Date());
          setSelectedCardId('');
          setNumInstallments('1');
          setFixedExpenseDueDay(String(expense.dueDayOfMonth || '1'));
        }

        setCurrentExpenseDeletedAt(expense.deletedAt || null);

      } else {
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

      return () => {
        navigation.setParams({ expenseToEdit: undefined });
      };
    }, [navigation, route.params?.expenseToEdit, loadCards])
  );

  // Handler para mudança de data no DateTimePicker
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setPurchaseDate(selectedDate);
    }
  };

  // Exibe o DateTimePicker
  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  // Handler para salvar/atualizar a despesa
  const handleSaveExpense = async () => {
    console.log('Estado atual ao salvar:', {
      isEditing,
      currentExpenseId,
      paymentMethod,
      expenseName: expenseName.trim()
    });

    if (!expenseName.trim() || !expenseValue.trim()) {
      Alert.alert('Erro', 'Por favor, preencha a descrição e o valor da despesa.');
      return;
    }
    const value = parseFloat(expenseValue.replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      Alert.alert('Erro', 'Por favor, insira um valor válido para a despesa.');
      return;
    }

    // Validações específicas para despesas de crédito
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

    // Validações específicas para despesas fixas
    if (paymentMethod === 'Fixa') {
      const day = parseInt(fixedExpenseDueDay, 10);
      if (isNaN(day) || day < 1 || day > 31) {
        Alert.alert('Erro', 'Para despesas fixas, por favor, selecione um dia de pagamento válido (entre 1 e 31).');
        return;
      }
    }

    setSavingExpense(true);

    try {
      const existingExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      let expenses = existingExpensesJson ? JSON.parse(existingExpensesJson) : [];

      // Template básico para os dados da despesa
      let expenseDataTemplate = {
        description: expenseName.trim(),
        value: value,
        paymentMethod: isEditing ? route.params?.expenseToEdit?.paymentMethod : paymentMethod,
        deletedAt: currentExpenseDeletedAt,
      };

      // Lógica para edição de despesa existente
      if (isEditing && currentExpenseId) {
        // Encontra a despesa específica para editar
        const expenseToEdit = route.params?.expenseToEdit;
        
        console.log("DEBUG - Dados da despesa para edição:", expenseToEdit);
        
        // Se não temos uma despesa para editar, não continua
        if (!expenseToEdit) {
          console.warn("Nenhuma despesa para editar encontrada nos parâmetros da rota");
          return;
        }

        // Lógica para edição de despesa de crédito
        if (paymentMethod === 'Crédito') {
            const novoNumParcelas = parseInt(numInstallments, 10);
            const valorParcela = value / novoNumParcelas;
            const now = new Date().toISOString();

            // Encontra o cartão de crédito selecionado para obter o dia de vencimento
            const selectedCard = cards.find(card => card.id === selectedCardId);
            if (!selectedCard) {
                Alert.alert('Erro', 'Cartão selecionado não encontrado. Por favor, tente novamente.');
                setSavingExpense(false);
                return;
            }
            const dueDayOfMonthCard = selectedCard.dueDayOfMonth;

            // Remove todas as parcelas antigas desta despesa do array
            expenses = expenses.filter(e => e.originalExpenseId !== expenseToEdit.originalExpenseId);
            
            // Calcula a primeira data de vencimento com base na data da compra original
            const firstPurchaseDate = new Date(expenseToEdit.purchaseDate);
            let currentDueDate = getFirstCreditDueDate(firstPurchaseDate, dueDayOfMonthCard);

            // Cria novas parcelas com o número correto e as datas de vencimento ajustadas
            for (let i = 1; i <= novoNumParcelas; i++) {
                const novaParcela = {
                    id: `${expenseToEdit.originalExpenseId}-${i}`,
                    description: expenseName.trim(),
                    value: valorParcela,
                    paymentMethod: 'Crédito',
                    purchaseDate: firstPurchaseDate.toISOString(),
                    dueDate: currentDueDate.toISOString(),
                    cardId: selectedCardId,
                    installmentNumber: i,
                    totalInstallments: novoNumParcelas,
                    originalExpenseId: expenseToEdit.originalExpenseId,
                    createdAt: expenseToEdit.createdAt,
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
            // Lógica de edição para Débito e Fixa (mantida como estava)
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
                    delete updatedExpense.purchaseDate;
                    delete updatedExpense.cardId;
                    delete updatedExpense.installmentNumber;
                    delete updatedExpense.totalInstallments;
                    delete updatedExpense.originalExpenseId;
                    delete updatedExpense.dueDate;
                }
                const index = expenses.findIndex(e => e.id === currentExpenseId);
                if (index !== -1) {
                    expenses[index] = updatedExpense;
                }
            }
            Alert.alert('Sucesso', 'Despesa atualizada com sucesso!');
        }
        
        // Salva as alterações no AsyncStorage
        try {
          await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
          await AsyncStorage.setItem('LAST_UPDATE', new Date().toISOString());
          navigation.navigate('Home', {
            refresh: true,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error("DespesaScreen: Erro ao salvar despesa no AsyncStorage:", error);
          Alert.alert('Erro', 'Houve um erro ao salvar a despesa. Por favor, tente novamente.');
        }

      } else {
        // Lógica para adicionar nova despesa
        expenseDataTemplate.createdAt = new Date().toISOString();

        if (paymentMethod === 'Débito') {
          const newExpense = {
            ...expenseDataTemplate,
            id: Date.now().toString(),
            purchaseDate: purchaseDate.toISOString(),
            dueDate: purchaseDate.toISOString(),
          };
          expenses.push(newExpense);
          Alert.alert('Sucesso', 'Despesa de débito adicionada com sucesso!');
          console.log("Nova despesa de débito adicionada:", newExpense);

        } else if (paymentMethod === 'Crédito') {
          const totalNumInstallments = parseInt(numInstallments, 10);
          const installmentValue = value / totalNumInstallments;
          const originalExpenseUniqueId = Date.now().toString();

          const selectedCreditCard = cards.find(card => card.id === selectedCardId);
          if (!selectedCreditCard) {
            Alert.alert('Erro', 'Cartão selecionado não encontrado. Por favor, tente novamente.');
            setSavingExpense(false);
            return;
          }
          const dueDayOfMonthCard = selectedCreditCard.dueDayOfMonth;

          let currentDueDate = getFirstCreditDueDate(purchaseDate, dueDayOfMonthCard);

          for (let i = 1; i <= totalNumInstallments; i++) {
            const installmentData = {
              ...expenseDataTemplate,
              id: `${originalExpenseUniqueId}-${i}`,
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
                currentDueDate = getNextInstallmentDueDate(currentDueDate, dueDayOfMonthCard);
            }
          }
          Alert.alert('Sucesso', `${totalNumInstallments} parcelas de crédito adicionadas com sucesso!`);
          console.log("Parcelas de crédito adicionadas, originalExpenseId:", originalExpenseUniqueId);
        } else if (paymentMethod === 'Fixa') {
          let dayForFixedExpense = parseInt(fixedExpenseDueDay, 10);
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          const lastDayOfCurrentMonth = getLastDayOfMonth(currentYear, currentMonth);
          if (dayForFixedExpense > lastDayOfCurrentMonth) {
              dayForFixedExpense = lastDayOfCurrentMonth;
          }

          const newExpense = {
            ...expenseDataTemplate,
            id: Date.now().toString(),
            status: 'pending', // Novas despesas fixas são pendentes por padrão
            dueDayOfMonth: dayForFixedExpense,
          };
          expenses.push(newExpense);
          Alert.alert('Sucesso', 'Despesa fixa adicionada com sucesso!');
          console.log("Nova despesa fixa adicionada:", newExpense);
        }
      }

      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
      
      // Reseta o formulário após salvar
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
        navigation.goBack(); 
      }, 100);

    } catch (error) {
      console.error("DespesaScreen: Erro ao salvar despesa no AsyncStorage:", error);
      Alert.alert('Erro', `Ocorreu um erro ao salvar a despesa: ${error.message}. Tente novamente.`);
    } finally {
      setSavingExpense(false);
    }
  };

  /**
   * Função para lidar com a exclusão suave (soft delete) de uma despesa.
   * Marca a despesa como inativa e adiciona um timestamp de exclusão.
   */
  const handleDeleteExpense = async () => {
    if (!currentExpenseId) {
      console.warn('Tentativa de excluir despesa sem ID.');
      return;
    }

    setSavingExpense(true); // Usar o mesmo indicador de loading
    setShowDeleteModal(false); // Fecha o modal de confirmação

    try {
      // Extrai o ID base (removendo qualquer sufixo)
      const baseId = currentExpenseId.split('-')[0];
      console.log('Tentando excluir despesa - ID base:', baseId, 'ID completo:', currentExpenseId);
      
      let expenses = JSON.parse(await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES)) || [];
      console.log('Total de despesas encontradas:', expenses.length);
      console.log('IDs das despesas disponíveis:', expenses.map(e => e.id));
      
      // Procura a despesa original ou qualquer parcela relacionada
      const currentExpense = expenses.find(exp => 
        exp.id === baseId || // ID exato
        exp.id.startsWith(baseId + '-') || // Parcela de crédito
        exp.originalExpenseId === baseId // Referência à despesa original
      );
      
      if (!currentExpense) {
        console.error('Despesa não encontrada. ID procurado:', currentExpenseId);
        throw new Error('Despesa não encontrada.');
      }

      console.log('Excluindo despesa:', currentExpense); // Log para debug
      
      const updatedExpenses = expenses.map(exp => {
        // Para despesas de crédito, verifica se é parte do mesmo conjunto de parcelas
        const baseId = currentExpenseId.split('-')[0];
        if (currentExpense.paymentMethod === 'Crédito' && 
            (exp.id === baseId || // ID base
             exp.id.startsWith(baseId + '-') || // Parcelas relacionadas
             exp.originalExpenseId === baseId || // Referência à despesa original
             (currentExpense.originalExpenseId && exp.originalExpenseId === currentExpense.originalExpenseId))) {
          return {
            ...exp,
            status: 'inactive',
            deletedAt: new Date().toISOString(),
          };
        } 
        // Para despesas fixas ou de débito, marca apenas a despesa específica
        else if (exp.id === currentExpenseId) {
          console.log('Marcando despesa como inativa:', {
            id: exp.id,
            tipo: exp.paymentMethod,
            descricao: exp.description
          }); // Log para debug
          
          if (exp.paymentMethod === 'Fixa') {
            // Para despesas fixas, adiciona um array de meses excluídos se ainda não existir
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
        return exp;
      });

      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(updatedExpenses));
      Alert.alert('Sucesso', 'Despesa excluída com sucesso (marcada como inativa)!');
      navigation.goBack(); // Volta para a tela anterior
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao excluir a despesa. Tente novamente.');
    } finally {
      setSavingExpense(false);
    }
  };

  const daysInMonth = Array.from({ length: 31 }, (_, i) => String(i + 1));

  return (
    <View style={[commonStyles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={commonStyles.title}>{isEditing ? "Editar Despesa" : "Adicionar Nova Despesa"}</Text>

        <TextInput
          style={commonStyles.input}
          placeholder="Descrição da Despesa (Ex: Supermercado, Aluguel)"
          value={expenseName}
          onChangeText={setExpenseName}
        />

        <TextInput
          style={commonStyles.input}
          placeholder="Valor (R$)"
          keyboardType="numeric"
          value={expenseValue}
          onChangeText={(text) => setExpenseValue(text.replace(/[^0-9,.]/g, '').replace('.', ','))}
        />

        {/* Seletor/Exibição de método de pagamento */}
        <View style={commonStyles.typeSelectionContainer}>
          <Text style={commonStyles.pickerLabel}>Método de Pagamento:</Text>
          {isEditing ? (
            // Quando estiver editando, apenas mostra o método atual
            <View style={[commonStyles.typeButtonsWrapper, { opacity: 0.7 }]}>
              <View style={[commonStyles.typeButton, commonStyles.typeButtonSelected]}>
                <Text style={[commonStyles.typeButtonText, commonStyles.typeButtonTextSelected]}>
                  {paymentMethod}
                </Text>
              </View>
            </View>
          ) : (
            // Quando estiver criando, permite selecionar o método
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

        {/* Campos de Data da Compra (para Débito e Crédito) */}
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

        {/* Campos específicos para Crédito */}
        {paymentMethod === 'Crédito' && (
          <View style={styles.creditOptionsContainer}>
            {cards.length > 0 ? (
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

const styles = StyleSheet.create({
  container: {
    ...commonStyles.container,
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
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

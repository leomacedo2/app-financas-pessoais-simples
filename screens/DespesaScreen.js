// screens/DespesaScreen.js

/**
 * @file Tela para adicionar ou editar despesas.
 * Este componente funciona como um formulário dinâmico,
 * permitindo ao usuário registrar novas despesas ou modificar existentes.
 *
 * Fase 1.6 - Revisada: A categoria "Fixa" foi movida para ser um método de pagamento,
 * junto com "Débito" e "Crédito". A exibição de campos como Data da Compra,
 * Cartão e Parcelas será condicional ao método de pagamento selecionado.
 *
 * Atualização: Adicionado campo "Dia do Pagamento" para despesas do tipo "Fixa",
 * permitindo especificar em que dia do mês a despesa fixa é esperada.
 *
 * NOVIDADE: Lógica para despesas de "Crédito" incluindo parcelamento e
 * ajuste de data de vencimento baseada no dia de vencimento do cartão.
 *
 * CORREÇÕES VISUAIS: Ajuste do layout para campos de crédito (rótulos e input).
 * SINCRONIZAÇÃO DE DATAS: Implementação de useFocusEffect para recarregar cartões
 * ao focar na tela, garantindo que as alterações da tela de cartões sejam refletidas.
 *
 * CORREÇÃO ERRO: Encapsulamento de strings de texto dentro de <Text> componentes foi resolvido.
 * CORREÇÃO VISUAL 2: Posicionamento do rótulo "Selecione o Cartão".
 * CORREÇÃO ATUAL: Ajuste na lógica de carregamento e seleção de cartões
 * para garantir que o Picker de cartões apareça corretamente preenchido
 * e não mostre "Nenhum cartão cadastrado" indevidamente.
 *
 * ATUALIZAÇÃO RECENTE: O campo "Dia do Pagamento" para despesas do tipo "Fixa" agora é um Picker,
 * permitindo a seleção de um dia válido (1-31) em vez de um TextInput.
 *
 * CORREÇÃO ATUAL 2: Resolvido o erro "Text strings must be rendered within a <Text> component"
 * que retornou após as últimas mudanças no Picker.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert, ActivityIndicator, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';

// Importa os estilos comuns e as chaves de armazenamento como constantes para reutilização
import commonStyles from '../utils/commonStyles';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';

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

  if (pDate.getDate() >= cardDueDayOfMonth) {
    month += 1;
  }

  if (month > 11) {
    month = 0; // Janeiro
    year += 1;
  }

  let calculatedDueDate = new Date(year, month, day);

  // Se o dia do mês for maior que os dias do mês calculado (ex: 31 de fevereiro),
  // ajusta para o último dia do mês.
  if (calculatedDueDate.getMonth() !== month) {
    calculatedDueDate = new Date(year, month + 1, 0); 
  }

  return calculatedDueDate;
};


export default function DespesaScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const [expenseName, setExpenseName] = useState('');
  const [expenseValue, setExpenseValue] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState('Débito'); 
  
  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [numInstallments, setNumInstallments] = useState('1');

  const [fixedExpenseDueDay, setFixedExpenseDueDay] = useState('1'); 

  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [savingExpense, setSavingExpense] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [currentExpenseId, setCurrentExpenseId] = useState(null);
  const [currentExpenseStatus, setCurrentExpenseStatus] = useState(null);
  const [currentExpensePaidAt, setCurrentExpensePaidAt] = useState(null);
  const [currentExpenseDeletedAt, setCurrentExpenseDeletedAt] = useState(null);

  const [isInstallmentsEditable, setIsInstallmentsEditable] = useState(true);

  /**
   * Função para carregar os cartões do AsyncStorage.
   */
  const loadCards = useCallback(async () => {
    try {
      const storedCardsJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CARDS);
      const storedCards = storedCardsJson ? JSON.parse(storedCardsJson) : [];
      const activeCards = storedCards.filter(card => card.status !== 'inactive');
      setCards(activeCards);

      if (activeCards.length > 0) {
        // Se já houver um cartão selecionado e ele ainda estiver ativo, mantém.
        // Caso contrário, seleciona o primeiro cartão ativo.
        if (!selectedCardId || !activeCards.some(card => card.id === selectedCardId)) {
          setSelectedCardId(activeCards[0].id);
        }
      } else {
        setSelectedCardId(null); // Limpa a seleção se não houver cartões ativos
      }
    } catch (error) {
      console.error("DespesaScreen: Erro ao carregar cartões do AsyncStorage:", error);
    }
  }, [selectedCardId]); // Mantém selectedCardId como dependência para garantir que a pré-seleção funcione ao carregar

  useEffect(() => {
    if (route.params?.expenseToEdit) {
      const expense = route.params.expenseToEdit;
      setIsEditing(true);
      setCurrentExpenseId(expense.id);
      setExpenseName(expense.description);
      setExpenseValue(expense.value.toFixed(2).replace('.', ','));

      setPaymentMethod(expense.paymentMethod || 'Débito');

      // Desabilita a edição de parcelas se for uma despesa de crédito parcelada
      setIsInstallmentsEditable(!(expense.paymentMethod === 'Crédito' && expense.totalInstallments > 1));

      if (expense.paymentMethod === 'Débito') {
        setPurchaseDate(new Date(expense.purchaseDate || expense.createdAt));
        setFixedExpenseDueDay('1');
      } else if (expense.paymentMethod === 'Crédito') {
        setPurchaseDate(new Date(expense.purchaseDate || expense.createdAt));
        setSelectedCardId(expense.cardId || null);
        setNumInstallments(String(expense.totalInstallments || 1));
        setFixedExpenseDueDay('1');
      } else if (expense.paymentMethod === 'Fixa') {
        setPurchaseDate(new Date()); // Reseta para data atual para não exibir um datepicker sem uso
        setSelectedCardId(null);
        setNumInstallments('1');
        setFixedExpenseDueDay(String(expense.dueDayOfMonth || '1'));
      }

      setCurrentExpenseStatus(expense.status || 'pending');
      setCurrentExpensePaidAt(expense.paidAt || null);
      setCurrentExpenseDeletedAt(expense.deletedAt || null);

    } else {
      setIsEditing(false);
      setCurrentExpenseId(null);
      setExpenseName('');
      setExpenseValue('');
      setPurchaseDate(new Date());
      setPaymentMethod('Débito');
      setSelectedCardId(null);
      setNumInstallments('1');
      setFixedExpenseDueDay('1');
      setCurrentExpenseStatus('pending');
      setCurrentExpensePaidAt(null);
      setCurrentExpenseDeletedAt(null);
      setIsInstallmentsEditable(true); // Habilita a edição para novas despesas
    }
  }, [route.params?.expenseToEdit]);

  // Use useFocusEffect para recarregar cartões sempre que a tela for focada
  useFocusEffect(
    useCallback(() => {
      loadCards();
      return () => {
        // Limpeza, se necessário, ao sair do foco
      };
    }, [loadCards])
  );

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setPurchaseDate(selectedDate);
    }
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  /**
   * Gera os itens <Picker.Item> para o seletor de dia (1 a 31).
   * @returns {JSX.Element[]} Um array de componentes Picker.Item.
   */
  const renderDayPickerItems = () => {
    const days = [];
    for (let i = 1; i <= 31; i++) {
      // Garante que label e value sejam strings numéricas explícitas
      days.push(<Picker.Item key={String(i)} label={String(i).padStart(2, '0')} value={String(i)} />);
    }
    return days;
  };

  const handleSaveExpense = async () => {
    if (!expenseName.trim() || !expenseValue.trim()) {
      Alert.alert('Erro', 'Por favor, preencha a descrição e o valor da despesa.');
      return;
    }
    const value = parseFloat(expenseValue.replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      Alert.alert('Erro', 'Por favor, insira um valor válido para a despesa.');
      return;
    }

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

      let expenseDataTemplate = {
        description: expenseName.trim(),
        value: value,
        paymentMethod: paymentMethod,
        status: currentExpenseStatus || 'pending',
        paidAt: currentExpensePaidAt || null,
        deletedAt: currentExpenseDeletedAt || null,
      };

      if (isEditing && currentExpenseId) {
        let updatedExpense = { ...expenseDataTemplate, id: currentExpenseId };
        
        updatedExpense.createdAt = route.params.expenseToEdit.createdAt;

        if (paymentMethod === 'Débito') {
          updatedExpense.purchaseDate = purchaseDate.toISOString();
          updatedExpense.dueDate = purchaseDate.toISOString();
          delete updatedExpense.cardId;
          delete updatedExpense.installmentNumber;
          delete updatedExpense.totalInstallments;
          delete updatedExpense.originalExpenseId;
          delete updatedExpense.dueDayOfMonth;
        } else if (paymentMethod === 'Crédito') {
          updatedExpense.purchaseDate = purchaseDate.toISOString();
          updatedExpense.cardId = selectedCardId;
          updatedExpense.installmentNumber = route.params.expenseToEdit.installmentNumber || 1;
          updatedExpense.totalInstallments = route.params.expenseToEdit.totalInstallments || parseInt(numInstallments, 10);
          updatedExpense.originalExpenseId = route.params.expenseToEdit.originalExpenseId || currentExpenseId;
          updatedExpense.dueDate = route.params.expenseToEdit.dueDate; 
          delete updatedExpense.dueDayOfMonth;
        } else if (paymentMethod === 'Fixa') {
          updatedExpense.dueDayOfMonth = parseInt(fixedExpenseDueDay, 10);
          delete updatedExpense.purchaseDate;
          delete updatedExpense.cardId;
          delete updatedExpense.installmentNumber;
          delete updatedExpense.totalInstallments;
          delete updatedExpense.originalExpenseId;
          delete updatedExpense.dueDate;
          updatedExpense.status = 'active';
        }
        
        const index = expenses.findIndex(exp => exp.id === currentExpenseId);
        if (index !== -1) {
          expenses[index] = updatedExpense;
        } else {
          console.warn("Despesa a ser editada não encontrada. Adicionando como nova.");
          expenses.push({ ...updatedExpense, id: Date.now().toString(), createdAt: new Date().toISOString() });
        }
        Alert.alert('Sucesso', 'Despesa atualizada com sucesso!');
        console.log("Despesa atualizada no AsyncStorage:", updatedExpense);

      } else {
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
              status: 'pending',
            };
            expenses.push(installmentData);
            
            // Avança para o próximo mês.
            // A lógica de ajustar para o último dia do mês (se o dia original for maior)
            // já está contida em getFirstCreditDueDate, então aqui apenas avança o mês.
            currentDueDate.setMonth(currentDueDate.getMonth() + 1);
            // Corrige o dia se o mês resultante for menor (ex: 31 de janeiro para fevereiro, se o dia for 31)
            if (currentDueDate.getDate() !== dueDayOfMonthCard && currentDueDate.getMonth() !== new Date(currentDueDate.getFullYear(), currentDueDate.getMonth(), dueDayOfMonthCard).getMonth()) {
                currentDueDate.setDate(new Date(currentDueDate.getFullYear(), currentDueDate.getMonth() + 1, 0).getDate());
            }
          }
          Alert.alert('Sucesso', `${totalNumInstallments} parcelas de crédito adicionadas com sucesso!`);
          console.log("Parcelas de crédito adicionadas, originalExpenseId:", originalExpenseUniqueId);
        } else if (paymentMethod === 'Fixa') {
          const newExpense = {
            ...expenseDataTemplate,
            id: Date.now().toString(),
            status: 'active',
            dueDayOfMonth: parseInt(fixedExpenseDueDay, 10),
          };
          expenses.push(newExpense);
          Alert.alert('Sucesso', 'Despesa fixa adicionada com sucesso!');
          console.log("Nova despesa fixa adicionada:", newExpense);
        }
      }

      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
      
      setExpenseName('');
      setExpenseValue('');
      setPaymentMethod('Débito');
      setPurchaseDate(new Date());
      // Garante que o selectedCardId seja resetado corretamente para o primeiro cartão se houver, ou null.
      if (cards.length > 0) {
        setSelectedCardId(cards[0].id);
      } else {
        setSelectedCardId(null);
      }
      setNumInstallments('1');
      setFixedExpenseDueDay('1');
      setIsEditing(false);
      setCurrentExpenseId(null);
      setCurrentExpenseStatus('pending');
      setCurrentExpensePaidAt(null);
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

  return (
    <View style={[commonStyles.container, { paddingTop: insets.top }]}>
      {/* ScrollView para permitir rolagem vertical do formulário */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={commonStyles.title}>{isEditing ? "Editar Despesa" : "Adicionar Nova Despesa"}</Text>

        {/* Campo de input para a descrição da despesa */}
        <TextInput
          style={commonStyles.input}
          placeholder="Descrição da Despesa (Ex: Supermercado, Aluguel)"
          value={expenseName}
          onChangeText={setExpenseName}
        />

        {/* Campo de input para o valor da despesa */}
        <TextInput
          style={commonStyles.input}
          placeholder="Valor (R$)"
          keyboardType="numeric"
          value={expenseValue}
          onChangeText={(text) => setExpenseValue(text.replace(/[^0-9,.]/g, '').replace('.', ','))}
        />

        {/* Seção para seleção do MÉTODO DE PAGAMENTO (Débito/Crédito/Fixa) */}
        <View style={commonStyles.typeSelectionContainer}>
          <Text style={commonStyles.pickerLabel}>Método de Pagamento:</Text>
          <View style={commonStyles.typeButtonsWrapper}>
            {/* Botão para "Débito" */}
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

            {/* Botão para "Crédito" */}
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

            {/* Novo Botão para "Fixa" */}
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
        </View>

        {/* Seções visíveis APENAS para despesas do tipo 'Débito' ou 'Crédito' */}
        {(paymentMethod === 'Débito' || paymentMethod === 'Crédito') && (
          <>
            {/* Seção para seleção da data da compra */}
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

        {/* Seção para seleção de cartão e parcelas (visível apenas para método "Crédito") */}
        {paymentMethod === 'Crédito' && (
          <View style={styles.creditOptionsContainer}>
            {cards.length > 0 ? (
              <>
                {/* Seletor de Cartões */}
                <View style={commonStyles.pickerContainer}>
                  <Text style={commonStyles.pickerLabel}>Selecione o Cartão:</Text>
                  <Picker
                    selectedValue={selectedCardId}
                    onValueChange={(itemValue) => setSelectedCardId(itemValue)}
                    style={styles.pickerStyleOverride}
                  >
                    {/* Alterado para garantir que a label do placeholder seja sempre um componente Text */}
                    {selectedCardId === null && <Picker.Item label="Selecione um Cartão" value={null} enabled={false} style={{color: '#999'}} />}
                    {cards.map(card => (
                      <Picker.Item key={card.id} label={card.alias} value={card.id} />
                    ))}
                  </Picker>
                </View>

                {/* Campo para número de parcelas */}
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
              // Mensagem e botão se não houver cartões cadastrados
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

        {/* Campo para o Dia do Pagamento (visível apenas para método "Fixa") - AGORA É UM PICKER */}
        {paymentMethod === 'Fixa' && (
          <View style={styles.fixedExpenseDayContainer}>
            <Text style={commonStyles.pickerLabel}>Dia do Pagamento (1-31):</Text>
            <View style={commonStyles.pickerContainer}> {/* Reutiliza o estilo de container do picker */}
              <Picker
                selectedValue={fixedExpenseDueDay}
                onValueChange={(itemValue) => setFixedExpenseDueDay(itemValue)}
                style={commonStyles.picker}
              >
                {renderDayPickerItems()}
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
      </ScrollView>
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
});

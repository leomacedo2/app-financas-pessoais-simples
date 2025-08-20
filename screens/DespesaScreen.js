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
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert, ActivityIndicator, ScrollView } from 'react-native'; // Adicionado ScrollView para o formulário
import DateTimePicker from '@react-native-community/datetimepicker'; // Para seleção de data
import AsyncStorage from '@react-native-async-storage/async-storage'; // Para armazenamento local de dados (despesas e cartões)
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Para lidar com a área segura do dispositivo
import { Picker } from '@react-native-picker/picker'; // Importação do componente Picker

// Importa os estilos comuns e as chaves de armazenamento como constantes para reutilização
import commonStyles from '../utils/commonStyles'; // Importação CORRIGIDA
import { ASYNC_STORAGE_KEYS } from '../utils/constants'; // Importação CORRIGIDA


export default function DespesaScreen({ navigation, route }) {
  const insets = useSafeAreaInsets(); // Obtém os insets da área segura (ex: altura da barra de status em iOS)

  // Estados para os campos do formulário de despesa
  const [expenseName, setExpenseName] = useState(''); // Nome/descrição da despesa
  const [expenseValue, setExpenseValue] = useState(''); // Valor da despesa (tratado como string para input, ex: "150,50")
  const [purchaseDate, setPurchaseDate] = useState(new Date()); // Data da compra (padrão: hoje)
  const [paymentMethod, setPaymentMethod] = useState('Débito'); 
  
  // Estados para o método de pagamento 'Crédito'
  const [cards, setCards] = useState([]); // Lista de cartões cadastrados para seleção
  const [selectedCardId, setSelectedCardId] = useState(null); // ID do cartão selecionado para pagamento
  const [numInstallments, setNumInstallments] = useState('1'); // Número de parcelas (padrão: 1)

  // NOVO ESTADO para o dia de vencimento de despesas fixas
  const [fixedExpenseDueDay, setFixedExpenseDueDay] = useState('1'); 

  // Estados para controle de UI/UX
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios'); // Controla a visibilidade do DatePicker
  const [savingExpense, setSavingExpense] = useState(false); // Indica se a despesa está sendo salva

  // Estados para o modo de edição
  const [isEditing, setIsEditing] = useState(false); // Indica se a tela está em modo de edição
  const [currentExpenseId, setCurrentExpenseId] = useState(null); // ID da despesa se estiver em edição
  const [currentExpenseStatus, setCurrentExpenseStatus] = useState(null); // Status da despesa em edição ('pending', 'paid', 'inactive')
  const [currentExpensePaidAt, setCurrentExpensePaidAt] = useState(null); // Data de pagamento (se já paga)
  const [currentExpenseDeletedAt, setCurrentExpenseDeletedAt] = useState(null); // Data de exclusão (soft delete)

  /**
   * useEffect para pré-popular o formulário quando uma despesa é passada para edição.
   * Roda quando `route.params.expenseToEdit` muda.
   * IMPORTANTE: Esta lógica só considera a edição de UMA despesa/parcela simples por vez.
   * Edição de uma série de parcelas será mais complexa e feita em fases futuras.
   */
  useEffect(() => {
    if (route.params?.expenseToEdit) {
      const expense = route.params.expenseToEdit;
      setIsEditing(true); // Ativa o modo de edição
      setCurrentExpenseId(expense.id); // Define o ID da despesa atual
      setExpenseName(expense.description); // Preenche a descrição
      setExpenseValue(expense.value.toFixed(2).replace('.', ',')); // Preenche o valor formatado

      setPaymentMethod(expense.paymentMethod || 'Débito'); // Carrega o método de pagamento

      // Carrega campos específicos de acordo com o método de pagamento
      if (expense.paymentMethod === 'Débito') {
        setPurchaseDate(new Date(expense.purchaseDate || expense.createdAt));
        setFixedExpenseDueDay('1'); // Reseta para o padrão
      } else if (expense.paymentMethod === 'Crédito') {
        setPurchaseDate(new Date(expense.purchaseDate || expense.createdAt)); // Data da compra original da parcela
        setSelectedCardId(expense.cardId || null);
        setNumInstallments(String(expense.totalInstallments || 1));
        setFixedExpenseDueDay('1'); // Reseta para o padrão
      } else if (expense.paymentMethod === 'Fixa') { // NOVO: Carrega dia do pagamento para despesa Fixa
        setPurchaseDate(new Date()); // Reseta para data atual para não exibir um datepicker sem uso
        setSelectedCardId(null);
        setNumInstallments('1');
        setFixedExpenseDueDay(String(expense.dueDayOfMonth || '1')); // Carrega o dia de vencimento
      }

      setCurrentExpenseStatus(expense.status || 'pending');
      setCurrentExpensePaidAt(expense.paidAt || null);
      setCurrentExpenseDeletedAt(expense.deletedAt || null);

    } else {
      // Se não há despesa para editar, reinicia os estados para um novo formulário
      setIsEditing(false);
      setCurrentExpenseId(null);
      setExpenseName('');
      setExpenseValue('');
      setPurchaseDate(new Date());
      setPaymentMethod('Débito'); // Nova despesa inicia com 'Débito'
      setSelectedCardId(null);
      setNumInstallments('1');
      setFixedExpenseDueDay('1'); // Reseta para o padrão
      setCurrentExpenseStatus('pending');
      setCurrentExpensePaidAt(null);
      setCurrentExpenseDeletedAt(null);
    }
  }, [route.params?.expenseToEdit]);

  /**
   * useEffect para carregar os cartões do AsyncStorage ao montar a tela.
   * É necessário para popular o Picker de seleção de cartão.
   */
  useEffect(() => {
    const loadCards = async () => {
      try {
        const storedCardsJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CARDS);
        const storedCards = storedCardsJson ? JSON.parse(storedCardsJson) : [];
        const activeCards = storedCards.filter(card => card.status !== 'inactive'); // Apenas cartões ativos
        setCards(activeCards);
        // Se houver cartões, pré-seleciona o primeiro ou o cartão da despesa em edição
        if (activeCards.length > 0 && !selectedCardId) {
          setSelectedCardId(activeCards[0].id);
        } else if (selectedCardId && !activeCards.find(c => c.id === selectedCardId)) {
          // Se o cartão selecionado na edição não está mais ativo, limpa a seleção
          setSelectedCardId(null);
        }
      } catch (error) {
        console.error("DespesaScreen: Erro ao carregar cartões do AsyncStorage:", error);
      }
    };
    loadCards();
  }, [selectedCardId]);


  /**
   * Lida com a mudança de data no DateTimePicker.
   * @param {object} event - O objeto de evento do picker.
   * @param {Date} selectedDate - A data selecionada pelo usuário.
   */
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setPurchaseDate(selectedDate);
    }
  };

  /**
   * Abre o DateTimePicker para seleção da data da compra.
   */
  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  /**
   * Lida com o salvamento ou atualização de uma despesa no AsyncStorage.
   * Esta função é aprimorada para lidar com 'Débito' e 'Crédito' (inicial).
   * A lógica de parcelamento completo será na Fase 2.
   */
  const handleSaveExpense = async () => {
    // 1. Validação dos campos obrigatórios
    if (!expenseName.trim() || !expenseValue.trim()) {
      Alert.alert('Erro', 'Por favor, preencha a descrição e o valor da despesa.');
      return;
    }
    // 2. Converte e valida o valor numérico
    const value = parseFloat(expenseValue.replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      Alert.alert('Erro', 'Por favor, insira um valor válido para a despesa.');
      return;
    }

    // Validação específica para método de pagamento 'Crédito'
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

    // Validação para despesas Fixas: garantir que o dia seja válido (1-31)
    if (paymentMethod === 'Fixa') {
      const day = parseInt(fixedExpenseDueDay, 10);
      if (isNaN(day) || day < 1 || day > 31) {
        Alert.alert('Erro', 'Para despesas fixas, por favor, insira um dia de pagamento válido (entre 1 e 31).');
        return;
      }
    }


    setSavingExpense(true);

    try {
      const existingExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES); // CORRIGIDO: ASYC_STORAGE_KEYS para ASYNC_STORAGE_KEYS
      let expenses = existingExpensesJson ? JSON.parse(existingExpensesJson) : [];

      let expenseData = {
        description: expenseName.trim(),
        value: value,
        paymentMethod: paymentMethod, // Método de pagamento agora inclui 'Fixa'
        status: currentExpenseStatus || 'pending', // Padrão 'pending' para novas despesas
        paidAt: currentExpensePaidAt || null,
        deletedAt: currentExpenseDeletedAt || null,
      };

      if (isEditing && currentExpenseId) {
        // --- Modo de Edição ---
        expenseData.id = currentExpenseId;
        expenseData.createdAt = route.params.expenseToEdit.createdAt;

        if (paymentMethod === 'Débito') {
          expenseData.purchaseDate = purchaseDate.toISOString();
          expenseData.dueDate = purchaseDate.toISOString(); // Data de vencimento é a data da compra
          // Limpa campos específicos de crédito e fixa se mudou de tipo
          delete expenseData.cardId;
          delete expenseData.installmentNumber;
          delete expenseData.totalInstallments;
          delete expenseData.originalExpenseId;
          delete expenseData.dueDayOfMonth; // Limpa para despesa fixa
        } else if (paymentMethod === 'Crédito') {
          expenseData.purchaseDate = purchaseDate.toISOString();
          expenseData.cardId = selectedCardId;
          expenseData.installmentNumber = route.params.expenseToEdit.installmentNumber || 1;
          expenseData.totalInstallments = parseInt(numInstallments, 10);
          expenseData.originalExpenseId = route.params.expenseToEdit.originalExpenseId || currentExpenseId;
          // Limpa campos específicos de débito e fixa se mudou de tipo
          delete expenseData.dueDate;
          delete expenseData.dueDayOfMonth; // Limpa para despesa fixa
        } else if (paymentMethod === 'Fixa') {
          // Adiciona o dia de vencimento para despesas fixas
          expenseData.dueDayOfMonth = parseInt(fixedExpenseDueDay, 10);
          // Limpa todos os campos não aplicáveis a despesas fixas
          delete expenseData.purchaseDate;
          delete expenseData.cardId;
          delete expenseData.installmentNumber;
          delete expenseData.totalInstallments;
          delete expenseData.originalExpenseId;
          delete expenseData.dueDate;
          expenseData.status = 'active'; // Despesas fixas ativas por padrão
        }
        
        const index = expenses.findIndex(exp => exp.id === currentExpenseId);
        if (index !== -1) {
          expenses[index] = expenseData;
        } else {
          console.warn("Despesa a ser editada não encontrada. Adicionando como nova.");
          expenses.push({ ...expenseData, id: Date.now().toString(), createdAt: new Date().toISOString() });
        }
        Alert.alert('Sucesso', 'Despesa atualizada com sucesso!');
        console.log("Despesa atualizada no AsyncStorage:", expenseData);

      } else {
        // --- Modo de Adição ---
        expenseData.createdAt = new Date().toISOString(); // Data/hora de criação do registro

        if (paymentMethod === 'Débito') {
          expenseData.id = Date.now().toString();
          expenseData.purchaseDate = purchaseDate.toISOString();
          expenseData.dueDate = purchaseDate.toISOString(); // Data de vencimento é a data da compra
          expenses.push(expenseData);
          Alert.alert('Sucesso', 'Despesa de débito adicionada com sucesso!');
          console.log("Nova despesa de débito adicionada:", expenseData);

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

          let currentDueDate = new Date(expenseData.createdAt); // Usa a data de criação da despesa como base
          // Lógica simplificada: se a data da compra for após o dia de vencimento,
          // a primeira parcela será no próximo mês de vencimento.
          if (currentDueDate.getDate() > dueDayOfMonthCard) {
            currentDueDate.setMonth(currentDueDate.getMonth() + 1);
          }
          currentDueDate.setDate(dueDayOfMonthCard); // Define o dia de vencimento da fatura

          for (let i = 1; i <= totalNumInstallments; i++) {
            const installmentData = {
              ...expenseData,
              id: `${originalExpenseUniqueId}-${i}`,
              value: installmentValue,
              paymentMethod: 'Crédito',
              cardId: selectedCardId,
              installmentNumber: i,
              totalInstallments: totalNumInstallments,
              originalExpenseId: originalExpenseUniqueId,
              dueDate: currentDueDate.toISOString(), // Data de vencimento da parcela
              purchaseDate: expenseData.createdAt, // Data da compra original (mesma para todas as parcelas)
              status: 'pending',
            };
            expenses.push(installmentData);
            currentDueDate.setMonth(currentDueDate.getMonth() + 1); // Avança para o próximo mês
          }
          Alert.alert('Sucesso', `${totalNumInstallments} parcelas adicionadas com sucesso!`);
          console.log("Parcelas de crédito adicionadas:", expenses.filter(e => e.originalExpenseId === originalExpenseUniqueId));
        } else if (paymentMethod === 'Fixa') {
          expenseData.id = Date.now().toString();
          expenseData.status = 'active'; // Despesas fixas ativas desde a criação
          expenseData.dueDayOfMonth = parseInt(fixedExpenseDueDay, 10); // Salva o dia de vencimento
          expenses.push(expenseData);
          Alert.alert('Sucesso', 'Despesa fixa adicionada com sucesso!');
          console.log("Nova despesa fixa adicionada:", expenseData);
        }
      }

      // 6. Salva o array atualizado de despesas no AsyncStorage
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
      
      // 7. Limpa o formulário e navega de volta após o sucesso
      setExpenseName('');
      setExpenseValue('');
      setPaymentMethod('Débito'); // Reseta para Débito
      setPurchaseDate(new Date());
      setSelectedCardId(cards.length > 0 ? cards[0].id : null);
      setNumInstallments('1');
      setFixedExpenseDueDay('1'); // Reseta o dia de vencimento fixo
      setIsEditing(false);
      setCurrentExpenseId(null);
      setCurrentExpenseStatus('pending');
      setCurrentExpensePaidAt(null);
      setCurrentExpenseDeletedAt(null);

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
                    style={commonStyles.picker}
                  >
                    {cards.map(card => (
                      <Picker.Item key={card.id} label={card.alias} value={card.id} />
                    ))}
                  </Picker>
                </View>

                {/* Campo para número de parcelas */}
                <TextInput
                  style={commonStyles.input}
                  placeholder="Número de Parcelas (Ex: 1, 3, 12)"
                  keyboardType="numeric"
                  value={numInstallments}
                  onChangeText={(text) => setNumInstallments(text.replace(/[^0-9]/g, ''))}
                />
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

        {/* Campo para o Dia do Pagamento (visível apenas para método "Fixa") */}
        {paymentMethod === 'Fixa' && (
          <View style={styles.fixedExpenseDayContainer}>
            <Text style={commonStyles.pickerLabel}>Dia do Pagamento (1-31):</Text>
            <TextInput
              style={commonStyles.input}
              placeholder="Ex: 5, 10, 20"
              keyboardType="numeric"
              value={fixedExpenseDueDay}
              onChangeText={(text) => setFixedExpenseDueDay(text.replace(/[^0-9]/g, ''))}
              maxLength={2} // Limita a 2 dígitos
            />
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
  scrollContent: { // Adicionado para permitir rolagem do formulário
    flexGrow: 1,
    paddingBottom: 20, // Espaço no final para que o botão não fique colado
  },
  creditOptionsContainer: {
    marginBottom: 15,
  },
  fixedExpenseDayContainer: { // NOVO ESTILO para o campo de dia da despesa fixa
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
});

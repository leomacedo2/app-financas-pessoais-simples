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
 * Correção: O campo "Dia do Pagamento" para despesas "Fixa" agora é um Picker,
 * em vez de um TextInput, para garantir a seleção de um dia válido (1-31).
 *
 * Correção 2: Ao editar uma despesa fixa, o 'fixedExpenseDay' agora é preenchido
 * corretamente com o valor salvo de 'dueDayOfMonth'.
 *
 * CORREÇÃO 3: Erro "Text strings must be rendered within a <Text> component" resolvido
 * ao garantir que todos os valores renderizados sejam strings.
 * CORREÇÃO 4: O campo "Data da Compra" agora só aparece para o método "Débito" e "Crédito",
 * e não para "Fixa". Para "Fixa", apenas o "Dia do Pagamento" é exibido.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert, ActivityIndicator, ScrollView } from 'react-native'; // Adicionado ScrollView para o formulário
import DateTimePicker from '@react-native-community/datetimepicker'; // Para seleção de data
import AsyncStorage from '@react-native-async-storage/async-storage'; // Para armazenamento local de dados (despesas e cartões)
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Para lidar com a área segura do dispositivo
import { Picker } from '@react-native-picker/picker'; // Importação do componente Picker

// Importa os estilos comuns e as chaves de armazenamento como constantes para reutilização
import commonStyles from '../utils/commonStyles';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';


export default function DespesaScreen({ navigation, route }) {
  const insets = useSafeAreaInsets(); // Obtém os insets da área segura (ex: altura da barra de status em iOS)

  // Estados para os campos do formulário de despesa
  const [expenseName, setExpenseName] = useState(''); // Nome/descrição da despesa
  const [expenseValue, setExpenseValue] = useState(''); // Valor da despesa (tratado como string para input, ex: "150,50")
  const [purchaseDate, setPurchaseDate] = useState(new Date()); // Data da compra (padrão: hoje)
  const [paymentMethod, setPaymentMethod] = useState('Débito'); // Método de pagamento (padrão: Débito)
  
  // Novos estados para o método de pagamento 'Crédito' e 'Fixa'
  const [cards, setCards] = useState([]); // Lista de cartões cadastrados para seleção
  const [selectedCardId, setSelectedCardId] = useState(null); // ID do cartão selecionado para pagamento (Crédito)
  const [numInstallments, setNumInstallments] = useState('1'); // Número de parcelas (Crédito) (padrão: 1)
  const [fixedExpenseDay, setFixedExpenseDay] = useState('1'); // Dia do pagamento para despesas Fixas (padrão: '1' para o picker)

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
   */
  useEffect(() => {
    if (route.params?.expenseToEdit) {
      const expense = route.params.expenseToEdit;
      setIsEditing(true); // Ativa o modo de edição
      setCurrentExpenseId(expense.id); // Define o ID da despesa atual
      setExpenseName(expense.description); // Preenche a descrição
      setExpenseValue(expense.value.toFixed(2).replace('.', ',')); // Preenche o valor formatado

      setPaymentMethod(expense.paymentMethod || 'Débito'); // Preenche o método de pagamento
      setCurrentExpenseStatus(expense.status || 'pending'); // Carrega o status (padrão 'pending')
      setCurrentExpensePaidAt(expense.paidAt || null); // Carrega a data de pagamento
      setCurrentExpenseDeletedAt(expense.deletedAt || null); // Carrega a data de exclusão

      // Preenche campos específicos do método de pagamento
      if (expense.paymentMethod === 'Débito') {
        setPurchaseDate(new Date(expense.dueDate || expense.createdAt)); // Data de vencimento é a de compra para débito
      } else if (expense.paymentMethod === 'Crédito') {
        setPurchaseDate(new Date(expense.purchaseDate || expense.createdAt)); // Data da compra original para crédito
        setSelectedCardId(expense.cardId || null);
        // Para edição de uma parcela de crédito, o número de parcelas a ser exibido
        // deve ser o `totalInstallments` da compra original, não `installmentNumber` da parcela individual.
        setNumInstallments(String(expense.totalInstallments || 1));
      } else if (expense.paymentMethod === 'Fixa') {
        // Para despesa fixa, a data da compra é a data de criação, mas o campo relevante é o dia fixo
        setPurchaseDate(new Date(expense.createdAt));
        setFixedExpenseDay(String(expense.dueDayOfMonth || '1')); // Preenche com string ou '1'
      }

    } else {
      // Se não há despesa para editar, reinicia os estados para um novo formulário
      setIsEditing(false);
      setCurrentExpenseId(null);
      setExpenseName('');
      setExpenseValue('');
      setPurchaseDate(new Date()); // Data atual como padrão
      setPaymentMethod('Débito'); // Padrão 'Débito'
      setSelectedCardId(null); // Reinicia cartão selecionado
      setNumInstallments('1'); // Reinicia parcelas
      setFixedExpenseDay('1'); // Reinicia dia fixo para '1'
      setCurrentExpenseStatus('pending'); // Nova despesa inicia como pendente
      setCurrentExpensePaidAt(null);
      setCurrentExpenseDeletedAt(null);
    }
  }, [route.params?.expenseToEdit]); // Reage a mudanças no parâmetro de rota


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
        // Não exibe Alert.alert aqui para não interromper o fluxo se não houver cartões.
      }
    };
    loadCards();
  }, [selectedCardId]); // Reage se o ID do cartão selecionado mudar (útil em edição)


  /**
   * Lida com a mudança de data no DateTimePicker.
   * @param {object} event - O objeto de evento do picker.
   * @param {Date} selectedDate - A data selecionada pelo usuário.
   */
  const handleDateChange = (event, selectedDate) => {
    // Esconde o picker no Android após a seleção, no iOS permanece visível até ser fechado
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setPurchaseDate(selectedDate); // Atualiza o estado com a nova data
    }
  };

  /**
   * Abre o DateTimePicker para seleção da data da compra.
   */
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

  /**
   * Lida com o salvamento ou atualização de uma despesa no AsyncStorage.
   */
  const handleSaveExpense = async () => {
    // 1. Validação dos campos obrigatórios
    if (!expenseName.trim() || !expenseValue.trim()) {
      Alert.alert('Erro', 'Por favor, preencha a descrição e o valor da despesa.');
      return;
    }
    // 2. Converte e valida o valor numérico
    const value = parseFloat(expenseValue.replace(',', '.')); // Substitui vírgula por ponto para conversão
    if (isNaN(value) || value <= 0) {
      Alert.alert('Erro', 'Por favor, insira um valor válido para a despesa.');
      return;
    }

    // Validação específica para o método de pagamento 'Crédito'
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
    // Validação específica para o método de pagamento 'Fixa'
    if (paymentMethod === 'Fixa') {
      if (!fixedExpenseDay || parseInt(fixedExpenseDay, 10) < 1 || parseInt(fixedExpenseDay, 10) > 31) {
        Alert.alert('Erro', 'Por favor, selecione um dia de pagamento válido para despesas fixas (entre 1 e 31).');
        return;
      }
    }


    setSavingExpense(true); // Ativa o indicador de salvamento

    try {
      // 3. Carrega todas as despesas existentes do AsyncStorage
      const existingExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      let expenses = existingExpensesJson ? JSON.parse(existingExpensesJson) : [];

      // Objeto base da despesa
      let baseExpenseData = {
        description: expenseName.trim(),
        value: value,
        paymentMethod: paymentMethod,
        status: currentExpenseStatus || 'pending', 
        paidAt: currentExpensePaidAt || null, 
        deletedAt: currentExpenseDeletedAt || null,
      };

      if (isEditing && currentExpenseId) {
        // --- Modo de Edição ---
        baseExpenseData.id = currentExpenseId; // Mantém o ID original
        baseExpenseData.createdAt = route.params.expenseToEdit.createdAt; // Preserva data de criação

        if (paymentMethod === 'Débito') {
            baseExpenseData.purchaseDate = purchaseDate.toISOString();
            baseExpenseData.dueDate = purchaseDate.toISOString();
            delete baseExpenseData.cardId;
            delete baseExpenseData.installmentNumber;
            delete baseExpenseData.totalInstallments;
            delete baseExpenseData.originalExpenseId;
            delete baseExpenseData.dueDayOfMonth; // Remove se mudar de fixa para débito
        } else if (paymentMethod === 'Crédito') {
            baseExpenseData.purchaseDate = route.params.expenseToEdit.purchaseDate || new Date().toISOString(); // Mantém a data de compra original
            baseExpenseData.cardId = selectedCardId;
            baseExpenseData.installmentNumber = route.params.expenseToEdit.installmentNumber || 1; 
            baseExpenseData.totalInstallments = parseInt(numInstallments, 10);
            baseExpenseData.originalExpenseId = route.params.expenseToEdit.originalExpenseId || currentExpenseId;
            // Para despesas de crédito, a dueDate pode ser recalculada na exibição, ou mantida a original
            baseExpenseData.dueDate = route.params.expenseToEdit.dueDate; 
            delete baseExpenseData.dueDayOfMonth; // Remove se mudar de fixa para crédito
        } else if (paymentMethod === 'Fixa') {
            baseExpenseData.purchaseDate = purchaseDate.toISOString(); // Data de criação para despesa fixa
            baseExpenseData.dueDayOfMonth = parseInt(fixedExpenseDay, 10);
            delete baseExpenseData.cardId;
            delete baseExpenseData.installmentNumber;
            delete baseExpenseData.totalInstallments;
            delete baseExpenseData.originalExpenseId;
            delete baseExpenseData.dueDate; // Despesa fixa não tem 'dueDate' direto, mas sim 'dueDayOfMonth'
        }
        
        const index = expenses.findIndex(exp => exp.id === currentExpenseId);
        if (index !== -1) {
          expenses[index] = baseExpenseData; // Atualiza a despesa no array
        } else {
          console.warn("Despesa a ser editada não encontrada. Adicionando como nova.");
          expenses.push({ ...baseExpenseData, id: Date.now().toString(), createdAt: new Date().toISOString() });
        }
        Alert.alert('Sucesso', 'Despesa atualizada com sucesso!');
        console.log("Despesa atualizada no AsyncStorage:", baseExpenseData);

      } else {
        // --- Modo de Adição ---
        baseExpenseData.createdAt = new Date().toISOString(); // Data/hora de criação do registro no app

        if (paymentMethod === 'Débito') {
          baseExpenseData.id = Date.now().toString(); 
          baseExpenseData.purchaseDate = purchaseDate.toISOString(); // Data da compra
          baseExpenseData.dueDate = purchaseDate.toISOString(); // Data de vencimento é a mesma da compra
          expenses.push(baseExpenseData);
          Alert.alert('Sucesso', 'Despesa de débito adicionada com sucesso!');
          console.log("Nova despesa de débito adicionada:", baseExpenseData);

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

          let currentDueDate = new Date(baseExpenseData.createdAt); // Data de registro como base
          currentDueDate.setDate(dueDayOfMonthCard); // Define o dia de vencimento da fatura

          // Se a data de registro for após o dia de vencimento da fatura do cartão,
          // a primeira parcela será no próximo mês de vencimento.
          if (new Date(baseExpenseData.createdAt).getDate() > dueDayOfMonthCard) {
            currentDueDate.setMonth(currentDueDate.getMonth() + 1); 
          }

          for (let i = 1; i <= totalNumInstallments; i++) {
            const installmentData = {
              ...baseExpenseData, 
              id: `${originalExpenseUniqueId}-${i}`, 
              value: installmentValue, 
              paymentMethod: 'Crédito',
              cardId: selectedCardId,
              installmentNumber: i,
              totalInstallments: totalNumInstallments,
              originalExpenseId: originalExpenseUniqueId, 
              purchaseDate: baseExpenseData.createdAt, // Data em que a compra foi registrada (original)
              dueDate: new Date(currentDueDate).toISOString(), // Vencimento da parcela
              status: 'pending', 
            };
            expenses.push(installmentData);
            currentDueDate.setMonth(currentDueDate.getMonth() + 1); // Avança para o próximo mês
          }
          Alert.alert('Sucesso', `${totalNumInstallments} parcelas adicionadas com sucesso!`);
          console.log("Parcelas de crédito adicionadas:", expenses.filter(e => e.originalExpenseId === originalExpenseUniqueId));
        } else if (paymentMethod === 'Fixa') {
            baseExpenseData.id = Date.now().toString();
            baseExpenseData.purchaseDate = purchaseDate.toISOString(); // A data de "compra" para fixa é a de criação
            baseExpenseData.dueDayOfMonth = parseInt(fixedExpenseDay, 10); // Dia fixo do mês
            expenses.push(baseExpenseData);
            Alert.alert('Sucesso', 'Despesa fixa adicionada com sucesso!');
            console.log("Nova despesa fixa adicionada:", baseExpenseData);
        }
      }

      // 6. Salva o array atualizado de despesas no AsyncStorage
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
      
      // 7. Limpa o formulário e navega de volta após o sucesso
      setExpenseName('');
      setExpenseValue('');
      setPurchaseDate(new Date());
      setPaymentMethod('Débito');
      setSelectedCardId(cards.length > 0 ? cards[0].id : null); 
      setNumInstallments('1');
      setFixedExpenseDay('1'); // Limpa para '1'
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
      setSavingExpense(false); // Desativa o indicador de salvamento
    }
  };

  return (
    // Container principal da tela, com padding superior ajustado para a barra de status
    <View style={[commonStyles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Título da tela, dinâmico para adição ou edição */}
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
          keyboardType="numeric" // Teclado numérico
          value={expenseValue}
          onChangeText={(text) => setExpenseValue(text.replace(/[^0-9,.]/g, '').replace('.', ','))}
        />

        {/* Seção para seleção do método de pagamento (Débito/Crédito/Fixa) */}
        <View style={commonStyles.typeSelectionContainer}>
          <Text style={commonStyles.pickerLabel}>Método de Pagamento:</Text>
          <View style={commonStyles.typeButtonsWrapper}>
            {/* Botão para "Débito" */}
            <TouchableOpacity
              style={[
                commonStyles.typeButton,
                paymentMethod === 'Débito' ? commonStyles.typeButtonSelected : commonStyles.typeButtonUnselected
              ]}
              onPress={() => {
                setPaymentMethod('Débito');
                setShowDatePicker(Platform.OS === 'ios'); // Garante que o picker de data apareça se for iOS
              }}
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

            {/* Botão para "Fixa" */}
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

        {/* Seção para seleção da data da compra (visível  para método "Débito" e "Crédito") */}
        {(paymentMethod === 'Débito' || paymentMethod === 'Crédito') && ( // CONDIÇÃO CORRIGIDA AQUI
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
        )}

        {/* Seção para seleção do dia de pagamento para despesas "Fixa" - AGORA É UM PICKER */}
        {paymentMethod === 'Fixa' && (
          <View style={styles.fixedExpenseDayContainer}>
            <Text style={commonStyles.pickerLabel}>Dia do Pagamento (1-31):</Text>
            <View style={commonStyles.pickerContainer}> {/* Reutiliza o estilo de container do picker */}
              <Picker
                selectedValue={fixedExpenseDay}
                onValueChange={(itemValue) => setFixedExpenseDay(itemValue)}
                style={commonStyles.picker}
              >
                {renderDayPickerItems()}
              </Picker>
            </View>
          </View>
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
                    {/* Placeholder para o Picker de Cartões */}
                    <Picker.Item label="Selecione um Cartão" value={null} enabled={false} style={{color: '#999'}} />
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
                  onChangeText={(text) => setNumInstallments(text.replace(/[^0-9]/g, ''))} // Apenas números
                />
              </>
            ) : (
              // Mensagem e botão se não houver cartões cadastrados
              <View style={styles.noCardsMessageContainer}>
                <Text style={styles.noCardsText}>Nenhum cartão cadastrado. Cadastre um para usar o crédito!</Text>
                <TouchableOpacity
                  style={styles.goToCardsButton}
                  onPress={() => navigation.navigate('CartaoTab')} // Navega para a aba de Cartões
                >
                  <Text style={styles.goToCardsButtonText}>Ir para Meus Cartões</Text>
                </TouchableOpacity>
              </View>
            )}
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

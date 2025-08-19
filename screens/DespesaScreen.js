// screens/DespesaScreen.js

/**
 * @file Tela para adicionar ou editar despesas.
 * Este componente funciona como um formulário dinâmico,
 * permitindo ao usuário registrar novas despesas ou modificar existentes.
 *
 * Fase 1.5: Refinamento da seleção de método de pagamento (Débito/Crédito)
 * e exibição condicional de campos de data e cartão/parcelas.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
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
  
  // Novos estados para o método de pagamento 'Crédito'
  const [cards, setCards] = useState([]); // Lista de cartões cadastrados para seleção
  const [selectedCardId, setSelectedCardId] = useState(null); // ID do cartão selecionado para pagamento
  const [numInstallments, setNumInstallments] = useState('1'); // Número de parcelas (padrão: 1)

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

      // Preenche a data da compra. Para despesas de crédito, ela pode não ser diretamente o campo purchaseDate
      // mas sim a data da transação original. Para simplicidade na edição, usamos purchaseDate para ambas.
      setPurchaseDate(new Date(expense.purchaseDate || expense.createdAt)); // Usa purchaseDate se existir, senão createdAt

      setPaymentMethod(expense.paymentMethod || 'Débito'); // Preenche o método de pagamento
      setCurrentExpenseStatus(expense.status || 'pending'); // Carrega o status (padrão 'pending')
      setCurrentExpensePaidAt(expense.paidAt || null); // Carrega a data de pagamento
      setCurrentExpenseDeletedAt(expense.deletedAt || null); // Carrega a data de exclusão

      // Se for uma despesa de Crédito, preenche os campos adicionais
      if (expense.paymentMethod === 'Crédito') {
        setSelectedCardId(expense.cardId || null);
        setNumInstallments(String(expense.totalInstallments || 1)); // totalInstallments da compra original
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

    setSavingExpense(true); // Ativa o indicador de salvamento

    try {
      // 3. Carrega todas as despesas existentes do AsyncStorage
      const existingExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      let expenses = existingExpensesJson ? JSON.parse(existingExpensesJson) : [];

      // Objeto base da despesa
      let baseExpenseData = {
        description: expenseName.trim(),
        value: value,
        // purchaseDate é a data em que a compra realmente ocorreu (ou foi registrada).
        // Para crédito, mesmo que não exibida, é a data de hoje ao registrar.
        purchaseDate: purchaseDate.toISOString(), 
        paymentMethod: paymentMethod,
        status: currentExpenseStatus || 'pending', 
        paidAt: currentExpensePaidAt || null, 
        deletedAt: currentExpenseDeletedAt || null,
      };

      if (isEditing && currentExpenseId) {
        // --- Modo de Edição ---
        baseExpenseData.id = currentExpenseId; // Mantém o ID original
        baseExpenseData.createdAt = route.params.expenseToEdit.createdAt; // Preserva data de criação

        // Se a despesa editada é de crédito, mantém os dados específicos
        if (paymentMethod === 'Crédito') {
          baseExpenseData.cardId = selectedCardId;
          baseExpenseData.installmentNumber = route.params.expenseToEdit.installmentNumber || 1; // Mantém a parcela original
          baseExpenseData.totalInstallments = parseInt(numInstallments, 10); // Atualiza o total de parcelas
          baseExpenseData.originalExpenseId = route.params.expenseToEdit.originalExpenseId || currentExpenseId;
        } else {
          // Se mudou de crédito para débito (ou já era débito), remove campos de cartão/parcela
          delete baseExpenseData.cardId;
          delete baseExpenseData.installmentNumber;
          delete baseExpenseData.totalInstallments;
          delete baseExpenseData.originalExpenseId;
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
          // Para despesa de débito, é uma única entrada
          baseExpenseData.id = Date.now().toString(); // ID único
          // Para despesas de débito, a data de vencimento é a própria data da compra
          baseExpenseData.dueDate = purchaseDate.toISOString(); 
          expenses.push(baseExpenseData);
          Alert.alert('Sucesso', 'Despesa de débito adicionada com sucesso!');
          console.log("Nova despesa de débito adicionada:", baseExpenseData);

        } else if (paymentMethod === 'Crédito') {
          // Para despesas de crédito, precisamos gerar as parcelas
          const totalNumInstallments = parseInt(numInstallments, 10);
          const installmentValue = value / totalNumInstallments; // Valor de cada parcela
          const originalExpenseUniqueId = Date.now().toString(); // ID para agrupar todas as parcelas

          // Encontra o cartão selecionado para obter o dia de vencimento da fatura
          const selectedCreditCard = cards.find(card => card.id === selectedCardId);
          if (!selectedCreditCard) {
            Alert.alert('Erro', 'Cartão selecionado não encontrado. Por favor, tente novamente.');
            setSavingExpense(false);
            return;
          }
          const dueDayOfMonthCard = selectedCreditCard.dueDayOfMonth;

          // Lógica para calcular a data de vencimento da primeira parcela
          // e das subsequentes, considerando a data de corte do cartão.
          // Por enquanto, uma versão simplificada. A lógica completa virá na Fase 2.
          let currentDueDate = new Date(baseExpenseData.purchaseDate); // Começa com a data da compra
          
          // Se a data da compra for após o dia de vencimento da fatura do cartão,
          // a primeira parcela será no próximo mês de vencimento.
          // Esta lógica será aprimorada na Fase 2 para considerar o "dia de corte" e não apenas "dia de vencimento".
          if (currentDueDate.getDate() > dueDayOfMonthCard) {
            currentDueDate.setMonth(currentDueDate.getMonth() + 1); // Avança para o próximo mês
          }
          currentDueDate.setDate(dueDayOfMonthCard); // Define o dia de vencimento da fatura

          for (let i = 1; i <= totalNumInstallments; i++) {
            const installmentData = {
              ...baseExpenseData, // Copia os dados básicos
              id: `${originalExpenseUniqueId}-${i}`, // ID único para cada parcela
              value: installmentValue, // Valor da parcela
              paymentMethod: 'Crédito',
              cardId: selectedCardId,
              installmentNumber: i,
              totalInstallments: totalNumInstallments,
              originalExpenseId: originalExpenseUniqueId, // Linka todas as parcelas
              dueDate: currentDueDate.toISOString(), // Data de vencimento da parcela
              status: 'pending', // Parcelas iniciam como pendentes
            };
            expenses.push(installmentData);

            // Prepara a data de vencimento para a próxima parcela (próximo mês)
            currentDueDate.setMonth(currentDueDate.getMonth() + 1);
          }
          Alert.alert('Sucesso', `${totalNumInstallments} parcelas adicionadas com sucesso!`);
          console.log("Parcelas de crédito adicionadas:", expenses.filter(e => e.originalExpenseId === originalExpenseUniqueId));
        }
      }

      // 6. Salva o array atualizado de despesas no AsyncStorage
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
      
      // 7. Limpa o formulário e navega de volta após o sucesso
      setExpenseName('');
      setExpenseValue('');
      setPurchaseDate(new Date());
      setPaymentMethod('Débito');
      setSelectedCardId(cards.length > 0 ? cards[0].id : null); // Reseta para o primeiro cartão ou null
      setNumInstallments('1');
      setIsEditing(false);
      setCurrentExpenseId(null);
      setCurrentExpenseStatus('pending');
      setCurrentExpensePaidAt(null);
      setCurrentExpenseDeletedAt(null);

      setTimeout(() => {
        // Navega de volta para a tela anterior (HomeScreen, onde as despesas são exibidas)
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

      {/* Seção para seleção do método de pagamento (Débito/Crédito) */}
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
        </View>
      </View>

      {/* Seção para seleção da data da compra (visível apenas para método "Débito") */}
      {paymentMethod === 'Débito' && (
        <View style={commonStyles.datePickerSection}>
          <Text style={commonStyles.pickerLabel}>Data da Compra:</Text>
          <TouchableOpacity onPress={showDatepicker} style={commonStyles.dateDisplayButton}>
            <Text style={commonStyles.dateDisplayText}>
              {/* Exibe a data formatada para o usuário */}
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
        disabled={savingExpense} // Desabilita o botão enquanto a despesa está sendo salva
      >
        {savingExpense ? (
          <ActivityIndicator color="#fff" /> // Mostra um spinner durante o salvamento
        ) : (
          <Text style={commonStyles.buttonText}>{isEditing ? "Salvar Alterações" : "Adicionar Despesa"}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Combina o container base dos estilos comuns com padding horizontal específico para esta tela
  container: {
    ...commonStyles.container,
    paddingHorizontal: 20,
  },
  // Estilos específicos para a seção de opções de crédito
  creditOptionsContainer: {
    // Adicione estilos de layout se necessário, como margin/padding
    marginBottom: 15,
  },
  noCardsMessageContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffeb3b', // Amarelo claro para aviso
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

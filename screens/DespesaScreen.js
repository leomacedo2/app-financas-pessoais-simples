// screens/DespesaScreen.js

/**
 * @file Tela para adicionar ou editar despesas.
 * Este componente funciona como um formulário dinâmico,
 * permitindo ao usuário registrar novas despesas ou modificar existentes.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker'; // Para seleção de data
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Para lidar com a área segura do dispositivo

// Importa os estilos comuns e as chaves de armazenamento como constantes
import commonStyles from '../utils/commonStyles';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';


export default function DespesaScreen({ navigation, route }) {
  const insets = useSafeAreaInsets(); // Obtém os insets da área segura (ex: altura da barra de status)

  // Estados para os campos do formulário de despesa
  const [expenseName, setExpenseName] = useState(''); // Nome/descrição da despesa
  const [expenseValue, setExpenseValue] = useState(''); // Valor da despesa (tratado como string para input)
  const [purchaseDate, setPurchaseDate] = useState(new Date()); // Data da compra
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro'); // Método de pagamento padrão

  // Estados para controle de UI/UX
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios'); // Controla a visibilidade do DatePicker
  const [savingExpense, setSavingExpense] = useState(false); // Indica se a despesa está sendo salva

  // Estados para o modo de edição
  const [isEditing, setIsEditing] = useState(false); // Indica se a tela está em modo de edição
  const [currentExpenseId, setCurrentExpenseId] = useState(null); // ID da despesa se estiver em edição
  const [currentExpenseStatus, setCurrentExpenseStatus] = useState(null); // Status da despesa em edição
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
      setPurchaseDate(new Date(expense.createdAt)); // A data de criação é a data da compra para despesas geradas/simples
      setPaymentMethod(expense.paymentMethod || 'Dinheiro'); // Preenche o método de pagamento
      setCurrentExpenseStatus(expense.status || 'pending'); // Carrega o status (padrão 'pending')
      setCurrentExpensePaidAt(expense.paidAt || null); // Carrega a data de pagamento
      setCurrentExpenseDeletedAt(expense.deletedAt || null); // Carrega a data de exclusão
    } else {
      // Se não há despesa para editar, reinicia os estados para um novo formulário
      setIsEditing(false);
      setCurrentExpenseId(null);
      setExpenseName('');
      setExpenseValue('');
      setPurchaseDate(new Date());
      setPaymentMethod('Dinheiro');
      setCurrentExpenseStatus('pending'); // Nova despesa inicia como pendente
      setCurrentExpensePaidAt(null);
      setCurrentExpenseDeletedAt(null);
    }
  }, [route.params?.expenseToEdit]); // Reage a mudanças no parâmetro de rota

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

    setSavingExpense(true); // Ativa o indicador de salvamento

    try {
      // 3. Carrega todas as despesas existentes do AsyncStorage
      const existingExpensesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.EXPENSES);
      let expenses = existingExpensesJson ? JSON.parse(existingExpensesJson) : [];

      // 4. Prepara o objeto de dados da despesa
      let expenseData = {
        description: expenseName.trim(),
        value: value,
        purchaseDate: purchaseDate.toISOString(), // Salva a data da compra como ISO string
        paymentMethod: paymentMethod,
        // Mantém o status e as datas de paidAt/deletedAt existentes se for edição, senão usa o padrão
        status: currentExpenseStatus || 'pending', 
        paidAt: currentExpensePaidAt || null, 
        deletedAt: currentExpenseDeletedAt || null,
        // Por enquanto, não há parcelas ou cardId. Isso virá na Fase 2.
      };

      // 5. Lógica de Adição vs. Edição
      if (isEditing && currentExpenseId) {
        // --- Modo de Edição ---
        expenseData.id = currentExpenseId; // Mantém o ID original
        // Preserva a data de criação original do item
        expenseData.createdAt = route.params.expenseToEdit.createdAt; 

        // Encontra o índice da despesa a ser atualizada no array
        const index = expenses.findIndex(exp => exp.id === currentExpenseId);
        if (index !== -1) {
          expenses[index] = expenseData; // Atualiza a despesa no array
        } else {
          // Caso a despesa não seja encontrada (improvável para edição), adiciona como nova
          console.warn("Despesa a ser editada não encontrada. Adicionando como nova.");
          expenses.push({ ...expenseData, id: Date.now().toString(), createdAt: new Date().toISOString() });
        }
        Alert.alert('Sucesso', 'Despesa atualizada com sucesso!');
        console.log("Despesa atualizada no AsyncStorage:", expenseData);

      } else {
        // --- Modo de Adição ---
        expenseData.id = Date.now().toString(); // Gera um ID único baseado no timestamp
        expenseData.createdAt = new Date().toISOString(); // Registra a data/hora de criação
        expenseData.status = 'pending'; // Nova despesa sempre começa como pendente
        Alert.alert('Sucesso', 'Despesa adicionada com sucesso!');
        expenses.push(expenseData); // Adiciona a nova despesa ao array
        console.log("Nova despesa adicionada ao AsyncStorage:", expenseData);
      }

      // 6. Salva o array atualizado de despesas no AsyncStorage
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
      
      // 7. Limpa o formulário e navega de volta após o sucesso
      setExpenseName('');
      setExpenseValue('');
      setPurchaseDate(new Date());
      setPaymentMethod('Dinheiro');
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

      {/* Seção para seleção da data da compra */}
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

      {/* Seção para seleção do método de pagamento */}
      <View style={commonStyles.typeSelectionContainer}>
        <Text style={commonStyles.pickerLabel}>Método de Pagamento:</Text>
        <View style={commonStyles.typeButtonsWrapper}>
          {/* Botão para "Dinheiro" */}
          <TouchableOpacity
            style={[
              commonStyles.typeButton,
              paymentMethod === 'Dinheiro' ? commonStyles.typeButtonSelected : commonStyles.typeButtonUnselected
            ]}
            onPress={() => setPaymentMethod('Dinheiro')}
          >
            <Text style={[
              commonStyles.typeButtonText,
              paymentMethod === 'Dinheiro' ? commonStyles.typeButtonTextSelected : commonStyles.typeButtonTextUnselected
            ]}>Dinheiro</Text>
          </TouchableOpacity>

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

          {/* Botão para "Pix" */}
          <TouchableOpacity
            style={[
              commonStyles.typeButton,
              paymentMethod === 'Pix' ? commonStyles.typeButtonSelected : commonStyles.typeButtonUnselected
            ]}
            onPress={() => setPaymentMethod('Pix')}
          >
            <Text style={[
              commonStyles.typeButtonText,
              paymentMethod === 'Pix' ? commonStyles.typeButtonTextSelected : commonStyles.typeButtonTextUnselected
            ]}>Pix</Text>
          </TouchableOpacity>
           {/* O método "Crédito" será adicionado na Fase 2, juntamente com a seleção de cartão */}
        </View>
      </View>

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
  // Não há estilos específicos aqui que não sejam cobertos por commonStyles neste momento.
  // Todos os estilos básicos para container, input, botões etc. são importados de commonStyles.
  // Se precisar de sobrescrever ou adicionar um estilo muito específico para esta tela,
  // você pode adicionar aqui, por exemplo:
  // myUniqueStyle: {
  //   backgroundColor: 'purple',
  // },
});

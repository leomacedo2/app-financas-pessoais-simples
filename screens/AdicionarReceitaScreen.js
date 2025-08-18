// screens/AdicionarReceitaScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Importa os estilos comuns para reutilização
import commonStyles from '../utils/commonStyles';
// Importa as chaves de AsyncStorage como constantes
import { ASYNC_STORAGE_KEYS } from '../utils/constants';


export default function AdicionarReceitaScreen({ navigation, route }) {
  const insets = useSafeAreaInsets(); // Obter os insets da área segura

  const [loadingApp, setLoadingApp] = useState(false); // Estado para controlar o carregamento geral da tela
  
  const [incomeName, setIncomeName] = useState(''); // Estado para o nome da receita
  const [incomeValue, setIncomeValue] = useState(''); // Estado para o valor da receita (string para input)
  const [incomeType, setIncomeType] = useState('Fixo'); // Estado para o tipo da receita ('Fixo' ou 'Ganho')
  const [selectedDate, setSelectedDate] = useState(new Date()); // Estado para a data selecionada (para receitas 'Ganho')
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios'); // Controla a visibilidade do DatePicker
  const [savingIncome, setSavingIncome] = useState(false); // Estado para controlar o salvamento da receita

  const [isEditing, setIsEditing] = useState(false); // Indica se a tela está em modo de edição
  const [currentIncomeId, setCurrentIncomeId] = useState(null); // ID da receita se estiver em edição
  // Novos estados para armazenar o status e deletedAt de uma receita em edição
  const [currentIncomeStatus, setCurrentIncomeStatus] = useState(null);
  const [currentIncomeDeletedAt, setCurrentIncomeDeletedAt] = useState(null);

  /**
   * useEffect para preencher o formulário se a tela for acessada para edição de uma receita.
   * Roda quando `route.params.incomeToEdit` muda.
   */
  useEffect(() => {
    if (route.params?.incomeToEdit) {
      const income = route.params.incomeToEdit;
      setIsEditing(true); // Define o modo de edição
      setCurrentIncomeId(income.id); // Armazena o ID da receita
      setIncomeName(income.name); // Preenche o nome
      setIncomeValue(income.value.toFixed(2).replace('.', ',')); // Preenche o valor (formatado)
      setIncomeType(income.type); // Preenche o tipo
      setCurrentIncomeStatus(income.status || 'active'); // Mantém o status existente ou define como 'active'
      setCurrentIncomeDeletedAt(income.deletedAt || null); // Carrega deletedAt se existir

      // Para receitas do tipo 'Ganho', define a data do DatePicker com base no mês/ano salvo
      if (income.type === 'Ganho' && income.month !== undefined && income.year !== undefined) {
        setSelectedDate(new Date(income.year, income.month, 1));
      } else {
        setSelectedDate(new Date()); // Se não for 'Ganho' ou dados ausentes, define a data atual
      }
    } else {
      // Se não houver `incomeToEdit` nos parâmetros, o formulário é para uma nova receita
      setIsEditing(false); // Modo de adição
      setCurrentIncomeId(null);
      setIncomeName('');
      setIncomeValue('');
      setIncomeType('Fixo'); // Padrão para nova receita é 'Fixo'
      setSelectedDate(new Date());
      setCurrentIncomeStatus('active'); // Nova receita sempre inicia como ativa
      setCurrentIncomeDeletedAt(null);
    }
  }, [route.params?.incomeToEdit]); // Roda sempre que os parâmetros de rota mudam

  /**
   * Lida com a mudança de data no DateTimePicker.
   * @param {object} event - O evento do DateTimePicker.
   * @param {Date} date - A data selecionada.
   */
  const handleDateChange = (event, date) => {
    // No iOS, o DatePicker fica visível até que o usuário o feche.
    // No Android, ele é um modal que fecha após a seleção.
    setShowDatePicker(Platform.OS === 'ios'); 
    if (date) {
      setSelectedDate(date); // Atualiza a data selecionada
    }
  };

  /**
   * Abre o DateTimePicker.
   */
  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  /**
   * Lida com o salvamento ou atualização de uma receita no AsyncStorage.
   */
  const handleSaveIncome = async () => {
    console.log("handleSaveIncome iniciado. savingIncome:", savingIncome);
    // Validação básica dos campos
    if (!incomeName.trim() || !incomeValue.trim()) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    // Converte e valida o valor numérico
    const value = parseFloat(incomeValue.replace(',', '.')); // Substitui ',' por '.' para parsing
    if (isNaN(value) || value <= 0) {
      Alert.alert('Erro', 'Por favor, insira um valor válido para a receita.');
      return;
    }

    setSavingIncome(true); // Ativa o estado de salvamento (mostra ActivityIndicator)
    console.log("savingIncome ativado.");

    try {
      // Carrega as receitas existentes do AsyncStorage
      const existingIncomesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.INCOMES);
      let incomes = existingIncomesJson ? JSON.parse(existingIncomesJson) : [];

      // Prepara os dados da receita a ser salva/atualizada
      let incomeData = {
        name: incomeName.trim(),
        value: value,
        type: incomeType,
        status: currentIncomeStatus || 'active', // Mantém o status existente ou define como 'active'
        deletedAt: currentIncomeDeletedAt || null, // Mantém a data de exclusão existente ou null
      };

      // Se o tipo for 'Ganho', adiciona mês e ano específicos
      if (incomeType === 'Ganho') {
        incomeData.month = selectedDate.getMonth();
        incomeData.year = selectedDate.getFullYear();
      } else {
        // Se mudar de 'Ganho' para 'Fixo', remove as propriedades de mês/ano para evitar inconsistência
        delete incomeData.month;
        delete incomeData.year;
      }

      if (isEditing && currentIncomeId) {
        // --- Lógica para EDIÇÃO de Receita ---
        incomeData.id = currentIncomeId; // Mantém o mesmo ID para atualização
        incomeData.createdAt = route.params.incomeToEdit.createdAt; // Mantém a data de criação original

        // Encontra o índice da receita a ser editada no array
        const index = incomes.findIndex(inc => inc.id === currentIncomeId);
        if (index !== -1) {
          incomes[index] = incomeData; // Atualiza o item no array
        } else {
          // Caso a receita a ser editada não seja encontrada (situação improvável, mas para segurança)
          console.warn("Receita a ser editada não encontrada. Adicionando como nova.");
          incomes.push({ ...incomeData, id: Date.now().toString(), createdAt: new Date().toISOString() });
        }
        await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.INCOMES, JSON.stringify(incomes)); // Salva no AsyncStorage
        console.log("Receita atualizada com sucesso no AsyncStorage.");

        Alert.alert('Sucesso', 'Receita atualizada com sucesso!', [
          {
            text: "OK",
            onPress: () => {
              // Navega de volta para a tela anterior (Lista de Receitas)
              setTimeout(() => {
                navigation.goBack();
                console.log("Navegando de volta para a lista de receitas após edição.");
              }, 100); // Pequeno delay para garantir que o alerta feche primeiro
            }
          }
        ]);

      } else {
        // --- Lógica para ADIÇÃO de Nova Receita ---
        incomeData.id = Date.now().toString(); // Gera um ID único baseado no timestamp
        incomeData.createdAt = new Date().toISOString(); // Registra a data/hora de criação
        incomeData.status = 'active'; // Novas receitas são sempre ativas

        incomes.push(incomeData); // Adiciona a nova receita ao array
        await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.INCOMES, JSON.stringify(incomes)); // Salva no AsyncStorage
        console.log("Receita adicionada com sucesso no AsyncStorage.");

        Alert.alert('Sucesso', 'Receita adicionada com sucesso!', [
          {
            text: "OK",
            onPress: () => {
              // Navega de volta para a tela anterior (Lista de Receitas)
              setTimeout(() => {
                navigation.goBack();
                console.log("Navegando de volta para a lista de receitas após adição.");
              }, 100);
            }
          }
        ]);
      }

      // Limpa o formulário após o sucesso do salvamento/atualização
      setIncomeName('');
      setIncomeValue('');
      setIncomeType('Fixo');
      setSelectedDate(new Date());
      setCurrentIncomeStatus('active');
      setCurrentIncomeDeletedAt(null);

    } catch (error) {
      console.error("AdicionarReceitaScreen: Erro ao salvar receita no AsyncStorage:", error);
      Alert.alert('Erro', `Ocorreu um erro ao salvar a receita: ${error.message}. Tente novamente.`);
    } finally {
      setSavingIncome(false); // Desativa o estado de salvamento
      console.log("savingIncome desativado.");
    }
  };

  // Exibe um indicador de carregamento geral da tela, se houver
  if (loadingApp) {
    return (
      <View style={commonStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Carregando aplicativo...</Text>
      </View>
    );
  }

  return (
    // Aplica o padding superior para respeitar a barra de notificação do dispositivo
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Título da tela, dinâmico para edição ou adição */}
      <Text style={commonStyles.title}>{isEditing ? "Editar Receita" : "Adicionar Nova Receita"}</Text>

      {/* Campo de input para o nome da receita */}
      <TextInput
        style={commonStyles.input}
        placeholder="Nome da Receita (Ex: Salário, Venda de item)"
        value={incomeName}
        onChangeText={setIncomeName}
      />

      {/* Campo de input para o valor da receita, com teclado numérico */}
      <TextInput
        style={commonStyles.input}
        placeholder="Valor (R$)"
        keyboardType="numeric"
        value={incomeValue}
        // Permite apenas números, vírgulas e pontos, e substitui ponto por vírgula para formatação
        onChangeText={(text) => setIncomeValue(text.replace(/[^0-9,.]/g, '').replace('.', ','))}
      />

      {/* Componente de seleção de tipo (Fixo/Ganho) com botões */}
      <View style={commonStyles.typeSelectionContainer}>
        <Text style={commonStyles.pickerLabel}>Tipo de Receita:</Text>
        <View style={commonStyles.typeButtonsWrapper}>
          <TouchableOpacity
            style={[
              commonStyles.typeButton,
              incomeType === 'Fixo' ? commonStyles.typeButtonSelected : commonStyles.typeButtonUnselected
            ]}
            onPress={() => setIncomeType('Fixo')}
          >
            <Text style={[
              commonStyles.typeButtonText,
              incomeType === 'Fixo' ? commonStyles.typeButtonTextSelected : commonStyles.typeButtonTextUnselected
            ]}>Fixo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              commonStyles.typeButton,
              incomeType === 'Ganho' ? commonStyles.typeButtonSelected : commonStyles.typeButtonUnselected
            ]}
            onPress={() => setIncomeType('Ganho')}
          >
            <Text style={[
              commonStyles.typeButtonText,
              incomeType === 'Ganho' ? commonStyles.typeButtonTextSelected : commonStyles.typeButtonTextUnselected
            ]}>Ganho</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Seção do seletor de data, visível apenas se o tipo for 'Ganho' */}
      {incomeType === 'Ganho' && (
        <View style={commonStyles.datePickerSection}>
          <Text style={commonStyles.pickerLabel}>Mês do Ganho:</Text>
          <TouchableOpacity onPress={showDatepicker} style={commonStyles.dateDisplayButton}>
            <Text style={commonStyles.dateDisplayText}>
              {/* Exibe o mês e ano formatados para o usuário */}
              {selectedDate.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={selectedDate}
              mode="date" // Modo de seleção de data
              display="spinner" // Estilo de display do seletor
              onChange={handleDateChange} // Função chamada ao mudar a data
            />
          )}
        </View>
      )}

      {/* Botão para Salvar/Adicionar Receita */}
      <TouchableOpacity
        style={commonStyles.addButton} // Usa o estilo comum de botão
        onPress={handleSaveIncome} // Chama a função de salvar
        disabled={savingIncome} // Desabilita o botão enquanto estiver salvando
      >
        {savingIncome ? (
          <ActivityIndicator color="#fff" /> // Mostra um spinner enquanto salva
        ) : (
          <Text style={commonStyles.buttonText}>{isEditing ? "Salvar Alterações" : "Adicionar Receita"}</Text>
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
  // Sobrescreve o estilo da label do picker para se alinhar ao design da tela
  pickerLabel: {
    ...commonStyles.pickerLabel, // Herda do commonStyles
    paddingLeft: 0, // Ajuste para a nova estrutura de botões
    paddingTop: 0, // Ajuste para a nova estrutura de botões
    marginBottom: 10, // Espaçamento para os botões
  },
});

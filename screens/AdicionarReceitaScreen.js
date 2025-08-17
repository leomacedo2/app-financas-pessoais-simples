// screens/AdicionarReceitaScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Importar useSafeAreaInsets


export default function AdicionarReceitaScreen({ navigation, route }) {
  const insets = useSafeAreaInsets(); // Obter os insets da área segura

  const [loadingApp, setLoadingApp] = useState(false);
  
  const [incomeName, setIncomeName] = useState('');
  const [incomeValue, setIncomeValue] = useState('');
  const [incomeType, setIncomeType] = useState('Fixo');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [savingIncome, setSavingIncome] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [currentIncomeId, setCurrentIncomeId] = useState(null);
  // Novo estado para armazenar o status e deletedAt de uma receita em edição
  const [currentIncomeStatus, setCurrentIncomeStatus] = useState(null);
  const [currentIncomeDeletedAt, setCurrentIncomeDeletedAt] = useState(null);

  useEffect(() => {
    if (route.params?.incomeToEdit) {
      const income = route.params.incomeToEdit;
      setIsEditing(true);
      setCurrentIncomeId(income.id);
      setIncomeName(income.name);
      setIncomeValue(income.value.toFixed(2).replace('.', ','));
      setIncomeType(income.type);
      setCurrentIncomeStatus(income.status || 'active'); // Garante que status seja 'active' se não definido
      setCurrentIncomeDeletedAt(income.deletedAt || null); // Carrega deletedAt se existir

      if (income.type === 'Ganho' && income.month !== undefined && income.year !== undefined) {
        setSelectedDate(new Date(income.year, income.month, 1));
      } else {
        setSelectedDate(new Date());
      }
    } else {
      setIsEditing(false);
      setCurrentIncomeId(null);
      setIncomeName('');
      setIncomeValue('');
      setIncomeType('Fixo');
      setSelectedDate(new Date());
      setCurrentIncomeStatus('active'); // Nova receita sempre inicia como ativa
      setCurrentIncomeDeletedAt(null);
    }
  }, [route.params?.incomeToEdit]);

  const handleDateChange = (event, date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  const handleSaveIncome = async () => {
    console.log("handleSaveIncome iniciado. savingIncome:", savingIncome);
    if (!incomeName.trim() || !incomeValue.trim()) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    const value = parseFloat(incomeValue.replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      Alert.alert('Erro', 'Por favor, insira um valor válido para a receita.');
      return;
    }

    setSavingIncome(true);
    console.log("savingIncome ativado.");

    try {
      const existingIncomesJson = await AsyncStorage.getItem('incomes');
      let incomes = existingIncomesJson ? JSON.parse(existingIncomesJson) : [];

      let incomeData = {
        name: incomeName.trim(),
        value: value,
        type: incomeType,
        status: currentIncomeStatus || 'active', // Mantém o status existente ou define como 'active'
        deletedAt: currentIncomeDeletedAt || null, // Mantém a data de exclusão existente ou null
      };

      if (incomeType === 'Ganho') {
        incomeData.month = selectedDate.getMonth();
        incomeData.year = selectedDate.getFullYear();
      } else {
        // Se mudar de 'Ganho' para 'Fixo', remove as propriedades de mês/ano para evitar inconsistência
        delete incomeData.month;
        delete incomeData.year;
      }

      if (isEditing && currentIncomeId) {
        incomeData.id = currentIncomeId;
        incomeData.createdAt = route.params.incomeToEdit.createdAt; // Mantém a data de criação original
        
        const index = incomes.findIndex(inc => inc.id === currentIncomeId);
        if (index !== -1) {
          incomes[index] = incomeData;
        } else {
          console.warn("Receita a ser editada não encontrada. Adicionando como nova.");
          incomes.push({ ...incomeData, id: Date.now().toString(), createdAt: new Date().toISOString() });
        }
        await AsyncStorage.setItem('incomes', JSON.stringify(incomes));
        console.log("Receita atualizada com sucesso no AsyncStorage.");

        Alert.alert('Sucesso', 'Receita atualizada com sucesso!', [
          {
            text: "OK",
            onPress: () => {
              setTimeout(() => {
                navigation.goBack();
                console.log("Navegando de volta para a lista de receitas após edição.");
              }, 100);
            }
          }
        ]);

      } else {
        incomeData.id = Date.now().toString();
        incomeData.createdAt = new Date().toISOString();
        incomeData.status = 'active'; // Garante que novas receitas são sempre ativas

        incomes.push(incomeData);
        await AsyncStorage.setItem('incomes', JSON.stringify(incomes));
        console.log("Receita adicionada com sucesso no AsyncStorage.");

        Alert.alert('Sucesso', 'Receita adicionada com sucesso!', [
          {
            text: "OK",
            onPress: () => {
              setTimeout(() => {
                navigation.goBack();
                console.log("Navegando de volta para a lista de receitas após adição.");
              }, 100);
            }
          }
        ]);
      }

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
      setSavingIncome(false);
      console.log("savingIncome desativado.");
    }
  };

  if (loadingApp) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Carregando aplicativo...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>{isEditing ? "Editar Receita" : "Adicionar Nova Receita"}</Text>

      <TextInput
        style={styles.input}
        placeholder="Nome da Receita (Ex: Salário, Venda de item)"
        value={incomeName}
        onChangeText={setIncomeName}
      />

      <TextInput
        style={styles.input}
        placeholder="Valor (R$)"
        keyboardType="numeric"
        value={incomeValue}
        onChangeText={(text) => setIncomeValue(text.replace(/[^0-9,.]/g, '').replace('.', ','))}
      />

      <View style={styles.typeSelectionContainer}>
        <Text style={styles.pickerLabel}>Tipo de Receita:</Text>
        <View style={styles.typeButtonsWrapper}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              incomeType === 'Fixo' ? styles.typeButtonSelected : styles.typeButtonUnselected
            ]}
            onPress={() => setIncomeType('Fixo')}
          >
            <Text style={[
              styles.typeButtonText,
              incomeType === 'Fixo' ? styles.typeButtonTextSelected : styles.typeButtonTextUnselected
            ]}>Fixo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeButton,
              incomeType === 'Ganho' ? styles.typeButtonSelected : styles.typeButtonUnselected
            ]}
            onPress={() => setIncomeType('Ganho')}
          >
            <Text style={[
              styles.typeButtonText,
              incomeType === 'Ganho' ? styles.typeButtonTextSelected : styles.typeButtonTextUnselected
            ]}>Ganho</Text>
          </TouchableOpacity>
        </View>
      </View>

      {incomeType === 'Ganho' && (
        <View style={styles.datePickerSection}>
          <Text style={styles.pickerLabel}>Mês do Ganho:</Text>
          <TouchableOpacity onPress={showDatepicker} style={styles.dateDisplayButton}>
            <Text style={styles.dateDisplayText}>
              {selectedDate.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' })}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={selectedDate}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
            />
          )}
        </View>
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={handleSaveIncome}
        disabled={savingIncome}
      >
        {savingIncome ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{isEditing ? "Salvar Alterações" : "Adicionar Receita"}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20, // Mantido padding horizontal
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  pickerLabel: {
    fontSize: 16,
    color: '#555',
    paddingLeft: 0,
    paddingTop: 0,
    marginBottom: 10,
  },
  typeSelectionContainer: {
    marginBottom: 15,
  },
  typeButtonsWrapper: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  typeButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 2,
  },
  typeButtonSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
    borderWidth: 1,
  },
  typeButtonUnselected: {
    backgroundColor: '#ffffff',
    borderColor: '#ccc',
    borderWidth: 1,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  typeButtonTextSelected: {
    color: '#fff',
  },
  typeButtonTextUnselected: {
    color: '#333',
  },
  datePickerSection: {
    marginBottom: 15,
  },
  dateDisplayButton: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  dateDisplayText: {
    fontSize: 16,
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

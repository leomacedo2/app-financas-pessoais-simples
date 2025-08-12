// screens/AdicionarReceitaScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AdicionarReceitaScreen({ navigation }) {
  const [loadingApp, setLoadingApp] = useState(false); // Mudado de loadingFirebase para loadingApp
  
  const [incomeName, setIncomeName] = useState('');
  const [incomeValue, setIncomeValue] = useState('');
  const [incomeType, setIncomeType] = useState('Fixo');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [savingIncome, setSavingIncome] = useState(false);

  const handleDateChange = (event, date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  const handleAddIncome = async () => {
    console.log("handleAddIncome iniciado. savingIncome:", savingIncome);
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

      const newIncome = {
        id: Date.now().toString(),
        name: incomeName.trim(),
        value: value,
        type: incomeType,
        createdAt: new Date().toISOString(),
      };

      if (incomeType === 'Ganho') {
        newIncome.month = selectedDate.getMonth();
        newIncome.year = selectedDate.getFullYear();
      }

      incomes.push(newIncome);
      await AsyncStorage.setItem('incomes', JSON.stringify(incomes));

      console.log("Receita adicionada com sucesso no AsyncStorage.");
      setSavingIncome(false);
      console.log("savingIncome desativado.");

      Alert.alert('Sucesso', 'Receita adicionada com sucesso!', [
        {
          text: "OK",
          onPress: () => {
            setTimeout(() => {
              navigation.goBack();
              console.log("Navegando de volta para a lista de receitas.");
            }, 100);
          }
        }
      ]);

      setIncomeName('');
      setIncomeValue('');
      setIncomeType('Fixo');
      setSelectedDate(new Date());

    } catch (error) {
      console.error("AdicionarReceitaScreen: Erro ao adicionar receita no AsyncStorage:", error);
      Alert.alert('Erro', `Ocorreu um erro ao adicionar a receita: ${error.message}. Tente novamente.`);
      setSavingIncome(false);
      console.log("savingIncome desativado devido a erro.");
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
    <View style={styles.container}>
      <Text style={styles.title}>Adicionar Nova Receita</Text>

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

      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>Tipo de Receita:</Text>
        <Picker
          selectedValue={incomeType}
          onValueChange={(itemValue) => setIncomeType(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Fixo (Mensal)" value="Fixo" />
          <Picker.Item label="Ganho (Pontual)" value="Ganho" />
        </Picker>
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
        onPress={handleAddIncome}
        disabled={savingIncome}
      >
        {savingIncome ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Adicionar Receita</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
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
  pickerContainer: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  pickerLabel: {
    fontSize: 16,
    color: '#555',
    paddingLeft: 15,
    paddingTop: 8,
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

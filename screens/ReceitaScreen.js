// screens/ReceitaScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

export default function ReceitaScreen() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loadingFirebase, setLoadingFirebase] = useState(true);
  const [incomeName, setIncomeName] = useState('');
  const [incomeValue, setIncomeValue] = useState('');
  const [incomeType, setIncomeType] = useState('Fixo'); // 'Fixo' ou 'Ganho'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [savingIncome, setSavingIncome] = useState(false);

  // Initialize Firebase and authenticate
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const dbInstance = getFirestore(app);

        setAuth(authInstance);
        setDb(dbInstance);

        const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
            if (initialAuthToken) {
              await signInWithCustomToken(authInstance, initialAuthToken);
            } else {
              await signInAnonymously(authInstance);
            }
            // Ensure userId is set after auth state is determined
            setUserId(authInstance.currentUser?.uid || crypto.randomUUID());
          }
          setLoadingFirebase(false);
        });

        return () => unsubscribe(); // Cleanup auth listener
      } catch (error) {
        console.error("Error initializing Firebase:", error);
        setLoadingFirebase(false);
      }
    };

    initializeFirebase();
  }, []); // Run once on component mount

  const handleDateChange = (event, date) => {
    setShowDatePicker(Platform.OS === 'ios'); // Fecha o picker no Android
    if (date) {
      setSelectedDate(date);
    }
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  const handleAddIncome = async () => {
    if (!incomeName.trim() || !incomeValue.trim()) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    const value = parseFloat(incomeValue.replace(',', '.'));
    if (isNaN(value) || value <= 0) {
      Alert.alert('Erro', 'Por favor, insira um valor válido para a receita.');
      return;
    }

    if (!db || !userId) {
      Alert.alert('Erro', 'Serviços de banco de dados não disponíveis. Tente novamente.');
      console.error("Firestore ou UserId não estão prontos.");
      return;
    }

    setSavingIncome(true);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const incomesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/incomes`);

      const incomeData = {
        name: incomeName.trim(),
        value: value,
        type: incomeType,
        createdAt: new Date().toISOString(), // Data de criação
      };

      if (incomeType === 'Ganho') {
        incomeData.month = selectedDate.getMonth(); // Mês é 0-indexado
        incomeData.year = selectedDate.getFullYear();
      }
      // Se for "Fixo", não precisa de month/year específico, pois se aplica a todos os meses
      // ou a lógica de aplicação será no HomeScreen.

      await addDoc(incomesCollectionRef, incomeData);
      Alert.alert('Sucesso', 'Receita adicionada com sucesso!');
      
      // Limpar formulário
      setIncomeName('');
      setIncomeValue('');
      setIncomeType('Fixo');
      setSelectedDate(new Date());

    } catch (error) {
      console.error("Erro ao adicionar receita:", error);
      Alert.alert('Erro', 'Ocorreu um erro ao adicionar a receita. Tente novamente.');
    } finally {
      setSavingIncome(false);
    }
  };

  if (loadingFirebase) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Carregando serviços de finanças...</Text>
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
        onChangeText={(text) => setIncomeValue(text.replace(/[^0-9,.]/g, '').replace('.', ','))} // Permite vírgula para decimal
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
              display="spinner" // ou "default"
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

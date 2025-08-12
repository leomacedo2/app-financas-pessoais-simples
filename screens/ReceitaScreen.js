// screens/ReceitaScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

export default function ReceitaScreen({ navigation }) {
  const [loadingApp, setLoadingApp] = useState(true);
  const [incomes, setIncomes] = useState([]);

  const loadIncomes = useCallback(async () => {
    setLoadingApp(true);
    try {
      const storedIncomesJson = await AsyncStorage.getItem('incomes');
      const storedIncomes = storedIncomesJson ? JSON.parse(storedIncomesJson) : [];
      
      const sortedIncomes = storedIncomes.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      setIncomes(sortedIncomes);
      console.log("Receitas carregadas do AsyncStorage. Total:", sortedIncomes.length);
    } catch (error) {
      console.error("Erro ao carregar receitas do AsyncStorage:", error);
      Alert.alert('Erro', 'Não foi possível carregar as receitas do armazenamento local.');
    } finally {
      setLoadingApp(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadIncomes();
      return () => {};
    }, [loadIncomes])
  );

  const renderIncomeItem = ({ item }) => (
    <View style={styles.incomeItem}>
      <Text style={styles.incomeName}>{item.name}</Text>
      <View style={styles.incomeDetails}>
        <Text style={styles.incomeType}>{item.type === 'Fixo' ? 'Fixo' : 'Ganho Pontual'}</Text>
        {item.type === 'Ganho' && item.month !== undefined && item.year !== undefined && (
          <Text style={styles.incomeDate}>
            {`${item.month + 1}/${item.year}`}
          </Text>
        )}
      </View>
      <Text style={styles.incomeValue}>
        {`${item.value.toFixed(2).replace('.', ',')} R$`}
      </Text>
    </View>
  );

  if (loadingApp) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Carregando suas receitas do armazenamento local...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Minhas Receitas</Text>
      {incomes.length > 0 ? (
        <FlatList
          data={incomes}
          renderItem={renderIncomeItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <Text style={styles.noIncomesText}>Nenhuma receita adicionada ainda. Adicione uma!</Text>
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AdicionarReceita')}
      >
        <Ionicons name="add" size={30} color="#fff" />
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
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  listContent: {
    paddingBottom: 80,
  },
  incomeItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  incomeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 2,
  },
  incomeDetails: {
    flex: 1.5,
    alignItems: 'flex-start',
    marginLeft: 10,
  },
  incomeType: {
    fontSize: 14,
    color: '#666',
  },
  incomeDate: {
    fontSize: 12,
    color: '#888',
  },
  incomeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#28a745',
    flex: 1,
    textAlign: 'right',
  },
  noIncomesText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#888',
  },
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#007bff',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
});

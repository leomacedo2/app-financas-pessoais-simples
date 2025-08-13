// screens/ReceitaScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, Pressable } from 'react-native'; // Adicionado Modal, Pressable
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

export default function ReceitaScreen({ navigation }) {
  const [loadingApp, setLoadingApp] = useState(true);
  const [incomes, setIncomes] = useState([]);
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState(null); // Para guardar a receita selecionada

  // Função para carregar as receitas do AsyncStorage
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

  // Usa useFocusEffect para recarregar as receitas sempre que a tela estiver em foco
  useFocusEffect(
    useCallback(() => {
      loadIncomes();
      return () => {
        // Opcional: Lógica de limpeza se necessário ao desfocar
      };
    }, [loadIncomes])
  );

  // Função para lidar com o toque longo em um item da receita
  const handleLongPressIncome = (income) => {
    setSelectedIncome(income);
    setIsActionModalVisible(true);
  };

  // Função para excluir uma receita
  const handleDeleteIncome = async () => {
    if (!selectedIncome) return;

    Alert.alert(
      "Confirmar Exclusão",
      `Tem certeza que deseja excluir a receita "${selectedIncome.name}"?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => setIsActionModalVisible(false) // Fecha o modal ao cancelar
        },
        {
          text: "Excluir",
          onPress: async () => {
            try {
              const existingIncomesJson = await AsyncStorage.getItem('incomes');
              let incomesArray = existingIncomesJson ? JSON.parse(existingIncomesJson) : [];
              
              const updatedIncomes = incomesArray.filter(
                (income) => income.id !== selectedIncome.id
              );

              await AsyncStorage.setItem('incomes', JSON.stringify(updatedIncomes));
              setIncomes(updatedIncomes); // Atualiza o estado da lista
              setIsActionModalVisible(false); // Fecha o modal
              setSelectedIncome(null); // Limpa a receita selecionada
              Alert.alert('Sucesso', 'Receita excluída com sucesso!');
              console.log("Receita excluída do AsyncStorage.");
            } catch (error) {
              console.error("Erro ao excluir receita do AsyncStorage:", error);
              Alert.alert('Erro', 'Não foi possível excluir a receita.');
            }
          }
        }
      ]
    );
  };

  // Função para editar uma receita (navega para AdicionarReceitaScreen)
  const handleEditIncome = () => {
    setIsActionModalVisible(false); // Fecha o modal
    if (selectedIncome) {
      navigation.navigate('AdicionarReceita', { incomeToEdit: selectedIncome });
    }
  };

  const renderIncomeItem = ({ item }) => (
    <TouchableOpacity
      style={styles.incomeItem}
      onLongPress={() => handleLongPressIncome(item)} // Adicionado onLongPress
    >
      <Text style={styles.incomeName}>{item.name}</Text>
      <View style={styles.incomeDetails}>
        <Text style={styles.incomeType}>{item.type === 'Fixo' ? 'Fixo' : 'Ganho Pontual'}</Text>
        {item.type === 'Ganho' && item.month !== undefined && item.year !== undefined && (
          <Text style={styles.incomeDate}>
            {/* Mês + 1 pois é 0-indexado em JavaScript */}
            {`${(item.month + 1).toString().padStart(2, '0')}/${item.year}`}
          </Text>
        )}
      </View>
      <Text style={styles.incomeValue}>
        {`${item.value.toFixed(2).replace('.', ',')} R$`}
      </Text>
    </TouchableOpacity>
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

      {/* Modal para ações de Edição/Exclusão */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isActionModalVisible}
        onRequestClose={() => {
          setIsActionModalVisible(!isActionModalVisible);
          setSelectedIncome(null); // Limpa a seleção ao fechar
        }}
      >
        <Pressable
          style={styles.centeredView}
          onPressOut={() => {
            setIsActionModalVisible(false);
            setSelectedIncome(null);
          }}
        >
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Ações para "{selectedIncome?.name}"</Text>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.buttonEdit]}
              onPress={handleEditIncome}
            >
              <Text style={styles.buttonTextStyle}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.buttonDelete]}
              onPress={handleDeleteIncome}
            >
              <Text style={styles.buttonTextStyle}>Excluir</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.buttonClose]}
              onPress={() => {
                setIsActionModalVisible(false);
                setSelectedIncome(null);
              }}
            >
              <Text style={styles.buttonTextStyle}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
  // Estilos do Modal
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', // Fundo escuro transparente
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%', // Largura do modal
  },
  modalTitle: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalButton: {
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    width: '100%', // Botões ocupam a largura total do modal
    marginBottom: 10, // Espaçamento entre botões
  },
  buttonEdit: {
    backgroundColor: '#2196F3', // Azul para editar
  },
  buttonDelete: {
    backgroundColor: '#f44336', // Vermelho para excluir
  },
  buttonClose: {
    backgroundColor: '#9e9e9e', // Cinza para cancelar
  },
  buttonTextStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
});

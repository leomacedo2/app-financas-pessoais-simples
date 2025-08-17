// screens/CartaoScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Importar useSafeAreaInsets


export default function CartaoScreen({ navigation }) {
  const insets = useSafeAreaInsets(); // Obter os insets da área segura

  const [loadingApp, setLoadingApp] = useState(true);
  const [cards, setCards] = useState([]);
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null); // Para guardar o cartão selecionado

  // Função para carregar os cartões do AsyncStorage
  const loadCards = useCallback(async () => {
    setLoadingApp(true);
    try {
      const storedCardsJson = await AsyncStorage.getItem('cards');
      const storedCards = storedCardsJson ? JSON.parse(storedCardsJson) : [];
      
      // Filtra para exibir apenas cartões ativos
      const activeCards = storedCards.filter(card => card.status !== 'inactive');

      // Opcional: ordenar cartões por apelido ou data de criação
      const sortedCards = activeCards.sort((a, b) => a.alias.localeCompare(b.alias));

      setCards(sortedCards);
      console.log("Cartões carregados (ativos) do AsyncStorage. Total:", sortedCards.length);
    } catch (error) {
      console.error("Erro ao carregar cartões do AsyncStorage:", error);
      Alert.alert('Erro', 'Não foi possível carregar seus cartões.');
    } finally {
      setLoadingApp(false);
    }
  }, []);

  // Usa useFocusEffect para recarregar os cartões sempre que a tela estiver em foco
  useFocusEffect(
    useCallback(() => {
      loadCards();
      return () => {};
    }, [loadCards])
  );

  // Função para lidar com o toque longo em um item do cartão
  const handleLongPressCard = (card) => {
    setSelectedCard(card);
    setIsActionModalVisible(true);
  };

  // Função para excluir um cartão (Exclusão Suave)
  const handleDeleteCard = async () => {
    if (!selectedCard) return;

    Alert.alert(
      "Confirmar Exclusão",
      `Tem certeza que deseja excluir o cartão "${selectedCard.alias}"? (Ele não aparecerá mais para seleção)`,
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => setIsActionModalVisible(false)
        },
        {
          text: "Excluir",
          onPress: async () => {
            try {
              const existingCardsJson = await AsyncStorage.getItem('cards');
              let cardsArray = existingCardsJson ? JSON.parse(existingCardsJson) : [];
              
              const updatedCardsArray = cardsArray.map(card => {
                if (card.id === selectedCard.id) {
                  return {
                    ...card,
                    status: 'inactive', // Marcar como inativo
                    deletedAt: new Date().toISOString(), // Registrar data de exclusão
                  };
                }
                return card;
              });

              await AsyncStorage.setItem('cards', JSON.stringify(updatedCardsArray));
              loadCards(); // Recarrega a lista para mostrar apenas os ativos
              setIsActionModalVisible(false);
              setSelectedCard(null);
              Alert.alert('Sucesso', 'Cartão excluído com sucesso! (Marcado como inativo)');
              console.log("Cartão marcado como inativo no AsyncStorage.");
            } catch (error) {
              console.error("Erro ao excluir cartão do AsyncStorage:", error);
              Alert.alert('Erro', 'Não foi possível excluir o cartão.');
            }
          }
        }
      ]
    );
  };

  // Função para editar um cartão (navega para AdicionarCartaoScreen)
  const handleEditCard = () => {
    setIsActionModalVisible(false);
    if (selectedCard) {
      navigation.navigate('AdicionarCartao', { cardToEdit: selectedCard });
    }
  };

  const renderCardItem = ({ item }) => (
    <TouchableOpacity
      style={styles.cardItem}
      onLongPress={() => handleLongPressCard(item)} // Adicionado onLongPress
    >
      <Ionicons name="card-outline" size={24} color="#007bff" style={styles.cardIcon} />
      <View style={styles.cardDetails}>
        <Text style={styles.cardAlias}>{item.alias}</Text>
        <Text style={styles.cardDueDay}>Dia de Vencimento: {String(item.dueDayOfMonth).padStart(2, '0')}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loadingApp) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Carregando seus cartões...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Meus Cartões</Text>
      {cards.length > 0 ? (
        <FlatList
          data={cards}
          renderItem={renderCardItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <Text style={styles.noCardsText}>Nenhum cartão adicionado ainda. Adicione um!</Text>
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AdicionarCartao')} // Navega para a nova tela
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
          setSelectedCard(null);
        }}
      >
        <Pressable
          style={styles.centeredView}
          onPressOut={() => {
            setIsActionModalVisible(false);
            setSelectedCard(null);
          }}
        >
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Ações para "{selectedCard?.alias}"</Text>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.buttonEdit]}
              onPress={handleEditCard}
            >
              <Text style={styles.buttonTextStyle}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.buttonDelete]}
              onPress={handleDeleteCard}
            >
              <Text style={styles.buttonTextStyle}>Excluir</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.buttonClose]}
              onPress={() => {
                setIsActionModalVisible(false);
                setSelectedCard(null);
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
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  listContent: {
    paddingBottom: 80,
  },
  cardItem: {
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
    alignItems: 'center',
  },
  cardIcon: {
    marginRight: 15,
  },
  cardDetails: {
    flex: 1,
  },
  cardAlias: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cardDueDay: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  noCardsText: {
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
    // Estilos do Modal (reutilizados do ReceitaScreen, com pequenas adaptações se necessário)
    centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    width: '80%',
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
    width: '100%',
    marginBottom: 10,
  },
  buttonEdit: {
    backgroundColor: '#2196F3',
  },
  buttonDelete: {
    backgroundColor: '#f44336',
  },
  buttonClose: {
    backgroundColor: '#9e9e9e',
  },
  buttonTextStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
});

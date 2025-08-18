// screens/CartaoScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Importa os estilos comuns para reutilização
import commonStyles from '../utils/commonStyles';
// Importa as chaves de AsyncStorage como constantes
import { ASYNC_STORAGE_KEYS } from '../utils/constants';


export default function CartaoScreen({ navigation }) {
  const insets = useSafeAreaInsets(); // Obter os insets da área segura

  const [loadingApp, setLoadingApp] = useState(true); // Estado para controlar o carregamento da tela
  const [cards, setCards] = useState([]); // Estado para armazenar a lista de cartões
  const [isActionModalVisible, setIsActionModalVisible] = useState(false); // Controla a visibilidade do modal de ações
  const [selectedCard, setSelectedCard] = useState(null); // Para guardar o cartão selecionado no modal

  /**
   * Função para carregar os cartões do AsyncStorage.
   * Filtra apenas os cartões com status 'active'.
   */
  const loadCards = useCallback(async () => {
    setLoadingApp(true); // Ativa o estado de carregamento
    try {
      // Tenta obter os cartões armazenados
      const storedCardsJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CARDS);
      // Se houver cartões, faz o parse; caso contrário, inicializa um array vazio
      const storedCards = storedCardsJson ? JSON.parse(storedCardsJson) : [];
      
      // Filtra para exibir apenas cartões ativos (status diferente de 'inactive')
      const activeCards = storedCards.filter(card => card.status !== 'inactive');

      // Opcional: ordena os cartões por apelido para uma lista mais organizada
      const sortedCards = activeCards.sort((a, b) => a.alias.localeCompare(b.alias));

      setCards(sortedCards); // Atualiza o estado com os cartões filtrados e ordenados
      console.log("Cartões carregados (ativos) do AsyncStorage. Total:", sortedCards.length);
    } catch (error) {
      console.error("Erro ao carregar cartões do AsyncStorage:", error);
      Alert.alert('Erro', 'Não foi possível carregar seus cartões.');
    } finally {
      setLoadingApp(false); // Finaliza o estado de carregamento
    }
  }, []); // Dependências vazias garantem que a função só seja recriada uma vez

  /**
   * Hook para recarregar os dados da tela sempre que ela entra em foco.
   * Garante que a lista de cartões esteja sempre atualizada.
   */
  useFocusEffect(
    useCallback(() => {
      loadCards(); // Chama a função de carregamento
      return () => {
        // Opcional: Lógica de limpeza se necessário ao desfocar
      };
    }, [loadCards]) // Depende de loadCards para ser reexecutado se loadCards mudar
  );

  /**
   * Lida com o toque longo em um item do cartão, abrindo o modal de ações.
   * @param {object} card - O objeto do cartão selecionado.
   */
  const handleLongPressCard = (card) => {
    setSelectedCard(card); // Define o cartão selecionado
    setIsActionModalVisible(true); // Abre o modal de ações
  };

  /**
   * Lida com a exclusão de um cartão. Implementa "exclusão suave" (soft delete).
   * O cartão é marcado como 'inactive' e uma data de exclusão é registrada,
   * em vez de ser removido permanentemente do armazenamento.
   */
  const handleDeleteCard = async () => {
    if (!selectedCard) return; // Se nenhum cartão estiver selecionado, sai da função

    // Confirmação com o usuário antes de prosseguir com a exclusão
    Alert.alert(
      "Confirmar Exclusão",
      `Tem certeza que deseja excluir o cartão "${selectedCard.alias}"? (Ele não aparecerá mais para seleção)`,
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
              // Obtém todos os cartões existentes do AsyncStorage
              const existingCardsJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CARDS);
              let cardsArray = existingCardsJson ? JSON.parse(existingCardsJson) : [];
              
              // Mapeia o array de cartões, atualizando o status e deletedAt do cartão selecionado
              const updatedCardsArray = cardsArray.map(card => {
                if (card.id === selectedCard.id) {
                  return {
                    ...card,
                    status: 'inactive', // Marca o cartão como inativo
                    deletedAt: new Date().toISOString(), // Registra a data/hora da exclusão
                  };
                }
                return card; // Retorna os outros cartões inalterados
              });

              // Salva o array atualizado de volta no AsyncStorage
              await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.CARDS, JSON.stringify(updatedCardsArray));
              loadCards(); // Recarrega a lista de cartões (filtrará os inativos para exibição)
              setIsActionModalVisible(false); // Fecha o modal de ações
              setSelectedCard(null); // Limpa o cartão selecionado
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

  /**
   * Lida com a edição de um cartão. Navega para a tela AdicionarCartaoScreen,
   * passando os dados do cartão selecionado para pré-preenchimento do formulário.
   */
  const handleEditCard = () => {
    setIsActionModalVisible(false); // Fecha o modal de ações
    if (selectedCard) {
      navigation.navigate('AdicionarCartao', { cardToEdit: selectedCard });
    }
  };

  /**
   * Renderiza cada item da lista de cartões.
   * @param {object} item - O objeto do cartão a ser renderizado.
   */
  const renderCardItem = ({ item }) => (
    <TouchableOpacity
      style={styles.cardItem} // Estilo para o item individual do cartão
      onLongPress={() => handleLongPressCard(item)} // Ativa o modal de ações com toque longo
    >
      {/* Ícone de cartão */}
      <Ionicons name="card-outline" size={24} color="#007bff" style={styles.cardIcon} />
      <View style={styles.cardDetails}>
        {/* Apelido do cartão */}
        <Text style={styles.cardAlias}>{item.alias}</Text>
        {/* Dia de vencimento da fatura */}
        <Text style={styles.cardDueDay}>Dia de Vencimento: {String(item.dueDayOfMonth).padStart(2, '0')}</Text>
      </View>
    </TouchableOpacity>
  );

  // Exibe um indicador de carregamento enquanto os dados estão sendo carregados
  if (loadingApp) {
    return (
      <View style={commonStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Carregando seus cartões...</Text>
      </View>
    );
  }

  return (
    // Aplica o padding superior para respeitar a barra de notificação do dispositivo
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={commonStyles.title}>Meus Cartões</Text>
      {cards.length > 0 ? (
        // Renderiza a lista de cartões se houver itens
        <FlatList
          data={cards}
          renderItem={renderCardItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent} // Estilo para o conteúdo do FlatList
        />
      ) : (
        // Exibe uma mensagem se não houver cartões
        <Text style={commonStyles.noItemsText}>Nenhum cartão adicionado ainda. Adicione um!</Text>
      )}

      {/* Botão flutuante para adicionar novo cartão */}
      <TouchableOpacity
        style={styles.addButton} // Estilo específico para o botão flutuante nesta tela
        onPress={() => navigation.navigate('AdicionarCartao')} // Navega para a tela de adicionar cartão
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Modal para ações de Edição/Exclusão (reutiliza estilos comuns) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isActionModalVisible}
        onRequestClose={() => {
          setIsActionModalVisible(!isActionModalVisible);
          setSelectedCard(null); // Limpa a seleção ao fechar
        }}
      >
        {/* Área que pode ser tocada fora do modal para fechá-lo */}
        <Pressable
          style={commonStyles.centeredView}
          onPressOut={() => {
            setIsActionModalVisible(false);
            setSelectedCard(null);
          }}
        >
          {/* Conteúdo do modal */}
          <View style={commonStyles.modalView}>
            <Text style={commonStyles.modalTitle}>Ações para "{selectedCard?.alias}"</Text>
            
            <TouchableOpacity
              style={[commonStyles.modalButton, commonStyles.buttonEdit]}
              onPress={handleEditCard}
            >
              <Text style={commonStyles.buttonTextStyle}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[commonStyles.modalButton, commonStyles.buttonDelete]}
              onPress={handleDeleteCard}
            >
              <Text style={commonStyles.buttonTextStyle}>Excluir</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[commonStyles.modalButton, commonStyles.buttonClose]}
              onPress={() => {
                setIsActionModalVisible(false);
                setSelectedCard(null);
              }}
            >
              <Text style={commonStyles.buttonTextStyle}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Combina o container base dos estilos comuns com padding horizontal específico para esta tela
  container: {
    ...commonStyles.container,
    paddingHorizontal: 20,
  },
  // Sobrescreve o título para marginBottom específico desta tela se necessário
  title: {
    ...commonStyles.title,
    marginBottom: 20, // Título da lista tem menos espaço que os formulários
  },
  listContent: {
    paddingBottom: 80, // Espaço para o botão de adição flutuante
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
  // Estilo específico para o botão de adição flutuante (posição absoluta)
  addButton: {
    ...commonStyles.addButton, // Reutiliza o estilo base do botão
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30, // Transforma em círculo
  },
});

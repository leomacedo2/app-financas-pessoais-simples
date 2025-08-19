// screens/CartaoScreen.js

/**
 * @file Tela para exibir e gerenciar os cartões cadastrados.
 * Permite ao usuário visualizar seus cartões, editar detalhes de um cartão
 * ou excluí-lo (exclusão suave). Suporta rolagem vertical se houver muitos cartões.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Para os ícones
import AsyncStorage from '@react-native-async-storage/async-storage'; // Para armazenamento local
import { useFocusEffect } from '@react-navigation/native'; // Hook para recarregar dados ao focar na tela
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Para lidar com a área segura

// Importa os estilos comuns para reutilização
import commonStyles from '../utils/commonStyles';
// Importa as chaves de AsyncStorage como constantes
import { ASYNC_STORAGE_KEYS } from '../utils/constants';


export default function CartaoScreen({ navigation }) {
  const insets = useSafeAreaInsets(); // Obter os insets da área segura

  const [loadingApp, setLoadingApp] = useState(true); // Controla o carregamento da lista
  const [cards, setCards] = useState([]); // Estado para armazenar a lista de cartões
  const [isActionModalVisible, setIsActionModalVisible] = useState(false); // Controla a visibilidade do modal de ações
  const [selectedCard, setSelectedCard] = useState(null); // Armazena o cartão selecionado para ações

  /**
   * Função para carregar os cartões do AsyncStorage.
   * Filtra apenas os cartões com status 'active'.
   */
  const loadCards = useCallback(async () => {
    setLoadingApp(true); // Ativa o estado de carregamento
    try {
      // Tenta obter os cartões armazenados no AsyncStorage
      const storedCardsJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CARDS);
      // Se houver dados, faz o parse; caso contrário, inicializa um array vazio
      const storedCards = storedCardsJson ? JSON.parse(storedCardsJson) : [];
      
      // Filtra para exibir apenas cartões ativos (status diferente de 'inactive')
      const activeCards = storedCards.filter(card => card.status !== 'inactive');

      // Opcional: ordenar cartões por apelido para uma lista mais organizada
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
   * Garante que a lista de cartões esteja sempre atualizada (ex: após adicionar/editar um cartão).
   */
  useFocusEffect(
    useCallback(() => {
      loadCards(); // Chama a função de carregamento
      return () => {
        // Lógica de limpeza se necessário ao desfocar a tela (ex: listeners de dados)
      };
    }, [loadCards]) // Garante que o efeito seja reexecutado se 'loadCards' mudar
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
    <View style={[commonStyles.container, { paddingTop: insets.top }]}>
      {/* Título da tela, fixo no topo */}
      <Text style={commonStyles.title}>Meus Cartões</Text>
      
      {cards.length > 0 ? (
        // Renderiza a lista de cartões usando FlatList
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
        style={commonStyles.addButton} // Usa o estilo comum de botão flutuante
        onPress={() => navigation.navigate('AdicionarCartao')} // Navega para a tela de adicionar cartão
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
  container: {
    ...commonStyles.container, // Herda o estilo base
    paddingHorizontal: 20, // Padding lateral específico para a lista de cartões
    // Não precisa de flex: 1 aqui, pois commonStyles.container já define.
  },
  // O título já está com estilo em commonStyles.title, mas você pode sobrescrever se precisar de algo específico
  // title: {
  //   ...commonStyles.title,
  //   marginBottom: 20,
  // },
  listContent: {
    paddingBottom: 80, // Espaço para o botão de adição flutuante na parte inferior
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
  // O 'addButton' já vêm de commonStyles.
  // Você pode sobrescrever aqui se precisar de um estilo muito específico.
});

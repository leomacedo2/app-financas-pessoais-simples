// screens/ReceitaScreen.js
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

export default function ReceitaScreen({ navigation }) {
  const insets = useSafeAreaInsets(); // Obter os insets da área segura

  // Estados relacionados a dados
  const [incomes, setIncomes] = useState([]);
  const [loadingApp, setLoadingApp] = useState(true);
  
  // Estados relacionados ao modal de ações
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState(null); // Para guardar a receita selecionada

  /**
   * Função para carregar as receitas do AsyncStorage.
   * Filtra apenas as receitas ativas para exibição na lista principal.
   */
  const loadIncomes = useCallback(async () => {
    setLoadingApp(true);
    try {
      // Tenta obter as receitas armazenadas
      const storedIncomesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.INCOMES);
      // Se houver receitas, faz o parse; caso contrário, inicializa um array vazio
      const storedIncomes = storedIncomesJson ? JSON.parse(storedIncomesJson) : [];
      
      // Filtra para exibir apenas receitas ativas na lista (status diferente de 'inactive')
      const activeIncomes = storedIncomes.filter(income => income.status !== 'inactive');

      // Ordena as receitas ativas pela data de criação, da mais recente para a mais antiga
      const sortedIncomes = activeIncomes.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      setIncomes(sortedIncomes); // Atualiza o estado com as receitas filtradas e ordenadas
      console.log("Receitas carregadas (ativas) do AsyncStorage. Total:", sortedIncomes.length);
    } catch (error) {
      console.error("Erro ao carregar receitas do AsyncStorage:", error);
      Alert.alert('Erro', 'Não foi possível carregar as receitas do armazenamento local.');
    } finally {
      setLoadingApp(false); // Finaliza o estado de carregamento
    }
  }, []); // Dependências vazias garantem que a função só seja recriada uma vez

  /**
   * Hook para recarregar os dados da tela sempre que ela entra em foco.
   * Garante que a lista de receitas esteja sempre atualizada.
   */
  useFocusEffect(
    useCallback(() => {
      loadIncomes(); // Chama a função de carregamento
      return () => {
        // Opcional: Lógica de limpeza se necessário ao desfocar a tela
      };
    }, [loadIncomes]) // Depende de loadIncomes para ser reexecutado se loadIncomes mudar
  );

  // Handlers do Modal
  /**
   * Lida com o toque longo em um item da receita, abrindo o modal de ações.
   * @param {object} income - O objeto da receita selecionada.
   */
  const handleLongPressIncome = (income) => {
    setSelectedIncome(income); // Define a receita selecionada
    setIsActionModalVisible(true); // Abre o modal de ações
  };

  /**
   * Fecha o modal de ações e limpa a seleção
   */
  const handleCloseModal = () => {
    setIsActionModalVisible(false);
    setSelectedIncome(null);
  };

  // Handlers de Manipulação de Dados
  /**
   * Lida com a exclusão de uma receita. Implementa "exclusão suave" (soft delete).
   * A receita é marcada como 'inactive' e uma data de exclusão é registrada,
   * em vez de ser removida permanentemente do armazenamento.
   */
  const handleDeleteIncome = async () => {
    if (!selectedIncome) return; // Se nenhuma receita estiver selecionada, sai da função

    // Confirmação com o usuário antes de prosseguir com a exclusão
    Alert.alert(
      "Confirmar Exclusão",
      `Tem certeza que deseja excluir a receita "${selectedIncome.name}"? (Ela será removida dos meses futuros)`,
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
              // Obtém todas as receitas existentes do AsyncStorage
              const existingIncomesJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.INCOMES);
              let incomesArray = existingIncomesJson ? JSON.parse(existingIncomesJson) : [];
              
              // Mapeia o array de receitas, atualizando o status e deletedAt da receita selecionada
              const updatedIncomesArray = incomesArray.map(income => {
                if (income.id === selectedIncome.id) {
                  return {
                    ...income,
                    status: 'inactive', // Marca a receita como inativa
                    deletedAt: new Date().toISOString(), // Registra a data/hora da exclusão
                  };
                }
                return income; // Retorna as outras receitas inalteradas
              });

              // Salva o array atualizado de volta no AsyncStorage
              await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.INCOMES, JSON.stringify(updatedIncomesArray));
              loadIncomes(); // Recarrega a lista de receitas (filtrará as inativas para exibição)
              setIsActionModalVisible(false); // Fecha o modal de ações
              setSelectedIncome(null); // Limpa a receita selecionada
              Alert.alert('Sucesso', 'Receita excluída com sucesso! (Não aparecerá mais nos meses atuais/futuros)');
              console.log("Receita marcada como inativa no AsyncStorage.");
            } catch (error) {
              console.error("Erro ao excluir receita do AsyncStorage:", error);
              Alert.alert('Erro', 'Não foi possível excluir a receita.');
            }
          }
        }
      ]
    );
  };

  /**
   * Lida com a edição de uma receita. Navega para a tela AdicionarReceitaScreen,
   * passando os dados da receita selecionada para pré-preenchimento do formulário.
   */
  const handleEditIncome = () => {
    setIsActionModalVisible(false); // Fecha o modal de ações
    if (selectedIncome) {
      navigation.navigate('AdicionarReceita', { incomeToEdit: selectedIncome });
    }
  };

  /**
   * Renderiza cada item da lista de receitas.
   * @param {object} item - O objeto da receita a ser renderizada.
   */
  const renderIncomeItem = ({ item }) => (
    <TouchableOpacity
      style={styles.incomeItem}
      onLongPress={() => handleLongPressIncome(item)}
    >
      <View style={styles.leftColumn}>
        <Text style={styles.incomeName}>{item.name}</Text>
        <View style={styles.incomeDetails}>
          <Text style={styles.incomeType}>{item.type === 'Fixo' ? 'Receita Fixa' : 'Ganho Pontual'}</Text>
          {item.type === 'Ganho' && item.month !== undefined && item.year !== undefined && (
            <Text style={styles.incomeDate}>
              • {`${(item.month + 1).toString().padStart(2, '0')}/${item.year}`}
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.incomeValue}>
        R$ {item.value.toFixed(2).replace('.', ',')}
      </Text>
    </TouchableOpacity>
  );

  // Exibe um indicador de carregamento enquanto os dados estão sendo carregados
  if (loadingApp) {
    return (
      <View style={commonStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Carregando suas receitas do armazenamento local...</Text>
      </View>
    );
  }

  return (
    // Aplica o padding superior para respeitar a barra de notificação do dispositivo
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={commonStyles.title}>Minhas Receitas</Text>
      {incomes.length > 0 ? (
        // Renderiza a lista de receitas se houver itens
        <FlatList
          data={incomes}
          renderItem={renderIncomeItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent} // Estilo para o conteúdo do FlatList
        />
      ) : (
        // Exibe uma mensagem se não houver receitas
        <View style={commonStyles.container}>
          <Text style={commonStyles.noItemsText}>Nenhuma receita adicionada ainda.</Text>
          <Text style={commonStyles.noItemsText}>Adicione uma!</Text>
        </View>
      )}

      {/* Botão flutuante para adicionar nova receita */}
      <TouchableOpacity
        style={styles.addButton} // Estilo específico para o botão flutuante nesta tela (já circular)
        onPress={() => navigation.navigate('AdicionarReceita')} // Navega para a tela de adicionar
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {/* Modal para ações de Edição/Exclusão */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isActionModalVisible}
        onRequestClose={handleCloseModal}
      >
        {/* Área que pode ser tocada fora do modal para fechá-lo */}
        <Pressable
          style={commonStyles.centeredView}
          onPressOut={handleCloseModal}
        >
          {/* Conteúdo do modal */}
          <View style={commonStyles.modalView}>
            {/* CORREÇÃO: Garante que o texto seja sempre válido para evitar o erro */}
            <Text style={commonStyles.modalTitle}>Ações para "{selectedIncome?.name || 'Receita Selecionada'}"</Text>
            
            {/* NOVO: Container para botões empilhados */}
            <View style={commonStyles.modalStackedButtonsContainer}>
              <TouchableOpacity
                style={[commonStyles.modalButton, commonStyles.modalButtonStacked, commonStyles.buttonEdit]}
                onPress={handleEditIncome}
              >
                <Text style={commonStyles.buttonTextStyle}>Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[commonStyles.modalButton, commonStyles.modalButtonStacked, commonStyles.buttonDelete]}
                onPress={handleDeleteIncome}
              >
                <Text style={commonStyles.buttonTextStyle}>Excluir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[commonStyles.modalButton, commonStyles.modalButtonStacked, commonStyles.buttonClose]}
                onPress={() => {
                  setIsActionModalVisible(false);
                  setSelectedIncome(null);
                }}
              >
                <Text style={commonStyles.buttonTextStyle}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Estilos do container e lista
  container: {
    ...commonStyles.container,
  },
  title: {
    ...commonStyles.title,
    marginBottom: 20,
  },
  listContent: {
    ...commonStyles.listContent,
  },

  // Estilos do card de receita
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
  },
  leftColumn: {
    flex: 1,
    justifyContent: 'center',
  },

  // Estilos de texto
  incomeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  incomeType: {
    fontSize: 14,
    color: '#666',
  },
  incomeDate: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  incomeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#28a745',
    textAlign: 'right',
    marginLeft: 15,
  },

  // Estilos de layout
  incomeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Estilos do botão flutuante
  addButton: {
    ...commonStyles.addButton,
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
  },
});

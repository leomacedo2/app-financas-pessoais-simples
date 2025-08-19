// screens/ReceitaScreen.js

/**
 * @file Tela para exibir e gerenciar as receitas cadastradas.
 * Permite ao usuário visualizar suas receitas, editar detalhes de uma receita
 * ou excluí-la (exclusão suave). Suporta rolagem vertical se houver muitas receitas.
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

export default function ReceitaScreen({ navigation }) {
  const insets = useSafeAreaInsets(); // Obter os insets da área segura

  const [loadingApp, setLoadingApp] = useState(true); // Controla o carregamento da lista
  const [incomes, setIncomes] = useState([]); // Estado para armazenar a lista de receitas
  const [isActionModalVisible, setIsActionModalVisible] = useState(false); // Controla a visibilidade do modal de ações
  const [selectedIncome, setSelectedIncome] = useState(null); // Para guardar a receita selecionada para ações

  /**
   * Função para carregar as receitas do AsyncStorage.
   * Filtra apenas as receitas ativas para exibição na lista principal.
   */
  const loadIncomes = useCallback(async () => {
    setLoadingApp(true); // Ativa o estado de carregamento
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

  /**
   * Lida com o toque longo em um item da receita, abrindo o modal de ações.
   * @param {object} income - O objeto da receita selecionada.
   */
  const handleLongPressIncome = (income) => {
    setSelectedIncome(income); // Define a receita selecionada
    setIsActionModalVisible(true); // Abre o modal de ações
  };

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
      style={styles.incomeItem} // Estilo para o item individual da receita
      onLongPress={() => handleLongPressIncome(item)} // Ativa o modal de ações com toque longo
    >
      <Text style={styles.incomeName}>{item.name}</Text>
      <View style={styles.incomeDetails}>
        {/* Exibe o tipo da receita */}
        <Text style={styles.incomeType}>{item.type === 'Fixo' ? 'Fixo' : 'Ganho Pontual'}</Text>
        {/* Exibe o mês/ano para receitas do tipo 'Ganho' */}
        {item.type === 'Ganho' && item.month !== undefined && item.year !== undefined && (
          <Text style={styles.incomeDate}>
            {/* Mês + 1 pois é 0-indexado em JavaScript */}
            {`${(item.month + 1).toString().padStart(2, '0')}/${item.year}`}
          </Text>
        )}
      </View>
      {/* Exibe o valor da receita formatado */}
      <Text style={styles.incomeValue}>
        {`${item.value.toFixed(2).replace('.', ',')} R$`}
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
    <View style={[commonStyles.container, { paddingTop: insets.top }]}>
      {/* Título da tela, fixo no topo */}
      <Text style={commonStyles.title}>Minhas Receitas</Text>
      
      {incomes.length > 0 ? (
        // Renderiza a lista de receitas usando FlatList
        <FlatList
          data={incomes}
          renderItem={renderIncomeItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent} // Estilo para o conteúdo do FlatList
        />
      ) : (
        // Exibe uma mensagem se não houver receitas
        <Text style={commonStyles.noItemsText}>Nenhuma receita adicionada ainda. Adicione uma!</Text>
      )}

      {/* Botão flutuante para adicionar nova receita */}
      <TouchableOpacity
        style={commonStyles.addButton} // Usa o estilo comum de botão flutuante
        onPress={() => navigation.navigate('AdicionarReceita')} // Navega para a tela de adicionar
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
        {/* Área que pode ser tocada fora do modal para fechá-lo */}
        <Pressable
          style={commonStyles.centeredView}
          onPressOut={() => {
            setIsActionModalVisible(false);
            setSelectedIncome(null);
          }}
        >
          {/* Conteúdo do modal */}
          <View style={commonStyles.modalView}>
            <Text style={commonStyles.modalTitle}>Ações para "{selectedIncome?.name}"</Text>
            
            <TouchableOpacity
              style={[commonStyles.modalButton, commonStyles.buttonEdit]}
              onPress={handleEditIncome}
            >
              <Text style={commonStyles.buttonTextStyle}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[commonStyles.modalButton, commonStyles.buttonDelete]}
              onPress={handleDeleteIncome}
            >
              <Text style={commonStyles.buttonTextStyle}>Excluir</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[commonStyles.modalButton, commonStyles.buttonClose]}
              onPress={() => {
                setIsActionModalVisible(false);
                setSelectedIncome(null);
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
    paddingHorizontal: 20, // Padding lateral específico para a lista de receitas
  },
  // O título já está com estilo em commonStyles.title, mas você pode sobrescrever se precisar de algo específico
  // title: {
  //   ...commonStyles.title,
  //   marginBottom: 20,
  // },
  listContent: {
    paddingBottom: 80, // Espaço para o botão de adição flutuante na parte inferior
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
    flex: 2, // Ocupa mais espaço para o nome
  },
  incomeDetails: {
    flex: 1.5, // Ajusta o espaço para tipo e data
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
    color: '#28a745', // Verde para receitas
    flex: 1,
    textAlign: 'right',
  },
  // O 'addButton' já vêm de commonStyles.
  // Você pode sobrescrever aqui se precisar de um estilo muito específico.
});

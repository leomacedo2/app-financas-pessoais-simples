// screens/AdicionarCartaoScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Componente de seleção para o dia de vencimento
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Importar useSafeAreaInsets para lidar com a barra de status

// Importa os estilos comuns e as constantes para reutilização
import commonStyles from '../utils/commonStyles';
import { ASYNC_STORAGE_KEYS } from '../utils/constants';


export default function AdicionarCartaoScreen({ navigation, route }) {
  const insets = useSafeAreaInsets(); // Obtém os insets da área segura (ex: altura da barra de status)

  const [cardAlias, setCardAlias] = useState(''); // Estado para o apelido do cartão
  const [dueDayOfMonth, setDueDayOfMonth] = useState('1'); // Estado para o dia de vencimento (string para o Picker)
  const [savingCard, setSavingCard] = useState(false); // Estado para controlar o salvamento do cartão (mostra ActivityIndicator)

  const [isEditing, setIsEditing] = useState(false); // Indica se a tela está em modo de edição
  const [currentCardId, setCurrentCardId] = useState(null); // ID do cartão se estiver em edição
  const [currentCardStatus, setCurrentCardStatus] = useState('active'); // Status do cartão (ativo/inativo para exclusão suave)

  /**
   * useEffect para preencher o formulário se a tela for acessada para edição de um cartão.
   * Roda quando `route.params.cardToEdit` muda.
   */
  useEffect(() => {
    if (route.params?.cardToEdit) {
      const card = route.params.cardToEdit;
      setIsEditing(true); // Define o modo de edição
      setCurrentCardId(card.id); // Armazena o ID do cartão
      setCardAlias(card.alias); // Preenche o apelido
      setDueDayOfMonth(String(card.dueDayOfMonth)); // Preenche o dia de vencimento (converte para string para o Picker)
      setCurrentCardStatus(card.status || 'active'); // Carrega o status (padrão 'active' se não definido)
    } else {
      // Se não houver `cardToEdit` nos parâmetros, o formulário é para um novo cartão
      setIsEditing(false); // Modo de adição
      setCurrentCardId(null);
      setCardAlias('');
      setDueDayOfMonth('1'); // Reinicia para o dia 1 para nova adição
      setCurrentCardStatus('active'); // Novo cartão é sempre ativo por padrão
    }
  }, [route.params?.cardToEdit]); // Roda sempre que os parâmetros de rota mudam

  /**
   * Lida com o salvamento ou atualização de um cartão no AsyncStorage.
   */
  const handleSaveCard = async () => {
    // Validação básica do campo de apelido
    if (!cardAlias.trim()) {
      Alert.alert('Erro', 'Por favor, insira um apelido para o cartão.');
      return;
    }

    setSavingCard(true); // Ativa o estado de salvamento (mostra ActivityIndicator)

    try {
      // Carrega os cartões existentes do AsyncStorage
      const existingCardsJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CARDS);
      let cards = existingCardsJson ? JSON.parse(existingCardsJson) : [];

      // Prepara os dados do cartão a ser salvo/atualizado
      let cardData = {
        alias: cardAlias.trim(),
        dueDayOfMonth: parseInt(dueDayOfMonth, 10), // Converte o dia para número inteiro
        status: currentCardStatus, // Mantém o status atual (útil para edição de cartões inativos)
      };

      if (isEditing && currentCardId) {
        // --- Lógica para EDIÇÃO de Cartão ---
        cardData.id = currentCardId; // Mantém o mesmo ID para atualização
        // Preserva a data de criação original se estiver editando
        cardData.createdAt = route.params.cardToEdit.createdAt; 
        // Preserva a data de exclusão suave se estiver editando e já havia sido excluído
        cardData.deletedAt = route.params.cardToEdit.deletedAt || null;

        // Encontra o índice do cartão a ser editado no array
        const index = cards.findIndex(c => c.id === currentCardId);
        if (index !== -1) {
          cards[index] = cardData; // Atualiza o item no array
        } else {
          // Caso o cartão a ser editado não seja encontrado (situação improvável, mas para segurança)
          console.warn("Cartão a ser editado não encontrado. Adicionando como novo.");
          cards.push({ ...cardData, id: Date.now().toString(), createdAt: new Date().toISOString() });
        }
        await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.CARDS, JSON.stringify(cards)); // Salva no AsyncStorage
        Alert.alert('Sucesso', 'Cartão atualizado com sucesso!');
        console.log("Cartão atualizado com sucesso no AsyncStorage.");

      } else {
        // --- Lógica para ADIÇÃO de Novo Cartão ---
        cardData.id = Date.now().toString(); // Gera um ID único baseado no timestamp
        cardData.createdAt = new Date().toISOString(); // Registra a data/hora de criação
        cardData.status = 'active'; // Novo cartão é sempre ativo por padrão

        cards.push(cardData); // Adiciona o novo cartão ao array
        await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.CARDS, JSON.stringify(cards)); // Salva no AsyncStorage
        Alert.alert('Sucesso', 'Cartão adicionado com sucesso!');
        console.log("Cartão adicionado com sucesso no AsyncStorage.");
      }

      // Limpa o formulário após o sucesso do salvamento/atualização
      setCardAlias('');
      setDueDayOfMonth('1');
      setIsEditing(false);
      setCurrentCardId(null);
      setCurrentCardStatus('active');

      // Navega de volta para a lista de cartões com um pequeno delay
      setTimeout(() => {
        navigation.goBack();
      }, 100);

    } catch (error) {
      console.error("AdicionarCartaoScreen: Erro ao salvar cartão no AsyncStorage:", error);
      Alert.alert('Erro', `Ocorreu um erro ao salvar o cartão: ${error.message}. Tente novamente.`);
    } finally {
      setSavingCard(false); // Desativa o estado de salvamento
    }
  };

  /**
   * Gera os itens <Picker.Item> para o seletor de dia de vencimento (1 a 31).
   * @returns {JSX.Element[]} Um array de componentes Picker.Item.
   */
  const renderDayPickerItems = () => {
    const days = [];
    for (let i = 1; i <= 31; i++) {
      // Adiciona um item para cada dia, formatando com zero à esquerda se for menor que 10
      days.push(<Picker.Item key={i} label={String(i).padStart(2, '0')} value={String(i)} />);
    }
    return days;
  };

  return (
    // Container principal da tela, aplicando o padding superior para respeitar a barra de status
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Título da tela, dinâmico para edição ou adição */}
      <Text style={commonStyles.title}>{isEditing ? "Editar Cartão" : "Adicionar Novo Cartão"}</Text>

      {/* Campo de input para o apelido do cartão */}
      <TextInput
        style={commonStyles.input} // Usa o estilo de input comum
        placeholder="Apelido do Cartão (Ex: Meu Cartão MasterCard, Cartão Nubank)"
        value={cardAlias}
        onChangeText={setCardAlias}
      />

      {/* Container para o seletor de dia de vencimento */}
      <View style={commonStyles.pickerContainer}>
        <Text style={commonStyles.pickerLabel}>Dia de Vencimento da Fatura:</Text>
        <Picker
          selectedValue={dueDayOfMonth} // Valor selecionado
          onValueChange={(itemValue) => setDueDayOfMonth(itemValue)} // Atualiza o estado ao mudar
          style={commonStyles.picker} // Estilo do Picker
        >
          {renderDayPickerItems()} {/* Renderiza os dias de 1 a 31 */}
        </Picker>
      </View>

      {/* Botão para Salvar/Adicionar Cartão */}
      <TouchableOpacity
        style={commonStyles.addButton} // Usa o estilo de botão comum
        onPress={handleSaveCard} // Chama a função de salvar
        disabled={savingCard} // Desabilita o botão enquanto estiver salvando
      >
        {savingCard ? (
          <ActivityIndicator color="#fff" /> // Mostra um spinner enquanto salva
        ) : (
          <Text style={commonStyles.buttonText}>{isEditing ? "Salvar Alterações" : "Adicionar Cartão"}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Combina o container base dos estilos comuns com padding horizontal específico para esta tela
  container: {
    ...commonStyles.container,
    paddingHorizontal: 20,
  },
  // O restante dos estilos já é coberto por commonStyles, então não precisa de redefinição aqui
});

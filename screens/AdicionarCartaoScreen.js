// screens/AdicionarCartaoScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Importar useSafeAreaInsets

// Importa os estilos comuns para reutilização
import commonStyles from '../utils/commonStyles';
// Importa as chaves de AsyncStorage como constantes
import { ASYNC_STORAGE_KEYS } from '../utils/constants';


export default function AdicionarCartaoScreen({ navigation, route }) {
  const insets = useSafeAreaInsets(); // Obter os insets da área segura

  const [cardAlias, setCardAlias] = useState('');
  const [dueDayOfMonth, setDueDayOfMonth] = useState('1'); // Dia do vencimento, como string para o Picker
  const [savingCard, setSavingCard] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [currentCardId, setCurrentCardId] = useState(null);
  const [currentCardStatus, setCurrentCardStatus] = useState('active'); // Adiciona estado para status

  // useEffect para preencher o formulário se for uma edição
  useEffect(() => {
    if (route.params?.cardToEdit) {
      const card = route.params.cardToEdit;
      setIsEditing(true);
      setCurrentCardId(card.id);
      setCardAlias(card.alias);
      // Garante que dueDayOfMonth seja sempre uma string, com fallback para '1'
      setDueDayOfMonth(String(card.dueDayOfMonth || '1')); 
      setCurrentCardStatus(card.status || 'active'); // Carrega o status existente
    } else {
      // Se não houver `cardToEdit` nos parâmetros, o formulário é para um novo cartão
      setIsEditing(false);
      setCurrentCardId(null);
      setCardAlias('');
      setDueDayOfMonth('1'); // Padrão para nova
      setCurrentCardStatus('active'); // Novo cartão sempre inicia como ativa
    }
  }, [route.params?.cardToEdit]); // Roda sempre que os parâmetros de rota mudam

  // Função para salvar ou atualizar o cartão
  const handleSaveCard = async () => {
    if (!cardAlias.trim()) {
      Alert.alert('Erro', 'Por favor, insira um apelido para o cartão.');
      return;
    }

    const day = parseInt(dueDayOfMonth, 10);
    if (isNaN(day) || day < 1 || day > 31) {
      Alert.alert('Erro', 'Por favor, insira um dia de vencimento válido (entre 1 e 31).');
      return;
    }

    setSavingCard(true); // Ativa o indicador de carregamento

    try {
      const storedCardsJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CARDS);
      let cards = storedCardsJson ? JSON.parse(storedCardsJson) : [];

      // Dados básicos do cartão
      let cardData = {
        alias: cardAlias.trim(),
        dueDayOfMonth: day,
        status: currentCardStatus, // Mantém o status existente ou 'active'
      };

      if (isEditing && currentCardId) {
        // Modo de edição: mantém o ID existente e a data de criação
        cardData.id = currentCardId;
        cardData.createdAt = route.params.cardToEdit.createdAt;

        const index = cards.findIndex(c => c.id === currentCardId);
        if (index !== -1) {
          cards[index] = cardData; // Atualiza o cartão no array
        } else {
          // Caso não encontre (improvável), adiciona como novo para evitar perda de dados
          console.warn("Cartão a ser editado não encontrado. Adicionando como novo.");
          cards.push({ ...cardData, id: Date.now().toString(), createdAt: new Date().toISOString() });
        }
        Alert.alert('Sucesso', 'Cartão atualizado com sucesso!');
        console.log("Cartão atualizado no AsyncStorage:", cardData);
      } else {
        // Modo de adição: gera um novo ID e data de criação
        cardData.id = Date.now().toString(); // ID único
        cardData.createdAt = new Date().toISOString(); // Data de criação
        cardData.status = 'active'; // Novo cartão é sempre ativo

        cards.push(cardData); // Adiciona o novo cartão ao array
        Alert.alert('Sucesso', 'Cartão adicionado com sucesso!');
        console.log("Novo cartão adicionado ao AsyncStorage:", cardData);
      }

      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.CARDS, JSON.stringify(cards));

      // Limpa o formulário e volta para a tela anterior
      setCardAlias('');
      setDueDayOfMonth('1');
      setIsEditing(false);
      setCurrentCardId(null);
      setCurrentCardStatus('active');

      setTimeout(() => {
        navigation.goBack(); // Volta para a tela de lista de cartões
      }, 100);

    } catch (error) {
      console.error("AdicionarCartaoScreen: Erro ao salvar cartão no AsyncStorage:", error);
      Alert.alert('Erro', `Ocorreu um erro ao salvar o cartão: ${error.message}.`);
    } finally {
      setSavingCard(false); // Desativa o indicador de carregamento
    }
  };

  return (
    // Aplica o padding superior para respeitar a barra de notificação do dispositivo
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ScrollView para garantir que o formulário seja rolável */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Título da tela, dinâmico para edição ou adição */}
        <Text style={commonStyles.title}>{isEditing ? "Editar Cartão" : "Adicionar Novo Cartão"}</Text>

        {/* Campo de input para o apelido do cartão */}
        <TextInput
          style={commonStyles.input}
          placeholder="Apelido do Cartão (Ex: Cartão Nubank, Cartão Viagem)"
          value={cardAlias}
          onChangeText={setCardAlias}
        />

        {/* Seletor para o dia de vencimento da fatura */}
        <View style={commonStyles.pickerContainer}>
          <Text style={commonStyles.pickerLabel}>Dia do Vencimento da Fatura:</Text>
          <Picker
            selectedValue={dueDayOfMonth}
            onValueChange={(itemValue) => setDueDayOfMonth(itemValue)}
            style={commonStyles.picker}
          >
            {/* Gera opções de 1 a 31 para o dia do vencimento */}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <Picker.Item key={String(day)} label={String(day)} value={String(day)} />
            ))}
          </Picker>
        </View>

        {/* Botão para Salvar/Adicionar Cartão */}
        <TouchableOpacity
          style={commonStyles.addButton}
          onPress={handleSaveCard}
          disabled={savingCard}
        >
          {savingCard ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={commonStyles.buttonText}>{isEditing ? "Salvar Alterações" : "Adicionar Cartão"}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.container,
  },
  scrollContent: {
    ...commonStyles.scrollContent,
  },
  // Outros estilos específicos desta tela podem ser adicionados aqui se necessário
});

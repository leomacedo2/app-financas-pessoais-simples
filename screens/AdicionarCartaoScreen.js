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
  const insets = useSafeAreaInsets();

  // Estados do formulário
  const [cardAlias, setCardAlias] = useState('');
  const [dueDayOfMonth, setDueDayOfMonth] = useState('1');
  
  // Estados de controle
  const [savingCard, setSavingCard] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Estados de dados do cartão
  const [currentCardId, setCurrentCardId] = useState(null);
  const [currentCardStatus, setCurrentCardStatus] = useState('active');

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

  /**
   * Valida os dados do formulário
   * @returns {boolean} Verdadeiro se os dados são válidos
   */
  const validateFormData = () => {
    if (!cardAlias.trim()) {
      Alert.alert('Erro', 'Por favor, insira um apelido para o cartão.');
      return false;
    }

    const day = parseInt(dueDayOfMonth, 10);
    if (isNaN(day) || day < 1 || day > 31) {
      Alert.alert('Erro', 'Por favor, insira um dia de vencimento válido (entre 1 e 31).');
      return false;
    }

    return true;
  };

  /**
   * Prepara os dados do cartão para salvar
   * @returns {Object} Dados do cartão formatados
   */
  const prepareCardData = () => {
    const day = parseInt(dueDayOfMonth, 10);
    return {
      alias: cardAlias.trim(),
      dueDayOfMonth: day,
      status: currentCardStatus,
      ...(isEditing && currentCardId ? {
        id: currentCardId,
        createdAt: route.params.cardToEdit.createdAt
      } : {
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      })
    };
  };

  /**
   * Função para salvar ou atualizar o cartão
   */
  const handleSaveCard = async () => {
    if (!validateFormData()) return;
    setSavingCard(true); // Ativa o indicador de carregamento

    try {
      const storedCardsJson = await AsyncStorage.getItem(ASYNC_STORAGE_KEYS.CARDS);
      let cards = storedCardsJson ? JSON.parse(storedCardsJson) : [];
      
      const cardData = prepareCardData();

      if (isEditing) {
        const index = cards.findIndex(c => c.id === currentCardId);
        if (index !== -1) {
          cards[index] = cardData;
        } else {
          console.warn("Cartão a ser editado não encontrado. Adicionando como novo.");
          cards.push(cardData);
        }
        Alert.alert('Sucesso', 'Cartão atualizado com sucesso!');
      } else {
        cards.push(cardData);
        Alert.alert('Sucesso', 'Cartão adicionado com sucesso!');
      }

      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.CARDS, JSON.stringify(cards));
      console.log(`Cartão ${isEditing ? 'atualizado' : 'adicionado'} no AsyncStorage:`, cardData);
      
      // Limpa o formulário e navega de volta
      resetForm();
      navigation.goBack();

    } catch (error) {
      console.error("AdicionarCartaoScreen: Erro ao salvar cartão no AsyncStorage:", error);
      Alert.alert('Erro', `Ocorreu um erro ao salvar o cartão: ${error.message}.`);
    } finally {
      setSavingCard(false); // Desativa o indicador de carregamento
    }
  };

  /**
   * Reseta o formulário para o estado inicial
   */
  const resetForm = () => {
    setCardAlias('');
    setDueDayOfMonth('1');
    setIsEditing(false);
    setCurrentCardId(null);
    setCurrentCardStatus('active');
  };

  return (
    // Aplica o padding superior para respeitar a barra de notificação do dispositivo
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ScrollView para garantir que o formulário seja rolável */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Título da tela, dinâmico para edição ou adição */}
        <Text style={commonStyles.title}>{isEditing ? "Editar Cartão" : "Adicionar Novo Cartão"}</Text>

        {/* Rótulo e campo de input para o nome da receita */}
        <View style={commonStyles.inputContainer}>
          <Text style={commonStyles.pickerLabel}>Apelido do Cartão:</Text>
          <TextInput
            style={commonStyles.input}
            placeholder="Ex: Cartão Nubank, Cartão Mastercard"
            placeholderTextColor="#bbb" // Cor mais clara para o placeholder
            value={cardAlias}
            onChangeText={setCardAlias}
          />
        </View>

        {/* Seletor para o dia de vencimento da fatura */}
        <View style={commonStyles.inputContainer}>
          <Text style={commonStyles.label}>Dia do Vencimento da Fatura:</Text>
          <View style={[commonStyles.input, styles.pickerWrapper]}>
            <Picker
              selectedValue={dueDayOfMonth}
              onValueChange={(itemValue) => setDueDayOfMonth(itemValue)}
              style={styles.picker}
            >
              {/* Gera opções de 1 a 31 para o dia do vencimento */}
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <Picker.Item 
                  key={String(day)} 
                  label={String(day)} 
                  value={String(day)}
                  style={styles.pickerItem}
                />
              ))}
            </Picker>
          </View>
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
  // Estilos de Layout
  container: {
    ...commonStyles.container,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    ...commonStyles.scrollContent,
    paddingHorizontal: 20,
  },

  // Estilos do Picker
  pickerWrapper: {
    paddingHorizontal: 0, // Remove o padding horizontal do input
    height: 50, // Altura fixa para combinar com o TextInput
    justifyContent: 'center',
  },
  picker: {
    margin: 0,
    height: 50,
    width: '100%',
  },
  pickerItem: {
    fontSize: 16,
    height: 50,
  },
});

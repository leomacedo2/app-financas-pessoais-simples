// screens/AdicionarCartaoScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Para o seletor de dia
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AdicionarCartaoScreen({ navigation, route }) {
  const [cardAlias, setCardAlias] = useState('');
  const [dueDayOfMonth, setDueDayOfMonth] = useState('1'); // Dia do vencimento, como string para o Picker
  const [savingCard, setSavingCard] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [currentCardId, setCurrentCardId] = useState(null);
  const [currentCardStatus, setCurrentCardStatus] = useState('active'); // Status padrão

  // useEffect para preencher o formulário se for uma edição
  useEffect(() => {
    if (route.params?.cardToEdit) {
      const card = route.params.cardToEdit;
      setIsEditing(true);
      setCurrentCardId(card.id);
      setCardAlias(card.alias);
      setDueDayOfMonth(String(card.dueDayOfMonth)); // Converte para string para o Picker
      setCurrentCardStatus(card.status || 'active');
    } else {
      setIsEditing(false);
      setCurrentCardId(null);
      setCardAlias('');
      setDueDayOfMonth('1'); // Reinicia para o dia 1 para nova adição
      setCurrentCardStatus('active');
    }
  }, [route.params?.cardToEdit]);

  const handleSaveCard = async () => {
    if (!cardAlias.trim()) {
      Alert.alert('Erro', 'Por favor, insira um apelido para o cartão.');
      return;
    }

    setSavingCard(true);

    try {
      const existingCardsJson = await AsyncStorage.getItem('cards');
      let cards = existingCardsJson ? JSON.parse(existingCardsJson) : [];

      let cardData = {
        alias: cardAlias.trim(),
        dueDayOfMonth: parseInt(dueDayOfMonth, 10), // Garante que é um número
        status: currentCardStatus,
      };

      if (isEditing && currentCardId) {
        // Modo de Edição: Encontra e atualiza o cartão existente
        cardData.id = currentCardId;
        // Preserva a data de criação original se estiver editando
        cardData.createdAt = route.params.cardToEdit.createdAt; 
        // Preserva a data de exclusão se estiver editando e já excluído suavemente
        cardData.deletedAt = route.params.cardToEdit.deletedAt || null;

        const index = cards.findIndex(c => c.id === currentCardId);
        if (index !== -1) {
          cards[index] = cardData;
        } else {
          // Caso a edição de um cartão não encontrado, adiciona como novo (improvável)
          console.warn("Cartão a ser editado não encontrado. Adicionando como novo.");
          cards.push({ ...cardData, id: Date.now().toString(), createdAt: new Date().toISOString() });
        }
        await AsyncStorage.setItem('cards', JSON.stringify(cards));
        Alert.alert('Sucesso', 'Cartão atualizado com sucesso!');
        console.log("Cartão atualizado com sucesso no AsyncStorage.");

      } else {
        // Modo de Adição: Adiciona um novo cartão
        cardData.id = Date.now().toString(); // ID único para o novo cartão
        cardData.createdAt = new Date().toISOString(); // Data de criação
        cardData.status = 'active'; // Novo cartão é sempre ativo

        cards.push(cardData);
        await AsyncStorage.setItem('cards', JSON.stringify(cards));
        Alert.alert('Sucesso', 'Cartão adicionado com sucesso!');
        console.log("Cartão adicionado com sucesso no AsyncStorage.");
      }

      // Limpa o formulário após o sucesso
      setCardAlias('');
      setDueDayOfMonth('1');
      setIsEditing(false);
      setCurrentCardId(null);
      setCurrentCardStatus('active');

      // Navega de volta para a lista de cartões
      setTimeout(() => {
        navigation.goBack();
      }, 100);

    } catch (error) {
      console.error("AdicionarCartaoScreen: Erro ao salvar cartão no AsyncStorage:", error);
      Alert.alert('Erro', `Ocorreu um erro ao salvar o cartão: ${error.message}. Tente novamente.`);
    } finally {
      setSavingCard(false);
    }
  };

  // Gera os itens do Picker para os dias do mês (1 a 31)
  const renderDayPickerItems = () => {
    const days = [];
    for (let i = 1; i <= 31; i++) {
      days.push(<Picker.Item key={i} label={String(i).padStart(2, '0')} value={String(i)} />);
    }
    return days;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isEditing ? "Editar Cartão" : "Adicionar Novo Cartão"}</Text>

      <TextInput
        style={styles.input}
        placeholder="Apelido do Cartão (Ex: Meu Cartão MasterCard, Cartão Nubank)"
        value={cardAlias}
        onChangeText={setCardAlias}
      />

      <View style={styles.pickerContainer}>
        <Text style={styles.pickerLabel}>Dia de Vencimento da Fatura:</Text>
        <Picker
          selectedValue={dueDayOfMonth}
          onValueChange={(itemValue) => setDueDayOfMonth(itemValue)}
          style={styles.picker}
        >
          {renderDayPickerItems()}
        </Picker>
      </View>

      <TouchableOpacity
        style={styles.saveButton}
        onPress={handleSaveCard}
        disabled={savingCard}
      >
        {savingCard ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{isEditing ? "Salvar Alterações" : "Adicionar Cartão"}</Text>
        )}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  pickerContainer: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  pickerLabel: {
    fontSize: 16,
    color: '#555',
    paddingLeft: 15,
    paddingTop: 8,
    marginBottom: 5,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  saveButton: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

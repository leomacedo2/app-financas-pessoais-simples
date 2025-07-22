// screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function HomeScreen() {
  // Definindo o estado para a receita total e os itens de débito
  const [receitaTotal, setReceitaTotal] = useState(4000); // Exemplo de receita total
  const [debitItems, setDebitItems] = useState([
    { id: 'd1', description: 'Despesa1', dueDate: '22/07/2025', value: 100 },
    { id: 'd2', description: 'Despesa2', dueDate: '22/07/2025', value: 200 },
    { id: 'd3', description: 'Despesa3', dueDate: '22/07/2025', value: 400 },
    { id: 'd4', description: 'Despesa4', dueDate: '22/07/2025', value: 2700 },
    // Ainda são exemplos, ainda vou programar a adição de debitos
  ]);

  // Calcula a soma total das despesas
  const totalDespesas = debitItems.reduce((sum, item) => sum + item.value, 0);

  // Calcula o valor final
  const valorFinal = receitaTotal - totalDespesas;

  // useEffect para simular o carregamento de dados ou atualizações futuras
  useEffect(() => {
    // Parte para buscar dados de uma API ou de um armazenamento local.
    // Por enquanto, estou usando valores fixos.
  }, []);

  return (
    <View style={styles.container}>
      {/* Área de conteúdo principal rolável */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Seção de Débitos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Débitos Pendentes</Text>

          {/* Cabeçalho da Tabela */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.descriptionColumn]}>Despesa</Text>
            <Text style={[styles.headerText, styles.dateColumn]}>Data de Vencimento</Text>
            <Text style={[styles.headerText, styles.valueColumn]}>Valor</Text>
          </View>

          {/* Itens da Tabela */}
          {debitItems.map((item) => (
            <View key={item.id} style={styles.debitItemRow}>
              <Text style={[styles.debitText, styles.descriptionColumn]}>{item.description}</Text>
              <Text style={[styles.debitText, styles.dateColumn]}>{item.dueDate}</Text>
              <Text style={[styles.debitValue, styles.valueColumn]}>{item.value.toFixed(2).replace('.', ',')} R$</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Seção de Resumo (Receita Total e Valor Final) - Fixa na parte inferior */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Receita total:</Text>
          <Text style={styles.summaryValue}>{receitaTotal.toFixed(2).replace('.', ',')} R$</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Valor final:</Text>
          {/* Aplica cor vermelha se o valor final for negativo, azul se for positivo */}
          <Text style={[styles.summaryValue, valorFinal < 0 ? styles.negativeValue : styles.positiveValue]}>
            {valorFinal.toFixed(2).replace('.', ',')} R$
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Fundo claro para a tela
  },
  scrollContent: {
    flexGrow: 1, // Permite que o conteúdo se expanda e role
    padding: 15,
  },
  section: {
    backgroundColor: '#ffffff', // Fundo branco para as seções
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000', // Sombra para dar profundidade
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    minHeight: 250, // Altura mínima para a seção de débitos
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  // Estilos para o cabeçalho da tabela
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#ccc',
    marginBottom: 5,
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#666',
    textAlign: 'center', // Centraliza o texto do cabeçalho
  },
  // Estilos para as linhas de débito
  debitItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  debitText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center', // Centraliza o texto do item
  },
  debitValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center', // Centraliza o texto do valor
  },
  // Estilos para controlar a largura das colunas
  descriptionColumn: {
    flex: 2, // Ocupa mais espaço
  },
  dateColumn: {
    flex: 2, // Ocupa mais espaço
  },
  valueColumn: {
    flex: 1, // Ocupa menos espaço
  },
  summaryContainer: {
    backgroundColor: '#ffffff', // Fundo branco para a seção de resumo
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 }, // Sombra para cima
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  negativeValue: {
    color: 'red', // Cor para valor final negativo
  },
  positiveValue: {
    color: '#007bff', // Cor para valor final positivo (azul)
  },
});

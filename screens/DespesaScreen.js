// screens/DespesaScreen.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DespesaScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Tela de Despesa (em construção)</Text>
      <Text style={styles.info}>Aqui você poderá registrar suas despesas.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffebee', // Um fundo suave para despesas
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#c62828', // Vermelho para despesas
  },
  info: {
    fontSize: 16,
    color: '#424242',
  },
});

// screens/CartaoScreen.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CartaoScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Tela de Cartão (em construção)</Text>
      <Text style={styles.info}>Gerencie seus cartões de crédito e débito aqui.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e3f2fd', // Um fundo suave para cartões
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1976d2', // Azul para cartões
  },
  info: {
    fontSize: 16,
    color: '#424242',
  },
});

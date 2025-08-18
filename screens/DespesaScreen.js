// screens/DespesaScreen.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Importa os estilos comuns para reutilização
import commonStyles from '../utils/commonStyles';

export default function DespesaScreen() {
  const insets = useSafeAreaInsets(); // Obter os insets da área segura

  return (
    // Aplica o padding superior para respeitar a barra de notificação do dispositivo
    // Combina o container base dos estilos comuns com alinhamento específico para esta tela
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.text}>Tela de Despesa (em construção)</Text>
      <Text style={styles.info}>Aqui você poderá registrar suas despesas.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.container, // Herda o estilo base do container
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

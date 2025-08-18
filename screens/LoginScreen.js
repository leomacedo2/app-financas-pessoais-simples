// screens/LoginScreen.js

/**
 * @file Tela de Login simples do aplicativo.
 * Por enquanto, esta tela serve como um ponto de entrada básico,
 * navegando diretamente para a tela principal (Home) com um botão.
 * A funcionalidade de login real (com email/senha, Firebase, etc.)
 * está intencionalmente omitida nesta versão para manter a simplicidade e
 * focar no armazenamento local e outras funcionalidades principais.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Importar useSafeAreaInsets para lidar com a barra de status

export default function LoginScreen({ navigation }) {
  // Obtém os insets da área segura do dispositivo (ex: altura da barra de status no iOS, notch)
  const insets = useSafeAreaInsets(); 

  /**
   * Função que lida com a ação de "Entrar".
   * Nesta versão simplificada, ela apenas navega para a tela "Home".
   * Futuramente, aqui poderia ser implementada uma lógica de autenticação
   * como biometria, PIN do celular, ou um sistema de login mais robusto.
   */
  const handleLogin = () => {
    // Navega para a rota 'Home', que contém o navegador de abas principal
    navigation.navigate('Home');
  };

  return (
    // O container principal da tela, com padding superior ajustado
    // para evitar que o conteúdo fique atrás da barra de status do sistema.
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Título do aplicativo */}
      <Text style={styles.titulo}>💰 Finanças Simples</Text>
      
      {/* Botão para "Entrar" no aplicativo */}
      {/* Foi usado TouchableOpacity no lugar de Button para maior flexibilidade de estilo */}
      <TouchableOpacity
        style={styles.loginButton} // Estilo do botão
        onPress={handleLogin}     // Função a ser chamada ao pressionar
      >
        <Text style={styles.buttonText}>Entrar</Text> {/* Texto do botão */}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, // Ocupa todo o espaço disponível na tela
    backgroundColor: '#f5f5f5', // Cor de fundo suave
    alignItems: 'center', // Centraliza os itens horizontalmente
    justifyContent: 'center', // Centraliza os itens verticalmente
  },
  titulo: {
    fontSize: 26, // Tamanho da fonte do título
    marginBottom: 20, // Espaçamento abaixo do título
    fontWeight: 'bold', // Texto em negrito
  },
  loginButton: {
    backgroundColor: '#007bff', // Cor de fundo azul para o botão
    paddingVertical: 15, // Espaçamento vertical interno
    paddingHorizontal: 30, // Espaçamento horizontal interno
    borderRadius: 8, // Bordas arredondadas
    alignItems: 'center', // Centraliza o conteúdo (texto) do botão
    justifyContent: 'center', // Centraliza o conteúdo (texto) do botão
    marginTop: 20, // Espaçamento acima do botão
    shadowColor: '#000', // Cor da sombra
    shadowOffset: { width: 0, height: 4 }, // Deslocamento da sombra
    shadowOpacity: 0.3, // Opacidade da sombra
    shadowRadius: 5, // Raio da sombra
    elevation: 5, // Elevação para Android (simula sombra)
  },
  buttonText: {
    color: '#fff', // Cor do texto do botão (branco)
    fontSize: 18, // Tamanho da fonte do texto do botão
    fontWeight: 'bold', // Texto em negrito
  },
});

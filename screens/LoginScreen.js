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
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../AppContext'; // Importa o hook do contexto

// Importa os estilos comuns entre as telas
import commonStyles from '../utils/commonStyles';

export default function LoginScreen({ navigation }) {
  // Obtém os insets da área segura do dispositivo
  const insets = useSafeAreaInsets(); 

  // Handlers
  /**
   * Navega para a tela Home
   * Futuramente pode incluir autenticação com Firebase, biometria, etc.
   */
  const handleLogin = () => {
    navigation.navigate('Home');
  };

  /**
   * Função para alternar o modo de desenvolvimento
   * Controla a exibição dos botões de teste na HomeScreen
   */
  const { toggleMostrarBotoesTeste, mostrarBotoesTeste } = useAppContext();
  
  const handleDevMode = () => {
    toggleMostrarBotoesTeste();
    console.log('Modo desenvolvedor:', !mostrarBotoesTeste ? 'ATIVADO' : 'DESATIVADO');
  };

  return (
    // O container principal da tela, com padding superior ajustado
    // para evitar que o conteúdo fique atrás da barra de status do sistema.
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Seção de Cabeçalho */}
      <View style={styles.headerSection}>
        <Text style={styles.titleText}>💰 Finanças Simples</Text>
      </View>
      
      {/* Seção de Botões */}
      <View style={styles.buttonSection}>
        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={handleLogin}>
          <Text style={styles.buttonText}>Entrar</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.devButton} 
          onPress={handleDevMode}>
          <Text style={styles.buttonText}>Dev</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Estilos de Layout
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 50,
  },
  buttonSection: {
    alignItems: 'center',
    width: '100%',
  },

  // Estilos de Texto
  titleText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#007bff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },

  // Estilos de Botões
  loginButton: {
    backgroundColor: '#28a745',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 20,
  },
  devButton: {
    backgroundColor: '#888',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});

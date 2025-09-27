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
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'; // Importa componentes básicos do React Native
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Importar useSafeAreaInsets para lidar com a barra de status

// Importa os estilos comuns entre as telas
import commonStyles from '../utils/commonStyles';

export default function LoginScreen({ navigation }) {
  // Obtém os insets da área segura do dispositivo (ex: altura da barra de status no iOS, notch)
  const insets = useSafeAreaInsets(); 

  /**
   * Função que lida com a ação de "Entrar".
   * Nesta versão simplificada, ela apenas navega para a tela "Home".
   * Futuramente, aqui poderia ser implementada uma lógica de autenticação
   * como biometria, PIN do celular, ou um sistema de login mais robusto.
   */
  const fazerLogin = () => {
    // Navega para a rota 'Home', que contém o navegador de abas principal
    navigation.navigate('Home');
  };

  return (
    // O container principal da tela, com padding superior ajustado
    // para evitar que o conteúdo fique atrás da barra de status do sistema.
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Título do aplicativo */}
      <Text style={commonStyles.titleText}>💰 Finanças Simples</Text>
      
      {/* Botão "Entrar" */}
      <TouchableOpacity style={commonStyles.loginButton} onPress={fazerLogin}>
        <Text style={commonStyles.loginButtonText}>Entrar</Text>
      </TouchableOpacity>

      {/* Botão Dev */}
      <TouchableOpacity 
        style={[styles.devButton, { marginTop: 100, backgroundColor: '#888' }]} 
        onPress={() => {
          console.log('Botão Dev pressionado');
          alert('Funcionalidade de desenvolvedor ainda não implementada.')
        }}>
        <Text style={commonStyles.loginButtonText}>Dev</Text>
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
  devButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#888',
  },

});

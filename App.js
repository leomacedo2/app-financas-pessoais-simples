// App.js

/**
 * @file Arquivo principal do aplicativo, responsável pela configuração da navegação (React Navigation).
 * Define as pilhas de navegação (Stack Navigators) e o navegador de abas (Bottom Tab Navigator).
 */

import React from 'react';
import { Text } from 'react-native'; // Importa Text do React Native
import { NavigationContainer } from '@react-navigation/native'; // Componente principal de navegação
import { createNativeStackNavigator } from '@react-navigation/native-stack'; // Para navegação em pilha (telas uma sobre a outra)
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'; // Para navegação por abas na parte inferior
import { Ionicons } from '@expo/vector-icons'; // Ícones para as abas
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'; // Para lidar com a área segura do dispositivo (notch, barra de status)

// Importa as telas do aplicativo
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ReceitaScreen from './screens/ReceitaScreen';
import AdicionarReceitaScreen from './screens/AdicionarReceitaScreen';
import DespesaScreen from './screens/DespesaScreen';
import CartaoScreen from './screens/CartaoScreen';
import AdicionarCartaoScreen from './screens/AdicionarCartaoScreen'; 

const Stack = createNativeStackNavigator(); // Cria uma instância do Stack Navigator
const Tab = createBottomTabNavigator(); // Cria uma instância do Bottom Tab Navigator

/**
 * Componente que define a pilha de navegação para a aba "Receita".
 * Permite navegar entre a lista de receitas e a tela de adicionar/editar receita.
 */
const ReceitaStack = createNativeStackNavigator(); // Definido fora da função para evitar recriação
function ReceitaNavigator() {
  return (
    <ReceitaStack.Navigator screenOptions={{ headerShown: false }}>
      {/* Tela principal da lista de receitas */}
      <ReceitaStack.Screen name="ListaReceitas" component={ReceitaScreen} />
      {/* Tela para adicionar ou editar uma receita */}
      <ReceitaStack.Screen name="AdicionarReceita" component={AdicionarReceitaScreen} />
    </ReceitaStack.Navigator>
  );
}

/**
 * Componente que define a pilha de navegação para a aba "Cartão".
 * Permite navegar entre a lista de cartões e a tela de adicionar/editar cartão.
 */
const CartaoStack = createNativeStackNavigator(); // Definido fora da função para evitar recriação
function CartaoNavigator() {
  return (
    <CartaoStack.Navigator screenOptions={{ headerShown: false }}>
      {/* Tela principal da lista de cartões */}
      <CartaoStack.Screen name="ListaCartoes" component={CartaoScreen} />
      {/* Tela para adicionar ou editar um cartão */}
      <CartaoStack.Screen name="AdicionarCartao" component={AdicionarCartaoScreen} />
    </CartaoStack.Navigator>
  );
}

/**
 * Componente que define as abas principais do aplicativo.
 * Contém as telas "Início", "Receita", "Despesa" e "Cartão".
 */
function HomeTabs() {
  // Obtém os insets da área segura para ajustar o padding da barra de abas
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, // Oculta o cabeçalho padrão das telas dentro das abas
        tabBarIcon: ({ focused, color, size }) => {
          let iconName; // Variável para armazenar o nome do ícone

          // Define o ícone com base na rota (aba) e no estado de foco
          if (route.name === 'Início') {
            iconName = focused ? 'home' : 'home-outline'; // Ícone preenchido quando focado, contorno quando não
          } else if (route.name === 'ReceitaTab') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Despesa') {
            iconName = focused ? 'remove-circle' : 'remove-circle-outline';
          } else if (route.name === 'CartaoTab') {
            iconName = focused ? 'card' : 'card-outline';
          }

          // Retorna o componente Ionicons com o ícone e estilos definidos
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007bff', // Cor do ícone e label quando a aba está ativa
        tabBarInactiveTintColor: 'gray', // Cor quando inativa
        tabBarStyle: {
          height: 60 + insets.bottom, // Ajusta a altura da barra de abas para dispositivos com "notch"
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10, // Padding inferior para dispositivos com "notch"
          paddingTop: 10, // Padding superior interno da barra de abas
          backgroundColor: '#ffffff', // Fundo branco da barra de abas
          borderTopWidth: 1, // Borda superior
          borderTopColor: '#e0e0e0', // Cor da borda
        },
        tabBarLabelStyle: {
          fontSize: 12, // Tamanho da fonte do label da aba
        },
      })}
    >
      {/* Definição das telas para cada aba */}
      <Tab.Screen
        name="Início"
        component={HomeScreen}
        options={{ tabBarLabel: () => <Text>Início</Text> }} // Label da aba
      />
      <Tab.Screen
        name="ReceitaTab" // Nome da rota para a pilha de receitas
        component={ReceitaNavigator} // Renderiza o ReceitaNavigator (pilha de telas)
        options={{ tabBarLabel: () => <Text>Receita</Text> }}
      />
      <Tab.Screen
        name="Despesa"
        component={DespesaScreen}
        options={{ tabBarLabel: () => <Text>Despesa</Text> }}
      />
      <Tab.Screen
        name="CartaoTab" // Nome da rota para a pilha de cartões
        component={CartaoNavigator} // Renderiza o CartaoNavigator (pilha de telas)
        options={{ tabBarLabel: () => <Text>Cartão</Text> }}
      />
    </Tab.Navigator>
  );
}

/**
 * Componente principal do aplicativo.
 * Envolve toda a navegação com NavigationContainer e SafeAreaProvider.
 */
export default function App() {
  return (
    // SafeAreaProvider garante que useSafeAreaInsets funcione em todo o app
    <SafeAreaProvider>
      {/* NavigationContainer gerencia o estado da navegação */}
      <NavigationContainer>
        {/* Stack Navigator principal para alternar entre Login e as abas do Home */}
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeTabs} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

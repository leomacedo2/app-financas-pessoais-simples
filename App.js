// App.js
import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ReceitaScreen from './screens/ReceitaScreen';
import DespesaScreen from './screens/DespesaScreen';
import CartaoScreen from './screens/CartaoScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Componente que define as abas do rodapé
function HomeTabs() {
  const insets = useSafeAreaInsets(); // Use o hook para obter as margens seguras

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, // Esconde o cabeçalho das telas dentro das abas
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Início') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Receita') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Despesa') {
            iconName = focused ? 'remove-circle' : 'remove-circle-outline';
          } else if (route.name === 'Cartão') {
            iconName = focused ? 'card' : 'card-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007bff',
        tabBarInactiveTintColor: '#8e8e93',
        tabBarStyle: {
          height: 60 + insets.bottom, // Ajusta a altura com base na margem inferior segura
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10, // Adiciona padding inferior se houver insets, senão um padrão
          paddingTop: 10,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
      })}
    >
      {/* Definindo tabBarLabel explicitamente para cada aba */}
      <Tab.Screen
        name="Início"
        component={HomeScreen}
        options={{ tabBarLabel: 'Início' }} // Rótulo explícito
      />
      <Tab.Screen
        name="Receita"
        component={ReceitaScreen}
        options={{ tabBarLabel: 'Receita' }} // Rótulo explícito
      />
      <Tab.Screen
        name="Despesa"
        component={DespesaScreen}
        options={{ tabBarLabel: 'Despesa' }} // Rótulo explícito
      />
      <Tab.Screen
        name="Cartão"
        component={CartaoScreen}
        options={{ tabBarLabel: 'Cartão' }} // Rótulo explícito
      />
      {/* <Tab.Screen
        name="Início"
        component={HomeScreen}
        options={{
          tabBarLabel: () => <Text>Início</Text>, // Agora é JSX e está seguro
        }}
      />
      <Tab.Screen
        name="Receita"
        component={ReceitaScreen}
        options={{ tabBarLabel: () => <Text>Receita</Text> }}
      />
      <Tab.Screen
        name="Despesa"
        component={DespesaScreen}
        options={{ tabBarLabel: () => <Text>Despesa</Text> }}
      />
      <Tab.Screen
        name="Cartão"
        component={CartaoScreen}
        options={{ tabBarLabel: () => <Text>Cartão</Text> }}
      /> */}
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider> {/* Envolva todo o seu app com SafeAreaProvider */}
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeTabs} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
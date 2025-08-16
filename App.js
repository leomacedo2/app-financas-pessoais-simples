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
import AdicionarReceitaScreen from './screens/AdicionarReceitaScreen';
import DespesaScreen from './screens/DespesaScreen';
import CartaoScreen from './screens/CartaoScreen';
// Importa a nova tela de adição/edição de cartão
import AdicionarCartaoScreen from './screens/AdicionarCartaoScreen'; 

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Stack para a tab "Receita"
const ReceitaStack = createNativeStackNavigator();

function ReceitaNavigator() {
  return (
    <ReceitaStack.Navigator screenOptions={{ headerShown: false }}>
      <ReceitaStack.Screen name="ListaReceitas" component={ReceitaScreen} />
      <ReceitaStack.Screen name="AdicionarReceita" component={AdicionarReceitaScreen} />
    </ReceitaStack.Navigator>
  );
}

// NOVO: Stack para a tab "Cartão"
const CartaoStack = createNativeStackNavigator();

function CartaoNavigator() {
  return (
    <CartaoStack.Navigator screenOptions={{ headerShown: false }}>
      <CartaoStack.Screen name="ListaCartoes" component={CartaoScreen} />
      <CartaoStack.Screen name="AdicionarCartao" component={AdicionarCartaoScreen} />
    </CartaoStack.Navigator>
  );
}

function HomeTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Início') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'ReceitaTab') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Despesa') {
            iconName = focused ? 'remove-circle' : 'remove-circle-outline';
          } else if (route.name === 'CartaoTab') { // Mudado para CartaoTab
            iconName = focused ? 'card' : 'card-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007bff',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
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
      <Tab.Screen
        name="Início"
        component={HomeScreen}
        options={{ tabBarLabel: () => <Text>Início</Text> }}
      />
      <Tab.Screen
        name="ReceitaTab"
        component={ReceitaNavigator}
        options={{ tabBarLabel: () => <Text>Receita</Text> }}
      />
      <Tab.Screen
        name="Despesa"
        component={DespesaScreen}
        options={{ tabBarLabel: () => <Text>Despesa</Text> }}
      />
      <Tab.Screen
        name="CartaoTab" // Usando o novo CartaoNavigator
        component={CartaoNavigator}
        options={{ tabBarLabel: () => <Text>Cartão</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeTabs} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

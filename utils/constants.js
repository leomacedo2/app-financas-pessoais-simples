// utils/constants.js

/**
 * @file Arquivo para armazenar constantes globais do aplicativo.
 * Isso ajuda a evitar "magic strings" (strings literais espalhadas pelo código)
 * e facilita a refatoração e manutenção.
 */

/**
 * Chaves utilizadas para armazenar dados no AsyncStorage.
 * Usar constantes evita erros de digitação e centraliza as definições.
 */
export const ASYNC_STORAGE_KEYS = {
  INCOMES: 'incomes', // Chave para armazenar a lista de receitas
  EXPENSES: 'expenses', // Chave para armazenar a lista de despesas (será usada futuramente)
  CARDS: 'cards', // Chave para armazenar a lista de cartões
};

// Você pode adicionar outras constantes aqui no futuro, se necessário.
// Ex: export const API_ENDPOINTS = { ... };
// Ex: export const APP_SETTINGS = { ... };

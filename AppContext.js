// AppContext.js
import React, { createContext, useContext, useState } from 'react';

// Cria o contexto
const AppContext = createContext();

// Hook para consumir o contexto facilmente
export const useAppContext = () => {
  return useContext(AppContext);
};

// Provider do contexto
export const AppProvider = ({ children }) => {
  // Estado para controlar a exibição dos botões de teste
  const [mostrarBotoesTeste, setMostrarBotoesTeste] = useState(false);

  // Função para alternar o estado
  const toggleMostrarBotoesTeste = () => {
    setMostrarBotoesTeste(prevState => !prevState);
  };

  return (
    <AppContext.Provider value={{ 
      mostrarBotoesTeste, 
      setMostrarBotoesTeste,
      toggleMostrarBotoesTeste 
    }}>
      {children}
    </AppContext.Provider>
  );
};

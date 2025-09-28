/* desativado por enquanto




// AppContext.js
import React, { createContext, useContext, useState } from 'react';

// Cria o contexto
const AppContext = createContext();

// Hook para consumir o contexto facilmente
export const useAppContext = () => {
  return useContext(AppContext);
};

export const AppProvider = ({ children }) => {
  const [mostrarBotoesTeste, setMostrarBotoesTeste] = useState(false);

  return (
    <AppContext.Provider value={{ mostrarBotoesTeste, setMostrarBotoesTeste }}>
      {children}
    </AppContext.Provider>
  );
};


*/

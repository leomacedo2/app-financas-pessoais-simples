// screens/HomeScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, ActivityIndicator } from 'react-native';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot } from 'firebase/firestore';

// Obter a largura da tela para rolagem paginada
const { width } = Dimensions.get('window');

// Funções auxiliares para manipulação de datas (mantidas fora para reusabilidade, mas sem depender de estados)
// Converte uma string de data "DD/MM/YYYY" para um objeto Date
const parseDateString = (dateString) => {
  const [day, month, year] = dateString.split('/').map(Number);
  return new Date(year, month - 1, day); // Mês é 0-indexado em JavaScript (ex: Julho é 6)
};

// Formata um objeto Date para a string "DD/MM/YYYY" para exibição
const formatDateForDisplay = (date) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Retorna o nome do mês a partir de um objeto Date
const getMonthName = (date) => {
  const d = new Date(date);
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return monthNames[d.getMonth()];
};

// Função para gerar despesas aleatórias para um mês e ano específicos
const generateRandomExpenses = (year, month, count) => {
  const expenses = [];
  const expenseDescriptions = [
    'Aluguel', 'Conta de Luz', 'Internet', 'Supermercado', 'Academia',
    'Telefone', 'Transporte', 'Lazer', 'Educação', 'Saúde', 'Restaurante', 'Roupas'
  ];
  for (let i = 0; i < count; i++) {
    const day = Math.floor(Math.random() * 28) + 1; // Dia aleatório entre 1 e 28
    const value = Math.floor(Math.random() * 500) + 20; // Valor aleatório entre 20 e 520
    const description = expenseDescriptions[Math.floor(Math.random() * expenseDescriptions.length)];
    const dueDate = `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${year}`;
    expenses.push({
      id: `${year}-${month}-${i}-${Math.random()}`, // ID único
      description,
      dueDate,
      value,
    });
  }
  return expenses;
};


export default function HomeScreen() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loadingFirebase, setLoadingFirebase] = useState(true);
  const [allIncomes, setAllIncomes] = useState([]); // Novo estado para todas as receitas

  // --- Funções movidas para dentro do componente HomeScreen ---

  // Gerar uma lista de objetos de data para os meses a serem exibidos.
  // Inclui 6 meses anteriores, o mês atual e 12 meses posteriores.
  const generateMonthsToDisplay = () => {
    const today = new Date();
    const months = [];
    const numPastMonths = 6;
    const numFutureMonths = 12;

    // Adicionar meses anteriores
    for (let i = numPastMonths; i > 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(date);
    }

    // Adicionar o mês atual
    months.push(new Date(today.getFullYear(), today.getMonth(), 1));

    // Adicionar meses posteriores
    for (let i = 1; i <= numFutureMonths; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      months.push(date);
    }
    return months;
  };

  const monthsToDisplay = generateMonthsToDisplay();

  // Calcular o initialScrollIndex para que o mês atual seja a "página inicial"
  const today = new Date();
  const initialMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const initialScrollIndex = monthsToDisplay.findIndex(monthDate =>
    monthDate.getMonth() === initialMonthDate.getMonth() &&
    monthDate.getFullYear() === initialMonthDate.getFullYear()
  );


  // Função para filtrar as despesas que pertencem a um mês específico
  const getExpensesForMonth = (monthDate) => {
    const targetMonth = monthDate.getMonth();
    const targetYear = monthDate.getFullYear();
    // As despesas já estão ordenadas por dueDate em allDebitItems
    return allDebitItems.filter(item => {
      const itemDate = parseDateString(item.dueDate);
      return itemDate.getMonth() === targetMonth && itemDate.getFullYear() === targetYear;
    });
  };

  // --- Fim das funções movidas ---


  // Estado para todas as despesas, incluindo datas de vencimento para diferentes meses
  const [allDebitItems, setAllDebitItems] = useState(() => {
    let initialItems = [];
    // Gerar despesas aleatórias para todos os meses no range
    // O monthsToDisplay já está disponível aqui no escopo da função de inicialização
    monthsToDisplay.forEach(monthDate => {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const numExpenses = Math.floor(Math.random() * 5) + 3;
      initialItems = initialItems.concat(generateRandomExpenses(year, month, numExpenses));
    });

    // Ordenar os itens por data de vencimento
    return initialItems.sort((a, b) => {
      const dateA = parseDateString(a.dueDate);
      const dateB = parseDateString(b.dueDate);
      return dateA.getTime() - dateB.getTime();
    });
  });

  // Estado para o índice do mês atualmente exibido na rolagem horizontal
  const [currentMonthIndex, setCurrentMonthIndex] = useState(initialScrollIndex);
  const flatListRef = useRef(null);

  // Initialize Firebase and fetch data
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const dbInstance = getFirestore(app);

        setAuth(authInstance);
        setDb(dbInstance);

        const unsubscribeAuth = onAuthStateChanged(authInstance, async (user) => {
          if (user) {
            setUserId(user.uid);
            setLoadingFirebase(false);
          } else {
            const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
            if (initialAuthToken) {
              await signInWithCustomToken(authInstance, initialAuthToken);
            } else {
              await signInAnonymously(authInstance);
            }
            // Ensure userId is set after auth state is determined
            setUserId(authInstance.currentUser?.uid || crypto.randomUUID());
            setLoadingFirebase(false);
          }
        });

        return () => unsubscribeAuth(); // Cleanup auth listener
      } catch (error) {
        console.error("Error initializing Firebase:", error);
        setLoadingFirebase(false);
      }
    };

    initializeFirebase();
  }, []); // Run once on component mount

  // Fetch incomes from Firestore when db and userId are ready
  useEffect(() => {
    if (db && userId) {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const incomesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/incomes`);
      const q = query(incomesCollectionRef);

      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const incomesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllIncomes(incomesData);
      }, (error) => {
        console.error("Erro ao buscar receitas:", error);
      });

      return () => unsubscribeSnapshot(); // Cleanup snapshot listener
    }
  }, [db, userId]); // Re-run when db or userId changes

  // useEffect para rolar para o mês atual na montagem
  useEffect(() => {
    if (flatListRef.current && initialScrollIndex !== -1 && !loadingFirebase) { // Adiciona loadingFirebase como condição
      setTimeout(() => {
        flatListRef.current.scrollToIndex({ index: initialScrollIndex, animated: false });
      }, 100);
    }
  }, [initialScrollIndex, loadingFirebase]); // Depende de initialScrollIndex e loadingFirebase

  // Calcula a receita total para o mês atualmente exibido
  const calculateTotalIncomeForMonth = (monthDate) => {
    const targetMonth = monthDate.getMonth();
    const targetYear = monthDate.getFullYear();
    let totalIncome = 0;

    allIncomes.forEach(income => {
      if (income.type === 'Fixo') {
        // Receitas fixas contam para todos os meses (ou de acordo com a regra de "a partir de")
        // Para simplificar, consideramos que uma receita fixa vale para todos os meses mostrados
        totalIncome += income.value;
      } else if (income.type === 'Ganho' && income.month === targetMonth && income.year === targetYear) {
        // Ganhos contam apenas para o mês específico
        totalIncome += income.value;
      }
    });
    return totalIncome;
  };

  const currentMonthTotalIncome = calculateTotalIncomeForMonth(monthsToDisplay[currentMonthIndex]);

  // Calcula o total de despesas para o mês *atualmente visível*
  const currentDisplayedMonthExpenses = getExpensesForMonth(monthsToDisplay[currentMonthIndex]);
  const totalDespesasDisplayedMonth = currentDisplayedMonthExpenses.reduce((sum, item) => sum + item.value, 0);

  // Calcula o valor final para o mês *atualmente visível*
  const valorFinalDisplayedMonth = currentMonthTotalIncome - totalDespesasDisplayedMonth;

  // Componente que renderiza a seção de despesas para um único mês
  const renderMonthSection = ({ item: monthDate, index }) => { // Obter o índice do item
    const expenses = getExpensesForMonth(monthDate);
    const monthName = getMonthName(monthDate);
    const year = monthDate.getFullYear();

    // Determina se este é o mês atual do sistema (initialMonthDate)
    const isSystemCurrentMonth = monthDate.getMonth() === initialMonthDate.getMonth() &&
                                 monthDate.getFullYear() === initialMonthDate.getFullYear();

    return (
      <View style={styles.monthPage}>
        <View style={[
          styles.section,
          isSystemCurrentMonth && styles.currentMonthHighlight // Aplica estilo de destaque SE for o mês atual do sistema
        ]}>
          {/* Título da seção: nome do mês e ano */}
          <Text style={styles.sectionTitle}>{`${monthName} ${year}`}</Text>

          {/* Cabeçalho da Tabela */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.descriptionColumn]}>Despesa</Text>
            <Text style={[styles.headerText, styles.dateColumn]}>Data de Vencimento</Text>
            <Text style={[styles.headerText, styles.valueColumn]}>Valor</Text>
          </View>

          {/* Itens da Tabela */}
          {expenses.length > 0 ? (
            expenses.map((item) => (
              <View key={item.id} style={styles.debitItemRow}>
                <Text style={[styles.debitText, styles.descriptionColumn]}>{item.description}</Text>
                <Text style={[styles.debitText, styles.dateColumn]}>{item.dueDate}</Text>
                <Text style={[styles.debitValue, styles.valueColumn]}>
                  {`${item.value.toFixed(2).replace('.', ',')} R$`}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noExpensesText}>Nenhuma despesa para este mês.</Text>
          )}
        </View>
      </View>
    );
  };

  // Lida com o evento de rolagem para atualizar o índice do mês visível
  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    // Calcula o novo índice do mês com base na posição da rolagem
    const newIndex = Math.round(contentOffsetX / width);
    if (newIndex !== currentMonthIndex) {
      setCurrentMonthIndex(newIndex);
    }
  };

  if (loadingFirebase) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Carregando dados de finanças...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* FlatList para rolagem horizontal das tabelas de meses */}
      <FlatList
        ref={flatListRef}
        data={monthsToDisplay} // Dados: array de objetos Date para cada mês
        renderItem={renderMonthSection} // Renderiza a seção de cada mês
        keyExtractor={(item, index) => index.toString()} // Chave única para cada item
        horizontal // Habilita a rolagem horizontal
        pagingEnabled // Faz com que a rolagem "encaixe" em cada página (mês)
        showsHorizontalScrollIndicator={false} // Esconde a barra de rolagem horizontal
        onMomentumScrollEnd={handleScroll} // Chama a função quando a rolagem para
        initialScrollIndex={initialScrollIndex} // Inicia a rolagem no mês atual
        extraData={currentMonthIndex} // Garante que a FlatList re-renderize quando currentMonthIndex muda
        // Otimização de desempenho: informa à FlatList o tamanho de cada item
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* Seção de Resumo (Receita Total e Valor Final) - Fixa na parte inferior da TELA */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Receita total:</Text>
          <Text style={styles.summaryValue}>
            {`${currentMonthTotalIncome.toFixed(2).replace('.', ',')} R$`}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Valor final:</Text>
          {/* Aplica cor vermelha se o valor final for negativo, azul se for positivo */}
          <Text style={[styles.summaryValue, valorFinalDisplayedMonth < 0 ? styles.negativeValue : styles.positiveValue]}>
            {valorFinalDisplayedMonth.toFixed(2).replace('.', ',') + ' R$'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Fundo claro para a tela
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  monthPage: {
    width: width, // Cada página (mês) terá a largura total da tela
    paddingHorizontal: 15, // Espaçamento horizontal para o conteúdo da página
    paddingTop: 15, // Espaçamento superior para o conteúdo da página
  },
  section: {
    backgroundColor: '#ffffff', // Fundo branco para as seções de despesas
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000', // Sombra para dar profundidade
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    minHeight: 250, // Altura mínima para a seção de débitos
  },
  currentMonthHighlight: {
    backgroundColor: 'lightblue', // Cor de fundo para um destaque bem visível
    borderColor: '#007bff', // Uma borda azul
    borderWidth: 4, // Mais espessa para destaque
    shadowColor: '#007bff', // Sombra azul para complementar
    shadowOpacity: 0.8, // Sombra mais forte
    shadowRadius: 10, // Sombra maior
    elevation: 10, // Elevação maior para o destaque no Android
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center', // Centraliza o título do mês
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#ccc',
    marginBottom: 5,
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  debitItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  debitText: {
    fontSize: 16,
    color: '#555',
  },
  debitValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  // Estilos para controlar a largura e alinhamento das colunas
  descriptionColumn: {
    flex: 2, // Ocupa mais espaço
    textAlign: 'left', // Alinhar à esquerda para descrições
  },
  dateColumn: {
    flex: 2, // Ocupa mais espaço
    textAlign: 'center', // Centralizar data
  },
  valueColumn: {
    flex: 1.5, // Ajustei um pouco para o valor
    textAlign: 'right', // Alinhar à direita para valores
  },
  noExpensesText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#888',
  },
  summaryContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  negativeValue: {
    color: 'red',
  },
  positiveValue: {
    color: '#007bff',
  },
});

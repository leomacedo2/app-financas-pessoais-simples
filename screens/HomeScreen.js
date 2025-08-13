// screens/HomeScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

// Funções auxiliares para manipulação de datas
const { width } = Dimensions.get('window');

const parseDateString = (dateString) => {
  const [day, month, year] = dateString.split('/').map(Number);
  return new Date(year, month - 1, day);
};

const formatDateForDisplay = (date) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const getMonthName = (date) => {
  const d = new Date(date);
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return monthNames[d.getMonth()];
};

const generateMonthsToDisplay = () => {
  const today = new Date();
  const months = [];
  const numPastMonths = 6;
  const numFutureMonths = 12;

  for (let i = numPastMonths; i > 0; i--) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push(date);
  }

  months.push(new Date(today.getFullYear(), today.getMonth(), 1));

  for (let i = 1; i <= numFutureMonths; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push(date);
  }
  return months;
};

const generateInitialExpenses = (monthsToDisplay) => {
  let generatedExpenses = [];
  const expenseDescriptions = [
    'Aluguel', 'Conta de Luz', 'Internet', 'Supermercado', 'Academia',
    'Telefone', 'Transporte', 'Lazer', 'Educação', 'Saúde', 'Restaurante', 'Roupas'
  ];
  monthsToDisplay.forEach(monthDate => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const numExpenses = Math.floor(Math.random() * 5) + 3;
    for (let i = 0; i < numExpenses; i++) {
      const day = Math.floor(Math.random() * 28) + 1;
      const value = parseFloat((Math.random() * 480 + 20).toFixed(2));
      const description = expenseDescriptions[Math.floor(Math.random() * expenseDescriptions.length)];
      const createdAtDate = new Date(year, month, day);
      generatedExpenses.push({
        id: `${year}-${month}-${i}-${Math.random()}`,
        description,
        value,
        createdAt: createdAtDate.toISOString(),
      });
    }
  });
  return generatedExpenses.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};


export default function HomeScreen() {
  const [loadingApp, setLoadingApp] = useState(true);
  const [allIncomes, setAllIncomes] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [hasScrolled, setHasScrolled] = useState(false);

  const monthsToDisplay = useRef(generateMonthsToDisplay()).current;

  const today = new Date();
  const initialMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const initialScrollIndex = monthsToDisplay.findIndex(monthDate =>
    monthDate.getMonth() === initialMonthDate.getMonth() &&
    monthDate.getFullYear() === initialMonthDate.getFullYear()
  );

  const getExpensesForMonth = (monthDate) => {
    const targetMonth = monthDate.getMonth();
    const targetYear = monthDate.getFullYear();
    return allExpenses.filter(item => {
      const itemDate = new Date(item.createdAt);
      return itemDate.getMonth() === targetMonth && itemDate.getFullYear() === targetYear;
    });
  };

  const flatListRef = useRef(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(initialScrollIndex);

  const loadData = useCallback(async () => {
    setLoadingApp(true);
    try {
      // Carregar Receitas
      const storedIncomesJson = await AsyncStorage.getItem('incomes');
      const storedIncomes = storedIncomesJson ? JSON.parse(storedIncomesJson) : [];
      // CORREÇÃO: Removido o if (JSON.stringify...) para garantir a atualização
      setAllIncomes(storedIncomes);
      console.log("HomeScreen: Receitas carregadas do AsyncStorage. Total:", storedIncomes.length);
      

      // Carregar/Gerar Despesas
      const storedExpensesJson = await AsyncStorage.getItem('expenses');
      let currentExpenses;
      if (!storedExpensesJson) {
        currentExpenses = generateInitialExpenses(monthsToDisplay);
        await AsyncStorage.setItem('expenses', JSON.stringify(currentExpenses));
        console.log("HomeScreen: Despesas geradas e salvas no AsyncStorage.");
      } else {
        currentExpenses = JSON.parse(storedExpensesJson);
        console.log("HomeScreen: Despesas carregadas do AsyncStorage. Total:", currentExpenses.length);
      }
      // CORREÇÃO: Removido o if (JSON.stringify...) para garantir a atualização
      setAllExpenses(currentExpenses);
      
    } catch (error) {
      console.error("HomeScreen: Erro ao carregar dados do AsyncStorage:", error);
      Alert.alert('Erro de Carregamento', 'Não foi possível carregar os dados de finanças do armazenamento local.');
    } finally {
      setLoadingApp(false);
    }
  }, []); // Array de dependências vazio para useCallback

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {};
    }, [loadData])
  );

  useEffect(() => {
    if (flatListRef.current && initialScrollIndex !== -1 && !loadingApp && !hasScrolled) {
      console.log("HomeScreen: Tentando rolar para o initialScrollIndex:", initialScrollIndex);
      setTimeout(() => {
        if (flatListRef.current && !hasScrolled) {
          flatListRef.current.scrollToIndex({ index: initialScrollIndex, animated: false });
          setHasScrolled(true);
          console.log("HomeScreen: Rolagem para initialScrollIndex concluída.");
        } else {
          console.log("HomeScreen: Rolagem já tentada ou FlatList ref nulo.");
        }
      }, 200);
    } else if (flatListRef.current === null) {
        console.log("HomeScreen: Não rolou para o initialScrollIndex. flatListRef.current é null.");
    } else {
        console.log("HomeScreen: Não rolou para o initialScrollIndex. Condições: initialScrollIndex:", initialScrollIndex, "loadingApp:", loadingApp, "hasScrolled:", hasScrolled);
    }
  }, [initialScrollIndex, loadingApp, hasScrolled]);

  const calculateTotalIncomeForMonth = (monthDate) => {
    const targetMonth = monthDate.getMonth();
    const targetYear = monthDate.getFullYear();
    let totalIncome = 0;

    allIncomes.forEach(income => {
      if (income.type === 'Fixo') {
        totalIncome += income.value;
      } else if (income.type === 'Ganho' && income.month === targetMonth && income.year === targetYear) {
        totalIncome += income.value;
      }
    });
    return totalIncome;
  };

  const currentMonthTotalIncome = calculateTotalIncomeForMonth(monthsToDisplay[currentMonthIndex]);

  const currentDisplayedMonthExpenses = getExpensesForMonth(monthsToDisplay[currentMonthIndex]);
  const totalDespesasDisplayedMonth = currentDisplayedMonthExpenses.reduce((sum, item) => sum + item.value, 0);

  const valorFinalDisplayedMonth = currentMonthTotalIncome - totalDespesasDisplayedMonth;

  const renderMonthSection = ({ item: monthDate, index }) => {
    const expenses = getExpensesForMonth(monthDate);
    const monthName = getMonthName(monthDate);
    const year = monthDate.getFullYear();

    const isSystemCurrentMonth = monthDate.getMonth() === initialMonthDate.getMonth() &&
                                 monthDate.getFullYear() === initialMonthDate.getFullYear();

    return (
      <View style={styles.monthPage}>
        <View style={[
          styles.section,
          isSystemCurrentMonth && styles.currentMonthHighlight
        ]}>
          <Text style={styles.sectionTitle}>{`${monthName} ${year}`}</Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.descriptionColumn]}>Despesa</Text>
            <Text style={[styles.headerText, styles.dateColumn]}>Data de Vencimento</Text>
            <Text style={[styles.headerText, styles.valueColumn]}>Valor</Text>
          </View>

          {expenses.length > 0 ? (
            expenses.map((item) => (
              <View key={item.id} style={styles.debitItemRow}>
                <Text style={[styles.debitText, styles.descriptionColumn]}>{item.description}</Text>
                <Text style={[styles.debitText, styles.dateColumn]}>{formatDateForDisplay(new Date(item.createdAt))}</Text>
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

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / width);
    if (newIndex !== currentMonthIndex) {
      setCurrentMonthIndex(newIndex);
    }
  };

  if (loadingApp) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text>Carregando dados de finanças locais...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={monthsToDisplay}
        renderItem={renderMonthSection}
        keyExtractor={(item, index) => index.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        initialScrollIndex={initialScrollIndex}
        extraData={currentMonthIndex}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Receita total:</Text>
          <Text style={styles.summaryValue}>
            {`${currentMonthTotalIncome.toFixed(2).replace('.', ',')} R$`}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Valor final:</Text>
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
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  monthPage: {
    width: width,
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    minHeight: 250,
  },
  currentMonthHighlight: {
    backgroundColor: 'lightblue',
    borderColor: '#007bff',
    borderWidth: 4,
    shadowColor: '#007bff',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
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
  descriptionColumn: {
    flex: 2,
    textAlign: 'left',
  },
  dateColumn: {
    flex: 2,
    textAlign: 'center',
  },
  valueColumn: {
    flex: 1.5,
    textAlign: 'right',
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

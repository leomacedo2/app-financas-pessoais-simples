// screens/HomeScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions } from 'react-native';

// Obter a largura da tela para rolagem paginada
const { width } = Dimensions.get('window');

// Funções auxiliares para manipulação de datas
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

export default function HomeScreen() {
  // Estado para a receita total (considerada global por enquanto)
  const [receitaTotal, setReceitaTotal] = useState(4000);

  // Estado para todas as despesas, incluindo datas de vencimento para diferentes meses
  // Ainda são exemplos!
  const [allDebitItems, setAllDebitItems] = useState(() => {
    const initialItems = [
      { id: 'd1', description: 'Aluguel', dueDate: '22/07/2025', value: 1000 },
      { id: 'd2', description: 'Conta de Luz', dueDate: '15/07/2025', value: 150 },
      { id: 'd3', description: 'Internet', dueDate: '01/07/2025', value: 100 },
      { id: 'd4', description: 'Supermercado', dueDate: '28/07/2025', value: 500 },
      { id: 'd5', description: 'Academia', dueDate: '05/08/2025', value: 80 },
      { id: 'd6', description: 'Telefone', dueDate: '12/08/2025', value: 70 },
      { id: 'd7', description: 'Carro', dueDate: '01/09/2025', value: 300 },
      { id: 'd8', description: 'Streaming', dueDate: '10/09/2025', value: 40 },
    ];

    // Ordenar os itens por data de vencimento ao inicializar o estado
    return initialItems.sort((a, b) => {
      const dateA = parseDateString(a.dueDate);
      const dateB = parseDateString(b.dueDate);
      return dateA.getTime() - dateB.getTime(); // Ordena em ordem crescente de data
    });
  });

  // Estado para o índice do mês atualmente exibido na rolagem horizontal
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const flatListRef = useRef(null);

  // Gerar uma lista de objetos de data para os meses a serem exibidos.
  // Começa no mês atual e vai para os próximos 2 meses.
  const generateMonthsToDisplay = () => {
    const today = new Date();
    const months = [];
    for (let i = 0; i < 3; i++) { // Mês atual + próximos 2 meses
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      months.push(date);
    }
    return months;
  };

  const monthsToDisplay = generateMonthsToDisplay();

  // Função para filtrar as despesas que pertencem a um mês específico
  const getExpensesForMonth = (monthDate) => {
    const targetMonth = monthDate.getMonth();
    const targetYear = monthDate.getFullYear();
    return allDebitItems.filter(item => {
      const itemDate = parseDateString(item.dueDate);
      return itemDate.getMonth() === targetMonth && itemDate.getFullYear() === targetYear;
    });
  };

  // Calcula o total de despesas e o valor final para o mês *atualmente visível*
  const currentDisplayedMonthExpenses = getExpensesForMonth(monthsToDisplay[currentMonthIndex]);
  const totalDespesasDisplayedMonth = currentDisplayedMonthExpenses.reduce((sum, item) => sum + item.value, 0);
  const valorFinalDisplayedMonth = receitaTotal - totalDespesasDisplayedMonth;

  // Componente que renderiza a seção de despesas para um único mês
  const renderMonthSection = ({ item: monthDate }) => {
    const expenses = getExpensesForMonth(monthDate);
    const monthName = getMonthName(monthDate);

    return (
      <View style={styles.monthPage}>
        <View style={styles.section}>
          {/* Título da seção: nome do mês atual */}
          <Text style={styles.sectionTitle}>{monthName}</Text>

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
        initialScrollIndex={currentMonthIndex} // Inicia a rolagem no mês atual (índice 0)
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
          {/* <Text style={styles.summaryValue}>{receitaTotal.toFixed(2).replace('.', ',')} R$</Text> */}
          <Text style={styles.summaryValue}>
            {`${receitaTotal.toFixed(2).replace('.', ',')} R$`}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Valor final:</Text>
          {/* Aplica cor vermelha se o valor final for negativo, azul se for positivo */}
          {/* /* <Text style={[styles.summaryValue, valorFinalDisplayedMonth < 0 ? styles.negativeValue : styles.positiveValue]}>
            {valorFinalDisplayedMonth.toFixed(2).replace('.', ',')} R$
          </Text> */}
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

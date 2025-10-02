// utils/commonStyles.js

/**
 * @file Arquivo para definir estilos CSS comuns e reutilizáveis em todo o aplicativo.
 * Centralizar estilos evita duplicação de código, garante consistência visual
 * e facilita a manutenção (mude em um lugar, reflita em todos).
 *
 * Esta versão foi revisada para fornecer estilos de layout de botão mais robustos para modais,
 * diferenciando entre botões de ação (lado a lado) e botões de opção (empilhados, gerenciados pelo componente),
 * e adicionando um container para botões de modal empilhados.
 *
 * ATUALIZAÇÃO RECENTE: Adicionados estilos para o `Switch` de status de despesa,
 * e ajustes para `pickerLabel` para melhor espaçamento.
 *
 * NOVIDADE: 2025-08-26 - Adicionados estilos para o botão de exclusão de despesa
 * e para os botões de ação dentro dos modais (`buttonDanger`).
 */

import { StyleSheet } from 'react-native';

const commonStyles = StyleSheet.create({
  // Estilo padrão para o container principal de muitas telas, ocupando toda a tela e com fundo padrão.
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Fundo cinza claro padrão
  },
  // Estilo para o conteúdo scrollável, com padding horizontal padrão
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
    paddingHorizontal: 20, // Padding horizontal padrão para todas as telas
  },
  // Estilo para o conteúdo de listas, com padding horizontal padrão
  listContent: {
    paddingBottom: 80, // Espaço para o botão de adição flutuante
    paddingHorizontal: 20, // Padding horizontal padrão para todas as telas
  },
  // Estilo para containers de carregamento, centralizando o indicador de atividade.
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5', // Mesmo fundo padrão
  },
  // Estilo para o título principal das telas.
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30, // Espaçamento abaixo do título
    textAlign: 'center',
    color: '#333', // Cor de texto escura
  },
  // Estilo para campos de input de texto.
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#fff', // Fundo branco para o input
    fontSize: 16,
  },
  // Estilo para o botão principal de adição/salvar em várias telas.
  addButton: {
    backgroundColor: '#007bff', // Azul primário
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#000', // Sombra para dar profundidade
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  // NOVO: Estilo para o botão de exclusão
  deleteButton: {
    backgroundColor: '#dc3545', // Vermelho para ação de deletar
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10, // Espaçamento do botão de salvar
    shadowColor: '#000', // Sombra para dar profundidade
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  // Estilo para o texto dentro dos botões principais.
  buttonText: {
    color: '#fff', // Texto branco
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Estilo para o texto quando não há itens em uma lista (ex: "Nenhuma receita adicionada").
  noItemsText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#888', // Cor de texto mais suave
  },
  // Estilos genéricos para Modais (pop-ups), reutilizados em várias telas.
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', // Fundo escuro transparente para o modal
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '85%', // Largura do modal levemente maior
    maxWidth: 400, // Garante que não fique muito largo em telas grandes
  },
  modalTitle: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalText: { // Adicionado estilo para texto explicativo em modal
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 16,
    color: '#555',
  },
  // Container para agrupar botões de AÇÃO (editar/excluir/cancelar) lado a lado
  modalActionButtonsContainer: {
    flexDirection: 'row', // Alinha os botões lado a lado
    justifyContent: 'space-around', // Espaça uniformemente os botões
    width: '100%',
    marginTop: 20,
  },
  // NOVO: Container para agrupar botões de AÇÃO EMPILHADOS (um embaixo do outro)
  modalStackedButtonsContainer: {
    width: '100%', // Ocupa a largura total
    marginTop: 20,
  },
  modalButton: {
    borderRadius: 10,
    paddingVertical: 12, // Aumenta o padding vertical
    paddingHorizontal: 15, // Padding horizontal
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Remover flex: 1 daqui, pois o containerStackedButtons vai gerenciar a largura,
    // ou mantê-lo se for um botão único ou em `modalActionButtonsContainer`
  },
  modalButtonStacked: { // Estilo específico para botões empilhados
    marginBottom: 10, // Espaçamento entre os botões
    width: '100%', // Ocupa a largura total no container empilhado
  },
  buttonEdit: {
    backgroundColor: '#2196F3', // Azul para editar
  },
  buttonDelete: { // Renomeado para buttonDanger para consistência com o DespesaScreen
    backgroundColor: '#f44336', // Vermelho para excluir
  },
  // NOVO: Estilo para botão de perigo (ex: excluir)
  buttonDanger: {
    backgroundColor: '#dc3545', // Vermelho para perigo
  },
  buttonClose: {
    backgroundColor: '#9e9e9e', // Cinza para cancelar
  },
  buttonTextStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 14, // Ajusta o tamanho da fonte para caber
  },
  // Estilos para botões de OPÇÃO dentro dos modais (como o de limpeza de dados)
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10, // Margem entre as opções
    width: '100%',
    alignItems: 'flex-start', // Alinha o texto à esquerda
    backgroundColor: '#f0f0f0',
  },
  optionButtonSelected: {
    backgroundColor: '#e0f7fa', // Cor de fundo para seleção
    borderColor: '#007bff',
  },
  optionButtonText: {
    fontSize: 15,
    color: '#333',
  },
  optionButtonTextSelected: {
    fontWeight: 'bold',
    color: '#007bff',
  },
  // Estilos para o componente Picker.
  pickerContainer: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  pickerLabel: {
    fontSize: 16,
    color: '#555',
    paddingLeft: 15, // Mantém o padding para o label
    paddingTop: 8,
    marginBottom: 5, // AJUSTE: Adicionado um pequeno espaçamento inferior para separar do Picker/Input
  },
  picker: {
    height: 50,
    width: '100%',
  },
  // Estilos para os botões de seleção de tipo (Fixo/Ganho em AdicionarReceitaScreen).
  typeSelectionContainer: {
    marginBottom: 15,
  },
  typeButtonsWrapper: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden', // Garante que os filhos arredondados fiquem dentro
  },
  typeButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 2, // Pequena margem entre os botões
  },
  typeButtonSelected: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
    borderWidth: 1,
  },
  typeButtonUnselected: {
    backgroundColor: '#ffffff',
    borderColor: '#ccc',
    borderWidth: 1,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  typeButtonTextSelected: {
    color: '#fff',
  },
  typeButtonTextUnselected: {
    color: '#333',
  },
  // Estilos para o seletor de data.
  datePickerSection: {
    marginBottom: 15,
  },
  dateDisplayButton: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  dateDisplayText: {
    fontSize: 16,
    color: '#333',
  },
  // Estilos para o container do picker de mês/ano
  pickerWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  halfPickerContainer: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginHorizontal: 5,
  },
  // NOVOS ESTILOS PARA SWITCH DE STATUS (DespesaScreen)
  statusToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },


  // statusToggleLabel: {
  //   fontSize: 16,
  //   color: '#333',
  //   fontWeight: 'bold',
  // },


  // NOVO ESTILO PARA TEXTO DE VALOR TOTAL (HomeScreen)
  // totalValueText: {
  //   fontSize: 18,
  //   fontWeight: 'bold',
  //   color: '#333',
  // },

  
});

export default commonStyles;

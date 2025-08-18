// utils/commonStyles.js

/**
 * @file Arquivo para definir estilos CSS comuns e reutilizáveis em todo o aplicativo.
 * Centralizar estilos evita duplicação de código, garante consistência visual
 * e facilita a manutenção (mude em um lugar, reflita em todos).
 */

import { StyleSheet } from 'react-native';

const commonStyles = StyleSheet.create({
  // Estilo padrão para o container principal de muitas telas, ocupando toda a tela e com fundo padrão.
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Fundo cinza claro padrão
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
    width: '80%', // Largura do modal
  },
  modalTitle: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalButton: {
    borderRadius: 10,
    padding: 15,
    elevation: 2,
    width: '100%',
    marginBottom: 10,
  },
  buttonEdit: {
    backgroundColor: '#2196F3', // Azul para editar
  },
  buttonDelete: {
    backgroundColor: '#f44336', // Vermelho para excluir
  },
  buttonClose: {
    backgroundColor: '#9e9e9e', // Cinza para cancelar
  },
  buttonTextStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  // Estilos para o componente Picker (utilizado em AdicionarCartaoScreen).
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
    paddingLeft: 15,
    paddingTop: 8,
    marginBottom: 5,
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
    overflow: 'hidden',
  },
  typeButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: 2,
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
});

export default commonStyles;

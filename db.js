const db = {
  // Salva dados no localStorage
  save: (key, data) => {
      try {
          localStorage.setItem(key, JSON.stringify(data));
          return true;
      } catch (e) {
          console.error('Erro ao salvar no localStorage:', e);
          return false;
      }
  },

  // Carrega dados do localStorage
  load: (key) => {
      try {
          const data = localStorage.getItem(key);
          return data ? JSON.parse(data) : null;
      } catch (e) {
          console.error('Erro ao carregar do localStorage:', e);
          return null;
      }
  },

  // Limpa todos os dados
  clear: () => {
      localStorage.clear();
  },

  // Inicializa dados padrão
  init: () => {
      if (!db.load('transactions')) {
          db.save('transactions', []);
      }
      if (!db.load('goals')) {
          db.save('goals', []);
      }
      if (!db.load('categories')) {
          db.save('categories', [
              { id: 1, name: 'Alimentação', color: '#3B82F6', icon: 'utensils' },
              { id: 2, name: 'Transporte', color: '#10B981', icon: 'bus' },
              { id: 3, name: 'Moradia', color: '#EF4444', icon: 'home' },
              { id: 4, name: 'Lazer', color: '#F59E0B', icon: 'gamepad' },
              { id: 5, name: 'Saúde', color: '#8B5CF6', icon: 'heart-pulse' },
              { id: 6, name: 'Educação', color: '#EC4899', icon: 'book' },
              { id: 7, name: 'Salário', color:  '#10B981', icon: 'wallet' },
              { id: 8, name: 'Outros', color: '#64748B', icon: 'ellipsis' }
          ]);
      }
  }
};

// Inicializa o banco de dados
db.init();

// Exporta as funções para uso em outros arquivos
window.db = db;

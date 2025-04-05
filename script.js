// Verifica se db está disponível
if (!window.db) {
  console.error('Erro: db não foi definido. Verifique se db.js foi carregado corretamente.');
}

// Objeto principal do aplicativo
const FinanceApp = {
  // Inicializa o aplicativo
  init: function() {
    this.setupEventListeners();
    this.loadPage();
  },

  // Configura listeners globais
  setupEventListeners: function() {
    // Listener para o modal de transação
    document.getElementById('submitTransaction')?.addEventListener('click', this.handleTransactionSubmit.bind(this));
    // Listener para o modal de categoria
    document.getElementById('submitCategory')?.addEventListener('click', this.handleCategorySubmit.bind(this));
    // Listener para o modal de meta
    document.getElementById('submitGoal')?.addEventListener('click', this.handleGoalSubmit.bind(this));
    // Listener para backup/importação
    document.getElementById('exportData')?.addEventListener('click', this.exportData.bind(this));
    document.getElementById('importData')?.addEventListener('click', () => {
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile')?.addEventListener('change', this.importData.bind(this));
  },

  // Carrega a página específica
  loadPage: function() {
    const path = window.location.pathname.split('/').pop();
    switch (path) {
      case 'transacoes.html':
        this.initTransactionsPage();
        break;
      case 'metas.html':
        this.initGoalsPage();
        break;
      case 'relatorios.html':
        this.initReportsPage();
        break;
      case 'config.html':
        this.initConfigPage();
        break;
      default:
        this.initDashboardPage();
    }
  },

  // Página: Dashboard/Resumo
  initDashboardPage: function() {
    this.updateDashboard();
    this.renderRecentTransactions();
    this.setupTransactionForm();
    this.renderCharts();
  },

  // Página: Transações
  initTransactionsPage: function() {
    this.renderTransactions();
    this.setupTransactionForm();
    this.setupTransactionFilters();
  },

  // Página: Metas
  initGoalsPage: function() {
    // Apenas renderiza as metas; o modal não é aberto automaticamente para evitar metas em branco.
    this.renderGoals();
    // Configura data limite padrão para 1 mês à frente (quando o modal for aberto)
    const deadlineInput = document.getElementById('goalDeadline');
    if (deadlineInput) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      deadlineInput.value = nextMonth.toISOString().split('T')[0];
    }
  },

  // Página: Relatórios
  initReportsPage: function() {
    document.getElementById('reportPeriod').addEventListener('change', function() {
      const isCustom = this.value === 'custom';
      document.getElementById('customStartDateContainer').classList.toggle('hidden', !isCustom);
      document.getElementById('customEndDateContainer').classList.toggle('hidden', !isCustom);
    });
    document.getElementById('customEndDate').value = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(1);
    document.getElementById('customStartDate').value = startDate.toISOString().split('T')[0];
  },

  // Página: Configurações
  initConfigPage: function() {
    this.renderCategories();
    this.setupCategoryForm();
    this.setupBackupButtons();
  },

  // Atualiza o dashboard
  updateDashboard: function() {
    const transactions = db.load('transactions') || [];
    const goals = db.load('goals') || [];
    const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expenses;
    const savings = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
    this.updateElement('current-balance', this.formatCurrency(balance));
    this.updateElement('income', this.formatCurrency(income));
    this.updateElement('expenses', this.formatCurrency(expenses));
    this.updateElement('savings', this.formatCurrency(savings));
    this.renderCharts();
  },

  // Renderiza transações recentes (para dashboard)
  renderRecentTransactions: function() {
    const transactions = db.load('transactions') || [];
    const categories = db.load('categories') || [];
    const recent = transactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    const container = document.getElementById('recentTransactions');
    if (container) {
      container.innerHTML = recent.map(t => {
        const category = categories.find(c => c.id === t.categoryId) || {};
        const isIncome = t.type === 'income';
        return `
          <div class="flex justify-between items-center pb-4 border-b border-gray-100">
            <div class="flex items-center">
              <div class="p-2 rounded-full ${isIncome ? 'bg-green-100 text-secondary' : 'bg-red-100 text-danger'} mr-3">
                <i class="fas fa-${category.icon || 'ellipsis'}"></i>
              </div>
              <div>
                <p class="text-sm font-medium">${category.name || 'Outros'}</p>
                <p class="text-xs text-gray-500">${new Date(t.date).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
            <p class="text-sm font-medium ${isIncome ? 'text-secondary' : 'text-danger'}">
              ${isIncome ? '+' : '-'} ${this.formatCurrency(t.amount)}
            </p>
          </div>
        `;
      }).join('');
    }
  },

  // Renderiza todas as transações (para página de transações)
  renderTransactions: function(filter = {}) {
    const transactions = db.load('transactions') || [];
    const categories = db.load('categories') || [];
    let filtered = transactions.filter(t => {
      if (filter.type && t.type !== filter.type) return false;
      if (filter.category && t.categoryId !== parseInt(filter.category)) return false;
      if (filter.startDate && new Date(t.date) < new Date(filter.startDate)) return false;
      if (filter.endDate && new Date(t.date) > new Date(filter.endDate)) return false;
      return true;
    });
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    const tbody = document.getElementById('transactionsList');
    if (tbody) {
      tbody.innerHTML = filtered.map(t => {
        const category = categories.find(c => c.id === t.categoryId) || {};
        const isIncome = t.type === 'income';
        return `
          <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(t.date).toLocaleDateString('pt-BR')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${t.description || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <span class="inline-flex items-center">
                <span class="category-color" style="background-color: ${category.color || '#64748B'}"></span>
                ${category.name || 'Outros'}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm ${isIncome ? 'text-secondary' : 'text-danger'}">
              ${isIncome ? '+' : '-'} ${this.formatCurrency(t.amount)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <button onclick="FinanceApp.editTransactionModal(${t.id})" class="text-primary hover:text-blue-600 mr-3">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="FinanceApp.deleteTransaction(${t.id})" class="text-danger hover:text-red-600">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  },

  // Renderiza metas
  renderGoals: function() {
    const goals = db.load('goals') || [];
    const container = document.getElementById('goalsList');
    if (container) {
      container.innerHTML = goals.map(goal => {
        const progress = (goal.currentAmount / goal.targetAmount) * 100;
        const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        const status = daysLeft <= 0 ? 'Atrasada' : (progress >= 100 ? 'Concluída' : 'Em andamento');
        const statusColor = status === 'Concluída' ? 'bg-secondary' : status === 'Atrasada' ? 'bg-danger' : 'bg-primary';
        return `
          <div class="bg-white p-6 rounded-lg shadow-sm border-l-4 ${statusColor}">
            <div class="flex justify-between items-start mb-4">
              <h3 class="font-medium text-lg">${goal.name}</h3>
              <span class="text-xs px-2 py-1 rounded-full ${statusColor} text-white">${status}</span>
            </div>
            <div class="mb-4">
              <div class="flex justify-between text-sm mb-1">
                <span>Progresso: ${Math.round(progress)}%</span>
                <span>${this.formatCurrency(goal.currentAmount)} / ${this.formatCurrency(goal.targetAmount)}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="h-2 rounded-full ${statusColor}" style="width: ${Math.min(progress, 100)}%"></div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-gray-500">Data Limite</p>
                <p>${new Date(goal.deadline).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p class="text-gray-500">Dias Restantes</p>
                <p>${daysLeft > 0 ? daysLeft : 0}</p>
              </div>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between">
              <button onclick="FinanceApp.editGoalModal(${goal.id})" class="text-primary hover:text-blue-600">
                <i class="fas fa-edit mr-1"></i> Editar
              </button>
              <button onclick="FinanceApp.addToGoal(${goal.id})" class="text-secondary hover:text-green-600">
                <i class="fas fa-plus-circle mr-1"></i> Adicionar
              </button>
              <button onclick="FinanceApp.deleteGoal(${goal.id})" class="text-danger hover:text-red-600">
                <i class="fas fa-trash mr-1"></i> Excluir
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  },

  // Renderiza categorias (para página de configurações)
  renderCategories: function() {
    const categories = db.load('categories') || [];
    const container = document.getElementById('categoriesList');
    if (container) {
      container.innerHTML = categories.map(category => `
        <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
          <span class="inline-flex items-center">
            <span class="category-color mr-2" style="background-color: ${category.color}"></span>
            <span>${category.name}</span>
            <i class="fas fa-${category.icon} ml-2 text-gray-500"></i>
          </span>
          <div>
            <button onclick="FinanceApp.editCategoryModal(${category.id})" class="text-primary hover:text-blue-600 mr-2">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="FinanceApp.deleteCategory(${category.id})" class="text-danger hover:text-red-600">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `).join('');
    }
  },

  // Configura o formulário de transação
  setupTransactionForm: function() {
    const form = document.getElementById('transactionForm');
    if (!form) return;
    const categories = db.load('categories') || [];
    const categorySelect = document.getElementById('transactionCategory');
    if (categorySelect) {
      categorySelect.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    const dateInput = document.getElementById('transactionDate');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  },

  // Configura o formulário de categoria
  setupCategoryForm: function() {
    const form = document.getElementById('categoryForm');
    if (!form) return;
    form.reset();
    document.getElementById('submitCategory').textContent = 'Adicionar';
    delete form.dataset.editId;
  },

  // Configura o formulário de meta
  setupGoalForm: function() {
    const form = document.getElementById('goalForm');
    if (!form) return;
    // Não abrimos o modal automaticamente para evitar metas em branco
    form.reset();
    document.getElementById('submitGoal').textContent = 'Adicionar';
    delete form.dataset.editId;
  },

  // Configura botões de backup
  setupBackupButtons: function() {
    document.getElementById('exportData')?.addEventListener('click', this.exportData.bind(this));
    document.getElementById('importData')?.addEventListener('click', () => {
      document.getElementById('importFile').click();
    });
    document.getElementById('importFile')?.addEventListener('change', this.importData.bind(this));
  },

  // Configura filtros de transações
  setupTransactionFilters: function() {
    const categories = db.load('categories') || [];
    const filterCategory = document.getElementById('filterCategory');
    if (filterCategory) {
      filterCategory.innerHTML = '<option value="all">Todas</option>';
      categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        filterCategory.appendChild(option);
      });
      document.getElementById('applyFilters').addEventListener('click', () => {
        const filters = {
          type: document.getElementById('filterType').value,
          category: document.getElementById('filterCategory').value,
          startDate: document.getElementById('filterStartDate').value,
          endDate: document.getElementById('filterEndDate').value
        };
        if (filters.type === 'all') delete filters.type;
        if (filters.category === 'all') delete filters.category;
        if (!filters.startDate) delete filters.startDate;
        if (!filters.endDate) delete filters.endDate;
        this.renderTransactions(filters);
      });
      document.getElementById('resetFilters').addEventListener('click', () => {
        document.getElementById('filterType').value = 'all';
        document.getElementById('filterCategory').value = 'all';
        document.getElementById('filterStartDate').value = '';
        document.getElementById('filterEndDate').value = '';
        this.renderTransactions();
      });
    }
  },

  // Manipulação de transações
  handleTransactionSubmit: function() {
    const form = document.getElementById('transactionForm');
    const id = form.dataset.editId;
    const transaction = {
      type: document.getElementById('transactionType').value,
      amount: parseFloat(document.getElementById('transactionAmount').value),
      categoryId: parseInt(document.getElementById('transactionCategory').value),
      date: document.getElementById('transactionDate').value,
      description: document.getElementById('transactionDescription').value
    };
    if (id) {
      this.editTransaction(id, transaction);
    } else {
      this.addTransaction(transaction);
    }
    form.reset();
    delete form.dataset.editId;
    this.closeModal('addTransactionModal');
  },

  addTransaction: function(transaction) {
    const transactions = db.load('transactions') || [];
    transactions.push({
      id: Date.now(),
      ...transaction,
      date: transaction.date || new Date().toISOString().split('T')[0]
    });
    db.save('transactions', transactions);
    this.updateDashboard();
    this.renderTransactions();
  },

  editTransaction: function(id, updatedData) {
    const transactions = db.load('transactions');
    const index = transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      transactions[index] = { ...transactions[index], ...updatedData };
      db.save('transactions', transactions);
      this.updateDashboard();
      this.renderTransactions();
    }
  },

  deleteTransaction: function(id) {
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
      const transactions = db.load('transactions').filter(t => t.id !== id);
      db.save('transactions', transactions);
      this.updateDashboard();
      this.renderTransactions();
    }
  },

  editTransactionModal: function(id) {
    const transaction = db.load('transactions').find(t => t.id === id);
    if (transaction) {
      document.getElementById('transactionType').value = transaction.type;
      document.getElementById('transactionAmount').value = transaction.amount;
      document.getElementById('transactionCategory').value = transaction.categoryId;
      document.getElementById('transactionDate').value = transaction.date;
      document.getElementById('transactionDescription').value = transaction.description || '';
      document.getElementById('submitTransaction').textContent = 'Salvar';
      document.getElementById('transactionForm').dataset.editId = id;
      this.openModal('addTransactionModal');
    }
  },

  // Manipulação de categorias
  handleCategorySubmit: function() {
    const form = document.getElementById('categoryForm');
    const id = form.dataset.editId;
    const category = {
      name: document.getElementById('categoryName').value,
      color: document.getElementById('categoryColor').value,
      icon: document.getElementById('categoryIcon').value
    };
    if (id) {
      this.editCategory(id, category);
    } else {
      this.addCategory(category);
    }
    this.closeModal('addCategoryModal');
  },

  addCategory: function(category) {
    const categories = db.load('categories') || [];
    categories.push({
      id: Date.now(),
      ...category
    });
    db.save('categories', categories);
    this.renderCategories();
    this.setupTransactionForm();
  },

  editCategory: function(id, updatedData) {
    const categories = db.load('categories');
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...updatedData };
      db.save('categories', categories);
      this.renderCategories();
      this.setupTransactionForm();
    }
  },

  deleteCategory: function(id) {
    if (confirm('Tem certeza que deseja excluir esta categoria? Todas as transações associadas serão movidas para "Outros".')) {
      let categories = db.load('categories');
      categories = categories.filter(c => c.id !== id);
      db.save('categories', categories);
      let transactions = db.load('transactions');
      transactions = transactions.map(t => {
        if (t.categoryId === id) {
          return { ...t, categoryId: 8 };
        }
        return t;
      });
      db.save('transactions', transactions);
      this.renderCategories();
      this.setupTransactionForm();
      this.updateDashboard();
      this.renderTransactions();
    }
  },

  editCategoryModal: function(id) {
    const category = db.load('categories').find(c => c.id === id);
    if (category) {
      document.getElementById('categoryName').value = category.name;
      document.getElementById('categoryColor').value = category.color;
      document.getElementById('categoryIcon').value = category.icon;
      document.getElementById('submitCategory').textContent = 'Salvar';
      document.getElementById('categoryForm').dataset.editId = id;
      this.openModal('addCategoryModal');
    }
  },

  // Manipulação de metas
  handleGoalSubmit: function() {
    const form = document.getElementById('goalForm');
    const id = form.dataset.editId ? Number(form.dataset.editId) : null;
    const goal = {
      name: document.getElementById('goalName').value,
      targetAmount: parseFloat(document.getElementById('goalTargetAmount').value),
      currentAmount: parseFloat(document.getElementById('goalCurrentAmount').value) || 0,
      deadline: document.getElementById('goalDeadline').value,
      description: document.getElementById('goalDescription').value || '',
      createdAt: new Date().toISOString()
    };
    if (id) {
      this.editGoal(id, goal);
    } else {
      this.addGoal(goal);
    }
    form.reset();
    delete form.dataset.editId;
    document.getElementById('submitGoal').textContent = 'Adicionar';
    this.closeModal('addGoalModal');
  },

  addGoal: function(goal) {
    const goals = db.load('goals') || [];
    // Evita metas com campos vazios
    if (!goal.name || isNaN(goal.targetAmount) || !goal.deadline) {
      return;
    }
    goals.push({
      id: Date.now(),
      ...goal
    });
    db.save('goals', goals);
    this.renderGoals();
    this.updateDashboard();
  },

  editGoal: function(id, updatedData) {
    const goals = db.load('goals');
    const index = goals.findIndex(g => g.id === id);
    if (index !== -1) {
      goals[index] = { ...goals[index], ...updatedData };
      db.save('goals', goals);
      this.renderGoals();
      this.updateDashboard();
    }
  },

  deleteGoal: function(id) {
    if (confirm('Tem certeza que deseja excluir esta meta?')) {
      const goals = db.load('goals').filter(g => g.id !== id);
      db.save('goals', goals);
      this.renderGoals();
      this.updateDashboard();
    }
  },

  editGoalModal: function(id) {
    const goal = db.load('goals').find(g => g.id === id);
    if (goal) {
      document.getElementById('goalName').value = goal.name;
      document.getElementById('goalTargetAmount').value = goal.targetAmount;
      document.getElementById('goalCurrentAmount').value = goal.currentAmount;
      document.getElementById('goalDeadline').value = goal.deadline;
      document.getElementById('goalDescription').value = goal.description || '';
      document.getElementById('submitGoal').textContent = 'Salvar';
      document.getElementById('goalModalTitle').textContent = 'Editar Meta';
      document.getElementById('goalForm').dataset.editId = id;
      this.openModal('addGoalModal');
    }
  },

  addToGoal: function(id) {
    const goal = db.load('goals').find(g => g.id === id);
    if (goal) {
      const amount = prompt(`Quanto deseja adicionar à meta "${goal.name}"?`, "0");
      if (amount && !isNaN(amount)) {
        this.editGoal(id, {
          ...goal,
          currentAmount: goal.currentAmount + parseFloat(amount)
        });
      }
    }
  },

  calculateGoal: function() {
    const target = parseFloat(document.getElementById('goalTarget').value);
    const period = parseInt(document.getElementById('goalPeriod').value);
    const monthly = parseFloat(document.getElementById('goalMonthly').value);
    if (!target || !period || !monthly) {
      alert('Preencha todos os campos para calcular');
      return;
    }
    const requiredMonthly = target / period;
    const difference = monthly - requiredMonthly;
    const timeWithCurrent = Math.ceil(target / monthly);
    document.getElementById('resultTarget').textContent = this.formatCurrency(target);
    document.getElementById('resultRequired').textContent = this.formatCurrency(requiredMonthly);
    document.getElementById('resultSavings').textContent = this.formatCurrency(monthly);
    document.getElementById('resultTime').textContent = `${timeWithCurrent} meses`;
    document.getElementById('resultDifference').textContent = this.formatCurrency(difference);
    document.getElementById('goalResult').classList.remove('hidden');
  },

  saveGoalFromCalculator: function() {
    const target = parseFloat(document.getElementById('goalTarget').value);
    const period = parseInt(document.getElementById('goalPeriod').value);
    if (!target || !period) {
      alert('Preencha os campos necessários');
      return;
    }
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + period);
    document.getElementById('goalTargetAmount').value = target;
    document.getElementById('goalCurrentAmount').value = 0;
    document.getElementById('goalDeadline').value = deadline.toISOString().split('T')[0];
    document.getElementById('goalName').value = `Meta de ${this.formatCurrency(target)}`;
    document.getElementById('goalName').focus();
    document.getElementById('goalModalTitle').textContent = 'Salvar Meta Calculada';
    this.openModal('addGoalModal');
  },

  // Relatórios
  generateReport: function() {
    const reportType = document.getElementById('reportType').value;
    const period = document.getElementById('reportPeriod').value;
    let startDate, endDate;
    if (period === 'custom') {
      startDate = new Date(document.getElementById('customStartDate').value);
      endDate = new Date(document.getElementById('customEndDate').value);
    } else {
      const today = new Date();
      endDate = new Date(today);
      switch (period) {
        case 'current-month':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          break;
        case 'last-month':
          startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          endDate = new Date(today.getFullYear(), today.getMonth(), 0);
          break;
        case 'last-3-months':
          startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
          break;
        case 'current-year':
          startDate = new Date(today.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      }
    }
    const periodText = period === 'custom'
      ? `${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`
      : document.getElementById('reportPeriod').options[document.getElementById('reportPeriod').selectedIndex].text;
    document.getElementById('reportPeriodText').textContent = periodText;
    switch (reportType) {
      case 'monthly':
        this.generateMonthlyReport(startDate, endDate);
        break;
      case 'category':
        this.generateCategoryReport(startDate, endDate);
        break;
      case 'income-vs-expense':
        this.generateIncomeVsExpenseReport(startDate, endDate);
        break;
      case 'goals':
        this.generateGoalsReport();
        break;
    }
    document.getElementById('reportResults').classList.remove('hidden');
    document.getElementById('financialSummary').classList.remove('hidden');
  },

  generateMonthlyReport: function(startDate, endDate) {
    const transactions = db.load('transactions') || [];
    const filtered = transactions.filter(t => {
      const date = new Date(t.date);
      return date >= startDate && date <= endDate;
    });
    const months = {};
    const current = new Date(startDate);
    while (current <= endDate) {
      const monthKey = `${current.getFullYear()}-${current.getMonth()}`;
      months[monthKey] = {
        name: current.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        income: 0,
        expense: 0,
        balance: 0
      };
      current.setMonth(current.getMonth() + 1);
    }
    filtered.forEach(t => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (months[monthKey]) {
        if (t.type === 'income') {
          months[monthKey].income += t.amount;
          months[monthKey].balance += t.amount;
        } else {
          months[monthKey].expense += t.amount;
          months[monthKey].balance -= t.amount;
        }
      }
    });
    const labels = Object.values(months).map(m => m.name);
    const incomeData = Object.values(months).map(m => m.income);
    const expenseData = Object.values(months).map(m => m.expense);
    this.updateMainChart(labels, incomeData, expenseData, 'Receitas e Despesas por Mês');
    document.getElementById('reportTitle').textContent = 'Relatório Mensal';
    document.getElementById('reportTableHeader').innerHTML = `
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mês</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receitas</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Despesas</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
    `;
    document.getElementById('reportTableBody').innerHTML = Object.values(months).map(m => `
      <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${m.name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">${this.formatCurrency(m.income)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-danger">${this.formatCurrency(m.expense)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm ${m.balance >= 0 ? 'text-secondary' : 'text-danger'}">
          ${this.formatCurrency(m.balance)}
        </td>
      </tr>
    `).join('');
    this.updateFinancialSummary(months);
  },

  generateCategoryReport: function(startDate, endDate) {
    const transactions = db.load('transactions') || [];
    const categories = db.load('categories') || [];
    const filtered = transactions.filter(t => {
      const date = new Date(t.date);
      return date >= startDate && date <= endDate && t.type === 'expense';
    });
    const categoryMap = {};
    categories.forEach(c => {
      categoryMap[c.id] = {
        name: c.name,
        color: c.color,
        total: 0
      };
    });
    filtered.forEach(t => {
      if (categoryMap[t.categoryId]) {
        categoryMap[t.categoryId].total += t.amount;
      } else {
        categoryMap[t.categoryId] = {
          name: 'Outros',
          color: '#64748B',
          total: t.amount
        };
      }
    });
    const categoriesWithData = Object.values(categoryMap).filter(c => c.total > 0);
    categoriesWithData.sort((a, b) => b.total - a.total);
    const labels = categoriesWithData.map(c => c.name);
    const data = categoriesWithData.map(c => c.total);
    const backgroundColors = categoriesWithData.map(c => c.color);
    this.updateMainPieChart(labels, data, backgroundColors, 'Despesas por Categoria');
    document.getElementById('reportTitle').textContent = 'Relatório por Categoria';
    document.getElementById('reportTableHeader').innerHTML = `
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% do Total</th>
    `;
    const totalExpenses = categoriesWithData.reduce((sum, c) => sum + c.total, 0);
    document.getElementById('reportTableBody').innerHTML = categoriesWithData.map(c => {
      const percentage = (c.total / totalExpenses) * 100;
      return `
        <tr>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            <span class="inline-flex items-center">
              <span class="category-color mr-2" style="background-color: ${c.color}"></span>
              ${c.name}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-danger">${this.formatCurrency(c.total)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm">${percentage.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');
    const transactionsInPeriod = db.load('transactions').filter(t => {
      const date = new Date(t.date);
      return date >= startDate && date <= endDate;
    });
    const income = transactionsInPeriod.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = transactionsInPeriod.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expense;
    document.getElementById('totalIncome').textContent = this.formatCurrency(income);
    document.getElementById('totalExpense').textContent = this.formatCurrency(expense);
    document.getElementById('totalBalance').textContent = this.formatCurrency(balance);
    document.getElementById('averageIncome').parentElement.classList.add('hidden');
    document.getElementById('averageExpense').parentElement.classList.add('hidden');
    document.getElementById('averageBalance').parentElement.classList.add('hidden');
  },

  generateIncomeVsExpenseReport: function(startDate, endDate) {
    const transactions = db.load('transactions') || [];
    const filtered = transactions.filter(t => {
      const date = new Date(t.date);
      return date >= startDate && date <= endDate;
    });
    const income = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expense;
    this.updateMainChart(
      ['Receitas', 'Despesas', 'Saldo'],
      [income, expense, balance],
      null,
      'Receitas vs Despesas',
      'bar'
    );
    document.getElementById('reportTitle').textContent = 'Relatório Receitas vs Despesas';
    document.getElementById('reportTableHeader').innerHTML = `
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% do Total</th>
    `;
    const total = income + expense;
    document.getElementById('reportTableBody').innerHTML = `
      <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Receitas</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-secondary">${this.formatCurrency(income)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm">${total > 0 ? ((income / total) * 100).toFixed(1) : 0}%</td>
      </tr>
      <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Despesas</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-danger">${this.formatCurrency(expense)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm">${total > 0 ? ((expense / total) * 100).toFixed(1) : 0}%</td>
      </tr>
      <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Saldo</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm ${balance >= 0 ? 'text-secondary' : 'text-danger'}">
          ${this.formatCurrency(balance)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm">-</td>
      </tr>
    `;
    document.getElementById('totalIncome').textContent = this.formatCurrency(income);
    document.getElementById('totalExpense').textContent = this.formatCurrency(expense);
    document.getElementById('totalBalance').textContent = this.formatCurrency(balance);
    document.getElementById('averageIncome').parentElement.classList.add('hidden');
    document.getElementById('averageExpense').parentElement.classList.add('hidden');
    document.getElementById('averageBalance').parentElement.classList.add('hidden');
  },

  generateGoalsReport: function() {
    const goals = db.load('goals') || [];
    // Filtra metas não concluídas
    const activeGoals = goals.filter(g => {
      const progress = (g.currentAmount / g.targetAmount) * 100;
      return progress < 100;
    });
    activeGoals.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    const labels = activeGoals.map(g => g.name);
    const targetData = activeGoals.map(g => g.targetAmount);
    const currentData = activeGoals.map(g => g.currentAmount);
    this.updateMainChart(labels, targetData, currentData, 'Progresso de Metas', 'bar');
    document.getElementById('reportTitle').textContent = 'Relatório de Metas';
    document.getElementById('reportTableHeader').innerHTML = `
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meta</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progresso</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Atual</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Alvo</th>
      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Limite</th>
    `;
    document.getElementById('reportTableBody').innerHTML = activeGoals.map(g => {
      const progress = (g.currentAmount / g.targetAmount) * 100;
      const daysLeft = Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      return `
        <tr>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${g.name}</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
              <div class="w-full bg-gray-200 rounded-full h-2 mr-2">
                <div class="h-2 rounded-full bg-primary" style="width: ${progress}%"></div>
              </div>
              <span class="text-xs">${Math.round(progress)}%</span>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm">${this.formatCurrency(g.currentAmount)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm">${this.formatCurrency(g.targetAmount)}</td>
          <td class="px-6 py-4 whitespace-nowrap text-sm">${new Date(g.deadline).toLocaleDateString('pt-BR')} (${daysLeft} dias)</td>
        </tr>
      `;
    }).join('');
    document.getElementById('financialSummary').classList.add('hidden');
  },

  updateMainChart: function(labels, data1, data2, title, type = 'line') {
    const ctx = document.getElementById('mainChart');
    if (!ctx) return;
    const datasets = [{
      label: data2 ? 'Receitas' : 'Valor',
      data: data1,
      backgroundColor: '#3B82F6',
      borderColor: '#3B82F6',
      borderWidth: 2
    }];
    if (data2) {
      datasets.push({
        label: 'Despesas',
        data: data2,
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
        borderWidth: 2
      });
    }
    if (ctx.chart) {
      ctx.chart.data.labels = labels;
      ctx.chart.data.datasets = datasets;
      ctx.chart.options.plugins.title.text = title;
      ctx.chart.config.type = type;
      ctx.chart.update();
    } else {
      ctx.chart = new Chart(ctx, {
        type: type,
        data: {
          labels: labels,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: title,
              font: {
                size: 16
              }
            },
            legend: {
              position: 'bottom'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: value => 'R$ ' + value.toLocaleString('pt-BR')
              }
            }
          }
        }
      });
    }
  },

  updateMainPieChart: function(labels, data, backgroundColors, title) {
    const ctx = document.getElementById('mainChart');
    if (!ctx) return;
    if (ctx.chart) {
      ctx.chart.data.labels = labels;
      ctx.chart.data.datasets[0].data = data;
      ctx.chart.data.datasets[0].backgroundColor = backgroundColors;
      ctx.chart.options.plugins.title.text = title;
      ctx.chart.config.type = 'doughnut';
      ctx.chart.update();
    } else {
      ctx.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: backgroundColors,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: title,
              font: {
                size: 16
              }
            },
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    }
  },

  updateFinancialSummary: function(monthsData) {
    const months = Object.values(monthsData);
    const totalIncome = months.reduce((sum, m) => sum + m.income, 0);
    const totalExpense = months.reduce((sum, m) => sum + m.expense, 0);
    const totalBalance = totalIncome - totalExpense;
    const monthCount = months.length || 1;
    const averageIncome = totalIncome / monthCount;
    const averageExpense = totalExpense / monthCount;
    const averageBalance = totalBalance / monthCount;

    const elTotalIncome = document.getElementById('totalIncome');
    if (elTotalIncome) elTotalIncome.textContent = this.formatCurrency(totalIncome);
    const elTotalExpense = document.getElementById('totalExpense');
    if (elTotalExpense) elTotalExpense.textContent = this.formatCurrency(totalExpense);
    const elTotalBalance = document.getElementById('totalBalance');
    if (elTotalBalance) elTotalBalance.textContent = this.formatCurrency(totalBalance);

    const elAverageIncome = document.getElementById('averageIncome');
    if (elAverageIncome) elAverageIncome.textContent = this.formatCurrency(averageIncome);
    const elAverageExpense = document.getElementById('averageExpense');
    if (elAverageExpense) elAverageExpense.textContent = this.formatCurrency(averageExpense);
    const elAverageBalance = document.getElementById('averageBalance');
    if (elAverageBalance) elAverageBalance.textContent = this.formatCurrency(averageBalance);

    const parentAvgIncome = elAverageIncome ? elAverageIncome.parentElement : null;
    if (parentAvgIncome) parentAvgIncome.classList.remove('hidden');
    const parentAvgExpense = elAverageExpense ? elAverageExpense.parentElement : null;
    if (parentAvgExpense) parentAvgExpense.classList.remove('hidden');
    const parentAvgBalance = elAverageBalance ? elAverageBalance.parentElement : null;
    if (parentAvgBalance) parentAvgBalance.classList.remove('hidden');
  },

  // Backup e restauração de dados
  exportData: function() {
    const data = {
      transactions: db.load('transactions'),
      goals: db.load('goals'),
      categories: db.load('categories'),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-financas-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData: function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (confirm(`Importar backup com ${data.transactions?.length || 0} transações e ${data.goals?.length || 0} metas?`)) {
          db.save('transactions', data.transactions || []);
          db.save('goals', data.goals || []);
          db.save('categories', data.categories || []);
          alert('Dados importados com sucesso!');
          const path = window.location.pathname.split('/').pop();
          if (path === 'index.html') {
            FinanceApp.updateDashboard();
          } else if (path === 'transacoes.html') {
            FinanceApp.renderTransactions();
          } else if (path === 'metas.html') {
            FinanceApp.renderGoals();
          } else if (path === 'relatorios.html') {
            // Não precisa atualizar
          } else if (path === 'config.html') {
            FinanceApp.renderCategories();
          }
        }
      } catch (error) {
        alert('Erro ao importar arquivo: ' + error.message);
      }
    };
    reader.readAsText(file);
  },

  exportReport: function() {
    if (typeof jsPDF !== 'undefined') {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const title = document.getElementById('reportTitle').textContent;
      const period = document.getElementById('reportPeriodText').textContent;
      doc.setFontSize(18);
      doc.text(title, 105, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`Período: ${period}`, 105, 30, { align: 'center' });
      const charts = [
        document.getElementById('mainChart'),
        document.getElementById('secondaryChart')
      ];
      let yPosition = 40;
      const promises = [];
      charts.forEach((chart) => {
        if (chart && chart.offsetParent !== null) {
          promises.push(
            new Promise(resolve => {
              html2canvas(chart).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 180;
                const imgHeight = canvas.height * imgWidth / canvas.width;
                doc.addImage(imgData, 'PNG', 15, yPosition, imgWidth, imgHeight);
                yPosition += imgHeight + 10;
                resolve();
              });
            })
          );
        }
      });
      Promise.all(promises).then(() => {
        const table = document.getElementById('reportTableBody');
        if (table) {
          const rows = table.querySelectorAll('tr');
          const headers = Array.from(document.getElementById('reportTableHeader').querySelectorAll('th')).map(th => th.textContent);
          const tableData = [];
          rows.forEach(row => {
            const rowData = {};
            const cells = row.querySelectorAll('td');
            headers.forEach((header, i) => {
              if (cells[i]) {
                rowData[header] = cells[i].textContent.trim();
              }
            });
            tableData.push(rowData);
          });
          doc.autoTable({
            head: [headers],
            body: tableData.map(row => headers.map(header => row[header])),
            startY: yPosition,
            margin: { horizontal: 15 },
            styles: { fontSize: 8 },
            headStyles: { fillColor: [59, 130, 246] }
          });
        }
        doc.save(`relatorio-financeiro-${new Date().toISOString().split('T')[0]}.pdf`);
      });
    } else {
      alert('Biblioteca de PDF não carregada. Não foi possível exportar o relatório.');
    }
  },

  resetAllData: function() {
    if (confirm('Tem certeza que deseja apagar TODOS os dados? Esta ação não pode ser desfeita.')) {
      db.clear();
      db.init();
      alert('Todos os dados foram resetados.');
      const path = window.location.pathname.split('/').pop();
      if (path === 'index.html') {
        FinanceApp.updateDashboard();
      } else if (path === 'transacoes.html') {
        FinanceApp.renderTransactions();
      } else if (path === 'metas.html') {
        FinanceApp.renderGoals();
      } else if (path === 'relatorios.html') {
        // Não precisa atualizar
      } else if (path === 'config.html') {
        FinanceApp.renderCategories();
      }
    }
  },

  renderCharts: function() {
    const transactions = db.load('transactions') || [];
    const categories = db.load('categories') || [];
    const expenses = transactions.filter(t => t.type === 'expense');
    const categoryMap = {};
    categories.forEach(c => {
      categoryMap[c.id] = {
        name: c.name,
        color: c.color,
        total: 0
      };
    });
    expenses.forEach(t => {
      if (categoryMap[t.categoryId]) {
        categoryMap[t.categoryId].total += t.amount;
      }
    });
    const labels = [];
    const data = [];
    const backgroundColors = [];
    Object.values(categoryMap).forEach(c => {
      if (c.total > 0) {
        labels.push(c.name);
        data.push(c.total);
        backgroundColors.push(c.color);
      }
    });
    const ctx = document.getElementById('expenseChart');
    if (ctx) {
      if (ctx.chart) {
        ctx.chart.data.labels = labels;
        ctx.chart.data.datasets[0].data = data;
        ctx.chart.data.datasets[0].backgroundColor = backgroundColors;
        ctx.chart.update();
      } else {
        ctx.chart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: backgroundColors,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom'
              }
            }
          }
        });
      }
    }
  },

  formatCurrency: function(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  },

  updateElement: function(id, content) {
    const element = document.getElementById(id);
    if (element) element.textContent = content;
  },

  openModal: function(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
  },

  closeModal: function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
  },

  start: function() {
    document.addEventListener('DOMContentLoaded', this.init.bind(this));
  }
};

FinanceApp.start();
window.FinanceApp = FinanceApp;
window.openModal = FinanceApp.openModal;
window.closeModal = FinanceApp.closeModal;

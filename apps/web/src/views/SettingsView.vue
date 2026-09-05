<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useReferenceStore } from "../stores/reference";
import { useAuthStore } from "../stores/auth";
import {
  listBudget,
  createBudgetItem,
  patchBudgetItem,
  deleteBudgetItem,
  listSubscriptions,
  createSubscription,
  patchSubscription,
  deleteSubscription,
  createRule,
  deleteRule,
  createCategory,
  patchCategory,
  getTransactionStats,
  clearAllTransactions,
  type BudgetItem,
  type Subscription,
  type Category,
  type CategoryRule,
  type TransactionStats,
} from "../lib/api";
import { useConfirm } from "../composables/useConfirm";
import { useSnackbar } from "../composables/useSnackbar";
import { categoryDisplayName, categoryOptionLabel, categoryPillLabel } from "../lib/categories";

const ref_ = useReferenceStore();
const auth = useAuthStore();
const loading = ref(false);
const confirm = useConfirm();
const snackbar = useSnackbar();
const tab = ref("categorias");

onMounted(async () => {
  loading.value = true;
  try {
    if (!ref_.loaded) await ref_.load();
    hydrateSalaryCycleForm();
    await loadBudget();
    await loadSubscriptions();
  } finally {
    loading.value = false;
  }
});

const budgetRows = ref<BudgetItem[]>([]);
const subscriptionRows = ref<Subscription[]>([]);
const showBudgetDialog = ref(false);
const showSubscriptionDialog = ref(false);
const editingBudget = ref<BudgetItem | null>(null);
const editingSubscription = ref<Subscription | null>(null);
const budgetForm = ref({
  descricao: "",
  categoriaId: null as string | null,
  diaVencimento: null as number | null,
  valorMensal: 0,
  ativo: true,
});
const subscriptionForm = ref({
  nome: "",
  valorMensal: 0,
});
const transactionStats = ref<TransactionStats | null>(null);
const dataStatsLoading = ref(false);
const dataStatsRefreshing = ref(false);
const clearingTransactions = ref(false);
const statsYear = ref(new Date().getFullYear());

const monthCountHeaders = [
  { title: "Mês", key: "label" },
  { title: "Registros", key: "qtd", width: 120, align: "end" as const },
];

const showRuleDialog = ref(false);
const ruleForm = ref({
  categoriaId: null as string | null,
  tipoPadrao: "substring" as "substring" | "regex",
  padrao: "",
  prioridade: 100,
});

const showCategoryDialog = ref(false);
const editingCategory = ref<Category | null>(null);
const categoryForm = ref({
  code: "",
  descricao: "",
  ativa: true,
});
const salaryCycleForm = ref({
  mode: "businessDayOfMonth" as "dayOfMonth" | "businessDayOfMonth",
  dayOfMonth: null as number | null,
  businessDayOrdinal: 5 as number | null,
});

const ruleTypeOptions = [
  { title: "Substring", value: "substring" },
  { title: "Regex", value: "regex" },
];

const salaryPaymentModeOptions = [
  { title: "Dia do mês", value: "dayOfMonth" },
  { title: "Dia útil do mês", value: "businessDayOfMonth" },
];

const categoryHeaders = [
  { title: "Categoria", key: "code" },
  { title: "Descrição", key: "descricao" },
  { title: "Ativa", key: "ativa", width: 90 },
  { title: "", key: "actions", sortable: false, width: 70 },
];

const ruleHeaders = [
  { title: "Prio", key: "prioridade", width: "64px" },
  { title: "Tipo", key: "tipoPadrao", width: "100px" },
  { title: "Padrão", key: "padrao", width: "36%" },
  { title: "Categoria", key: "categoriaId", width: "180px" },
  { title: "Ativa", key: "ativa", width: "80px" },
  { title: "", key: "actions", sortable: false, width: 96, minWidth: "96" },
];

const budgetHeaders = [
  { title: "Dia", key: "diaVencimento", width: 80 },
  { title: "Descrição", key: "descricao", width: 140 },
  { title: "Categoria", key: "categoriaId", width: 130 },
  { title: "Previsto/mês", key: "valorMensal", width: 200 },
  { title: "Ativo", key: "ativo", width: 95 },
  { title: "", key: "actions", sortable: false, width: 100 },
];

const subscriptionHeaders = [
  { title: "Serviço", key: "nome" },
  { title: "Valor", key: "valorMensal", width: 140, align: "end" as const },
  { title: "", key: "actions", sortable: false, width: 96, minWidth: "96" },
];

async function loadBudget() {
  budgetRows.value = await listBudget();
}

async function loadSubscriptions() {
  subscriptionRows.value = await listSubscriptions();
}

async function loadTransactionStats() {
  const initial = transactionStats.value == null;
  if (initial) {
    dataStatsLoading.value = true;
  } else {
    dataStatsRefreshing.value = true;
  }
  try {
    transactionStats.value = await getTransactionStats(statsYear.value);
    statsYear.value = transactionStats.value.year;
  } finally {
    dataStatsLoading.value = false;
    dataStatsRefreshing.value = false;
  }
}

function shiftStatsYear(delta: number) {
  if (dataStatsRefreshing.value) return;
  statsYear.value += delta;
  void loadTransactionStats();
}

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long" });

const monthCountRows = computed(() => {
  if (!transactionStats.value) return [];
  const year = transactionStats.value.year;
  return transactionStats.value.months.map((row) => ({
    ...row,
    label: monthFormatter.format(new Date(year, row.month - 1, 1)),
  }));
});

function confirmClearTransactions() {
  confirm.require({
    message:
      "Esta ação apaga permanentemente todas as transações da sua conta. Não é possível desfazer.",
    header: "Apagar todas as transações?",
    acceptLabel: "Apagar tudo",
    rejectLabel: "Cancelar",
    accept: async () => {
      clearingTransactions.value = true;
      try {
        const result = await clearAllTransactions();
        snackbar.add({
          severity: "success",
          summary: "Transações apagadas",
          detail: `${result.removed} registro(s) removido(s)`,
          life: 1500,
        });
        await loadTransactionStats();
      } catch (err) {
        snackbar.add({
          severity: "error",
          summary: "Erro",
          detail: (err as Error).message,
          life: 3000,
        });
      } finally {
        clearingTransactions.value = false;
      }
    },
  });
}

function isSystemBudget(row: BudgetItem) {
  return row.origem === "assinaturas";
}

function hydrateSalaryCycleForm() {
  const saved = auth.user?.settings.salaryCycle?.paymentDay;
  salaryCycleForm.value = {
    mode: saved?.mode ?? "businessDayOfMonth",
    dayOfMonth: saved?.dayOfMonth ?? null,
    businessDayOrdinal: saved?.businessDayOrdinal ?? 5,
  };
}

const categoryOptions = computed(() =>
  ref_.categories.map((c) => ({ title: categoryOptionLabel(c), value: c.id })),
);

const totalPrevisto = computed(() =>
  budgetRows.value.filter((b) => b.ativo).reduce((s, b) => s + Number(b.valorMensal), 0),
);

const totalAssinaturas = computed(() =>
  subscriptionRows.value.reduce((s, r) => s + Number(r.valorMensal), 0),
);

function fmtMoney(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function openCreateBudget() {
  editingBudget.value = null;
  budgetForm.value = {
    descricao: "",
    categoriaId: null,
    diaVencimento: null,
    valorMensal: 0,
    ativo: true,
  };
  showBudgetDialog.value = true;
}

function openEditBudget(row: BudgetItem) {
  if (isSystemBudget(row)) return;
  editingBudget.value = row;
  budgetForm.value = {
    descricao: row.descricao,
    categoriaId: row.categoriaId,
    diaVencimento: row.diaVencimento,
    valorMensal: Number(row.valorMensal),
    ativo: row.ativo,
  };
  showBudgetDialog.value = true;
}

async function saveBudget() {
  const body = {
    descricao: budgetForm.value.descricao,
    categoriaId: budgetForm.value.categoriaId ?? null,
    diaVencimento: budgetForm.value.diaVencimento ?? null,
    valorMensal: budgetForm.value.valorMensal.toFixed(2),
    ativo: budgetForm.value.ativo,
  };

  try {
    if (editingBudget.value) {
      const updated = await patchBudgetItem(editingBudget.value.id, body);
      const idx = budgetRows.value.findIndex((r) => r.id === updated.id);
      if (idx !== -1) budgetRows.value[idx] = updated;
    } else {
      const created = await createBudgetItem(body);
      budgetRows.value.push(created);
    }
    showBudgetDialog.value = false;
    snackbar.add({ severity: "success", summary: "Salvo", life: 1500 });
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: "Erro",
      detail: (err as Error).message,
      life: 3000,
    });
  }
}

function confirmDeleteBudget(row: BudgetItem) {
  if (isSystemBudget(row)) return;
  confirm.require({
    message: `Excluir "${row.descricao}"?`,
    header: "Confirmar",
    acceptLabel: "Excluir",
    rejectLabel: "Cancelar",
    accept: async () => {
      await deleteBudgetItem(row.id);
      budgetRows.value = budgetRows.value.filter((r) => r.id !== row.id);
      snackbar.add({ severity: "success", summary: "Excluído", life: 1500 });
    },
  });
}

function openCreateSubscription() {
  editingSubscription.value = null;
  subscriptionForm.value = { nome: "", valorMensal: 0 };
  showSubscriptionDialog.value = true;
}

function openEditSubscription(row: Subscription) {
  editingSubscription.value = row;
  subscriptionForm.value = {
    nome: row.nome,
    valorMensal: Number(row.valorMensal),
  };
  showSubscriptionDialog.value = true;
}

async function saveSubscription() {
  const body = {
    nome: subscriptionForm.value.nome.trim(),
    valorMensal: subscriptionForm.value.valorMensal.toFixed(2),
  };
  if (!body.nome) {
    snackbar.add({ severity: "warn", summary: "Informe o serviço", life: 2500 });
    return;
  }
  try {
    if (editingSubscription.value) {
      const updated = await patchSubscription(editingSubscription.value.id, body);
      const idx = subscriptionRows.value.findIndex((r) => r.id === updated.id);
      if (idx !== -1) subscriptionRows.value[idx] = updated;
    } else {
      const created = await createSubscription(body);
      subscriptionRows.value.push(created);
    }
    await loadBudget();
    showSubscriptionDialog.value = false;
    snackbar.add({ severity: "success", summary: "Salvo", life: 1500 });
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: "Erro",
      detail: (err as Error).message,
      life: 3000,
    });
  }
}

function confirmDeleteSubscription(row: Subscription) {
  confirm.require({
    message: `Excluir "${row.nome}"?`,
    header: "Confirmar",
    acceptLabel: "Excluir",
    rejectLabel: "Cancelar",
    accept: async () => {
      await deleteSubscription(row.id);
      subscriptionRows.value = subscriptionRows.value.filter((r) => r.id !== row.id);
      await loadBudget();
      snackbar.add({ severity: "success", summary: "Excluído", life: 1500 });
    },
  });
}

function openCreateRule() {
  ruleForm.value = {
    categoriaId: null,
    tipoPadrao: "substring",
    padrao: "",
    prioridade: 100,
  };
  showRuleDialog.value = true;
}

function confirmDeleteRule(row: CategoryRule) {
  confirm.require({
    message: `Excluir regra "${row.padrao}"?`,
    header: "Confirmar",
    acceptLabel: "Excluir",
    rejectLabel: "Cancelar",
    accept: async () => {
      await deleteRule(row.id);
      await ref_.reloadRules();
      snackbar.add({ severity: "success", summary: "Excluído", life: 1500 });
    },
  });
}

async function saveRule() {
  if (!ruleForm.value.categoriaId || !ruleForm.value.padrao.trim()) {
    snackbar.add({
      severity: "warn",
      summary: "Preencha categoria e padrão",
      life: 2500,
    });
    return;
  }

  try {
    await createRule({
      categoriaId: ruleForm.value.categoriaId,
      tipoPadrao: ruleForm.value.tipoPadrao,
      padrao: ruleForm.value.padrao.trim(),
      prioridade: ruleForm.value.prioridade,
      ativa: true,
    });
    await ref_.reloadRules();
    showRuleDialog.value = false;
    snackbar.add({ severity: "success", summary: "Regra criada", life: 1500 });
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: "Erro",
      detail: (err as Error).message,
      life: 3000,
    });
  }
}

function openCreateCategory() {
  editingCategory.value = null;
  categoryForm.value = {
    code: "",
    descricao: "",
    ativa: true,
  };
  showCategoryDialog.value = true;
}

function openEditCategory(row: Category) {
  editingCategory.value = row;
  categoryForm.value = {
    code: row.code,
    descricao: row.descricao,
    ativa: row.ativa,
  };
  showCategoryDialog.value = true;
}

async function saveCategory() {
  const code = categoryForm.value.code.trim().toUpperCase();
  const body = {
    code,
    descricao: categoryForm.value.descricao.trim(),
    ativa: categoryForm.value.ativa,
  };

  if (!code || !body.descricao) {
    snackbar.add({
      severity: "warn",
      summary: "Preencha os campos obrigatórios",
      life: 2500,
    });
    return;
  }

  try {
    if (editingCategory.value) {
      await patchCategory(editingCategory.value.id, body);
    } else {
      await createCategory(body);
    }
    await ref_.reloadCategories();
    showCategoryDialog.value = false;
    snackbar.add({ severity: "success", summary: "Categoria salva", life: 1500 });
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: "Erro",
      detail: (err as Error).message,
      life: 3000,
    });
  }
}

async function saveSalaryCycle() {
  try {
    await auth.saveSettings({
      salaryCycle: {
        paymentDay: {
          mode: salaryCycleForm.value.mode,
          dayOfMonth: salaryCycleForm.value.dayOfMonth ?? null,
          businessDayOrdinal: salaryCycleForm.value.businessDayOrdinal ?? null,
        },
      },
    });
    snackbar.add({ severity: "success", summary: "Dia de pagamento salvo", life: 1500 });
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: "Erro",
      detail: (err as Error).message,
      life: 3000,
    });
  }
}
</script>

<template>
  <section class="settings-page">
    <v-tabs v-model="tab" class="settings-tabs" color="primary" density="comfortable">
      <v-tab value="categorias">Categorias</v-tab>
      <v-tab value="regras">Regras</v-tab>
      <v-tab value="orcamento">Orçamento</v-tab>
      <v-tab value="assinaturas">Assinaturas</v-tab>
      <v-tab value="preferencias">Preferências</v-tab>
      <v-tab value="dados" @click="loadTransactionStats">Dados</v-tab>
    </v-tabs>

    <v-window v-model="tab" class="settings-window">
      <v-window-item value="categorias">
        <div class="app-panel">
          <div class="table-header">
            <div class="table-title">Categorias disponíveis</div>
            <v-btn
              color="success"
              size="small"
              prepend-icon="mdi-plus"
              @click="openCreateCategory"
            >
              Nova categoria
            </v-btn>
          </div>
          <v-data-table
            :headers="categoryHeaders"
            :items="ref_.categories"
            :loading="loading"
            :items-per-page="-1"
            hide-default-footer
            striped="even"
          >
            <template #item.code="{ item }">
              <div>{{ categoryDisplayName(item.id, ref_.categories) }}</div>
              <small class="category-code">{{ item.code }}</small>
            </template>
            <template #item.ativa="{ item }">
              <v-chip :color="item.ativa ? 'success' : 'default'" size="small">
                {{ item.ativa ? "sim" : "não" }}
              </v-chip>
            </template>
            <template #item.actions="{ item }">
              <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEditCategory(item)" />
            </template>
          </v-data-table>
        </div>
      </v-window-item>

      <v-window-item value="regras">
        <div class="app-panel">
          <div class="table-header">
            <div class="table-title">Regras de categorização</div>
            <v-btn color="success" size="small" prepend-icon="mdi-plus" @click="openCreateRule">
              Nova regra
            </v-btn>
          </div>
          <v-data-table
            class="rules-table"
            :headers="ruleHeaders"
            :items="ref_.rules"
            :loading="loading"
            :items-per-page="-1"
            hide-default-footer
            striped="even"
          >
            <template #item.padrao="{ item }">
              <span class="cell-ellipsis" :title="item.padrao">{{ item.padrao }}</span>
            </template>
            <template #item.categoriaId="{ item }">
              <span
                class="cell-ellipsis"
                :title="categoryDisplayName(item.categoriaId, ref_.categories)"
              >
                {{ categoryDisplayName(item.categoriaId, ref_.categories) }}
              </span>
            </template>
            <template #item.ativa="{ item }">
              <v-chip :color="item.ativa ? 'success' : 'default'" size="small">
                {{ item.ativa ? "sim" : "não" }}
              </v-chip>
            </template>
            <template #item.actions="{ item }">
              <div class="table-actions">
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  color="error"
                  size="small"
                  aria-label="Excluir regra"
                  @click="confirmDeleteRule(item)"
                />
              </div>
            </template>
          </v-data-table>
        </div>
      </v-window-item>

      <v-window-item value="orcamento">
        <div class="app-panel">
          <div class="budget-header">
            <div class="total-previsto">
              Total previsto mensal: <strong>{{ fmtMoney(totalPrevisto) }}</strong>
            </div>
            <v-btn color="success" size="small" prepend-icon="mdi-plus" @click="openCreateBudget">
              Novo item
            </v-btn>
          </div>
          <v-data-table
            :headers="budgetHeaders"
            :items="budgetRows"
            :loading="loading"
            :items-per-page="-1"
            hide-default-footer
            striped="even"
          >
            <template #item.diaVencimento="{ item }">{{ item.diaVencimento ?? "—" }}</template>
            <template #item.descricao="{ item }">
              <span class="cell-ellipsis" :title="item.descricao">{{ item.descricao }}</span>
            </template>
            <template #item.categoriaId="{ item }">
              <span
                class="cell-ellipsis"
                :title="item.categoriaId ? categoryDisplayName(item.categoriaId, ref_.categories) : ''"
              >
                {{ item.categoriaId ? categoryPillLabel(item.categoriaId, ref_.categories) : "—" }}
              </span>
            </template>
            <template #item.valorMensal="{ item }">
              <span class="money-neg">{{ fmtMoney(item.valorMensal) }}</span>
            </template>
            <template #item.ativo="{ item }">
              <v-chip :color="item.ativo ? 'success' : 'default'" size="small">
                {{ item.ativo ? "sim" : "não" }}
              </v-chip>
            </template>
            <template #item.actions="{ item }">
              <v-btn
                icon="mdi-pencil"
                variant="text"
                size="small"
                :disabled="isSystemBudget(item)"
                :title="isSystemBudget(item) ? 'Item sincronizado pelas assinaturas' : 'Editar'"
                @click="openEditBudget(item)"
              />
              <v-btn
                icon="mdi-delete"
                variant="text"
                color="error"
                size="small"
                :disabled="isSystemBudget(item)"
                :title="isSystemBudget(item) ? 'Item sincronizado pelas assinaturas' : 'Excluir'"
                @click="confirmDeleteBudget(item)"
              />
            </template>
          </v-data-table>
        </div>
      </v-window-item>

      <v-window-item value="assinaturas">
        <div class="app-panel">
          <div class="budget-header">
            <div class="total-previsto">
              Total assinaturas: <strong>{{ fmtMoney(totalAssinaturas) }}</strong>
            </div>
            <v-btn color="success" size="small" prepend-icon="mdi-plus" @click="openCreateSubscription">
              Nova assinatura
            </v-btn>
          </div>
          <v-data-table
            class="subscriptions-table"
            :headers="subscriptionHeaders"
            :items="subscriptionRows"
            :loading="loading"
            :items-per-page="-1"
            hide-default-footer
            striped="even"
          >
            <template #item.nome="{ item }">
              <span class="cell-ellipsis" :title="item.nome">{{ item.nome }}</span>
            </template>
            <template #item.valorMensal="{ item }">
              <span class="money-neg">{{ fmtMoney(item.valorMensal) }}</span>
            </template>
            <template #item.actions="{ item }">
              <div class="table-actions">
                <v-btn
                  icon="mdi-pencil"
                  variant="text"
                  size="small"
                  aria-label="Editar assinatura"
                  @click="openEditSubscription(item)"
                />
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  color="error"
                  size="small"
                  aria-label="Excluir assinatura"
                  @click="confirmDeleteSubscription(item)"
                />
              </div>
            </template>
          </v-data-table>
        </div>
      </v-window-item>

      <v-window-item value="dados">
        <div class="app-panel data-panel">
          <div class="app-panel__title">Transações no banco</div>
          <p class="app-panel__copy">
            Estatísticas das linhas de transação armazenadas para sua conta.
          </p>
          <div v-if="dataStatsLoading" class="data-stats-loading">
            <v-progress-circular indeterminate size="24" width="2" />
            <span>Carregando…</span>
          </div>
          <div
            v-else-if="transactionStats"
            class="data-stats-body"
            :class="{ 'data-stats-body--refreshing': dataStatsRefreshing }"
          >
            <div class="data-stats-grid">
              <div class="data-stat">
                <span class="data-stat__label">Registros (total)</span>
                <strong class="data-stat__value">{{ transactionStats.qtd.toLocaleString("pt-BR") }}</strong>
              </div>
              <div class="data-stat">
                <span class="data-stat__label">Registros em {{ statsYear }}</span>
                <strong class="data-stat__value">{{ transactionStats.yearQtd.toLocaleString("pt-BR") }}</strong>
              </div>
              <div class="data-stat">
                <span class="data-stat__label">Saldo total</span>
                <strong class="data-stat__value">{{ fmtMoney(transactionStats.saldo) }}</strong>
              </div>
            </div>
            <div class="data-month-section">
              <div class="data-month-nav">
                <v-btn
                  icon="mdi-chevron-left"
                  variant="text"
                  size="small"
                  aria-label="Ano anterior"
                  :disabled="dataStatsRefreshing"
                  @click="shiftStatsYear(-1)"
                />
                <strong class="data-month-nav__year">{{ statsYear }}</strong>
                <v-btn
                  icon="mdi-chevron-right"
                  variant="text"
                  size="small"
                  aria-label="Próximo ano"
                  :disabled="dataStatsRefreshing"
                  @click="shiftStatsYear(1)"
                />
                <v-progress-circular
                  v-if="dataStatsRefreshing"
                  class="data-month-nav__spinner"
                  indeterminate
                  size="18"
                  width="2"
                />
              </div>
              <v-data-table
                class="month-count-table"
                :headers="monthCountHeaders"
                :items="monthCountRows"
                density="compact"
                :items-per-page="-1"
                hide-default-footer
              >
                <template #item.label="{ item }">
                  <span class="month-count-label">{{ item.label }}</span>
                </template>
                <template #item.qtd="{ item }">
                  <span class="month-count-qtd">{{ item.qtd.toLocaleString("pt-BR") }}</span>
                </template>
              </v-data-table>
            </div>
          </div>
          <div class="data-actions">
            <v-btn
              color="error"
              variant="flat"
              prepend-icon="mdi-delete-alert"
              :loading="clearingTransactions"
              @click="confirmClearTransactions"
            >
              Limpar transações
            </v-btn>
          </div>
        </div>
      </v-window-item>

      <v-window-item value="preferencias">
        <div class="app-panel prefs-panel">
          <div class="app-panel__title">Dia de pagamento</div>
          <p class="app-panel__copy">
            Defina quando seu pagamento cai. O ciclo no painel será calculado entre o último e o próximo pagamento.
          </p>
          <div class="salary-cycle-grid">
            <div class="form-col">
              <label>Como o pagamento acontece</label>
              <v-select
                v-model="salaryCycleForm.mode"
                :items="salaryPaymentModeOptions"
                item-title="title"
                item-value="value"
              />
            </div>
            <div v-if="salaryCycleForm.mode === 'dayOfMonth'" class="form-col">
              <label>Dia do pagamento</label>
              <v-number-input
                v-model="salaryCycleForm.dayOfMonth"
                placeholder="ex: 1"
                control-variant="hidden"
              />
            </div>
            <div v-else class="form-col">
              <label>Qual dia útil do mês</label>
              <v-number-input
                v-model="salaryCycleForm.businessDayOrdinal"
                placeholder="ex: 5"
                control-variant="hidden"
              />
            </div>
          </div>
          <div class="prefs-actions">
            <v-btn color="primary" prepend-icon="mdi-check" @click="saveSalaryCycle">
              Salvar dia de pagamento
            </v-btn>
          </div>
        </div>
      </v-window-item>
    </v-window>

    <!-- Budget dialog -->
    <v-dialog v-model="showBudgetDialog" max-width="420">
      <v-card :title="editingBudget ? 'Editar item' : 'Novo item de orçamento'">
        <v-card-text class="form-col">
          <label>Descrição</label>
          <v-text-field v-model="budgetForm.descricao" />
          <label>Categoria (opcional)</label>
          <v-autocomplete
            v-model="budgetForm.categoriaId"
            :items="categoryOptions"
            item-title="title"
            item-value="value"
            clearable
            placeholder="Nenhuma"
          />
          <label>Dia de vencimento (opcional)</label>
          <v-number-input
            v-model="budgetForm.diaVencimento"
            :min="1"
            :max="31"
            placeholder="ex: 15"
            control-variant="hidden"
          />
          <label>Valor mensal previsto (R$)</label>
          <v-number-input
            v-model="budgetForm.valorMensal"
            :precision="2"
            control-variant="hidden"
          />
          <v-checkbox v-model="budgetForm.ativo" label="Ativo" hide-details />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="outlined" @click="showBudgetDialog = false">Cancelar</v-btn>
          <v-btn color="primary" prepend-icon="mdi-check" @click="saveBudget">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Subscription dialog -->
    <v-dialog v-model="showSubscriptionDialog" max-width="420">
      <v-card :title="editingSubscription ? 'Editar assinatura' : 'Nova assinatura'">
        <v-card-text class="form-col">
          <label>Serviço</label>
          <v-text-field v-model="subscriptionForm.nome" />
          <label>Valor mensal (R$)</label>
          <v-number-input
            v-model="subscriptionForm.valorMensal"
            :precision="2"
            control-variant="hidden"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="outlined" @click="showSubscriptionDialog = false">Cancelar</v-btn>
          <v-btn color="primary" prepend-icon="mdi-check" @click="saveSubscription">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Category dialog -->
    <v-dialog v-model="showCategoryDialog" max-width="420">
      <v-card :title="editingCategory ? 'Editar categoria' : 'Nova categoria'">
        <v-card-text class="form-col">
          <label>Código da categoria</label>
          <v-text-field
            v-model="categoryForm.code"
            placeholder="ex: CASA DE PAO"
          />
          <label>Descrição</label>
          <v-text-field v-model="categoryForm.descricao" placeholder="Nome exibido nas telas" />
          <v-checkbox v-model="categoryForm.ativa" label="Ativa" hide-details />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="outlined" @click="showCategoryDialog = false">Cancelar</v-btn>
          <v-btn color="primary" prepend-icon="mdi-check" @click="saveCategory">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Rule dialog -->
    <v-dialog v-model="showRuleDialog" max-width="460">
      <v-card title="Nova regra">
        <v-card-text class="form-col">
          <label>Categoria</label>
          <v-autocomplete
            v-model="ruleForm.categoriaId"
            :items="categoryOptions"
            item-title="title"
            item-value="value"
            placeholder="Selecione"
          />
          <label>Tipo</label>
          <v-select
            v-model="ruleForm.tipoPadrao"
            :items="ruleTypeOptions"
            item-title="title"
            item-value="value"
          />
          <label>Padrão</label>
          <v-text-field
            v-model="ruleForm.padrao"
            placeholder="ex: CASA DE PAO BETHELEM L"
            @keydown.enter.prevent="saveRule"
          />
          <label>Prioridade</label>
          <v-number-input
            v-model="ruleForm.prioridade"
            :min="1"
            :max="9999"
            control-variant="hidden"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="outlined" @click="showRuleDialog = false">Cancelar</v-btn>
          <v-btn color="primary" prepend-icon="mdi-check" @click="saveRule">Salvar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<style scoped>
.settings-page {
  height: 100%;
  overflow-y: auto;
  padding: 1rem 1.5rem 2rem;
}

.settings-tabs {
  margin: 0 -0.25rem;
  border-bottom: 1px solid var(--app-border);
}

.settings-tabs :deep(.v-slide-group__content) {
  gap: 0.15rem;
}

.settings-tabs :deep(.v-tab) {
  min-height: 42px;
  padding: 0 1rem;
  border-radius: 8px 8px 0 0;
  font-size: 0.82rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  text-transform: none;
  color: var(--app-text-muted) !important;
  opacity: 1;
}

.settings-tabs :deep(.v-tab:hover) {
  color: var(--app-text) !important;
  background: rgba(30, 90, 168, 0.05);
}

.settings-tabs :deep(.v-tab--selected) {
  color: var(--app-primary) !important;
  font-weight: 600;
  background: var(--app-primary-wash);
}

.settings-tabs :deep(.v-tab__slider) {
  height: 3px;
  border-radius: 2px 2px 0 0;
  background: var(--app-primary) !important;
  color: var(--app-primary) !important;
}

.settings-window {
  padding-top: 1rem;
}

.budget-header,
.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.table-title,
.total-previsto {
  font-size: 0.9rem;
  opacity: 0.8;
}

.category-code {
  opacity: 0.6;
}

.form-col {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-col label {
  font-size: 0.78rem;
  opacity: 0.7;
  margin-top: 0.25rem;
}

.prefs-panel,
.data-panel {
  max-width: 720px;
}

.data-stats-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1rem 0;
  font-size: 0.9rem;
  opacity: 0.75;
}

.data-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin: 1rem 0 1.25rem;
}

.data-stats-body--refreshing {
  opacity: 0.65;
  pointer-events: none;
}

.data-month-section {
  margin-bottom: 1.25rem;
}

.data-month-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

.data-month-nav__spinner {
  margin-left: 0.25rem;
}

.data-month-nav__year {
  min-width: 4rem;
  text-align: center;
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
}

.month-count-table :deep(table) {
  table-layout: fixed;
  width: 100%;
}

.month-count-label {
  text-transform: capitalize;
}

.month-count-qtd {
  font-variant-numeric: tabular-nums;
}

.data-stat {
  padding: 1rem 1.1rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-surface);
  background: var(--app-surface-muted, #f8fafc);
}

.data-stat__label {
  display: block;
  font-size: 0.78rem;
  opacity: 0.7;
  margin-bottom: 0.35rem;
}

.data-stat__value {
  font-size: 1.35rem;
  font-variant-numeric: tabular-nums;
}

.data-actions {
  margin-top: 0.5rem;
}

.salary-cycle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.prefs-actions {
  margin-top: 1rem;
}

.cell-ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.table-actions {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  white-space: nowrap;
}

.subscriptions-table :deep(th:last-child),
.subscriptions-table :deep(td:last-child) {
  width: 96px;
  min-width: 96px;
  max-width: 96px;
  white-space: nowrap;
}

.subscriptions-table :deep(th:nth-last-child(2)),
.subscriptions-table :deep(td:nth-last-child(2)) {
  width: 140px;
  min-width: 140px;
  white-space: nowrap;
}

.rules-table :deep(.v-table__wrapper) {
  overflow-x: auto;
}

.rules-table :deep(table) {
  table-layout: fixed;
  width: 100%;
}

.rules-table :deep(th:nth-child(1)),
.rules-table :deep(td:nth-child(1)) {
  width: 64px !important;
  white-space: nowrap;
}

.rules-table :deep(th:nth-child(2)),
.rules-table :deep(td:nth-child(2)) {
  width: 100px !important;
  white-space: nowrap;
}

.rules-table :deep(th:nth-child(3)),
.rules-table :deep(td:nth-child(3)) {
  width: 40% !important;
  max-width: 360px;
}

.rules-table :deep(th:nth-child(3) .cell-ellipsis),
.rules-table :deep(td:nth-child(3) .cell-ellipsis) {
  max-width: 360px;
}

.rules-table :deep(th:nth-child(4)),
.rules-table :deep(td:nth-child(4)) {
  width: 180px !important;
}

.rules-table :deep(th:nth-child(5)),
.rules-table :deep(td:nth-child(5)) {
  width: 80px !important;
  white-space: nowrap;
}

.rules-table :deep(th:nth-child(6)),
.rules-table :deep(td:nth-child(6)) {
  width: 96px !important;
  min-width: 96px !important;
  white-space: nowrap;
}
</style>

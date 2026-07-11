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
  createCategory,
  patchCategory,
  type BudgetItem,
  type Subscription,
  type Category,
} from "../lib/api";
import { useConfirm } from "../composables/useConfirm";
import { useSnackbar } from "../composables/useSnackbar";
import { categoryDisplayName, categoryOptionLabel } from "../lib/categories";

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
  { title: "Prio", key: "prioridade", width: 70 },
  { title: "Tipo", key: "tipoPadrao", width: 110 },
  { title: "Padrão", key: "padrao" },
  { title: "Categoria", key: "categoriaId", width: 180 },
  { title: "Ativa", key: "ativa", width: 90 },
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
  { title: "Valor", key: "valorMensal", width: 160 },
  { title: "", key: "actions", sortable: false, width: 100 },
];

async function loadBudget() {
  budgetRows.value = await listBudget();
}

async function loadSubscriptions() {
  subscriptionRows.value = await listSubscriptions();
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
    <v-tabs v-model="tab" color="primary">
      <v-tab value="categorias">Categorias</v-tab>
      <v-tab value="regras">Regras</v-tab>
      <v-tab value="orcamento">Orçamento</v-tab>
      <v-tab value="assinaturas">Assinaturas</v-tab>
      <v-tab value="preferencias">Preferências</v-tab>
    </v-tabs>

    <v-window v-model="tab" class="settings-window">
      <v-window-item value="categorias">
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
      </v-window-item>

      <v-window-item value="regras">
        <div class="table-header">
          <div class="table-title">Regras de categorização</div>
          <v-btn color="success" size="small" prepend-icon="mdi-plus" @click="openCreateRule">
            Nova regra
          </v-btn>
        </div>
        <v-data-table
          :headers="ruleHeaders"
          :items="ref_.rules"
          :loading="loading"
          :items-per-page="-1"
          hide-default-footer
          striped="even"
        >
          <template #item.categoriaId="{ item }">
            {{ categoryDisplayName(item.categoriaId, ref_.categories) }}
          </template>
          <template #item.ativa="{ item }">
            <v-chip :color="item.ativa ? 'success' : 'default'" size="small">
              {{ item.ativa ? "sim" : "não" }}
            </v-chip>
          </template>
        </v-data-table>
      </v-window-item>

      <v-window-item value="orcamento">
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
              {{ item.categoriaId ? categoryDisplayName(item.categoriaId, ref_.categories) : "—" }}
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
      </v-window-item>

      <v-window-item value="assinaturas">
        <div class="budget-header">
          <div class="total-previsto">
            Total assinaturas: <strong>{{ fmtMoney(totalAssinaturas) }}</strong>
          </div>
          <v-btn color="success" size="small" prepend-icon="mdi-plus" @click="openCreateSubscription">
            Nova assinatura
          </v-btn>
        </div>
        <v-data-table
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
            <v-btn icon="mdi-pencil" variant="text" size="small" @click="openEditSubscription(item)" />
            <v-btn
              icon="mdi-delete"
              variant="text"
              color="error"
              size="small"
              @click="confirmDeleteSubscription(item)"
            />
          </template>
        </v-data-table>
      </v-window-item>

      <v-window-item value="preferencias">
        <div class="prefs-card">
          <div class="table-title">Dia de pagamento</div>
          <p class="prefs-copy">
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

.prefs-card {
  max-width: 720px;
}

.prefs-copy {
  margin: 0 0 1rem;
  opacity: 0.75;
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
</style>

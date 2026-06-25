<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import TabView from "primevue/tabview";
import TabPanel from "primevue/tabpanel";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";
import Dialog from "primevue/dialog";
import Checkbox from "primevue/checkbox";
import { useReferenceStore } from "../stores/reference";
import { useAuthStore } from "../stores/auth";
import {
  listBudget,
  createBudgetItem,
  patchBudgetItem,
  deleteBudgetItem,
  createRule,
  createCategory,
  patchCategory,
  type BudgetItem,
  type Category,
} from "../lib/api";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { categoryDisplayName, categoryOptionLabel } from "../lib/categories";

const ref_ = useReferenceStore();
const auth = useAuthStore();
const loading = ref(false);
const confirm = useConfirm();
const toast = useToast();

onMounted(async () => {
  loading.value = true;
  try {
    if (!ref_.loaded) await ref_.load();
    hydrateSalaryCycleForm();
    await loadBudget();
  } finally {
    loading.value = false;
  }
});

const budgetRows = ref<BudgetItem[]>([]);
const showBudgetDialog = ref(false);
const editingBudget = ref<BudgetItem | null>(null);
const budgetForm = ref({
  descricao: "",
  categoriaId: null as string | null,
  diaVencimento: null as number | null,
  valorMensal: 0,
  ativo: true,
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
  id: "",
  descricao: "",
  ativa: true,
});
const salaryCycleForm = ref({
  startDay: null as number | null,
  endDay: null as number | null,
});

const ruleTypeOptions = [
  { label: "Substring", value: "substring" },
  { label: "Regex", value: "regex" },
];

async function loadBudget() {
  budgetRows.value = await listBudget();
}

function hydrateSalaryCycleForm() {
  salaryCycleForm.value = {
    startDay: auth.user?.settings.salaryCycle?.startDay ?? null,
    endDay: auth.user?.settings.salaryCycle?.endDay ?? null,
  };
}

const categoryOptions = computed(() =>
  ref_.categories.map((c) => ({ label: categoryOptionLabel(c), value: c.id })),
);

const totalPrevisto = computed(() =>
  budgetRows.value.filter((b) => b.ativo).reduce((s, b) => s + Number(b.valorMensal), 0),
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
    toast.add({ severity: "success", summary: "Salvo", life: 1500 });
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Erro",
      detail: (err as Error).message,
      life: 3000,
    });
  }
}

function confirmDeleteBudget(row: BudgetItem) {
  confirm.require({
    message: `Excluir "${row.descricao}"?`,
    header: "Confirmar",
    icon: "pi pi-exclamation-triangle",
    acceptLabel: "Excluir",
    rejectLabel: "Cancelar",
    acceptProps: { severity: "danger" },
    accept: async () => {
      await deleteBudgetItem(row.id);
      budgetRows.value = budgetRows.value.filter((r) => r.id !== row.id);
      toast.add({ severity: "success", summary: "Excluído", life: 1500 });
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
    toast.add({
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
    toast.add({ severity: "success", summary: "Regra criada", life: 1500 });
  } catch (err) {
    toast.add({
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
    id: "",
    descricao: "",
    ativa: true,
  };
  showCategoryDialog.value = true;
}

function openEditCategory(row: Category) {
  editingCategory.value = row;
  categoryForm.value = {
    id: row.id,
    descricao: row.descricao,
    ativa: row.ativa,
  };
  showCategoryDialog.value = true;
}

async function saveCategory() {
  const body = {
    descricao: categoryForm.value.descricao.trim(),
    ativa: categoryForm.value.ativa,
  };

  if (!categoryForm.value.id.trim() || !body.descricao) {
    toast.add({
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
      await createCategory({
        id: categoryForm.value.id.trim().toUpperCase(),
        ...body,
      });
    }
    await ref_.reloadCategories();
    showCategoryDialog.value = false;
    toast.add({ severity: "success", summary: "Categoria salva", life: 1500 });
  } catch (err) {
    toast.add({
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
        startDay: salaryCycleForm.value.startDay ?? null,
        endDay: salaryCycleForm.value.endDay ?? null,
      },
    });
    toast.add({ severity: "success", summary: "Ciclo salarial salvo", life: 1500 });
  } catch (err) {
    toast.add({
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
    <TabView>
      <TabPanel header="Categorias" value="categorias">
        <div class="table-header">
          <div class="table-title">Categorias disponíveis</div>
          <Button
            label="Nova categoria"
            icon="pi pi-plus"
            severity="success"
            size="small"
            @click="openCreateCategory"
          />
        </div>

        <DataTable :value="ref_.categories" :loading="loading" size="small" stripedRows>
          <Column field="id" header="Categoria">
            <template #body="{ data }">
              <div>{{ categoryDisplayName(data.id) }}</div>
              <small class="category-code">{{ data.id }}</small>
            </template>
          </Column>
          <Column field="descricao" header="Descrição" />
          <Column field="ativa" header="Ativa" :style="{ width: '90px' }">
            <template #body="{ data }">
              <Tag :severity="data.ativa ? 'success' : 'secondary'" :value="data.ativa ? 'sim' : 'não'" />
            </template>
          </Column>
          <Column header="" :style="{ width: '70px' }">
            <template #body="{ data }">
              <div class="icon-actions">
                <Button icon="pi pi-pencil" text rounded size="small" @click="openEditCategory(data)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </TabPanel>

      <TabPanel header="Regras" value="regras">
        <div class="table-header">
          <div class="table-title">Regras de categorização</div>
          <Button
            label="Nova regra"
            icon="pi pi-plus"
            severity="success"
            size="small"
            @click="openCreateRule"
          />
        </div>

        <DataTable :value="ref_.rules" :loading="loading" size="small" stripedRows>
          <Column field="prioridade" header="Prio" :style="{ width: '70px' }" />
          <Column field="tipoPadrao" header="Tipo" :style="{ width: '110px' }" />
          <Column field="padrao" header="Padrão" />
          <Column field="categoriaId" header="Categoria" :style="{ width: '180px' }">
            <template #body="{ data }">{{ categoryDisplayName(data.categoriaId) }}</template>
          </Column>
          <Column field="ativa" header="Ativa" :style="{ width: '90px' }">
            <template #body="{ data }">
              <Tag :severity="data.ativa ? 'success' : 'secondary'" :value="data.ativa ? 'sim' : 'não'" />
            </template>
          </Column>
        </DataTable>
      </TabPanel>

      <TabPanel header="Orçamento" value="orcamento">
        <div class="budget-header">
          <div class="total-previsto">
            Total previsto mensal: <strong>{{ fmtMoney(totalPrevisto) }}</strong>
          </div>
          <Button
            label="Novo item"
            icon="pi pi-plus"
            severity="success"
            size="small"
            @click="openCreateBudget"
          />
        </div>

        <DataTable :value="budgetRows" :loading="loading" size="small" stripedRows>
          <Column field="diaVencimento" header="Dia" :style="{ width: '60px' }">
            <template #body="{ data }">{{ data.diaVencimento ?? "—" }}</template>
          </Column>
          <Column field="descricao" header="Descrição" />
          <Column field="categoriaId" header="Categoria">
            <template #body="{ data }">
              {{ data.categoriaId ? categoryDisplayName(data.categoriaId) : "—" }}
            </template>
          </Column>
          <Column field="valorMensal" header="Previsto/mês" :style="{ width: '150px' }">
            <template #body="{ data }">
              <span class="money-neg">{{ fmtMoney(data.valorMensal) }}</span>
            </template>
          </Column>
          <Column field="ativo" header="Ativo" :style="{ width: '80px' }">
            <template #body="{ data }">
              <Tag :severity="data.ativo ? 'success' : 'secondary'" :value="data.ativo ? 'sim' : 'não'" />
            </template>
          </Column>
          <Column header="" :style="{ width: '80px' }">
            <template #body="{ data }">
              <div class="icon-actions">
                <Button icon="pi pi-pencil" text rounded size="small" @click="openEditBudget(data)" />
                <Button
                  icon="pi pi-trash"
                  text
                  rounded
                  size="small"
                  severity="danger"
                  @click="confirmDeleteBudget(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </TabPanel>

      <TabPanel header="Preferências" value="preferencias">
        <div class="prefs-card">
          <div class="table-title">Ciclo salarial</div>
          <p class="prefs-copy">
            Defina o dia inicial e o dia final usados no card de ciclo salarial do painel.
          </p>

          <div class="salary-cycle-grid">
            <div class="form-col">
              <label>Dia inicial</label>
              <InputNumber
                v-model="salaryCycleForm.startDay"
                placeholder="ex: 21"
                fluid
              />
            </div>

            <div class="form-col">
              <label>Dia final</label>
              <InputNumber
                v-model="salaryCycleForm.endDay"
                placeholder="ex: 20"
                fluid
              />
            </div>
          </div>

          <div class="prefs-actions">
            <Button label="Salvar ciclo salarial" icon="pi pi-check" @click="saveSalaryCycle" />
          </div>
        </div>
      </TabPanel>
    </TabView>

    <Dialog
      v-model:visible="showBudgetDialog"
      :header="editingBudget ? 'Editar item' : 'Novo item de orçamento'"
      modal
      :style="{ width: '420px' }"
    >
      <div class="form-col">
        <label>Descrição</label>
        <InputText v-model="budgetForm.descricao" fluid />

        <label>Categoria (opcional)</label>
        <Select
          v-model="budgetForm.categoriaId"
          :options="categoryOptions"
          optionLabel="label"
          optionValue="value"
          showClear
          filter
          placeholder="Nenhuma"
          fluid
        />

        <label>Dia de vencimento (opcional)</label>
        <InputNumber
          v-model="budgetForm.diaVencimento"
          :min="1"
          :max="31"
          placeholder="ex: 15"
          fluid
        />

        <label>Valor mensal previsto (R$)</label>
        <InputNumber
          v-model="budgetForm.valorMensal"
          mode="decimal"
          locale="pt-BR"
          :minFractionDigits="2"
          :maxFractionDigits="2"
          fluid
        />

        <div class="checkbox-row">
          <Checkbox v-model="budgetForm.ativo" binary inputId="budget-ativo" />
          <label for="budget-ativo">Ativo</label>
        </div>
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" outlined @click="showBudgetDialog = false" />
        <Button label="Salvar" icon="pi pi-check" @click="saveBudget" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showCategoryDialog"
      :header="editingCategory ? 'Editar categoria' : 'Nova categoria'"
      modal
      :style="{ width: '420px' }"
    >
      <div class="form-col">
        <label>ID da categoria</label>
        <InputText
          v-model="categoryForm.id"
          :disabled="!!editingCategory"
          placeholder="ex: CASA DE PAO"
          fluid
        />

        <label>Descrição</label>
        <InputText
          v-model="categoryForm.descricao"
          placeholder="Nome exibido nas telas"
          fluid
        />

        <div class="checkbox-row">
          <Checkbox v-model="categoryForm.ativa" binary inputId="category-ativa" />
          <label for="category-ativa">Ativa</label>
        </div>
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" outlined @click="showCategoryDialog = false" />
        <Button label="Salvar" icon="pi pi-check" @click="saveCategory" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showRuleDialog"
      header="Nova regra"
      modal
      :style="{ width: '460px' }"
    >
      <div class="form-col">
        <label>Categoria</label>
        <Select
          v-model="ruleForm.categoriaId"
          :options="categoryOptions"
          optionLabel="label"
          optionValue="value"
          filter
          placeholder="Selecione"
          fluid
        />

        <label>Tipo</label>
        <Select
          v-model="ruleForm.tipoPadrao"
          :options="ruleTypeOptions"
          optionLabel="label"
          optionValue="value"
          fluid
        />

        <label>Padrão</label>
        <InputText
          v-model="ruleForm.padrao"
          placeholder="ex: CASA DE PAO BETHELEM L"
          fluid
          @keydown.enter.prevent="saveRule"
        />

        <label>Prioridade</label>
        <InputNumber
          v-model="ruleForm.prioridade"
          :min="1"
          :max="9999"
          fluid
        />
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" outlined @click="showRuleDialog = false" />
        <Button label="Salvar" icon="pi pi-check" @click="saveRule" />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.settings-page {
  height: 100%;
  overflow-y: auto;
  padding: 1rem 1.5rem 2rem;
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

.icon-actions {
  display: flex;
  gap: 0.25rem;
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

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.35rem;
}

.checkbox-row label {
  margin-top: 0;
  opacity: 0.9;
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
</style>

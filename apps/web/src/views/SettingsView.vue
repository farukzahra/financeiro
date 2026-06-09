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
import { useReferenceStore } from "../stores/reference";
import {
  listBudget,
  createBudgetItem,
  patchBudgetItem,
  deleteBudgetItem,
  type BudgetItem,
} from "../lib/api";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";

const ref_ = useReferenceStore();
const loading = ref(false);
const confirm = useConfirm();
const toast = useToast();

onMounted(async () => {
  loading.value = true;
  try {
    if (!ref_.loaded) await ref_.load();
    await loadBudget();
  } finally {
    loading.value = false;
  }
});

// ----- Budget -----
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

async function loadBudget() {
  budgetRows.value = await listBudget();
}

const categoryOptions = computed(() =>
  ref_.categories.map((c) => ({ label: `${c.letra} - ${c.id}`, value: c.id })),
);

const totalPrevisto = computed(() =>
  budgetRows.value.filter((b) => b.ativo).reduce((s, b) => s + Number(b.valorMensal), 0),
);

function fmtMoney(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function openCreate() {
  editingBudget.value = null;
  budgetForm.value = { descricao: "", categoriaId: null, diaVencimento: null, valorMensal: 0, ativo: true };
  showBudgetDialog.value = true;
}

function openEdit(row: BudgetItem) {
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
    toast.add({ severity: "error", summary: "Erro", detail: (err as Error).message, life: 3000 });
  }
}

function confirmDelete(row: BudgetItem) {
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
      toast.add({ severity: "success", summary: "Excluido", life: 1500 });
    },
  });
}
</script>

<template>
  <section>
    <h2>Configuracoes</h2>
    <TabView>
      <TabPanel header="Orcamento">
        <div class="budget-header">
          <div class="total-previsto">
            Total previsto mensal: <strong>{{ fmtMoney(totalPrevisto) }}</strong>
          </div>
          <Button label="Novo item" icon="pi pi-plus" severity="success" size="small" @click="openCreate" />
        </div>
        <DataTable :value="budgetRows" :loading="loading" size="small" stripedRows>
          <Column field="diaVencimento" header="Dia" :style="{ width: '60px' }">
            <template #body="{ data }">{{ data.diaVencimento ?? "—" }}</template>
          </Column>
          <Column field="descricao" header="Descricao" />
          <Column field="categoriaId" header="Categoria">
            <template #body="{ data }">{{ data.categoriaId ?? "—" }}</template>
          </Column>
          <Column field="valorMensal" header="Previsto/mes" :style="{ width: '150px' }">
            <template #body="{ data }">
              <span class="money-neg">{{ fmtMoney(data.valorMensal) }}</span>
            </template>
          </Column>
          <Column field="ativo" header="Ativo" :style="{ width: '80px' }">
            <template #body="{ data }">
              <Tag :severity="data.ativo ? 'success' : 'secondary'" :value="data.ativo ? 'sim' : 'nao'" />
            </template>
          </Column>
          <Column header="" :style="{ width: '80px' }">
            <template #body="{ data }">
              <div style="display:flex;gap:0.25rem">
                <Button icon="pi pi-pencil" text rounded size="small" @click="openEdit(data)" />
                <Button icon="pi pi-trash" text rounded size="small" severity="danger" @click="confirmDelete(data)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </TabPanel>

      <TabPanel header="Categorias">
        <DataTable :value="ref_.categories" :loading="loading" size="small" stripedRows>
          <Column field="id" header="Id" />
          <Column field="letra" header="Letra" />
          <Column field="descricao" header="Descricao" />
          <Column field="ativa" header="Ativa">
            <template #body="{ data }">
              <Tag :severity="data.ativa ? 'success' : 'secondary'" :value="data.ativa ? 'sim' : 'nao'" />
            </template>
          </Column>
        </DataTable>
      </TabPanel>

      <TabPanel header="Regras">
        <DataTable :value="ref_.rules" :loading="loading" size="small" stripedRows>
          <Column field="prioridade" header="Prio" :style="{ width: '70px' }" />
          <Column field="tipoPadrao" header="Tipo" :style="{ width: '110px' }" />
          <Column field="padrao" header="Padrao" />
          <Column field="categoriaId" header="Categoria" :style="{ width: '180px' }" />
          <Column field="ativa" header="Ativa" :style="{ width: '90px' }">
            <template #body="{ data }">
              <Tag :severity="data.ativa ? 'success' : 'secondary'" :value="data.ativa ? 'sim' : 'nao'" />
            </template>
          </Column>
        </DataTable>
      </TabPanel>
    </TabView>

    <Dialog
      v-model:visible="showBudgetDialog"
      :header="editingBudget ? 'Editar item' : 'Novo item de orcamento'"
      modal
      :style="{ width: '420px' }"
    >
      <div class="form-col">
        <label>Descricao</label>
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
      </div>

      <template #footer>
        <Button label="Cancelar" severity="secondary" outlined @click="showBudgetDialog = false" />
        <Button label="Salvar" icon="pi pi-check" @click="saveBudget" />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.budget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.total-previsto {
  font-size: 0.9rem;
  opacity: 0.8;
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
</style>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from "vue";
import Button from "primevue/button";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import DatePicker from "primevue/datepicker";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useReferenceStore } from "../stores/reference";
import {
  listTransactions,
  patchTransaction,
  deleteTransaction,
  listBudget,
  patchBudgetItem,
  type Transaction,
  type BudgetItem,
} from "../lib/api";
import { fmtMoneyBR, fmtDateBR, classMoney } from "../lib/format";
import ImportModal from "../components/ImportModal.vue";
import ManualTransactionModal from "../components/ManualTransactionModal.vue";

const ref_ = useReferenceStore();
const toast = useToast();
const confirm = useConfirm();

const rows = ref<Transaction[]>([]);
const resumo = ref({
  totalEntradas: "0",
  totalSaidas: "0",
  saldo: "0",
  qtd: 0,
});
const loading = ref(false);

const period = ref<Date[] | null>(null);
const selectedCategories = ref<string[]>([]);
const search = ref("");
const showImport = ref(false);
const showManual = ref(false);

type ActivityPanel = "filters" | "cats" | "budget" | null;
function loadActivePanel(): ActivityPanel {
  const v = localStorage.getItem("tx.activePanel");
  if (v === "filters" || v === "cats" || v === "budget") return v;
  if (v === "" || v === "null") return null;
  return "filters";
}
const activePanel = ref<ActivityPanel>(loadActivePanel());

const budgetItems = ref<BudgetItem[]>([]);
async function loadBudgetItems() {
  try { budgetItems.value = await listBudget(); } catch { /* ignore */ }
}

const totalPrevisto = computed(() =>
  budgetItems.value.filter((b) => b.ativo).reduce((s, b) => s + Number(b.valorMensal), 0),
);
const saldoLiquido = computed(() =>
  Number(resumo.value.saldo) - totalPrevisto.value,
);

const budgetByCategoria = computed(() => {
  const m = new Map<string, number>();
  for (const b of budgetItems.value) {
    if (b.ativo && b.categoriaId) {
      m.set(b.categoriaId, (m.get(b.categoriaId) ?? 0) + Number(b.valorMensal));
    }
  }
  return m;
});
function togglePanel(p: Exclude<ActivityPanel, null>) {
  activePanel.value = activePanel.value === p ? null : p;
  localStorage.setItem("tx.activePanel", activePanel.value ?? "");
}

function toIso(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function load() {
  loading.value = true;
  try {
    const r = await listTransactions({
      from: toIso(period.value?.[0]),
      to: toIso(period.value?.[1]),
      category: selectedCategories.value.length ? selectedCategories.value : undefined,
      q: search.value || undefined,
    });
    rows.value = r.itens;
    resumo.value = r.resumo;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (!ref_.loaded) await ref_.load();
  await Promise.all([load(), loadBudgetItems()]);
});

function clearPeriod() {
  period.value = null;
}

function limparFiltros() {
  period.value = null;
  selectedCategories.value = [];
  search.value = "";
  load();
}

const hasFilter = computed(
  () =>
    (!!period.value && (!!period.value[0] || !!period.value[1])) ||
    selectedCategories.value.length > 0 ||
    search.value.trim().length > 0,
);

async function onEditField(
  row: Transaction,
  field: "categoriaId" | "detalhe" | "observacao" | "data" | "tipo" | "valor",
  value: unknown,
) {
  try {
    const updated = await patchTransaction(row.identificador, { [field]: value as never });
    Object.assign(row, updated);
    toast.add({ severity: "success", summary: "Atualizado", life: 1500 });
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Erro ao salvar",
      detail: (err as Error).message,
      life: 3000,
    });
  }
}

function onDelete(row: Transaction) {
  confirm.require({
    message: `Excluir esta transacao? (${row.detalhe || row.tipo})`,
    header: "Confirmar exclusao",
    icon: "pi pi-exclamation-triangle",
    acceptLabel: "Excluir",
    rejectLabel: "Cancelar",
    acceptProps: { severity: "danger" },
    accept: async () => {
      try {
        await deleteTransaction(row.identificador);
        rows.value = rows.value.filter((r) => r.identificador !== row.identificador);
        const v = Number(row.valor);
        if (v > 0) {
          resumo.value.totalEntradas = (Number(resumo.value.totalEntradas) - v).toFixed(2);
        } else if (v < 0) {
          resumo.value.totalSaidas = (Number(resumo.value.totalSaidas) - v).toFixed(2);
        }
        resumo.value.saldo = (
          Number(resumo.value.totalEntradas) + Number(resumo.value.totalSaidas)
        ).toFixed(2);
        resumo.value.qtd -= 1;
        toast.add({ severity: "success", summary: "Excluida", life: 1500 });
      } catch (err) {
        toast.add({
          severity: "error",
          summary: "Erro ao excluir",
          detail: (err as Error).message,
          life: 3000,
        });
      }
    },
  });
}

function onImportFinished(stats: { totalImportadas: number; totalDuplicadas: number }) {
  toast.add({
    severity: "success",
    summary: "Importado",
    detail: `${stats.totalImportadas} novas, ${stats.totalDuplicadas} duplicadas`,
    life: 3000,
  });
  load();
}

function onManualCreated() {
  load();
}

const categoryOptions = computed(() => ref_.categoryOptions);

type CategoriaResumo = {
  id: string;
  letra: string;
  qtd: number;
  total: number;
};

const categoriasResumo = computed<CategoriaResumo[]>(() => {
  const map = new Map<string, CategoriaResumo>();
  const letras = new Map(ref_.categories.map((c) => [c.id, c.letra]));
  for (const r of rows.value) {
    const cur = map.get(r.categoriaId) ?? {
      id: r.categoriaId,
      letra: letras.get(r.categoriaId) ?? "?",
      qtd: 0,
      total: 0,
    };
    cur.qtd += 1;
    cur.total += Number(r.valor);
    map.set(r.categoriaId, cur);
  }
  return [...map.values()].sort((a, b) => a.total - b.total);
});

function filtrarPorCategoria(id: string) {
  selectedCategories.value = selectedCategories.value.includes(id) ? [] : [id];
  load();
}

const editingDetalheId = ref<string | null>(null);
const detalheDraft = ref("");

function startEditDetalhe(row: Transaction) {
  editingDetalheId.value = row.identificador;
  detalheDraft.value = row.detalhe;
}

async function commitDetalhe(row: Transaction) {
  const novo = detalheDraft.value.trim();
  editingDetalheId.value = null;
  if (novo === row.detalhe) return;
  await onEditField(row, "detalhe", novo);
}

function cancelDetalhe() {
  editingDetalheId.value = null;
}

const editingCategoriaId = ref<string | null>(null);
const categoriaSelectRef = ref<{ show?: () => void } | null>(null);

function startEditCategoria(row: Transaction) {
  editingCategoriaId.value = row.identificador;
  nextTick(() => categoriaSelectRef.value?.show?.());
}

async function commitCategoria(row: Transaction, novoId: string) {
  editingCategoriaId.value = null;
  if (novoId === row.categoriaId) return;
  await onEditField(row, "categoriaId", novoId);
}

function cancelCategoria() {
  editingCategoriaId.value = null;
}

const letraByCategoria = computed(() => {
  const m = new Map<string, string>();
  for (const c of ref_.categories) m.set(c.id, c.letra);
  return m;
});

function colorForCategoria(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 45% 82%)`;
}

type EditField = "data" | "tipo" | "valor";
const editingCell = ref<{ id: string; field: EditField } | null>(null);
const dataDraft = ref<Date | null>(null);
const tipoDraft = ref<string>("");
const valorDraft = ref<number | null>(null);

function isEditing(row: Transaction, field: EditField): boolean {
  return editingCell.value?.id === row.identificador && editingCell.value.field === field;
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startEditCell(row: Transaction, field: EditField) {
  editingCell.value = { id: row.identificador, field };
  if (field === "data") dataDraft.value = parseIso(row.data);
  else if (field === "tipo") tipoDraft.value = row.tipo;
  else if (field === "valor") valorDraft.value = Number(row.valor);
}

function cancelEditCell() {
  editingCell.value = null;
}

async function commitData(row: Transaction) {
  const d = dataDraft.value;
  editingCell.value = null;
  if (!d) return;
  const iso = toIso(d);
  if (!iso || iso === row.data) return;
  await onEditField(row, "data", iso);
}

async function commitTipo(row: Transaction) {
  const novo = tipoDraft.value.trim();
  editingCell.value = null;
  if (!novo || novo === row.tipo) return;
  await onEditField(row, "tipo", novo);
}

async function commitValor(row: Transaction) {
  const v = valorDraft.value;
  editingCell.value = null;
  if (v == null) return;
  const formatted = v.toFixed(2);
  if (formatted === Number(row.valor).toFixed(2)) return;
  await onEditField(row, "valor", formatted);
}

const tipoOptions = computed(() => ref_.tipos.map((t) => ({ label: t, value: t })));

// budget inline edit
const editingBudgetId = ref<string | null>(null);
const budgetValorDraft = ref<number | null>(null);

function startEditBudgetValor(b: BudgetItem) {
  editingBudgetId.value = b.id;
  budgetValorDraft.value = Number(b.valorMensal);
}

async function commitBudgetValor(b: BudgetItem) {
  const v = budgetValorDraft.value;
  editingBudgetId.value = null;
  if (v == null || Number(v).toFixed(2) === Number(b.valorMensal).toFixed(2)) return;
  try {
    const updated = await patchBudgetItem(b.id, { valorMensal: String(Number(v).toFixed(2)) });
    const idx = budgetItems.value.findIndex(x => x.id === b.id);
    if (idx !== -1) budgetItems.value[idx] = updated;
  } catch {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar.', life: 3000 });
  }
}
</script>

<template>
  <section>
    <div
      class="tx-shell"
      :class="{ 'tx-shell--no-panel': activePanel === null }"
    >
      <nav class="activity-bar" aria-label="Painéis">
        <button
          type="button"
          class="activity-item"
          :class="{ 'activity-item--active': activePanel === 'filters' }"
          :title="activePanel === 'filters' ? 'Ocultar filtros' : 'Mostrar filtros'"
          aria-label="Filtros"
          @click="togglePanel('filters')"
        >
          <i class="pi pi-filter" />
        </button>
        <button
          type="button"
          class="activity-item"
          :class="{ 'activity-item--active': activePanel === 'cats' }"
          :title="activePanel === 'cats' ? 'Ocultar resumo por categoria' : 'Mostrar resumo por categoria'"
          aria-label="Resumo por categoria"
          @click="togglePanel('cats')"
        >
          <i class="pi pi-tags" />
        </button>
        <button
          type="button"
          class="activity-item"
          :class="{ 'activity-item--active': activePanel === 'budget' }"
          :title="activePanel === 'budget' ? 'Ocultar orçamento' : 'Mostrar orçamento'"
          aria-label="Orçamento previsto"
          @click="togglePanel('budget')"
        >
          <i class="pi pi-wallet" />
        </button>
      </nav>

      <aside v-if="activePanel === 'filters'" class="side-panel filters-card">
        <div class="filters-card-header">
          <span>Filtros</span>
        </div>
        <div class="filters-body">
          <div class="filter-group">
            <label class="filter-label">Período</label>
            <div class="filter-row">
              <DatePicker
                v-model="period"
                selectionMode="range"
                dateFormat="dd/mm/yy"
                showIcon
                showButtonBar
                :numberOfMonths="1"
                :manualInput="false"
                placeholder="Selecione"
                fluid
              />
              <Button
                v-if="period && (period[0] || period[1])"
                icon="pi pi-times"
                severity="secondary"
                text
                rounded
                aria-label="Limpar período"
                @click="clearPeriod"
              />
            </div>
          </div>
          <div class="filter-group">
            <label class="filter-label">Categorias</label>
            <MultiSelect
              v-model="selectedCategories"
              :options="categoryOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Todas"
              display="chip"
              filter
              fluid
            />
          </div>
          <div class="filter-group">
            <label class="filter-label">Buscar</label>
            <InputText
              v-model="search"
              placeholder="descrição ou detalhe"
              fluid
              @keydown.enter="load"
            />
          </div>
          <div class="filter-actions">
            <Button
              label="Filtrar"
              icon="pi pi-filter"
              :loading="loading"
              @click="load"
            />
            <Button
              label="Limpar"
              icon="pi pi-eraser"
              severity="secondary"
              outlined
              :disabled="!hasFilter"
              @click="limparFiltros"
            />
          </div>
        </div>
      </aside>

      <aside v-else-if="activePanel === 'cats'" class="side-panel side-card">
        <div class="side-card-header">Por categoria</div>
        <div v-if="categoriasResumo.length === 0" class="side-empty">
          Sem transações no filtro atual.
        </div>
        <ul v-else class="cat-list">
          <li
            v-for="c in categoriasResumo"
            :key="c.id"
            class="cat-item"
            :class="{ 'cat-item--active': selectedCategories.includes(c.id) }"
            :style="{ borderLeftColor: colorForCategoria(c.id) }"
            @click="filtrarPorCategoria(c.id)"
          >
            <div class="cat-id">
              <span
                class="cat-letra"
                :style="{ background: colorForCategoria(c.id) }"
              >{{ c.letra }}</span>
              <span class="cat-nome">{{ c.id }}</span>
              <span class="cat-qtd">{{ c.qtd }}</span>
            </div>
            <div class="cat-valor" :class="classMoney(c.total)">
              {{ fmtMoneyBR(c.total) }}
            </div>
          </li>
        </ul>
      </aside>

      <aside v-else-if="activePanel === 'budget'" class="side-panel side-card">
        <div class="side-card-header">
          <span>Orçamento previsto</span>
          <span class="budget-header-total">{{ fmtMoneyBR(-totalPrevisto) }}</span>
        </div>
        <ul class="cat-list">
          <li
            v-for="b in budgetItems.filter(b => b.ativo)"
            :key="b.id"
            class="budget-item"
          >
            <template v-if="b.categoriaId">
              <div class="budget-item-top">
                <span class="budget-item-nome">{{ b.descricao }}</span>
                <span
                  class="budget-item-val"
                  :class="(Number(b.valorMensal) - Math.abs(categoriasResumo.find(c => c.id === b.categoriaId)?.total ?? 0)) >= 0 ? 'money-pos' : 'money-neg'"
                >
                  {{ fmtMoneyBR(Number(b.valorMensal) - Math.abs(categoriasResumo.find(c => c.id === b.categoriaId)?.total ?? 0)) }}
                </span>
              </div>
              <div class="budget-progress-wrap">
                <div
                  class="budget-progress-bar"
                  :style="{
                    width: Math.min(100, Math.abs(
                      (categoriasResumo.find(c => c.id === b.categoriaId)?.total ?? 0)
                    ) / Number(b.valorMensal) * 100) + '%',
                    background: colorForCategoria(b.categoriaId),
                  }"
                />
              </div>
              <div class="budget-item-rest">
                <span>Gasto: {{ fmtMoneyBR(Math.abs(categoriasResumo.find(c => c.id === b.categoriaId)?.total ?? 0)) }}</span>
                <span>
                  de
                  <InputNumber
                    v-if="editingBudgetId === b.id"
                    v-model="budgetValorDraft"
                    mode="decimal"
                    locale="pt-BR"
                    :minFractionDigits="2"
                    :maxFractionDigits="2"
                    autofocus
                    :inputStyle="{ width: '90px', padding: '1px 4px', fontSize: '0.72rem' }"
                    @blur="commitBudgetValor(b)"
                    @keydown.enter.prevent="commitBudgetValor(b)"
                    @keydown.esc.prevent="editingBudgetId = null"
                  />
                  <span
                    v-else
                    class="budget-edit-val"
                    title="Clique para editar o previsto"
                    @click="startEditBudgetValor(b)"
                  >{{ fmtMoneyBR(b.valorMensal) }}</span>
                </span>
              </div>
            </template>
            <template v-else>
              <div class="budget-item-top">
                <span class="budget-item-nome">{{ b.descricao }}</span>
                <InputNumber
                  v-if="editingBudgetId === b.id"
                  v-model="budgetValorDraft"
                  mode="decimal"
                  locale="pt-BR"
                  :minFractionDigits="2"
                  :maxFractionDigits="2"
                  autofocus
                  :inputStyle="{ width: '100px', padding: '2px 6px', fontSize: '0.85rem' }"
                  @blur="commitBudgetValor(b)"
                  @keydown.enter.prevent="commitBudgetValor(b)"
                  @keydown.esc.prevent="editingBudgetId = null"
                />
                <span
                  v-else
                  class="budget-item-val budget-edit-val"
                  title="Clique para editar o previsto"
                  @click="startEditBudgetValor(b)"
                >{{ fmtMoneyBR(b.valorMensal) }}</span>
              </div>
            </template>
          </li>
        </ul>
      </aside>

      <div class="center-col">
        <div class="actions-bar">
          <Button
            label="Nova transação"
            icon="pi pi-plus"
            severity="success"
            @click="showManual = true"
          />
          <Button
            label="Importar CSV"
            icon="pi pi-upload"
            outlined
            @click="showImport = true"
          />
        </div>
        <div class="summary-cards">
          <div class="summary-card">
            <div class="label">Saldo atual</div>
            <div class="value" :class="classMoney(resumo.saldo)">
              {{ fmtMoneyBR(resumo.saldo) }}
            </div>
          </div>
          <div class="summary-card">
            <div class="label">Saldo líquido</div>
            <div class="value" :class="classMoney(saldoLiquido)">
              {{ fmtMoneyBR(saldoLiquido) }}
            </div>
          </div>
        </div>

        <DataTable
        :value="rows"
        :loading="loading"
        stripedRows
        size="small"
        scrollable
        scrollHeight="calc(100vh - 320px)"
      >
        <Column header="" :style="{ width: '50px' }">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                size="small"
                aria-label="Excluir"
                @click="onDelete(data)"
              />
            </div>
          </template>
        </Column>
        <Column field="data" header="Data" :style="{ width: '130px' }">
          <template #body="{ data }">
            <DatePicker
              v-if="isEditing(data, 'data')"
              v-model="dataDraft"
              dateFormat="dd/mm/yy"
              autofocus
              fluid
              @update:modelValue="commitData(data)"
              @hide="cancelEditCell"
            />
            <span
              v-else
              class="editable-cell"
              role="button"
              tabindex="0"
              title="Clique para editar"
              @click="startEditCell(data, 'data')"
              @keydown.enter.prevent="startEditCell(data, 'data')"
            >
              {{ fmtDateBR(data.data) }}
            </span>
          </template>
        </Column>
        <Column field="tipo" header="Tipo" :style="{ width: '200px' }">
          <template #body="{ data }">
            <Select
              v-if="isEditing(data, 'tipo')"
              v-model="tipoDraft"
              :options="tipoOptions"
              optionLabel="label"
              optionValue="value"
              editable
              filter
              autofocus
              @change="commitTipo(data)"
              @hide="commitTipo(data)"
              :pt="{ root: { style: 'width: 100%' } }"
            />
            <span
              v-else
              class="editable-cell"
              role="button"
              tabindex="0"
              title="Clique para editar"
              @click="startEditCell(data, 'tipo')"
              @keydown.enter.prevent="startEditCell(data, 'tipo')"
            >
              {{ data.tipo || "—" }}
            </span>
          </template>
        </Column>
        <Column field="detalhe" header="Detalhe">
          <template #body="{ data }">
            <InputText
              v-if="editingDetalheId === data.identificador"
              v-model="detalheDraft"
              autofocus
              fluid
              @blur="commitDetalhe(data)"
              @keydown.enter.prevent="commitDetalhe(data)"
              @keydown.esc.prevent="cancelDetalhe"
            />
            <span
              v-else
              class="editable-cell"
              role="button"
              tabindex="0"
              title="Clique para editar"
              @click="startEditDetalhe(data)"
              @keydown.enter.prevent="startEditDetalhe(data)"
            >
              {{ data.detalhe || "—" }}
            </span>
          </template>
        </Column>
        <Column field="categoriaId" header="Categoria" :style="{ width: '200px' }">
          <template #body="{ data }">
            <Select
              v-if="editingCategoriaId === data.identificador"
              ref="categoriaSelectRef"
              :modelValue="data.categoriaId"
              :options="categoryOptions"
              optionLabel="label"
              optionValue="value"
              filter
              autofocus
              @update:modelValue="(v) => commitCategoria(data, v as string)"
              @hide="cancelCategoria"
              :pt="{ root: { style: 'width: 100%' } }"
            />
            <button
              v-else
              type="button"
              class="cat-pill"
              :style="{ background: colorForCategoria(data.categoriaId) }"
              :title="'Clique para trocar (' + data.categoriaId + ')'"
              @click="startEditCategoria(data)"
            >
              <span class="cat-pill-letra">{{ letraByCategoria.get(data.categoriaId) ?? "?" }}</span>
              <span class="cat-pill-nome">{{ data.categoriaId }}</span>
            </button>
          </template>
        </Column>
        <Column field="valor" header="Valor" :style="{ width: '160px' }">
          <template #body="{ data }">
            <InputNumber
              v-if="isEditing(data, 'valor')"
              v-model="valorDraft"
              mode="decimal"
              locale="pt-BR"
              :minFractionDigits="2"
              :maxFractionDigits="2"
              autofocus
              fluid
              @blur="commitValor(data)"
              @keydown.enter.prevent="commitValor(data)"
              @keydown.esc.prevent="cancelEditCell"
            />
            <span
              v-else
              class="editable-cell money-cell"
              :class="classMoney(data.valor)"
              role="button"
              tabindex="0"
              title="Clique para editar"
              @click="startEditCell(data, 'valor')"
              @keydown.enter.prevent="startEditCell(data, 'valor')"
            >
              {{ fmtMoneyBR(data.valor) }}
            </span>
          </template>
        </Column>
      </DataTable>
      <div class="tx-footer">
        <span class="tx-count">{{ resumo.qtd }} {{ resumo.qtd === 1 ? 'transação' : 'transações' }}</span>
      </div>
      </div>
    </div>

    <ImportModal v-model:visible="showImport" @imported="onImportFinished" />
    <ManualTransactionModal v-model:visible="showManual" @created="onManualCreated" />
  </section>
</template>

<style scoped>
.tx-shell {
  display: grid;
  grid-template-columns: 48px 280px minmax(0, 1fr);
  gap: 0;
  align-items: stretch;
  min-height: calc(100vh - 100px);
  margin: -1rem -1.5rem;
}

.tx-shell--no-panel {
  grid-template-columns: 48px minmax(0, 1fr);
}

.activity-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0;
  border-right: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
}

.activity-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--p-text-muted-color, #6b7280);
  cursor: pointer;
  position: relative;
  font-size: 1.1rem;
  transition: color 120ms, background 120ms;
}

.activity-item:hover {
  color: var(--p-text-color);
}

.activity-item--active {
  color: var(--p-primary-color);
}

.activity-item--active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--p-primary-color);
  border-radius: 0 2px 2px 0;
}

.side-panel {
  border-right: 1px solid var(--p-content-border-color);
  background: var(--p-content-background);
  overflow: hidden;
}

.center-col {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
  padding: 1rem 1.5rem;
}

.actions-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filters-card {
  background: var(--p-content-background);
  overflow: hidden;
  height: 100%;
}

.filters-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  font-weight: 600;
  border-bottom: 1px solid var(--p-content-border-color);
}

.filters-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.85rem 1rem 1rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.filter-label {
  font-size: 0.75rem;
  opacity: 0.7;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.filter-row :deep(.p-datepicker) {
  flex: 1;
  min-width: 0;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.filter-actions .p-button {
  flex: 1;
}

.side-card {
  background: var(--p-content-background);
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.side-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  font-weight: 600;
  border-bottom: 1px solid var(--p-content-border-color);
}

.budget-header-total {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--p-text-muted-color, #6b7280);
  font-variant-numeric: tabular-nums;
}

.side-empty {
  padding: 1rem;
  opacity: 0.7;
  font-size: 0.85rem;
}

.cat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  overflow-y: auto;
}

.cat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid var(--p-content-border-color);
  border-left: 3px solid transparent;
  transition: background 120ms;
}

.cat-item:hover {
  background: var(--p-highlight-background, rgba(0, 0, 0, 0.04));
}

.cat-item--active {
  background: var(--p-highlight-background, rgba(59, 130, 246, 0.12));
}

.cat-id {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.cat-letra {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.25rem;
  background: var(--p-highlight-background, rgba(59, 130, 246, 0.15));
  color: #1f2937;
  font-weight: 700;
  font-size: 0.75rem;
}

.cat-nome {
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-qtd {
  font-size: 0.7rem;
  opacity: 0.6;
}

.cat-valor {
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
  white-space: nowrap;
}

/* Budget panel */
.budget-summary {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.budget-label { opacity: 0.7; }
.budget-total { font-weight: 600; }

.budget-item {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--p-content-border-color);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.budget-item-top {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
}

.budget-item-nome {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 55%;
}

.budget-item-val {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.budget-progress-wrap {
  height: 4px;
  border-radius: 2px;
  background: var(--p-content-border-color);
  overflow: hidden;
}

.budget-progress-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 400ms;
}

.budget-item-rest {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
}

.budget-edit-val {
  cursor: pointer;
  border-bottom: 1px dashed var(--p-text-muted-color, #9ca3af);
  transition: border-color 120ms;
}

.budget-edit-val:hover {
  border-bottom-color: var(--p-primary-color);
}

.tx-footer {
  display: flex;
  justify-content: flex-end;
  padding: 0.35rem 0.75rem;
}

.tx-count {
  font-size: 0.75rem;
  color: var(--p-text-muted-color, #9ca3af);
  font-style: italic;
}

.editable-cell {
  display: inline-block;
  width: 100%;
  padding: 0.25rem 0;
  border-radius: 0.25rem;
  cursor: text;
  transition: background 120ms;
}

.editable-cell:hover {
  background: var(--p-highlight-background, rgba(0, 0, 0, 0.04));
  outline: 1px dashed var(--p-content-border-color);
  outline-offset: 2px;
}

.row-actions {
  display: flex;
  gap: 0.15rem;
  flex-wrap: nowrap;
  align-items: center;
}

.row-actions :deep(.p-button) {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
}
.row-actions :deep(.p-button-icon) {
  font-size: 0.85rem;
}

.cat-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.55rem 0.2rem 0.3rem;
  border-radius: 999px;
  border: 0;
  color: #1f2937;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  line-height: 1;
  max-width: 100%;
  transition: transform 120ms, filter 120ms;
}

.cat-pill:hover {
  filter: brightness(0.95);
  transform: translateY(-1px);
}

.cat-pill-letra {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.12);
  font-weight: 700;
  font-size: 0.7rem;
}

.cat-pill-nome {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

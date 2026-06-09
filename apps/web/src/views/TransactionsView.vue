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
  type Transaction,
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
  await load();
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
  return `hsl(${h % 360} 65% 45%)`;
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
</script>

<template>
  <section>
    <div class="main-grid">
      <aside class="filters-card">
        <div class="filters-card-header">
          <span>Filtros</span>
        </div>
        <div class="filters-body">
          <div class="filter-group">
            <label class="filter-label">Periodo</label>
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
                aria-label="Limpar periodo"
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
              placeholder="descricao ou detalhe"
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

      <div class="center-col">
        <div class="actions-bar">
          <Button
            label="Nova transacao"
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
            <div class="label">Entradas</div>
            <div class="value money-pos">{{ fmtMoneyBR(resumo.totalEntradas) }}</div>
          </div>
          <div class="summary-card">
            <div class="label">Saidas</div>
            <div class="value money-neg">{{ fmtMoneyBR(resumo.totalSaidas) }}</div>
          </div>
          <div class="summary-card">
            <div class="label">Saldo</div>
            <div class="value" :class="classMoney(resumo.saldo)">
              {{ fmtMoneyBR(resumo.saldo) }}
            </div>
          </div>
          <div class="summary-card">
            <div class="label">Transacoes</div>
            <div class="value">{{ resumo.qtd }}</div>
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
      </div>

      <aside class="side-card">
        <div class="side-card-header">Por categoria</div>
        <div v-if="categoriasResumo.length === 0" class="side-empty">
          Sem transacoes no filtro atual.
        </div>
        <ul v-else class="cat-list">
          <li
            v-for="c in categoriasResumo"
            :key="c.id"
            class="cat-item"
            :class="{ 'cat-item--active': selectedCategories.includes(c.id) }"
            @click="filtrarPorCategoria(c.id)"
          >
            <div class="cat-id">
              <span class="cat-letra">{{ c.letra }}</span>
              <span class="cat-nome">{{ c.id }}</span>
              <span class="cat-qtd">{{ c.qtd }}</span>
            </div>
            <div class="cat-valor" :class="classMoney(c.total)">
              {{ fmtMoneyBR(c.total) }}
            </div>
          </li>
        </ul>
      </aside>
    </div>

    <ImportModal v-model:visible="showImport" @imported="onImportFinished" />
    <ManualTransactionModal v-model:visible="showManual" @created="onManualCreated" />
  </section>
</template>

<style scoped>
.main-grid {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 320px;
  gap: 1rem;
  align-items: start;
}

@media (max-width: 1280px) {
  .main-grid {
    grid-template-columns: 240px minmax(0, 1fr);
  }
  .side-card {
    grid-column: 1 / -1;
  }
}

@media (max-width: 900px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
}

.center-col {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.actions-bar {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.filters-card {
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.5rem;
  background: var(--p-content-background);
  overflow: hidden;
  position: sticky;
  top: 1rem;
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
  border: 1px solid var(--p-content-border-color);
  border-radius: 0.5rem;
  background: var(--p-content-background);
  overflow: hidden;
  position: sticky;
  top: 1rem;
}

.side-card-header {
  padding: 0.75rem 1rem;
  font-weight: 600;
  border-bottom: 1px solid var(--p-content-border-color);
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
  max-height: calc(100vh - 360px);
  overflow-y: auto;
}

.cat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid var(--p-content-border-color);
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
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  line-height: 1;
  max-width: 100%;
  transition: transform 120ms, filter 120ms;
}

.cat-pill:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.cat-pill-letra {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  font-weight: 700;
  font-size: 0.7rem;
}

.cat-pill-nome {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

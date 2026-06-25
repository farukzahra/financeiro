<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch } from "vue";
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
import { useAuthStore } from "../stores/auth";
import {
  listTransactions,
  patchTransaction,
  deleteTransaction,
  listBudget,
  patchBudgetItem,
  createRule,
  type Transaction,
  type BudgetItem,
} from "../lib/api";
import { fmtMoneyBR, fmtDateBR, classMoney } from "../lib/format";
import { categoryDisplayName } from "../lib/categories";
import ImportModal from "../components/ImportModal.vue";
import ManualTransactionModal from "../components/ManualTransactionModal.vue";

const ref_ = useReferenceStore();
const auth = useAuthStore();
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

type PeriodValue = Array<Date | null> | null;
const period = ref<PeriodValue>(null);
const selectedCategories = ref<string[]>([]);
const search = ref("");
const showImport = ref(false);
const showManual = ref(false);
const categoryFilterRef = ref<{ hide?: () => void } | null>(null);

type ActivityPanel = "filters" | "cats" | "budget" | null;
type TransactionSortField = "data" | "tipo" | "detalhe" | "categoriaId" | "valor";
const activePanel = ref<ActivityPanel>("filters");
const sortField = ref<TransactionSortField>("data");
const sortOrder = ref<1 | -1>(1);
const budgetOrder = ref<string[]>([]);
const draggingBudgetId = ref<string | null>(null);
const dragOverBudgetId = ref<string | null>(null);
let restoringSettings = true;
let saveFiltersTimer: ReturnType<typeof setTimeout> | null = null;
let applyFiltersTimer: ReturnType<typeof setTimeout> | null = null;

const budgetItems = ref<BudgetItem[]>([]);
async function loadBudgetItems() {
  try { budgetItems.value = await listBudget(); } catch { /* ignore */ }
}

const totalPrevisto = computed(() =>
  budgetItems.value.filter((b) => b.ativo).reduce((s, b) => s + Number(b.valorMensal), 0),
);
function budgetRemaining(b: BudgetItem): number {
  const planned = Number(b.valorMensal);
  if (!b.categoriaId) return planned;
  return Math.max(0, planned - spentByCategoria(b.categoriaId));
}
const totalPrevistoRestante = computed(() =>
  budgetItems.value.filter((b) => b.ativo).reduce((s, b) => s + budgetRemaining(b), 0),
);
const saldoLiquido = computed(() =>
  Number(resumo.value.saldo) - totalPrevistoRestante.value,
);
const saldoLiquidoTooltip = computed(() => {
  const saldoAtual = Number(resumo.value.saldo);
  const previstoRestante = totalPrevistoRestante.value;
  const liquido = saldoLiquido.value;
  return {
    linha1: "Saldo liquido = saldo atual - previsto restante ativo.",
    linha2: `${fmtMoneyBR(saldoAtual)} - ${fmtMoneyBR(previstoRestante)} = ${fmtMoneyBR(liquido)}`,
  };
});

const budgetByCategoria = computed(() => {
  const m = new Map<string, number>();
  for (const b of budgetItems.value) {
    if (b.ativo && b.categoriaId) {
      m.set(b.categoriaId, (m.get(b.categoriaId) ?? 0) + Number(b.valorMensal));
    }
  }
  return m;
});

const activeBudgetItems = computed(() => {
  const order = new Map(budgetOrder.value.map((id, index) => [id, index]));
  const originalIndex = new Map(budgetItems.value.map((item, index) => [item.id, index]));
  return budgetItems.value
    .filter((b) => b.ativo)
    .slice()
    .sort((a, b) => {
      const ai = order.get(a.id);
      const bi = order.get(b.id);
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
    });
});

function togglePanel(p: Exclude<ActivityPanel, null>) {
  activePanel.value = activePanel.value === p ? null : p;
}

function toIso(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function periodBounds() {
  const start = Array.isArray(period.value) ? period.value[0] : null;
  const end = Array.isArray(period.value) ? period.value[1] : null;
  return {
    from: toIso(start),
    to: toIso(end),
  };
}

function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function dateWithDay(year: number, monthIndex: number, day: number): Date {
  const safeDay = Math.min(Math.max(1, Math.trunc(day)), daysInMonth(year, monthIndex));
  return new Date(year, monthIndex, safeDay);
}

function shiftMonth(date: Date, months: number, day: number): Date {
  return dateWithDay(date.getFullYear(), date.getMonth() + months, day);
}

function resolveSalaryCycleBounds(today: Date, startDay: number | null, endDay: number | null) {
  if (startDay === null || endDay === null) return null;

  const currentMonthStart = dateWithDay(today.getFullYear(), today.getMonth(), startDay);
  const currentMonthEnd = dateWithDay(today.getFullYear(), today.getMonth(), endDay);
  const todayTime = startOfDay(today).getTime();
  const startTime = startOfDay(currentMonthStart).getTime();
  const endTime = startOfDay(currentMonthEnd).getTime();

  if (startDay <= endDay) {
    if (todayTime < startTime) {
      return {
        start: shiftMonth(today, -1, startDay),
        end: currentMonthEnd,
      };
    }

    if (todayTime > endTime) {
      return {
        start: currentMonthStart,
        end: shiftMonth(today, 1, endDay),
      };
    }

    return {
      start: currentMonthStart,
      end: currentMonthEnd,
    };
  }

  if (todayTime >= startTime) {
    return {
      start: currentMonthStart,
      end: shiftMonth(today, 1, endDay),
    };
  }

  return {
    start: shiftMonth(today, -1, startDay),
    end: currentMonthEnd,
  };
}

function restoreSavedFilters() {
  const saved = auth.user?.settings.transactionsFilters;
  budgetOrder.value = auth.user?.settings.budgetOrder ?? [];
  if (!saved) return;

  const from = parseIsoDate(saved.from);
  const to = parseIsoDate(saved.to);
  period.value = from || to ? [from, to] : null;
  selectedCategories.value = saved.categories ?? [];
  search.value = saved.search ?? "";
  activePanel.value = saved.activePanel ?? null;
  sortField.value = saved.sortField ?? "data";
  sortOrder.value = saved.sortOrder ?? 1;
}

function onPeriodModelUpdate(value: Date | Array<Date | null> | null | undefined) {
  period.value = Array.isArray(value) ? value : value ? [value, null] : null;
}

function scheduleSaveFilters() {
  if (restoringSettings) return;
  if (saveFiltersTimer) clearTimeout(saveFiltersTimer);
  saveFiltersTimer = setTimeout(() => {
    auth.saveSettings({
      transactionsFilters: {
        from: periodBounds().from ?? null,
        to: periodBounds().to ?? null,
        categories: selectedCategories.value,
        search: search.value,
        activePanel: activePanel.value,
        sortField: sortField.value,
        sortOrder: sortOrder.value,
      },
    }).catch(() => {
      // Preferimos nao interromper a tela por falha de persistencia de preferencia.
    });
  }, 400);
}

async function load() {
  loading.value = true;
  try {
    const { from, to } = periodBounds();
    const r = await listTransactions({
      from,
      to,
      category: selectedCategories.value.length ? selectedCategories.value : undefined,
      q: search.value || undefined,
    });
    rows.value = r.itens;
    resumo.value = r.resumo;
  } finally {
    loading.value = false;
  }
}

function recalculateResumo() {
  let totalEntradas = 0;
  let totalSaidas = 0;
  for (const r of rows.value) {
    const v = Number(r.valor);
    if (v > 0) totalEntradas += v;
    else if (v < 0) totalSaidas += v;
  }
  resumo.value = {
    totalEntradas: totalEntradas.toFixed(2),
    totalSaidas: totalSaidas.toFixed(2),
    saldo: (totalEntradas + totalSaidas).toFixed(2),
    qtd: rows.value.length,
  };
}

function applyFilters() {
  if (applyFiltersTimer) {
    clearTimeout(applyFiltersTimer);
    applyFiltersTimer = null;
  }
  categoryFilterRef.value?.hide?.();
  load();
  scheduleSaveFilters();
}

function scheduleApplyFilters() {
  if (restoringSettings) return;
  if (applyFiltersTimer) clearTimeout(applyFiltersTimer);
  applyFiltersTimer = setTimeout(() => {
    applyFiltersTimer = null;
    load();
  }, 250);
}

function onCategoryFilterChange() {
  nextTick(() => {
    setTimeout(() => categoryFilterRef.value?.hide?.(), 0);
  });
}

function onSort(event: {
  sortField?: string | ((item: Transaction) => unknown);
  sortOrder?: 1 | -1 | 0 | null;
}) {
  if (typeof event.sortField === "string") {
    sortField.value = event.sortField as TransactionSortField;
  }
  sortOrder.value = event.sortOrder === -1 ? -1 : 1;
  scheduleSaveFilters();
}

function saveBudgetOrder() {
  auth.saveSettings({
    budgetOrder: budgetOrder.value,
  }).catch(() => {
    toast.add({
      severity: "error",
      summary: "Erro",
      detail: "Nao foi possivel salvar a ordem do orcamento.",
      life: 3000,
    });
  });
}

function onBudgetDragStart(event: DragEvent, id: string) {
  draggingBudgetId.value = id;
  event.dataTransfer?.setData("text/plain", id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

function onBudgetDrop(targetId: string) {
  const sourceId = draggingBudgetId.value;
  draggingBudgetId.value = null;
  dragOverBudgetId.value = null;
  if (!sourceId || sourceId === targetId) return;

  const visibleIds = activeBudgetItems.value.map((item) => item.id);
  const from = visibleIds.indexOf(sourceId);
  const to = visibleIds.indexOf(targetId);
  if (from === -1 || to === -1) return;

  visibleIds.splice(from, 1);
  visibleIds.splice(to, 0, sourceId);

  const hiddenIds = budgetItems.value
    .map((item) => item.id)
    .filter((id) => !visibleIds.includes(id));
  budgetOrder.value = [...visibleIds, ...hiddenIds];
  saveBudgetOrder();
}

function onBudgetDragEnd() {
  draggingBudgetId.value = null;
  dragOverBudgetId.value = null;
}

onMounted(async () => {
  if (!ref_.loaded) await ref_.load();
  restoreSavedFilters();
  restoringSettings = false;
  await Promise.all([load(), loadBudgetItems()]);
});

watch([period, selectedCategories, search], scheduleApplyFilters, { deep: true });
watch([period, selectedCategories, search, activePanel, sortField, sortOrder], scheduleSaveFilters, { deep: true });

function clearPeriod() {
  period.value = null;
  applyFilters();
}

function limparFiltros() {
  period.value = null;
  selectedCategories.value = [];
  search.value = "";
  categoryFilterRef.value?.hide?.();
  applyFilters();
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
    if (field === "valor") recalculateResumo();
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
        recalculateResumo();
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

async function onCreateRuleFromRow(row: Transaction) {
  const padrao = (row.chaveNormalizada || row.detalhe || row.descricaoRaw).trim();
  if (!padrao) {
    toast.add({
      severity: "warn",
      summary: "Sem padrao",
      detail: "Esta transacao nao tem texto suficiente para gerar regra.",
      life: 2500,
    });
    return;
  }

  try {
    await createRule({
      categoriaId: row.categoriaId,
      tipoPadrao: "substring",
      padrao,
      prioridade: 100,
      ativa: true,
    });
    await ref_.reloadRules();
    toast.add({
      severity: "success",
      summary: "Regra criada",
      detail: `${padrao} -> ${row.categoriaId}`,
      life: 2500,
    });
  } catch (err) {
    toast.add({
      severity: "error",
      summary: "Erro ao gerar regra",
      detail: (err as Error).message,
      life: 3000,
    });
  }
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
  qtd: number;
  total: number;
};

const categoriasResumo = computed<CategoriaResumo[]>(() => {
  const map = new Map<string, CategoriaResumo>();
  for (const r of rows.value) {
    const cur = map.get(r.categoriaId) ?? {
      id: r.categoriaId,
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
  applyFilters();
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

function colorForCategoria(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 45% 82%)`;
}

function spentByCategoria(id: string): number {
  return Math.abs(categoriasResumo.value.find((c) => c.id === id)?.total ?? 0);
}

function budgetPercent(b: BudgetItem): number {
  if (!b.categoriaId) return 0;
  const planned = Number(b.valorMensal);
  if (planned <= 0) return 0;
  return Math.min(999, Math.round((spentByCategoria(b.categoriaId) / planned) * 100));
}

const salaryCycle = computed(() => {
  const startDay = auth.user?.settings.salaryCycle?.startDay ?? null;
  const endDay = auth.user?.settings.salaryCycle?.endDay ?? null;
  const bounds = resolveSalaryCycleBounds(new Date(), startDay, endDay);
  if (!bounds) return null;

  const start = startOfDay(bounds.start);
  const end = startOfDay(bounds.end);
  const today = startOfDay(new Date());
  const totalMs = Math.max(86_400_000, addDays(end, 1).getTime() - start.getTime());
  const elapsedMs = today.getTime() - start.getTime();
  const elapsedDays = Math.max(0, Math.floor(elapsedMs / 86_400_000));
  const remainingDays = Math.max(0, Math.floor((end.getTime() - today.getTime()) / 86_400_000));
  const percent = Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));

  return {
    start,
    end,
    percent,
    elapsedDays,
    remainingDays,
  };
});

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
                :modelValue="period"
                selectionMode="range"
                dateFormat="dd/mm/yy"
                showIcon
                showButtonBar
                appendTo="body"
                :numberOfMonths="2"
                :manualInput="false"
                placeholder="Selecione"
                fluid
                @update:modelValue="onPeriodModelUpdate"
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
              ref="categoryFilterRef"
              v-model="selectedCategories"
              :options="categoryOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Todas"
              display="chip"
              filter
              fluid
              @change="onCategoryFilterChange"
            />
          </div>
          <div class="filter-group">
            <label class="filter-label">Buscar</label>
            <InputText
              v-model="search"
              placeholder="descrição ou detalhe"
              fluid
              @keydown.enter="applyFilters"
            />
          </div>
          <div class="filter-actions">
            <Button
              label="Filtrar"
              icon="pi pi-filter"
              :loading="loading"
              @click="applyFilters"
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
              <span class="cat-nome">{{ categoryDisplayName(c.id) }}</span>
              <span class="cat-qtd">{{ c.qtd }}</span>
            </div>
            <div class="cat-valor" :class="classMoney(c.total)">
              {{ fmtMoneyBR(c.total) }}
            </div>
          </li>
        </ul>
      </aside>

      <aside v-else-if="activePanel === 'budget'" class="side-panel side-card">
        <div class="side-card-header side-card-header--budget">
          <span class="side-card-title">Orçamento</span>
          <div class="budget-header-divider" aria-hidden="true" />
          <div class="budget-header-values">
            <div class="budget-header-block">
              <span class="budget-header-label">Previsto</span>
              <span class="budget-header-total">{{ fmtMoneyBR(-totalPrevisto) }}</span>
            </div>
            <div class="budget-header-block budget-header-block--end">
              <span class="budget-header-label">Orçamento restante</span>
              <span class="budget-header-total">{{ fmtMoneyBR(-totalPrevistoRestante) }}</span>
            </div>
          </div>
        </div>
        <div class="salary-cycle">
          <div class="salary-cycle-meta">
            <span>Ciclo salarial</span>
            <span v-if="salaryCycle">{{ salaryCycle.remainingDays }} dias restantes</span>
              <span v-else>Defina o ciclo em Preferências</span>
          </div>
          <div class="salary-cycle-bar-wrap">
            <div
              class="salary-cycle-bar"
              :class="{ 'salary-cycle-bar--empty': !salaryCycle }"
              :style="{ width: (salaryCycle?.percent ?? 0) + '%' }"
            >
              <span class="salary-cycle-label">{{ salaryCycle?.percent ?? 0 }}%</span>
            </div>
          </div>
          <div v-if="salaryCycle" class="salary-cycle-dates">
            <span>{{ fmtDateBR(toIso(salaryCycle.start) ?? "") }}</span>
            <span>{{ fmtDateBR(toIso(salaryCycle.end) ?? "") }}</span>
          </div>
        </div>
        <ul class="cat-list">
          <li
            v-for="b in activeBudgetItems"
            :key="b.id"
            class="budget-item"
            :class="{
              'budget-item--dragging': draggingBudgetId === b.id,
              'budget-item--drag-over': dragOverBudgetId === b.id && draggingBudgetId !== b.id,
            }"
            @dragover.prevent="dragOverBudgetId = b.id"
            @dragleave="dragOverBudgetId = null"
            @drop.prevent="onBudgetDrop(b.id)"
          >
            <template v-if="b.categoriaId">
              <div class="budget-item-top">
                <div class="budget-title">
                  <span
                    class="budget-drag-handle"
                    draggable="true"
                    title="Arrastar para reordenar"
                    role="button"
                    tabindex="0"
                    @dragstart="(event) => onBudgetDragStart(event, b.id)"
                    @dragend="onBudgetDragEnd"
                  >
                    <i class="pi pi-bars" />
                  </span>
                  <span class="budget-item-nome">{{ b.descricao }}</span>
                </div>
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
                    width: Math.min(100, budgetPercent(b)) + '%',
                    background: colorForCategoria(b.categoriaId),
                  }"
                >
                  <span class="budget-progress-label">{{ budgetPercent(b) }}%</span>
                </div>
              </div>
              <div class="budget-item-rest">
                <span>Gasto: {{ fmtMoneyBR(spentByCategoria(b.categoriaId)) }}</span>
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
                <div class="budget-title">
                  <span
                    class="budget-drag-handle"
                    draggable="true"
                    title="Arrastar para reordenar"
                    role="button"
                    tabindex="0"
                    @dragstart="(event) => onBudgetDragStart(event, b.id)"
                    @dragend="onBudgetDragEnd"
                  >
                    <i class="pi pi-bars" />
                  </span>
                  <span class="budget-item-nome">{{ b.descricao }}</span>
                </div>
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
          <div
            class="summary-card summary-card--tooltip"
            tabindex="0"
            :aria-label="`${saldoLiquidoTooltip.linha1} ${saldoLiquidoTooltip.linha2}`"
          >
            <div class="label">Saldo líquido</div>
            <div class="value" :class="classMoney(saldoLiquido)">
              {{ fmtMoneyBR(saldoLiquido) }}
            </div>
            <div class="summary-tooltip" role="tooltip">
              <div>{{ saldoLiquidoTooltip.linha1 }}</div>
              <div>{{ saldoLiquidoTooltip.linha2 }}</div>
            </div>
          </div>
        </div>

        <DataTable
        :value="rows"
        :loading="loading"
        :sortField="sortField"
        :sortOrder="sortOrder"
        stripedRows
        size="small"
        @sort="onSort"
      >
        <Column field="data" header="Data" sortable :style="{ width: '130px' }">
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
        <Column field="tipo" header="Tipo" sortable :style="{ width: '200px' }">
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
        <Column
          field="detalhe"
          header="Detalhe"
          sortable
          :style="{ width: '320px' }"
          :headerStyle="{ width: '320px' }"
        >
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
        <Column
          field="valor"
          header="Valor"
          sortable
          dataType="numeric"
          headerClass="value-column-header"
          bodyClass="value-column-body"
          :style="{ width: '160px', textAlign: 'right' }"
          :headerStyle="{ width: '160px', textAlign: 'right' }"
        >
          <template #body="{ data }">
            <InputNumber
              v-if="isEditing(data, 'valor')"
              v-model="valorDraft"
              class="value-editor"
              mode="decimal"
              locale="pt-BR"
              :minFractionDigits="2"
              :maxFractionDigits="2"
              autofocus
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
        <Column field="categoriaId" header="Categoria" sortable :style="{ width: '200px' }">
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
              <span class="cat-pill-nome">{{ categoryDisplayName(data.categoriaId) }}</span>
            </button>
          </template>
        </Column>
        <Column header="" :style="{ width: '90px' }">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                icon="pi pi-sitemap"
                severity="secondary"
                text
                rounded
                size="small"
                aria-label="Gerar regra"
                title="Gerar regra a partir desta linha"
                @click="onCreateRuleFromRow(data)"
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                size="small"
                aria-label="Excluir"
                title="Excluir transacao"
                @click="onDelete(data)"
              />
            </div>
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
section {
  height: 100%;
}

.tx-shell {
  display: grid;
  grid-template-columns: 48px 280px minmax(0, 1fr);
  gap: 0;
  align-items: stretch;
  height: 100%;
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
  min-height: 0;
}

.center-col {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
  min-height: 0;
  padding: 1rem 1.5rem;
  overflow-y: auto;
  height: 100%;
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

.side-card-header--budget {
  display: grid;
  gap: 0.65rem;
  align-items: stretch;
}

.side-card-title {
  padding-top: 0;
}

.budget-header-values {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  min-width: 0;
}

.budget-header-divider {
  width: 100%;
  height: 1px;
  background: var(--p-content-border-color);
}

.budget-header-block {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  min-width: 0;
}

.budget-header-block--end {
  align-items: flex-end;
  text-align: right;
  padding-left: 0.75rem;
  border-left: 1px solid var(--p-content-border-color);
}

.budget-header-label {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--p-text-muted-color, #6b7280);
  line-height: 1.2;
}

.budget-header-total {
  font-size: 0.96rem;
  font-weight: 600;
  color: var(--p-text-color);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.salary-cycle {
  padding: 0.65rem 1rem 0.7rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.salary-cycle-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 0.45rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--p-content-border-color);
  font-size: 0.74rem;
  color: var(--p-text-muted-color, #6b7280);
}

.salary-cycle-bar-wrap {
  height: 16px;
  border-radius: 8px;
  background: var(--p-content-border-color);
  overflow: hidden;
}

.salary-cycle-bar {
  position: relative;
  height: 100%;
  min-width: 2rem;
  border-radius: 8px;
  background: var(--p-green-400, #4ade80);
  transition: width 400ms;
}

.salary-cycle-bar--empty {
  background: var(--p-surface-300, #d1d5db);
}

.salary-cycle-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1f2937;
  font-size: 0.64rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.salary-cycle-dates {
  display: flex;
  justify-content: space-between;
  margin-top: 0.35rem;
  color: var(--p-text-muted-color, #6b7280);
  font-size: 0.68rem;
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
  transition: background 120ms;
}

.budget-item:nth-child(even) {
  background: var(--p-surface-100, rgba(0, 0, 0, 0.055));
}

.budget-item:hover {
  background: var(--p-highlight-background, rgba(0, 0, 0, 0.075));
}

.budget-item--dragging {
  opacity: 0.55;
}

.budget-item--drag-over {
  outline: 2px solid var(--p-primary-color);
  outline-offset: -2px;
  background: var(--p-highlight-background, rgba(59, 130, 246, 0.12));
}

.budget-item-top {
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  font-size: 0.82rem;
}

.budget-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.budget-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 4px;
  color: var(--p-text-muted-color, #6b7280);
  cursor: grab;
  flex: 0 0 auto;
}

.budget-drag-handle:active {
  cursor: grabbing;
}

.budget-drag-handle:hover {
  background: var(--p-highlight-background, rgba(0, 0, 0, 0.06));
  color: var(--p-text-color);
}

.budget-item-nome {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.budget-item-val {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.budget-progress-wrap {
  height: 14px;
  border-radius: 7px;
  background: var(--p-content-border-color);
  overflow: hidden;
  position: relative;
}

.budget-progress-bar {
  height: 100%;
  min-width: 1.75rem;
  border-radius: 7px;
  transition: width 400ms;
  position: relative;
}

.budget-progress-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1f2937;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
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

.money-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

:deep(.value-column-header .p-datatable-column-header-content) {
  justify-content: flex-end;
}

:deep(.value-column-body) {
  text-align: right;
}

:deep(.value-editor) {
  width: 80%;
  margin-left: auto;
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

.cat-pill-nome {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

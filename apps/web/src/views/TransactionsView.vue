<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { RouterLink } from "vue-router";
import { isBusinessDay as isBrazilBusinessDay } from "febraban-bank-holidays";
import { useSnackbar } from "../composables/useSnackbar";
import { useConfirm } from "../composables/useConfirm";
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
import { categoryPillLabel, categoryCode } from "../lib/categories";
import { compareTransactionsByDateThenSalario, csvStaleDays } from "@financeiro/shared";
import ImportModal from "../components/ImportModal.vue";
import ManualTransactionModal from "../components/ManualTransactionModal.vue";

const ref_ = useReferenceStore();
const auth = useAuthStore();
const snackbar = useSnackbar();
const confirm = useConfirm();

const rows = ref<Transaction[]>([]);
const resumo = ref({
  totalEntradas: "0",
  totalSaidas: "0",
  saldo: "0",
  qtd: 0,
  ultimaData: null as string | null,
});
const loading = ref(false);

type PeriodValue = Date[];
const period = ref<PeriodValue>([]);
const periodMenu = ref(false);
const selectedCategories = ref<string[]>([]);
const search = ref("");
const showImport = ref(false);
const showManual = ref(false);
const categoryFilterOpen = ref(false);

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
const totalEntradasPeriodo = computed(() => Number(resumo.value.totalEntradas));
const totalSaidasPeriodo = computed(() => Math.abs(Number(resumo.value.totalSaidas)));
const saldoAtualTooltip = computed(() => {
  const saldo = Number(resumo.value.saldo);
  return {
    linha1: "Saldo atual = soma de todas as entradas e saídas (sem filtro).",
    linha2: `Total acumulado: ${fmtMoneyBR(saldo)}`,
  };
});
const entradasTooltip = computed(() => ({
  linha1: "Entradas = soma das transações positivas no período filtrado.",
  linha2: `${fmtMoneyBR(totalEntradasPeriodo.value)} em entradas`,
}));
const saidasTooltip = computed(() => ({
  linha1: "Saídas = soma absoluta das transações negativas no período filtrado.",
  linha2: `${fmtMoneyBR(totalSaidasPeriodo.value)} em saídas`,
}));
const saldoLiquidoTooltip = computed(() => {
  const saldoAtual = Number(resumo.value.saldo);
  const previstoRestante = totalPrevistoRestante.value;
  const liquido = saldoLiquido.value;
  return {
    linha1: "Saldo líquido = saldo atual - previsto restante ativo.",
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
  const start = period.value[0] ?? null;
  const end = period.value.length > 1 ? period.value[period.value.length - 1] : start;
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

function nthBusinessDayOfMonth(year: number, monthIndex: number, ordinal: number): Date {
  const target = Math.max(1, Math.trunc(ordinal));
  let count = 0;
  const totalDays = daysInMonth(year, monthIndex);

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, monthIndex, day);
    if (!isBrazilBusinessDay(date)) continue;
    count += 1;
    if (count >= target) return date;
  }

  return new Date(year, monthIndex, totalDays);
}

function resolvePaymentDate(
  year: number,
  monthIndex: number,
  paymentDay:
    | {
        mode?: "dayOfMonth" | "businessDayOfMonth" | null;
        dayOfMonth?: number | null;
        businessDayOrdinal?: number | null;
      }
    | null
    | undefined,
): Date | null {
  if (!paymentDay?.mode) return null;

  if (paymentDay.mode === "dayOfMonth") {
    if (paymentDay.dayOfMonth === null || paymentDay.dayOfMonth === undefined) return null;
    return dateWithDay(year, monthIndex, paymentDay.dayOfMonth);
  }

  if (paymentDay.businessDayOrdinal === null || paymentDay.businessDayOrdinal === undefined) return null;
  return nthBusinessDayOfMonth(year, monthIndex, paymentDay.businessDayOrdinal);
}

function resolveSalaryCycleBounds(
  today: Date,
  paymentDay:
    | {
        mode?: "dayOfMonth" | "businessDayOfMonth" | null;
        dayOfMonth?: number | null;
        businessDayOrdinal?: number | null;
      }
    | null
    | undefined,
) {
  const currentPayment = resolvePaymentDate(today.getFullYear(), today.getMonth(), paymentDay);
  if (!currentPayment) return null;

  const todayTime = startOfDay(today).getTime();
  const currentPaymentTime = startOfDay(currentPayment).getTime();

  if (todayTime < currentPaymentTime) {
    const previousPayment = resolvePaymentDate(today.getFullYear(), today.getMonth() - 1, paymentDay);
    if (!previousPayment) return null;
    return {
      start: previousPayment,
      end: currentPayment,
    };
  }

  const nextPayment = resolvePaymentDate(today.getFullYear(), today.getMonth() + 1, paymentDay);
  if (!nextPayment) return null;
  return {
    start: currentPayment,
    end: nextPayment,
  };
}

function restoreSavedFilters() {
  const saved = auth.user?.settings.transactionsFilters;
  budgetOrder.value = auth.user?.settings.budgetOrder ?? [];
  if (!saved) return;

  const from = parseIsoDate(saved.from);
  const to = parseIsoDate(saved.to);
  period.value = from && to ? [from, to] : from ? [from] : [];
  selectedCategories.value = saved.categories ?? [];
  search.value = saved.search ?? "";
  activePanel.value = saved.activePanel ?? null;
  sortField.value = saved.sortField ?? "data";
  sortOrder.value = saved.sortOrder ?? 1;
}

function periodLabel(): string {
  const { from, to } = periodBounds();
  if (!from && !to) return "Selecione";
  if (from && to && from !== to) return `${fmtDateBR(from)} – ${fmtDateBR(to)}`;
  if (from) return fmtDateBR(from);
  return "Selecione";
}

function clearPeriod() {
  period.value = [];
  applyFilters();
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

function recalculateResumo(saldoDelta = 0) {
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
    // Saldo atual é global; só ajusta pelo delta da edição/exclusão.
    saldo: (Number(resumo.value.saldo) + saldoDelta).toFixed(2),
    qtd: rows.value.length,
    ultimaData: resumo.value.ultimaData,
  };
}

function applyFilters() {
  if (applyFiltersTimer) {
    clearTimeout(applyFiltersTimer);
    applyFiltersTimer = null;
  }
  categoryFilterOpen.value = false;
  load();
  scheduleSaveFilters();
}

function applySalaryCycleFilter() {
  const cycle = salaryCycle.value;
  if (!cycle) return;
  period.value = [cycle.start, cycle.end];
  applyFilters();
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
  categoryFilterOpen.value = false;
}

function onSortUpdate(items: { key: string; order: "asc" | "desc" }[]) {
  const first = items[0];
  if (!first) {
    // Vuetify pode emitir [] no ciclo asc→desc→clear; com must-sort isso
    // não deve ocorrer, mas se ocorrer mantém a coluna e inverte a ordem.
    sortOrder.value = sortOrder.value === 1 ? -1 : 1;
    scheduleSaveFilters();
    return;
  }
  sortField.value = first.key as TransactionSortField;
  sortOrder.value = first.order === "desc" ? -1 : 1;
  scheduleSaveFilters();
}

function saveBudgetOrder() {
  auth.saveSettings({
    budgetOrder: budgetOrder.value,
  }).catch(() => {
    snackbar.add({
      severity: "error",
      summary: "Erro",
      detail: "Não foi possível salvar a ordem do orçamento.",
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

function limparFiltros() {
  period.value = [];
  selectedCategories.value = [];
  search.value = "";
  categoryFilterOpen.value = false;
  applyFilters();
}

const hasFilter = computed(
  () =>
    period.value.length > 0 ||
    selectedCategories.value.length > 0 ||
    search.value.trim().length > 0,
);

async function onEditField(
  row: Transaction,
  field: "categoriaId" | "detalhe" | "observacao" | "data" | "tipo" | "valor",
  value: unknown,
) {
  try {
    const previousValor = Number(row.valor);
    const updated = await patchTransaction(row.identificador, { [field]: value as never });
    Object.assign(row, updated);
    if (field === "valor") {
      recalculateResumo(Number(updated.valor) - previousValor);
    }
    snackbar.add({ severity: "success", summary: "Atualizado", life: 1500 });
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: "Erro ao salvar",
      detail: (err as Error).message,
      life: 3000,
    });
  }
}

function onDelete(row: Transaction) {
  confirm.require({
      message: `Excluir esta transação? (${row.detalhe || row.tipo})`,
      header: "Confirmar exclusão",
    acceptLabel: "Excluir",
    rejectLabel: "Cancelar",
    accept: async () => {
      try {
        await deleteTransaction(row.identificador);
        await load();
        snackbar.add({ severity: "success", summary: "Excluída", life: 1500 });
      } catch (err) {
        snackbar.add({
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
    snackbar.add({
      severity: "warn",
        summary: "Sem padrão",
        detail: "Esta transação não tem texto suficiente para gerar regra.",
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
    snackbar.add({
      severity: "success",
      summary: "Regra criada",
      detail: `${padrao} -> ${row.categoriaId}`,
      life: 2500,
    });
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: "Erro ao gerar regra",
      detail: (err as Error).message,
      life: 3000,
    });
  }
}

function onImportFinished(stats: { totalImportadas: number; totalDuplicadas: number }) {
  snackbar.add({
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
const categoriaMenuOpen = ref(false);
let categoriaMenuCloseTimer: ReturnType<typeof setTimeout> | null = null;

async function startEditCategoria(row: Transaction) {
  clearCategoriaMenuCloseTimer();
  editingCategoriaId.value = row.identificador;
  categoriaMenuOpen.value = false;
  await nextTick();
  categoriaMenuOpen.value = true;
}

function clearCategoriaMenuCloseTimer() {
  if (categoriaMenuCloseTimer) {
    clearTimeout(categoriaMenuCloseTimer);
    categoriaMenuCloseTimer = null;
  }
}

function onCategoriaMenuChange(open: boolean) {
  categoriaMenuOpen.value = open;
  if (open) {
    clearCategoriaMenuCloseTimer();
    return;
  }
  clearCategoriaMenuCloseTimer();
  categoriaMenuCloseTimer = setTimeout(() => {
    categoriaMenuCloseTimer = null;
    if (editingCategoriaId.value) cancelCategoria();
  }, 200);
}

async function commitCategoria(row: Transaction, novoId: string) {
  if (novoId === row.categoriaId) return;
  clearCategoriaMenuCloseTimer();
  categoriaMenuOpen.value = false;
  editingCategoriaId.value = null;
  await onEditField(row, "categoriaId", novoId);
}

function cancelCategoria() {
  clearCategoriaMenuCloseTimer();
  categoriaMenuOpen.value = false;
  editingCategoriaId.value = null;
}

function colorForCategoria(id: string): string {
  const key = categoryCode(id, ref_.categories);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
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

const csvStale = computed(() => csvStaleDays(resumo.value.ultimaData));

const csvStaleMessage = computed(() => {
  if (resumo.value.ultimaData == null) {
    return "Ainda sem extrato — importe o CSV do Nubank (até D-1).";
  }
  const days = csvStale.value;
  if (days == null || days <= 0) return null;
  const label = days === 1 ? "1 dia" : `${days} dias`;
  return `Extrato atrasado ${label} — o CSV do banco fecha em D-1.`;
});

const salaryCycle = computed(() => {
  const paymentDay = auth.user?.settings.salaryCycle?.paymentDay;
  const bounds = resolveSalaryCycleBounds(new Date(), paymentDay);
  if (!bounds) return null;

  const start = startOfDay(bounds.start);
  const end = startOfDay(bounds.end);
  const today = startOfDay(new Date());
  const totalMs = Math.max(86_400_000, end.getTime() - start.getTime());
  const elapsedMs = today.getTime() - start.getTime();
  const elapsedDays = Math.max(0, Math.floor(elapsedMs / 86_400_000));
  const remainingDays = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000));
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

const tipoMenuOpen = ref(false);
let tipoMenuCloseTimer: ReturnType<typeof setTimeout> | null = null;

function clearTipoMenuCloseTimer() {
  if (tipoMenuCloseTimer) {
    clearTimeout(tipoMenuCloseTimer);
    tipoMenuCloseTimer = null;
  }
}

function tipoText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && "value" in value) {
    return String((value as { value: string }).value).trim();
  }
  return String(value ?? "").trim();
}

async function startEditCell(row: Transaction, field: EditField) {
  editingCell.value = { id: row.identificador, field };
  if (field === "data") dataDraft.value = parseIso(row.data);
  else if (field === "tipo") {
    tipoDraft.value = row.tipo;
    tipoMenuOpen.value = false;
    await nextTick();
    tipoMenuOpen.value = true;
  } else if (field === "valor") valorDraft.value = Number(row.valor);
}

function onTipoMenuChange(open: boolean) {
  tipoMenuOpen.value = open;
  if (open) {
    clearTipoMenuCloseTimer();
    return;
  }
  clearTipoMenuCloseTimer();
  tipoMenuCloseTimer = setTimeout(() => {
    tipoMenuCloseTimer = null;
    if (editingCell.value?.field === "tipo") cancelEditCell();
  }, 200);
}

async function onTipoPick(row: Transaction, value: unknown) {
  const novo = tipoText(value);
  tipoDraft.value = novo;
  if (!novo || novo === row.tipo) return;
  clearTipoMenuCloseTimer();
  tipoMenuOpen.value = false;
  editingCell.value = null;
  await onEditField(row, "tipo", novo);
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
  if (!novo || novo === row.tipo) return;
  tipoMenuOpen.value = false;
  editingCell.value = null;
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

const tipoOptions = computed(() => ref_.tipos.map((t) => ({ title: t, value: t })));

const transactionHeaders = [
  { title: "Data", key: "data", width: 130 },
  { title: "Tipo", key: "tipo", width: 200, sortable: false },
  { title: "Detalhe", key: "detalhe", width: 320, sortable: false },
  { title: "Valor", key: "valor", width: 160, align: "end" as const, sortable: false },
  { title: "Categoria", key: "categoriaId", width: 240, minWidth: 240, sortable: false },
  { title: "", key: "actions", sortable: false, width: 90 },
];

const sortedRows = computed(() => {
  const list = [...rows.value];
  if (sortField.value !== "data") return list;
  const order = sortOrder.value;
  list.sort((a, b) =>
    compareTransactionsByDateThenSalario(
      { data: a.data, categoryCode: categoryCode(a.categoriaId, ref_.categories) },
      { data: b.data, categoryCode: categoryCode(b.categoriaId, ref_.categories) },
      order,
    ),
  );
  return list;
});

/** Mantém a ordem de `sortedRows` (desempate SALÁRIO); a direção já foi aplicada. */
const dateKeySort = () => 0;

const sortByModel = computed({
  get: () => [
    {
      key: sortField.value,
      order: (sortOrder.value === -1 ? "desc" : "asc") as "asc" | "desc",
    },
  ],
  set: (items) => onSortUpdate(items),
});

// budget inline edit
const editingBudgetId = ref<string | null>(null);
const budgetValorDraft = ref<number | null>(null);

function startEditBudgetValor(b: BudgetItem) {
  if (b.origem === "assinaturas") return;
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
    snackbar.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar.', life: 3000 });
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
          <v-icon icon="mdi-filter" />
        </button>
        <button
          type="button"
          class="activity-item"
          :class="{ 'activity-item--active': activePanel === 'cats' }"
          :title="activePanel === 'cats' ? 'Ocultar resumo por categoria' : 'Mostrar resumo por categoria'"
          aria-label="Resumo por categoria"
          @click="togglePanel('cats')"
        >
          <v-icon icon="mdi-tag-multiple" />
        </button>
        <button
          type="button"
          class="activity-item"
          :class="{ 'activity-item--active': activePanel === 'budget' }"
          :title="activePanel === 'budget' ? 'Ocultar orçamento' : 'Mostrar orçamento'"
          aria-label="Orçamento previsto"
          @click="togglePanel('budget')"
        >
          <v-icon icon="mdi-wallet" />
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
              <v-menu v-model="periodMenu" :close-on-content-click="false">
                <template #activator="{ props: menuProps }">
                  <v-text-field
                    v-bind="menuProps"
                    :model-value="periodLabel()"
                    readonly
                    prepend-inner-icon="mdi-calendar"
                    placeholder="Selecione"
                    hide-details
                  />
                </template>
                <v-date-picker
                  v-model="period"
                  multiple="range"
                  @update:model-value="scheduleApplyFilters"
                />
              </v-menu>
              <v-btn
                v-if="period.length > 0"
                icon="mdi-close"
                variant="text"
                size="small"
                aria-label="Limpar período"
                @click="clearPeriod"
              />
            </div>
          </div>
          <div class="filter-group">
            <label class="filter-label">Categorias</label>
            <v-select
              v-model="selectedCategories"
              v-model:menu="categoryFilterOpen"
              :items="categoryOptions"
              item-title="label"
              item-value="value"
              placeholder="Todas"
              multiple
              chips
              closable-chips
              hide-details
              @update:model-value="onCategoryFilterChange"
            />
          </div>
          <div class="filter-group">
            <label class="filter-label">Buscar</label>
            <v-text-field
              v-model="search"
              placeholder="descrição ou detalhe"
              hide-details
              @keydown.enter="applyFilters"
            />
          </div>
          <div class="filter-actions">
            <v-btn color="primary" prepend-icon="mdi-filter" :loading="loading" @click="applyFilters">
              Filtrar
            </v-btn>
            <v-btn
              variant="outlined"
              prepend-icon="mdi-eraser"
              :disabled="!hasFilter"
              @click="limparFiltros"
            >
              Limpar
            </v-btn>
          </div>
        </div>
      </aside>

      <aside v-else-if="activePanel === 'cats'" class="side-panel side-card">
        <div class="side-card-header">Por categoria</div>
        <div v-if="categoriasResumo.length === 0" class="side-empty">
          <p>Nenhuma categoria no filtro atual.</p>
          <v-btn
            v-if="hasFilter"
            variant="text"
            size="small"
            color="primary"
            prepend-icon="mdi-eraser"
            @click="limparFiltros"
          >
            Limpar filtros
          </v-btn>
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
              <span class="cat-nome">{{ categoryPillLabel(c.id, ref_.categories) }}</span>
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
              <span class="budget-header-label">Restante</span>
              <span class="budget-header-total">{{ fmtMoneyBR(-totalPrevistoRestante) }}</span>
            </div>
          </div>
        </div>
        <div
          class="salary-cycle"
          :class="{ 'salary-cycle--clickable': salaryCycle }"
          :role="salaryCycle ? 'button' : undefined"
          :tabindex="salaryCycle ? 0 : undefined"
          :title="salaryCycle ? 'Filtrar pelo ciclo salarial' : undefined"
          :aria-label="salaryCycle ? 'Filtrar pelo ciclo salarial' : undefined"
          @click="applySalaryCycleFilter"
          @keydown.enter.prevent="applySalaryCycleFilter"
          @keydown.space.prevent="applySalaryCycleFilter"
        >
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
        <ul v-if="activeBudgetItems.length" class="cat-list">
          <li
            v-for="b in activeBudgetItems"
            :key="b.id"
            class="budget-item"
            :class="{
              'budget-item--system': b.origem === 'assinaturas',
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
                    <v-icon icon="mdi-drag" size="small" />
                  </span>
                  <span class="budget-item-nome">{{ b.descricao }}</span>
                  <v-icon
                    v-if="b.origem === 'assinaturas'"
                    class="budget-lock"
                    icon="mdi-lock-outline"
                    size="x-small"
                    title="Sincronizado pelas assinaturas"
                  />
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
                  <v-number-input
                    v-if="editingBudgetId === b.id"
                    v-model="budgetValorDraft"
                    :precision="2"
                    control-variant="hidden"
                    density="compact"
                    hide-details
                    class="budget-inline-input"
                    @blur="commitBudgetValor(b)"
                    @keydown.enter.prevent="commitBudgetValor(b)"
                    @keydown.esc.prevent="editingBudgetId = null"
                  />
                  <span
                    v-else
                    class="budget-edit-val"
                    :class="{ 'budget-edit-val--locked': b.origem === 'assinaturas' }"
                    :title="b.origem === 'assinaturas' ? 'Valor das assinaturas' : 'Clique para editar o previsto'"
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
                    <v-icon icon="mdi-drag" size="small" />
                  </span>
                  <span class="budget-item-nome">{{ b.descricao }}</span>
                  <v-icon
                    v-if="b.origem === 'assinaturas'"
                    class="budget-lock"
                    icon="mdi-lock-outline"
                    size="x-small"
                    title="Sincronizado pelas assinaturas"
                  />
                </div>
                <v-number-input
                  v-if="editingBudgetId === b.id"
                  v-model="budgetValorDraft"
                  :precision="2"
                  control-variant="hidden"
                  density="compact"
                  hide-details
                  class="budget-inline-input budget-inline-input--wide"
                  @blur="commitBudgetValor(b)"
                  @keydown.enter.prevent="commitBudgetValor(b)"
                  @keydown.esc.prevent="editingBudgetId = null"
                />
                <span
                  v-else
                  class="budget-item-val budget-edit-val"
                  :class="{ 'budget-edit-val--locked': b.origem === 'assinaturas' }"
                  :title="b.origem === 'assinaturas' ? 'Valor das assinaturas' : 'Clique para editar o previsto'"
                  @click="startEditBudgetValor(b)"
                >{{ fmtMoneyBR(b.valorMensal) }}</span>
              </div>
            </template>
          </li>
        </ul>
        <div v-else class="side-empty">
          <p>Nenhum item de orçamento ativo.</p>
          <RouterLink class="side-empty-link" to="/configuracoes">Abrir Configurações</RouterLink>
        </div>
      </aside>

      <div class="center-col">
        <div class="actions-bar">
          <v-btn color="success" prepend-icon="mdi-plus" @click="showManual = true">
            Nova transação
          </v-btn>
          <v-btn variant="outlined" prepend-icon="mdi-upload" @click="showImport = true">
            Importar CSV
          </v-btn>
          <p
            v-if="csvStaleMessage"
            class="csv-stale-hint"
            role="status"
          >
            <v-icon icon="mdi-calendar-clock" size="small" aria-hidden="true" />
            <span>{{ csvStaleMessage }}</span>
          </p>
        </div>
        <div class="summary-cards">
          <div
            class="summary-card summary-card--primary summary-card--tooltip"
            tabindex="0"
            :aria-label="`${saldoAtualTooltip.linha1} ${saldoAtualTooltip.linha2}`"
          >
            <div class="label">Saldo atual</div>
            <div class="value" :class="classMoney(resumo.saldo)">
              {{ fmtMoneyBR(resumo.saldo) }}
            </div>
            <div class="summary-tooltip summary-tooltip--left" role="tooltip">
              <div>{{ saldoAtualTooltip.linha1 }}</div>
              <div>{{ saldoAtualTooltip.linha2 }}</div>
            </div>
          </div>
          <div
            class="summary-card summary-card--emphasis summary-card--tooltip"
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

          <div
            class="summary-card summary-card--secondary summary-card--tooltip"
            tabindex="0"
            :aria-label="`${entradasTooltip.linha1} ${entradasTooltip.linha2}`"
          >
            <div class="label">Entradas</div>
            <div class="value money-cell summary-value--positive">
              {{ fmtMoneyBR(totalEntradasPeriodo) }}
            </div>
            <div class="summary-tooltip" role="tooltip">
              <div>{{ entradasTooltip.linha1 }}</div>
              <div>{{ entradasTooltip.linha2 }}</div>
            </div>
          </div>

          <div
            class="summary-card summary-card--secondary summary-card--tooltip"
            tabindex="0"
            :aria-label="`${saidasTooltip.linha1} ${saidasTooltip.linha2}`"
          >
            <div class="label">Saídas</div>
            <div class="value money-cell summary-value--negative">
              {{ fmtMoneyBR(totalSaidasPeriodo) }}
            </div>
            <div class="summary-tooltip" role="tooltip">
              <div>{{ saidasTooltip.linha1 }}</div>
              <div>{{ saidasTooltip.linha2 }}</div>
            </div>
          </div>
        </div>

        <v-data-table
          class="tx-table"
          :headers="transactionHeaders"
          :items="sortedRows"
          :loading="loading"
          v-model:sort-by="sortByModel"
          :custom-key-sort="{ data: dateKeySort }"
          must-sort
          item-value="identificador"
          :items-per-page="-1"
          hide-default-footer
          hover
        >
          <template #no-data>
            <div class="tx-empty">
              <p v-if="hasFilter" class="tx-empty-text">
                Nenhuma transação neste filtro.
              </p>
              <p v-else class="tx-empty-text">
                Ainda sem extrato neste período.
              </p>
              <div class="tx-empty-actions">
                <v-btn
                  v-if="hasFilter"
                  variant="outlined"
                  size="small"
                  prepend-icon="mdi-eraser"
                  @click="limparFiltros"
                >
                  Limpar filtros
                </v-btn>
                <v-btn
                  v-else
                  color="primary"
                  size="small"
                  prepend-icon="mdi-upload"
                  @click="showImport = true"
                >
                  Importar CSV
                </v-btn>
              </div>
            </div>
          </template>
          <template #item.data="{ item }">
            <v-menu v-if="isEditing(item, 'data')" :close-on-content-click="false">
              <template #activator="{ props: menuProps }">
                <v-text-field
                  v-bind="menuProps"
                  :model-value="dataDraft ? fmtDateBR(toIso(dataDraft) ?? '') : ''"
                  density="compact"
                  hide-details
                  autofocus
                />
              </template>
              <v-date-picker v-model="dataDraft" @update:model-value="commitData(item)" />
            </v-menu>
            <span
              v-else
              class="editable-cell"
              role="button"
              tabindex="0"
              title="Clique para editar"
              @click="startEditCell(item, 'data')"
              @keydown.enter.prevent="startEditCell(item, 'data')"
            >
              {{ fmtDateBR(item.data) }}
            </span>
          </template>
          <template #item.tipo="{ item }">
            <v-combobox
              v-if="isEditing(item, 'tipo')"
              v-model="tipoDraft"
              v-model:menu="tipoMenuOpen"
              :items="tipoOptions"
              item-title="title"
              item-value="value"
              density="compact"
              hide-details
              autofocus
              :menu-props="{ zIndex: 2500 }"
              @update:model-value="(v) => onTipoPick(item, v)"
              @update:menu="onTipoMenuChange"
              @keydown.esc.prevent="cancelEditCell"
            />
            <span
              v-else
              class="editable-cell"
              role="button"
              tabindex="0"
              title="Clique para editar"
              @click="startEditCell(item, 'tipo')"
              @keydown.enter.prevent="startEditCell(item, 'tipo')"
            >
              {{ item.tipo || "—" }}
            </span>
          </template>
          <template #item.detalhe="{ item }">
            <v-text-field
              v-if="editingDetalheId === item.identificador"
              v-model="detalheDraft"
              density="compact"
              hide-details
              autofocus
              @blur="commitDetalhe(item)"
              @keydown.enter.prevent="commitDetalhe(item)"
              @keydown.esc.prevent="cancelDetalhe"
            />
            <span
              v-else
              class="editable-cell"
              role="button"
              tabindex="0"
              title="Clique para editar"
              @click="startEditDetalhe(item)"
              @keydown.enter.prevent="startEditDetalhe(item)"
            >
              {{ item.detalhe || "—" }}
            </span>
          </template>
          <template #item.valor="{ item }">
            <v-number-input
              v-if="isEditing(item, 'valor')"
              v-model="valorDraft"
              :precision="2"
              control-variant="hidden"
              density="compact"
              hide-details
              class="value-editor"
              autofocus
              @blur="commitValor(item)"
              @keydown.enter.prevent="commitValor(item)"
              @keydown.esc.prevent="cancelEditCell"
            />
            <span
              v-else
              class="editable-cell money-cell"
              :class="classMoney(item.valor)"
              role="button"
              tabindex="0"
              title="Clique para editar"
              @click="startEditCell(item, 'valor')"
              @keydown.enter.prevent="startEditCell(item, 'valor')"
            >
              {{ fmtMoneyBR(item.valor) }}
            </span>
          </template>
          <template #item.categoriaId="{ item }">
            <v-autocomplete
              v-if="editingCategoriaId === item.identificador"
              :model-value="item.categoriaId"
              v-model:menu="categoriaMenuOpen"
              :items="categoryOptions"
              item-title="label"
              item-value="value"
              density="compact"
              hide-details
              autofocus
              :menu-props="{ zIndex: 2500 }"
              @update:model-value="(v) => commitCategoria(item, v as string)"
              @update:menu="onCategoriaMenuChange"
              @keydown.esc.prevent="cancelCategoria"
            />
            <button
              v-else
              type="button"
              class="cat-pill"
              :style="{ background: colorForCategoria(item.categoriaId) }"
              :title="'Clique para trocar (' + categoryCode(item.categoriaId, ref_.categories) + ')'"
              @click="startEditCategoria(item)"
            >
              <span class="cat-pill-nome">{{ categoryPillLabel(item.categoriaId, ref_.categories) }}</span>
            </button>
          </template>
          <template #item.actions="{ item }">
            <div class="row-actions">
              <v-btn
                icon="mdi-sitemap"
                variant="text"
                size="small"
                aria-label="Gerar regra"
                title="Gerar regra a partir desta linha"
                @click="onCreateRuleFromRow(item)"
              />
              <v-btn
                icon="mdi-delete"
                variant="text"
                color="error"
                size="small"
                aria-label="Excluir"
                title="Excluir transação"
                @click="onDelete(item)"
              />
            </div>
          </template>
        </v-data-table>
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
  border-right: 1px solid var(--app-border);
  background: var(--app-surface);
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
  color: var(--app-text-muted);
  cursor: pointer;
  position: relative;
  font-size: 1.1rem;
  transition: color 120ms, background 120ms;
}

.activity-item:hover {
  color: var(--app-text);
}

.activity-item--active {
  color: var(--app-primary);
}

.activity-item--active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--app-primary);
  border-radius: 0 2px 2px 0;
}

.side-panel {
  border-right: 1px solid var(--app-border);
  background: var(--app-surface);
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
  flex-wrap: wrap;
  gap: 0.5rem;
}

.csv-stale-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  padding: 0.35rem 0.65rem 0.35rem 0.55rem;
  border-left: 3px solid var(--app-accent-wash-deep);
  background: var(--app-accent-wash);
  color: #6b5344;
  font-size: 0.8rem;
  line-height: 1.35;
  border-radius: 0 8px 8px 0;
}

.csv-stale-hint .v-icon {
  color: #8a6a52;
  flex-shrink: 0;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.summary-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  padding: 0.85rem 1rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-surface);
  background: var(--app-surface);
  transition: border-color 140ms ease;
}

.summary-card--primary {
  border-color: rgba(30, 90, 168, 0.28);
  background: linear-gradient(180deg, var(--app-primary-wash) 0%, var(--app-surface) 72%);
}

.summary-card--primary .value {
  font-size: 1.4rem;
}

.summary-card--emphasis {
  border-color: rgba(226, 196, 173, 0.95);
}

.summary-card--secondary .value {
  font-size: 1.1rem;
  font-weight: 500;
}

.summary-card .label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--app-text-muted);
}

.summary-card .value {
  font-size: 1.25rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.summary-value--positive {
  color: #16a34a;
}

.summary-value--negative {
  color: #dc2626;
}

.summary-card--tooltip:focus-visible,
.summary-card--tooltip:hover {
  border-color: var(--app-primary);
}

.summary-tooltip {
  position: absolute;
  right: 0;
  bottom: calc(100% + 0.45rem);
  display: none;
  z-index: 3;
  width: min(320px, calc(100vw - 2rem));
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  background: #111827;
  color: #f9fafb;
  font-size: 0.75rem;
  line-height: 1.35;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.22);
}

.summary-tooltip--left {
  left: 0;
  right: auto;
}

.summary-card--tooltip:focus-visible .summary-tooltip,
.summary-card--tooltip:hover .summary-tooltip {
  display: grid;
  gap: 0.2rem;
}

.filters-card {
  background: var(--app-surface);
  overflow: hidden;
  height: 100%;
}

.filters-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  font-weight: 600;
  border-bottom: 1px solid var(--app-border);
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

.filter-row :deep(.v-field) {
  flex: 1;
  min-width: 0;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.filter-actions .v-btn {
  flex: 1;
}

.side-card {
  background: var(--app-surface);
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
  border-bottom: 1px solid var(--app-border);
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
  background: var(--app-border);
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
  border-left: 1px solid var(--app-border);
}

.budget-header-label {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--app-text-muted);
  line-height: 1.2;
}

.budget-header-total {
  font-size: 0.96rem;
  font-weight: 600;
  color: var(--app-text);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.salary-cycle {
  padding: 0.65rem 1rem 0.7rem;
  border-bottom: 1px solid var(--app-border);
}

.salary-cycle--clickable {
  cursor: pointer;
}

.salary-cycle--clickable:hover .salary-cycle-meta,
.salary-cycle--clickable:focus-visible .salary-cycle-meta,
.salary-cycle--clickable:hover .salary-cycle-dates,
.salary-cycle--clickable:focus-visible .salary-cycle-dates,
.salary-cycle--clickable:active .salary-cycle-meta,
.salary-cycle--clickable:active .salary-cycle-dates {
  color: var(--app-text, #1a1a1a);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.salary-cycle--clickable:focus-visible {
  outline: 2px solid var(--app-border, #c5c5c5);
  outline-offset: -2px;
}

.salary-cycle-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 0.45rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--app-border);
  font-size: 0.74rem;
  color: var(--app-text-muted);
}

.salary-cycle-bar-wrap {
  height: 16px;
  border-radius: 8px;
  background: var(--app-border);
  overflow: hidden;
}

.salary-cycle-bar {
  position: relative;
  height: 100%;
  min-width: 2rem;
  border-radius: 8px;
  background: var(--app-accent-wash-deep);
  transition: width 400ms;
}

.salary-cycle-bar--empty {
  background: #d1d5db;
}

.salary-cycle-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6B5E54;
  font-size: 0.64rem;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.salary-cycle-dates {
  display: flex;
  justify-content: space-between;
  margin-top: 0.35rem;
  color: var(--app-text-muted);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.side-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 1rem;
  font-size: 0.85rem;
  color: var(--app-text-muted);
}

.side-empty p {
  margin: 0;
}

.side-empty-link {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--app-primary);
  text-decoration: none;
}

.side-empty-link:hover {
  text-decoration: underline;
}

.tx-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem 1rem;
}

.tx-empty-text {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 0.9rem;
}

.tx-empty-actions {
  display: flex;
  gap: 0.5rem;
}

.tx-table {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-surface);
  overflow: hidden;
  background: var(--app-surface);
}

.tx-table :deep(.v-table__wrapper) {
  border-radius: 0;
}

.tx-table :deep(thead th) {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--app-surface) !important;
  border-bottom: 1px solid var(--app-border) !important;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--app-text-muted) !important;
  box-shadow: none !important;
}

.tx-table :deep(tbody tr:nth-child(even)) {
  background: rgba(28, 25, 23, 0.025);
}

.tx-table :deep(tbody tr:hover) {
  background: var(--app-highlight) !important;
}

.tx-table :deep(td) {
  border-bottom-color: rgba(28, 25, 23, 0.06) !important;
}

.tx-table :deep(.v-data-table__td),
.tx-table :deep(.v-data-table-rows-no-data) {
  font-size: 0.875rem;
}

/* Categoria: pílulas curtas (ALIMENTAÇÃO, SALÁRIO) não podem ser cortadas */
.tx-table :deep(th:nth-child(5)),
.tx-table :deep(td:nth-child(5)) {
  width: 240px;
  min-width: 240px;
  white-space: nowrap;
}

.budget-item--system {
  background: var(--app-accent-wash);
  border-left: 3px solid var(--app-accent-wash-deep);
}

.budget-lock {
  color: #8a6a52;
  margin-left: 0.15rem;
  flex-shrink: 0;
}

.activity-item:focus-visible {
  outline: 2px solid var(--app-primary);
  outline-offset: 2px;
}

.editable-cell:focus-visible {
  outline: 2px solid var(--app-primary);
  outline-offset: 1px;
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
  border-bottom: 1px solid var(--app-border);
  border-left: 3px solid transparent;
  transition: background 120ms;
}

.cat-item:hover {
  background: var(--app-highlight);
}

.cat-item--active {
  background: var(--app-highlight);
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
  border-bottom: 1px solid var(--app-border);
}

.budget-label { opacity: 0.7; }
.budget-total { font-weight: 600; }

.budget-item {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--app-border);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  transition: background 120ms;
}

.budget-item:nth-child(even) {
  background: rgba(0, 0, 0, 0.055);
}

.budget-item:hover {
  background: var(--app-highlight);
}

.budget-item--dragging {
  opacity: 0.55;
}

.budget-item--drag-over {
  outline: 2px solid var(--app-primary);
  outline-offset: -2px;
  background: var(--app-highlight);
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
  color: var(--app-text-muted);
  cursor: grab;
  flex: 0 0 auto;
}

.budget-drag-handle:active {
  cursor: grabbing;
}

.budget-drag-handle:hover {
  background: var(--app-highlight);
  color: var(--app-text);
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
  background: var(--app-border);
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
  border-bottom: 1px dashed var(--app-text-muted);
  transition: border-color 120ms;
}

.budget-edit-val:hover {
  border-bottom-color: var(--app-primary);
}

.budget-edit-val--locked,
.budget-edit-val--locked:hover {
  cursor: default;
  border-bottom: none;
}

@media (max-width: 1100px) {
  .summary-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .center-col {
    padding: 0.85rem;
  }

  .actions-bar {
    flex-wrap: wrap;
  }

  .actions-bar .v-btn {
    flex: 1 1 180px;
  }

  .summary-cards {
    grid-template-columns: 1fr;
  }
}

.tx-footer {
  display: flex;
  justify-content: flex-end;
  padding: 0.35rem 0.75rem;
}

.tx-count {
  font-size: 0.75rem;
  color: var(--app-text-muted);
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
  background: var(--app-highlight);
  outline: 1px dashed var(--app-border);
  outline-offset: 2px;
}

.money-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

:deep(.value-editor) {
  max-width: 140px;
  margin-left: auto;
}

.budget-inline-input {
  max-width: 90px;
  display: inline-block;
}

.budget-inline-input--wide {
  max-width: 100px;
}

.row-actions {
  display: flex;
  gap: 0.15rem;
  flex-wrap: nowrap;
  align-items: center;
}

.cat-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0.55rem 0.15rem 0.45rem;
  border-radius: 999px;
  border: 0;
  color: #1f2937;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  line-height: 1.15;
  max-width: none;
  transition: transform 120ms, filter 120ms;
}

.cat-pill:hover {
  filter: brightness(0.95);
  transform: translateY(-1px);
}

.cat-pill-nome {
  white-space: nowrap;
  overflow: visible;
}
</style>

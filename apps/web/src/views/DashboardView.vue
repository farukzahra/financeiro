<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { getDashboard, type Dashboard, type DashboardCategory } from "../lib/api";
import { fmtMoneyBR } from "../lib/format";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const currentYear = new Date().getFullYear();
const year = ref(currentYear);
const data = ref<Dashboard | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const selectedMonth = ref<number | null>(null);
const showYearCategories = ref(false);

const years = computed(() => (data.value?.years.length ? data.value.years : [year.value]));
const yearIndex = computed(() => years.value.indexOf(year.value));
const hasPreviousYear = computed(() => yearIndex.value > 0);
const hasNextYear = computed(
  () => yearIndex.value >= 0 && yearIndex.value < years.value.length - 1,
);

const months = computed(() => data.value?.months ?? []);
const totals = computed(() => data.value?.totals ?? null);
const hasData = computed(() => (totals.value?.qtd ?? 0) > 0);
const selected = computed(
  () => months.value.find((month) => month.month === selectedMonth.value) ?? null,
);
const selectedSaidas = computed(() =>
  (selected.value?.categorias ?? []).filter((cat) => Number(cat.saidas) < 0),
);
const yearCategories = computed(() =>
  (data.value?.categorias ?? []).filter((cat) => Number(cat.saidas) < 0),
);
const topCategory = computed(() => yearCategories.value[0] ?? null);
const biggestMonth = computed(() => data.value?.maiorGastoMes ?? null);
const mesesComSaidas = computed(() => totals.value?.mesesComSaidas ?? 0);
const mesesComSaidasLabel = computed(
  () => `${mesesComSaidas.value} ${mesesComSaidas.value === 1 ? "mês" : "meses"}`,
);
const maxMonthFlow = computed(() => {
  let max = 1;
  for (const month of months.value) {
    max = Math.max(max, Math.abs(Number(month.entradas)), Math.abs(Number(month.saidas)));
  }
  return max;
});
const maxCategoryExit = computed(() => {
  const top = topCategory.value;
  return top ? Math.max(1, Math.abs(Number(top.saidas))) : 1;
});

function money(value: string | number): string {
  return fmtMoneyBR(value);
}
function absMoney(value: string | number): string {
  return fmtMoneyBR(Math.abs(Number(value)));
}
function percent(part: string | number, total: string | number): string {
  const whole = Math.abs(Number(total));
  if (!whole) return "0%";
  const value = (Math.abs(Number(part)) / whole) * 100;
  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  })}%`;
}
function flowWidth(value: string | number): string {
  return `${Math.min(100, (Math.abs(Number(value)) / maxMonthFlow.value) * 100)}%`;
}
function categoryWidth(cat: DashboardCategory): string {
  return `${Math.min(100, (Math.abs(Number(cat.saidas)) / maxCategoryExit.value) * 100)}%`;
}
function saldoClass(value: string | number): string {
  const n = Number(value);
  if (n > 0) return "is-positive";
  if (n < 0) return "is-negative";
  return "";
}
function monthAria(month: Dashboard["months"][number]): string {
  const label = `${MONTH_NAMES[month.month - 1]} de ${year.value}`;
  if (!month.qtd) return `${label}: sem movimento`;
  return `${label}: entradas ${money(month.entradas)}, saídas ${absMoney(month.saidas)}`;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await getDashboard(year.value);
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

function setYear(next: number) {
  if (next === year.value) return;
  year.value = next;
  selectedMonth.value = null;
  void load();
}

function stepYear(delta: number) {
  const next = years.value[yearIndex.value + delta];
  if (next != null) setYear(next);
}

function toggleMonth(month: number) {
  selectedMonth.value = selectedMonth.value === month ? null : month;
}

onMounted(load);
</script>

<template>
  <div class="dash">
    <header class="dash-head">
      <div class="dash-head__title">
        <h1>Dashboard</h1>
        <p>Entradas, saídas e categorias do ano.</p>
      </div>

      <div class="year-switcher" role="group" aria-label="Selecionar ano">
        <span class="year-switcher__label">Ano</span>
        <button
          type="button"
          class="year-arrow"
          aria-label="Ano anterior"
          :disabled="!hasPreviousYear || loading"
          @click="stepYear(-1)"
        >
          <v-icon icon="mdi-chevron-left" size="20" />
        </button>
        <div class="year-options">
          <button
            v-for="option in years"
            :key="option"
            type="button"
            class="year-chip"
            :class="{ 'year-chip--active': option === year }"
            :aria-pressed="option === year"
            :disabled="loading"
            @click="setYear(option)"
          >
            {{ option }}
          </button>
        </div>
        <button
          type="button"
          class="year-arrow"
          aria-label="Próximo ano"
          :disabled="!hasNextYear || loading"
          @click="stepYear(1)"
        >
          <v-icon icon="mdi-chevron-right" size="20" />
        </button>
        <v-progress-circular
          v-if="loading"
          indeterminate
          size="16"
          width="2"
          color="primary"
          class="year-loading"
        />
      </div>
    </header>

    <div v-if="error" class="dash-state dash-state--error" role="alert">
      <v-icon icon="mdi-alert-circle-outline" size="28" />
      <p>{{ error }}</p>
      <button type="button" class="retry-btn" @click="load">Tentar de novo</button>
    </div>

    <div v-else-if="!data" class="dash-state">
      <v-progress-circular indeterminate color="primary" size="32" />
      <p>Carregando {{ year }}…</p>
    </div>

    <div v-else-if="!hasData" class="dash-state">
      <v-icon icon="mdi-chart-timeline-variant" size="40" />
      <p>Nenhuma transação em {{ year }}.</p>
      <RouterLink to="/" class="state-link">Ir para Transações</RouterLink>
    </div>

    <template v-else>
      <section class="summary-strip" aria-label="Resumo do ano">
        <article class="sum-card">
          <span class="sum-card__label">
            <span class="sum-card__dot sum-card__dot--in" aria-hidden="true" />
            Entradas no ano
          </span>
          <strong class="sum-card__value is-positive">{{ money(totals?.entradas ?? 0) }}</strong>
          <span class="sum-card__meta">{{ totals?.qtd ?? 0 }} lançamentos em {{ year }}</span>
        </article>
        <button
          type="button"
          class="sum-card sum-card--action"
          aria-haspopup="dialog"
          title="Ver saídas por categoria"
          @click="showYearCategories = true"
        >
          <span class="sum-card__label">
            <span class="sum-card__dot sum-card__dot--out" aria-hidden="true" />
            Saídas no ano
          </span>
          <strong class="sum-card__value is-negative">{{ absMoney(totals?.saidas ?? 0) }}</strong>
          <span class="sum-card__meta">
            média de {{ absMoney(totals?.mediaSaidas ?? 0) }} por mês com saídas
          </span>
          <span class="sum-card__hint">
            Ver categorias
            <v-icon icon="mdi-chevron-right" size="14" />
          </span>
        </button>
        <article class="sum-card">
          <span class="sum-card__label">
            <span class="sum-card__dot sum-card__dot--balance" aria-hidden="true" />
            Saldo do ano
          </span>
          <strong class="sum-card__value" :class="saldoClass(totals?.saldo ?? 0)">
            {{ money(totals?.saldo ?? 0) }}
          </strong>
          <span class="sum-card__meta">
            {{ mesesComSaidasLabel }} com saídas
          </span>
        </article>
        <article class="sum-card">
          <span class="sum-card__label">
            <span class="sum-card__dot sum-card__dot--peak" aria-hidden="true" />
            Mês de maior gasto
          </span>
          <strong class="sum-card__value is-negative">
            {{ biggestMonth ? absMoney(biggestMonth.saidas) : "—" }}
          </strong>
          <span class="sum-card__meta">
            {{ biggestMonth ? MONTH_NAMES[biggestMonth.month - 1] : "sem saídas no ano" }}
          </span>
        </article>
      </section>

      <div class="dash-columns">
        <section class="months-panel" aria-labelledby="months-title">
          <div class="section-head">
            <h2 id="months-title">Mês a mês</h2>
            <span>Clique em um mês para ver as categorias</span>
          </div>

          <div class="months-grid">
            <button
              v-for="month in months"
              :key="month.month"
              type="button"
              class="month-card"
              :class="{
                'month-card--active': selectedMonth === month.month,
                'month-card--empty': month.qtd === 0,
              }"
              :aria-expanded="selectedMonth === month.month"
              aria-controls="month-detail"
              :aria-label="monthAria(month)"
              @click="toggleMonth(month.month)"
            >
              <span class="month-card__top">
                <span class="month-card__name">{{ MONTH_SHORT[month.month - 1] }}</span>
                <span class="month-card__qtd">
                  {{ month.qtd ? `${month.qtd} lanç.` : "sem movimento" }}
                </span>
              </span>

              <template v-if="month.qtd">
                <span class="month-card__flow">
                  <span class="flow">
                    <span class="flow__label">Entradas</span>
                    <span class="flow__value is-positive">{{ money(month.entradas) }}</span>
                  </span>
                  <span class="flow">
                    <span class="flow__label">Saídas</span>
                    <span class="flow__value is-negative">{{ absMoney(month.saidas) }}</span>
                  </span>
                </span>

                <span class="month-card__bars" aria-hidden="true">
                  <span class="bar bar--in">
                    <span class="bar__fill" :style="{ width: flowWidth(month.entradas) }" />
                  </span>
                  <span class="bar bar--out">
                    <span class="bar__fill" :style="{ width: flowWidth(month.saidas) }" />
                  </span>
                </span>

                <span class="month-card__saldo" :class="saldoClass(month.saldo)">
                  <span>Saldo</span>
                  <span>{{ money(month.saldo) }}</span>
                </span>
              </template>

              <span v-else class="month-card__empty">Sem transações</span>
            </button>
          </div>
        </section>

        <section v-if="selected" id="month-detail" class="month-detail" aria-live="polite">
          <header class="detail-head">
            <div class="detail-title">
              <h2>{{ MONTH_NAMES[selected.month - 1] }} {{ year }}</h2>
              <p>{{ selected.qtd }} lançamentos · saldo {{ money(selected.saldo) }}</p>
            </div>
            <div class="detail-kpis">
              <span class="detail-kpi">
                <small>Entradas</small>
                <b class="is-positive">{{ money(selected.entradas) }}</b>
              </span>
              <span class="detail-kpi">
                <small>Saídas</small>
                <b class="is-negative">{{ absMoney(selected.saidas) }}</b>
              </span>
            </div>
            <button
              type="button"
              class="detail-close"
              aria-label="Fechar detalhe do mês"
              @click="selectedMonth = null"
            >
              <v-icon icon="mdi-close" size="18" />
            </button>
          </header>

          <div v-if="selectedSaidas.length" class="detail-table-wrap">
            <table class="detail-table">
              <thead>
                <tr>
                  <th scope="col">Categoria</th>
                  <th scope="col" class="num">Lançamentos</th>
                  <th scope="col" class="share-col">% das saídas</th>
                  <th scope="col" class="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="cat in selectedSaidas" :key="cat.categoriaId">
                  <td class="cat-cell">{{ cat.descricao }}</td>
                  <td class="num">{{ cat.qtd }}</td>
                  <td class="share-col">
                    <span class="share">
                      <span class="share__bar" aria-hidden="true">
                        <span :style="{ width: percent(cat.saidas, selected.saidas) }" />
                      </span>
                      <span class="share__pct">{{ percent(cat.saidas, selected.saidas) }}</span>
                    </span>
                  </td>
                  <td class="num strong">{{ absMoney(cat.saidas) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="detail-empty">Nenhuma saída registrada em {{ MONTH_NAMES[selected.month - 1] }}.</p>
        </section>
      </div>
    </template>

    <v-dialog v-model="showYearCategories" max-width="680">
      <v-card class="year-dialog">
        <header class="year-dialog__head">
          <div>
            <h2>Saídas por categoria</h2>
            <p>Acumulado de {{ year }}</p>
          </div>
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            aria-label="Fechar saídas por categoria"
            @click="showYearCategories = false"
          />
        </header>

        <div class="year-dialog__body">
          <p v-if="topCategory" class="top-cat">
            <v-icon icon="mdi-trophy-outline" size="16" />
            <span>
              Maior gasto:
              <strong>{{ topCategory.descricao }}</strong>
            </span>
            <b>{{ absMoney(topCategory.saidas) }}</b>
          </p>

          <ul v-if="yearCategories.length" class="cat-list">
            <li
              v-for="(cat, index) in yearCategories"
              :key="cat.categoriaId"
              class="cat-item"
              :class="{ 'cat-item--top': index === 0 }"
            >
              <div class="cat-item__row">
                <span class="cat-item__rank">{{ index + 1 }}</span>
                <span class="cat-item__name">{{ cat.descricao }}</span>
                <span class="cat-item__value">{{ absMoney(cat.saidas) }}</span>
              </div>
              <div class="cat-item__meter" aria-hidden="true">
                <span :style="{ width: categoryWidth(cat) }" />
              </div>
              <div class="cat-item__meta">
                {{ percent(cat.saidas, totals?.saidas ?? 0) }} das saídas · {{ cat.qtd }}
                {{ cat.qtd === 1 ? "lançamento" : "lançamentos" }}
              </div>
            </li>
          </ul>

          <p v-else class="cats-empty">Nenhuma saída registrada em {{ year }}.</p>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.dash {
  height: 100%;
  overflow-y: auto;
  padding: 1.25rem 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
}

.dash-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
}

.dash-head__title h1 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--app-text);
}

.dash-head__title p {
  margin: 0.2rem 0 0;
  font-size: 0.84rem;
  color: var(--app-text-muted);
}

.year-switcher {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.25rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-control);
  background: var(--app-surface);
}

.year-switcher__label {
  padding: 0 0.35rem 0 0.4rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--app-text-muted);
}

.year-options {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.year-chip {
  min-width: 58px;
  padding: 0.35rem 0.55rem;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--app-text-muted);
  font-family: var(--app-font-ui);
  font-size: 0.86rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}

.year-chip:hover:not(:disabled) {
  background: var(--app-highlight);
  color: var(--app-text);
}

.year-chip--active {
  background: var(--app-primary-wash);
  color: var(--app-primary-wash-text);
  font-weight: 600;
}

.year-chip:focus-visible,
.year-arrow:focus-visible,
.month-card:focus-visible,
.retry-btn:focus-visible,
.detail-close:focus-visible {
  outline: 2px solid var(--app-primary);
  outline-offset: 2px;
}

.year-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.year-arrow:hover:not(:disabled) {
  background: var(--app-highlight);
  color: var(--app-text);
}

.year-arrow:disabled,
.year-chip:disabled {
  opacity: 0.4;
  cursor: default;
}

.year-loading {
  margin-left: 0.2rem;
}

.dash-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  min-height: 240px;
  padding: 2rem;
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius-surface);
  background: var(--app-surface);
  color: var(--app-text-muted);
  text-align: center;
}

.dash-state p {
  margin: 0;
  font-size: 0.9rem;
}

.dash-state--error {
  border-style: solid;
  border-color: rgba(220, 38, 38, 0.3);
  color: #b91c1c;
}

.retry-btn,
.state-link {
  border: 1px solid var(--app-border);
  border-radius: 7px;
  background: var(--app-surface);
  color: var(--app-primary);
  padding: 0.4rem 0.8rem;
  font-family: var(--app-font-ui);
  font-size: 0.82rem;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
}

.retry-btn:hover,
.state-link:hover {
  background: var(--app-highlight);
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.sum-card {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  padding: 0.75rem 0.9rem 0.7rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-surface);
  background: var(--app-surface);
}

.sum-card__label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--app-text-muted);
}

.sum-card__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sum-card__dot--in {
  background: #16a34a;
}

.sum-card__dot--out {
  background: #dc2626;
}

.sum-card__dot--balance {
  background: var(--app-primary);
}

.sum-card__dot--peak {
  background: #b45309;
}

.sum-card__value {
  font-size: 1.3rem;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.sum-card__meta {
  font-size: 0.74rem;
  line-height: 1.3;
  color: var(--app-text-muted);
}

.sum-card--action {
  font-family: var(--app-font-ui);
  text-align: left;
  color: var(--app-text);
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease;
}

.sum-card--action:hover {
  border-color: rgba(220, 38, 38, 0.4);
  background: linear-gradient(180deg, #fdf1f1 0%, var(--app-surface) 70%);
}

.sum-card--action:focus-visible {
  outline: 2px solid var(--app-primary);
  outline-offset: 2px;
}

.sum-card__hint {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  margin-top: auto;
  padding-top: 0.15rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--app-primary);
}

.is-positive {
  color: #16a34a;
}

.is-negative {
  color: #dc2626;
}

.dash-columns {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.months-panel {
  min-width: 0;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
}

.section-head h2 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--app-text);
}

.section-head span {
  font-size: 0.74rem;
  color: var(--app-text-muted);
  text-align: right;
}

.months-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(178px, 1fr));
  gap: 0.55rem;
}

.month-card {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
  padding: 0.65rem 0.7rem 0.6rem;
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-surface);
  background: var(--app-surface);
  color: var(--app-text);
  font-family: var(--app-font-ui);
  text-align: left;
  cursor: pointer;
  transition: border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;
}

.month-card:hover {
  border-color: rgba(30, 90, 168, 0.4);
}

.month-card--active {
  border-color: var(--app-primary);
  background: linear-gradient(180deg, var(--app-primary-wash) 0%, var(--app-surface) 78%);
  box-shadow: inset 0 0 0 1px var(--app-primary);
}

.month-card--empty {
  color: var(--app-text-muted);
  background: color-mix(in srgb, var(--app-surface) 70%, var(--app-background));
}

.month-card__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
}

.month-card__name {
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.month-card__qtd {
  font-size: 0.68rem;
  color: var(--app-text-muted);
  white-space: nowrap;
}

.month-card__flow {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.flow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
}

.flow__label {
  font-size: 0.7rem;
  color: var(--app-text-muted);
}

.flow__value {
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.month-card__bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 0.05rem;
}

.bar {
  display: block;
  height: 4px;
  flex-shrink: 0;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.07);
  overflow: hidden;
}

.bar__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 220ms ease;
}

.bar--in .bar__fill {
  background: #16a34a;
}

.bar--out .bar__fill {
  background: #dc2626;
}

.month-card__saldo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--app-border);
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.month-card__saldo span:first-child {
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--app-text-muted);
}

.month-card__empty {
  padding: 0.55rem 0 0.35rem;
  font-size: 0.75rem;
  color: var(--app-text-muted);
}

.year-dialog {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-surface);
  overflow: hidden;
  background: var(--app-surface);
}

.year-dialog__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.1rem 0.7rem;
  border-bottom: 1px solid var(--app-border);
}

.year-dialog__head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--app-text);
}

.year-dialog__head p {
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
  color: var(--app-text-muted);
}

.year-dialog__body {
  max-height: min(70vh, 620px);
  overflow-y: auto;
  padding: 0.85rem 1.1rem 1.1rem;
}

.top-cat {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.65rem;
  padding: 0.45rem 0.55rem;
  border-radius: 7px;
  background: var(--app-accent-wash);
  color: #6b5344;
  font-size: 0.74rem;
  line-height: 1.3;
}

.top-cat .v-icon {
  color: #8a6a52;
  flex-shrink: 0;
}

.top-cat span {
  min-width: 0;
  flex: 1;
}

.top-cat strong {
  font-weight: 600;
}

.top-cat b {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.cat-list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cat-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.35rem 0.4rem 0.4rem;
  border-radius: 7px;
}

.cat-item--top {
  background: var(--app-primary-wash);
}

.cat-item__row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.cat-item__rank {
  min-width: 1rem;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--app-text-muted);
  font-variant-numeric: tabular-nums;
}

.cat-item--top .cat-item__rank {
  color: var(--app-primary-wash-text);
}

.cat-item__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 500;
}

.cat-item__value {
  font-size: 0.78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.cat-item__meter {
  height: 4px;
  margin-left: 1.4rem;
  border-radius: 2px;
  background: rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.cat-item__meter span {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--app-primary);
  transition: width 220ms ease;
}

.cat-item--top .cat-item__meter span {
  background: var(--app-primary-wash-text);
}

.cat-item__meta {
  margin-left: 1.4rem;
  font-size: 0.68rem;
  color: var(--app-text-muted);
  font-variant-numeric: tabular-nums;
}

.cats-empty {
  margin: 0;
  font-size: 0.8rem;
  color: var(--app-text-muted);
}

.month-detail {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-surface);
  background: var(--app-surface);
  padding: 0.85rem 1rem 1rem;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  padding-bottom: 0.7rem;
  border-bottom: 1px solid var(--app-border);
}

.detail-title {
  flex: 1;
  min-width: 200px;
}

.detail-title h2 {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--app-text);
}

.detail-title p {
  margin: 0.15rem 0 0;
  font-size: 0.75rem;
  color: var(--app-text-muted);
}

.detail-kpis {
  display: flex;
  gap: 1.25rem;
}

.detail-kpi {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  text-align: right;
}

.detail-kpi small {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--app-text-muted);
}

.detail-kpi b {
  font-size: 0.86rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.detail-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.detail-close:hover {
  background: var(--app-highlight);
  color: var(--app-text);
}

.detail-table-wrap {
  overflow-x: auto;
  margin-top: 0.35rem;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.detail-table th {
  padding: 0.45rem 0.5rem;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--app-text-muted);
  text-align: left;
  border-bottom: 1px solid var(--app-border);
}

.detail-table td {
  padding: 0.42rem 0.5rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.05);
  vertical-align: middle;
}

.detail-table tr:last-child td {
  border-bottom: 0;
}

.detail-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.detail-table .strong {
  font-weight: 600;
}

.cat-cell {
  font-weight: 500;
}

.share-col {
  width: 34%;
  min-width: 150px;
}

.share {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.share__bar {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.share__bar span {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: #dc2626;
  opacity: 0.75;
}

.share__pct {
  flex-shrink: 0;
  min-width: 3.1rem;
  text-align: right;
  font-size: 0.7rem;
  color: var(--app-text-muted);
  font-variant-numeric: tabular-nums;
}

.detail-empty {
  margin: 0.8rem 0 0;
  font-size: 0.8rem;
  color: var(--app-text-muted);
}

@media (max-width: 900px) {
  .summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .dash {
    padding: 0.9rem 0.75rem 1.5rem;
  }

  .dash-head {
    align-items: stretch;
  }

  .year-switcher {
    align-self: flex-start;
  }

  .months-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }

  .detail-kpis {
    gap: 0.9rem;
  }
}

@media (max-width: 520px) {
  .summary-strip {
    grid-template-columns: minmax(0, 1fr);
  }

  .share-col {
    display: none;
  }

  .month-detail {
    padding: 0.75rem 0.7rem 0.85rem;
  }
}
</style>

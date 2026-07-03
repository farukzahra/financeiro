<script setup lang="ts">
const buildVersion = import.meta.env.VITE_APP_VERSION;
const buildGitSha = import.meta.env.VITE_APP_GIT_SHA;
const buildTime = new Date(import.meta.env.VITE_BUILD_TIME);

const historyItems = [
  {
    build: "0.15.1",
    title: "Tabela de gastos sem paginação",
    detail:
      "A tabela principal de transações passa a exibir todas as linhas do período filtrado de uma vez, sem controles de paginação.",
  },
  {
    build: "0.15.0",
    title: "UI migrada para Vuetify",
    detail:
      "Substituição do PrimeVue por Vuetify 3 com tema azul e laranja, mantendo tabelas, filtros, modais e feedback da interface.",
  },
  {
    build: "0.14.2",
    title: "Tooltips nos cards de resumo",
    detail:
      "Cards de saldo, entradas e saídas agora exibem descrições curtas com fórmulas e contexto do período filtrado.",
  },
  {
    build: "0.14.1",
    title: "Tooltip do saldo líquido ajustado",
    detail:
      "Tooltip do saldo líquido foi reposicionado para melhorar leitura e evitar abertura para baixo do card.",
  },
  {
    build: "0.14.0",
    title: "Resumo com entradas e saídas",
    detail:
      "Painel principal agora mostra totais de entradas e saídas do período filtrado, mantendo os cards alinhados em telas grandes.",
  },
  {
    build: "0.13.0",
    title: "Dia de pagamento configurável",
    detail:
      "Ciclo salarial passa a usar dia de pagamento configurável, incluindo dia útil do mês com feriados bancários nacionais do Brasil.",
  },
  {
    build: "0.12.0",
    title: "Resumo de orçamento e saldo líquido",
    detail:
      "Tooltip com fórmula dinâmica, saldo líquido baseado no orçamento restante e cabeçalho de orçamento refinado.",
  },
  {
    build: "0.11.0",
    title: "Deploy multi-site na VPS",
    detail:
      "Financeiro preparado para rodar atrás de proxy e convivendo com faruk.dev.br e outros projetos no mesmo host.",
  },
  {
    build: "0.10.0",
    title: "Organização do repositório",
    detail:
      "README na raiz, documentação movida para docs, scripts em scripts/ e dados legados em dados/.",
  },
  {
    build: "0.9.0",
    title: "Autenticação e multiusuário",
    detail:
      "Login interno, logout, escopo por usuário e persistência de preferências em settings.",
  },
  {
    build: "0.8.0",
    title: "Deploy automático",
    detail:
      "Docker de produção, workflow de deploy na VPS e ambiente preparado para build e migrações automáticas.",
  },
  {
    build: "0.7.0",
    title: "Configurações persistentes",
    detail:
      "Filtros, ordenação, layout e ordem do orçamento salvos por usuário.",
  },
  {
    build: "0.6.0",
    title: "Orçamento previsto mais visual",
    detail:
      "Cores alternadas, progresso por item, porcentagens na barra e ciclo salarial no painel lateral.",
  },
  {
    build: "0.5.0",
    title: "Produtividade na lista",
    detail:
      "Ordenação por colunas, geração de regra direto da linha e melhorias de alinhamento na tabela.",
  },
] as const;

function formatBuildTime(date: Date) {
  return date.toLocaleString("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
</script>

<template>
  <section class="about-page">
    <div class="about-shell">
      <header class="about-hero">
        <div>
          <div class="about-eyebrow">Sobre o sistema</div>
          <h1>Financeiro</h1>
          <p>
            Painel rápido para entender a versão atual do app e o caminho que já
            foi construído até aqui.
          </p>
        </div>
        <div class="about-build-card">
          <div class="about-build-label">Versão atual do build</div>
          <div class="about-build-value">{{ buildVersion }}</div>
          <div v-if="buildGitSha" class="about-build-commit">Commit {{ buildGitSha }}</div>
          <div class="about-build-meta">Gerado em {{ formatBuildTime(buildTime) }}</div>
        </div>
      </header>

      <section class="about-section">
        <div class="about-section-title">Histórico curto</div>
        <div class="about-history">
          <article
            v-for="item in historyItems"
            :key="item.build"
            class="about-history-item"
          >
            <div class="about-history-build">{{ item.build }}</div>
            <div class="about-history-content">
              <h2>{{ item.title }}</h2>
              <p>{{ item.detail }}</p>
            </div>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.about-page {
  height: 100%;
  overflow-y: auto;
  background:
    radial-gradient(circle at top left, rgba(30, 90, 168, 0.12), transparent 24%),
    linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

.about-shell {
  width: min(1080px, calc(100vw - 2rem));
  margin: 0 auto;
  padding: 1.25rem 0 2rem;
  display: grid;
  gap: 1rem;
}

.about-hero,
.about-section {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 1.1rem 1.2rem;
}

.about-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(260px, 0.9fr);
  gap: 1rem;
  align-items: start;
}

.about-eyebrow {
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgb(var(--v-theme-primary));
}

h1 {
  margin: 0.45rem 0 0.35rem;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1;
}

p {
  margin: 0;
  color: var(--app-text-muted);
  line-height: 1.6;
}

.about-build-card {
  display: grid;
  gap: 0.35rem;
  padding: 0.95rem 1rem;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(30, 90, 168, 0.08), rgba(249, 115, 22, 0.04));
  border: 1px solid rgba(30, 90, 168, 0.18);
}

.about-build-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-primary));
}

.about-build-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.about-build-meta {
  font-size: 0.82rem;
  color: var(--app-text-muted);
}

.about-build-commit {
  font-size: 0.82rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  font-variant-numeric: tabular-nums;
}

.about-section {
  display: grid;
  gap: 0.85rem;
}

.about-section-title {
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--app-text-muted);
}

.about-history {
  display: grid;
  gap: 0.75rem;
}

.about-history-item {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 0.9rem;
  padding: 0.95rem 0;
  border-top: 1px solid var(--app-border);
}

.about-history-item:first-child {
  border-top: 0;
  padding-top: 0;
}

.about-history-build {
  display: inline-flex;
  align-self: start;
  justify-content: center;
  padding: 0.35rem 0.55rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
  font-size: 0.78rem;
  font-weight: 700;
}

.about-history-content {
  min-width: 0;
}

.about-history-content h2 {
  margin: 0 0 0.22rem;
  font-size: 1rem;
}

.about-history-content p {
  font-size: 0.92rem;
}

@media (max-width: 760px) {
  .about-shell {
    width: min(100vw, calc(100vw - 1rem));
    padding-top: 0.75rem;
  }

  .about-hero {
    grid-template-columns: 1fr;
  }

  .about-history-item {
    grid-template-columns: 1fr;
    gap: 0.55rem;
  }
}
</style>

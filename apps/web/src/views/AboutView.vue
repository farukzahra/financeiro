<script setup lang="ts">
import releaseHistory from "../../../../docs/release-history.json";

const buildVersion = import.meta.env.VITE_APP_VERSION;
const buildGitSha = import.meta.env.VITE_APP_GIT_SHA;
const buildTime = new Date(import.meta.env.VITE_BUILD_TIME);

const historyItems = releaseHistory.entries;

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
            :key="item.version"
            class="about-history-item"
          >
            <div class="about-history-build">{{ item.version }}</div>
            <div class="about-history-content">
              <h2>{{ item.title }}</h2>
              <p>{{ item.summary }}</p>
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

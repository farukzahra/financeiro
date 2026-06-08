<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import Toast from "primevue/toast";
import ConfirmDialog from "primevue/confirmdialog";
</script>

<template>
  <Toast />
  <ConfirmDialog />
  <header class="app-header">
    <div style="display: flex; align-items: center; gap: 1rem">
      <strong>Financeiro</strong>
      <nav style="display: flex; gap: 0.75rem">
        <RouterLink to="/">Transacoes</RouterLink>
        <RouterLink to="/configuracoes">Configuracoes</RouterLink>
      </nav>
    </div>
  </header>
  <main class="app-shell">
    <RouterView />
  </main>
</template>

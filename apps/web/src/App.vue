<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
import Toast from "primevue/toast";
import ConfirmDialog from "primevue/confirmdialog";
</script>

<template>
  <Toast />
  <ConfirmDialog />
  <header class="app-header">
    <div class="app-header-brand">
      <span class="app-header-logo">₢</span>
      <span class="app-header-title">Financeiro</span>
    </div>
    <nav class="app-header-nav">
      <RouterLink to="/" class="app-nav-link">
        <i class="pi pi-list" />
        Transações
      </RouterLink>
      <RouterLink to="/configuracoes" class="app-nav-link">
        <i class="pi pi-cog" />
        Configurações
      </RouterLink>
    </nav>
  </header>
  <main class="app-shell">
    <RouterView />
  </main>
</template>

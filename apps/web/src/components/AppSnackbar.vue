<script setup lang="ts">
import { useSnackbar } from "../composables/useSnackbar";

const { state } = useSnackbar();
</script>

<template>
  <v-snackbar
    v-model="state.show"
    class="app-snackbar"
    :color="state.color"
    :timeout="state.timeout"
    location="top"
    rounded="lg"
  >
    {{ state.message }}
  </v-snackbar>
</template>

<style>
.app-snackbar.v-snackbar--variant-elevated,
.app-snackbar .v-snackbar__wrapper {
  box-shadow: 0 8px 24px rgba(28, 25, 23, 0.16) !important;
}

.app-snackbar.bg-success,
.app-snackbar .v-snackbar__wrapper.bg-success {
  background: #e8f5e9 !important;
  color: #166534 !important;
}

.app-snackbar.bg-error,
.app-snackbar .v-snackbar__wrapper.bg-error {
  background: #fef2f2 !important;
  color: #991b1b !important;
}

.app-snackbar.bg-warning,
.app-snackbar .v-snackbar__wrapper.bg-warning {
  background: var(--app-accent-wash) !important;
  color: #6b5344 !important;
}

.app-snackbar.bg-info,
.app-snackbar .v-snackbar__wrapper.bg-info {
  background: var(--app-primary-wash) !important;
  color: var(--app-primary-wash-text) !important;
}
</style>

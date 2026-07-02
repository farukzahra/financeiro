<script setup lang="ts">
import { useConfirm } from "../composables/useConfirm";

const confirm = useConfirm();
</script>

<template>
  <v-dialog v-model="confirm.state.open" max-width="420">
    <v-card>
      <v-card-title>{{ confirm.state.title }}</v-card-title>
      <v-card-text>{{ confirm.state.message }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirm.reject()">
          {{ confirm.state.rejectLabel }}
        </v-btn>
        <v-btn color="error" variant="flat" :loading="confirm.state.loading" @click="confirm.accept()">
          {{ confirm.state.acceptLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

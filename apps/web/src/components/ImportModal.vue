<script setup lang="ts">
import { ref, computed } from "vue";
import { useSnackbar } from "../composables/useSnackbar";
import { useReferenceStore } from "../stores/reference";
import {
  preview as previewImport,
  confirmImport,
  type PreviewResponse,
} from "../lib/api";
import { fmtMoneyBR, fmtDateBR, classMoney } from "../lib/format";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "imported", stats: { totalImportadas: number; totalDuplicadas: number }): void;
}>();

const ref_ = useReferenceStore();
const snackbar = useSnackbar();

const step = ref<"upload" | "preview" | "confirming">("upload");
const loading = ref(false);
const preview = ref<PreviewResponse | null>(null);
const selectedIds = ref(new Set<string>());

const visibleProxy = computed({
  get: () => props.visible,
  set: (v) => emit("update:visible", v),
});

const previewHeaders = [
  { title: "", key: "select", sortable: false, width: 44 },
  { title: "Data", key: "data", width: 100 },
  { title: "Tipo", key: "tipo", width: 170 },
  { title: "Detalhe", key: "detalhe" },
  { title: "Categoria", key: "categoriaSugerida", width: 220, sortable: false },
  { title: "Valor", key: "valor", width: 130 },
  { title: "Origem", key: "regraAplicada", width: 110 },
  { title: "", key: "actions", sortable: false, width: 60 },
];

function reset() {
  step.value = "upload";
  preview.value = null;
  loading.value = false;
  selectedIds.value = new Set();
}

function removeItem(id: string) {
  if (!preview.value) return;
  preview.value.itens = preview.value.itens.filter((i) => i.identificador !== id);
}

async function onSelect(files: File | File[] | null) {
  const file = Array.isArray(files) ? files[0] : files;
  if (!file) return;
  loading.value = true;
  try {
    if (!ref_.loaded) await ref_.load();
    const data = await previewImport(file);
    preview.value = data;
    selectedIds.value = new Set();
    step.value = "preview";
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: "Erro no preview",
      detail: (err as Error).message,
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
}

async function onConfirm() {
  if (!preview.value) return;
  step.value = "confirming";
  try {
    const novos = preview.value.itens.filter(
      (i) => !i.jaExistente && selectedIds.value.has(i.identificador),
    );
    const result = await confirmImport({
      metadata: preview.value.metadata,
      itens: novos.map((i) => ({
        identificador: i.identificador,
        data: i.data,
        valor: i.valor,
        descricaoRaw: i.descricaoRaw,
        tipo: i.tipo,
        detalhe: i.detalhe,
        chaveNormalizada: i.chaveNormalizada,
        categoriaId: i.categoriaSugerida,
        categoryRuleId: i.categoryRuleId,
        regraAplicada: i.regraAplicada,
      })),
    });
    emit("imported", {
      totalImportadas: result.totalImportadas,
      totalDuplicadas: result.totalDuplicadas,
    });
    visibleProxy.value = false;
    reset();
  } catch (err) {
    snackbar.add({
      severity: "error",
      summary: "Erro ao confirmar",
      detail: (err as Error).message,
      life: 4000,
    });
    step.value = "preview";
  }
}

const categoryOptions = computed(() => ref_.categoryOptions);

const novosCount = computed(
  () => preview.value?.itens.filter((i) => !i.jaExistente).length ?? 0,
);
const dupCount = computed(
  () => preview.value?.itens.filter((i) => i.jaExistente).length ?? 0,
);

const novosDisponiveis = computed(
  () => preview.value?.itens.filter((i) => !i.jaExistente) ?? [],
);
const selectedCount = computed(
  () => novosDisponiveis.value.filter((i) => selectedIds.value.has(i.identificador)).length,
);
const allSelected = computed(
  () => novosDisponiveis.value.length > 0 && selectedCount.value === novosDisponiveis.value.length,
);
const someSelected = computed(
  () => selectedCount.value > 0 && !allSelected.value,
);

function toggleItem(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id);
  else selectedIds.value.add(id);
  selectedIds.value = new Set(selectedIds.value);
}

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(novosDisponiveis.value.map((i) => i.identificador));
  }
}
</script>

<template>
  <v-dialog
    v-model="visibleProxy"
    max-width="1200"
    width="95vw"
    @after-leave="reset"
  >
    <v-card title="Importar extrato">
      <v-card-text>
        <div v-if="step === 'upload'">
          <p>Selecione um arquivo CSV do Nubank (formato NU_&lt;conta&gt;_&lt;periodo&gt;.csv).</p>
          <v-file-input
            accept=".csv"
            label="Selecionar arquivo"
            prepend-icon="mdi-file-upload"
            @update:model-value="onSelect"
          />
          <div v-if="loading" class="upload-loading">
            <v-progress-circular indeterminate size="24" />
            Processando...
          </div>
        </div>

        <div v-else-if="step === 'preview' && preview">
          <div class="preview-meta">
            <div><strong>Arquivo:</strong> {{ preview.metadata.nomeArquivo }}</div>
            <div><strong>Conta:</strong> {{ preview.metadata.conta }}</div>
            <div>
              <strong>Período:</strong>
              {{ fmtDateBR(preview.metadata.periodoInicio) }} -
              {{ fmtDateBR(preview.metadata.periodoFim) }}
            </div>
            <div><strong>Total:</strong> {{ preview.metadata.totalLinhas }}</div>
            <v-chip color="success" size="small">Novas: {{ novosCount }}</v-chip>
            <v-chip color="warning" size="small">Duplicadas: {{ dupCount }}</v-chip>
            <v-chip size="small">Selecionadas: {{ selectedCount }}</v-chip>
            <v-chip
              v-if="preview.metadata.jaImportadoEm"
              color="info"
              size="small"
            >
              Arquivo já foi importado antes
            </v-chip>
          </div>

          <v-data-table
            :headers="previewHeaders"
            :items="preview.itens"
            item-value="identificador"
            :items-per-page="-1"
            hide-default-footer
            height="55vh"
            fixed-header
            striped="even"
          >
            <template #header.select>
              <v-checkbox-btn
                :model-value="allSelected"
                :indeterminate="someSelected"
                @update:model-value="toggleAll"
              />
            </template>
            <template #item.select="{ item }">
              <v-checkbox-btn
                v-if="!item.jaExistente"
                :model-value="selectedIds.has(item.identificador)"
                @update:model-value="toggleItem(item.identificador)"
              />
              <v-icon
                v-else
                icon="mdi-content-copy"
                color="warning"
                size="small"
                title="Já existe"
              />
            </template>
            <template #item.data="{ item }">{{ fmtDateBR(item.data) }}</template>
            <template #item.categoriaSugerida="{ item }">
              <v-autocomplete
                v-model="item.categoriaSugerida"
                :items="categoryOptions"
                item-title="label"
                item-value="value"
                density="compact"
                hide-details
              />
            </template>
            <template #item.valor="{ item }">
              <span :class="classMoney(item.valor)">{{ fmtMoneyBR(item.valor) }}</span>
            </template>
            <template #item.actions="{ item }">
              <v-btn
                icon="mdi-delete"
                variant="text"
                color="error"
                size="small"
                aria-label="Remover"
                @click="removeItem(item.identificador)"
              />
            </template>
          </v-data-table>
        </div>

        <div v-else-if="step === 'confirming'" class="confirming">
          <v-progress-circular indeterminate />
          Confirmando...
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="visibleProxy = false">Cancelar</v-btn>
        <v-btn
          v-if="step === 'preview'"
          color="primary"
          :disabled="selectedCount === 0"
          @click="onConfirm"
        >
          {{ selectedCount === 0 ? "Confirmar" : `Confirmar (${selectedCount})` }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.upload-loading,
.confirming {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.preview-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
  align-items: center;
}
</style>

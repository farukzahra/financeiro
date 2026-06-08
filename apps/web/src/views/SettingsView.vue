<script setup lang="ts">
import { ref, onMounted } from "vue";
import TabView from "primevue/tabview";
import TabPanel from "primevue/tabpanel";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import { useReferenceStore } from "../stores/reference";

const ref_ = useReferenceStore();
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    if (!ref_.loaded) await ref_.load();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section>
    <h2>Configuracoes</h2>
    <TabView>
      <TabPanel header="Categorias">
        <DataTable :value="ref_.categories" :loading="loading" size="small" stripedRows>
          <Column field="id" header="Id" />
          <Column field="letra" header="Letra" />
          <Column field="descricao" header="Descricao" />
          <Column field="ativa" header="Ativa">
            <template #body="{ data }">
              <Tag :severity="data.ativa ? 'success' : 'secondary'" :value="data.ativa ? 'sim' : 'nao'" />
            </template>
          </Column>
        </DataTable>
      </TabPanel>
      <TabPanel header="Regras">
        <DataTable :value="ref_.rules" :loading="loading" size="small" stripedRows>
          <Column field="prioridade" header="Prio" :style="{ width: '70px' }" />
          <Column field="tipoPadrao" header="Tipo" :style="{ width: '110px' }" />
          <Column field="padrao" header="Padrao" />
          <Column field="categoriaId" header="Categoria" :style="{ width: '180px' }" />
          <Column field="ativa" header="Ativa" :style="{ width: '90px' }">
            <template #body="{ data }">
              <Tag :severity="data.ativa ? 'success' : 'secondary'" :value="data.ativa ? 'sim' : 'nao'" />
            </template>
          </Column>
        </DataTable>
      </TabPanel>
    </TabView>
  </section>
</template>

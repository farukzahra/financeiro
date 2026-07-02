import { reactive } from "vue";

type ConfirmOptions = {
  message: string;
  header?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  accept?: () => void | Promise<void>;
};

const state = reactive({
  open: false,
  message: "",
  title: "Confirmar",
  acceptLabel: "Confirmar",
  rejectLabel: "Cancelar",
  loading: false,
  _accept: null as (() => void | Promise<void>) | null,
});

export function useConfirm() {
  return {
    state,
    require(options: ConfirmOptions) {
      state.message = options.message;
      state.title = options.header ?? "Confirmar";
      state.acceptLabel = options.acceptLabel ?? "Confirmar";
      state.rejectLabel = options.rejectLabel ?? "Cancelar";
      state._accept = options.accept ?? null;
      state.loading = false;
      state.open = true;
    },
    async accept() {
      if (!state._accept) {
        state.open = false;
        return;
      }
      state.loading = true;
      try {
        await state._accept();
        state.open = false;
      } finally {
        state.loading = false;
      }
    },
    reject() {
      state.open = false;
      state._accept = null;
    },
  };
}

import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify } from "vuetify";
import { pt } from "vuetify/locale";

/** Azul profissional + laranja energético — contraste alto, bom para financeiro */
const financeiroTheme = {
  dark: false,
  colors: {
    primary: "#1E5AA8",
    secondary: "#E2C4AD",
    accent: "#EDD9C8",
    success: "#16A34A",
    warning: "#CA8A04",
    error: "#DC2626",
    info: "#0284C7",
    background: "#F8FAFC",
    surface: "#FFFFFF",
  },
};

export default createVuetify({
  locale: {
    locale: "pt",
    messages: { pt },
  },
  theme: {
    defaultTheme: "financeiro",
    themes: {
      financeiro: financeiroTheme,
    },
  },
  defaults: {
    VBtn: {
      rounded: "lg",
    },
    VTextField: {
      variant: "outlined",
      density: "compact",
      hideDetails: "auto",
    },
    VSelect: {
      variant: "outlined",
      density: "compact",
      hideDetails: "auto",
    },
    VAutocomplete: {
      variant: "outlined",
      density: "compact",
      hideDetails: "auto",
    },
    VCombobox: {
      variant: "outlined",
      density: "compact",
      hideDetails: "auto",
    },
    VTextarea: {
      variant: "outlined",
      density: "compact",
      hideDetails: "auto",
    },
    VNumberInput: {
      variant: "outlined",
      density: "compact",
      hideDetails: "auto",
    },
    VCheckbox: {
      density: "compact",
      hideDetails: "auto",
    },
    VDataTable: {
      density: "compact",
    },
  },
});

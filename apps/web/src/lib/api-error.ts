import axios from "axios";

type ZodFlatten = {
  fieldErrors?: Record<string, string[]>;
  formErrors?: string[];
};

type ApiErrorBody = {
  error?: string | ZodFlatten;
};

const KNOWN_MESSAGES: Record<string, string> = {
  "Email ou senha invalidos":
    "E-mail ou senha incorretos. Verifique os dados e tente novamente.",
  "Email ja cadastrado":
    "Este e-mail já está cadastrado. Faça login ou use outro e-mail.",
  "Nao autenticado": "Sua sessão expirou. Faça login novamente.",
  "Usuario nao encontrado": "Usuário não encontrado.",
  "Arquivo obrigatorio": "Selecione um arquivo CSV ou ZIP para importar.",
  "Categoria invalida": "Categoria inválida.",
  "Categoria ja existe": "Já existe uma categoria com esse código.",
  "Nao encontrada": "Registro não encontrado.",
  "Nao encontrado": "Registro não encontrado.",
  "Sem mudancas": "Nenhuma alteração foi informada.",
  "Nada para atualizar": "Nenhuma alteração foi informada.",
  "Item de sistema não pode ser editado":
    "Este item é sincronizado automaticamente e não pode ser editado.",
  "Item de sistema não pode ser excluído":
    "Este item é sincronizado automaticamente e não pode ser excluído.",
  "Já existe assinatura com esse nome": "Já existe uma assinatura com esse nome.",
};

const FIELD_LABELS: Record<string, string> = {
  email: "E-mail",
  password: "Senha",
  name: "Nome",
  code: "Código",
  descricao: "Descrição",
  padrao: "Padrão",
  categoriaId: "Categoria",
  valorMensal: "Valor mensal",
  nome: "Nome",
};

const ZOD_MESSAGES: Record<string, string> = {
  "Invalid email": "Informe um e-mail válido.",
  "Required": "Campo obrigatório.",
  "String must contain at least 6 character(s)": "A senha deve ter pelo menos 6 caracteres.",
  "Senha deve ter pelo menos 6 caracteres": "A senha deve ter pelo menos 6 caracteres.",
};

function translateZodMessage(message: string): string {
  return ZOD_MESSAGES[message] ?? message;
}

function formatZodFlatten(flatten: ZodFlatten): string {
  const parts: string[] = [];

  for (const message of flatten.formErrors ?? []) {
    parts.push(translateZodMessage(message));
  }

  for (const [field, messages] of Object.entries(flatten.fieldErrors ?? {})) {
    if (!messages?.length) continue;
    const label = FIELD_LABELS[field] ?? field;
    const translated = messages.map(translateZodMessage).join(", ");
    parts.push(`${label}: ${translated}`);
  }

  return parts.join(" ") || "Dados inválidos. Revise os campos e tente novamente.";
}

function statusFallback(status: number): string {
  switch (status) {
    case 400:
      return "Dados inválidos. Revise os campos e tente novamente.";
    case 401:
      return "Não autorizado. Verifique suas credenciais ou faça login novamente.";
    case 403:
      return "Você não tem permissão para esta ação.";
    case 404:
      return "Registro não encontrado.";
    case 409:
      return "Conflito: o registro já existe ou está em uso.";
    case 422:
      return "Não foi possível processar os dados enviados.";
    case 500:
      return "Erro interno do servidor. Tente novamente em instantes.";
    default:
      return status >= 500
        ? "Erro no servidor. Tente novamente mais tarde."
        : "Não foi possível concluir a operação.";
  }
}

export function formatApiError(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : "Erro desconhecido.";
  }

  if (!err.response) {
    return "Não foi possível conectar ao servidor. Verifique se a API está no ar.";
  }

  const body = err.response.data as ApiErrorBody | undefined;
  const status = err.response.status;

  if (body?.error !== undefined) {
    if (typeof body.error === "string") {
      return KNOWN_MESSAGES[body.error] ?? body.error;
    }
    return formatZodFlatten(body.error);
  }

  return statusFallback(status);
}

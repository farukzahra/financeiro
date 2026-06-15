"""
bootstrap_merchants.py

Le todos os CSVs de extrato do Nubank em uma pasta de entrada e gera uma
planilha (CSV) com os "detalhes" (merchants / contrapartes) unicos
normalizados, ordenados por valor absoluto total movimentado.

Saida tem colunas:
    detalhe_normalizado, tipo_predominante, ocorrencias, total, total_abs,
    entradas, saidas, exemplo_original, categoria

A coluna `categoria` fica vazia para o usuario preencher manualmente.
Depois, um proximo script transforma essa planilha preenchida em
`categorias.yaml`.

Uso:
    python scripts/legacy/bootstrap_merchants.py [pasta_entrada] [arquivo_saida]

Defaults:
    pasta_entrada = exemplo_input
    arquivo_saida = dados/csv/merchants_para_classificar.csv
"""

from __future__ import annotations

import csv
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path


# ---------------------------------------------------------------------------
# Normalizacao
# ---------------------------------------------------------------------------

_SUFIXO_NUMERICO = re.compile(r"[\s\-]*\d+\s*$")
_ESPACOS = re.compile(r"\s+")


def remover_acentos(s: str) -> str:
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def normalizar_detalhe(detalhe: str) -> str:
    """Normaliza o texto do merchant/contraparte para servir de chave."""
    if not detalhe:
        return ""
    s = remover_acentos(detalhe).upper()
    s = _ESPACOS.sub(" ", s).strip()
    # remove sufixo numerico do final (ex.: "POSTO PELANDA 3", "RAIA3243")
    s = _SUFIXO_NUMERICO.sub("", s).strip()
    return s


# ---------------------------------------------------------------------------
# Parser de transacoes
# ---------------------------------------------------------------------------

@dataclass
class Transacao:
    id: str
    data: str
    valor: Decimal
    descricao_raw: str
    tipo: str
    detalhe: str
    arquivo: str


def split_descricao(desc: str) -> tuple[str, str]:
    """Divide a descricao em (tipo, detalhe) pelo primeiro ' - '."""
    desc = desc.strip()
    sep = " - "
    idx = desc.find(sep)
    if idx == -1:
        return desc, ""
    return desc[:idx].strip(), desc[idx + len(sep):].strip()


def extrair_nome_pix(detalhe: str) -> str:
    """Para Pix, o detalhe e: '<NOME> - <CPF|CNPJ> - <BANCO>...'
    Queremos so o nome (parte antes do primeiro ' - ').
    Tambem trata a forma curta '<NOME> (Transferencia enviada)'.
    """
    if not detalhe:
        return ""
    nome = detalhe.split(" - ", 1)[0]
    # remove parenteses do final do tipo curto
    nome = re.sub(r"\s*\([^)]*\)\s*$", "", nome).strip()
    return nome


# Tipos de operacao que ja sao auto-categorizados (Camada 1 do plano).
# Esses grupos NAO entram na planilha de classificacao manual.
TIPOS_AUTOMATICOS: dict[str, str] = {
    "Transferência enviada pelo Pix":  "PIX",
    "Transferência recebida pelo Pix": "PIX",
    "Transferência Recebida":          "PIX",
    "Transferência enviada":           "PIX",
}


def chave_agrupamento(tipo: str, detalhe: str) -> str:
    """Decide o que vira a chave de agrupamento.

    Para Pix, usa so o nome da contraparte (nao o CNPJ/banco inteiro).
    Para os demais tipos, usa o detalhe inteiro normalizado.
    Para tipos sem detalhe, usa o proprio tipo como chave.
    """
    if not detalhe:
        return normalizar_detalhe(tipo) or "(SEM DETALHE)"

    if "Pix" in tipo or tipo.startswith("Transferência"):
        nome = extrair_nome_pix(detalhe)
        return normalizar_detalhe(nome) or normalizar_detalhe(detalhe)

    return normalizar_detalhe(detalhe)


def ler_csv(caminho: Path) -> list[Transacao]:
    transacoes: list[Transacao] = []
    with caminho.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            desc = row.get("Descrição") or row.get("Descricao") or ""
            tipo, detalhe = split_descricao(desc)
            try:
                valor = Decimal(row["Valor"])
            except Exception:
                continue
            transacoes.append(
                Transacao(
                    id=row["Identificador"],
                    data=row["Data"],
                    valor=valor,
                    descricao_raw=desc,
                    tipo=tipo,
                    detalhe=detalhe,
                    arquivo=caminho.name,
                )
            )
    return transacoes


def ler_pasta(pasta: Path) -> list[Transacao]:
    todos: list[Transacao] = []
    arquivos = sorted(pasta.glob("*.csv"))
    if not arquivos:
        print(f"Nenhum CSV encontrado em {pasta}", file=sys.stderr)
        return []
    for arq in arquivos:
        todos.extend(ler_csv(arq))
    # dedupe por Identificador (mantem primeira ocorrencia)
    vistos: set[str] = set()
    unicos: list[Transacao] = []
    for t in todos:
        if t.id in vistos:
            continue
        vistos.add(t.id)
        unicos.append(t)
    print(
        f"Lidos {len(todos)} registros de {len(arquivos)} arquivo(s); "
        f"{len(unicos)} unicos apos dedupe.",
        file=sys.stderr,
    )
    return unicos


# ---------------------------------------------------------------------------
# Agregacao
# ---------------------------------------------------------------------------

@dataclass
class Agregado:
    chave: str
    ocorrencias: int = 0
    total: Decimal = Decimal("0")
    entradas: Decimal = Decimal("0")
    saidas: Decimal = Decimal("0")
    tipos: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    exemplos: list[str] = field(default_factory=list)

    def add(self, t: Transacao) -> None:
        self.ocorrencias += 1
        self.total += t.valor
        if t.valor >= 0:
            self.entradas += t.valor
        else:
            self.saidas += t.valor
        self.tipos[t.tipo] += 1
        if len(self.exemplos) < 3 and t.descricao_raw not in self.exemplos:
            self.exemplos.append(t.descricao_raw)

    @property
    def tipo_predominante(self) -> str:
        if not self.tipos:
            return ""
        return max(self.tipos.items(), key=lambda kv: kv[1])[0]


def agregar(transacoes: list[Transacao]) -> tuple[list[Agregado], int, Decimal]:
    """Retorna (agregados_para_classificar, n_auto, total_abs_auto).

    Transacoes cujo tipo esta em TIPOS_AUTOMATICOS sao contadas como
    ja categorizadas e nao entram nos agregados de saida.
    """
    grupos: dict[str, Agregado] = {}
    n_auto = 0
    total_auto = Decimal("0")
    for t in transacoes:
        if t.tipo in TIPOS_AUTOMATICOS:
            n_auto += 1
            total_auto += abs(t.valor)
            continue
        chave = chave_agrupamento(t.tipo, t.detalhe)
        if chave not in grupos:
            grupos[chave] = Agregado(chave=chave)
        grupos[chave].add(t)
    agregados = sorted(grupos.values(), key=lambda a: abs(a.total), reverse=True)
    return agregados, n_auto, total_auto


# ---------------------------------------------------------------------------
# Saida
# ---------------------------------------------------------------------------

def fmt_valor(v: Decimal) -> str:
    # formato pt-BR com 2 casas para facilitar leitura na planilha
    sinal = "-" if v < 0 else ""
    inteiro, _, dec = f"{abs(v):.2f}".partition(".")
    # separador de milhar
    inteiro_fmt = ""
    while len(inteiro) > 3:
        inteiro_fmt = "." + inteiro[-3:] + inteiro_fmt
        inteiro = inteiro[:-3]
    inteiro_fmt = inteiro + inteiro_fmt
    return f"{sinal}{inteiro_fmt},{dec}"


def escrever_planilha(agregados: list[Agregado], saida: Path) -> None:
    with saida.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "detalhe_normalizado",
            "tipo_predominante",
            "ocorrencias",
            "total",
            "total_abs",
            "entradas",
            "saidas",
            "exemplos",
            "categoria",  # vazio: usuario preenche
        ])
        for a in agregados:
            w.writerow([
                a.chave,
                a.tipo_predominante,
                a.ocorrencias,
                fmt_valor(a.total),
                fmt_valor(abs(a.total)),
                fmt_valor(a.entradas),
                fmt_valor(a.saidas),
                " | ".join(a.exemplos),
                "",
            ])


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: list[str]) -> int:
    base_dir = Path(__file__).resolve().parents[2]
    pasta = Path(argv[1]) if len(argv) > 1 else base_dir / "exemplo_input"
    saida = (
        Path(argv[2])
        if len(argv) > 2
        else base_dir / "dados" / "csv" / "merchants_para_classificar.csv"
    )

    if not pasta.is_dir():
        print(f"Pasta nao encontrada: {pasta}", file=sys.stderr)
        return 1

    transacoes = ler_pasta(pasta)
    if not transacoes:
        return 1

    agregados, n_auto, total_auto = agregar(transacoes)
    escrever_planilha(agregados, saida)

    if n_auto:
        regras = ", ".join(f"{t!r}->{c}" for t, c in TIPOS_AUTOMATICOS.items())
        print(
            f"Auto-categorizadas {n_auto} transacao(oes) "
            f"(total abs = {fmt_valor(total_auto)}) por tipo: {regras}",
            file=sys.stderr,
        )

    total_mov = sum((abs(a.total) for a in agregados), Decimal("0"))
    acumulado = Decimal("0")
    pareto_n = 0
    for a in agregados:
        acumulado += abs(a.total)
        pareto_n += 1
        if total_mov and acumulado / total_mov >= Decimal("0.8"):
            break

    print(f"Grupos unicos: {len(agregados)}", file=sys.stderr)
    print(
        f"Top {pareto_n} grupo(s) ja cobrem 80% do volume "
        f"(total movimentado abs = {fmt_valor(total_mov)}).",
        file=sys.stderr,
    )
    print(f"Planilha gerada: {saida}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

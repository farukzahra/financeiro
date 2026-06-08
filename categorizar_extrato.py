"""
categorizar_extrato.py

Le um CSV de extrato do Nubank, aplica as 4 camadas de categorizacao
descritas em PLANO.md e grava o resultado em output/<nome_do_arquivo>.

Pipeline:
  1. Tipo de operacao -> categoria (TIPOS_AUTOMATICOS, RDB, fatura, saque etc.)
     vem implicitamente do dicionario merchants_para_classificar.csv para os
     tipos sem detalhe (a chave e o proprio tipo normalizado).
  2. Dicionario manual (merchants_para_classificar.csv): chave normalizada
     -> categoria preenchida pelo usuario.
  3. Heuristicas leves (autofill_categorias.REGRAS) para chaves novas que
     ainda nao estao no dicionario.
  4. Fallback: OUTROS.

Uso:
    python categorizar_extrato.py <arquivo_entrada.csv> [arquivo_saida.csv]

Se <arquivo_entrada.csv> nao existir como caminho relativo/absoluto, tenta
exemplo_input/<arquivo_entrada.csv>. A saida default vai para
output/<basename do entrada>.
"""

from __future__ import annotations

import csv
import sys
from decimal import Decimal
from pathlib import Path

from autofill_categorias import categorizar as categorizar_heuristico
from bootstrap_merchants import (
    TIPOS_AUTOMATICOS,
    chave_agrupamento,
    fmt_valor,
    split_descricao,
)


DICIONARIO_CSV = Path(__file__).parent / "merchants_para_classificar.csv"
OUTPUT_DIR = Path(__file__).parent / "output"


def carregar_dicionario(caminho: Path) -> dict[str, str]:
    """Le merchants_para_classificar.csv e devolve {chave_normalizada: categoria}.

    Linhas com `categoria` vazia sao ignoradas. Em caso de chave duplicada,
    a primeira (mais relevante por volume, dada a ordenacao da planilha) vence.
    """
    if not caminho.is_file():
        return {}
    dic: dict[str, str] = {}
    with caminho.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            chave = (row.get("detalhe_normalizado") or "").strip()
            cat = (row.get("categoria") or "").strip()
            if not chave or not cat:
                continue
            dic.setdefault(chave, cat)
    return dic


def resolver_entrada(arg: str) -> Path:
    candidato = Path(arg)
    if candidato.is_file():
        return candidato
    alt = Path(__file__).parent / "exemplo_input" / arg
    if alt.is_file():
        return alt
    raise FileNotFoundError(
        f"Arquivo nao encontrado: {arg} (tambem tentei {alt})"
    )


def categorizar_linha(
    tipo: str,
    detalhe: str,
    chave: str,
    dic: dict[str, str],
) -> tuple[str, str]:
    """Devolve (categoria, regra_aplicada)."""
    cat = dic.get(chave)
    if cat:
        return cat, "dicionario"

    if tipo in TIPOS_AUTOMATICOS:
        return TIPOS_AUTOMATICOS[tipo], "tipo_automatico"

    heur = categorizar_heuristico(chave or detalhe or tipo)
    if heur:
        return heur, "heuristica"

    return "OUTROS", "fallback"


def processar(entrada: Path, saida: Path, dic: dict[str, str]) -> dict[str, int]:
    stats: dict[str, int] = {
        "total": 0,
        "dicionario": 0,
        "tipo_automatico": 0,
        "heuristica": 0,
        "fallback": 0,
    }
    saida.parent.mkdir(parents=True, exist_ok=True)

    with entrada.open(encoding="utf-8", newline="") as fin, \
            saida.open("w", encoding="utf-8", newline="") as fout:
        reader = csv.DictReader(fin)
        base_fields = reader.fieldnames or []
        desc_field = "Descrição" if "Descrição" in base_fields else "Descricao"
        fieldnames = [desc_field, "Valor"]
        writer = csv.DictWriter(fout, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()

        for row in reader:
            desc = row.get("Descrição") or row.get("Descricao") or ""
            tipo, detalhe = split_descricao(desc)
            chave = chave_agrupamento(tipo, detalhe)
            categoria, regra = categorizar_linha(tipo, detalhe, chave, dic)

            row_out = dict(row)
            try:
                row_out["Valor"] = fmt_valor(Decimal(row.get("Valor", "0")))
            except Exception:
                pass  # mantem string original se nao for numerico
            row_out[desc_field] = f"[{categoria}] {desc}"
            writer.writerow(row_out)

            stats["total"] += 1
            stats[regra] += 1

    return stats


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2

    try:
        entrada = resolver_entrada(argv[1])
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        return 1

    if len(argv) > 2:
        saida = Path(argv[2])
    else:
        saida = OUTPUT_DIR / entrada.name

    dic = carregar_dicionario(DICIONARIO_CSV)
    if not dic:
        print(
            f"Aviso: dicionario vazio ou nao encontrado em {DICIONARIO_CSV}. "
            "Categorizacao vai depender so de heuristicas + fallback.",
            file=sys.stderr,
        )

    stats = processar(entrada, saida, dic)

    print(f"Entrada : {entrada}")
    print(f"Saida   : {saida}")
    print(
        f"Total: {stats['total']} | "
        f"dicionario: {stats['dicionario']} | "
        f"tipo_automatico: {stats['tipo_automatico']} | "
        f"heuristica: {stats['heuristica']} | "
        f"fallback: {stats['fallback']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

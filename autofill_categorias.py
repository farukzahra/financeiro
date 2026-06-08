"""Preenche heuristicamente a coluna `categoria` da planilha,
respeitando linhas ja preenchidas manualmente.

Uso: python autofill_categorias.py <entrada.csv> [saida.csv]
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

# (categoria, lista de keywords). Ordem importa: primeira que casar vence.
# Keywords sao casadas como substring na coluna `detalhe_normalizado` ja em maiusculas.
REGRAS: list[tuple[str, list[str]]] = [
    ("FARMACIA", [
        "FARMA", "DROGA", "DROGASIL", "PANVEL", "NISSEI",
        "HIPERFARMA", "PRONTOFARMA", "CALLFARMA", "RAIA",
    ]),
    ("GASOLINA", [
        "AUTO POSTO", "POSTO ", "POSTO", "MALCA COMERCIO DE COMB",
    ]),
    ("ALIMENTACAO", [
        "RESTAURANTE", "LANCHES", "LANCHONETE", "PIZZA", "BURGER",
        "CHURRAS", "CHURRASCAR", "CAFETERIA", "CAFE ", "CAFE",
        "BAR E GRILL", "GRILL", "YAKISSOBA", "ESPETARIA", "CHINA WOK",
        "POPEYES", "CAMARAO", "EMPORIO", "CHOCO", "DOCE", "DOCERIA",
        "BOLO", "CONFEITARIA", "SUCAO", "HORTIFRUTRI", "SACOLAO",
        "MERCADO", "MERCEARIA", "FESTVAL", "ATACADAO", "SUPERMERCADO",
        "KRILL ALIMENTOS", "GOBBO COMERCIO DE ALIM", "COMERCIO DE BEBIDAS",
        "ALBAYAN", "REINO ACUCARADO", "FABRICA DI CHOCOLATE", "FINI",
        "PALACIO DOS DOCES", "MILKY MOO", "TROPICAL BANANA", "BIBLOS",
        "KARURESTAURANTE", "GULOSO", "GULA", "DON HIPOLITO",
        "ARMAZEM", "EMPORIO NATURAL", "RANCHO SUPERMERCADOS",
        "PORTAL POINT SUPER", "CASA DE PAO", "CASADEPAO",
        "PADARIA", "CAFE DA ESQUINA", "BIG REAL", "SUPER LIDER",
        "CASA DO CAFE", "CANTINHO",
    ]),
    ("TRANSPORTE", [
        "ESTACIONAMENTO", "PARK PLATZ", "NIL PARK", "CRIMSON ESTACIONAMENTO",
        "VALET", "SETE FLECHAS VALET", "PPARKINGVALET",
    ]),
    ("VIAGEM", [
        "HOTEL", "AIRBNB",
    ]),
    ("COMPRAS", [
        "MATERIAIS DE CONST", "MATERIASDECONST", "MATERIALDE",
        "PAPELARIA", "TECIDOS", "MODAS", "BIBI BRINDES",
        "CRIS PRESENTES", "TONITOYS", "PIXEL", "SJ ACESSORIOS",
        "NANQUIM LOJAS", "CYBERNET", "EPOCA UNIFORMES",
        "GERY COMERCIO DE UNIFO", "TABACARIA",
        "CENTER PANOS", "CASA CHINA", "SECULO 21 UTILIDADES",
        "MP *", "JIM.COM",
    ]),
    ("AGRO", [
        "AGROTOPEE", "AGRODELAS", "AGRCOMERCIODE", "AGRO",
        "AVIPEC", "FERREIRA DISTRIBUIDORA",
    ]),
]


def categorizar(detalhe: str) -> str:
    alvo = detalhe.upper()
    for categoria, keywords in REGRAS:
        for kw in keywords:
            if kw in alvo:
                return categoria
    return ""


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    entrada = Path(argv[1])
    saida = Path(argv[2]) if len(argv) > 2 else entrada
    with entrada.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        fieldnames = reader.fieldnames or []
        if "categoria" not in fieldnames or "detalhe_normalizado" not in fieldnames:
            print("CSV precisa ter colunas 'detalhe_normalizado' e 'categoria'.")
            return 1
        rows = list(reader)

    preenchidas = 0
    for row in rows:
        if row.get("categoria", "").strip():
            continue
        cat = categorizar(row["detalhe_normalizado"])
        if cat:
            row["categoria"] = cat
            preenchidas += 1

    with saida.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    total = len(rows)
    em_branco = sum(1 for r in rows if not r.get("categoria", "").strip())
    print(
        f"{preenchidas} linha(s) preenchidas heuristicamente; "
        f"{em_branco} ainda em branco de {total} totais. "
        f"Salvo em: {saida}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

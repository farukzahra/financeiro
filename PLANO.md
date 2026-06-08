# Plano — Parser e Categorização de Extratos Nubank

Documento de design (sem código ainda). Define o formato dos CSVs, o parser, e a estratégia de categorização **determinística (sem IA)** baseada em regras + dicionário.

---

## 1. Formato do arquivo de entrada

Pasta: [exemplo_input/](exemplo_input/)

Nome dos arquivos segue o padrão:

```
NU_<conta>_<DDMMMYYYY>_<DDMMMYYYY>.csv
```

Ex.: `NU_941505780_01ABR2026_11ABR2026.csv` → conta `941505780`, período `01/ABR/2026` a `11/ABR/2026`.

> O nome do arquivo já carrega metadados úteis (conta + intervalo). O parser pode usar para detectar duplicidade entre exportações sobrepostas (ex.: `01ABR2026_11ABR2026` e `01ABR2026_25ABR2026`).

### 1.1 Cabeçalho

```
Data,Valor,Identificador,Descrição
```

Encoding observado: UTF-8 (acentos em "Descrição", "Transferência" preservados).
Separador: vírgula. Sem aspas envolvendo campos. Quebras de linha = `\n`.

### 1.2 Colunas

| Coluna          | Tipo       | Significado                                                                                                  |
| --------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `Data`          | `dd/MM/yyyy` | Data da transação no extrato (não é necessariamente a data da compra original).                              |
| `Valor`         | decimal com ponto, sinal explícito | Negativo = saída de dinheiro; positivo = entrada. Sem símbolo de moeda. Sem separador de milhar. |
| `Identificador` | UUID v4    | ID único da transação no Nubank → **chave natural para deduplicação** entre exportações sobrepostas.         |
| `Descrição`     | string livre | Composta por **tipo de operação** + (opcional) ` - ` + **detalhe** (contraparte / merchant / observação).  |

### 1.3 Observações importantes

- Mesma `Data` pode ter N transações (ordenadas, mas sem garantia estrita).
- O `Identificador` se repete entre arquivos quando os períodos se sobrepõem → **deduplicar por ele**.
- A `Descrição` é o único campo semântico. Toda a categorização depende dela + do sinal de `Valor`.

---

## 2. Anatomia do campo `Descrição`

A descrição tem 2 partes separadas por ` - ` (primeira ocorrência):

```
<TIPO_OPERAÇÃO> - <DETALHE_LIVRE>
```

Em alguns casos, só vem o tipo (sem detalhe), por exemplo: `Transferência enviada pelo Pix`, `Débito em conta`, `Pagamento de fatura`, `Aplicação RDB`, `Resgate RDB`.

### 2.1 Tipos de operação observados

Levantados varrendo todos os CSVs em [exemplo_input/](exemplo_input/):

| Tipo                                  | Sinal típico | Significado                                                  |
| ------------------------------------- | ------------ | ------------------------------------------------------------ |
| `Compra no débito`                    | −            | Compra com cartão de débito. Detalhe = nome do merchant.     |
| `Transferência enviada pelo Pix`      | −            | Pix de saída. Detalhe = nome + CPF/CNPJ + banco + ag/conta.  |
| `Transferência recebida pelo Pix`     | +            | Pix de entrada.                                              |
| `Reembolso recebido pelo Pix`         | +            | Estorno via Pix.                                             |
| `Transferência Recebida`              | +            | TED/TEF recebida (sem ser Pix).                              |
| `Transferência enviada`               | −            | TED/TEF enviada.                                             |
| `Pagamento de boleto efetuado`        | −            | Pagamento de boleto. Detalhe = beneficiário.                 |
| `Pagamento de fatura`                 | −            | Pagamento da fatura do cartão de crédito Nubank.             |
| `Débito em conta`                     | −            | Débito automático (sem detalhe).                             |
| `Aplicação RDB`                       | −            | Aplicação na reserva (sai da conta corrente).                |
| `Resgate RDB`                         | +            | Resgate da reserva (volta para conta corrente).              |

### 2.2 Padrões de detalhe (parte após ` - `)

Para **Compra no débito**: apenas o nome do merchant (truncado a ~20–22 chars pelo Nubank).
Ex.: `SUPERMERCADO CRUZ`, `BURGER KING`, `RAIA3243`, `POSTO PELANDA 3`.

Para **Pix enviado/recebido**, o detalhe segue uma de duas formas:

1. Forma completa:
   `<NOME> - <CPF_MASCARADO|CNPJ> - <BANCO> (<ISPB>) Agência: <X> Conta: <Y>`
   - CPF aparece mascarado: `•••.148.539-••`
   - CNPJ aparece completo: `42.707.259/0001-17`
2. Forma curta: `<NOME> (Transferência enviada)` — quando o destinatário não tem dados bancários expostos.

Para **Pagamento de boleto**: `<BENEFICIÁRIO_LIVRE>` (sem estrutura fixa, ex.: `UNIMED CURITIBA SOC COOP DE MEDICOS`).

---

## 3. Parser — design

### 3.1 Responsabilidades

1. Descobrir todos os `.csv` em `exemplo_input/` (ou pasta passada por parâmetro).
2. Extrair metadados do nome: `conta`, `inicio`, `fim`.
3. Ler cada CSV com leitor padrão (vírgula, header, UTF-8).
4. Normalizar cada linha em um objeto `Transacao`:
   ```
   Transacao {
     id: string            # = Identificador (UUID)
     data: date            # parse dd/MM/yyyy
     valor: Decimal        # mantém sinal
     descricao_raw: string
     tipo: string          # parte antes do primeiro " - " (ou string toda se não houver)
     detalhe: string       # parte depois (pode ser vazia)
     direcao: "ENTRADA" | "SAIDA"   # derivado do sinal de valor
     conta: string         # do nome do arquivo
     arquivo_origem: string
   }
   ```
5. **Deduplicar** pela chave `id` (mantendo a primeira ocorrência ou a do arquivo de maior período).
6. Ordenar por `data` e devolver lista.

### 3.2 Pontos de atenção

- Usar `Decimal` (não `float`) para `Valor` → evita erro de arredondamento.
- O split de `Descrição` deve usar **a primeira ocorrência** de ` - `, pois `detalhe` pode conter ` - ` (CPFs/CNPJs em Pix vêm separados por ` - `).
- Strip de espaços em ambas as partes.
- Manter `descricao_raw` para auditoria.
- Algumas descrições não têm detalhe (ex.: `Débito em conta`) — `detalhe` fica vazio; isso é input legítimo para o categorizador.

---

## 4. Categorização sem IA — estratégia recomendada

A melhor abordagem para esse volume e formato é uma **pipeline de regras em camadas com pontuação**, não um único regex gigante.

### 4.1 Por que regras (e não IA)?

- Descrições do Nubank são curtas, repetitivas e padronizadas (mesmos merchants aparecem dezenas de vezes).
- 80% das transações caem em <20 merchants recorrentes (Supermercado Cruz, Burger King, Posto Pelanda, Raia, Unimed, etc.).
- Resultado é **auditável, reprodutível, offline, gratuito**.

### 4.2 Pipeline em 4 camadas (ordem de prioridade)

Cada transação passa pelas camadas **na ordem**. A primeira que casar atribui a categoria. Se nenhuma casar → `OUTROS` (com flag para revisão manual).

#### Camada 1 — Categoria pelo **tipo de operação** (regras de sistema)

Atribuição direta quando o tipo já define a natureza:

| Tipo                              | Categoria             |
| --------------------------------- | --------------------- |
| `Pagamento de fatura`             | `CARTAO_CREDITO`      |
| `Aplicação RDB` / `Resgate RDB`   | `INVESTIMENTO`        |
| `Transferência Recebida` (entrada) | `RECEITA` (subtipo: salário/PJ se contraparte casar com CNPJ próprio) |
| `Transferência recebida pelo Pix` | `RECEITA` ou `TRANSFERENCIA_INTERNA` (se contraparte for pessoa conhecida) |
| `Reembolso recebido pelo Pix`     | `REEMBOLSO`           |

#### Camada 2 — Categoria por **dicionário de merchants** (chave do problema)

Dicionário `merchant → categoria` montado a partir dos dados reais.
Matching: **normalizar** (uppercase, remove acento, colapsa espaços, remove sufixos numéricos tipo `RAIA3243` → `RAIA`) e comparar por **substring / prefixo**, não igualdade.

Exemplos extraídos dos CSVs analisados:

```
ALIMENTACAO_MERCADO:
  SUPERMERCADO CRUZ, JACOMAR, CONDOR, FESTVAL, BIG REAL,
  ARMAZEM SAO GONCALO, GULA GULA, PORTAL POINT, HORTIFRUTRI,
  CASA DE PAO BETHELEM, AVIPEC, GOBBO COMERCIO DE ALIM

ALIMENTACAO_RESTAURANTE:
  BURGER KING, POPEYES, CHINA WOK, RESTAURANTE CHENG,
  BRINCA PIZZA, KA RU, THE CHURRAS, RESTAURANTE JA,
  RESTAURANTEELAVA, GULA GULA SAO MARCOS

COMBUSTIVEL:
  POSTO PELANDA, AUTO POSTO PELANDA, AUTO POSTO CASIL,
  PARADA PEDRO PELANDA

FARMACIA:
  RAIA, PANVEL, FARMACIA NISSEI, BELA FARMA, DROGASIL

SAUDE:
  UNIMED CURITIBA, ORTOSORRISO, FITOMED

VESTUARIO:
  HERING STORE, LOJAS AMERICANAS, EPOCA UNIFORMES,
  GERY COMERCIO DE UNIFO, ASSB COMERCIO VAREJIS, SO PIJAMAS

ESTACIONAMENTO:
  ESTACIONAMENTO SAO JOS, PARK PLATZ, CRIMSON ESTACIONAMENTO,
  SETE FLECHAS VALET, ESTACIONAMENTO LICO

CASA_CONSTRUCAO:
  CAMPOS MATERIAIS DE CO, BVL MATERIAIS DE CONST, CENTER PANOS,
  CASA CHINA, SECULO 21 UTILIDADES

PETS:
  PET MARC, PETMARC

LAZER_ASSINATURA:
  AIRBNB, HOTEL SLIM GUARAPUAVA, TORCIDAFURIA, WORLD SPORTS

IMPOSTOS:
  RECEITA FEDERAL

SEGUROS:
  YELUM SEGURADORA

UTILIDADES_PUBLICAS:
  GAS E AGUA FRANCO
```

#### Camada 3 — Categoria por **contraparte de Pix** (pessoas físicas/jurídicas)

Para `Transferência enviada/recebida pelo Pix`, casar o nome ou CNPJ no detalhe:

- **CNPJ conhecido** (próprio ou recorrente) → categoria fixa.
  - Ex.: `42.707.259/0001-17` (FARUK MUSTAFA ZAHRA CONSULTORIA) → `RECEITA_PJ` (entrada) ou `TRANSFERENCIA_INTERNA` (saída para si mesmo).
- **CPF mascarado + nome de pessoa recorrente** → `TRANSFERENCIA_PESSOAL` com subcategoria (familiar, prestador de serviço).
  - Ex.: `Adriana Aparecida Cardoso`, `Rima Awada Zahra`, `Khalil Faruk Zahra`, `Mustafa Abdul Rahman Zahra` → `FAMILIA`.
- **Marketplaces / IPs**:
  - `PIX Marketplace - 10.573.521/0001-91 - MERCADO PAGO` → tipicamente `COMPRAS_ONLINE` (genérico, pois Mercado Pago é intermediário).
  - `ADYEN DO BRASIL`, `CLOUDWALK`, `STONE`, `DLOCAL` → são IPs/adquirentes; categorizar pelo **nome do recebedor real**, não pelo banco.

#### Camada 4 — **Heurísticas leves** sobre o detalhe (fallback)

- Tipo = `Compra no débito` + detalhe vazio/não casou → `OUTROS_COMPRA_DEBITO`.
- Tipo = `Pagamento de boleto` + detalhe não casou → `OUTROS_BOLETO`.
- Tipo = `Débito em conta` (sem detalhe) → `DEBITO_AUTOMATICO` (sub-classificar depois manualmente).
- Tipo desconhecido → `OUTROS`.

### 4.3 Estrutura do dicionário

Arquivo separado `categorias.yaml` (ou `.json`) versionado, formato sugerido:

```yaml
categorias:
  ALIMENTACAO_MERCADO:
    match:
      - "SUPERMERCADO CRUZ"
      - "JACOMAR"
      - "CONDOR"
      - "FESTVAL"
    # opcional: regex avançado
    regex:
      - "^RAIA\\d*$"          # só atribuir se nada mais casou (Raia é farmácia, contra-exemplo)
  COMBUSTIVEL:
    match:
      - "POSTO PELANDA"
      - "AUTO POSTO"
  ...
```

Vantagens:

- Adicionar/corrigir categoria = editar YAML, não código.
- Permite **reaplicar** categorização sobre histórico antigo sem reprocessar parsing.

### 4.4 Matching — regras de normalização

Antes de comparar `detalhe` com o dicionário, aplicar:

1. `upper()`
2. Remover acentos (`unicodedata.normalize("NFKD", ...)`).
3. Colapsar múltiplos espaços.
4. Strip.
5. **Não** remover dígitos no texto bruto (eles identificam filial), mas comparar **também** uma versão com sufixo numérico final removido (`RAIA3243` → `RAIA`).
6. Usar `in` (substring) com prioridade para **match mais longo** quando vários casarem (evita `CASA` capturar `CASA DE PAO`).

### 4.5 Saída do categorizador

Cada transação ganha:

```
categoria: string              # ex.: ALIMENTACAO_MERCADO
subcategoria: string | null    # ex.: SUPERMERCADO_CRUZ
regra_aplicada: string         # ex.: "dict:ALIMENTACAO_MERCADO/SUPERMERCADO CRUZ"
confianca: enum{ALTA, MEDIA, BAIXA}
                               # ALTA = camada 1 ou match exato dicionário
                               # MEDIA = match por substring/regex
                               # BAIXA = caiu em fallback OUTROS_*
```

A `regra_aplicada` é a chave da **auditabilidade**: o usuário sempre sabe por que aquela linha virou aquela categoria.

---

## 5. Próximos passos sugeridos

1. Definir linguagem do parser (Python parece ideal: `pandas`/`csv` + `pyyaml` + `decimal`).
2. Implementar `parser.py` produzindo lista de `Transacao` + deduplicação por `Identificador`.
3. Criar `categorias.yaml` inicial com os merchants já listados na seção 4.2.
4. Implementar `categorizador.py` com as 4 camadas e a normalização da seção 4.4.
5. Gerar relatório CSV/Markdown: total por categoria/mês para validar.
6. Iterar no YAML: o que cair em `OUTROS_*` vira input para nova regra.

---

## 6. Decisões a tomar (perguntas abertas)

- Linguagem: **Python**, Node/TS, ou outra?
- Saída final: CSV consolidado, SQLite, ou JSON?
- Granularidade da categoria: 1 nível só (ex.: `ALIMENTACAO`) ou 2 (`ALIMENTACAO/MERCADO`)?
- Tratamento de **transferências entre contas próprias**: ignorar do fluxo de caixa ou marcar como `INTERNA`?
- Como tratar `Aplicação/Resgate RDB`: como movimentação ou neutralizar (não é despesa)?

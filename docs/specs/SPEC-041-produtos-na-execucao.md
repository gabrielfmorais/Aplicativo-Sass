# SPEC-041 — Produtos na execução (F48)

| Campo | Valor |
|---|---|
| ID | SPEC-041 |
| Status | Em implementação |
| Owner | dono do produto |
| Bounded Context | Care Tracking (leitura) + Hoje |
| Related ADRs | D-26/D-70 (gate de domínio), D-47/D-48 (necessidade), D-104 |
| Related SPECs | SPEC-023 (a prateleira), SPEC-024 (o registro), SPEC-039 (a finalização) |
| Capability | `F48` produtos na execução |
| Criado / Atualizado | 2026-09-03 / 2026-09-03 |

## 1. Context

O produto sabe o que ela **planejou**, sabe se ela **fez**, e — desde o `F25` — sabe o que ela
**usou, depois**. No minuto em que ela vai fazer o cuidado, a tela não sabe nada sobre o vidro que
está na mão dela.

**Sem migration e sem dado novo.** Tudo o que esta SPEC precisa já existe: a prateleira (`products`,
SPEC-023) e o registro do que ela usou (`wash_day_products`, SPEC-024). O que faltava era **ler isso
na hora certa**.

## 2. Três responsabilidades, e por que não podem virar uma

| | quando | o quê | gate |
|---|---|---|---|
| `F25` Wash Day | **depois** | registra o que ela usou | nenhum |
| **`F48` — esta SPEC** | **durante** | apresenta o que ela **já tem** | **nenhum** |
| `P18` Recomendações | — | **sugere** o que ela poderia usar | D-26 + curadoria |

⚠️ **Esta é a única das três que não precisa de revisão de domínio, e o motivo é preciso: ela não
decide nada por ela.** No instante em que o painel escolher *quais* produtos mostrar por categoria,
composição ou indicação — "máscara serve para hidratação" —, ele passa a fazer afirmação capilar
substantiva e cai no gate D-26/D-70 (D-104).

## 3. Goals

- **G1** No momento do cuidado, ela vê **o que já tem**, sem sair da tela e sem procurar.
- **G2** O que ela usou **da última vez** naquele tipo de cuidado aparece primeiro — **fato dela**.
- **G3** Zero schema novo: a capability é leitura sobre dados que já existem (D-47/D-48).

## 4. Non-Goals

- **NG1** **Nenhum filtro por categoria, composição ou indicação** ⇒ seria D-26/D-70.
- **NG2** Não recomenda, não ordena por mérito, não promete resultado, não sugere compra.
- **NG3** Não marca nem registra nada — marcar é a tela do registro (`F25`), que tem endereço próprio.
- **NG4** Marca e imagem não existem: chegam com o catálogo real (`F32`), e **inventá-las é proibido**
  (§8 do backlog).
- **NG5** Não empurra a ação primária para baixo da dobra: é um painel que **abre**, como "Como fazer".

## 5. Functional Requirements

- **FR1** `WashDayPort.lastUsedFor(careTypeCode)` devolve os produtos marcados no registro da
  **execução mais recente, não anulada, daquele tipo** que tenha registro.
- **FR2** O cartão do cuidado oferece **"Meus produtos"**, que abre um painel com: *da última vez você
  usou* (quando houver) e *na sua prateleira* (o resto, sem filtro).
- **FR3** Prateleira vazia é **convite**, não beco.
- **FR4** Uma leitura que falhou **não derruba o cuidado**: o painel diz que não deu, e o resto da
  tela segue.
- **FR5** O painel é **leitura**: `Tag`, nunca `Chip`. Um controle sem ação se anuncia como rádio ou
  caixa de seleção para tecnologia assistiva, e vira botão morto (o defeito que a auditoria da
  SPEC-027 encontrou na aba Prateleira).

## 6. Business Rules

- **BR1** A lista sai do que **ela** registrou. O app não escolhe produto.
- **BR2** Um produto **arquivado** continua aparecendo em "da última vez": ela usou, e o passado não
  muda porque o vidro acabou (SPEC-024 BR3).
- **BR3** O que já apareceu em "da última vez" **não se repete** na prateleira — dois cartões dizendo
  o mesmo fato foi achado real da auditoria da SPEC-026.
- **BR4** O painel é leitura e nunca bloqueia por uma transição em voo, como o guia (SPEC-007 EC3).

## 7. Edge Cases

- **EC1** Primeiro cuidado da vida: sem registro anterior, mostra só a prateleira e **não inventa** um
  "da última vez".
- **EC2** Prateleira vazia e sem histórico: convite a cadastrar.
- **EC3** Ela registrou o cuidado mas não marcou nenhum produto: não há "da última vez" — um registro
  vazio é uma resposta dela (SPEC-024 EC4), não um lugar para o app preencher.
- **EC4** Histórico longo: a busca olha as **10** execuções mais recentes daquele tipo. Teto
  deliberado — o painel é uma conveniência, e uma varredura sem limite no histórico dela não é.

## 8. Acceptance Criteria

- **AC1** No DEV real a 390px: abrir "Meus produtos" num cuidado → ver a prateleira → registrar um
  produto num cuidado → o próximo cuidado do mesmo tipo mostra "da última vez você usou".
- **AC2** A prateleira aparece **inteira**, sem filtro por categoria — com barreira de teste.
- **AC3** Nada no painel é tocável (FR5).
- **AC4** Falha de leitura mostra o aviso e não impede concluir o cuidado.
- **AC5** Nenhum texto recomenda, ordena por mérito ou promete resultado.

## 9. Open Questions

- **OQ1** Marca, imagem e variante dependem do catálogo real (`F32`), que está `DEFERRED BY
  DEPENDENCY` por curadoria e direito de imagem.
- **OQ2** Sugerir (`P18`) é outra capability, com gate próprio. **A ordem de preferência de §8 do
  backlog vale a partir de lá**, não daqui: aqui não há sugestão a ordenar.

## 10. Change Log

| Data | Mudança |
|---|---|
| 2026-09-03 | SPEC criada. Leitura sobre dados existentes, sem migration e sem gate. |

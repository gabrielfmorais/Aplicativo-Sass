# SPEC-042 — As marcas da Huna (F34, lado Free)

| Campo | Valor |
|---|---|
| ID | SPEC-042 |
| Status | **DONE** — validada no DEV real a 390px em 2026-09-03 |
| Owner | dono do produto |
| Bounded Context | Identity (`packages/core/src/identity`) + design + Você |
| Related ADRs | **SPEC-036** (direção canônica do hero), D-32 (base legal LGPD), D-101 (`react-native-svg`), D-102 |
| Related SPECs | SPEC-018 (`profiles` e o nome), SPEC-035 (a tela Você), SPEC-036 (o hero abstrato) |
| Capability | `F34` identidade dela — **avatares da Huna no Free**; foto própria é a `P24` |
| Criado / Atualizado | 2026-09-03 / 2026-09-03 |

## 1. Context

A D-102 dividiu a identidade em dois: **avatares da Huna no Free** e **foto própria no Premium**
(`P24`). O nome já é dela desde a SPEC-018, e a SPEC-035 devolveu a porta para editá-lo. O que
faltava do lado Free é o rosto do perfil — que na Huna **não é um rosto**.

**A foto continua fora, e o motivo não é técnico.** Mídia exige base legal LGPD e a tabela
`consents` que não existe (D-32) — o mesmo gate do `F28`. A SPEC-035 já tinha registrado que
*"trocar foto" não existe*, porque **um botão que abre nada promete o que o produto não tem**. Esta
SPEC não muda isso: ela entrega o que **não** depende daquele gate.

## 2. O que é uma "marca da Huna"

🔒 **A direção canônica do hero (SPEC-036) vale aqui, e com mais força.** As marcas são **abstratas**
— fluxo, mechas, movimento, identidade da marca. **Não existe personagem, mulher, rosto, cabeça,
corpo, androide ou silhueta humana**, e num círculo de 40px isso é ainda mais decisivo: quatro
tentativas de hero foram reprovadas exatamente porque rosto, cabeça e silhueta são implacáveis, e
um avatar é dez vezes menor.

⚠️ **Isto não é mídia e não é PII nova.** Nenhum arquivo é enviado, nada é armazenado além de uma
chave de lista fechada, e a escolha **não descreve a usuária** — descreve um gosto. É o oposto de
uma foto, e é por isso que cabe no Free sem nenhuma chave que o agente não tenha.

## 3. Goals

- **G1** Ela escolhe uma marca da Huna, troca quando quiser e **desfaz** quando quiser.
- **G2** A marca aparece onde a identidade dela já aparece: em **Você** e no avatar do cabeçalho.
- **G3** Sem escolha, tudo continua como hoje — a inicial do nome.
- **G4** O primitivo `Avatar` continua sendo o único lugar que sabe desenhar identidade, para que a
  foto (`P24`) entre por ele no dia em que entrar.

## 4. Non-Goals

- **NG1** **Nenhuma foto, câmera, galeria ou upload.** É a `P24`, atrás do D-32.
- **NG2** **Nenhuma figura humana** em nenhuma marca (SPEC-036) — barreira de teste.
- **NG3** Nenhum avatar padrão: escolher por ela seria decidir estética em nome de quem não pediu.
- **NG4** Nada de premium aqui. As seis marcas são **Free**, e nada que era grátis virou pago (D-83).
- **NG5** Nenhuma marca é apresentada como recomendada, e nenhuma se liga ao cabelo dela — seria
  afirmação capilar (D-26) sobre uma escolha que é só estética.

## 5. Functional Requirements

- **FR1** `profiles.avatar_key` guarda a marca, nullable e **sem `DEFAULT`**.
- **FR2** Seis marcas, vocabulário fechado, espelhado no `CHECK` do banco e no core.
- **FR3** Em **Você**, um seletor que abre; tocar na marca escolhida **tira** a escolha.
- **FR4** A marca aparece no avatar do cabeçalho — escolher e não ver seria escolher no vazio.
- **FR5** Sem marca, a inicial do nome, como sempre.
- **FR6** Uma chave **desconhecida** (app antigo, lista maior) é lida como ausência — a inicial é um
  estado válido; um círculo vazio não é nada.
- **FR7** A escrita é `UPDATE`, **nunca `upsert`** (§7).

## 6. Business Rules

- **BR1** A escolha é declaração dela sobre ela mesma: mesma RLS e mesmos grants do nome, sem RPC.
- **BR2** Trocar a marca **não** toca o nome, e vice-versa — são duas declarações independentes.
- **BR3** Nenhum rótulo descreve a usuária. A leitora de tela ouve **a marca** ("Mechas em berry"),
  nunca "avatar da Ana" — dizer isso afirmaria que aquele desenho a representa.

## 7. Dados e autorização

```sql
alter table public.profiles add column if not exists avatar_key text;
alter table public.profiles add constraint profiles_avatar_key_known check (
  avatar_key is null or avatar_key in ('flow_plum','flow_wine','flow_berry','flow_violet','flow_amber','flow_teal')
);
```

**Nenhum grant novo:** `profiles` já tem `select, insert, update` para `authenticated` sob RLS
própria (SPEC-018 §10), e a coluna entra debaixo da mesma policy.

⚠️ **`UPDATE`, e não `upsert` — e a diferença é o produto.** Um `upsert` criaria a linha quando ela
não existe, com `display_name` nulo; e na semântica da SPEC-018 isso significa **"perguntamos o nome
e ela preferiu não dizer"**. Escolher um avatar passaria a **apagar a pergunta do nome para sempre**,
sem que ninguém tivesse perguntado nada. A linha sempre existe quando o seletor aparece (o
onboarding a cria), então o `UPDATE` basta — e no caso impossível ele não escreve nada, que é melhor
do que escrever a mentira.

## 8. Edge Cases

- **EC1** Ela nunca escolheu: inicial do nome, e o botão convida em vez de cobrar.
- **EC2** Ela escolhe e depois toca na mesma: volta à inicial (FR3).
- **EC3** App antigo, chave nova: lida como ausência (FR6), com teste.
- **EC4** A escrita falha: a tela avisa e **não** finge que entrou.
- **EC5** Ela não tem nome (pulou a pergunta) **e** escolheu marca: a marca aparece; o nome continua
  ausente, e uma coisa não inventa a outra.

## 9. Acceptance Criteria

- **AC1** No DEV real a 390px: escolher → a marca aparece em Você **e** no cabeçalho → reload →
  persistida.
- **AC2** Tocar na marca escolhida volta à inicial, e persiste.
- **AC3** As seis marcas são distinguíveis a 56px no seletor e a 40px no cabeçalho, **cabem inteiras
  dentro do círculo**, e nenhuma tem figura humana.
- **AC4** pgTAP: vocabulário recusado pelo banco, isolamento entre usuárias, nenhum grant novo.
- **AC5** Nenhum texto oferece foto, câmera, galeria ou upload — com barreira de teste.

## 10. Open Questions

- **OQ1** Foto própria (`P24`) continua atrás do **D-32**. O primitivo `Avatar` é onde ela entra.
- **OQ2** Mais marcas é decisão de produto, não de engenharia: acrescentar exige tocar o `CHECK`, a
  lista do core e o teste — de propósito.
- **OQ4** ⚠️ **A arte não é final** (dono, 2026-09-03). As seis marcas atuais **cumprem a capability**
  — seleção, persistência, cabeçalho, acessibilidade e o fallback sem foto — e ficam **em produção
  como estão** até o dono trazer referências visuais para uma família mais rica. **Isto não é um
  placeholder técnico:** escolher um avatar é **escolha de identidade dela**, e continua sendo,
  qualquer que seja o desenho. O refinamento troca a **geometria** (`huna-avatars.ts`, dado puro) e
  no máximo a **paleta**; **nada** do contrato muda — a lista de chaves, o `CHECK`, o `ProfilePort`,
  o primitivo `Avatar` e a escolha já gravada de cada usuária seguem intactos. **A restrição da
  SPEC-036 continua valendo na arte nova:** abstrata, sem personagem, rosto, cabeça, corpo ou
  silhueta.
- **OQ3** No preview web, `aria-checked` não é emitido para `role="radio"` — limitação do adapter de
  plataforma (D-80), **igual para o `Chip` do design system**, que usa exatamente o mesmo contrato.
  O estado é anunciado no nativo, que é a plataforma do produto; o teste RNTL fixa o contrato.

## 11. Change Log

| Data | Mudança |
|---|---|
| 2026-09-03 | SPEC criada. O lado Free do `F34`; foto continua na `P24`, atrás do D-32. |
| 2026-09-03 | Validada no DEV real a 390px: escolher → a marca aparece em **Você e no cabeçalho** → reload + entrar de novo → persistida (`flow_berry` medido no banco). **Três defeitos que só o DEV real mostrou:** (1) a primeira geometria lia como **listras** e era cortada reta pelo círculo — exatamente o modo de falha que o dono nomeou para o hero; resolvido com curva de verdade e recuo, depois de comparar **quatro conjuntos fora do app em quatro tamanhos** (o método da SPEC-036); (2) `rotation`/`origin` do `react-native-svg` viravam `transform-origin` inválido no DOM do web — trocado por `transform="rotate(a cx cy)"`, SVG puro, idêntico nas duas plataformas; (3) o estado ia em `selected`, que `role="radio"` não anuncia — passou a `checked`, alinhado com o `Chip` do design system, com barreira de teste. E o seletor a 56px fecha **4+2**, sem a linha órfã que 44px deixava. |

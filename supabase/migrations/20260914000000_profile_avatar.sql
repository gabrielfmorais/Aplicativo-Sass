-- SPEC-042 (F34) — o avatar da Huna que ela escolhe.
--
-- A D-102 dividiu a identidade em dois: **avatares da Huna no Free** e **foto própria no Premium**
-- (`P24`). Esta migration entrega o lado Free — e ele **não é mídia**: nenhum arquivo é enviado,
-- nada é armazenado além de uma chave de lista fechada. Foto continua atrás da base legal LGPD e da
-- tabela `consents` que não existe (D-32), que é o gate do `F28`/`P24`.
--
-- ⚠️ **Nada aqui é PII nova.** `avatar_key` é uma escolha estética entre marcas autorais da Huna —
-- não descreve a usuária, não infere nada sobre ela e não sai do vocabulário abaixo. É o oposto de
-- uma foto, e é por isso que cabe no Free sem nenhuma chave que o agente não tenha.
--
-- 🔒 **Direção canônica do hero (SPEC-036) vale aqui também:** as marcas são **abstratas** — fluxo,
-- mechas, movimento. **Sem personagem, sem rosto, sem cabeça, sem corpo, sem silhueta humana.** Um
-- avatar é ainda menor que o hero, e a 40px um rosto erra por definição.
--
-- **Nullable e sem DEFAULT.** Ausência é "ela não escolheu", e o app cai na inicial do nome dela —
-- que é o comportamento de hoje e continua sendo válido. Um DEFAULT escolheria por ela.

alter table public.profiles
  add column if not exists avatar_key text;

alter table public.profiles
  drop constraint if exists profiles_avatar_key_known;
alter table public.profiles
  add constraint profiles_avatar_key_known check (
    avatar_key is null
    or avatar_key in (
      'flow_plum',      -- mechas em ameixa
      'flow_wine',      -- mechas em vinho
      'flow_berry',     -- mechas em berry
      'flow_violet',    -- mechas em roxo profundo
      'flow_amber',     -- mechas em âmbar quente
      'flow_teal'       -- mechas em verde-azulado
    )
  );

comment on column public.profiles.avatar_key is
  'SPEC-042 (F34): a marca autoral da Huna que ela escolheu, ou nulo quando ela não escolheu (e o app usa a inicial do nome). Lista fechada, abstrata e sem figura humana (SPEC-036). Não é mídia e não é PII nova — foto própria é P24, atrás do D-32.';

-- Nenhum grant novo: `profiles` já tem `select, insert, update` para `authenticated` sob RLS
-- própria (SPEC-018 §10), e a coluna entra debaixo da mesma policy. Escolher o avatar é a mesma
-- escrita que escolher o nome — a declaração dela sobre ela mesma.

-- Rollback (sem dado de produção antes do release):
--   alter table public.profiles drop constraint if exists profiles_avatar_key_known;
--   alter table public.profiles drop column if exists avatar_key;

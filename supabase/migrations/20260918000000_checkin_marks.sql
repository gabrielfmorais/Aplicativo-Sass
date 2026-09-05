-- SPEC-051 (P13, fatia de registro do cabelo) — O QUE ela notou, e não só quanto.
--
-- O problema está escrito pelo dono, no Blueprint §8:
--
--   "O check-in atual é uma nota de 1 a 5 sobre o cuidado. Suficiente para começar, insuficiente
--    para aprender: '3' não diz se o problema foi frizz, ressecamento ou o couro cabeludo coçando."
--   "É o combustível de P2, P14, P15, P8 e P16. Sem check-in rico, o Premium não tem o que
--    interpretar."
--
-- A SPEC-047/049/050 leem QUATRO eixos de entrada e UM único número como eixo de resultado.
--
-- ⚠️ **Registro, não diagnóstico.** "Você marcou frizz" é relato dela; "seu cabelo está danificado"
-- seria alegação capilar (D-26/D-70). O vocabulário entra como `candidate` e o PUBLIC RELEASE segue
-- bloqueado até sign-off de domínio, exatamente como o do `F38`.
--
-- ⛔ **O couro cabeludo NÃO entra aqui.** A lista do Blueprint para couro inclui sensível, coçando e
-- descamando, e a fronteira com sintoma clínico é fina: é a OQ2 da SPEC-025, atrás de base legal
-- LGPD (D-32) **e** sign-off de domínio (D-26). O `scalp_feel` que já existe fica onde está.
--
-- 🔒 **Mudar o vocabulário depois quebra a série histórica** (Blueprint §8): comparar ao longo do
-- tempo exige que a palavra signifique a mesma coisa em janeiro e em junho. Aplicar esta migration
-- é o ato que congela a lista.

/*
 * `checkins` já é alvo de FK composta em outro sentido; para SER alvo ela precisa da unicidade
 * explícita. Aditivo e sem efeito sobre linha nenhuma: `id` já é PRIMARY KEY, então o par nunca
 * repete.
 */
alter table public.checkins
  add constraint checkins_id_user_unique unique (id, user_id);

create table if not exists public.checkin_marks (
  checkin_id uuid not null,
  /*
   * ⚠️ **A metade `cabelo` do Blueprint §8, e só ela.**
   *
   * A pergunta na tela é "O que você notou?" — ela marca o que se destacou. A lista mistura
   * qualidades de sinal oposto de propósito: dar direção a cada uma (`maciez boa`/`maciez ruim`)
   * dobraria o vocabulário e os toques, e separar em "o que ficou bom"/"o que incomodou" exigiria
   * que ENGENHARIA decidisse que frizz é ruim — classificação de valor que a lista plana do dono
   * não faz. A nota de 1 a 5 continua carregando a valência geral.
   *
   * ⛔ **Sem texto livre** (SPEC-024): não se compara, não se agrega, e é PII sem consumidor.
   */
  mark text not null check (
    mark in (
      'softness',    -- maciez
      'shine',       -- brilho
      'frizz',
      'definition',  -- definição
      'dryness'      -- ressecamento
    )
  ),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  /*
   * EC2 — o duplo toque cai aqui: a segunda inserção é violação de unicidade, não uma segunda
   * linha. A tela reverte a marcação que falhou e diz qual foi.
   */
  primary key (checkin_id, mark),
  /*
   * ⚠️ **Posse nas DUAS pontas** (BR4). A policy valida o dono da LINHA; só a FK composta valida o
   * dono do CHECK-IN. Sem ela, um cliente adulterado penduraria a própria marcação no check-in
   * alheio — invisível para todos e contável por `P8`. É a mesma construção medida na SPEC-024.
   */
  constraint checkin_marks_checkin_owner_fk
    foreign key (checkin_id, user_id) references public.checkins (id, user_id) on delete cascade
);

comment on table public.checkin_marks is
  'SPEC-051 (P13): o que ela notou no cabelo, ancorado no check-in. Vocabulário CANDIDATE (Blueprint §8) — registro, nunca diagnóstico. Couro cabeludo NÃO entra: D-32 + D-26 (SPEC-025 OQ2). Junção: aceita DELETE porque desmarcar é corrigir, não apagar histórico; `checkins` continua append-only.';

alter table public.checkin_marks enable row level security;
alter table public.checkin_marks force row level security;

/*
 * ⚠️ **`DELETE` é correto AQUI e continua proibido em `checkins`.** Desmarcar é ela corrigindo o que
 * marcou; a nota de 1 a 5 permanece imutável porque é o fato âncora. É a mesma divisão que a
 * SPEC-025 fez entre o check-in e o couro no hub.
 *
 * ⚠️ **Sem RPC** (§7): a linha não guarda invariante de servidor — nem dia civil, nem idempotência
 * de transação. O mesmo raciocínio do `F26`/`F25`.
 */
revoke all on public.checkin_marks from anon, authenticated;
grant select, insert, delete on public.checkin_marks to authenticated;

drop policy if exists checkin_marks_select_own on public.checkin_marks;
create policy checkin_marks_select_own on public.checkin_marks
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists checkin_marks_insert_own on public.checkin_marks;
create policy checkin_marks_insert_own on public.checkin_marks
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists checkin_marks_delete_own on public.checkin_marks;
create policy checkin_marks_delete_own on public.checkin_marks
  for delete to authenticated using (user_id = (select auth.uid()));

-- FORCE row level security vale para o dono da tabela, e as funções DEFINER rodam como ele.
drop policy if exists checkin_marks_owner_all on public.checkin_marks;
create policy checkin_marks_owner_all on public.checkin_marks
  for all to postgres using (true) with check (true);

-- ROLLBACK:
--   drop table if exists public.checkin_marks;
--   alter table public.checkins drop constraint if exists checkins_id_user_unique;

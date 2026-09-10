import type { LocalDate, OilRoutineView } from '@app/core';
import { nextOilMoment } from '@app/core';

import { Button, Card, Stack, Text } from '@/design/primitives';
import { formatPlannedDate } from '@/features/plan/copy';

/**
 * SPEC-071 (F39) — **a rotina de óleo deixa de estar escondida.**
 *
 * O dono disse que ela *"existe e funciona, mas está escondida demais"*. Medido: em Cuidados ela era
 * a **configuração inteira** — os chips de intervalo, a lista de horários com adicionar, editar,
 * remover e ligar/desligar, e o botão de desligar a rotina — ocupando quase uma tela, enquanto a
 * pergunta que ela faz todo dia (*"quando é a próxima?"*) ficava numa `caption` no fim do cartão.
 *
 * Agora a aba mostra **o estado**, e a configuração tem tela própria — a mesma troca que a SPEC-069
 * fez com a Jornada: a aba responde *o que está acontecendo*, a tela responde *como ajustar*.
 *
 * ⚠️ **Nada aqui diz o que o óleo faz, nem sugere frequência** (SPEC-040 BR4/NG2, D-26/D-70). O
 * intervalo é escolha dela; nenhuma opção é "ideal"; e ⛔ **nada premia usar mais** (D-103): não há
 * contagem de quantas vezes ela passou óleo, sequência, elogio nem comparação.
 */
export function OilRoutineSummary({
  view,
  today,
  nowTime,
  onOpen,
}: {
  view: OilRoutineView;
  today: LocalDate;
  /** O relógio de parede dela, `HH:MM`. Entra como dado — o domínio não lê relógio (ADR-008). */
  nowTime: string;
  onOpen: () => void;
}) {
  const next = nextOilMoment(view, today, nowTime);

  if (view.state === 'none' || next === null) {
    return (
      <Card>
        <Text variant="heading" accessibilityRole="header">
          Rotina de óleo
        </Text>
        {/*
          ⚠️ A frase descreve o primeiro passo REAL: o intervalo vem antes dos horários, e não por
          ordem de tela — o banco recusa um horário sem rotina (a FK aponta para `oil_routines`).
          Prometer "crie seus horários" aqui mandaria ela para uma porta que ainda não abre.
        */}
        <Text tone="muted">
          Se você tem uma rotina de óleo, escolha de quantos em quantos dias quer que a Huna lembre — e os
          horários do dia, se quiser.
        </Text>
        <Button label="Configurar rotina" variant="secondary" onPress={onOpen} />
      </Card>
    );
  }

  const dia = next.on === today ? 'hoje' : formatPlannedDate(next.on);
  /**
   * O estado, em palavra. ⚠️ **Vencida não vira cobrança** (D-28/NG3): diz o dia em que estava
   * marcada e para por aí — sem "você está atrasada", sem contagem de dias perdidos, sem tom.
   */
  const quando =
    view.state === 'overdue'
      ? `Estava para ${formatPlannedDate(next.on)}${next.at ? `, ${next.at}` : ''}`
      : `Próximo: ${dia}${next.at ? `, ${next.at}` : ''}`;

  return (
    <Card>
      <Text variant="heading" accessibilityRole="header">
        Rotina de óleo
      </Text>
      <Stack gap="xs">
        <Text variant="bodyStrong">{quando}</Text>
        <Text variant="caption" tone="muted">
          {horariosLabel(view)}
        </Text>
      </Stack>
      <Button label="Ver rotina" variant="secondary" onPress={onOpen} />
    </Card>
  );
}

/**
 * Quantos horários ela tem — e a ressalva **só quando existe**.
 *
 * ⚠️ **"3 horários ativos" foi recusado como frase única.** Um horário com o lembrete desligado
 * continua na rotina e continua registrável (SPEC-053 FR3): chamá-lo de inativo seria errado, e
 * escondê-lo da contagem seria pior — a rotina é dela, não da notificação. Então a contagem é de
 * **todos**, e quantos não tocam aparece ao lado, apenas quando há algum.
 */
const horariosLabel = (view: OilRoutineView): string => {
  const total = view.times.length;
  if (total === 0) return 'Sem horários definidos';
  const mudos = view.times.filter((t) => !t.reminderEnabled).length;
  const base = total === 1 ? '1 horário' : `${total} horários`;
  return mudos === 0 ? base : `${base} · ${mudos} sem lembrete`;
};

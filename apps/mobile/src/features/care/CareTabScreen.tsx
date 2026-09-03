import type { OilRoutineView } from '@app/core';
import { StyleSheet } from 'react-native';

import { Button, Card, Screen, ScreenHeader, Text } from '@/design/primitives';
import { CareGuideLibrary } from '@/features/care/CareGuideLibrary';
import { OilRoutineCard } from '@/features/care/OilRoutineCard';

/**
 * SPEC-026 fatia 1 (FR6) — **Cuidados**: tudo o que é rotina, num lugar só.
 *
 * O cronograma do dia continua na **Hoje**, que é onde ela age. Aqui mora o que ela consulta e
 * mantém sobre o **cabelo**: o que mudou nele, e como se faz cada cuidado.
 *
 * ⚠️ **SPEC-034 — "Meu ciclo" saiu daqui pela MESMA razão que a prateleira tinha saído.** O ciclo
 * virou o conteúdo da aba **Progresso**, e a barra inferior já é a porta dela. Um cartão aqui
 * cujo botão troca de aba é uma segunda porta para o mesmo destino — exatamente o que a direção
 * recusa. Nada some: o ciclo está a um toque, na barra.
 *
 * ⚠️ **SPEC-027 — a prateleira saiu daqui porque virou aba.** Ela não sumiu: ganhou a quarta vaga
 * da barra, porque é o dado de onde saem o Wash Day, a Smart Shelf e a Hair Intelligence (§0.4).
 * Deixar o cartão aqui criaria **duas portas para a mesma tela**, que é o que a direção recusa.
 *
 * ⚠️ **"Meu cabelo mudou" veio da Conta, e pelo mesmo motivo que a prateleira tinha vindo.** `F23`
 * morava na tela de assinatura, lembretes e exclusão de conta — não por decisão, mas porque quando
 * chegou não havia onde pendurá-lo. Contar que fez química não é configuração: é rotina de cabelo,
 * e rotina de cabelo é aqui. Na Conta ficou o que é mesmo conta.
 *
 * Cartões, não uma lista de links: cada um diz **o que é** antes de oferecer o botão, porque um
 * menu de rótulos obriga a abrir para descobrir, e abrir para descobrir é uma decisão a mais por
 * tela (§6 da direção).
 */
export function CareTabScreen({
  onOpenHairEvents,
  profile,
  oil,
}: {
  /** SPEC-020 — contar o que mudou; ausente quando a capability não está disponível. */
  onOpenHairEvents?: () => void;
  /** SPEC-026 fatia 7 — o acesso a **Você**, no cabeçalho. A tela só repassa. */
  profile: { readonly name: string | null; readonly onPress: () => void };
  /**
   * SPEC-040 FR7 (F39) — o endereço da rotina de óleo. Ela mora aqui e não na Hoje porque configurar
   * não é fazer: a Hoje mostra a ocorrência do dia, e esta aba guarda a rotina.
   */
  oil?: {
    readonly view: OilRoutineView;
    readonly busy: boolean;
    readonly onChoose: (everyDays: number) => void;
    readonly onTurnOff: () => void;
  };
}) {
  return (
    <Screen>
      <ScreenHeader title="Sua rotina" profile={profile} />

      {onOpenHairEvents ? (
        <Card>
          <Text variant="heading" accessibilityRole="header">
            Meu cabelo mudou
          </Text>
          <Text tone="muted">
            Química, coloração, corte, praia, uma pausa — contar o que aconteceu ajuda o app a não seguir com
            um cronograma feito para antes.
          </Text>
          <Button
            label="Contar o que mudou"
            variant="secondary"
            onPress={onOpenHairEvents}
            style={styles.action}
          />
        </Card>
      ) : null}

      {/*
        SPEC-031 — os guias ganham lugar.
        ⚠️ **A SPEC-026 tinha decidido que a área vazia desta aba ficaria vazia**, e a decisão
        estava certa para o que existia então: preencher com atalho inventado seria complexidade
        para preencher espaço. O que mudou não é a régua, é o achado — os guias da SPEC-007 só
        eram alcançáveis por dentro de um cartão de cuidado agendado. Isto não preenche espaço:
        dá endereço a uma capability que não tinha nenhum.
      */}
      {oil ? (
        <OilRoutineCard view={oil.view} busy={oil.busy} onChoose={oil.onChoose} onTurnOff={oil.onTurnOff} />
      ) : null}

      <CareGuideLibrary />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** Duas portas do mesmo tamanho, e nenhuma é a ação primária da tela: nenhuma ocupa a linha. */
  action: { alignSelf: 'flex-start' },
});

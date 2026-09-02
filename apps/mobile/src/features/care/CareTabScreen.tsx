import { StyleSheet } from 'react-native';

import { Button, Card, Screen, ScreenHeader, Text } from '@/design/primitives';
import { CareGuideLibrary } from '@/features/care/CareGuideLibrary';

/**
 * SPEC-026 fatia 1 (FR6) — **Cuidados**: tudo o que é rotina, num lugar só.
 *
 * O cronograma do dia continua na **Hoje**, que é onde ela age. Aqui mora o que ela consulta e
 * mantém sobre o **cabelo**: a forma do mês e o que mudou nele.
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
  onOpenCycle,
  onOpenHairEvents,
  hasPlan,
  profile,
}: {
  onOpenCycle: () => void;
  /** SPEC-020 — contar o que mudou; ausente quando a capability não está disponível. */
  onOpenHairEvents?: () => void;
  /**
   * EC1 — sem plano ativo o ciclo não existe, e um botão que abre uma tela vazia é pior que um
   * botão ausente: a tela diz o que falta em vez de fingir que há algo lá.
   */
  hasPlan: boolean;
  /** SPEC-026 fatia 7 — o acesso a **Você**, no cabeçalho. A tela só repassa. */
  profile: { readonly name: string | null; readonly onPress: () => void };
}) {
  return (
    <Screen>
      <ScreenHeader eyebrow="Sua rotina" title="Cuidados" profile={profile} />

      <Card>
        <Text variant="heading" accessibilityRole="header">
          Meu ciclo
        </Text>
        <Text tone="muted">As quatro semanas do seu cronograma e o que aconteceu em cada uma.</Text>
        {hasPlan ? (
          <Button label="Ver meu ciclo" variant="secondary" onPress={onOpenCycle} style={styles.action} />
        ) : (
          <Text variant="caption" tone="faint">
            Seu ciclo aparece assim que você tiver um cronograma.
          </Text>
        )}
      </Card>

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
      <CareGuideLibrary />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** Duas portas do mesmo tamanho, e nenhuma é a ação primária da tela: nenhuma ocupa a linha. */
  action: { alignSelf: 'flex-start' },
});

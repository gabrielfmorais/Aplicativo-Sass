import type { LocalDate, OilRoutineView } from '@app/core';
import { StyleSheet } from 'react-native';

import { Button, Card, Screen, ScreenHeader, Text } from '@/design/primitives';
import { CareGuideLibrary } from '@/features/care/CareGuideLibrary';
import { OilRoutineSummary } from '@/features/care/OilRoutineSummary';

/**
 * SPEC-026 fatia 1 (FR6) — **Cuidados**: tudo o que é rotina, num lugar só.
 *
 * O cronograma do dia continua na **Hoje**, que é onde ela age. Aqui mora o que ela consulta e
 * mantém sobre o **cabelo**: como se faz cada cuidado, as finalizações, a rotina de óleo e o que
 * mudou no cabelo dela.
 *
 * ⚠️ **A ORDEM DOS BLOCOS É DECISÃO, e está na SPEC-067** — conteúdo que ela consulta antes de
 * configuração que ela ajusta uma vez, e rotina mantida antes de evento raro. Antes era a ordem de
 * chegada: cada SPEC acrescentava o seu bloco no fim, e os guias — o conteúdo que dá nome à aba —
 * tinham ido parar a **1,65 tela** do topo. ⛔ Um bloco novo **escolhe** onde entra; o teste de ordem
 * falha se ele apenas cair no fim.
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
  onOpenFinishes,
  profile,
  oil,
}: {
  /** SPEC-020 — contar o que mudou; ausente quando a capability não está disponível. */
  onOpenHairEvents?: () => void;
  /** SPEC-056 (F38) — a área de Finalizações: os nomes e o que ela já registrou. */
  onOpenFinishes: () => void;
  /** SPEC-026 fatia 7 — o acesso a **Você**, no cabeçalho. A tela só repassa. */
  profile: { readonly name: string | null; readonly onPress: () => void };
  /**
   * SPEC-040 FR7 (F39) — o endereço da rotina de óleo. Ela mora aqui e não na Hoje porque configurar
   * não é fazer: a Hoje mostra a ocorrência do dia, e esta aba guarda a rotina.
   */
  /**
   * SPEC-071 — a aba mostra **o estado** da rotina; o ajuste mora na tela dela. As ações de
   * configuração saíram daqui junto com a configuração.
   */
  oil?: {
    readonly view: OilRoutineView;
    readonly today: LocalDate;
    /** O relógio de parede dela, `HH:MM` — o "próximo horário" precisa saber que horas são. */
    readonly nowTime: string;
    readonly onOpen: () => void;
  };
}) {
  return (
    <Screen>
      <ScreenHeader title="Sua rotina" profile={profile} />

      {/*
        SPEC-067 FR1 — ⚠️ **a ordem desta aba é uma decisão, e antes era a ordem de chegada.**

        Medido a 390×844 no DEV real: os guias começavam a **1393px** de uma página de 1640 — os
        últimos 15%, 1,65 tela abaixo do topo — enquanto a **configuração** da rotina de óleo ocupava
        **792px**, 94% de uma tela inteira, logo depois do cabeçalho. A aba se chama **Cuidados** e o
        conteúdo sobre cuidado era a última coisa nela; a SPEC-031 escreveu que os guias *"ganham
        endereço"*, e o endereço que sobrou foi o mais distante.

        **A régua, agora explícita:** conteúdo que ela **consulta** antes de configuração que ela
        **ajusta uma vez** (BR1), e rotina mantida com frequência antes de evento raro (BR2).

        ⛔ *"Meu cabelo mudou"* ficar por último **não** é juízo sobre a importância dele — é
        frequência: é o bloco que ela procura quando algo aconteceu, não o que ela abre a aba para ver.
      */}
      {/*
        SPEC-031 — os guias ganham lugar.
        ⚠️ **A SPEC-026 tinha decidido que a área vazia desta aba ficaria vazia**, e a decisão
        estava certa para o que existia então: preencher com atalho inventado seria complexidade
        para preencher espaço. O que mudou não é a régua, é o achado — os guias da SPEC-007 só
        eram alcançáveis por dentro de um cartão de cuidado agendado. Isto não preenche espaço:
        dá endereço a uma capability que não tinha nenhum.
      */}
      <CareGuideLibrary />

      {/*
        SPEC-056 (F38, shell) — Finalizações ganha lugar, no padrão dos outros cartões: diz o que é,
        depois oferece. Aqui mora **o nome e o que ela já fez**; "melhor para você" e "como fazer" são
        o resto do F38, atrás do gate D-26/D-70.
      */}
      <Card>
        <Text variant="heading" accessibilityRole="header">
          Finalizações
        </Text>
        <Text tone="muted">
          As formas de finalizar que você registra nos seus cuidados — os nomes, e quantas vezes você já fez
          cada uma.
        </Text>
        <Button label="Ver finalizações" variant="secondary" onPress={onOpenFinishes} style={styles.action} />
      </Card>

      {/*
        SPEC-040/053 (F39) — a rotina de óleo. ⚠️ **Ela é configuração, e é por isso que desceu**
        (SPEC-067 BR1): a ocorrência do dia — o que ela **faz** — já aparece na Hoje; aqui mora o que
        ela **ajusta**, e ajustar acontece uma vez.
      */}
      {oil ? (
        <OilRoutineSummary view={oil.view} today={oil.today} nowTime={oil.nowTime} onOpen={oil.onOpen} />
      ) : null}

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** Duas portas do mesmo tamanho, e nenhuma é a ação primária da tela: nenhuma ocupa a linha. */
  action: { alignSelf: 'flex-start' },
});

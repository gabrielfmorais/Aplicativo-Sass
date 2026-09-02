import type { ReactNode } from 'react';

import { Stack, Text } from '@/design/primitives';

/**
 * SPEC-030 — o cabeçalho de uma seção da Hoje, e a **costura** por onde as próximas entram.
 *
 * A Hoje é uma pilha de seções com título: *Sugestões para você*, *Próximos*, *Histórico*. Cada uma
 * repetia o mesmo `Text variant="overline" tone="accent"` na sua própria tela, e a próxima seção
 * repetiria de novo — três cópias de uma decisão de design que é uma só.
 *
 * ⚠️ **É isto que prepara "Produtos para você" sem redesenhar a Home.** A direção pede que a seção
 * comercial futura entre naturalmente. Ela entra assim:
 *
 * ```tsx
 * <HomeSection title="Produtos para seu próximo Wash Day">
 *   <ProductRail products={…} />
 * </HomeSection>
 * ```
 *
 * O que a torna encaixável não é um componente vazio esperando conteúdo — isso seria código morto,
 * e a regra de necessidade o proíbe (D-47/D-48). É o **formato**: a seção não impõe nada sobre o
 * corpo. Uma lista vertical (sugestões, cuidados) e uma trilha horizontal (produtos) são o mesmo
 * `children`, e a Home continua sendo uma pilha de seções tituladas em qualquer um dos casos.
 *
 * ⚠️ **"Produtos para você" ≠ "Minha Prateleira", e a distinção é de produto, não de layout.** A
 * prateleira é **o que ela já tem** (`F26`, cadastrado por ela, sem preço, sem marca, sem link). A
 * seção comercial é **descoberta** — catálogo real, links afiliados. Misturar as duas faria o app
 * parecer que recomenda o que ela mesma cadastrou, ou que ela possui o que o app está vendendo.
 * Por isso são duas seções com títulos diferentes, e nunca uma só.
 */
export function HomeSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="md">
      {/* `accent`, não `faint`: é um cabeçalho, e cor em superfície pequena é o que dá ritmo à
          tela sem somar elemento (SPEC-027). */}
      <Text variant="overline" tone="accent" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Stack>
  );
}

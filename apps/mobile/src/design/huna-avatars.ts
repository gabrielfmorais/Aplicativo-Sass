import type { HunaAvatar } from '@app/core';

/**
 * SPEC-042 (F34) — a geometria das marcas da Huna, como **dado puro**.
 *
 * Sem React, sem SVG, sem `react-native`: é o método que sobreviveu da SPEC-036 e que permitiu
 * julgar o hero **olhando** em vez de imaginando. Aqui vale menos (uma marca de 40px erra menos que
 * um hero de 200pt), mas a separação é a mesma e custa nada.
 *
 * 🔒 **Abstratas, pela decisão canônica do hero.** Fluxo, mechas, movimento. **Sem personagem, sem
 * rosto, sem cabeça, sem corpo, sem silhueta humana** — e num círculo de 40px um rosto erra por
 * definição, que é exatamente o motivo de quatro tentativas de hero terem sido reprovadas.
 *
 * **Uma geometria, seis paletas, e a inclinação variando.** Seis desenhos diferentes seriam seis
 * chances de um sair pior que os outros; uma família com variação controlada é o que faz um conjunto
 * parecer um conjunto — a mesma lição dos ícones da SPEC-035, onde o que unia os quatro era massa
 * óptica igual e não o arranjo.
 */

/**
 * As mechas, num quadrado de 100×100. Três fios, com espessura e curva diferentes.
 *
 * ⚠️ **A primeira versão lia como listras, e o dono já tinha nomeado esse modo de falha** para o
 * hero: *"o defeito é se parecer apenas com fita abstrata, tecido, tentáculo, onda genérica,
 * listras"*. Os fios eram quase verticais, iam de borda a borda e o círculo os **cortava reto** em
 * cima e embaixo — o mesmo corte que reprovou uma versão do hero.
 *
 * O que resolveu foi **curva de verdade e recuo**: cada fio faz um S com deslocamento lateral real,
 * começa em ~20 e termina em ~82, e por isso **cabe inteiro dentro do círculo**. Quatro conjuntos
 * foram desenhados e comparados **fora do app**, em quatro tamanhos (96 · 56 · 40 · 28px), antes de
 * qualquer um entrar na tela — é o método da SPEC-036, e foi ele que mostrou que uma varredura
 * diagonal vira borrão a 40px e que dois fios viram um símbolo, não cabelo.
 */
export const STRANDS = [
  { d: 'M 30 22 C 14 42, 44 54, 32 80', width: 12 },
  { d: 'M 51 18 C 71 38, 37 58, 55 82', width: 15 },
  { d: 'M 72 24 C 87 44, 63 60, 74 78', width: 10 },
] as const;

/**
 * Cada marca é um par: o fundo e os fios. As cores saem da paleta aprovada (SPEC-016/SPEC-026), e
 * o contraste entre os dois é o que faz a marca existir a 40px.
 *
 * `tilt` inclina a composição inteira alguns graus — é o que diferencia duas marcas da mesma
 * família sem inventar um desenho novo para cada uma.
 */
export const AVATAR_MARKS: Record<HunaAvatar, { bg: string; strand: string; tilt: number }> = {
  flow_plum: { bg: '#F6E9EF', strand: '#7A2F52', tilt: -6 },
  flow_wine: { bg: '#F3E7EC', strand: '#5A1F3C', tilt: 5 },
  flow_berry: { bg: '#FAEBF0', strand: '#A8446B', tilt: -12 },
  flow_violet: { bg: '#EDE8F4', strand: '#4A2A5E', tilt: 9 },
  flow_amber: { bg: '#FBF0E4', strand: '#8A5320', tilt: -3 },
  flow_teal: { bg: '#E6F0EE', strand: '#265950', tilt: 12 },
};

/**
 * O nome que a leitora de tela ouve. Descreve a **marca**, nunca a usuária — dizer "avatar da Ana"
 * seria afirmar que aquele desenho a representa, e ele não representa: é uma escolha estética.
 */
export const AVATAR_LABEL: Record<HunaAvatar, string> = {
  flow_plum: 'Mechas em ameixa',
  flow_wine: 'Mechas em vinho',
  flow_berry: 'Mechas em berry',
  flow_violet: 'Mechas em roxo',
  flow_amber: 'Mechas em âmbar',
  flow_teal: 'Mechas em verde',
};

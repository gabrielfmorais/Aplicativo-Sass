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

/** As mechas, num quadrado de 100×100. Três fios, com espessura e curva diferentes. */
export const STRANDS = [
  { d: 'M 22 8 C 10 34, 38 52, 24 92', width: 13 },
  { d: 'M 50 4 C 36 38, 66 56, 50 96', width: 17 },
  { d: 'M 78 8 C 92 34, 62 52, 76 92', width: 11 },
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

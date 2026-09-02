import Svg, { Circle, Path } from 'react-native-svg';

/**
 * SPEC-026 fatia 6 — os ícones da navegação.
 *
 * **Desenhados aqui, e não instalados.** Uma biblioteca de ícones traz mil glifos para usar quatro,
 * e nenhum deles nasce parecido com a Huna: um conjunto genérico é o jeito mais rápido de um produto
 * ficar com cara de template. São quatro caminhos, e caber num arquivo é a prova de que a biblioteca
 * seria peso sem retorno.
 *
 * **Traço, nunca preenchimento.** Contorno fino sobre creme lê leve; ícone maciço lê pesado, e o
 * peso desta barra deve estar na palavra, não no desenho. `currentColor` não existe em RN, então a
 * cor vem por prop — a barra decide, o ícone obedece.
 *
 * ⚠️ **Nenhum deles é o portador do estado.** A aba ativa se lê por palavra, peso, cor e traço
 * (FR2); trocar o desenho do ícone entre ativo e inativo somaria um quinto canal e nenhuma
 * informação. Ícone aqui é reconhecimento, não estado.
 */

type IconProps = { readonly color: string; readonly size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
});

const stroke = (color: string) => ({
  stroke: color,
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/** Hoje: uma gota. O cuidado do dia é o gesto, e o gesto do produto é hidratar. */
export function DropIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M12 3.5 C 8.2 8, 6 11, 6 14 C 6 17.6, 8.7 20.5, 12 20.5 C 15.3 20.5, 18 17.6, 18 14 C 18 11, 15.8 8, 12 3.5 Z"
        {...stroke(color)}
      />
    </Svg>
  );
}

/** Cuidados: mechas. É a rotina inteira — o que ela faz com o cabelo, semana a semana. */
export function StrandsIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M8 3.5 C 5 7, 4 12, 4.8 16.5 C 5.2 18.6, 6 20, 7 20.8" {...stroke(color)} />
      <Path d="M12 3 C 10 7.5, 9.6 13, 10.6 17.4 C 11 19.2, 11.6 20.4, 12.4 21" {...stroke(color)} />
      <Path d="M16 3.5 C 19 7, 20 12, 19.2 16.5 C 18.8 18.6, 18 20, 17 20.8" {...stroke(color)} />
    </Svg>
  );
}

/** Progresso: uma curva que sobe. Sem escala, sem números — direção, não nota. */
export function GrowthIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M3.5 19 C 7 19, 9.5 16, 11.5 12 C 13.5 8, 16.5 5.4, 20.5 5" {...stroke(color)} />
      <Circle cx="20.5" cy="5" r="2" {...stroke(color)} />
    </Svg>
  );
}

/** Você: cabeça e ombro, no mesmo desenho do hero — a figura da marca, reduzida a duas linhas. */
export function PersonIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Circle cx="12" cy="8" r="4" {...stroke(color)} />
      <Path d="M4.5 20.5 C 5.2 16.6, 8.3 14, 12 14 C 15.7 14, 18.8 16.6, 19.5 20.5" {...stroke(color)} />
    </Svg>
  );
}

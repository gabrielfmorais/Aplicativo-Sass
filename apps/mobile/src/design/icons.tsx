import Svg, { Circle, Path } from 'react-native-svg';

/**
 * SPEC-035 — os ícones da navegação.
 *
 * **Desenhados aqui, e não instalados.** Uma biblioteca traz mil glifos para usar quatro, e nenhum
 * deles nasce parecido com a Huna: um conjunto genérico é o jeito mais rápido de um produto ficar
 * com cara de template. São quatro caminhos, e caber num arquivo é a prova de que a biblioteca seria
 * peso sem retorno.
 *
 * ⚠️ **O que a rodada anterior errou, visto a 390px na barra real e não deduzido no papel.**
 *
 * - **Traço 1.9 numa caixa de 22 é fino demais para o rótulo que está embaixo.** Toda a densidade da
 *   barra estava no texto, e a fileira de ícones parecia um rascunho por cima de um menu pronto.
 * - **Cuidados lia `( )`.** A mecha longa com o cacho no pé é um bom desenho **grande**; a 22px o
 *   cacho vira um borrão e sobram duas curvas paralelas — parêntese, de novo.
 * - **Progresso lia como um risco.** Uma curva fina de canto a canto, com dois nós pequenos, não tem
 *   massa suficiente para se afirmar ao lado de três desenhos fechados.
 * - **Prateleira era o mais pesado dos quatro** — dois frascos desenhados por dentro, com tampa
 *   sólida, num espaço onde os outros têm duas linhas. Um conjunto em que um ícone tem o dobro da
 *   densidade dos outros não é um conjunto.
 *
 * **As regras deste conjunto, e é o cumprimento delas que faz quatro símbolos virarem irmãos:**
 *
 * 1. **Grade de 24 com margem viva de 3,** e — o que faltava — a mesma **massa óptica**: cada ícone
 *    tem entre duas e três formas, nunca cinco.
 * 2. **Traço 2.15, pontas e junções redondas.** Firme o bastante para sustentar o rótulo sem virar
 *    ícone maciço, que sobre creme lê pesado.
 * 3. **Um detalhe preenchido por ícone, no máximo.** É o pequeno peso sólido que impede um desenho
 *    de traço de parecer inacabado — e é sempre **um**, senão vira ilustração.
 * 4. **Curva em tudo.** O assunto é cabelo e cuidado; reta pura é vocabulário de outro produto.
 *
 * `currentColor` não existe em RN, então a cor vem por prop — a barra decide, o ícone obedece.
 *
 * ⚠️ **Nenhum deles é o portador do estado.** A aba ativa se lê por pastilha, palavra, peso e cor;
 * trocar o desenho entre ativo e inativo somaria um canal e nenhuma informação. Ícone aqui é
 * reconhecimento, não estado.
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
  strokeWidth: 2.15,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/**
 * Hoje: a gota, com o brilho dentro.
 *
 * A gota sozinha é o ícone mais genérico deste mercado. O que a tira do genérico é o segundo
 * volume — a gota pequena e sólida deslocada para baixo e para a esquerda, que é onde a luz pousa
 * numa gota de verdade. Custa um `Path` e muda a leitura de "ícone de app de água" para "isto foi
 * desenhado".
 */
export function DropIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M12 3 C 8.3 7.5, 5.4 11, 5.4 14.5 C 5.4 18.3, 8.4 21.2, 12 21.2 C 15.6 21.2, 18.6 18.3, 18.6 14.5 C 18.6 11, 15.7 7.5, 12 3 Z"
        {...stroke(color)}
      />
      <Path
        d="M10.5 13.4 C 8.9 15, 9 17.3, 10.8 18.4 C 8.9 18.8, 7.4 17.3, 7.5 15.5 C 7.6 14.2, 9 13.2, 10.5 13.4 Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Cuidados: **duas mechas onduladas, de comprimentos diferentes.**
 *
 * ⚠️ **A versão anterior perdia na escala em que ela vive.** Uma mecha longa terminando num cacho
 * fechado é boa a 40px e some a 22: o cacho vira um borrão e sobram duas curvas quase paralelas, que
 * é a definição visual de parêntese — exatamente o defeito que a versão **anterior à anterior** já
 * tinha. Um ícone que só funciona grande está errado para uma barra.
 *
 * O que resolve é a **onda**. Duas inflexões em cada linha, em fases opostas entre as duas mechas, e
 * comprimentos diferentes: nenhuma das duas pode ser confundida com um arco de pontuação, porque
 * parêntese não muda de direção duas vezes. É o mesmo vocabulário do hero, reduzido a duas linhas.
 */
export function StrandsIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M9.1 3.2 C 6 6.6, 5.5 10.4, 7.6 13.2 C 9.7 16, 9.4 18.8, 6.9 20.8" {...stroke(color)} />
      <Path d="M15.4 3.2 C 18.7 6.4, 19.2 10.6, 17 13.6 C 15.2 16, 15.1 18.2, 16.8 19.9" {...stroke(color)} />
    </Svg>
  );
}

/**
 * Progresso: **uma onda que sobe, com o nó no fim.**
 *
 * ⚠️ **Duas versões erradas antes desta, as duas vistas na barra real.** Uma curva fina de canto a
 * canto com dois nós pequenos lia como **um risco** — sem massa para se afirmar ao lado de três
 * desenhos fechados. A correção seguinte foi empilhar duas ondas paralelas, e isso lia como **"≈"**:
 * duas curvas iguais e paralelas são um símbolo matemático, não uma trajetória.
 *
 * O que faz ler "progresso" é **uma** linha com direção clara e um destino marcado. A onda dá o
 * vocabulário da marca (nada de reta), a subida dá a direção, e o nó sólido no alto diz onde ela
 * está — o peso fica no fim do caminho, que é o assunto.
 *
 * ⚠️ **Não é gráfico e não tem escala.** Direção, nunca nota: a SPEC-019 recusou pontuar o ciclo, e
 * um ícone com eixos ou barras prometeria exatamente o que o produto se recusa a dar.
 */
export function GrowthIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M3.6 19.4 C 7.2 19, 8.8 15.4, 11.4 12.4 C 13.6 9.8, 15.8 8.2, 18.4 7.4" {...stroke(color)} />
      <Circle cx="19.4" cy="6.2" r="2.6" fill={color} />
    </Svg>
  );
}

/**
 * Prateleira: **um frasco apoiado numa linha.**
 *
 * ⚠️ **Eram dois frascos, e o ícone virou o mais pesado dos quatro.** Dois corpos desenhados por
 * dentro, dois gargalos e uma tampa sólida somavam cinco formas onde os irmãos têm duas — e um
 * conjunto em que um ícone tem o dobro da densidade dos outros não é um conjunto. "Os meus" não
 * precisa de dois objetos para ser dito; a **linha** é que diz prateleira, e ela continua ali.
 *
 * ⚠️ **Reta é permitida neste, e só neste.** O vocabulário do conjunto é curva porque o assunto dos
 * outros três é cabelo, e cabelo não tem aresta. Vidro tem. Arredondar um frasco para obedecer a uma
 * regra de estilo o transformaria em gota, que é o ícone da primeira aba.
 */
export function ShelfIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M3.6 20.8 L 20.4 20.8" {...stroke(color)} />
      <Path
        d="M8.2 20.8 L 8.2 11.8 C 8.2 10.1, 9.2 8.8, 10.6 8.3 L 10.6 6 L 13.4 6 L 13.4 8.3 C 14.8 8.8, 15.8 10.1, 15.8 11.8 L 15.8 20.8"
        {...stroke(color)}
      />
      {/* A tampa: o único preenchimento, pela regra 3 — o pequeno peso sólido que segura o desenho. */}
      <Path d="M10.2 3.2 L 13.8 3.2 L 13.8 6 L 10.2 6 Z" fill={color} />
    </Svg>
  );
}

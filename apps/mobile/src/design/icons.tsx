import Svg, { Circle, Path } from 'react-native-svg';

/**
 * SPEC-027 — os ícones da navegação, redesenhados.
 *
 * **Desenhados aqui, e não instalados.** Uma biblioteca traz mil glifos para usar quatro, e nenhum
 * deles nasce parecido com a Huna: um conjunto genérico é o jeito mais rápido de um produto ficar
 * com cara de template. São quatro caminhos, e caber num arquivo é a prova de que a biblioteca seria
 * peso sem retorno.
 *
 * ⚠️ **O que a versão anterior errou, visto a 390px e não deduzido.**
 *
 * - **Cuidados eram três arcos quase idênticos e simétricos, e liam como `((( )))`** — pontuação, não
 *   mechas. O defeito é estrutural: três curvas paralelas com a mesma inflexão e o mesmo comprimento
 *   é a definição de um parêntese repetido. Mecha de cabelo tem **comprimentos diferentes**, nasce
 *   num ponto comum e **termina em alturas diferentes**.
 * - **Progresso era um rabisco solto com um ponto na ponta**, flutuando sem base. Sem uma linha de
 *   chão, uma curva ascendente não lê como progresso — lê como fio perdido.
 * - **O traço 1.7 era mais leve que os rótulos**, então todo o peso da barra estava no texto e a
 *   fileira de ícones parecia um rascunho por cima de um menu pronto.
 *
 * **As regras que este conjunto segue, e que fazem dele um conjunto:**
 *
 * 1. **Uma grade de 24, com margem viva de 3.** Nenhum desenho encosta na borda; todos ocupam a
 *    mesma caixa óptica, que é o que faz quatro símbolos diferentes parecerem irmãos.
 * 2. **Traço 1.9, pontas e junções redondas.** Mais firme que antes — o suficiente para sustentar um
 *    rótulo em `bodyStrong` sem sumir — e ainda longe do ícone maciço, que sobre creme lê pesado.
 * 3. **Um detalhe preenchido por ícone, no máximo.** A gota tem uma gota menor dentro, a curva de
 *    progresso tem um nó, o perfil tem a marca do fio. É o pequeno peso sólido que impede um ícone
 *    de traço fino de parecer inacabado — e é sempre **um**, senão vira desenho.
 * 4. **Vocabulário da marca, não de biblioteca.** Curva Bézier em tudo, nada de reta pura, e a
 *    linguagem de fio/mecha do hero repetida na escala pequena.
 *
 * `currentColor` não existe em RN, então a cor vem por prop — a barra decide, o ícone obedece.
 *
 * ⚠️ **Nenhum deles é o portador do estado.** A aba ativa se lê por palavra, peso, cor e pastilha
 * (FR2); trocar o desenho do ícone entre ativo e inativo somaria um canal e nenhuma informação.
 * Ícone aqui é reconhecimento, não estado.
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
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/**
 * Hoje: a gota, com o brilho dentro.
 *
 * A gota sozinha é o ícone mais genérico que existe neste mercado. O que a tira do genérico é o
 * segundo volume — a gota pequena e sólida deslocada para baixo e para a esquerda, que é onde a luz
 * pousa numa gota de verdade. Custa um `Path` e muda a leitura de "ícone de app de água" para "isto
 * foi desenhado".
 */
export function DropIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M12 3.2 C 8.4 7.6, 5.6 11, 5.6 14.4 C 5.6 18.2, 8.5 21, 12 21 C 15.5 21, 18.4 18.2, 18.4 14.4 C 18.4 11, 15.6 7.6, 12 3.2 Z"
        {...stroke(color)}
      />
      <Path
        d="M10.4 13.6 C 9 15.1, 9.1 17.2, 10.7 18.2 C 9 18.6, 7.6 17.2, 7.7 15.6 C 7.8 14.4, 9 13.5, 10.4 13.6 Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Cuidados: uma mecha que **encaracola** no fim, com duas companheiras mais curtas.
 *
 * ⚠️ **Duas tentativas, e as duas foram vistas grandes antes de serem aceitas ou recusadas.**
 * Três arcos paralelos leem `((( )))`. Três curvas convergindo num ponto comum — a tentativa
 * seguinte, e ela parecia certa no papel, porque fio nasce mesmo no couro cabeludo — leem **folha**:
 * duas bordas simétricas que se encontram em cima e em baixo é a definição de amêndoa.
 *
 * O que resolve não é o arranjo, é a **inflexão**. Uma linha que só arqueia é um parêntese; uma
 * linha que arqueia e depois **vira** é um fio. O cacho no pé da mecha longa é essa virada, e é ele
 * que dá o assunto ao ícone inteiro: nenhum outro desenho de 24px diz "cabelo" tão rápido.
 */
export function StrandsIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M8.6 3 C 5.2 7.2, 4.2 12.6, 5.8 16.6 C 6.8 19.2, 9.3 20.5, 11 19.1 C 12.6 17.7, 12.1 15.4, 10.2 15.3"
        {...stroke(color)}
      />
      <Path d="M14.6 3 C 18.6 6.6, 20 11.6, 18.6 15.6 C 17.8 18, 16.6 19.9, 15.2 21" {...stroke(color)} />
    </Svg>
  );
}

/**
 * Progresso: **de um ponto a outro**, subindo.
 *
 * Dois nós e a curva entre eles. O pequeno é onde ela começou, o grande é onde ela está — e a
 * diferença de tamanho carrega a ideia inteira sem nenhum número. É a mesma frase do produto: houve
 * um antes, houve um depois, e não há nota entre os dois.
 *
 * ⚠️ **A primeira versão tinha uma linha de chão cinza e virou taco de golfe.** Uma base solta
 * embaixo de uma curva não ancora nada — ela vira um segundo objeto, e o olho lê dois desenhos
 * empilhados. O nó de origem faz o trabalho que a base tentava fazer, e faz na própria curva.
 *
 * ⚠️ **Não é gráfico e não tem escala.** Direção, nunca nota: a SPEC-019 recusou pontuar o ciclo, e
 * um ícone com eixos prometeria exatamente o que o produto se recusa a dar.
 */
export function GrowthIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M4.6 18.4 C 8.2 17.4, 11 14.4, 12.9 10.4 C 14.4 7.2, 16.6 5.2, 19.2 4.4" {...stroke(color)} />
      <Circle cx="4.4" cy="18.7" r="1.5" fill={color} />
      <Circle cx="19.5" cy="4.3" r="2.4" fill={color} />
    </Svg>
  );
}

/**
 * Prateleira: dois vidros **apoiados numa linha**.
 *
 * A linha é o assunto — "prateleira" é literalmente onde as coisas ficam —, e é por isso que aqui
 * ela funciona e no Progresso não funcionava: lá era uma base solta debaixo de uma curva que não a
 * tocava; aqui os dois objetos **pousam** nela, e as três formas viram uma cena.
 *
 * ⚠️ **Reta é permitida neste, e só neste.** O vocabulário do conjunto é curva porque o assunto dos
 * outros três é cabelo, e cabelo não tem aresta. Vidro tem. Arredondar um frasco para obedecer a uma
 * regra de estilo o transformaria em gota, que é o ícone da aba ao lado.
 *
 * **Dois objetos, não três nem um.** Um vidro sozinho é "produto"; dois são "os meus". Três, a 23px,
 * viram uma cerca.
 */
export function ShelfIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M3.4 20.9 L 20.6 20.9" {...stroke(color)} />
      <Path
        d="M5.2 20.9 L 5.2 12 C 5.2 10.5, 6 9.4, 7.2 9 L 7.2 6.8 L 9.4 6.8 L 9.4 9 C 10.6 9.4, 11.4 10.5, 11.4 12 L 11.4 20.9"
        {...stroke(color)}
      />
      {/* A tampa: o único preenchimento, pela regra 3 — o pequeno peso sólido que segura o desenho. */}
      <Path d="M7 4.2 L 9.6 4.2 L 9.6 6.8 L 7 6.8 Z" fill={color} />
      <Path
        d="M13.9 20.9 L 13.9 15.4 C 13.9 14.1, 14.9 13.2, 16.2 13.2 L 18.2 13.2 C 19.5 13.2, 20.5 14.1, 20.5 15.4 L 20.5 20.9"
        {...stroke(color)}
      />
    </Svg>
  );
}

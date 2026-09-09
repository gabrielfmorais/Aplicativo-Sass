import Svg, { Path } from 'react-native-svg';

/**
 * SPEC-035 — os ícones da navegação, **na direção que o dono trouxe em 2026-09-09**.
 *
 * **Desenhados aqui, e não instalados.** Uma biblioteca traz mil glifos para usar quatro, e nenhum
 * deles nasce parecido com a Huna: um conjunto genérico é o jeito mais rápido de um produto ficar
 * com cara de template. São quatro desenhos, e caber num arquivo é a prova de que a biblioteca seria
 * peso sem retorno.
 *
 * ⚠️ **O que mudou nesta rodada, e por quê.** O dono mandou uma imagem de referência com os quatro
 * ícones que quer — gota **com brilho**, mechas em **fluxo diagonal**, **frasco com pump + pote** e
 * **barras com a seta subindo** — e disse "se for preciso melhore". O conjunto anterior era mais
 * pobre em três frentes: a gota não tinha brilho (o segundo volume vivia **dentro** dela e some a
 * 22px), a prateleira tinha **um** frasco sem pump, e o progresso era uma linha com um nó, desenho
 * que já havia sido reprovado duas vezes por ler como **risco**. A referência resolve as três com
 * formas que se reconhecem pequenas.
 *
 * ⚠️ **A ressalva registrada, porque ela contradiz o que estava escrito aqui.** A versão anterior
 * dizia, por escrito, que o Progresso *"não é gráfico e não tem escala"* e que barras
 * *"prometeriam exatamente o que o produto se recusa a dar"*. A recusa continua de pé — a SPEC-019 e
 * a SPEC-021 não pontuam o ciclo, e as barreiras de texto contra `score`, nota, percentual e
 * aderência naquela aba continuam verdes. **O que a medição mostra é que a frase era larga demais:**
 * a aba Progresso mostra **contagem de cuidados** ("14 cuidados", as semanas do ciclo), e três
 * barras de alturas diferentes são exatamente o desenho de uma contagem. **Barra é quantidade, não
 * nota** — o que seria proibido é o ícone trazer **eixo, escala, régua ou percentual**, e ele não
 * traz nenhum dos quatro.
 *
 * **As regras deste conjunto, e é o cumprimento delas que faz quatro símbolos virarem irmãos:**
 *
 * 1. **Grade de 24 com margem viva de ~3,** e a mesma **massa óptica**: nenhum ícone tem o dobro da
 *    densidade do vizinho.
 * 2. **Traço 2.15, pontas e junções redondas.** Firme o bastante para sustentar o rótulo embaixo sem
 *    virar ícone maciço, que sobre creme lê pesado.
 * 3. **Um detalhe preenchido por ícone, no máximo.** É o pequeno peso sólido que impede um desenho
 *    de traço de parecer inacabado — e é sempre **um**, senão vira ilustração.
 * 4. **Curva onde o assunto é cabelo; reta onde o assunto é vidro.** Arredondar um frasco para
 *    obedecer a uma regra de estilo o transformaria em gota, que é o ícone da primeira aba.
 *
 * ⚠️ **Cada desenho foi julgado depois de pronto, fora do app** — renderizado a 18, 22, 24, 56 e
 * 112px e na barra de 390px inteira, que é o método que a SPEC-036 e a SPEC-042 fixaram depois de
 * quatro direções reprovadas. Três descartes desta rodada, todos vistos e nenhum deduzido: mechas
 * **verticais e juntas** liam como ondas de vapor (mesma família do parêntese que já reprovou duas
 * versões de Cuidados); **quatro** mechas viravam mancha a 22px, e três em diagonal não; e o pump
 * desenhado como **bloco preenchido** empastava o topo do frasco — o que lê é o stem com o bico, em
 * traço.
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

const stroke = (color: string, width = 2.15) => ({
  stroke: color,
  strokeWidth: width,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/**
 * Hoje: **a gota com o brilho ao lado.**
 *
 * A gota sozinha é o ícone mais genérico deste mercado. O que a tira do genérico é o **brilho de
 * quatro pontas** apoiado no ombro direito dela — o sinal que diz "cuidado" sem dizer "produto" —
 * mais a **vírgula de luz** dentro, que é onde a luz pousa numa gota de verdade.
 *
 * ⚠️ **O brilho fica FORA do corpo da gota, e isso não é composição, é legibilidade.** A versão
 * anterior tinha só o volume interno: a 22px ele encosta na parede da gota e some. Do lado de fora,
 * sobre o fundo, ele sobrevive até 18px — que é o tamanho em que este conjunto ainda precisa
 * funcionar.
 */
export function DropIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M11 4.4 C 7.5 9.1, 4.8 12.4, 4.8 15.7 C 4.8 19.3, 7.6 21.9, 11 21.9 C 14.4 21.9, 17.2 19.3, 17.2 15.7 C 17.2 12.4, 14.5 9.1, 11 4.4 Z"
        {...stroke(color)}
      />
      {/* A vírgula de luz. Traço mais fino de propósito: é reflexo, não parede. */}
      <Path d="M8.9 14.9 C 7.7 16.3, 8.0 18.2, 9.6 19.0" {...stroke(color, 1.7)} />
      {/* O brilho — o único preenchimento, pela regra 3. */}
      <Path
        d="M19.1 2.9 C 19.4 5.0, 20.1 5.7, 22.1 6.0 C 20.1 6.3, 19.4 7.0, 19.1 9.1 C 18.8 7.0, 18.1 6.3, 16.1 6.0 C 18.1 5.7, 18.8 5.0, 19.1 2.9 Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Cuidados: **três mechas em fluxo diagonal.**
 *
 * ⚠️ **A diagonal é o que separa "cabelo" de "calor".** Duas versões anteriores foram reprovadas por
 * lerem como pontuação (`( )`) e uma terceira, desta rodada, por ler como **vapor**: mechas
 * empilhadas na vertical, juntas e com a mesma amplitude, são o símbolo de calor, não de cabelo. O
 * que muda a leitura é o **fluxo** — as três correm de cima à direita para baixo à esquerda, com
 * inflexão dupla e espaçamento visível entre elas, como um cacho caindo.
 *
 * ⚠️ **Três, e não quatro.** A referência tem quatro fios; a 22px o quarto encosta nos vizinhos e o
 * conjunto vira mancha. Três guarda o gesto e sobrevive ao tamanho em que ele vive.
 *
 * **Sem preenchimento nenhum** — a regra 3 diz "no máximo um", e aqui o desenho já se sustenta: três
 * traços longos têm massa de sobra ao lado da gota.
 */
export function StrandsIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M15.8 2.8 C 12.2 5.1, 10.4 7.5, 9.8 10.0 C 9.2 12.5, 7.5 14.8, 3.6 16.8" {...stroke(color)} />
      <Path
        d="M18.8 5.2 C 15.0 7.5, 13.2 10.0, 12.6 12.6 C 12.0 15.2, 10.2 17.5, 6.2 19.5"
        {...stroke(color)}
      />
      <Path
        d="M21.4 7.8 C 17.8 10.0, 16.0 12.5, 15.4 15.0 C 14.8 17.5, 13.2 19.6, 9.4 21.4"
        {...stroke(color)}
      />
    </Svg>
  );
}

/**
 * Prateleira: **o frasco com pump e o pote ao lado.**
 *
 * ⚠️ **Voltaram a ser dois objetos, e desta vez sem virar o ícone mais pesado dos quatro.** A versão
 * de dois frascos que foi reprovada tinha dois corpos, dois gargalos e uma tampa sólida — cinco
 * formas onde os irmãos tinham duas. O que resolve não é ter um objeto só: é **o segundo objeto ser
 * pequeno**. O frasco alto carrega o desenho, o pote baixo diz "os meus", e a densidade fica igual à
 * da gota com brilho.
 *
 * **O pump é o que faz o frasco ser deste produto e não um vidro qualquer** — e ele é traço, não
 * bloco: preenchido, empastava o topo. A tampa do pote é o **único** preenchimento.
 *
 * ⚠️ **Reta é permitida neste, e só neste.** O vocabulário do conjunto é curva porque o assunto dos
 * outros três é cabelo, e cabelo não tem aresta. Vidro tem.
 */
export function ShelfIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path
        d="M4.6 12.4 C 4.6 11.2, 5.6 10.2, 6.8 10.2 L 9.6 10.2 C 10.8 10.2, 11.8 11.2, 11.8 12.4 L 11.8 19.5 C 11.8 20.7, 10.8 21.6, 9.6 21.6 L 6.8 21.6 C 5.6 21.6, 4.6 20.7, 4.6 19.5 Z"
        {...stroke(color)}
      />
      <Path d="M7.0 10.2 L 7.0 8.4 L 9.4 8.4 L 9.4 10.2" {...stroke(color)} />
      <Path d="M8.2 8.4 L 8.2 5.4 L 5.3 5.4 L 5.3 6.9" {...stroke(color)} />
      <Path
        d="M14.2 16.4 C 14.2 15.6, 14.9 14.9, 15.7 14.9 L 19.4 14.9 C 20.2 14.9, 20.9 15.6, 20.9 16.4 L 20.9 20.1 C 20.9 20.9, 20.2 21.6, 19.4 21.6 L 15.7 21.6 C 14.9 21.6, 14.2 20.9, 14.2 20.1 Z"
        {...stroke(color)}
      />
      {/* A tampa do pote: o único preenchimento, pela regra 3. */}
      <Path
        d="M15.4 12.1 L 19.7 12.1 C 20.1 12.1, 20.4 12.4, 20.4 12.8 L 20.4 13.8 C 20.4 14.2, 20.1 14.5, 19.7 14.5 L 15.4 14.5 C 15.0 14.5, 14.7 14.2, 14.7 13.8 L 14.7 12.8 C 14.7 12.4, 15.0 12.1, 15.4 12.1 Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Progresso: **três barras e a seta que sobe por cima delas.**
 *
 * ⚠️ **Duas versões erradas antes desta, as duas vistas na barra real.** Uma curva fina de canto a
 * canto com dois nós lia como **um risco**; empilhar duas ondas paralelas lia como **"≈"**. O que
 * faltava nas duas era **massa fechada** — três desenhos com corpo ao lado de um fio.
 *
 * ⚠️ **Barra aqui é CONTAGEM, não nota, e é essa distinção que autoriza o desenho.** A aba Progresso
 * mostra quantos cuidados aconteceram no ciclo; três alturas diferentes são a forma natural disso. O
 * que continua proibido — na tela e neste desenho — é **escala**: sem eixo, sem régua, sem
 * porcentagem, sem linha de meta. A seta diz **direção no tempo**, que é o assunto da aba, e não
 * "seu cabelo melhorou", que é alegação capilar e continua atrás do gate D-26/D-70.
 *
 * A ponta é o único preenchimento: uma seta com ponta vazada perde o destino a 22px.
 */
export function GrowthIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg {...base(size)}>
      <Path d="M5.2 20.8 L 5.2 17.0" {...stroke(color)} />
      <Path d="M9.8 20.8 L 9.8 14.2" {...stroke(color)} />
      <Path d="M14.4 20.8 L 14.4 11.2" {...stroke(color)} />
      <Path d="M3.8 13.8 C 8.2 13.4, 12.0 10.8, 17.2 5.4" {...stroke(color)} />
      <Path d="M21.2 3.2 L 20.2 8.6 L 15.9 5.4 Z" fill={color} />
    </Svg>
  );
}

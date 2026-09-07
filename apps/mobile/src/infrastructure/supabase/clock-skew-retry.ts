/**
 * ⚠️ **O 401 intermitente do primeiro segundo depois do login — causa raiz MEDIDA, não chutada.**
 *
 * O sintoma: em cerca de 1 em 3 logins no DEV, **uma** requisição REST voltava `401` e a tela que
 * dependia dela quebrava. Ela batia em tabelas diferentes a cada vez (`oil_routines`, `oil_events`,
 * `hair_profiles`), o que já dizia que o problema não era de nenhuma delas — era de **quem chegasse
 * primeiro**.
 *
 * O corpo da resposta nomeia a causa: **`JWT issued at future`**. A medição fecha a conta:
 *
 * ```
 * token emitido às 18:28:50.909   →   iat carimbado = 18:28:51.000
 * ```
 *
 * O servidor de auth **arredonda o `iat` para o segundo**, então por até ~1 segundo o token afirma
 * ter sido emitido no futuro. Quem valida compara `iat` com o próprio relógio e **recusa**. As
 * primeiras leituras depois do login caem exatamente nessa janela, e as seguintes passam — daí a
 * intermitência, e daí ela nunca aparecer em teste.
 *
 * ⚠️ **A consequência não era cosmética.** A rotina de óleo falha em silêncio por decisão (SPEC-040)
 * e apenas sumia; o perfil **não**: a tela autenticada inteira exibia *"Não foi possível carregar seu
 * perfil"* com um "Tentar novamente" — um erro de tela cheia por causa de uma fração de segundo, no
 * primeiro instante em que ela entra no app.
 *
 * **A correção é uma tentativa a mais, e só nesta condição.** Não é um retry genérico de `401`:
 * mascarar autorização negada seria trocar um defeito visível por um invisível. O gatilho é a
 * mensagem do servidor dizendo que o token **ainda não vale** — uma condição que, por definição, se
 * resolve sozinha com o tempo, e onde repetir é a resposta certa.
 *
 * ⚠️ **Repetir aqui é seguro mesmo para escrita:** um `401` é recusa **antes** de o servidor fazer
 * qualquer coisa, então não existe efeito para duplicar. Ainda assim a repetição só acontece com
 * corpo ausente ou de texto — um corpo em stream já teria sido consumido pela primeira tentativa, e
 * repeti-lo mandaria uma requisição vazia.
 */

/** Um segundo é o tamanho do arredondamento; a folga cobre o relógio do aparelho. */
const RETRY_DELAY_MS = 1_100;

const NOT_YET_VALID = /issued at future|not yet valid|token used before issued/i;

const bodyIsReplayable = (body: BodyInit | null | undefined): boolean =>
  body === undefined || body === null || typeof body === 'string';

export const createClockSkewRetryFetch =
  (
    baseFetch: typeof fetch,
    wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ): typeof fetch =>
  async (input, init) => {
    const first = await baseFetch(input, init);
    if (first.status !== 401 || !bodyIsReplayable(init?.body)) return first;

    /**
     * `clone()` para não consumir o corpo que quem chamou ainda vai ler se não houver repetição.
     *
     * ⚠️ **O `try` é sobre o `clone()`, não sobre o `text()`.** `clone()` é síncrono e **lança** se o
     * corpo já tiver sido lido; fora de um `try`, essa exceção sairia daqui como falha de rede e
     * transformaria um `401` legível num erro sem nome — o wrapper pioraria justamente o caso que ele
     * existe para melhorar. Na dúvida, devolver a resposta original é sempre a saída correta.
     */
    let detail: string;
    try {
      detail = await first.clone().text();
    } catch {
      return first;
    }
    if (!NOT_YET_VALID.test(detail)) return first;

    await wait(RETRY_DELAY_MS);
    return await baseFetch(input, init);
  };

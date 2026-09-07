import { createClockSkewRetryFetch } from '@/infrastructure/supabase/clock-skew-retry';

/**
 * ⚠️ **A barreira do retry mais estreito possível.**
 *
 * O valor deste arquivo não é provar que a repetição acontece — é provar **onde ela não acontece**.
 * Um retry genérico de `401` transformaria autorização negada (RLS recusando, sessão expirada,
 * token adulterado) em silêncio com o dobro do custo, e é exatamente o defeito que esta correção
 * não pode introduzir.
 */

const resposta = (status: number, body: string) => new Response(body, { status });
const semEspera = async () => undefined;

describe('createClockSkewRetryFetch (401 "JWT issued at future")', () => {
  it('repete UMA vez quando o servidor diz que o token ainda não vale', async () => {
    const base = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit | undefined]>()
      .mockResolvedValueOnce(resposta(401, '{"message":"JWT issued at future"}'))
      .mockResolvedValueOnce(resposta(200, '[]'));

    const r = await createClockSkewRetryFetch(base as unknown as typeof fetch, semEspera)('/rest/v1/x');

    expect(base).toHaveBeenCalledTimes(2);
    expect(r.status).toBe(200);
  });

  it('repete no máximo uma vez — a segunda recusa é a resposta', async () => {
    const base = jest.fn().mockResolvedValue(resposta(401, '{"message":"JWT issued at future"}'));
    const r = await createClockSkewRetryFetch(base as unknown as typeof fetch, semEspera)('/rest/v1/x');
    expect(base).toHaveBeenCalledTimes(2);
    expect(r.status).toBe(401);
  });

  /** ⛔ O caso que define a correção: um `401` comum passa direto, sem segunda tentativa. */
  it('NÃO repete um 401 de autorização negada', async () => {
    for (const body of [
      '{"message":"JWT expired"}',
      '{"message":"Invalid API key"}',
      '{"code":"42501","message":"permission denied for table checkins"}',
      '',
    ]) {
      const base = jest.fn().mockResolvedValue(resposta(401, body));
      const r = await createClockSkewRetryFetch(base as unknown as typeof fetch, semEspera)('/rest/v1/x');
      expect(base).toHaveBeenCalledTimes(1);
      expect(r.status).toBe(401);
    }
  });

  it('não repete respostas que não são 401', async () => {
    for (const status of [200, 400, 403, 409, 500]) {
      const base = jest.fn().mockResolvedValue(resposta(status, 'JWT issued at future'));
      await createClockSkewRetryFetch(base as unknown as typeof fetch, semEspera)('/rest/v1/x');
      expect(base).toHaveBeenCalledTimes(1);
    }
  });

  /**
   * ⚠️ Um corpo em stream já foi consumido pela primeira tentativa; repeti-lo mandaria uma
   * requisição vazia, que é pior que a recusa que ela tenta consertar.
   */
  it('não repete quando o corpo da requisição não pode ser reenviado', async () => {
    const base = jest.fn().mockResolvedValue(resposta(401, 'JWT issued at future'));
    const corpo = new Blob(['x']) as unknown as BodyInit;
    await createClockSkewRetryFetch(base as unknown as typeof fetch, semEspera)('/rest/v1/x', {
      method: 'POST',
      body: corpo,
    });
    expect(base).toHaveBeenCalledTimes(1);
  });

  /** Escrita com corpo de texto **pode** repetir: um 401 é recusa antes de o servidor fazer nada. */
  it('repete uma escrita de corpo textual, porque o 401 não produziu efeito nenhum', async () => {
    const base = jest
      .fn()
      .mockResolvedValueOnce(resposta(401, 'JWT issued at future'))
      .mockResolvedValueOnce(resposta(201, '{}'));
    const r = await createClockSkewRetryFetch(base as unknown as typeof fetch, semEspera)('/rest/v1/x', {
      method: 'POST',
      body: '{"a":1}',
    });
    expect(base).toHaveBeenCalledTimes(2);
    expect(r.status).toBe(201);
  });

  /**
   * ⚠️ Se a resposta não puder ser clonada, o wrapper devolve a original em vez de lançar: um
   * `401` legível vale mais que uma falha sem nome vinda de dentro de um mecanismo de resiliência.
   */
  it('devolve a resposta original quando o corpo não pode ser inspecionado', async () => {
    const ruim = resposta(401, 'JWT issued at future');
    ruim.clone = () => {
      throw new TypeError('body already read');
    };
    const base = jest.fn().mockResolvedValue(ruim);
    const r = await createClockSkewRetryFetch(base as unknown as typeof fetch, semEspera)('/rest/v1/x');
    expect(base).toHaveBeenCalledTimes(1);
    expect(r.status).toBe(401);
  });

  /** A primeira resposta é clonada para inspeção: quem chamou ainda consegue ler o corpo dela. */
  it('não consome o corpo da resposta que devolve', async () => {
    const base = jest.fn().mockResolvedValue(resposta(401, '{"message":"JWT expired"}'));
    const r = await createClockSkewRetryFetch(base as unknown as typeof fetch, semEspera)('/rest/v1/x');
    await expect(r.text()).resolves.toContain('JWT expired');
  });
});

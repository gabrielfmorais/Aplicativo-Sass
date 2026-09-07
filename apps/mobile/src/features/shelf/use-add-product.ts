import type { CatalogProduct, Product, ProductCategory, ProductPort } from '@app/core';
import { ProductNameSchema } from '@app/core';
import { useState } from 'react';

import { reasonOf } from '@/shared/failure-detail';

/**
 * Cadastrar um produto, sem a tela em volta.
 *
 * Existe porque o cadastro passou a ter **dois** lugares: a prateleira (SPEC-023) e o Wash Day, de
 * onde ela adiciona o que acabou de usar — que é quando o cadastro custa menos (SPEC-024 FR6,
 * Blueprint §10). A normalização do nome e a tradução da duplicata são regra; duas cópias dela
 * divergiriam na primeira mudança, e a segunda cópia mostraria o código cru do Postgres.
 *
 * O layout **não** vem junto: as duas telas põem o botão em lugares diferentes, e um componente que
 * carregasse o botão obrigaria uma delas a mudar de forma para acomodar a outra.
 */
export function useAddProduct(products: ProductPort, onAdded: (product: Product) => void) {
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const parsed = ProductNameSchema.safeParse(draft);
  const name = parsed.success ? parsed.data : null;

  return {
    draft,
    category,
    busy,
    message,
    failure,
    /** Pronto para enviar: nome normalizado não vazio e categoria escolhida. */
    ready: name !== null && category !== null,
    setCategory,
    type(text: string) {
      setDraft(text);
      setMessage(null);
    },
    toggleCategory(value: ProductCategory) {
      setCategory((current) => (current === value ? null : value));
    },
    /**
     * SPEC-054 (F32) — ela escolheu um produto real na busca.
     *
     * ⚠️ **Adiciona direto, sem passar pelo formulário.** Fazer o produto encontrado apenas
     * *preencher* os campos custaria um toque a mais para confirmar o que ela acabou de escolher —
     * e o toque a mais é exatamente o que faz um cadastro não acontecer (a mesma razão pela qual o
     * Wash Day devolve o produto criado, SPEC-024 FR6).
     *
     * ⚠️ **O nome e a categoria vão para a linha DELA** (FR5/BR3): o catálogo preenche agora e não
     * manda depois. Corrigir ou apagar a linha do catálogo não muda o que ela vê.
     */
    fromCatalog(chosen: CatalogProduct) {
      if (busy) return;
      setBusy(true);
      setMessage(null);
      setFailure(null);
      products
        .add({ name: chosen.name, category: chosen.category, catalogProductId: chosen.id })
        .then((product) => {
          setDraft('');
          setCategory(null);
          onAdded(product);
        })
        .catch((error: unknown) => {
          setMessage(
            (error as { code?: string })?.code === 'hair_profile.product_duplicate'
              ? 'Você já tem esse produto na prateleira.'
              : 'Não foi possível adicionar agora. Tente novamente.',
          );
          setFailure(reasonOf(error));
        })
        .finally(() => setBusy(false));
    },
    submit() {
      if (busy || !name || !category) return;
      setBusy(true);
      setMessage(null);
      setFailure(null);
      products
        .add({ name, category })
        .then((product) => {
          setDraft('');
          setCategory(null);
          onAdded(product);
        })
        .catch((error: unknown) => {
          // Duplicata não é falha: é uma informação. Mostrar o erro cru faria ela achar que quebrou.
          setMessage(
            (error as { code?: string })?.code === 'hair_profile.product_duplicate'
              ? 'Você já tem esse produto na prateleira.'
              : 'Não foi possível adicionar agora. Tente novamente.',
          );
          setFailure(reasonOf(error));
        })
        .finally(() => setBusy(false));
    },
    clearMessage: () => setMessage(null),
  };
}

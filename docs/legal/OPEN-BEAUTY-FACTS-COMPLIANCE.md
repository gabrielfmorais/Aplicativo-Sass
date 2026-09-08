# Conformidade — Open Beauty Facts como fonte do catálogo

**Decisão:** ✅ **Sem bloqueio real. A ingestão prossegue autonomamente.**
**Data:** 2026-09-08. **Fonte lida:** documentação **oficial e atual** (não resumo antigo do projeto).

Este documento registra a pesquisa jurídica/técnica que autoriza popular o catálogo da Huna
(`catalog_products`, SPEC-054) com produtos reais de **Open Beauty Facts (OBF)**, e exatamente como a
Huna cumpre cada obrigação. Se algum termo bloqueasse o uso, a cláusula estaria citada aqui — não há.

## 1. Fontes oficiais consultadas

- Termos de uso e reutilização — `https://world.openfoodfacts.org/terms-of-use` (OBF usa a mesma
  infraestrutura e o mesmo enquadramento de licença que Open Food Facts).
- Página de dados/API/licença — `https://world.openbeautyfacts.org/data` e
  `https://world.openfoodfacts.org/data`.
- Documentação da API — `https://openfoodfacts.github.io/openfoodfacts-server/api/`.
- Licenças referenciadas: ODbL 1.0 (`https://opendatacommons.org/licenses/odbl/1.0/`), DbCL 1.0
  (`https://opendatacommons.org/licenses/dbcl/1.0/`), CC BY-SA 3.0
  (`https://creativecommons.org/licenses/by-sa/3.0/deed.en`).

## 2. As licenças, verbatim

| Camada | Licença | Cláusula oficial (resumo verbatim) |
|---|---|---|
| Banco (estrutura) | **ODbL 1.0** | *"The Open … Facts database is available under the Open Database License."* |
| Conteúdo individual | **DbCL 1.0** | *"The individual contents of the database are available under the Database Contents License."* |
| Imagens de produto | **CC BY-SA 3.0** | *"Products images are available under the Creative Commons Attribution ShareAlike licence."* (versão 3.0, link acima) |
| Uso comercial | **PERMITIDO** | os termos *"authorize the use and reproduction of the content for all purposes, **including commercial use**, under certain conditions."* |

## 3. As obrigações, e como a Huna cumpre — estruturalmente, não em comentário

| Obrigação (termo oficial) | Como a Huna cumpre |
|---|---|
| **Atribuição** — *"mention the licence and attribute the authorship to Open … Facts with a link … or the appropriate product page when the information … pertain[s] to a specific product."* | (a) Tela **"Sobre / Fontes de dados"** com a atribuição global (OBF + ODbL/DbCL + CC BY-SA 3.0, com links). (b) Cada produto do catálogo guarda `source_url` (a página do produto na OBF) e a atribuição aparece **no detalhe do produto**. |
| **Share-alike (ODbL)** — *"Derivative works must be shared under the same conditions."* | Os **fatos do catálogo** (`catalog_products` de origem OBF) ficam sob **ODbL**, rastreáveis à fonte aberta por `source` + `source_ref` (código/EAN) + `source_url`. Isso **não alcança o código da Huna nem os dados da usuária** — são bancos independentes (ODbL "Collective Database"): a prateleira dela (`products`), o perfil, o plano e a jornada não derivam da OBF. `data_license` grava `ODbL-1.0` por linha. |
| **Share-alike (CC BY-SA nas imagens)** | As imagens são exibidas **sem modificação**, usando as **URLs hospedadas pela própria OBF** — a Huna não re-hospeda nem cria obra derivada da imagem. Cada linha grava `image_license = 'CC-BY-SA-3.0'` e `image_credit`, e o direito aparece na atribuição. Como não há adaptação, o share-alike da imagem se satisfaz com atribuição + aviso de licença. |
| **Uso da API vs. exportação (regra operacional)** — *"API usage restricted to production cases where 1 API call = 1 real scan by a user. Database scraping via API will be blocked. Full daily exports available instead."* | A ingestão em massa usa a **exportação oficial** (`en.openbeautyfacts.org.products.csv.gz`), **nunca** varredura da API. A API fica reservada para a busca em runtime "1 chamada = 1 uso real". |
| **User-Agent** — *"AppName/Version (ContactEmail)"* | O script de ingestão envia `HunaCatalogIngest/<versão> (projetopaporeto.erp@gmail.com)`. |
| **"Nenhuma imagem sem direito rastreável"** (regra do dono) | `CHECK` no banco: imagem `open_licensed` **obriga** `image_license`, `image_credit` e `source_url`. Uma imagem sem direito e origem **não grava**. |

## 4. As perguntas de bloqueio — respondidas

O dono pediu para só transformar em HUMAN GATE se, **após ler os termos**, houvesse bloqueio real.
Nenhum se aplica:

- **Uso comercial proibido?** ❌ Não — é **explicitamente permitido**.
- **Contrato a aceitar / clique de aceite?** ❌ Não — ODbL/DbCL/CC-BY-SA são licenças públicas, sem
  assinatura. (Existe um pedido **opcional** de *notificar* reusos por e-mail — cortesia, não
  obrigação.)
- **Pagamento?** ❌ Não.
- **Cláusula incompatível com o modelo proprietário da Huna?** ❌ Não — o share-alike do ODbL alcança
  **os fatos do catálogo** (identidade pública de produto), não o app nem o dado da usuária. Manter
  esse subconjunto sob ODbL é compatível com a Huna ser proprietária.
- **Share-alike atingindo material que não podemos licenciar assim?** ❌ Não — só atinge fatos públicos
  de produto, que **já são** abertos na fonte.
- **Direito da imagem individual insuficiente/ambíguo?** ⚠️ A OBF adverte que fotos de embalagem *"may
  contain graphical elements subject to copyright"* (marca/trade dress na embalagem). Isso é inerente a
  **qualquer** foto de produto e **não bloqueia** o uso **nominativo/identificador** (mostrar a
  embalagem para dizer "que produto é este"), que é exatamente o uso da Huna. A foto em si está sob
  CC-BY-SA 3.0, exibida sem modificação e atribuída. Mitigação estrutural: só entra imagem com
  `image_license` + `image_credit` + `source_url`.

## 5. Conclusão

O uso pretendido — **identidade de produto** (marca, linha, nome, variante/tamanho, categoria, EAN,
foto), com origem e licença rastreáveis — é **permitido** pelas licenças oficiais da OBF, para uso
**comercial**, **sem contrato, pagamento ou aceite**. As obrigações (atribuição, aviso de licença,
share-alike dos fatos do catálogo, imagens não modificadas, User-Agent, exportação-não-scraping) são
cumpridas **no schema, no script e na UI** — não em prosa. **Não sobra HUMAN GATE de licença.**

⛔ **Fora desta autorização (segue atrás de D-26/D-70):** transformar identidade em **alegação** —
"bom para cabelo X", indicação, benefício, eficácia, ranking. O catálogo é identidade; recomendação é
`P18`.

// SPEC-057 (F32) — ingestão do catálogo real a partir de Open Beauty Facts (OBF).
//
// Conformidade em docs/legal/OPEN-BEAUTY-FACTS-COMPLIANCE.md: ODbL (dados) + CC BY-SA 3.0 (imagens),
// uso comercial permitido, atribuição + share-alike dos fatos do catálogo. **Exportação, nunca
// scraping da API** (regra oficial: "1 API call = 1 real scan; database scraping will be blocked").
//
// Node builtins apenas (sem dependência nova, como os check:remote-*). Dois modos:
//   --dry-run (padrão): baixa/lê a exportação, filtra/mapeia, grava catalog-rows.ndjson + estatísticas.
//   --apply: também aplica a migration e faz upsert no DEV via Supabase Management API
//            (env SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF). Roda no workflow, nunca no cliente.
//
// Uso:
//   node scripts/ingest-catalog.mjs --dry-run [--file <obf.csv.gz>] [--limit 2000] [--out rows.ndjson]
//   node scripts/ingest-catalog.mjs --apply   [--limit 2000]      (no CI, com os secrets)

import { createGunzip } from 'node:zlib';
import { createReadStream, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';

const CSV_URL = 'https://static.openbeautyfacts.org/data/en.openbeautyfacts.org.products.csv.gz';
const USER_AGENT = 'HunaCatalogIngest/0.1 (projetopaporeto.erp@gmail.com)';
const PRODUCT_BASE = 'https://world.openbeautyfacts.org/product/';
const DATA_LICENSE = 'ODbL-1.0';
const IMAGE_LICENSE = 'CC-BY-SA-3.0';
const IMAGE_CREDIT = 'Open Beauty Facts contributors (CC BY-SA 3.0)';
const MIGRATIONS = [
  'supabase/migrations/20260922000000_catalog_open_data.sql', // SPEC-057 — conformidade
  'supabase/migrations/20260923000000_catalog_search.sql', // SPEC-058 — busca (search_text + RPC)
];

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : fallback;
};
const has = (name) => process.argv.includes(name);
const LIMIT = Number(arg('--limit', '2000'));
const OUT = arg('--out', 'catalog-rows.ndjson');

/**
 * Nossa categoria (vocabulário fechado da SPEC-054), a partir das `categories_tags` **e do nome** —
 * a OBF tem muitos produtos BR com nome em português e tag vazia ou só em `pt:`. Cada regra olha o
 * texto combinado (tags + nome, minúsculo, sem acento).
 */
export const CATEGORY_RULES = [
  ['shampoo', (t) => /shampoo|xampu/.test(t) && !/condition|condicion/.test(t)],
  ['conditioner', (t) => /conditioner|condicionador/.test(t)],
  ['mask', (t) => /\bmask|mascara capilar|masque-capillaire|masque capillaire|mascaras-capilares/.test(t)],
  ['oil', (t) => /hair-oil|oleo capilar|\boleo\b|\bserum\b|serum capilar/.test(t)],
  [
    'leave_in',
    (t) => /leave-?in|leave-on|hair-cream|creme de pentear|creme para pentear|creme para cabelo/.test(t),
  ],
  [
    'styler',
    (t) =>
      /styling|-gel|\bgel\b|mousse|hair-?spray|pomade|pomada|wax|texturi|finish|modelador|finalizador|gelatina|ativador de cachos/.test(
        t,
      ),
  ],
];
export const categoryOf = (tags, name = '') => {
  const t = norm(tags + ' ' + name);
  for (const [cat, test] of CATEGORY_RULES) if (test(t)) return cat;
  return 'other';
};

/** minúsculo + sem acento, para casar "óleo"/"oleo", "máscara"/"mascara". */
export const norm = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Marcas relevantes no mercado BR (pesquisa multi-sinal: varejo, drogaria, best-sellers, setor —
 * `docs/product/BR-HAIR-MARKET.md`). **Sinal de RANKING, não de recomendação nem de exclusão:** só
 * decide a ordem quando o `--limit` corta, para o catálogo ser representativo do Brasil, não maior.
 */
export const BR_PRIORITY_BRANDS = [
  'elseve',
  "l'oreal",
  'loreal',
  'seda',
  'pantene',
  'dove',
  'tresemme',
  'siage',
  'eudora',
  'novex',
  'embelleze',
  'salon line',
  'skala',
  'natura',
  'boticario',
  'amend',
  'bio extratus',
  'clear',
  'wella',
  'kerastase',
  'redken',
  'truss',
  'brae',
  'cadiveu',
  'schwarzkopf',
  'inoar',
  'forever liss',
  'haskell',
  'lola',
  'felps',
  'joico',
  'alfaparf',
  'lowell',
  'keune',
];
export const isBrPriorityBrand = (brand) => {
  const b = norm(brand);
  return BR_PRIORITY_BRANDS.some((p) => b.includes(p));
};

/** Tag/nome que denuncia produto **não capilar** — evita puxar skincare/maquiagem por palavra ambígua. */
const NONHAIR =
  /en:face|face-care|skin-care|skincare|en:makeup|maquiagem|deodorant|desodorante|perfume|fragrance|eau-de|en:soaps|sabonete|toothpaste|dentifr|sunscreen|protetor-solar|en:lipstick|\bbatom\b|foundation|en:mascaras|cils|cilios|\bnail|\bunha|body-lotion|hand-cream|creme-de-barbear|shaving/;
/** Sinal FORTE de cabelo (tag ou nome), em EN e PT. */
const HAIR =
  /hair|cabelo|capila|capilla|shampoo|xampu|condicion|conditioner|modelador-capilar|leave-?in|matiza|anti-?caspa|antiqueda|ativador de cachos|reconstrutor|finalizador|to de cachos|de cachos|hidratacao capilar|umecta/;
/**
 * Um produto é de cabelo se tiver **sinal forte** de cabelo e **nenhum** sinal de não-cabelo. O nome
 * entra na decisão (não só a tag), porque é o que os produtos BR trazem — e a exclusão vem primeiro,
 * para "máscara"/"óleo"/"creme" ambíguos não virarem skincare.
 */
export const isHair = (tags, name = '') => {
  const t = norm(tags + ' ' + name);
  if (NONHAIR.test(t)) return false;
  return HAIR.test(t);
};

/** EAN válido: só dígitos, comprimento GTIN (8/12/13/14). OBF tem códigos internos que não são EAN. */
export const isValidEan = (code) => /^\d+$/.test(code) && [8, 12, 13, 14].includes(code.length);

/** Higieniza texto: troca controle (< 0x20 e DEL) por espaço, colapsa espaço, corta tamanho. Não
 * inventa nada — só limpa o que a fonte trouxe sujo. */
export const clean = (s, max = 200) => {
  let out = '';
  for (const ch of s ?? '') {
    const code = ch.charCodeAt(0);
    out += code < 32 || code === 127 ? ' ' : ch;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, max);
};

/** Escapa um literal de texto para SQL (standard-conforming: só a aspa simples dobra). Vazio vira NULL. */
export const sqlLit = (v) =>
  v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

async function* csvLines(filePath) {
  let input;
  if (filePath && existsSync(filePath)) {
    input = createReadStream(filePath);
  } else {
    const res = await fetch(CSV_URL, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`OBF export HTTP ${res.status}`);
    input = Readable.fromWeb(res.body);
  }
  const rl = createInterface({ input: input.pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

async function buildRows(filePath) {
  let header = null;
  const idx = {};
  const stats = { seen: 0, malformed: 0, notHair: 0, noEan: 0, noBrandName: 0 };
  const byEan = new Map();

  for await (const line of csvLines(filePath)) {
    if (!header) {
      header = line.split('\t');
      header.forEach((h, i) => (idx[h] = i));
      for (const c of [
        'code',
        'product_name',
        'brands',
        'categories_tags',
        'quantity',
        'countries_tags',
        'image_url',
      ])
        if (!(c in idx)) throw new Error(`coluna ausente na exportação: ${c}`);
      continue;
    }
    stats.seen++;
    const f = line.split('\t');
    // Linha malformada (tab/quebra embutida): descarta em vez de ingerir lixo.
    if (f.length !== header.length) {
      stats.malformed++;
      continue;
    }
    const tags = f[idx.categories_tags] || '';
    const nameRaw = f[idx.product_name] || '';
    if (!isHair(tags, nameRaw)) {
      stats.notHair++;
      continue;
    }
    const code = clean(f[idx.code], 20);
    if (!isValidEan(code)) {
      stats.noEan++;
      continue;
    }
    const brand = clean((f[idx.brands] || '').split(',')[0], 80);
    const name = clean(nameRaw, 160);
    if (!brand || !name) {
      stats.noBrandName++;
      continue;
    }
    const imageUrl = clean(f[idx.image_url], 500);
    const image = /^https?:\/\/images\.openbeautyfacts\.org\//.test(imageUrl) ? imageUrl : null;
    const brazil = (f[idx.countries_tags] || '').toLowerCase().includes('brazil');
    const row = {
      brand,
      line: null,
      name,
      variant: clean(f[idx.quantity], 60) || null,
      category: categoryOf(tags, name),
      ean: code,
      image_url: image,
      image_source: image ? 'open_beauty_facts' : null,
      image_rights: image ? 'open_licensed' : null,
      image_credit: image ? IMAGE_CREDIT : null,
      image_license: image ? IMAGE_LICENSE : null,
      source: 'open_beauty_facts',
      source_ref: code,
      source_url: `${PRODUCT_BASE}${code}`,
      data_license: DATA_LICENSE,
      _brazil: brazil,
      _brBrand: isBrPriorityBrand(brand),
    };
    // Dedup por EAN: fica a mais completa (com imagem > sem; nome mais longo desempata).
    const prev = byEan.get(code);
    const better =
      !prev ||
      (row.image_url && !prev.image_url) ||
      (!!row.image_url === !!prev.image_url && row.name.length > prev.name.length);
    if (better) byEan.set(code, row);
  }

  // Ranking: marca relevante no BR primeiro, depois tag de Brasil, depois com foto, depois nome mais
  // completo. Isso é REPRESENTATIVIDADE, não recomendação — só decide a ordem quando o `--limit` corta.
  const ranked = [...byEan.values()].sort(
    (a, b) =>
      Number(b._brBrand) - Number(a._brBrand) ||
      Number(b._brazil) - Number(a._brazil) ||
      Number(!!b.image_url) - Number(!!a.image_url) ||
      b.name.length - a.name.length,
  );
  const rows = ranked.slice(0, LIMIT).map((r) => {
    const out = { ...r };
    delete out._brazil; // interno ao ranking; não vai para o banco
    delete out._brBrand;
    return out;
  });
  return { rows, stats, totalMatched: byEan.size, brazilMatched: ranked.filter((r) => r._brazil).length };
}

function report(rows, extra) {
  const withPhoto = rows.filter((r) => r.image_url).length;
  const byCat = {};
  for (const r of rows) byCat[r.category] = (byCat[r.category] || 0) + 1;
  const brands = [...new Set(rows.map((r) => r.brand))];
  console.log('\n=== INGESTÃO — resumo ===');
  console.log('linhas do export vistas:', extra.stats.seen);
  console.log(
    'descartadas: malformadas',
    extra.stats.malformed,
    '· não-cabelo',
    extra.stats.notHair,
    '· sem EAN',
    extra.stats.noEan,
    '· sem marca/nome',
    extra.stats.noBrandName,
  );
  console.log(
    'produtos de cabelo únicos (por EAN) no filtro:',
    extra.totalMatched,
    '(Brasil:',
    extra.brazilMatched + ')',
  );
  console.log(
    'selecionados (limite ' + LIMIT + '):',
    rows.length,
    '· com foto:',
    withPhoto,
    '· todos com EAN: sim',
  );
  console.log('por categoria:', JSON.stringify(byCat));
  console.log('marcas distintas:', brands.length, '· amostra:', brands.slice(0, 30).join(' · '));
  const wella = rows.filter((r) => /wella/i.test(r.brand)).slice(0, 3);
  console.log(
    'exemplo Wella:',
    wella.length ? wella.map((r) => `${r.brand} — ${r.name}`).join(' | ') : '(nenhum nesta seleção)',
  );
}

const COLS = [
  'brand',
  'line',
  'name',
  'variant',
  'category',
  'ean',
  'image_url',
  'image_source',
  'image_rights',
  'image_credit',
  'image_license',
  'source',
  'source_ref',
  'source_url',
  'data_license',
];

// published_at, created_at, updated_at fecham cada tupla.
const valuesFor = (r) => '(' + COLS.map((c) => sqlLit(r[c])).join(', ') + ', now(), now(), now())';

export function upsertSql(batch) {
  const cols = COLS.join(', ') + ', published_at, created_at, updated_at';
  const updates = COLS.filter((c) => c !== 'ean')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  return (
    `insert into public.catalog_products (${cols})\nvalues\n` +
    batch.map(valuesFor).join(',\n') +
    `\non conflict (ean) where ean is not null do update set ${updates}, updated_at = now();`
  );
}

async function mgmtQuery(query) {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token)
    throw new Error('SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN ausentes (só o workflow os tem)');
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Management API HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function main() {
  const file = arg('--file', null);
  const { rows, stats, totalMatched, brazilMatched } = await buildRows(file);
  report(rows, { stats, totalMatched, brazilMatched });
  writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`\nrows escritas em ${OUT}`);

  if (has('--apply')) {
    console.log('\n=== --apply: migrations + upsert no DEV ===');
    // Todas as migrations do catálogo, idempotentes e em ordem: conformidade (SPEC-057) e busca
    // (SPEC-058). Aplicar as duas aqui mantém o schema do DEV em dia a cada enriquecimento.
    for (const m of MIGRATIONS) {
      console.log('aplicando migration', m);
      await mgmtQuery(readFileSync(m, 'utf8'));
    }
    let done = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      await mgmtQuery(upsertSql(batch));
      done += batch.length;
      console.log(`  upsert ${done}/${rows.length}`);
    }
    const res = await mgmtQuery(
      `select count(*)::int as n from public.catalog_products where source = 'open_beauty_facts'`,
    );
    console.log('catalog_products de OBF no DEV agora:', res?.[0]?.n ?? '?');
  }
}

const invokedDirectly =
  process.argv[1] && process.argv[1].replaceAll('\\', '/').split('/').pop() === 'ingest-catalog.mjs';
if (invokedDirectly)
  main().catch((e) => {
    console.error('FALHOU:', e.message);
    process.exit(1);
  });

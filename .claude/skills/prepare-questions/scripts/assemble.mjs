// Étape 3 — assemblage déterministe : jointure, variantes de nom, vérifications.
// Usage: node assemble.mjs <runDir>
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { CATEGORY_LABELS } from '../../../../shared/utils/categories.ts'

const DIR = process.argv[2]
if (!DIR) {
  console.error('Usage: node assemble.mjs <runDir>')
  process.exit(1)
}
const OUT = join(DIR, 'questions.json')
const REVIEW = join(DIR, 'to-review.json')
const manifest = JSON.parse(readFileSync(join(DIR, 'build', 'manifest.json'), 'utf8'))

const cards = JSON.parse(readFileSync(join(DIR, 'build', '01-parsed.json'), 'utf8'))
const byId = new Map(cards.map(c => [c.id, c]))

const BATCHES = Array.from({ length: manifest.batches }, (_, i) =>
  String(i + 1).padStart(manifest.width, '0'),
)

// ---------- 1. Lecture des sorties de lots ----------
const enriched = new Map() // id -> sortie LLM

for (const n of BATCHES) {
  const p = join(DIR, 'build', 'out', `batch-${n}.json`)
  if (!existsSync(p)) throw new Error(`Sortie manquante pour le lot ${n}`)
  for (const o of JSON.parse(readFileSync(p, 'utf8'))) {
    if (enriched.has(o.id)) throw new Error(`Item ${o.id} present dans deux lots`)
    enriched.set(o.id, o)
  }
}

const missing = cards.filter(c => !enriched.has(c.id))
if (missing.length) throw new Error(`${missing.length} cartes sans sortie LLM, ex. ${missing[0].id}`)
const orphans = [...enriched.keys()].filter(id => !byId.has(id))
if (orphans.length) throw new Error(`${orphans.length} ids inconnus en sortie LLM, ex. ${orphans[0]}`)

// ---------- 2. Variantes de nom, déterministes ----------
// `answer` = nom de famille seul. Sans ces formes, un joueur qui tape le nom
// complet est refusé par la tolérance Levenshtein <= 2.
const NAME_RE = /^(.+?)\s*\(([^)]+)\)\s*$/
function nameVariants(answerLabel, answer, existing) {
  const m = NAME_RE.exec(answerLabel)
  if (!m) return []
  const given = m[2].trim()
  // Écarte les parenthèses qui ne sont pas un prénom : dates, précisions, gloses.
  if (!given || /\d/.test(given) || given.split(/\s+/).length > 3) return []
  if (!/^[A-ZÀ-Ü]/.test(given)) return []
  // Le nom de famille est pris sur `answer`, déjà mis en casse normale par le
  // modèle : re-caser le label en majuscules donnerait "De scudery".
  const family = answer.trim()
  if (!family) return []
  if (family.toLowerCase().includes(given.toLowerCase())) return []
  const forms = [`${given} ${family}`, `${family} ${given}`]
  const seen = new Set([answer, ...existing].map(s => s.toLowerCase()))
  return forms.filter(f => {
    const k = f.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ---------- 3. Construction ----------
// L'ordre du corpus parsé est conservé tel quel. Il ne veut rien dire et n'a pas
// à vouloir dire quelque chose : c'est l'import qui répartit les questions sur
// les étages, au hasard. Voir specs/architecture.md#import-des-questions.
const rows = []
for (const c of cards) {
  const e = enriched.get(c.id)

  const variants = [...new Set((e.variants ?? []).map(v => String(v).trim()).filter(Boolean))]
  const extra = nameVariants(e.answerLabel, e.answer, variants)
  const allVariants = [...variants, ...extra].filter(v => v.toLowerCase() !== e.answer.toLowerCase())

  rows.push({
    id: c.id,
    statement: e.statement.trim(),
    answer: e.answer.trim(),
    answerLabel: e.answerLabel.trim(),
    variants: allVariants,
    categories: c.categories,
    why: e.why ?? '',
  })
}

// Mal formées : pas une question, ou une liste demandée. Elles sortent du deck
// et attendent une reprise à la main dans to-review.json.
const SET_ASIDE = /^\[(liste|pas-question)\]/
// Retirées à la main après relecture : ni dans le deck, ni à reprendre.
const DROPPED = /^\[supprime\]/
const dropped = rows.filter(r => DROPPED.test(r.why))
const setAside = rows.filter(r => SET_ASIDE.test(r.why))
const deck = rows.filter(r => !SET_ASIDE.test(r.why) && !DROPPED.test(r.why))
const flagged = deck.filter(r => /^\[flou\]/.test(r.why))

// ---------- 4. Vérifications ----------
const problems = []
const check = (cond, msg) => { if (!cond) problems.push(msg) }

check(rows.length === cards.length, `${rows.length} lignes au lieu de ${cards.length}`)
check(new Set(rows.map(r => r.id)).size === rows.length, 'ids dupliques')
const HTML = /<\/?[a-z][^>]*>|&[a-z]+;|&#\d+;/i
check(!rows.some(r => HTML.test(r.statement + r.answer + r.answerLabel + r.variants.join(''))), 'HTML residuel')
check(rows.every(r => r.categories.every(c => c in CATEGORY_LABELS)), 'categorie hors de shared/utils/categories.ts')
check(!rows.some(r => r.variants.some(v => v.toLowerCase() === r.answer.toLowerCase())), 'answer present dans variants')

// ---------- 5. Sortie ----------
const final = deck.map(({ why, ...keep }) => keep)
writeFileSync(OUT, JSON.stringify(final, null, 2) + '\n')
const review = setAside.map(({ why, ...keep }) => ({ ...keep, reason: why }))
writeFileSync(REVIEW, JSON.stringify(review, null, 2) + '\n')

// ---------- 6. Rapport ----------
const catCount = {}
for (const r of deck) for (const c of r.categories) catCount[c] = (catCount[c] ?? 0) + 1

console.log('=== CONTENU ===')
console.log(`  questions du deck        : ${deck.length}`)
console.log(`  mises a part [liste]     : ${setAside.filter(r => r.why.startsWith('[liste]')).length}`)
console.log(`  mises a part [pas-quest.]: ${setAside.filter(r => r.why.startsWith('[pas-question]')).length}`)
console.log(`  supprimees [supprime]    : ${dropped.length}`)
console.log(`  avec au moins 1 variante : ${deck.filter(r => r.variants.length).length}`)
console.log(`  variantes au total       : ${deck.reduce((a, r) => a + r.variants.length, 0)}`)
console.log(`  enonces modifies         : ${rows.filter(r => r.statement !== byId.get(r.id).statement).length}`)
console.log(`  marquees [flou]          : ${flagged.length}`)
console.log(`  categories               : ${Object.keys(catCount).length}`)

console.log('\n=== VERIFICATIONS ===')
if (problems.length === 0) console.log('  toutes passees')
else for (const p of problems) console.log(`  ECHEC : ${p}`)

writeFileSync(join(DIR, 'build', 'report.json'), JSON.stringify({ catCount, flagged: flagged.map(f => ({ id: f.id, statement: f.statement, why: f.why })), problems }, null, 2))
console.log(`\nEcrit : ${OUT}`)
console.log(`Ecrit : ${REVIEW}`)

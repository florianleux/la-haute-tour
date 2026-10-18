// Étape 2b — validation d'une sortie de lot. Pur, déterministe.
// Usage: node ingest.mjs <runDir> [NN]   (sans NN : tous les lots présents)
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = process.argv[2]
if (!DIR) {
  console.error('Usage: node ingest.mjs <runDir> [NN]')
  process.exit(1)
}

export function levenshtein(a, b) {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  const cur = new Array(n + 1)
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = [...cur]
  }
  return prev[n]
}

const norm = s => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
// Les guillemets ajoutés autour d'un titre sont une correction demandée, pas une
// réécriture : ils ne comptent pas dans la distance.
const unquoted = s => norm(s).replaceAll('"', '')

export function validateBatch(n) {
  const inPath = join(DIR, 'build', 'batches', `batch-${n}.json`)
  const outPath = join(DIR, 'build', 'out', `batch-${n}.json`)
  const errors = []
  const warnings = []

  if (!existsSync(outPath)) return { n, ok: false, errors: ['sortie absente'], warnings, items: [] }

  const input = JSON.parse(readFileSync(inPath, 'utf8'))
  let output
  try {
    output = JSON.parse(readFileSync(outPath, 'utf8'))
  } catch (e) {
    return { n, ok: false, errors: [`JSON invalide: ${e.message}`], warnings, items: [] }
  }

  if (!Array.isArray(output)) return { n, ok: false, errors: ['racine non tableau'], warnings, items: [] }

  const inIds = input.map(i => i.id)
  const outIds = output.map(o => o.id)
  const inSet = new Set(inIds)
  const outSet = new Set(outIds)

  if (outIds.length !== outSet.size) errors.push('ids dupliques en sortie')
  const missing = inIds.filter(id => !outSet.has(id))
  const unknown = outIds.filter(id => !inSet.has(id))
  if (missing.length) errors.push(`ids manquants (${missing.length}): ${missing.slice(0, 5).join(', ')}`)
  if (unknown.length) errors.push(`ids inconnus (${unknown.length}): ${unknown.slice(0, 5).join(', ')}`)

  const byInId = new Map(input.map(i => [i.id, i]))

  for (const o of output) {
    const src = byInId.get(o.id)
    if (!src) continue
    const where = `${o.id}`
    if (typeof o.statement !== 'string' || !o.statement.trim()) errors.push(`${where}: statement vide`)
    if (typeof o.answer !== 'string' || !o.answer.trim()) errors.push(`${where}: answer vide`)
    if (typeof o.answerLabel !== 'string' || !o.answerLabel.trim()) errors.push(`${where}: answerLabel vide`)
    if (!Array.isArray(o.variants)) errors.push(`${where}: variants non tableau`)

    if (typeof o.statement === 'string') {
      if (/<\/?[a-z][^>]*>|&[a-z]+;|&#\d+;/i.test(o.statement)) errors.push(`${where}: HTML dans statement`)
      // Garde-fou contre la reformulation : corriger une faute, pas réécrire.
      const d = levenshtein(unquoted(src.statement), unquoted(o.statement))
      const limit = Math.max(4, Math.ceil(src.statement.length * 0.15))
      if (d > limit) warnings.push(`${where}: enonce trop reecrit (distance ${d} > ${limit})`)
    }
    if (Array.isArray(o.variants)) {
      const lc = o.variants.map(v => norm(String(v)))
      if (new Set(lc).size !== lc.length) errors.push(`${where}: variantes en double`)
      if (lc.includes(norm(o.answer ?? ''))) errors.push(`${where}: answer present dans variants`)
    }
  }

  return { n, ok: errors.length === 0, errors, warnings, items: output }
}

const all = readdirSync(join(DIR, 'build', 'batches'))
  .filter(f => /^batch-\d+\.json$/.test(f))
  .map(f => f.match(/batch-(\d+)\.json/)[1])
  .sort()
const arg = process.argv[3]
const nums = arg ? all.filter(n => Number(n) === Number(arg)) : all
if (arg && !nums.length) {
  console.error(`Lot ${arg} inconnu. Lots existants : ${all.join(' ')}`)
  process.exit(1)
}

let bad = 0
for (const n of nums) {
  const r = validateBatch(n)
  const status = r.ok ? 'OK ' : 'KO '
  if (!r.ok) bad++
  console.log(`${status} lot ${n} : ${r.items.length} items` + (r.warnings.length ? `, ${r.warnings.length} alertes` : ''))
  for (const e of r.errors) console.log(`      erreur : ${e}`)
  for (const w of r.warnings) console.log(`      alerte : ${w}`)
}
console.log(`\n${nums.length - bad}/${nums.length} lots valides`)
process.exit(bad ? 1 : 0)

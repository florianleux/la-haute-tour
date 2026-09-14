// Étape 2a — découpage en lots. Déterministe (seed fixe).
// Usage: node batch.mjs <runDir>
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const DIR = process.argv[2]
if (!DIR) {
  console.error('Usage: node batch.mjs <runDir>')
  process.exit(1)
}
const cfg = JSON.parse(readFileSync(join(DIR, 'run.config.json'), 'utf8'))
const cards = JSON.parse(readFileSync(join(DIR, 'build', '01-parsed.json'), 'utf8'))

// Mulberry32 : PRNG déterministe, pour que le découpage soit rejouable.
function rng(seed) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Mélange avant découpage : le fichier Anki est ordonné par thème, et un lot
// entier de questions d'Histoire installe le modèle dans un domaine — il y
// corrige et invente des variantes avec un a priori qu'un lot mêlé ne lui donne
// pas. L'ordre des lots n'a plus d'autre enjeu depuis que rien n'est noté.
const rand = rng(cfg.seed)
const shuffled = [...cards]
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1))
  ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
}

const N_BATCHES = Math.max(1, Math.ceil(cards.length / cfg.batchSize))
const batches = Array.from({ length: N_BATCHES }, () => [])
shuffled.forEach((c, i) => batches[i % N_BATCHES].push(c))

rmSync(join(DIR, 'build', 'batches'), { recursive: true, force: true })
mkdirSync(join(DIR, 'build', 'batches'), { recursive: true })

const slim = c => ({ id: c.id, statement: c.statement, answer: c.answerHead, tail: c.tail, categories: c.categories })

// Largeur fixe pour que l'ordre lexicographique des noms de fichiers suive
// l'ordre numérique des lots, y compris au delà de 99 lots.
const WIDTH = Math.max(2, String(N_BATCHES).length)
const pad = i => String(i).padStart(WIDTH, '0')

batches.forEach((batch, i) => {
  writeFileSync(
    join(DIR, 'build', 'batches', `batch-${pad(i + 1)}.json`),
    JSON.stringify(batch.map(slim), null, 2),
  )
})

const manifest = {
  total: cards.length,
  batches: N_BATCHES,
  batchSize: cfg.batchSize,
  width: WIDTH,
  seed: cfg.seed,
}
writeFileSync(join(DIR, 'build', 'manifest.json'), JSON.stringify(manifest, null, 2))

const sizes = batches.map(b => b.length)
console.log(`cartes totales   : ${cards.length}`)
console.log(`lots             : ${N_BATCHES}`)
console.log(`items / lot      : ${Math.min(...sizes)}-${Math.max(...sizes)}`)
console.log(`somme lots       : ${sizes.reduce((a, b) => a + b, 0)}`)

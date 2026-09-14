// Liste les lots dont la sortie manque. C'est ce qui rend un run reprenable :
// une interruption ne coûte que les lots en cours, jamais ceux déjà écrits.
// Usage: node status.mjs <runDir>
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIR = process.argv[2]
if (!DIR) {
  console.error('Usage: node status.mjs <runDir>')
  process.exit(1)
}

const batchDir = join(DIR, 'build', 'batches')
const outDir = join(DIR, 'build', 'out')
if (!existsSync(batchDir)) {
  console.error(`Aucun lot dans ${batchDir}. Lancer batch.mjs d'abord.`)
  process.exit(1)
}

const expected = readdirSync(batchDir)
  .filter(f => /^batch-\d+\.json$/.test(f))
  .sort()
const done = new Set(existsSync(outDir) ? readdirSync(outDir).filter(f => /^batch-\d+\.json$/.test(f)) : [])
const missing = expected.filter(f => !done.has(f))

console.log(`lots attendus : ${expected.length}`)
console.log(`lots ecrits   : ${done.size}`)
console.log(`lots manquants: ${missing.length}`)
if (missing.length) {
  console.log(`\nmanquants :\n${missing.map(f => f.match(/batch-(\d+)/)[1]).join(' ')}`)
  console.log(`\nchemins :\n${missing.map(f => join(batchDir, f)).join('\n')}`)
} else {
  console.log('\ncomplet')
}
process.exit(missing.length ? 1 : 0)

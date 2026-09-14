// Pose le prompt d'enrichissement dans le répertoire de run, à partir du template.
// Usage: node make-prompt.mjs <runDir>
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = process.argv[2]
if (!DIR) {
  console.error('Usage: node make-prompt.mjs <runDir>')
  process.exit(1)
}

// `fileURLToPath` plutôt que `new URL(...).pathname` : ce dernier rend un chemin
// encodé, qui casse dès qu'un répertoire du chemin contient un espace.
const here = dirname(fileURLToPath(import.meta.url))
const prompt = readFileSync(join(here, '..', 'templates', 'enrich.md'), 'utf8')

// Le template n'a plus de trou à remplir depuis que la notation a disparu. La
// vérification reste : elle attrape un placeholder réintroduit sans son remplissage.
const left = prompt.match(/\{\{[A-Z_]+\}\}/g)
if (left) throw new Error(`Placeholders non remplaces: ${[...new Set(left)].join(', ')}`)

const out = join(DIR, 'prompt.md')
writeFileSync(out, prompt)
console.log(`prompt ecrit : ${out}`)
console.log(`  ${prompt.length} caracteres`)

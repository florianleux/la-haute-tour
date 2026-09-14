// Initialise un répertoire de run : copie la source, pose la config par défaut.
// Usage: node init.mjs <source.txt> <runDir>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const [source, runDir] = process.argv.slice(2)
if (!source || !runDir) {
  console.error('Usage: node init.mjs <source.txt> <runDir>')
  process.exit(1)
}

mkdirSync(join(runDir, 'build', 'batches'), { recursive: true })
mkdirSync(join(runDir, 'build', 'out'), { recursive: true })

const dest = join(runDir, 'source.txt')
if (existsSync(dest)) {
  console.log(`source.txt existe déjà, conservée (${readFileSync(dest, 'utf8').split('\n').length} lignes)`)
} else {
  writeFileSync(dest, readFileSync(source, 'utf8'))
  console.log(`source copiée : ${source} -> ${dest}`)
}

const cfgPath = join(runDir, 'run.config.json')
if (existsSync(cfgPath)) {
  console.log('run.config.json existe déjà, conservée')
} else {
  const cfg = {
    batchSize: 50,
    seed: 20260903,
  }
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n')
  console.log('run.config.json créée avec les valeurs par défaut')
}

console.log(`\nrun prêt : ${runDir}`)

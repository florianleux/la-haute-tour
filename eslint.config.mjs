// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  // `.claude/` porte l'outillage de l'assistant — skills, commandes, scripts de
  // préparation — jamais du code d'application : rien n'y suit les conventions
  // que ce lint fait respecter. Un worktree git posé dessous est en plus une
  // copie complète du dépôt, `node_modules` compris, qu'on ne veut surtout pas
  // parcourir. Le serveur de dev l'ignore déjà pour la même raison, voir
  // `nuxt.config.ts`.
  ignores: ['.claude/**'],
})

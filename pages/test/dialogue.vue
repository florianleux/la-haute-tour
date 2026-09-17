<template>
  <DialogueScene
    :key="run"
    :dialogue="dialogue"
    @end="run += 1"
  />
</template>

<script setup lang="ts">
// Banc de design du dialogue : même composant qu'en jeu (DialogueScene), avec
// un dialogue écrit ici plutôt qu'une vraie scène — pour régler le cadrage, la
// boîte et la vitesse du défilé sans dépendre de quoi que ce soit. Modifier
// DialogueScene modifie donc aussi bien cette page que ses futurs usages. Admin
// seulement. Voir pages/test/play.vue pour le même principe.
//
// La dernière réplique passée relance le dialogue sur une scène neuve : `:key`
// la remonte, qui est la seule façon de rejouer un dialogue (voir useDialogue).
import type { Dialogue, Speaker } from '~~/utils/dialogue'

definePageMeta({ admin: true })

/**
 * Des silhouettes, pas des personnages : le jeu n'a pas encore ses portraits, et
 * un banc de design n'est pas l'endroit où en inventer. Elles montrent le
 * cadrage — mi-corps, ancré au bas de la scène, rogné par elle — et rien d'autre.
 */
function silhouette(ink: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 600">`
    + `<g fill="${ink}"><circle cx="150" cy="140" r="86"/>`
    + `<path d="M150 250c92 0 141 74 150 350H0c9-276 58-350 150-350z"/></g></svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const GANDALF: Speaker = {
  name: 'Gandalf',
  portrait: silhouette('#e2e8f0'),
  side: 'left',
}

const EOWYN: Speaker = {
  name: 'Éowyn',
  portrait: silhouette('#c4b5fd'),
  side: 'right',
}

// Du texte de remplissage, choisi pour ce qu'il met à l'épreuve : une réplique
// courte, une qui remplit les trois lignes réservées, une ponctuation double
// (l'espace insécable), et l'alternance des deux côtés.
const dialogue: Dialogue = {
  background: '/images/play-bg.webp',
  lines: [
    { speaker: GANDALF, text: 'Te voilà enfin.' },
    { speaker: EOWYN, text: 'Tu m\'attendais ?' },
    {
      speaker: GANDALF,
      text: 'Depuis que la tour s\'est refermée, personne n\'a franchi cette porte '
        + 'sans y laisser quelque chose. Je voulais voir ce que tu y laisserais, toi.',
    },
    { speaker: EOWYN, text: '. . . . . . . .' },
  ],
}

const run = ref(0)
</script>

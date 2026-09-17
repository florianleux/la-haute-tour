<template>
  <DialogueScene
    :key="run"
    :dialogue="dialogue"
    @end="run += 1"
  />
</template>

<script setup lang="ts">
// Banc de design du dialogue : même composant qu'en jeu (DialogueScene), avec
// des dialogues écrits ici plutôt qu'une vraie scène — pour régler le cadrage,
// la boîte et la vitesse du défilé sans dépendre de quoi que ce soit. Modifier
// DialogueScene modifie donc aussi bien cette page que ses futurs usages. Admin
// seulement. Voir pages/test/play.vue pour le même principe.
//
// Les deux formes de dialogue s'enchaînent : la dernière réplique de l'une
// ouvre l'autre, sur une scène neuve (`:key` la remonte, seule façon de rejouer
// un dialogue — voir useDialogue). Sans ça, l'interlocuteur seul au milieu ne
// serait réglable nulle part, ce qui est précisément le travail d'un banc.
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

const GANDALF: Speaker = { name: 'Gandalf', portrait: silhouette('#e2e8f0') }
const EOWYN: Speaker = { name: 'Éowyn', portrait: silhouette('#c4b5fd') }

const BACKGROUND = '/images/play-bg.webp'

// Du texte de remplissage, choisi pour ce qu'il met à l'épreuve : une réplique
// courte, une qui remplit les trois lignes réservées, une ponctuation double
// (l'espace insécable), et l'alternance des deux places.
const A_DEUX: Dialogue = {
  background: BACKGROUND,
  left: GANDALF,
  right: EOWYN,
  lines: [
    { place: 'left', text: 'Te voilà enfin.' },
    { place: 'right', text: 'Tu m\'attendais ?' },
    {
      place: 'left',
      text: 'Depuis que la tour s\'est refermée, personne n\'a franchi cette porte '
        + 'sans y laisser quelque chose. Je voulais voir ce que tu y laisserais, toi.',
    },
    { place: 'right', text: '. . . . . . . .' },
  ],
}

// Seul en scène, et deux fois plus lent : le banc montre du même coup la place
// du milieu et ce que `revealMs` change au débit.
const SEUL_EN_SCENE: Dialogue = {
  background: BACKGROUND,
  center: GANDALF,
  revealMs: 60,
  lines: [
    { place: 'center', text: 'Personne d\'autre ne viendra.' },
    { place: 'center', text: 'La porte se referme derrière toi, et je suis le seul à savoir ce qu\'il y a au-dessus.' },
  ],
}

const SCENES = [A_DEUX, SEUL_EN_SCENE]

const run = ref(0)
const dialogue = computed(() => SCENES[run.value % SCENES.length])
</script>

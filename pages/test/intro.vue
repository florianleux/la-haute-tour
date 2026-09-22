<template>
  <DialogueScene
    :dialogue="dialogue"
    @answer="name = $event"
    @end="greeted = true"
  />
</template>

<script setup lang="ts">
// Brouillon de l'introduction de l'aventure : la scène que le joueur verra au
// tout début, jouée ici et nulle part ailleurs tant que son texte n'est pas
// écrit. Rien ne la déclenche dans le jeu — c'est une page de réglage, admin
// seulement, comme pages/test/dialogue.vue.
//
// L'Inconnu salue, puis demande son nom au joueur : d'où les deux dialogues
// enchaînés. L'affiche d'un dialogue est déclarée une fois pour toutes (voir
// ADR 0010), si bien qu'un joueur qui passe de « ??? » à son nom change de
// dialogue — la scène reprend alors au début, ce qui est exactement ce qu'on
// veut ici.
//
// Ce que le joueur écrit ne part nulle part : aucun compte, aucune API. Le
// nommer pour de bon est un autre travail.
import type { Dialogue, Speaker } from '~~/utils/dialogue'

definePageMeta({ admin: true })

// Le décor flou de l'attente en attendant le sien, cf. components/PlayFrame.vue.
const BACKGROUND = '/images/blurry-cooldown-bg.webp'

const UNKNOWN: Speaker = { name: 'L\'Inconnu', portrait: '/images/intro-unknown.webp' }
const PORTRAIT = '/images/intro-player.webp'

/**
 * La rencontre : il salue, jauge, puis demande le nom. Condescendant — il aide
 * parce qu'il croit l'aventurier perdu d'avance (voir specs/lore.md).
 */
const GREETING: Dialogue = {
  background: BACKGROUND,
  left: { name: '???', portrait: PORTRAIT },
  right: UNKNOWN,
  lines: [
    { place: 'right', text: 'Tiens. Encore un.' },
    {
      place: 'right',
      text: 'Salut à toi, aventurier. Tu viens pour la Tour, comme les autres. '
        + 'Ils venaient tous pour la Tour.',
    },
    {
      place: 'right',
      text: 'Donne-moi ton nom. Qu\'on sache au moins quoi raconter après.',
      prompt: { label: 'Votre nom', minLength: 1, maxLength: 15 },
    },
  ],
}

/** Ce qui se dit une fois le joueur nommé. Bouche-trou, à écrire. */
function conversation(name: string): Dialogue {
  return {
    background: BACKGROUND,
    left: { name, portrait: PORTRAIT },
    right: UNKNOWN,
    lines: [
      { place: 'right', text: `${name}. Soit.` },
      { place: 'left', text: 'Et toi, qui es-tu ?' },
      {
        place: 'right',
        text: 'Personne d\'important. Ce qui compte est au-dessus de nous : six étages, '
          + 'et rien qui redescende. Tu monteras, ou tu attendras.',
      },
      { place: 'left', text: 'Et si je tombe ?' },
      { place: 'right', text: 'Alors tu attendras. Puis tu remonteras.' },
    ],
  }
}

const name = ref('')
const greeted = ref(false)

// Servir un autre dialogue à la scène la reprend à sa première réplique (voir
// useDialogue) : c'est ce qui enchaîne la rencontre et la suite, sans `:key`.
const dialogue = computed<Dialogue>(() => (greeted.value ? conversation(name.value) : GREETING))
</script>

<template>
  <DialogueScene
    :dialogue="dialogue"
    @answer="name = $event"
    @choose="choose"
    @end="greeted = true"
  />
</template>

<script setup lang="ts">
// Brouillon de l'introduction de l'aventure : la scène que le joueur verra au
// tout début, jouée ici et nulle part ailleurs tant que son texte n'est pas
// écrit. Rien ne la déclenche dans le jeu — c'est une page de réglage, admin
// seulement, comme pages/test/dialogue.vue.
//
// L'Inconnu salue, demande son nom au joueur, puis ce qu'il est : d'où les
// trois dialogues enchaînés. L'affiche d'un dialogue est déclarée une fois pour
// toutes (voir ADR 0010), si bien qu'un joueur qui passe de « ??? » à son nom
// change de dialogue — la scène reprend alors au début, ce qui est exactement ce
// qu'on veut ici. La réponse du joueur, elle, ouvre le troisième : c'est lui qui
// la dit, et un dialogue ne connaît pas d'avance ce qu'on y choisira.
//
// Le nom ne part nulle part : aucun compte, aucune API — le nommer pour de bon
// est l'issue #53. Le genre, lui, est gardé sur le compte du joueur servi.
import type { Dialogue, Speaker } from '~~/utils/dialogue'
import type { Gender } from '~~/shared/utils/genders'

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

/** Ce que le joueur peut répondre à L'Inconnu, dans l'ordre où il le voit. */
const REPLIES = ['Un aventurier', 'Une aventurière', 'C\'est pas tes oignons'] as const

type Reply = typeof REPLIES[number]

/** Le genre que dit chaque réponse. */
const GENDER_OF: Record<Reply, Gender> = {
  'Un aventurier': 'MALE',
  'Une aventurière': 'FEMALE',
  'C\'est pas tes oignons': 'NEUTRAL',
}

/**
 * Le joueur nommé, L'Inconnu revient sur son « aventurier » de la rencontre et
 * demande ce qu'il est.
 */
function question(name: string): Dialogue {
  return {
    background: BACKGROUND,
    left: { name, portrait: PORTRAIT },
    right: UNKNOWN,
    lines: [
      { place: 'right', text: `${name}. Soit.` },
      {
        place: 'right',
        text: 'J\'ai dit aventurier. J\'ai peut-être parlé trop vite. T\'es quoi, au juste ?',
        choices: REPLIES,
      },
    ],
  }
}

/** Ce qui se dit une fois le joueur nommé. Bouche-trou, à écrire. */
function conversation(name: string, reply: Reply): Dialogue {
  return {
    background: BACKGROUND,
    left: { name, portrait: PORTRAIT },
    right: UNKNOWN,
    lines: [
      { place: 'left', text: reply },
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
/** Ce que le joueur a répondu à L'Inconnu. Null tant qu'il n'a rien cliqué. */
const reply = ref<Reply | null>(null)

// Servir un autre dialogue à la scène la reprend à sa première réplique (voir
// useDialogue) : c'est ce qui enchaîne les trois, sans `:key`. Le clic sur une
// réponse suffit à passer à la conversation — la fin de la question qui le suit
// n'a plus rien à changer.
const dialogue = computed<Dialogue>(() => {
  if (!greeted.value) {
    return GREETING
  }

  return reply.value === null ? question(name.value) : conversation(name.value, reply.value)
})

async function choose(rank: number): Promise<void> {
  const chosen = REPLIES[rank]

  reply.value = chosen
  // Le dialogue n'attend pas l'écriture : la réponse est dite tout de suite, et
  // un échec n'a rien à changer à ce qui se joue ici — il se lit en console.
  await $fetch('/api/profile/gender', { method: 'PUT', body: { gender: GENDER_OF[chosen] } })
}
</script>

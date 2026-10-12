<template>
  <CooldownCard
    :state="state"
    :screen="view.screen"
    :action="view.action"
    cooldown-remaining="4m 12s"
    :loading="false"
    :is-admin="true"
    :skipping="false"
    :advancing="false"
    :team="team"
    @skip-cooldown="() => {}"
    @advance="() => {}"
  />
</template>

<script setup lang="ts">
// Banc de design de l'écran d'attente : même composant qu'en jeu
// (CooldownCard), mais un état tiré au hasard à chaque chargement plutôt
// qu'une vraie partie — pour régler le visuel sans dépendre d'une attente
// réelle. Modifier CooldownCard modifie donc aussi bien cette page que la
// vraie. Admin seulement. Voir pages/test/play.vue pour le même principe.
import { playView } from '~~/utils/phase'
import { TEAM_IDS } from '~~/shared/utils/teams'

definePageMeta({ admin: true })

// Tirés une fois côté serveur et transmis au client par useState : tirés de
// chaque côté, ils divergeraient, et l'hydratation garderait l'image du client
// avec la position du serveur (la corde déroulée posée au sol).
const phase = useState('test-cooldown-phase', () => Math.random() < 0.5 ? 'cooldown' : 'recovery').value
// Sans équipe aussi : le cas « pas de bannière » doit se voir sur le banc.
const team = useState('test-cooldown-team', () => [...TEAM_IDS, null][Math.floor(Math.random() * (TEAM_IDS.length + 1))] ?? null).value

const state = ref(demoState({
  phase,
  lives: 0,
  started: true,
  // Le verdict de la dernière vie, une fois sur deux : resté dans l'état, il
  // ne doit pas détourner du poster.
  verdict: Math.random() < 0.5
    ? null
    : {
        questionId: 'test-verdict',
        statement: 'Quel est le point culminant d\'Afrique ?',
        correct: false,
        answerLabel: 'Le Kilimandjaro',
        submittedAnswer: 'Le Mont Blanc',
        lifeLost: true,
      },
  cooldownUntil: new Date(Date.now() + 252_000).toISOString(),
  floorSeen: 544,
  floorTotal: 1000,
  attemptSeen: 995,
  effects: Array.from({ length: Math.floor(Math.random() * 4) }, () => randomEffect('pending')),
}))

provideGameState(state)

const view = computed(() => playView(state.value))
</script>

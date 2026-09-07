<template>
  <BaseCard
    wide
    :title="state.phase === 'cooldown' ? 'Attente' : 'Rattrapage'"
  >
    <template #lead>
      <template v-if="state.phase === 'cooldown'">
        Tu as perdu ta dernière vie. Reprise dans {{ waitRemaining }}.
      </template>
      <template v-else>
        Ton attente est terminée. Tu peux lancer ton rattrapage.
      </template>
    </template>

    <BaseHint
      v-if="state.recoveryResult === 'failed'"
      class="mt-3"
      tone="warning"
    >
      Rattrapage raté : aucune bonne réponse. Une nouvelle attente commence.
    </BaseHint>

    <!-- Une attente écourtée reste une attente : à son échéance, c'est le
         rattrapage qui s'ouvre, pas l'ascension. Le dire ici évite au joueur de
         croire qu'il reprend. Voir specs/bonus.md#catalogue. -->
    <BaseHint
      v-if="screen.shortenedWait"
      class="mt-3"
      tone="success"
    >
      Un Répit a raccourci ton attente. Elle mène au rattrapage comme une attente
      pleine — plus tôt, c'est tout.
    </BaseHint>

    <BaseLoading
      v-if="loading"
      class="mt-4"
    >
      Mise à jour de ta partie…
    </BaseLoading>

    <BaseButton
      v-if="isAdmin && state.phase === 'cooldown'"
      variant="ghost"
      class="mt-4"
      :loading="skipping"
      @click="$emit('skipCooldown')"
    >
      Passer l'attente
    </BaseButton>

    <!-- Un Mimic fait basculer en attente au moment même où le joueur l'ouvre :
         son résultat se lit donc ici, pas sur l'écran de verdict qu'il vient de
         quitter. Seulement pendant l'attente qu'il a ouverte : le rattrapage qui
         suit n'a plus à la rappeler. Voir specs/bonus.md#coffre-et-mimic. -->
    <ChestResult
      v-if="state.phase === 'cooldown' && screen.chest?.opened"
      :chest="screen.chest"
      class="mt-6"
    />

    <!-- Ce qui est posé sur le joueur : la plupart des sorts attendent sa
         prochaine tentative, le Répit a déjà agi sur l'attente qu'il lit.
         Voir specs/bonus.md#ancrage-et-durée-de-vie. -->
    <BaseSection
      v-if="screen.pendingEffects.length"
      title="Ce qui est sur toi"
      class="mt-8"
    >
      <template #lead>
        Ces sorts s'appliquent à ta prochaine tentative et disparaîtront avec elle —
        sauf le Répit, qui agit sur l'attente en cours.
      </template>
      <EffectList
        :effects="screen.pendingEffects"
        class="mt-3"
      />
    </BaseSection>


    <BaseButton
      v-if="state.phase === 'recovery'"
      block
      class="mt-8"
      :loading="advancing"
      @click="$emit('advance')"
    >
      Commencer le rattrapage
    </BaseButton>

    <div class="mt-8">
      <MissedPoolList />
    </div>

  </BaseCard>
</template>

<script setup lang="ts">
// L'écran d'attente — cooldown comme rattrapage prêt à démarrer. Partagé entre
// la vraie partie (pages/index.vue) et son banc de design (pages/test/wait.vue) :
// modifier l'un modifie l'autre, comme QuestionCard pour l'ascension.
// Voir specs/ecrans.md#cooldown--attente.
import type { GameState } from '~~/server/utils/game'
import type { GameScreen } from '~~/utils/phase'

defineProps<{
  state: GameState
  screen: GameScreen
  waitRemaining: string
  loading: boolean
  isAdmin: boolean
  skipping: boolean
  advancing: boolean
}>()

defineEmits<{ skipCooldown: [], advance: [] }>()
</script>

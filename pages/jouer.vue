<script setup lang="ts">
// Une seule route de jeu : le serveur décide de la phase, la page affiche
// celle-là. Le joueur ne choisit jamais son écran. Voir specs/ecrans.md.
// Le temps, les envois et les relectures vivent dans useQuestionRun().
const {
  state,
  typed,
  secondsLeft,
  waitRemaining,
  submit,
  advance,
  pending,
  actionFailed,
  readFailed,
  loading,
} = await useQuestionRun()
</script>

<template>
  <BaseCard v-if="state?.phase === 'cooldown'" wide title="Attente">
    <template #lead>
      Tu as perdu ta dernière vie. Reprise dans
      {{ waitRemaining }}.
    </template>

    <p v-if="loading" class="mt-4 text-sm text-slate-500">
      <BaseSpinner>Mise à jour de ta partie…</BaseSpinner>
    </p>

    <div v-if="state.verdict" class="mt-6">
      <p class="text-sm text-slate-400">
        Dernière question ratée — réponse :
        <span class="font-semibold text-slate-100">{{ state.verdict.answerLabel }}</span>
      </p>
    </div>

    <div class="mt-8">
      <MissedPoolList />
    </div>

    <BaseButton to="/" variant="ghost" block class="mt-8">
      Retour à l'accueil
    </BaseButton>
  </BaseCard>

  <BaseCard v-else>
    <BaseNotice v-if="readFailed">
      Impossible de lire ta partie. Recharge la page.
    </BaseNotice>

    <template v-if="state">
      <div v-if="state.phase === 'ascent'" class="grid grid-cols-2 gap-3">
        <BaseStat label="Étage" :value="state.floor" />
        <BaseStat label="Vies" :value="state.lives" />
      </div>

      <p v-if="state.recovery" class="text-sm text-slate-400">
        Rattrapage — question {{ Math.min(state.recovery.played + 1, state.recovery.total) }}
        sur {{ state.recovery.total }},
        {{ state.recovery.successes }} juste(s).
      </p>

      <!-- Question en cours : aucune action à part répondre. -->
      <form v-if="state.question" class="mt-6" @submit.prevent="submit">
        <p class="text-lg font-semibold">
          {{ state.question.statement }}
        </p>
        <p class="mt-2 text-sm text-slate-400">
          {{ secondsLeft }} s
        </p>
        <BaseInput
          v-model="typed"
          label="Ta réponse"
          class="mt-4"
        />
        <BaseButton block class="mt-4" :loading="pending" @click="submit">
          Répondre
        </BaseButton>
      </form>

      <!-- Le verdict se lit dans toutes les phases : la question qui a coûté la
           dernière vie est celle dont la réponse reste à découvrir. -->
      <template v-else-if="state.verdict">
        <p
          class="mt-6 text-lg font-semibold"
          :class="state.verdict.correct ? 'text-emerald-400' : 'text-rose-400'"
        >
          {{ state.verdict.correct ? 'Juste !' : 'Faux.' }}
        </p>
        <p class="mt-2 text-sm text-slate-400">
          Réponse : <span class="font-semibold text-slate-100">{{ state.verdict.answerLabel }}</span>
        </p>
        <p class="mt-1 text-sm text-slate-400">
          Ta réponse : {{ state.verdict.submittedAnswer || '(rien)' }}
        </p>
        <p v-if="state.verdict.lifeLost" class="mt-1 text-sm text-rose-400">
          Tu perds une vie.
        </p>

        <!-- Le résultat du rattrapage s'annonce à la fin, pas question par question. -->
        <p
          v-if="state.recovery && state.recovery.played === state.recovery.total"
          class="mt-3 text-sm"
          :class="state.recovery.resumes ? 'text-emerald-400' : 'text-amber-400'"
        >
          {{ state.recovery.resumes
            ? 'Rattrapage réussi : tes vies sont restaurées.'
            : 'Aucune bonne réponse : une nouvelle attente commence.' }}
        </p>

        <BaseButton block class="mt-6" :loading="pending" @click="advance">
          {{ state.recovery && state.recovery.played === state.recovery.total
            ? 'Terminer le rattrapage'
            : 'Question suivante' }}
        </BaseButton>
      </template>

      <BaseButton
        v-else-if="state.phase === 'ascent' || state.phase === 'recovery'"
        block
        class="mt-6"
        :loading="pending"
        @click="advance"
      >
        {{ state.phase === 'recovery' ? 'Commencer le rattrapage' : mainActionLabel(state) }}
      </BaseButton>

      <!-- Palier et fin de partie ont leur propre ticket. -->
      <template v-else>
        <p class="mt-6 text-lg font-semibold">
          {{ phaseMessage(state.phase) }}
        </p>
        <BaseButton to="/" variant="ghost" block class="mt-6">
          Retour à l'accueil
        </BaseButton>
      </template>
    </template>

    <BaseNotice v-if="actionFailed">
      L'action a échoué. Réessaie.
    </BaseNotice>
  </BaseCard>
</template>

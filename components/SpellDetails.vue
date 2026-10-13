<template>
  <div>
    <div class="flex items-center" :class="large ? 'gap-4' : 'gap-3'">
      <SpellMedallion
        :spell="spell"
        :face="effect?.face ?? 'mixed'"
        class="shrink-0 [filter:drop-shadow(0_2px_3px_rgb(0_0_0/0.4))]"
        :class="large ? 'w-24' : 'w-[3.75rem]'"
        fallback-class="border-2 border-amber-900/40 text-xl text-amber-900"
      />

      <div class="min-w-0">
        <p class="font-bold" :class="large ? 'text-2xl' : 'text-base'">
          {{ spellLabel(spell) }}
        </p>
        <p
          v-if="effect"
          class="mt-1 flex flex-wrap gap-1 text-xs"
        >
          <span :class="[FACE_TAG_CLASS, FACE_TONES[effect.face]]">{{ spellFaceLabel(effect.face) }}</span>
          <span class="rounded border border-amber-900/30 bg-amber-900/5 px-1.5 py-px">
            Lancé par {{ effect.casterName }}
          </span>
        </p>
      </div>
    </div>

    <p
      v-if="effect"
      class="mt-3"
    >
      {{ spellEffects(spell)[effect.face] }}
    </p>
    <!-- Un sort en poche n'a pas encore de face : les deux se lisent, celle
         qu'il prendra dépend de la cible. Voir specs/bonus.md#catégories-de-cible. -->
    <dl
      v-else
      class="mt-3 space-y-2"
    >
      <div
        v-for="face in SPELL_FACES"
        :key="face"
      >
        <dt>
          <span :class="[FACE_TAG_CLASS, 'text-xs', FACE_TONES[face]]">{{ spellFaceLabel(face) }}</span>
        </dt>
        <dd class="mt-1">
          {{ spellEffects(spell)[face] }}
        </dd>
      </div>
    </dl>

    <!-- La valeur réelle, tous effets cumulés. -->
    <p
      v-if="stake"
      class="mt-2 border-t border-amber-900/20 pt-2"
    >
      {{ stake.label }} : <span class="text-amber-900/60">{{ stake.before }}</span> → <strong>{{ stake.after }}</strong>
    </p>

    <p
      v-if="effect && state"
      class="mt-2 italic text-amber-900/70"
    >
      {{ spellLifetime(effect, state) }}
    </p>
  </div>
</template>

<script setup lang="ts">
// Ce qu'un sort fait, dans l'encre du papier : son médaillon, son nom et sa
// définition. Un effet posé sur le joueur y ajoute sa face, son lanceur, la
// valeur qu'il change pour de vrai et jusqu'à quand ; un sort en poche montre
// ses deux faces, rien à chiffrer. Lu au survol (SpellTooltip) et sur la page
// droite du Grimoire — un seul dessin. Voir specs/bonus.md#linfobulle-dun-sort.
import { SPELL_FACES } from '~~/shared/utils/spells'
import type { EffectView } from '~~/server/utils/effects'
import type { SpellSubject } from '~~/utils/spells'

const props = defineProps<{
  subject: SpellSubject
  /** En tête de page (le Grimoire) plutôt que dans une infobulle : médaillon et nom plus grands. */
  large?: boolean
}>()

const spell = computed(() => splitSubject(props.subject).spell)
const effect = computed(() => splitSubject(props.subject).effect)

// Offert par la page : les vies et l'échéance de l'attente disent jusqu'à quand
// l'effet agit.
const state = useShownGameState()

// La même étiquette de face, que l'effet en porte une ou que le sort en poche
// montre les deux.
const FACE_TAG_CLASS = 'inline-block rounded border px-1.5 py-px font-medium'

const FACE_TONES: Record<EffectView['face'], string> = {
  boon: 'border-sky-500/50 bg-sky-100 text-sky-800',
  curse: 'border-violet-700/40 bg-violet-100 text-violet-900',
}

// Chiffrée par le serveur ; rien pour un effet qui n'agit pas encore.
const stake = computed(() => (effect.value?.stake ? spellStake(effect.value.stake) : null))
</script>

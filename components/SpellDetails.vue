<template>
  <div>
    <div class="flex items-center gap-3">
      <SpellMedallion
        :spell="spell"
        :face="effect?.face ?? 'mixed'"
        class="w-[3.75rem] shrink-0"
        shadow-class="shadow-[0_2px_3px_rgb(0_0_0/0.4)]"
        fallback-class="border-2 border-current/40 text-xl"
      />

      <div class="min-w-0">
        <p class="text-base font-bold">
          {{ spellLabel(spell) }}
        </p>
        <p
          v-if="effect"
          class="mt-1 flex flex-wrap gap-1 text-xs"
        >
          <SpellFaceTag :face="effect.face" />
          <span class="rounded border border-current/30 bg-current/5 px-1.5 py-px">
            Lancé par {{ effect.casterName }}
          </span>
        </p>
      </div>
    </div>

    <div>
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
            <SpellFaceTag :face="face" class="text-xs" />
          </dt>
          <dd class="mt-1">
            {{ spellEffects(spell)[face] }}
          </dd>
        </div>
      </dl>

      <!-- La valeur réelle, tous effets cumulés. -->
      <p
        v-if="stake"
        class="mt-2 border-t border-current/20 pt-2"
      >
        {{ stake.label }} : <span class="text-current/60">{{ stake.before }}</span> → <strong>{{ stake.after }}</strong>
      </p>

      <p
        v-if="effect && state"
        class="mt-2 italic text-current/70"
      >
        {{ spellLifetime(effect, state) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Ce qu'un sort fait, dans l'encre du papier : son médaillon, son nom et sa
// définition. Un effet posé sur le joueur y ajoute sa face, son lanceur, la
// valeur qu'il change pour de vrai et jusqu'à quand ; un sort en poche montre
// ses deux faces, rien à chiffrer. Lu au survol (SpellTooltip) ; la page droite
// du Grimoire a son propre dessin (SpellbookDetails). Voir
// specs/bonus.md#linfobulle-dun-sort.
import { SPELL_FACES } from '~~/shared/utils/spells'
import type { SpellSubject } from '~~/utils/spells'

const props = defineProps<{ subject: SpellSubject }>()

const spell = computed(() => splitSubject(props.subject).spell)
const effect = computed(() => splitSubject(props.subject).effect)

// Offert par la page : les vies et l'échéance de l'attente disent jusqu'à quand
// l'effet agit.
const state = useShownGameState()

// Chiffrée par le serveur ; rien pour un effet qui n'agit pas encore.
const stake = computed(() => (effect.value?.stake ? spellStake(effect.value.stake) : null))
</script>

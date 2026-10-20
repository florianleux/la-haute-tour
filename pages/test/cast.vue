<template>
  <div class="relative mx-auto mt-6 aspect-[1828/1080] w-[min(96vw,calc(90dvh*1828/1080))]">
    <img
      src="/images/spellbook.webp"
      alt=""
      class="pointer-events-none absolute inset-0 size-full select-none"
    >

    <SpellPage
      v-model="selected"
      :discovered="[...SPELL_IDS]"
      :counts="COUNTS"
    />

    <div class="absolute inset-0">
      <div class="absolute bottom-[9%] left-[54%] right-[11%] top-[16%] flex flex-col text-sm leading-snug text-amber-950">
        <template v-if="selected">
          <SpellbookDetails :key="selected" :spell="selected" :count="3" :cast="cast" />

          <div class="mt-3 flex flex-wrap gap-2">
            <BaseButton
              v-for="kind in TARGET_KINDS"
              :key="kind"
              variant="parchment"
              :disabled="cast !== null"
              @click="castOn(selected, kind, true)"
            >
              {{ targetKindLabel(kind) }}
            </BaseButton>
            <BaseButton
              variant="parchment"
              :disabled="cast !== null"
              @click="castOn(selected, 'self', false)"
            >
              Échec
            </BaseButton>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Banc de design du lancer de sort : même animation qu'au Grimoire
// (SpellbookDetails, SpellCastBurst, useSpellCast), mais une requête simulée
// plutôt qu'un vrai lancer — pour régler le mouvement sans être au camp ni
// dépenser d'exemplaire. « Échec » joue le sort qui n'est pas parti. Admin
// seulement. Voir pages/test/chest.vue pour le même principe. Le livre garde
// les proportions et positions de components/SpellbookOverlay.vue, sans le camp dessous.
import { faceFor, SPELL_IDS } from '~~/shared/utils/spells'
import { TARGET_KINDS } from '~~/shared/utils/teams'
import type { SpellId } from '~~/shared/utils/spells'
import type { TargetKind } from '~~/shared/utils/teams'

definePageMeta({ admin: true })

/** Trois exemplaires de chaque, pour les pastilles de la page des sorts. */
const COUNTS = Object.fromEntries(SPELL_IDS.map(spell => [spell, 3]))

const selected = ref<SpellId | null>('VITALITY')

const { cast, play } = useSpellCast()

/** La cible que le faux tirage donne à chaque catégorie. */
const TARGETS: Record<TargetKind, string> = { self: 'toi', ally: 'samsagace', foe: 'gollum' }

/** Une requête qui répond en 200 ms, le temps d'un vrai lancer. */
function castOn(spell: SpellId, kind: TargetKind, sent: boolean): void {
  const headline = sent ? castHeadline(kind, TARGETS[kind]) : null
  void play(spell, faceFor(kind), () => new Promise(resolve => setTimeout(() => resolve(headline), 200)))
}
</script>

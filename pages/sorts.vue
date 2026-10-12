<template>
  <BaseCard wide title="Tes sorts">
    <template #lead>
      Ce que tes coffres t'ont donné. Tu peux lancer {{ castsPerCooldown }} sorts
      par attente, quels qu'ils soient — deux fois le même si tu veux. La plupart
      attendent ta prochaine tentative ; le Répit, lui, raccourcit l'attente que
      tu es en train de vivre.
    </template>

    <!-- Le budget se lit avant le clic : un bouton qu'on presse en vain est une
         règle qu'on découvre trop tard. Voir specs/bonus.md#où-et-quand. -->
    <BaseHint class="mt-4" :tone="castsLeft ? 'neutral' : 'warning'">
      <template v-if="castsLeft">
        Il te reste {{ castsLeft }} lancer{{ castsLeft > 1 ? 's' : '' }} pour
        cette attente.
      </template>
      <template v-else>
        Tu as dépensé tes {{ castsPerCooldown }} lancers : la prochaine attente
        t'en rendra autant.
      </template>
    </BaseHint>

    <!-- Le seul retour instantané du système : l'échéance recule sous les yeux
         du joueur, sur l'écran d'où il vient de lancer.
         Voir specs/bonus.md#catalogue. -->
    <BaseHint v-if="cooldownRemaining" class="mt-4">
      Reprise dans {{ cooldownRemaining }}.
    </BaseHint>

    <BaseNotice v-if="failed">
      Impossible de lire ton inventaire. Recharge la page.
    </BaseNotice>

    <template v-else>
      <BaseSection :title="`Inventaire (${total})`" class="mt-8">
        <BaseList
          class="mt-4"
          :empty="entries.length ? null : 'Aucun sort pour l\'instant : les coffres des questions loot en donnent.'"
        >
          <li
            v-for="entry in entries"
            :key="entry.spell"
            class="px-4 py-3"
          >
            <div class="flex items-center justify-between gap-4">
              <span class="font-medium">
                {{ spellLabel(entry.spell) }}
                <!-- Les doublons se comptent plutôt qu'ils ne s'alignent : un
                     exemplaire ne se distingue d'un autre par rien. -->
                <span class="ml-1 text-sm font-normal text-slate-400">×{{ entry.count }}</span>
              </span>
              <!-- Un sort dont l'effet n'existe pas encore attend son tour dans
                   l'inventaire : le lancer coûterait un exemplaire pour rien. -->
              <BaseHint v-if="!isCastable(entry.spell)">
                Bientôt lançable
              </BaseHint>
              <!-- Une catégorie par bouton, jamais une personne : le joueur ne
                   choisit pas qui il touche, seulement de quel côté il frappe.
                   Voir specs/bonus.md#tirage-de-la-cible. -->
              <div v-else class="flex shrink-0 gap-2">
                <BaseButton
                  v-for="kind in offeredTargets"
                  :key="kind"
                  variant="ghost"
                  :disabled="!castsLeft || casting !== null"
                  :loading="casting === entry.spell && castingOn === kind"
                  @click="castOn(entry.spell, kind)"
                >
                  {{ targetKindLabel(kind) }}
                </BaseButton>
              </div>
            </div>

            <!-- Ce que le sort fait, avant de le dépenser : un exemplaire lancé
                 ne revient pas. -->
            <SpellEffects :spell="entry.spell" class="mt-0.5" />
          </li>
        </BaseList>
      </BaseSection>

      <BaseNotice v-if="castFailed" class="mt-4">
        Le sort n'est pas parti. Réessaie.
      </BaseNotice>

      <!-- La cible n'est pas annoncée avant le lancer ; elle l'est après, ici,
           sur l'écran d'où le sort est parti. Voir specs/bonus.md#tirage-de-la-cible. -->
      <BaseHint v-else-if="lastCast" class="mt-4" :tone="lastCast.view.targetName ? 'success' : 'warning'">
        <template v-if="lastCast.kind === 'self'">
          {{ spellLabel(lastCast.view.spell) }} est posé sur toi.
        </template>
        <template v-else-if="lastCast.view.targetName">
          {{ spellLabel(lastCast.view.spell) }} est parti sur {{ lastCast.view.targetName }}.
        </template>
        <template v-else>
          {{ spellLabel(lastCast.view.spell) }} n'a trouvé personne à toucher :
          l'exemplaire est dépensé quand même.
        </template>
      </BaseHint>

      <!-- Le journal : c'est là que le lanceur lit ce qu'il a envoyé, et quand.
           Il survit à l'effet, qui meurt avec la tentative qu'il a ouverte. -->
      <BaseSection title="Ce que tu as lancé" class="mt-8">
        <BaseList class="mt-4" :empty="log.length ? null : 'Tu n\'as encore rien lancé.'">
          <li
            v-for="(entry, index) in log"
            :key="index"
            class="flex items-baseline justify-between gap-4 px-4 py-3"
          >
            <span class="font-medium">
              {{ spellLabel(entry.spell) }} — sur {{ entry.targetName ?? 'personne' }}
            </span>
            <span class="text-sm text-slate-400">{{ formatDayTime(entry.castAt) }}</span>
          </li>
        </BaseList>
      </BaseSection>

      <!-- L'autre côté du même système : sans lui, personne ne saurait jamais
           qu'un allié l'a soutenu. Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur. -->
      <BaseSection title="Ce que tu as reçu" class="mt-8">
        <BaseList class="mt-4" :empty="received.length ? null : 'Personne ne t\'a encore rien lancé.'">
          <li
            v-for="(entry, index) in received"
            :key="index"
            class="flex items-baseline justify-between gap-4 px-4 py-3"
          >
            <span class="font-medium">{{ spellLabel(entry.spell) }} — de {{ entry.casterName }}</span>
            <span class="text-sm text-slate-400">{{ formatDayTime(entry.castAt) }}</span>
          </li>
        </BaseList>
      </BaseSection>
    </template>
  </BaseCard>
</template>

<script setup lang="ts">
// L'inventaire, le lancer et les deux journaux — au camp et là
// seulement. Le lancer vise une catégorie, jamais une personne : soi, ou un
// allié ou un ennemi que le serveur tire et ne nomme qu'après.
// Voir specs/ecrans.md#sorts et specs/bonus.md#tirage-de-la-cible.
import { isCastable } from '~~/shared/utils/spells'
import type { SpellId } from '~~/shared/utils/spells'
import { TARGET_KINDS } from '~~/shared/utils/teams'
import type { TargetKind } from '~~/shared/utils/teams'
import type { CastView } from '~~/server/utils/effects'

definePageMeta({
  // Hors du camp, la page n'est pas atteignable — URL comprise. Le serveur
  // refuse déjà la lecture ; la garde épargne au joueur un écran qu'il ne
  // pourrait pas remplir. Voir middleware/camp.ts.
  middleware: 'camp',
})

const {
  entries,
  total,
  log,
  received,
  failed,
  casting,
  castFailed,
  castsLeft,
  castsPerCooldown,
  canTargetOthers,
  cast,
} = await useInventory()

// Le récapitulatif de ce qui attend la prochaine tentative vit sur l'écran de
// jeu : un sort lancé d'ici doit s'y voir au retour, pas au rechargement
// suivant.
const { state, refresh: refreshGame } = await useGameState()

// L'échéance se relit à la minute, comme les fiches de l'administration : c'est
// assez fin pour qu'aucun chiffre affiché ne soit faux, et le Répit la fait
// reculer d'un coup au retour du lancer.
const now = useClockTick()
const cooldownRemaining = computed(() =>
  (state.value?.cooldownUntil ? formatRemaining(state.value.cooldownUntil, now.value) : ''),
)

// Les catégories proposées : Soi toujours, Allié et Ennemi seulement à qui a une
// équipe — sans elle, elles ne désigneraient aucun pool.
// Voir specs/equipes.md#le-joueur-sans-équipe.
const offeredTargets = computed<TargetKind[]>(
  () => TARGET_KINDS.filter(kind => kind === 'self' || canTargetOthers.value),
)

// Quelle catégorie est en vol : un bouton par catégorie, et seul celui qu'on a
// pressé tourne.
const castingOn = ref<TargetKind | null>(null)

// Ce que le dernier lancer a touché, et la catégorie visée. Le journal le porte
// aussi, mais c'est ici que le joueur le lit sans chercher : la cible n'était
// pas annoncée avant, elle l'est maintenant. La catégorie voyage avec, pour que
// le joueur ne lise pas son propre nom quand il s'est visé lui-même.
const lastCast = ref<{ view: CastView, kind: TargetKind } | null>(null)

async function castOn(spell: SpellId, kind: TargetKind): Promise<void> {
  castingOn.value = kind
  lastCast.value = null

  await cast(spell, kind)

  // La première ligne du journal est celle qui vient de partir : il revient trié
  // du plus récent au plus ancien, et deux lancers de la même seconde se
  // départagent par leur ordre d'écriture. Voir server/utils/effects.ts.
  const view = log.value[0]
  lastCast.value = castFailed.value || !view ? null : { view, kind }
  castingOn.value = null

  await refreshGame()
}
</script>

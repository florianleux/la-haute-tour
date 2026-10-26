<template>
  <CampOverlay v-slot="{ closing, close }" label="Grimoire" close-label="Fermer le Grimoire" :lesson="lesson" @close="$emit('close')" @next="$emit('next')">
    <!-- Par-dessus le camp (CampOverlay), comme le Volumen. Clic à côté du
         livre = fermer.

         Le livre garde ses proportions (public/images/spellbook.webp,
         1828×1080) : jamais étiré, au plus large qui tienne, posé en bas de
         l'écran. Son bas tombe un peu dessous, comme celui du Volumen. Pas de
         version mobile pour l'instant. Les positions en % sont relevées sur
         l'image. Le livre garde ses clics d'une couverture à l'autre, sous
         les onglets du haut. -->
    <CampOverlayFrame
      src="/images/spellbook.webp"
      :closing="closing"
      enter="motion-safe:animate-camp-rise"
      leave="motion-safe:animate-sink [--enter-delay:0.1s]"
      :hits="['inset-x-[1.5%] bottom-0 top-[10%]']"
      class="-mb-[3dvh] mt-auto aspect-[1828/1080] w-[min(96vw,calc(90dvh*1828/1080))] origin-bottom"
      @close="close"
    >
      <!-- La page gauche : un rond par sort, médaillon une fois découvert. Le
           rond choisi dit quel sort la page droite montre. -->
      <!-- En leçon, le livre se regarde sans se toucher : seul répond ce que
           Michel demande — Vitalité à la page des sorts, puis « Sur moi ». -->
      <SpellPage
        v-model="selected"
        :discovered="discovered"
        :counts="counts"
        :only="pickOnly"
        v-bind="fadeLayer(closing, '0.5s')"
      />

      <!-- La magie du livre : des étincelles partout dessus, qui s'allument
           une fois le livre posé. Blanches, dans un halo turquoise, la
           couleur de la couverture, qui les détache du papier clair. Elles
           tournent en boucle : la sortie ne les attend pas. -->
      <SparkleField
        :sparks="SPARKS"
        glow="rgb(15 118 110 / 0.8)"
        class="pointer-events-none"
        v-bind="fadeLayer(closing, '0.6s')"
      />

      <!-- Le titre, au-dessus du livre, dans l'éclat des noms du camp : il
           jaillit pendant que le livre rebondit, comme celui du Volumen. -->
      <CampOverlayTitle :closing="closing" delay="0.35s" class="top-[6%]">
        Grimoire
      </CampOverlayTitle>

      <!-- La page droite. Positions relevées sur l'image, en % du livre. -->
      <div class="pointer-events-none absolute inset-0" v-bind="fadeLayer(closing, '0.7s')">
        <!-- Une seule colonne, de haut en bas : le sort choisi et de quoi le
             lancer, puis l'historique de ses derniers lancers, en bas de page.
             Pas de défilement : l'historique suit le détail, il ne peut pas
             passer dessous. -->
        <div class="pointer-events-auto absolute bottom-[9%] left-[54%] right-[11%] top-[16%] flex flex-col text-sm leading-snug text-amber-950">
          <p
            v-if="!selected"
            class="flex flex-1 items-center justify-center text-center italic text-amber-900/60"
          >
            Choisis un sort sur la page de gauche.
          </p>

          <template v-else>
            <!-- Changer de sort remonte le détail, le reste de la page et
                 l'historique (`:key`) : ils réapparaissent à l'encre, en
                 cascade, du nom du sort à la dernière ligne. -->
            <SpellbookDetails :key="`details-${selected}`" :spell="selected" :count="count" :cast="castScene" />

            <div :key="`actions-${selected}`" class="motion-safe:animate-ink-in [--enter-delay:0.18s]">
              <!-- Une catégorie par bouton, jamais une personne : le joueur ne
                   choisit pas qui il touche, seulement de quel côté il frappe.
                   Voir specs/bonus.md#tirage-de-la-cible. -->
              <div class="mt-3 flex flex-wrap gap-2">
                <BaseButton
                  v-for="kind in offeredTargets(canTargetOthers)"
                  :key="kind"
                  variant="parchment"
                  :disabled="!count || casting !== null || castScene !== null || !targetable[kind] || lessonHolds(kind)"
                  :loading="casting === selected && castingOn === kind"
                  :class="castSelfAsked(kind) && 'motion-safe:animate-nudge'"
                  @click="castOn(selected, kind)"
                >
                  {{ targetKindLabel(kind) }}
                </BaseButton>
              </div>

              <!-- Une catégorie sans personne à toucher se dit avant le clic :
                   soi au plafond d'effets positifs, un pool d'alliés ou
                   d'ennemis vide. Sans jamais dire qui, ni pourquoi.
                   Voir specs/bonus.md#tirage-de-la-cible. -->
              <BaseParchmentNote
                v-for="kind in offeredTargets(canTargetOthers).filter(kind => !targetable[kind])"
                :key="kind"
                fixed
                class="mt-2"
              >
                {{ UNREACHABLE[kind] }}
              </BaseParchmentNote>

              <BaseParchmentNote v-if="outcome" fixed class="mt-2" :tone="outcome.tone">
                {{ outcome.text }}
              </BaseParchmentNote>
            </div>
          </template>

          <!-- Calé en bas, à hauteur de cinq lancers : son titre ne bouge pas
               avec le nombre de lignes. -->
          <div class="mt-auto min-h-[8.5rem] pt-4">
            <BaseNotice v-if="failed">
              Impossible de lire tes sorts. Recharge la page.
            </BaseNotice>

            <!-- L'historique du sort choisi : à qui ses derniers lancers sont
                 allés, et quand. Il survit à l'effet, qui meurt avec la
                 tentative qu'il a ouverte. Des lignes serrées, à l'encre, comme
                 un registre ; il réapparaît avec le sort choisi, dernier de la
                 cascade. -->
            <div
              v-else-if="selected"
              :key="selected"
              class="motion-safe:animate-ink-in [--enter-delay:0.26s]"
            >
              <p class="font-bold">
                Historique
              </p>
              <p v-if="!history.length" class="mt-1 italic text-amber-900/60">
                Tu n'as encore jamais lancé ce sort.
              </p>
              <ul v-else class="mt-1 space-y-0.5">
                <li
                  v-for="(entry, index) in history"
                  :key="index"
                  class="flex items-baseline justify-between gap-4"
                >
                  <span>Sur {{ entry.targetName ?? 'personne' }}</span>
                  <span class="shrink-0 text-amber-900/60">{{ formatPastDay(entry.castAt, now) }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </CampOverlayFrame>
  </CampOverlay>
</template>

<script setup lang="ts">
// Le Grimoire : la page des sorts, le lancer du sort choisi et son
// historique — au camp et là seulement, ouvert par-dessus lui. Le lancer vise une
// catégorie, jamais une personne : soi, ou un allié ou un ennemi que le serveur
// tire et ne nomme qu'après. Voir specs/ecrans.md#sorts.
import { GAME_STATE_KEY } from '~/composables/useGameState'
import { faceFor, FIRST_SPELL } from '~~/shared/utils/spells'
import type { SpellId } from '~~/shared/utils/spells'
import type { TargetKind } from '~~/shared/utils/teams'
import type { LessonLine } from '~~/utils/lessons'
import type { Tone } from '~~/utils/tone'

const props = defineProps<{
  /** La réplique de Michel quand il parle depuis le Grimoire, à sa leçon. Voir CampOverlay. */
  lesson?: LessonLine
}>()

const emit = defineEmits<{
  close: []
  next: []
  /** Vitalité choisie à la page des sorts, comme Michel le demandait. */
  chosen: []
  /** Vitalité lancée sur soi, comme Michel le demandait. */
  cast: []
}>()

/** Michel demande de choisir Vitalité à la page des sorts. */
const pickAsked = computed(() => asks(props.lesson, 'spellPage'))

/** Le seul sort qui se choisit sur la page : en leçon, celui que Michel demande, ou aucun ; hors leçon, tous. */
const pickOnly = computed(() => {
  if (!props.lesson) {
    return undefined
  }
  return pickAsked.value ? FIRST_SPELL : null
})

/** Michel demande de la lancer sur soi. */
const castAsked = computed(() => asks(props.lesson, 'castSelf'))

function castSelfAsked(kind: TargetKind): boolean {
  return castAsked.value && kind === 'self'
}

/** En leçon, une catégorie reste éteinte, sauf « Sur moi » quand Michel le demande. */
function lessonHolds(kind: TargetKind): boolean {
  return Boolean(props.lesson) && !castSelfAsked(kind)
}

const {
  entries,
  discovered,
  log,
  failed,
  canTargetOthers,
  canTargetSelf,
  canTargetAlly,
  canTargetFoe,
  casting,
  castFailed,
  cast,
} = await usePocketSpells()

/** Le sort choisi à la page des sorts : rien à l'ouverture. */
const selected = ref<SpellId | null>(null)

/** Les catégories qui ont encore quelqu'un à toucher : le serveur le dit, la page éteint les autres. */
const targetable = computed<Record<TargetKind, boolean>>(() => ({
  self: canTargetSelf.value,
  ally: canTargetAlly.value,
  foe: canTargetFoe.value,
}))

/** Pourquoi une catégorie est éteinte, dit au joueur sous les boutons. */
const UNREACHABLE: Record<TargetKind, string> = {
  self: 'Tu portes déjà ton plein de magies blanches : plus de sort sur toi pour l\'instant.',
  ally: 'Aucun allié à portée pour l\'instant.',
  foe: 'Aucun ennemi à portée pour l\'instant.',
}

// Le jour des lancers de l'historique se relit à la minute : un lancer d'hier
// devient « Hier » au passage de minuit sans recharger.
const now = useClockTick()

/**
 * Les cinq derniers lancers du sort choisi, du plus récent au plus ancien.
 */
// ponytail: filtré dans le journal global (20 derniers lancers, tous sorts
// confondus) ; un sort peu lancé peut n'y plus figurer. #77 le lira par sort
// côté serveur.
const history = computed(() => log.value.filter(entry => entry.spell === selected.value).slice(0, 5))

/** Les exemplaires en poche, par sort : les pastilles de la page des sorts. */
const counts = computed<Partial<Record<SpellId, number>>>(() =>
  Object.fromEntries(entries.value.map(entry => [entry.spell, entry.count])))

/** Les exemplaires du sort choisi encore en poche. */
const count = computed(() => (selected.value ? counts.value[selected.value] ?? 0 : 0))

// Quelle catégorie est en vol : un bouton par catégorie, et seul celui qu'on a
// pressé tourne.
const castingOn = ref<TargetKind | null>(null)

/** Ce que le dernier lancer a donné, pour le sort choisi seulement. */
const outcome = ref<{ text: string, tone: Tone } | null>(null)

watch(selected, (spell) => {
  outcome.value = null
  if (pickAsked.value && spell === FIRST_SPELL) {
    emit('chosen')
  }
})

// Un geste que le livre ne peut pas faire ne bloque pas la leçon, qui ne se
// referme pas avant la fin : Vitalité absente de ce qu'il a lu — sa lecture a
// échoué —, et le choix passe ; plus d'exemplaire ou « Sur moi » éteint — le
// joueur porte déjà deux magies blanches, qu'on a pu lui lancer avant sa
// première visite —, et le lancer passe. L'état servi ne sait pas « Sur moi » :
// le dire coûterait une requête de plus à chaque lecture.
watch(pickAsked, (asked) => {
  if (asked && !discovered.value.includes(FIRST_SPELL)) {
    emit('chosen')
  }
}, { immediate: true })

watch(castAsked, (asked) => {
  if (asked && (!count.value || !canTargetSelf.value)) {
    emit('cast')
  }
}, { immediate: true })

// Sans lancer guidé, Michel ouvre lui-même Vitalité pour la montrer : le joueur
// ne choisit rien, le livre étant inerte.
watch(() => props.lesson, (line) => {
  const showing = line?.spotlight === 'spellPage' || line?.spotlight === 'castSelf'
  if (showing && !line?.awaits && discovered.value.includes(FIRST_SPELL)) {
    selected.value = FIRST_SPELL
  }
}, { immediate: true })

// L'animation du lancer, sur le médaillon du sort : la requête part pendant
// qu'il se charge, et le résultat ne s'écrit qu'une fois qu'il s'est envolé.
// Les boutons restent éteints jusque-là, pas seulement le temps de la requête.
const { cast: castScene, play: playCast } = useSpellCast()

async function castOn(spell: SpellId, kind: TargetKind): Promise<void> {
  castingOn.value = kind
  outcome.value = null

  await playCast(spell, faceFor(kind), async () => {
    await cast(spell, kind)
    return castFailed.value ? null : castHeadline(kind, log.value[0]?.targetName ?? null)
  })

  // Un autre sort choisi pendant l'animation n'a pas à lire le résultat de
  // celui-ci. La première ligne du journal est celle qui vient de partir : il
  // revient trié du plus récent au plus ancien. Voir server/utils/effects.ts.
  if (selected.value === spell) {
    const targetName = log.value[0]?.targetName ?? null
    outcome.value = castFailed.value
      ? { text: 'Le sort n\'est pas parti. Réessaie.', tone: 'danger' }
      : { text: castOutcome(spell, kind, targetName), tone: kind === 'self' || targetName ? 'success' : 'warning' }
  }
  castingOn.value = null

  // Le lancer que Michel demandait : la leçon passe au résultat.
  if (castSelfAsked(kind) && !castFailed.value) {
    emit('cast')
  }

  // Le minuteur du camp, dessous, qu'un Répit fait reculer.
  await refreshNuxtData(GAME_STATE_KEY)
}

/**
 * La magie du livre : des étincelles semées sur toute sa surface, en % de sa
 * boîte, décalées dans le cycle pour ne jamais s'allumer ensemble.
 */
const SPARKS = [
  { left: '8%', top: '20%', size: '3.1%', delay: '0s' },
  { left: '18%', top: '62%', size: '4.1%', delay: '0.9s' },
  { left: '24%', top: '14%', size: '2.5%', delay: '0.4s' },
  { left: '31%', top: '41%', size: '4.8%', delay: '1.3s' },
  { left: '38%', top: '78%', size: '3.4%', delay: '0.2s' },
  { left: '44%', top: '24%', size: '2.7%', delay: '1.1s' },
  { left: '49%', top: '55%', size: '3.7%', delay: '0.6s' },
  { left: '53%', top: '9%', size: '4.4%', delay: '1.5s' },
  { left: '58%', top: '70%', size: '2.9%', delay: '0.3s' },
  { left: '64%', top: '33%', size: '3.9%', delay: '1s' },
  { left: '70%', top: '85%', size: '3.2%', delay: '0.7s' },
  { left: '76%', top: '18%', size: '2.5%', delay: '1.4s' },
  { left: '81%', top: '50%', size: '4.6%', delay: '0.1s' },
  { left: '88%', top: '29%', size: '3.4%', delay: '0.8s' },
  { left: '92%', top: '68%', size: '2.7%', delay: '1.2s' },
  { left: '3%', top: '46%', size: '3.6%', delay: '0.5s' },
  { left: '96%', top: '12%', size: '3.1%', delay: '1.6s' },
  { left: '14%', top: '88%', size: '4.2%', delay: '1.05s' },
]
</script>

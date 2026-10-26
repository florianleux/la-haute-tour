<template>
  <div class="fixed inset-0 z-1 overflow-hidden bg-[#070d24] @container-size">
    <!-- L'illustration couvre l'écran sans se déformer (BACKDROP_COVER) :
         elle déborde sur les côtés, du décor qu'on peut perdre. Tout ce qui
         s'y pose se place en % de la scène 16:9 au centre, et se mesure en
         cqw : rien ne bouge par rapport au dessin, à toute taille d'écran. -->
    <div :class="[BACKDROP_BOX, BACKDROP_COVER]">
      <img
        :src="door.image"
        :alt="door.name"
        class="absolute inset-0 size-full"
      >
      <div
        class="@container"
        :class="BACKDROP_SCENE"
      >
        <!-- Une ombre sombre de plus sous les deux du ton `soft`, en
             `text-shadow` et non en `drop-shadow` (voir CLAUDE.md#styling) :
             elle remplace celles du ton, d'où leur liste réécrite ici. -->
        <BaseGlowLabel
          tone="soft"
          class="absolute left-1/2 top-[3%] -translate-x-1/2 text-[4.6cqw] [text-shadow:0_1px_2px_rgb(0_0_0/0.4),0_0_12px_var(--glow,rgb(191_219_254/0.6)),0_0.25cqw_0.6cqw_rgb(0_0_0/0.85)]!"
        >
          {{ door.name }}
        </BaseGlowLabel>

        <!-- Une serrure par clé posée s'allume, la gauche d'abord. Les noms des
             poseurs (ADR 0008) ne s'affichent pas encore : choix de Flo. -->
        <div
          v-for="(keyhole, index) in door.keyholes"
          :key="index"
          class="absolute aspect-[1/2] w-[2.5cqw] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[background-color,box-shadow] duration-700"
          :class="[keyhole, index < keysPlaced && 'bg-amber-200/50 shadow-[0_0_2.5cqw_1.25cqw_rgb(253_230_138/0.7)]']"
        />

        <!-- Entrer : le bouton de l'ascension, posé sur le bas des battants. -->
        <BaseCardButton
          v-if="open"
          label="Entrer"
          anchor="door"
          @click="emit('enter')"
        />

        <!-- Porte fermée : des liens lumineux, pas des boutons pleins — la clé
             d'abord, « Redescendre » plus discret dessous. -->
        <div
          v-else
          class="absolute bottom-[4%] left-1/2 flex -translate-x-1/2 flex-col items-center"
        >
          <BaseButton
            v-if="hasKey"
            variant="glow"
            @click="emit('placeKey')"
          >
            <BaseGlowLabel class="text-[1.9cqw]">
              Utiliser {{ door.keyName }}
            </BaseGlowLabel>
          </BaseButton>
          <BaseButton
            variant="glow"
            @click="emit('descendToCamp')"
          >
            <BaseGlowLabel
              tone="plain"
              class="text-[1.5cqw] opacity-80"
            >
              Redescendre
            </BaseGlowLabel>
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// L'écran de porte du boss (specs/boss.md#porte-à-deux-clés), le même pour
// toutes les portes : seule l'entrée de BOSS_DOORS change d'un étage à l'autre.
// Il n'affiche que ce qu'on lui donne ; la règle (qui peut poser, quand la
// porte s'ouvre) reste au serveur. Banc : pages/test/door/[floor].vue.
import { BACKDROP_BOX, BACKDROP_COVER, BACKDROP_SCENE } from '~~/utils/backdrop'
import type { BossDoorEntry } from '~~/utils/bossDoors'

defineProps<{
  door: BossDoorEntry
  /** Combien de clés l'équipe a posées : 0 à 2, une serrure allumée par clé. */
  keysPlaced: number
  /** Le joueur a une clé à poser. */
  hasKey: boolean
  /** Porte ouverte : deux clés posées, ou joueur sans équipe. */
  open: boolean
}>()

const emit = defineEmits<{ placeKey: [], enter: [], descendToCamp: [] }>()
</script>

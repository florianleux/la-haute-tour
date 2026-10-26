<template>
  <div class="absolute inset-0">
    <SparkleStar
      v-for="(spark, index) in sparks"
      :key="index"
      class="opacity-0 motion-safe:animate-sparkle"
      :glow="glow"
      :style="{ left: spark.left, top: spark.top, width: spark.size, animationDelay: spark.delay }"
    />
  </div>
</template>

<script setup lang="ts">
// Un champ d'étincelles qui scintillent en boucle, posé sur toute la boîte de
// son parent. Le halo de chaque étoile vient de `glow`, posé par l'appelant.

/** Une étincelle, en % de la boîte du champ. */
interface Spark {
  left: string
  top: string
  size: string
  /** Décalage dans le cycle de `animate-sparkle`, pour qu'elles ne s'allument pas ensemble. */
  delay: string
}

defineProps<{
  sparks: Spark[]
  /** La couleur du halo des étoiles. Voir SparkleStar. */
  glow?: string
}>()
</script>

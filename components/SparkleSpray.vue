<template>
  <span class="pointer-events-none absolute inset-0">
    <SparkleStar
      v-for="(spark, index) in sparks"
      :key="index"
      class="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 motion-safe:animate-spark-out"
      :glow="glow"
      :style="{ '--dx': spark.dx, '--dy': spark.dy, 'width': spark.size, 'animationDelay': spark.delay, 'animationDirection': inward ? 'reverse' : undefined }"
    />
  </span>
</template>

<script setup lang="ts">
// Une gerbe : des étincelles qui partent toutes du centre de la boîte de leur
// parent, chacune vers son point, une seule fois. Le pendant ponctuel de
// SparkleField, qui scintille en boucle. Le dessin de la gerbe (combien, où,
// quand) reste chez l'appelant — le coffre la veut ronde, le verdict juste
// étirée comme le mot. Le halo de chaque étoile vient de `glow`, comme dans
// SparkleField.

/** Une étincelle de la gerbe. Un `span` à la racine : elle se pose aussi dans un `<p>`. */
interface Spark {
  /** Où elle file depuis le centre, en unités CSS (cqw, en général). */
  dx: string
  dy: string
  size: string
  /** Quand elle part, pour qu'elles ne partent pas ensemble. */
  delay: string
}

defineProps<{
  sparks: Spark[]
  /**
   * La gerbe à l'envers : elles partent de leur point et convergent vers le
   * centre, de plus en plus vite (l'ease-out joué à rebours). En style, pas en
   * classe : le raccourci `animation` de `animate-spark-out` l'écraserait.
   */
  inward?: boolean
  /** La couleur du halo des étoiles. Voir SparkleStar. */
  glow?: string
}>()
</script>

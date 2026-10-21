<template>
  <!-- Visible au seul format mobile ; app.vue cache le reste au même format.
       Le décor flou du camp, le texte qui flotte dessus, et Michel au coin
       bas-droit, coupé au ras du bas comme en leçon (MichelLesson). L'`id` sert
       à behindMobileWall (utils/mobileWall.ts). Voir specs/ecrans.md#mur-mobile. -->
  <div
    id="mobile-wall"
    class="hidden min-h-dvh items-center justify-center bg-[url(/images/blurry-cooldown-bg.webp)] bg-cover bg-center p-6 pb-[min(38dvh,50vw)] mobile:flex"
  >
    <!-- Blanc, l'ombre marquée : le ciel du décor est clair. -->
    <div class="max-w-xl text-balance text-center text-white [text-shadow:0_3px_0_rgb(0_0_0/0.6),0_0_12px_rgb(0_0_0/0.8)]">
      <p class="text-4xl font-black">
        La Haute Tour n'est malheureusement pas encore disponible sur mobile !
      </p>
      <p class="mt-4 text-2xl font-bold">
        Reviens sur un ordinateur pour grimper.
      </p>
    </div>
    <img
      src="/images/michel.webp"
      alt="Michel"
      class="pointer-events-none fixed bottom-0 right-[2vw] aspect-[903/786] h-[min(38dvh,50vw)] origin-bottom translate-y-[4%] motion-safe:animate-camp-rise [--rise-lift:0dvh] [--rise-stretch:1.12]"
    >
  </div>
</template>

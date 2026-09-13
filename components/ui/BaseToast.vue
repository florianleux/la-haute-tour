<template>
  <!--
    `role="status"` et non `alert` : une annonce qui n'interrompt pas. Un lecteur
    d'écran la lit quand il en a fini avec ce qu'il disait, ce qui est exactement
    le rapport qu'un succès entretient avec la partie en cours.
  -->
  <div
    class="flex w-full max-w-sm items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur"
    role="status"
  >
    <slot />
  </div>
</template>

<template>
  <!-- La silhouette d'une fiche joueur : mêmes bordures, mêmes hauteurs, pour que
       rien ne saute quand la vraie arrive. -->
  <BaseTile>
    <div class="flex items-center gap-3">
      <BaseSkeleton height="h-10" width="w-10 shrink-0 rounded-full" />
      <div class="min-w-0 flex-1 space-y-2">
        <BaseSkeleton height="h-4" width="w-2/3" />
        <BaseSkeleton height="h-3" width="w-1/2" />
      </div>
    </div>

    <div class="mt-4 space-y-2">
      <BaseSkeleton height="h-3" width="w-full" />
      <BaseSkeleton height="h-3" width="w-5/6" />
      <BaseSkeleton height="h-3" width="w-3/4" />
    </div>

    <div class="mt-4 flex gap-2">
      <BaseSkeleton height="h-10" width="w-32" />
      <BaseSkeleton height="h-10" width="w-32" />
    </div>
  </BaseTile>
</template>

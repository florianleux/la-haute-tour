<template>
  <!-- L'icône de l'intoxication, à la place de celles des sorts : elle n'en est
       pas un, et ne passe donc pas par EffectPip. Son infobulle reprend le
       dessin de SpellDetails. Voir specs/champignon.md. -->
  <SpellTooltip class="cursor-pointer transition-transform hover:scale-110">
    <img src="/images/cooldown-mushroom.webp" alt="Intoxication alimentaire" class="aspect-square object-contain">
    <template #tip>
      <div class="flex items-center gap-3">
        <img src="/images/cooldown-mushroom.webp" alt="" class="size-[3.75rem] shrink-0 object-contain">
        <p class="min-w-0 text-base font-bold">
          Intoxication alimentaire
        </p>
      </div>
      <p class="mt-3">
        Ton écriture semble un peu... décalée.
      </p>
    </template>
  </SpellTooltip>
</template>

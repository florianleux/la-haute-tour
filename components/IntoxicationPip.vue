<template>
  <!-- L'icône de l'intoxication, à la place de celles des sorts : elle n'en est
       pas un, et ne passe donc pas par EffectPip. Voir specs/champignon.md. -->
  <SpellTooltip class="cursor-pointer transition-transform hover:scale-110">
    <img src="/images/cooldown-mushroom.webp" alt="Intoxication alimentaire" class="aspect-square object-contain">
    <template #tip>
      <TooltipHeader title="Intoxication alimentaire">
        <template #icon>
          <img src="/images/cooldown-mushroom.webp" alt="" class="size-[3.75rem] shrink-0 object-contain">
        </template>
      </TooltipHeader>
      <p class="mt-3">
        Ton écriture semble un peu... décalée.
      </p>
    </template>
  </SpellTooltip>
</template>

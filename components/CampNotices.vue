<template>
  <!-- Ce qui est arrivé au joueur sans lui : une ligne par nouvelle, chacune
       avec son « OK ». Rien quand il n'y a rien de neuf. Le titre reste, seule
       la liste défile quand elle déborde du parchemin. -->
  <div
    v-if="count"
    class="flex w-full flex-col items-center"
  >
    <p class="text-[1.84cqw] font-semibold uppercase tracking-wide text-amber-900/70">
      Pendant ton absence
    </p>
    <BaseParchmentLink
      v-if="count > 1"
      class="text-[1.3cqw]"
      :disabled="pending"
      @click="read({ disputes: disputes.map(notice => notice.id), spells: spells.map(notice => notice.id) })"
    >
      Tout marquer lu
    </BaseParchmentLink>

    <ul class="mt-[1cqw] flex max-h-[16cqw] min-h-0 w-full flex-col gap-[0.8cqw] overflow-y-auto pr-[1.5cqw] text-left text-[1.68cqw]">
      <li
        v-for="notice in disputes"
        :key="`dispute-${notice.id}`"
        class="flex items-baseline justify-between gap-[1.5cqw]"
      >
        <span>
          Ta contestation sur « {{ notice.statement }} » a été
          <strong>{{ notice.verdict === 'accepted' ? 'acceptée' : 'refusée' }}</strong>.
        </span>
        <BaseParchmentLink
          :disabled="pending"
          @click="read({ disputes: [notice.id], spells: [] })"
        >
          OK
        </BaseParchmentLink>
      </li>
      <li
        v-for="notice in spells"
        :key="`spell-${notice.id}`"
        class="flex items-baseline justify-between gap-[1.5cqw]"
      >
        <span>
          {{ notice.casterName }} t'a lancé
          <SpellMention :subject="notice.spell" />
          en {{ spellFaceLabel(notice.face).toLowerCase() }}.
        </span>
        <BaseParchmentLink
          :disabled="pending"
          @click="read({ disputes: [], spells: [notice.id] })"
        >
          OK
        </BaseParchmentLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// Les nouvelles, sur le parchemin du poster. Le survol du sort dit ce qu'il
// fait (SpellMention). Voir specs/ecrans.md#nouvelles.
const { disputes, spells, pending, read, announceWaiting } = await useNotices()

onMounted(announceWaiting)

const count = computed(() => disputes.value.length + spells.value.length)
</script>

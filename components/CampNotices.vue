<template>
  <!-- Ce qui est arrivé au joueur sans lui : une ligne par nouvelle, chacune
       avec son « OK ». Rien quand il n'y a rien de neuf. Le titre reste, seule
       la liste défile quand elle déborde du parchemin. -->
  <div
    v-if="lines.length"
    class="flex w-full flex-col items-center"
  >
    <p class="text-[1.84cqw] font-semibold uppercase tracking-wide text-amber-900/70">
      Pendant ton absence
    </p>
    <BaseButton
      v-if="lines.length > 1"
      variant="ink"
      class="text-[1.3cqw]"
      :disabled="pending"
      @click="read({ disputes: disputes.map(notice => notice.id), spells: spells.map(notice => notice.id) })"
    >
      Tout marquer lu
    </BaseButton>

    <ul class="mt-[1cqw] flex max-h-[16cqw] min-h-0 w-full flex-col gap-[0.8cqw] overflow-y-auto pr-[1.5cqw] text-left text-[1.68cqw]">
      <li
        v-for="line in lines"
        :key="line.key"
        class="flex items-baseline justify-between gap-[1.5cqw]"
      >
        <span v-if="line.dispute">
          Ta contestation sur « {{ line.dispute.statement }} » a été
          <strong>{{ line.dispute.verdict === 'accepted' ? 'acceptée' : 'refusée' }}</strong>.
        </span>
        <span v-else-if="line.spell">
          {{ line.spell.casterName }} t'a lancé
          <SpellMention :subject="line.spell.spell" />
          en {{ spellFaceLabel(line.spell.face).toLowerCase() }}.
        </span>
        <BaseButton
          variant="ink"
          class="shrink-0"
          :disabled="pending"
          @click="read(line.read)"
        >
          OK
        </BaseButton>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { DisputeNotice, NoticeRead, SpellNotice } from '~~/server/utils/notices'

// Les nouvelles, sur le parchemin du poster. Le survol du sort dit ce qu'il
// fait (SpellMention). Voir specs/ecrans.md#nouvelles.
const { disputes, spells, pending, read, announceWaiting } = await useNotices()

onMounted(announceWaiting)

/** Une ligne du poster : sa nouvelle, et ce que son « OK » lit. */
interface Line {
  key: string
  read: NoticeRead
  dispute?: DisputeNotice
  spell?: SpellNotice
}

const lines = computed((): Line[] => [
  ...disputes.value.map(dispute => ({ key: `dispute-${dispute.id}`, read: { disputes: [dispute.id], spells: [] }, dispute })),
  ...spells.value.map(spell => ({ key: `spell-${spell.id}`, read: { disputes: [], spells: [spell.id] }, spell })),
])
</script>

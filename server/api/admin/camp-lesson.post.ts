import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDatabase } from '~~/server/db/client'
import { items, pocketSpells, seenQuestions, users } from '~~/server/db/schema'
import { serveNextQuestion, submitAnswer } from '~~/server/utils/game'
import { rulesForFloor } from '~~/server/utils/rules'
import { LESSON_COLUMNS } from '~~/server/utils/lessons'
import { skipCooldown } from '~~/server/utils/lives'
import { requirePlayer, resetPlayer } from '~~/server/utils/players'
import { CHEST_ITEMS, namesChestItem } from '~~/shared/utils/items'
import { LESSON_IDS } from '~~/shared/utils/lessons'
import { FIRST_SPELL } from '~~/shared/utils/spells'
import { TEAM_IDS } from '~~/shared/utils/teams'

// La guilde à donner au joueur pour ce passage, ou aucune : sans équipe, la
// leçon du camp saute la bannière et les Haut-faits, celle du Grimoire les
// alliés et les ennemis. La leçon à revoir : celle du camp par défaut, celle
// de la chute, du rattrapage, du Grimoire, de la Plume, de la Boule, du Filet ou
// de la question loot.
const bodySchema = z.object({
  team: z.enum(TEAM_IDS).nullable(),
  lesson: z.enum(LESSON_IDS).default('camp'),
})

/**
 * Le banc des leçons de Michel (pages/test/camp.vue). Pour la leçon du camp,
 * remet le joueur servi à la sortie de l'introduction — partie neuve,
 * introduction finie, Fromage en poche, leçon du camp à voir. Il arrive alors
 * au camp comme un joueur neuf, et rejoue le premier parcours jusqu'à la
 * première question.
 *
 * Pour la leçon de la chute, le remet juste après sa première chute : partie
 * neuve, leçon du camp déjà vue, puis une vraie ascension perdue, une mauvaise
 * réponse par vie. L'attente, le Pool Échecs et le Volumen viennent du vrai
 * jeu, pas d'un état écrit à la main.
 *
 * Pour la leçon du rattrapage, la même chute, leçon de la chute vue, puis
 * l'attente passée : le joueur arrive au camp l'attente échue, avant
 * « Commencer ».
 *
 * Pour la leçon de la Plume de copiste, la même chute, leçon de la chute vue et
 * Plume dans le sac : le joueur arrive au camp en attente, avec des questions à
 * relire au Volumen.
 *
 * Pour la leçon du Filet à sangsues, la même chute, Filet dans le sac, et ses
 * questions ratées posées au seuil de sangsue : l'onglet Sangsues a de quoi se lire.
 *
 * Pour la leçon du Grimoire, partie neuve, leçon du camp vue, et la Vitalité
 * que donne le premier coffre en poche : le joueur est au camp au repos.
 *
 * Pour la leçon de la question loot, partie neuve, leçon du camp vue, et le
 * joueur posé juste avant sa première question loot, qui lui est tirée : il
 * arrive sur elle, chrono retenu.
 *
 * Pour la leçon du Champignon appétissant, partie neuve, toutes les autres leçons
 * vues : le joueur est au camp au repos, le champignon sur le décor.
 *
 * Admin seulement. Le joueur servi est le joueur test incarné : hors
 * développement, la partie d'un vrai compte, celui de l'admin compris, ne se
 * jette pas pour un banc.
 */
export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  await requireAdmin(event)
  const player = await requireAuth(event)

  if (!player.isTest && !import.meta.dev) {
    throw createError({ statusCode: 403, statusMessage: 'Incarne un joueur test' })
  }

  const { team, lesson } = await readValidatedBody(event, bodySchema.parse)
  const db = useDatabase()
  const now = new Date()

  await resetPlayer(db, player, now)
  // Introduction finie, guilde donnée, et vues les leçons qui précèdent celle
  // à revoir.
  await db.update(users).set({
    introDoneAt: now,
    team,
    ...lesson !== 'camp' && { [LESSON_COLUMNS.camp]: now },
    ...(lesson === 'recovery' || namesChestItem(lesson)) && { [LESSON_COLUMNS.fall]: now },
  }).where(eq(users.id, player.id))

  if (lesson === 'mushroom') {
    await db.update(users).set(
      Object.fromEntries(LESSON_IDS.filter(seen => seen !== 'mushroom' && seen !== 'mushroomEaten').map(seen => [LESSON_COLUMNS[seen], now])),
    ).where(eq(users.id, player.id))
    return { ok: true }
  }

  if (lesson === 'camp') {
    await db.insert(items).values({ userId: player.id, item: 'CHEESE', obtainedAt: now })
    return { ok: true }
  }

  if (lesson === 'spellbook') {
    await db.insert(pocketSpells).values({ userId: player.id, spell: FIRST_SPELL, obtainedAt: now })
    return { ok: true }
  }

  if (lesson === 'loot') {
    const floorSeen = rulesForFloor(player.currentFloor).questionsPerChest - 1
    await db.update(users).set({ floorSeen }).where(eq(users.id, player.id))
    await serveNextQuestion(db, await requirePlayer(db, player.id), now)
    return { ok: true }
  }

  // L'Objet dans le sac : le joueur perd ensuite une vraie ascension, comme à la
  // chute, pour avoir des questions vues à relire au Volumen.
  if (namesChestItem(lesson)) {
    await db.insert(items).values({ userId: player.id, item: CHEST_ITEMS[lesson], obtainedAt: now })
  }

  // Une réponse vide est toujours fausse. Le palier, sur un étage trop court,
  // arrêterait la boucle avant l'attente : ce n'est pas le cas d'un deck réel.
  // Le joueur est relu une fois, remis à zéro : servir et répondre relisent
  // eux-mêmes ce qui bouge.
  const fresh = await requirePlayer(db, player.id)
  let state = await serveNextQuestion(db, fresh, now)
  while (state.lives > 0 && state.question) {
    await submitAnswer(db, fresh, '', now)
    state = await serveNextQuestion(db, fresh, now)
  }

  // Ce que la chute vient d'écrire devient des Sangsues : l'onglet a de quoi se lire.
  if (lesson === 'leechNet') {
    await db
      .update(seenQuestions)
      .set({ recoveryFailures: rulesForFloor(player.currentFloor).leechThreshold })
      .where(eq(seenQuestions.userId, player.id))
  }

  if (lesson === 'recovery') {
    // L'échéance que la chute vient de poser, relue pour la passer.
    await skipCooldown(db, await requirePlayer(db, player.id), now)
  }

  return { ok: true }
})

import { and, desc, eq, isNull, notExists, sql } from 'drizzle-orm'
import { rulesForFloor, rulesWithEffects } from './rules'
import { activeEffects, inventory, missedPool, users } from '../db/schema'
import type { FloorRules } from './rules'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import { isWaitBound } from '../../shared/utils/spells'
import type { SpellFace, SpellId } from '../../shared/utils/spells'

/**
 * Un effet tel qu'un écran le montre : quel sort, quelle face, de qui, et s'il
 * attend encore la prochaine tentative ou s'il court sur celle en jeu. L'écran
 * d'attente lit les premiers, l'ascension affiche une icône par second.
 * Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur.
 */
export interface EffectView {
  spell: SpellId
  face: SpellFace
  /** Le lanceur, nommé : l'anonymat vaut au lancer, plus après. */
  casterName: string
  state: 'pending' | 'active'
}

/** Une ligne du journal : ce que le joueur a lancé, sur qui, et quand. */
export interface CastView {
  spell: SpellId
  face: SpellFace
  targetName: string
  /** ISO 8601. */
  castAt: string
}

/**
 * Lancer un sort. L'exemplaire quitte l'inventaire et le sort est consommé,
 * qu'il produise un effet ou non.
 *
 * Ce que l'effet attend dépend du sort : Vitalité et Chronomancie s'ancrent sur
 * la prochaine tentative de la cible, tandis que Répit, Indulgence et Purge
 * trouvent leur déclencheur dans l'attente en cours et agissent tout de suite.
 * Voir shared/utils/spells.ts et specs/bonus.md#ancrage-et-durée-de-vie.
 *
 * Seule la catégorie Soi existe aujourd'hui : la cible est le lanceur, et la
 * face est donc blanche. Allié et Ennemi arrivent avec les équipes.
 *
 * Un lancer sans exemplaire à consommer, ou un second exemplaire du même sort
 * dans la même attente, ne fait rien et ne dit rien : l'appareil qui l'a envoyé
 * est en retard ou en double, pas fautif. Voir specs/bonus.md#où-et-quand.
 */
export async function castSpell(db: Database, caster: User, spell: SpellId, now: Date): Promise<void> {
  // Le lancer n'a lieu que pendant une attente, dont le **début** identifie
  // l'exemplaire déjà parti — l'échéance ne le peut plus, Répit la déplace.
  // L'appelant l'a vérifié : sans attente, il n'y a rien à identifier, donc
  // rien à lancer, et le sort est gaspillé.
  const startedAt = caster.cooldownStartedAt

  if (!startedAt) {
    return
  }

  const [copy] = await db
    .select({ id: inventory.id })
    .from(inventory)
    .where(and(eq(inventory.userId, caster.id), eq(inventory.spell, spell)))
    .limit(1)

  if (!copy) {
    return
  }

  // L'exemplaire d'abord, l'effet ensuite, dans le même lot : ensemble ou pas du
  // tout, sinon un lancer à moitié fait poserait un effet gratuit.
  //
  // L'exemplaire n'est consommé que si rien n'est encore parti pour cette
  // attente-là, et c'est la contrainte d'unicité qui refuse l'effet en double.
  // Les deux gardes disent la même chose, chacune de son côté du lot : un
  // second lancer ne coûte donc rien et ne pose rien.
  const [, posed] = await db.batch([
    db.delete(inventory).where(and(
      eq(inventory.id, copy.id),
      notExists(alreadyCast(db, caster.id, spell, startedAt)),
    )),
    db
      .insert(activeEffects)
      .values({
        userId: caster.id,
        casterId: caster.id,
        spell,
        face: 'boon' satisfies SpellFace,
        castAt: now,
        castCooldownStartedAt: startedAt,
      })
      .onConflictDoNothing()
      .returning({ id: activeEffects.id }),
  ])

  // Rien de posé : le second lancer d'un même sort dans la même attente n'a rien
  // consommé, il ne doit rien produire non plus. Ce qui suit écrit — une Purge
  // rejouée viderait une seconde ligne du Pool Échecs pour un exemplaire qui,
  // lui, est resté en poche.
  if (!posed.length) {
    return
  }

  // Répit trouve son déclencheur déjà là : l'attente en cours se recalcule tout
  // de suite, sur l'écran même d'où le sort est parti. Recalculé plutôt que
  // raccourci, et depuis le début de l'attente : deux Répit divisent la durée
  // d'origine par quatre, au lieu de grignoter deux fois ce qu'il restait.
  // Voir specs/bonus.md#catalogue.
  if (spell === 'RESPITE') {
    await reshapeCooldown(db, caster, startedAt)
  }

  // Purge n'attend rien et ne module rien : elle vide une ligne du Pool Échecs
  // à l'instant du lancer. Voir specs/bonus.md#catalogue.
  if (spell === 'PURGE') {
    await purgeFromPool(db, caster)
  }
}

/**
 * Une question du Pool Échecs de l'étage courant, tirée au hasard, en sort sans
 * avoir été rejouée — le seul chemin du jeu pour ça.
 *
 * Elle en sort comme elle en sortirait par le seuil de réussites : la ligne du
 * pool part, le passage reste vu. La progression d'étage ne bouge donc pas.
 *
 * Sur un pool vide, il n'y a rien à retirer et le sort est gaspillé — sans
 * erreur, et sans vérification préalable au lancer : on ne bloque pas le
 * ciblage. Voir specs/bonus.md#catalogue.
 */
async function purgeFromPool(db: Database, target: User): Promise<void> {
  const onThisFloor = and(
    eq(missedPool.userId, target.id),
    eq(missedPool.floor, target.currentFloor),
  )

  // Tirage et retrait en une seule instruction. En deux — lire puis supprimer —
  // deux lanceurs simultanés pourraient désigner la même ligne et n'en sortir
  // qu'une, là où la spec en promet deux. Voir specs/bonus.md#cumul.
  await db.delete(missedPool).where(and(
    onThisFloor,
    eq(missedPool.questionId, sql`(select ${missedPool.questionId} from ${missedPool}
      where ${missedPool.userId} = ${target.id}
        and ${missedPool.floor} = ${target.currentFloor}
      order by RANDOM() limit 1)`),
  ))
}

/**
 * L'échéance de l'attente, refaite à partir de son début et de tout ce qui est
 * posé sur elle — jamais grignotée depuis ce qu'il en restait. Deux Répit
 * divisent donc la durée d'origine par quatre, dans l'ordre qu'on voudra.
 */
async function reshapeCooldown(db: Database, target: User, startedAt: Date): Promise<void> {
  // Ce que cette attente-ci dure, et non ce que le jeu de règles dit d'une
  // attente : celle qui suit un rattrapage entièrement manqué est plus courte,
  // et la recalculer sur les douze heures de l'autre la rallongerait.
  const baseMs = target.cooldownBaseMs

  if (baseMs === null) {
    return
  }

  const onThisWait = await db
    .select({ spell: activeEffects.spell, face: activeEffects.face })
    .from(activeEffects)
    .where(and(
      eq(activeEffects.userId, target.id),
      eq(activeEffects.castCooldownStartedAt, startedAt),
    ))

  // Le jeu de règles module la durée, on lui donne celle de cette attente-là.
  const rules = { ...rulesForFloor(target.currentFloor), cooldownMs: baseMs }
  const { cooldownMs } = rulesWithEffects(rules, onThisWait)

  await db
    .update(users)
    .set({ cooldownUntil: new Date(startedAt.getTime() + cooldownMs) })
    .where(eq(users.id, target.id))
}

/** Ce lanceur a-t-il déjà envoyé ce sort pendant cette attente ? */
function alreadyCast(db: Database, casterId: number, spell: SpellId, startedAt: Date) {
  return db
    .select({ id: activeEffects.id })
    .from(activeEffects)
    .where(and(
      eq(activeEffects.casterId, casterId),
      eq(activeEffects.spell, spell),
      eq(activeEffects.castCooldownStartedAt, startedAt),
    ))
}

/**
 * Le type exact d'une requête Drizzle ne s'écrit pas à la main. On le nomme une
 * fois ici, à partir de la requête elle-même, pour que la fonction exportée
 * puisse l'annoncer comme le veut CLAUDE.md.
 */
type EffectsQuery = ReturnType<typeof buildEffectsQuery>

function buildEffectsQuery(db: Database, userId: number) {
  return db
    .select({
      spell: activeEffects.spell,
      face: activeEffects.face,
      casterName: users.username,
      anchoredAt: activeEffects.anchoredAt,
      castCooldownStartedAt: activeEffects.castCooldownStartedAt,
    })
    .from(activeEffects)
    .innerJoin(users, eq(users.id, activeEffects.casterId))
    .where(eq(activeEffects.userId, userId))
    .orderBy(activeEffects.castAt)
}

/**
 * La requête des effets d'un joueur, rendue plutôt qu'exécutée : la lecture
 * d'état la fait voyager dans le même lot que sa réservation, pour que les
 * Sorts ne coûtent pas un aller-retour réseau de plus par question.
 * Voir tests/server/query-budget.test.ts.
 */
export function effectsQuery(db: Database, userId: number): EffectsQuery {
  return buildEffectsQuery(db, userId)
}

export type EffectRow = Awaited<EffectsQuery>[number]

/**
 * Ce que ces lignes valent pour ce joueur-là. Un effet ancré ne vit que le temps
 * de la tentative qui l'a réveillé : elle finit quand les vies tombent, bien
 * avant que la suivante ne s'ouvre, et il meurt là — consommé ou non. Le tri se
 * fait ici plutôt qu'en base, parce que c'est le joueur qui porte de quoi
 * trancher. Voir specs/bonus.md#ancrage-et-durée-de-vie.
 */
export function toEffectViews(rows: EffectRow[], user: User): EffectView[] {
  return rows
    .filter(row => actsOnCurrentWait(row, user))
    .filter(row => row.anchoredAt === null || stillRunning(row.anchoredAt, user))
    .map(({ spell, face, casterName, anchoredAt }) => ({
      spell,
      face,
      casterName,
      state: anchoredAt === null ? 'pending' : 'active',
    }))
}

/**
 * Ce que le journal montre d'un coup. Une page d'écran, pas une règle du jeu :
 * elle n'a donc rien à faire dans le jeu de règles.
 */
export const CAST_LOG_SIZE = 20

/**
 * Le journal du lanceur : ce qu'il a envoyé, sur qui, et quand. Il survit à
 * l'effet, qui meurt avec la tentative sur laquelle il s'est ancré — c'est là
 * que le lanceur lit que son sort a touché quelqu'un.
 */
export async function readCastLog(db: Database, caster: User, limit = CAST_LOG_SIZE): Promise<CastView[]> {
  const rows = await db
    .select({
      spell: activeEffects.spell,
      face: activeEffects.face,
      targetName: users.username,
      castAt: activeEffects.castAt,
    })
    .from(activeEffects)
    .innerJoin(users, eq(users.id, activeEffects.userId))
    .where(eq(activeEffects.casterId, caster.id))
    .orderBy(desc(activeEffects.castAt))
    .limit(limit)

  return rows.map(row => ({ ...row, castAt: row.castAt.toISOString() }))
}

/**
 * Ancrer ce qui attendait sur la tentative qui s'ouvre, et rendre les règles
 * qu'elle jouera. Appelée par openAttempt() et par elle seule : l'ancre et le
 * début de tentative doivent porter le même instant, et c'est là-bas que les
 * deux s'écrivent. Voir server/utils/journey.ts.
 *
 * L'ancre porte l'instant d'ouverture, celui-là même que le joueur gardera en
 * `attemptStartedAt` : c'est cette égalité qui dit ensuite si un effet court
 * encore. Voir specs/bonus.md#ancrage-et-durée-de-vie.
 */
export async function anchorEffects(db: Database, user: User, startedAt: Date): Promise<FloorRules> {
  const pending = await db
    .update(activeEffects)
    .set({ anchoredAt: startedAt })
    .where(and(eq(activeEffects.userId, user.id), isNull(activeEffects.anchoredAt)))
    .returning({ spell: activeEffects.spell, face: activeEffects.face })

  return rulesWithEffects(rulesForFloor(user.currentFloor), pending)
}

/**
 * Un sort lié à l'attente a agi sur celle pendant laquelle il est parti, et
 * meurt avec elle : il n'attend aucune tentative, contrairement aux autres. Le
 * garder visible ensuite ferait annoncer une attente écourtée qu'il n'a pas
 * touchée, ou rallongerait un rattrapage qu'il n'a pas ouvert — c'est là ce que
 * « ponctuel » veut dire. Voir specs/bonus.md#ancrage-et-durée-de-vie.
 */
function actsOnCurrentWait(row: EffectRow, user: User): boolean {
  if (!isWaitBound(row.spell)) {
    return true
  }

  return user.cooldownStartedAt !== null
    && row.castCooldownStartedAt.getTime() === user.cooldownStartedAt.getTime()
}

/**
 * L'effet est ancré sur la tentative que le joueur joue *encore*.
 *
 * L'ancre seule en décide, et non les vies : une tentative ne se clôt qu'au
 * moment où la suivante s'ouvre — l'attente et le rattrapage qui la suivent en
 * font partie, et c'est ce que `closeAttempt()` inscrit. Une Chronomancie doit
 * donc tenir jusque sur les questions de rattrapage, jouées à zéro vie.
 * Voir server/utils/journey.ts et specs/bonus.md#ancrage-et-durée-de-vie.
 */
function stillRunning(anchoredAt: Date, user: User): boolean {
  return anchoredAt.getTime() === user.attemptStartedAt.getTime()
}

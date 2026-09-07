import { and, desc, eq, isNull, ne, notExists, sql } from 'drizzle-orm'
import { isBorneBy } from './mechanics'
import { rulesForFloor } from './rules'
import { rulesWithEffects, SPELLS } from './spellbook'
import { drawTarget } from './targets'
import { activeEffects, inventory, users } from '../db/schema'
import type { FloorRules } from './rules'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import { faceFor } from '../../shared/utils/spells'
import type { SpellFace, SpellId } from '../../shared/utils/spells'
import type { TargetKind } from '../../shared/utils/teams'

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

/**
 * Une ligne du journal : ce que le joueur a lancé, sur qui, et quand. Le nom est
 * null quand le tirage n'a désigné personne — le sort est parti dans le vide, et
 * le journal le dit plutôt que de taire un exemplaire dépensé.
 */
export interface CastView {
  spell: SpellId
  face: SpellFace
  targetName: string | null
  /** ISO 8601. */
  castAt: string
}

/**
 * Une ligne de l'autre journal : ce que le joueur a reçu, de qui, et quand.
 * L'anonymat vaut au moment du lancer, pour qu'on ne vise pas toujours la même
 * personne ; il n'a plus de raison d'être une fois le sort parti.
 * Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur.
 */
export interface ReceivedView {
  spell: SpellId
  face: SpellFace
  casterName: string
  /** ISO 8601. */
  castAt: string
}

/**
 * Lancer un sort. L'exemplaire quitte l'inventaire et le sort est consommé,
 * qu'il produise un effet ou non.
 *
 * Le lanceur choisit une **catégorie**, jamais une personne : sur soi, la cible
 * est lui-même ; sur un allié ou un ennemi, le serveur la tire, et la face suit
 * — blanche sur les deux premières, noire sur la dernière. Un pool éligible vide
 * ne désigne personne — le sort part quand même et ne fait rien.
 * Voir specs/bonus.md#tirage-de-la-cible.
 *
 * Ce que l'effet attend dépend du sort : Vitalité et Chronomancie s'ancrent sur
 * la prochaine tentative de la cible, tandis que Répit, Indulgence et Purge
 * trouvent leur déclencheur dans l'attente **de la cible** et agissent tout de
 * suite. Une cible qui ne vit pas d'attente n'a rien à leur donner à mordre.
 * Voir shared/utils/spells.ts et specs/bonus.md#ancrage-et-durée-de-vie.
 *
 * Un lancer sans exemplaire à consommer, ou une attente dont le budget est
 * épuisé, ne fait rien et ne dit rien : l'appareil qui l'a envoyé est en retard
 * ou en double, pas fautif. L'écran a déjà éteint le bouton.
 * Voir specs/bonus.md#où-et-quand.
 */
export async function castSpell(
  db: Database,
  caster: User,
  spell: SpellId,
  kind: TargetKind,
  now: Date,
  random: () => number = Math.random,
): Promise<void> {
  // Le lancer n'a lieu que pendant une attente, dont le **début** identifie
  // l'exemplaire déjà parti — l'échéance ne le peut plus, Répit la déplace.
  // L'appelant l'a vérifié : sans attente, il n'y a rien à identifier, donc
  // rien à lancer, et le sort est gaspillé.
  const startedAt = caster.cooldownStartedAt

  if (!startedAt) {
    return
  }

  // Sans équipe, ni Allié ni Ennemi ne désigne de pool : ces lancers n'existent
  // pas pour ce joueur-là, ils ne sont donc pas dépensés. L'écran ne les lui
  // propose déjà pas ; ceci ferme l'URL.
  // Voir specs/equipes.md#le-joueur-sans-équipe.
  if (kind !== 'self' && caster.team === null) {
    return
  }

  const rules = rulesForFloor(caster.currentFloor)

  const [copy] = await db
    .select({ id: inventory.id })
    .from(inventory)
    .where(and(eq(inventory.userId, caster.id), eq(inventory.spell, spell)))
    .limit(1)

  if (!copy) {
    return
  }

  // L'exemplaire ne part que si l'attente a encore du budget. La condition vit
  // sur l'écriture et non sur une lecture préalable : deux requêtes visant le
  // même exemplaire ne peuvent pas le consommer toutes les deux, et c'est le cas
  // qui compte — le double-clic sur le même bouton. Deux sorts différents partis
  // à la même milliseconde, eux, peuvent voir le même budget libre : assumé,
  // l'écran affiche ce qu'il reste. Voir specs/bonus.md#où-et-quand.
  const [spent] = await db
    .delete(inventory)
    .where(and(
      eq(inventory.id, copy.id),
      notExists(beyondBudget(db, caster.id, startedAt, rules.castsPerCooldown)),
    ))
    .returning({ id: inventory.id })

  // Budget épuisé, ou exemplaire déjà parti : rien n'est consommé, donc rien
  // n'est posé. Ce qui suit écrit — une Purge rejouée viderait une seconde ligne
  // du Pool Échecs pour un exemplaire resté en poche.
  if (!spent) {
    return
  }

  // La cible n'est tirée qu'une fois l'exemplaire consommé : un lancer refusé
  // par le budget ne doit pas désigner quelqu'un pour rien.
  const target = kind === 'self' ? caster : await drawTarget(db, caster, kind, now, random)
  const face = faceFor(kind)

  await db.insert(activeEffects).values({
    userId: target?.id ?? null,
    casterId: caster.id,
    spell,
    face,
    castAt: now,
    castCooldownStartedAt: startedAt,
    // L'attente de la cible, et non celle du lancer : ce sont deux instants
    // différents dès qu'on lance sur quelqu'un d'autre.
    targetCooldownStartedAt: target?.cooldownStartedAt ?? null,
  })

  if (!target) {
    return
  }

  // Ce que le sort fait à l'instant du lancer, s'il fait quelque chose : le
  // grimoire le possède, un sort = une entrée. Vitalité et Chronomancie n'agissent
  // pas à l'instant — leur effet s'ancre sur la tentative suivante. Purge mord le
  // Pool Échecs, Répit recalcule l'échéance. Voir server/utils/spellbook.ts.
  const entry = SPELLS[spell]
  if (entry?.actInstantly) {
    await entry.actInstantly(db, target, face)
  }
}

/**
 * Le lancer de trop : celui qui occuperait le rang `cap` dans cette attente-là,
 * en comptant de zéro. S'il existe déjà, le budget est épuisé.
 *
 * Dit par un décalage plutôt qu'un `count(*)` : c'est ce qui permet de le poser
 * en condition d'écriture, là où une lecture préalable laisserait une fenêtre —
 * et ça passe par le query builder, donc par la conversion d'horodatage que le
 * schéma définit. Un `count(*)` écrit à la main comparerait une `Date` brute à
 * des secondes, et ne trouverait jamais rien.
 */
function beyondBudget(db: Database, casterId: number, startedAt: Date, cap: number) {
  return db
    .select({ id: activeEffects.id })
    .from(activeEffects)
    .where(and(
      eq(activeEffects.casterId, casterId),
      eq(activeEffects.castCooldownStartedAt, startedAt),
    ))
    .limit(1)
    .offset(cap - 1)
}

/** Ce qu'il reste de lancers à ce joueur pour l'attente où il se tient. */
export async function castsLeftThisWait(db: Database, caster: User): Promise<number> {
  const { castsPerCooldown } = rulesForFloor(caster.currentFloor)

  if (!caster.cooldownStartedAt) {
    return 0
  }

  const [row] = await db
    .select({ used: sql<number>`count(*)` })
    .from(activeEffects)
    .where(and(
      eq(activeEffects.casterId, caster.id),
      eq(activeEffects.castCooldownStartedAt, caster.cooldownStartedAt),
    ))

  return Math.max(0, castsPerCooldown - row.used)
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
      targetCooldownStartedAt: activeEffects.targetCooldownStartedAt,
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
    .filter(row => isBorneBy(row, user))
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
  return toCastViews(await castLogQuery(db, caster.id, limit))
}

type CastLogQuery = ReturnType<typeof buildCastLogQuery>

function buildCastLogQuery(db: Database, casterId: number, limit: number) {
  return db
    .select({
      spell: activeEffects.spell,
      face: activeEffects.face,
      targetName: users.username,
      castAt: activeEffects.castAt,
    })
    .from(activeEffects)
    // Jointure ouverte : un lancer que le tirage n'a mené à personne reste une
    // ligne du journal, sans nom en face.
    .leftJoin(users, eq(users.id, activeEffects.userId))
    .where(eq(activeEffects.casterId, casterId))
    // L'horodatage se compte en secondes : deux lancers de la même seconde s'y
    // égalisent, et l'ordre d'écriture les départage. Sans ce second critère,
    // l'écran nommerait la cible d'un lancer pour celle d'un autre.
    .orderBy(desc(activeEffects.castAt), desc(activeEffects.id))
    .limit(limit)
}

/**
 * La requête du journal, rendue plutôt qu'exécutée : la page Sorts la fait
 * voyager dans le même lot que ses voisines, pour qu'ouvrir l'écran ne coûte pas
 * un aller-retour réseau par liste affichée.
 * Voir tests/server/query-budget.test.ts.
 */
export function castLogQuery(db: Database, casterId: number, limit = CAST_LOG_SIZE): CastLogQuery {
  return buildCastLogQuery(db, casterId, limit)
}

export function toCastViews(rows: Awaited<CastLogQuery>): CastView[] {
  return rows.map(row => ({ ...row, castAt: row.castAt.toISOString() }))
}

/**
 * L'autre journal : ce que le joueur a **reçu**, de qui, et quand. Ses propres
 * lancers sur lui-même n'y figurent pas — il les lit déjà en face.
 *
 * Sans ce journal, personne ne saurait jamais que le système existe : un effet
 * meurt avec la tentative qu'il a servie, et le nom de son lanceur avec lui.
 * Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur.
 */
export async function readReceivedLog(db: Database, target: User, limit = CAST_LOG_SIZE): Promise<ReceivedView[]> {
  return toReceivedViews(await receivedLogQuery(db, target.id, limit))
}

type ReceivedLogQuery = ReturnType<typeof buildReceivedLogQuery>

function buildReceivedLogQuery(db: Database, userId: number, limit: number) {
  return db
    .select({
      spell: activeEffects.spell,
      face: activeEffects.face,
      casterName: users.username,
      castAt: activeEffects.castAt,
    })
    .from(activeEffects)
    // Jointure fermée, contrairement au journal des lancers : un effet reçu a
    // toujours quelqu'un derrière lui.
    .innerJoin(users, eq(users.id, activeEffects.casterId))
    .where(and(
      eq(activeEffects.userId, userId),
      ne(activeEffects.casterId, userId),
    ))
    // Même départage qu'au journal des lancers : la seconde ne suffit pas.
    .orderBy(desc(activeEffects.castAt), desc(activeEffects.id))
    .limit(limit)
}

/** Même raison d'être que `castLogQuery` : les deux listes voyagent ensemble. */
export function receivedLogQuery(db: Database, userId: number, limit = CAST_LOG_SIZE): ReceivedLogQuery {
  return buildReceivedLogQuery(db, userId, limit)
}

export function toReceivedViews(rows: Awaited<ReceivedLogQuery>): ReceivedView[] {
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


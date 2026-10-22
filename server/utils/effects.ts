import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import { isBorneBy } from './mechanics'
import { displayNameColumn } from './names'
import { rulesForFloor } from './rules'
import { rulesWithEffects, SPELLS } from './spellbook'
import type { SpellLifetime, StakeRule } from './spellbook'
import { canTargetSelf, drawTarget } from './targets'
import { activeEffects, pocketSpells, users } from '../db/schema'
import type { FloorRules } from './rules'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import { faceFor } from '../../shared/utils/spells'
import type { SpellFace, SpellId } from '../../shared/utils/spells'
import type { TargetKind } from '../../shared/utils/teams'

/**
 * Un effet tel qu'un écran le montre : quel sort, quelle face, de qui, et s'il
 * est ancré sur la tentative en jeu (`active`) ou non (`pending`). Non ancré
 * veut dire à venir — ou, pour un sort lié à l'attente, déjà en action sur
 * celle-ci : il ne s'ancre jamais. L'écran d'attente lit les premiers,
 * l'ascension affiche une icône par second.
 * Voir specs/bonus.md#ce-que-voit-la-cible-et-ce-que-voit-le-lanceur.
 */
export interface EffectView {
  spell: SpellId
  face: SpellFace
  /** Le lanceur, nommé : l'anonymat vaut au lancer, plus après. */
  casterName: string
  state: 'pending' | 'active'
  /** Jusqu'à quand il agit, lu au grimoire : l'écran le dit sans connaître le sort. */
  lifetime: SpellLifetime
  /** Ce que l'effet change, chiffré par l'état ; null quand rien n'est à chiffrer. */
  stake: EffectStake | null
}

/**
 * La règle qu'un effet touche, telle que le joueur la vit : la base de l'étage,
 * puis les règles jouées, tous effets cumulés et pas seulement la part de
 * celui-ci. Voir specs/bonus.md#cumul.
 */
export interface EffectStake {
  rule: StakeRule
  before: number
  after: number
}

/** Un effet tel que la base le rend, avant que l'état ne chiffre ce qu'il change. */
export type PlacedEffect = Omit<EffectView, 'stake'>

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
 * Lancer un sort. L'exemplaire quitte la poche et le sort est consommé,
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
 * suite. Une cible qui ne vit pas d'attente n'a rien à donner à mordre à Répit
 * ni à Indulgence ; Purge, elle, mord son Pool Échecs quelle que soit sa phase —
 * sans que l'effet lui soit montré, faute d'attente à laquelle le rattacher.
 * Voir shared/utils/spells.ts et specs/bonus.md#ancrage-et-durée-de-vie.
 *
 * Aucun budget de lancers : un joueur lance autant de sorts qu'il en a en
 * poche. Ce qui borne l'empilement, c'est ce que la cible porte déjà — deux
 * magies noires, deux blanches. Voir specs/bonus.md#où-et-quand.
 *
 * Un lancer sans exemplaire à consommer, ou sur soi quand on porte déjà son
 * plafond d'effets positifs, ne fait rien et ne dit rien : l'appareil qui l'a
 * envoyé est en retard ou en double, pas fautif. L'écran a déjà éteint le
 * bouton.
 */
export async function castSpell(
  db: Database,
  caster: User,
  spell: SpellId,
  kind: TargetKind,
  now: Date,
  random: () => number = Math.random,
): Promise<void> {
  // Le lancer n'a lieu que pendant une attente, que le journal retient par son
  // **début** — l'échéance ne le peut pas, Répit la déplace. L'appelant l'a
  // vérifié : sans attente, il n'y a rien à lancer.
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

  // Sur soi, la cible est connue d'avance : un lanceur saturé de magies
  // blanches garde son exemplaire, plutôt que de le dépenser pour rien comme
  // sur un pool d'alliés vide. Lu avant l'écriture, comme le plafond l'est au
  // tirage : des lancers envoyés en même temps d'onglets différents peuvent
  // tous passer — l'écran, lui, n'en envoie qu'un à la fois. Assumé.
  // Voir specs/bonus.md#limite-deffets-positifs.
  if (kind === 'self' && !(await canTargetSelf(db, caster))) {
    return
  }

  const [copy] = await db
    .select({ id: pocketSpells.id })
    .from(pocketSpells)
    .where(and(eq(pocketSpells.userId, caster.id), eq(pocketSpells.spell, spell)))
    .limit(1)

  if (!copy) {
    return
  }

  // Deux requêtes visant le même exemplaire ne peuvent pas le consommer toutes
  // les deux : c'est le cas qui compte, le double-clic sur le même bouton.
  const [spent] = await db
    .delete(pocketSpells)
    .where(eq(pocketSpells.id, copy.id))
    .returning({ id: pocketSpells.id })

  // Exemplaire déjà parti : rien n'est consommé, donc rien n'est posé. Ce qui
  // suit écrit — une Purge rejouée viderait une seconde ligne du Pool Échecs
  // pour un exemplaire resté en poche.
  if (!spent) {
    return
  }

  // La cible n'est tirée qu'une fois l'exemplaire consommé : un lancer refusé
  // ne doit pas désigner quelqu'un pour rien.
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
      casterName: displayNameColumn,
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
export function toEffectViews(rows: EffectRow[], user: User): PlacedEffect[] {
  return rows
    .filter(row => isBorneBy(row, user))
    .map(({ spell, face, casterName, anchoredAt }) => ({
      spell,
      face,
      casterName,
      state: anchoredAt === null ? 'pending' : 'active',
      lifetime: SPELLS[spell].lifetime,
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
      // Nullable ici : la jointure ouverte laisse un lancer sans cible.
      targetName: sql<string | null>`${displayNameColumn}`,
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
 * La requête du journal, rendue plutôt qu'exécutée : le Grimoire la fait
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
      casterName: displayNameColumn,
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
 * Ce qui attend la prochaine tentative de ce joueur, et les règles qu'elle
 * jouera avec. Lu par openAttempt() et par elle seule, avant toute écriture :
 * les vies de la tentative en dépendent, et elles partent dans le même lot que
 * l'ancre de ces effets. Voir server/utils/journey.ts.
 */
export async function pendingEffects(db: Database, user: User): Promise<{ ids: number[], rules: FloorRules }> {
  const pending = await db
    .select({ id: activeEffects.id, spell: activeEffects.spell, face: activeEffects.face })
    .from(activeEffects)
    .where(and(eq(activeEffects.userId, user.id), isNull(activeEffects.anchoredAt)))

  return {
    ids: pending.map(effect => effect.id),
    rules: rulesWithEffects(rulesForFloor(user.currentFloor), pending),
  }
}


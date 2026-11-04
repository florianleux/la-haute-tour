import type { ItemId } from '~~/shared/utils/items'

export interface ItemLabel {
  name: string
  description: string
  /** L'image de l'Objet, sous public/ : l'écran de chargement l'attend d'office. */
  image: string
  /** Comment le coffre le nomme en toutes lettres, pour un Objet qu'il donne. */
  phrase?: string
}

/**
 * Ce que l'Inventaire dit d'un Objet. Provisoire, contrairement à l'identifiant
 * que le serveur et le schéma partagent, comme les libellés des sorts.
 * Voir specs/ecrans.md#inventaire.
 */
const ITEM_LABELS: Record<ItemId, ItemLabel> = {
  CHEESE: {
    name: 'Fromage',
    description: 'Un bout de fromage que L\'Inconnu t\'a tendu au départ, sans dire pourquoi. Il sent fort.',
    image: '/images/item-cheese.webp',
  },
  JULIEN_CARD: {
    name: 'Fiche carbonisée',
    description: 'Une fiche d\'animateur, roussie et trouée, que Julien Le Perse a laissée derrière lui.',
    image: '/images/item-julien-card.webp',
  },
  SCRIBE_QUILL: {
    name: 'Plume de copiste',
    description: 'Une plume d\'oiseau exotique trempée dans une encre noire. Débloque des fonctionnalités du Volumen.',
    image: '/images/item-scribe-quill.webp',
    phrase: 'la Plume de copiste',
  },
  LEECH_NET: {
    name: 'Filet à sangsues',
    description: 'Un filet aux mailles fines, encore humide. Débloque l\'onglet Sangsues du Volumen.',
    image: '/images/item-leech-net.webp',
    phrase: 'le Filet à sangsues',
  },
}

export function itemLabel(item: ItemId): ItemLabel {
  return ITEM_LABELS[item]
}

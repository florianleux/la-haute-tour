import type { ItemId } from '~~/shared/utils/items'

export interface ItemLabel {
  name: string
  description: string
  /** L'image de l'Objet, sous public/ : l'écran de chargement l'attend d'office. */
  image: string
}

/**
 * Ce que l'Inventaire dit d'un Objet. Provisoire, contrairement à l'identifiant
 * que le serveur et le schéma partagent, comme les libellés des sorts.
 * Voir specs/ecrans.md#inventaire.
 */
const ITEM_LABELS: Record<ItemId, ItemLabel> = {
  CHEESE: {
    name: 'Fromage',
    // TODO(texte) : description provisoire, Flo l'écrira.
    description: 'Un bout de fromage que L\'Inconnu t\'a tendu au départ, sans dire pourquoi. Il sent fort.',
    image: '/images/item-cheese.webp',
  },
}

export function itemLabel(item: ItemId): ItemLabel {
  return ITEM_LABELS[item]
}

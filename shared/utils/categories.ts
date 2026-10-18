/**
 * Les catégories du deck : un code, et le libellé du tag Anki qu'il remplace.
 * Partagé parce que les deux côtés en ont besoin : la préparation du deck et
 * l'import traduisent les tags en codes, l'app affiche le libellé. Voir le
 * glossaire de specs/spec.md.
 *
 * Syntaxe effaçable uniquement : la skill prepare-questions l'importe depuis un
 * `.mjs`, sans compilation.
 */
export const CATEGORY_LABELS = {
  ANIMAUX: 'Animaux',
  ARCHITECTURE: 'Architecture',
  ART: 'Art',
  BD: 'BD',
  BOTANIQUE: 'Botanique',
  CAPITALES: 'Capitales',
  CINEMA: 'Cinéma',
  DROIT: 'Droit',
  GASTRONOMIE: 'Gastronomie',
  GEOGRAPHIE: 'Géographie',
  HISTOIRE: 'Histoire',
  JEUX: 'Jeux',
  LITTERATURE: 'Littérature',
  MODE: 'Mode',
  MUSIQUE: 'Musique',
  MYTHOLOGIE: 'Mythologie',
  PHOTOGRAPHIE: 'Photographie',
  PRESSE: 'Presse',
  RADIO: 'Radio',
  RELIGION: 'Religion',
  SAINTS: 'Saints',
  SANTE_MEDECINE: 'Santé/Médecine',
  SCIENCES_TECHNIQUES: 'Sciences/Techniques',
  SOCIETE: 'Société',
  SPORT: 'Sport',
  THEATRE: 'Théâtre',
  TV: 'TV',
  VOCABULAIRE: 'Vocabulaire',
} as const

export type CategoryCode = keyof typeof CATEGORY_LABELS

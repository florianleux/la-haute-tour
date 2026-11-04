/** L'image d'un objet du camp, de jour ou de nuit. */
export function campImage(name: string, night: boolean): string {
  return `/images/${name}${night ? '-night' : ''}.webp`
}

/**
 * Un calque qui apparaît en fondu à l'ouverture d'une boîte du camp, après le
 * délai que l'appelant cale sur son entrée, et s'efface d'un coup à la
 * fermeture. Se pose par `v-bind` : la classe et le délai voyagent ensemble.
 *
 * Le délai passe par `style` et non par une classe `[--enter-delay:…]` :
 * Tailwind ne génère que les classes écrites telles quelles dans le code, pas
 * celles qu'on assemble.
 */
export function fadeLayer(closing: boolean, delay: string): { class: string, style: Record<string, string> } {
  return {
    class: closing ? 'motion-safe:animate-fade-out' : 'motion-safe:animate-fade-in',
    style: { '--enter-delay': closing ? '0s' : delay },
  }
}

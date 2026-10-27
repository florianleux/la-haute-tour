// Les décors plein écran sont en 20:9 : une scène 16:9 au centre, élargie de
// 10 % de chaque côté (CLAUDE.md#images). Des boîtes pour poser des objets
// dessus, dans un parent `@container-size` qui couvre l'écran.

/** La boîte du décor entier : centrée, au ratio de l'illustration. Sa taille vient de BACKDROP_COVER ou de l'appelant. */
export const BACKDROP_BOX = 'absolute left-1/2 aspect-[20/9] -translate-x-1/2'

/** La taille de BACKDROP_BOX qui reproduit le `bg-cover bg-center` de l'illustration. */
export const BACKDROP_COVER = 'top-1/2 w-[max(100cqw,100cqh*20/9)] -translate-y-1/2'

/**
 * La taille de BACKDROP_BOX calée sur la hauteur de la fenêtre et posée en bas :
 * la même que BACKDROP_COVER tant que la fenêtre est plus étroite que 20:9.
 * Plus large, le cover rogne le bas du décor, et ce qui est posé au sol y
 * tomberait à moitié hors écran. Pour le sol du camp, qui garde ainsi sa
 * taille et sa place face au poster à toute largeur.
 */
export const BACKDROP_GROUND = 'bottom-0 w-[calc(100cqh*20/9)]'

/**
 * La scène 16:9 d'origine, dans BACKDROP_BOX : un objet s'y place en % aux
 * coordonnées relevées sur le calque 1920×1080, sans conversion.
 */
export const BACKDROP_SCENE = 'absolute inset-y-0 left-[10%] w-[80%]'

/** La nuit bleue des écrans de boss : sous la porte, l'arène et l'outro. */
export const BOSS_NIGHT = 'bg-[#070d24]'

declare module '#app' {
  interface PageMeta {
    /** Reachable while signed out. See middleware/auth.global.ts. */
    public?: boolean
    /** Reachable only by a player carrying the admin flag. */
    admin?: boolean
  }
}

export {}

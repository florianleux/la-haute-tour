declare module '#app' {
  interface PageMeta {
    /** Reachable while signed out. See middleware/auth.global.ts. */
    public?: boolean
  }
}

export {}

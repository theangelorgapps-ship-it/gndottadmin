declare module 'cloudflare:workers' {
  /** Runtime bindings are supplied by Cloudflare; secrets remain untyped values. */
  export const env: Record<string, any>
}

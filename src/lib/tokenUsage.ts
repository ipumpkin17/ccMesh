export function hasUnknownCacheCreation(source: string | null | undefined, cacheCreationTokens: number): boolean {
  return source === 'codex' && cacheCreationTokens === 0
}

const SECOND_LEVEL_SUFFIXES = new Set([
  'com.br',
  'net.br',
  'org.br',
  'gov.br',
  'edu.br',
  'co.uk',
  'org.uk',
  'com.au',
  'co.jp',
  'com.mx',
])

/**
 * Host normalizado da URL, sem "www." e sem porta.
 * Paginas internas viram "chrome", "extension", etc.
 */
export function getDomain(url: string | undefined): string {
  if (!url) return 'outros'
  try {
    const parsed = new URL(url)
    switch (parsed.protocol) {
      case 'chrome:':
      case 'edge:':
      case 'about:':
        return 'navegador'
      case 'chrome-extension:':
      case 'moz-extension:':
        return 'extensoes'
      case 'file:':
        return 'arquivos'
    }
    return parsed.hostname.replace(/^www\./, '') || 'outros'
  } catch {
    return 'outros'
  }
}

/**
 * Nome curto para rotular o grupo: "docs.google.com" -> "google",
 * "app.meu-site.com.br" -> "meu-site".
 */
export function getGroupLabel(domain: string): string {
  if (!domain.includes('.')) return domain

  const parts = domain.split('.')
  const lastTwo = parts.slice(-2).join('.')
  const registrable = SECOND_LEVEL_SUFFIXES.has(lastTwo) ? parts.slice(-3) : parts.slice(-2)

  return registrable[0] ?? domain
}

/** Agrupa itens por uma chave, preservando a ordem de insercao. */
export function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const bucket = map.get(key)
    if (bucket) bucket.push(item)
    else map.set(key, [item])
  }
  return map
}

/** Hash estavel usado para escolher sempre a mesma cor para um dominio. */
export function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

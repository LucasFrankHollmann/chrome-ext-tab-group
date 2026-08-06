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
 * Host normalizado da URL, sem "www." e com a porta quando ela for explicita
 * ("localhost:3000") — assim dois servidores locais nao viram o mesmo grupo.
 * Paginas internas viram "browser", "extensions", etc.
 */
export function getDomain(url: string | undefined): string {
  if (!url) return 'other'
  try {
    const parsed = new URL(url)
    switch (parsed.protocol) {
      case 'chrome:':
      case 'edge:':
      case 'about:':
        return 'browser'
      case 'chrome-extension:':
      case 'moz-extension:':
        return 'extensions'
      case 'file:':
        return 'files'
    }
    const host = parsed.hostname.replace(/^www\./, '')
    if (!host) return 'other'
    return parsed.port ? `${host}:${parsed.port}` : host
  } catch {
    return 'other'
  }
}

/** Separa "localhost:3000" em host e porta. */
function splitPort(value: string): { host: string; port: string } {
  const index = value.lastIndexOf(':')
  if (index === -1) return { host: value, port: '' }
  const port = value.slice(index + 1)
  return /^\d+$/.test(port) ? { host: value.slice(0, index), port } : { host: value, port: '' }
}

/**
 * Um dominio casa com uma entrada da lista (predefinicao ou ignorados) quando:
 * - a entrada tem porta ("localhost:3000"): so aquele host+porta;
 * - a entrada nao tem porta ("localhost", "google.com"): o host, seus subdominios
 *   e qualquer porta.
 */
export function domainMatches(domain: string, entry: string): boolean {
  const target = entry.trim().toLowerCase()
  if (!target) return false
  if (domain === target) return true

  const parsedEntry = splitPort(target)
  if (parsedEntry.port) return false

  const host = splitPort(domain).host
  return host === target || host.endsWith(`.${target}`)
}

/** Pseudo-dominios de paginas internas: nao representam um site de verdade. */
const NON_SITE_DOMAINS = new Set(['other', 'browser', 'extensions', 'files'])

/**
 * Paginas internas (chrome://, nova aba, extensoes, file://) e URLs vazias nao
 * devem ser agrupadas: elas cairiam todas no mesmo balde so por serem internas.
 */
export function isSiteDomain(domain: string): boolean {
  return !NON_SITE_DOMAINS.has(domain)
}

/** Compara rotulos de grupo ignorando caixa e espacos em volta. */
export function sameLabel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/**
 * Nome curto para rotular o grupo: "docs.google.com" -> "google",
 * "app.meu-site.com.br" -> "meu-site".
 */
export function getGroupLabel(domain: string): string {
  const { host, port } = splitPort(domain)
  // A porta faz parte do rotulo: "localhost:3000" e "localhost:8080" sao grupos distintos.
  const suffix = port ? `:${port}` : ''

  // IPs (127.0.0.1, [::1]) nao tem "dominio registravel": ficam inteiros.
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.startsWith('[')) {
    return `${host}${suffix}`
  }

  const parts = host.split('.')
  const lastTwo = parts.slice(-2).join('.')
  const registrable = SECOND_LEVEL_SUFFIXES.has(lastTwo) ? parts.slice(-3) : parts.slice(-2)

  return `${registrable[0] ?? host}${suffix}`
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

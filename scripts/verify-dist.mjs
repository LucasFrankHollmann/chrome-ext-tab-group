// Confere se o dist/ esta consistente: manifest valido e todos os arquivos
// referenciados por ele presentes no disco.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const errors = []

function requireFile(relative, origin) {
  if (!existsSync(resolve(DIST, relative))) {
    errors.push(`${origin} referencia "${relative}", que nao existe em dist/`)
  }
}

if (!existsSync(resolve(DIST, 'manifest.json'))) {
  console.error('dist/manifest.json nao encontrado. Rode "npm run build".')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(resolve(DIST, 'manifest.json'), 'utf8'))

if (manifest.manifest_version !== 3) errors.push('manifest_version deve ser 3')
if (!manifest.name || !manifest.version) errors.push('manifest precisa de name e version')

for (const [size, file] of Object.entries(manifest.icons ?? {})) {
  requireFile(file, `icons[${size}]`)
}
for (const [size, file] of Object.entries(manifest.action?.default_icon ?? {})) {
  requireFile(file, `action.default_icon[${size}]`)
}
if (manifest.action?.default_popup) requireFile(manifest.action.default_popup, 'action.default_popup')
if (manifest.options_ui?.page) requireFile(manifest.options_ui.page, 'options_ui.page')
if (manifest.background?.service_worker) {
  requireFile(manifest.background.service_worker, 'background.service_worker')
}

// Os HTMLs precisam apontar para assets ja buildados (nada de /src/*.tsx).
for (const page of [manifest.action?.default_popup, manifest.options_ui?.page].filter(Boolean)) {
  const html = readFileSync(resolve(DIST, page), 'utf8')
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref = match[1]
    if (ref.startsWith('http') || ref.startsWith('data:')) continue
    if (ref.includes('/src/')) errors.push(`${page} ainda aponta para o fonte: ${ref}`)
    requireFile(ref.replace(/^\.?\//, ''), page)
  }
}

if (errors.length > 0) {
  console.error('Problemas encontrados no dist/:')
  for (const error of errors) console.error(` - ${error}`)
  process.exit(1)
}

console.log(`dist/ OK — ${manifest.name} v${manifest.version} (MV3)`)
console.log(`permissoes: ${(manifest.permissions ?? []).join(', ')}`)

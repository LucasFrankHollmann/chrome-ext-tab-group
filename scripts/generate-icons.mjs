// Gera os PNGs do icone da extensao sem dependencias externas.
// Desenha um "cartao" com 3 abas no topo, nas cores da extensao.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = resolve(ROOT, 'public', 'icons')
const STORE_DIR = resolve(ROOT, 'store')
const SIZES = [16, 32, 48, 128]

const BG = [37, 99, 235] // azul
const BG_DARK = [29, 78, 216]
const FG = [255, 255, 255]

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** @param {number} size @param {(x:number,y:number)=>[number,number,number,number]} shade */
function encodePng(size, shade) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let offset = 0
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0 // filtro "none"
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = shade(x, y)
      raw[offset++] = r
      raw[offset++] = g
      raw[offset++] = b
      raw[offset++] = a
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Cobertura do pixel dentro de um retangulo arredondado (antialias por supersampling 4x4). */
function roundedRectCoverage(x, y, rect) {
  const { left, top, right, bottom, radius } = rect
  const samples = 4
  let hits = 0
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const px = x + (sx + 0.5) / samples
      const py = y + (sy + 0.5) / samples
      if (px < left || px > right || py < top || py > bottom) continue
      const cx = Math.min(Math.max(px, left + radius), right - radius)
      const cy = Math.min(Math.max(py, top + radius), bottom - radius)
      const dx = px - cx
      const dy = py - cy
      if (dx * dx + dy * dy <= radius * radius) hits++
    }
  }
  return hits / (samples * samples)
}

function blend(base, layer, alpha) {
  return base.map((c, i) => Math.round(c * (1 - alpha) + layer[i] * alpha))
}

/**
 * @param size lado do PNG.
 * @param pad borda transparente em volta da arte, em pixels. Os icones da barra
 *   preenchem o quadro (pad 0); o da loja precisa de 16px de folga de cada lado
 *   (arte 96x96 em 128x128), conforme developer.chrome.com/docs/webstore/images.
 */
function drawIcon(size, pad = 0) {
  const u = (size - pad * 2) / 16 // unidade de grade (icone desenhado em 16x16)
  const at = (n) => pad + n * u
  const card = { left: at(0.6), top: at(0.6), right: at(15.4), bottom: at(15.4), radius: 3.4 * u }

  const tabs = [
    { left: at(2.4), top: at(3.4), right: at(6.4), bottom: at(6.2), radius: u },
    { left: at(7.4), top: at(3.4), right: at(13.6), bottom: at(6.2), radius: u },
    { left: at(2.4), top: at(7.4), right: at(13.6), bottom: at(10.2), radius: u },
    { left: at(2.4), top: at(11.4), right: at(9.4), bottom: at(14.2), radius: u },
  ]

  return encodePng(size, (x, y) => {
    const outer = roundedRectCoverage(x, y, card)
    if (outer <= 0) return [0, 0, 0, 0]

    // leve gradiente vertical no fundo
    const t = y / size
    let color = blend(BG, BG_DARK, t)

    for (const tab of tabs) {
      const cov = roundedRectCoverage(x, y, tab)
      if (cov > 0) color = blend(color, FG, cov)
    }

    return [color[0], color[1], color[2], Math.round(outer * 255)]
  })
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of SIZES) {
  const file = resolve(OUT_DIR, `icon-${size}.png`)
  writeFileSync(file, drawIcon(size))
  console.log(`icone gerado: ${file}`)
}

// Icone da ficha da loja: mesma arte, com a folga que o Google pede (arte 96x96
// em 128x128). Fica fora de public/ porque nao entra no pacote da extensao, e sim
// no formulario da loja.
//
// A folga sai de conta, nao de chute: o cartao ocupa 14.8 das 16 unidades da
// grade, entao para o cartao medir 96px a grade inteira precisa de 16*(96/14.8).
const STORE_ART = 96
const CARD_UNITS = 15.4 - 0.6
const storePad = Math.round((128 - 16 * (STORE_ART / CARD_UNITS)) / 2)

mkdirSync(STORE_DIR, { recursive: true })
const storeIcon = resolve(STORE_DIR, 'icon-128.png')
writeFileSync(storeIcon, drawIcon(128, storePad))
console.log(`icone da loja gerado: ${storeIcon} (folga ${storePad}px, arte ~${STORE_ART}px)`)

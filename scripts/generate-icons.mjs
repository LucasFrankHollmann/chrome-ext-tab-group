// Gera os PNGs do icone da extensao sem dependencias externas.
// Desenha um "cartao" com 3 abas no topo, nas cores da extensao.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
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

function drawIcon(size) {
  const u = size / 16 // unidade de grade (icone desenhado em 16x16)
  const card = { left: 0.6 * u, top: 0.6 * u, right: 15.4 * u, bottom: 15.4 * u, radius: 3.4 * u }

  const tabs = [
    { left: 2.4 * u, top: 3.4 * u, right: 6.4 * u, bottom: 6.2 * u, radius: 1 * u },
    { left: 7.4 * u, top: 3.4 * u, right: 13.6 * u, bottom: 6.2 * u, radius: 1 * u },
    { left: 2.4 * u, top: 7.4 * u, right: 13.6 * u, bottom: 10.2 * u, radius: 1 * u },
    { left: 2.4 * u, top: 11.4 * u, right: 9.4 * u, bottom: 14.2 * u, radius: 1 * u },
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

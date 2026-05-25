#!/usr/bin/env node
/**
 * Generates PNG icons and a Windows ICO file for OpenObsidian.
 * Pure Node.js — no external dependencies required.
 */
'use strict'

const zlib = require('zlib')
const fs   = require('fs')
const path = require('path')

// ── CRC32 (required by PNG format) ────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

// ── PNG chunk ─────────────────────────────────────────────────────────────

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const lenBuf    = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length)
  const crcInput  = Buffer.concat([typeBytes, data])
  const crcBuf    = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf])
}

// ── Hexagon test (pointy-top, circumradius R) ─────────────────────────────
//   |x| ≤ R·√3/2  AND  |y| ≤ R  AND  |y| + |x|/√3 ≤ R

function inHex(px, py, cx, cy, R) {
  const x = Math.abs(px - cx)
  const y = Math.abs(py - cy)
  return x <= R * 0.8660254 && y <= R && y + x * 0.5773503 <= R
}

// ── Generate one RGBA PNG ─────────────────────────────────────────────────

function generatePNG(size) {
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const R  = size * 0.43        // circumradius (tip-to-center)
  const AA = 1.2                // anti-alias fringe width in px

  // Inner highlight ring
  const rInner = R * 0.55

  const rowStride = size * 4 + 1          // 4 bytes RGBA + 1 filter byte
  const raw = Buffer.alloc(rowStride * size, 0)

  for (let y = 0; y < size; y++) {
    raw[y * rowStride] = 0                // PNG filter: None
    for (let x = 0; x < size; x++) {
      const off = y * rowStride + 1 + x * 4

      // Distance from exact pixel centre to hex boundary (signed: >0 = inside)
      const pxs = x + 0.5
      const pys = y + 0.5
      const dx  = Math.abs(pxs - cx)
      const dy  = Math.abs(pys - cy)
      // How far inside the hex boundary (approx)
      const hexDist = Math.min(R * 0.8660254 - dx, R - dy, R - dy - dx * 0.5773503)

      if (hexDist < -AA) continue         // fully outside → transparent

      // Inside fraction for AA
      const alpha = Math.min(1, (hexDist + AA) / (AA * 2))

      // Radial distance for gradient
      const dist  = Math.sqrt((pxs - cx) ** 2 + (pys - cy) ** 2)
      const t     = Math.min(1, dist / R)

      // Colour gradient: #7c3aed (centre) → #4c1d95 (edge)
      const r = Math.round(124 + (76 - 124) * t)
      const g = Math.round(58  + (29 - 58)  * t)
      const b = Math.round(237 + (149 - 237) * t)

      // Subtle inner glow
      const glow = dist < rInner ? (1 - dist / rInner) * 0.18 : 0
      const ri   = Math.min(255, Math.round(r + (255 - r) * glow))
      const gi   = Math.min(255, Math.round(g + (255 - g) * glow))
      const bi   = Math.min(255, Math.round(b + (255 - b) * glow))

      raw[off]     = ri
      raw[off + 1] = gi
      raw[off + 2] = bi
      raw[off + 3] = Math.round(alpha * 255)
    }
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type: RGBA

  const compressed = zlib.deflateSync(raw, { level: 9 })

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),  // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// ── Generate Windows ICO (PNG-embedded, Vista+) ───────────────────────────
//
//  ICO layout:
//    ICONDIR   { reserved=0, type=1, count=N }
//    N × ICONDIRENTRY { w, h, clrCnt, res, planes, bitCnt, size, offset }
//    N × PNG data

function generateICO(sizes) {
  const pngs = sizes.map(s => generatePNG(s))

  const ICONDIR_SIZE   = 6
  const ENTRY_SIZE     = 16
  const headerBytes    = ICONDIR_SIZE + ENTRY_SIZE * pngs.length

  // Compute offsets
  const offsets = []
  let offset = headerBytes
  for (const png of pngs) {
    offsets.push(offset)
    offset += png.length
  }

  const header = Buffer.alloc(ICONDIR_SIZE)
  header.writeUInt16LE(0, 0)              // reserved
  header.writeUInt16LE(1, 2)              // type: ICO
  header.writeUInt16LE(pngs.length, 4)   // count

  const entries = pngs.map((png, i) => {
    const size = sizes[i]
    const e = Buffer.alloc(ENTRY_SIZE)
    e[0] = size >= 256 ? 0 : size         // width  (0 = 256)
    e[1] = size >= 256 ? 0 : size         // height (0 = 256)
    e[2] = 0                              // color count
    e[3] = 0                              // reserved
    e.writeUInt16LE(1, 4)                 // planes
    e.writeUInt16LE(32, 6)                // bit count
    e.writeUInt32LE(png.length, 8)        // bytes in resource
    e.writeUInt32LE(offsets[i], 12)       // offset from file start
    return e
  })

  return Buffer.concat([header, ...entries, ...pngs])
}

// ── Main ──────────────────────────────────────────────────────────────────

const resourcesDir = path.join(__dirname, '..', 'resources')
const iconsDir     = path.join(resourcesDir, 'icons')
fs.mkdirSync(iconsDir, { recursive: true })

const PNG_SIZES = [16, 24, 32, 48, 64, 96, 128, 256, 512]
const ICO_SIZES = [16, 32, 48, 64, 128, 256]

console.log('Generating icons…')

for (const size of PNG_SIZES) {
  const png = generatePNG(size)
  const outPath = path.join(iconsDir, `${size}x${size}.png`)
  fs.writeFileSync(outPath, png)
  process.stdout.write(`  ✓ ${size}x${size}.png\n`)
}

// Main PNG (512 px) — used by Linux electron-builder
fs.copyFileSync(path.join(iconsDir, '512x512.png'), path.join(resourcesDir, 'icon.png'))
process.stdout.write('  ✓ icon.png\n')

// Windows ICO
const ico = generateICO(ICO_SIZES)
fs.writeFileSync(path.join(resourcesDir, 'icon.ico'), ico)
process.stdout.write('  ✓ icon.ico\n')

console.log('Done.')

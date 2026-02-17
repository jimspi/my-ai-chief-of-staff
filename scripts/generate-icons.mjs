import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svg = readFileSync(join(root, 'public', 'icon.svg'))

// Generate PNGs at different sizes
const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
]

for (const { name, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(root, 'public', name))
  console.log(`Created ${name}`)
}

// Generate ICO (just use 32x32 PNG as favicon.ico — browsers accept PNG)
const ico32 = await sharp(svg).resize(32, 32).png().toBuffer()
writeFileSync(join(root, 'public', 'favicon.ico'), ico32)
console.log('Created favicon.ico')

console.log('Done!')

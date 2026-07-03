function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 0.5) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  }
}

// [shade, lightness%, saturationScale]
const SHADE_CONFIG = [
  [50,  97, 0.20],
  [100, 93, 0.30],
  [200, 86, 0.50],
  [300, 75, 0.70],
  [400, 62, 0.85],
  [500, 52, 0.95],
  [600, 43, 1.00],
  [700, 36, 1.00],
  [800, 28, 0.90],
  [900, 20, 0.80],
]

/**
 * Generate a Tailwind-like color palette from a single hex color.
 * Returns { 50: "R G B", 100: "R G B", ..., 900: "R G B" }
 * Values are space-separated RGB integers for use in CSS rgb() with opacity.
 */
export function generatePalette(hex) {
  const { r, g, b } = hexToRgb(hex)
  const { h, s } = rgbToHsl(r, g, b)
  const palette = {}
  for (const [shade, lightness, satScale] of SHADE_CONFIG) {
    const sat = Math.max(5, Math.min(100, s * satScale))
    const rgb = hslToRgb(h, sat, lightness)
    palette[shade] = `${rgb.r} ${rgb.g} ${rgb.b}`
  }
  return palette
}

/**
 * Apply a primary color palette to the document root.
 * Sets --p50 through --p900 CSS custom properties.
 */
export function applyPalette(hex, root = document.documentElement) {
  const palette = generatePalette(hex)
  for (const [shade, value] of Object.entries(palette)) {
    root.style.setProperty(`--p${shade}`, value)
  }
}

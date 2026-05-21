// Tiny browser-safe path utilities. Avoids pulling node:path into the
// renderer bundle.

function basename(p: string): string {
  if (!p) return ''
  const cleaned = p.replace(/[\\/]+$/, '')
  const idx = Math.max(cleaned.lastIndexOf('/'), cleaned.lastIndexOf('\\'))
  return idx === -1 ? cleaned : cleaned.slice(idx + 1)
}

export default { basename }

import { Style, Circle, Fill, Stroke, Text } from 'ol/style'

// OL canvas API requires raw CSS color values; these match the design tokens
// --accent (mint): #11DF81 / dark text on accent: #07140A
const ACCENT = '#11DF81'
const ON_ACCENT = '#07140A'

export function createClusterStyle(feature) {
  const children = feature.get('features')
  if (!children || children.length === 0) return null
  if (children.length === 1) {
    // Single isolated company — show as small dot so it stays visible when DOM pins are hidden
    return new Style({
      image: new Circle({
        radius: 7,
        fill: new Fill({ color: ACCENT }),
        stroke: new Stroke({ color: ON_ACCENT, width: 1.5 }),
      }),
    })
  }
  const count = children.length
  const label = count > 99 ? '99+' : String(count)
  return new Style({
    image: new Circle({
      radius: 22,
      fill: new Fill({ color: ACCENT }),
      stroke: new Stroke({ color: ON_ACCENT, width: 2 }),
    }),
    text: new Text({
      text: label,
      fill: new Fill({ color: ON_ACCENT }),
      font: 'bold 13px "JetBrains Mono", monospace',
    }),
  })
}

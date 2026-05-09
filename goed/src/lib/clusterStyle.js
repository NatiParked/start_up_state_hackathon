import { Style, Circle, Fill, Stroke, Text } from 'ol/style'

// OL canvas API requires raw CSS color values; these match the Tailwind tokens
// utah-blue: rgb(0, 101, 164) / utah-blue-dark: rgb(0, 77, 122)
const UTAH_BLUE = 'rgb(0, 101, 164)'
const WHITE = 'white'

export function createClusterStyle(feature) {
  const children = feature.get('features')
  if (!children || children.length === 0) return null
  if (children.length === 1) {
    // Single isolated company — show as small dot so it stays visible when DOM pins are hidden
    return new Style({
      image: new Circle({
        radius: 7,
        fill: new Fill({ color: UTAH_BLUE }),
        stroke: new Stroke({ color: WHITE, width: 1.5 }),
      }),
    })
  }
  const count = children.length
  const label = count > 99 ? '99+' : String(count)
  return new Style({
    image: new Circle({
      radius: 22,
      fill: new Fill({ color: UTAH_BLUE }),
      stroke: new Stroke({ color: WHITE, width: 2 }),
    }),
    text: new Text({
      text: label,
      fill: new Fill({ color: WHITE }),
      font: 'bold 13px sans-serif',
    }),
  })
}

import { Style, Circle, Fill, Stroke, Text } from 'ol/style'

export function createClusterStyle(feature) {
  const children = feature.get('features')
  if (!children || children.length <= 1) return null
  const count = children.length
  const label = count > 99 ? '99+' : String(count)
  return new Style({
    image: new Circle({
      radius: 22,
      fill: new Fill({ color: '#0065A4' }),
      stroke: new Stroke({ color: '#ffffff', width: 2 }),
    }),
    text: new Text({
      text: label,
      fill: new Fill({ color: '#ffffff' }),
      font: 'bold 13px sans-serif',
    }),
  })
}

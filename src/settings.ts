export type WidgetType = 'web' | 'calendar' | 'text' | 'image'

export type DashboardWidget = {
  id: string
  type: WidgetType
  title: string
  url: string
  columns: number
  rows: number
}

export type DisplaySettings = {
  version: 2
  location: string
  weatherCity: string
  widgets: DashboardWidget[]
}

export const defaultSettings: DisplaySettings = {
  version: 2,
  location: 'Zuhause',
  weatherCity: '',
  widgets: [],
}

const widgetTypes = new Set<WidgetType>(['web', 'calendar', 'text', 'image'])

export const widgetConstraints: Record<WidgetType, { minColumns: number; minRows: number; defaultColumns: number; defaultRows: number }> = {
  web: { minColumns: 4, minRows: 2, defaultColumns: 12, defaultRows: 3 },
  calendar: { minColumns: 6, minRows: 5, defaultColumns: 8, defaultRows: 5 },
  text: { minColumns: 4, minRows: 2, defaultColumns: 8, defaultRows: 3 },
  image: { minColumns: 4, minRows: 2, defaultColumns: 8, defaultRows: 3 },
}

const widgetTitles: Record<WidgetType, string> = {
  web: 'Web-Widget',
  calendar: 'Kalender',
  text: 'Notiz',
  image: 'Bild',
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function dimension(value: unknown, fallback: number, minimum: number, maximum: number, multiplier = 1) {
  return Math.max(minimum, Math.min(maximum, Math.round((Number(value) || fallback) * multiplier)))
}

export function createWidget(type: WidgetType, index: number, id = `widget-${index}`): DashboardWidget {
  const constraints = widgetConstraints[type]
  return {
    id,
    type,
    title: widgetTitles[type],
    url: '',
    columns: constraints.defaultColumns,
    rows: constraints.defaultRows,
  }
}

export function layoutFits(widgets: DashboardWidget[]) {
  const grid = Array.from({ length: 8 }, () => Array<boolean>(24).fill(false))

  for (const widget of widgets) {
    let placed = false
    for (let row = 0; row <= 8 - widget.rows && !placed; row += 1) {
      for (let column = 0; column <= 24 - widget.columns && !placed; column += 1) {
        let available = true
        for (let y = row; y < row + widget.rows && available; y += 1) {
          for (let x = column; x < column + widget.columns; x += 1) {
            if (grid[y]![x]) {
              available = false
              break
            }
          }
        }
        if (!available) continue
        for (let y = row; y < row + widget.rows; y += 1) {
          for (let x = column; x < column + widget.columns; x += 1) grid[y]![x] = true
        }
        placed = true
      }
    }
    if (!placed) return false
  }

  return true
}

export function normalizeSettings(value: unknown): DisplaySettings {
  const parsed = record(value)
  const legacyLayout = parsed.version !== 2
  const rawWidgets = Array.isArray(parsed.widgets) ? parsed.widgets : []
  const widgetIds = new Set<string>()
  const widgets = rawWidgets.map((value, index): DashboardWidget => {
    const widget = record(value)
    const requestedType = text(widget.type) as WidgetType
    const type = widgetTypes.has(requestedType) ? requestedType : 'web'
    const constraints = widgetConstraints[type]
    const requestedId = text(widget.id) || `widget-${index + 1}`
    let id = requestedId
    let suffix = 2
    while (widgetIds.has(id)) {
      id = `${requestedId}-${suffix}`
      suffix += 1
    }
    widgetIds.add(id)

    return {
      id,
      type,
      title: text(widget.title) || `Web-Widget ${index + 1}`,
      url: text(widget.url),
      columns: dimension(widget.columns, constraints.defaultColumns, constraints.minColumns, 24, legacyLayout ? 2 : 1),
      rows: dimension(widget.rows, constraints.defaultRows, constraints.minRows, 8, legacyLayout ? 2 : 1),
    }
  })

  if (!widgets.length && typeof parsed.url === 'string' && parsed.url) {
    widgets.push({
      id: 'widget-1',
      type: 'web',
      title: 'Web-Widget',
      url: parsed.url,
      columns: parsed.size === 'wide' ? 24 : 12,
      rows: parsed.size === 'tall' ? 4 : 2,
    })
  }

  return {
    version: 2,
    location: text(parsed.location) || defaultSettings.location,
    weatherCity: text(parsed.weatherCity),
    widgets,
  }
}

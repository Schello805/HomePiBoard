export type WidgetType = 'web' | 'calendar' | 'text' | 'image' | 'slideshow' | 'waste' | 'media' | 'camera' | 'fitness'

export type HeaderItemType =
  | 'clock'
  | 'date'
  | 'weather'
  | 'location'
  | 'cpu'
  | 'ram'
  | 'uptime'
  | 'network'
  | 'ip'

export const VALID_HEADER_ITEMS = new Set<HeaderItemType>([
  'clock',
  'date',
  'weather',
  'location',
  'cpu',
  'ram',
  'uptime',
  'network',
  'ip',
])

export const DEFAULT_HEADER_ITEMS: HeaderItemType[] = ['network', 'location', 'weather', 'date', 'clock']

export interface HeaderItemMeta {
  id: HeaderItemType
  label: string
  icon: string
  desc: string
}

export const ALL_HEADER_ITEMS_META: HeaderItemMeta[] = [
  { id: 'clock', label: 'Uhrzeit', icon: '⏰', desc: 'Digitale Uhrzeit (z. B. 14:35)' },
  { id: 'date', label: 'Datum', icon: '📅', desc: 'Wochentag & formatiertes Datum' },
  { id: 'weather', label: 'Wetter', icon: '🌤️', desc: 'Lokale Temperatur & Wetterzustand' },
  { id: 'location', label: 'Standort', icon: '📍', desc: 'Display-Name / Ort' },
  { id: 'cpu', label: 'CPU-Temperatur', icon: '🔥', desc: 'Raspberry Pi SoC Temperatur' },
  { id: 'ram', label: 'RAM-Auslastung', icon: '💾', desc: 'Speichernutzung in %' },
  { id: 'uptime', label: 'Laufzeit (Uptime)', icon: '⏱️', desc: 'System-Betriebszeit' },
  { id: 'network', label: 'Netzwerk-Status', icon: '🟢', desc: 'ONLINE / LOKAL Pille' },
  { id: 'ip', label: 'IP-Adresse', icon: '🌐', desc: 'Lokale IPv4-Netzwerkadresse' },
]

export type DateFormat = 'short' | 'medium' | 'long'
export type TimeFormat = '24h' | '12h'

export type DashboardWidget = {
  id: string
  type: WidgetType
  title: string
  url: string
  columns: number
  rows: number
  refreshIntervalMinutes?: number
  intervalSeconds?: number
  breakBefore?: boolean
  showTitle?: boolean
  wasteItems?: string
  mediaTitle?: string
  mediaArtist?: string
  mediaAlbum?: string
  mediaCoverUrl?: string
  mediaPlaying?: boolean
  // Camera widget fields
  cameraUrl?: string
  cameraRefreshSeconds?: number
  cameraFit?: 'cover' | 'contain'
  cameraType?: 'snapshot' | 'mjpeg' | 'stream'
  // Apple Health / Fitness widget fields
  userName?: string
  userAvatar?: string
  moveCalories?: number
  moveGoal?: number
  exerciseMinutes?: number
  exerciseGoal?: number
  standHours?: number
  standGoal?: number
  steps?: number
  distanceKm?: number
  heartRate?: number
  healthToken?: string
  lastSync?: number
}

export type DisplaySettings = {
  version: 3
  location: string
  weatherCity: string
  timezone?: string
  locale?: string
  dateFormat?: DateFormat
  timeFormat?: TimeFormat
  showSeconds?: boolean
  showWeekday?: boolean
  displayScale?: number
  hideCursor?: boolean
  nightModeEnabled?: boolean
  nightModeStart?: string
  nightModeEnd?: string
  nightModeStyle?: 'dim' | 'clock'
  pixelShiftEnabled?: boolean
  notificationSoundEnabled?: boolean
  notificationSoundVolume?: number
  audioOutput?: 'hdmi' | 'jack'
  headerItems?: HeaderItemType[]
  widgets: DashboardWidget[]
}

export type DisplayPreset = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  settings: DisplaySettings
}

export const GRID_COLUMNS = 24
export const GRID_ROWS = 14
export const MAX_WIDGET_COLUMNS = GRID_COLUMNS * 100
export const MAX_WIDGET_ROWS = GRID_ROWS * 100
export const SETTINGS_VERSION = 3

const VERSION_1_COLUMNS = 12
const VERSION_1_ROWS = 4
const VERSION_2_ROWS = 8

export const defaultSettings: DisplaySettings = {
  version: SETTINGS_VERSION,
  location: 'Zuhause',
  weatherCity: '',
  timezone: 'auto',
  locale: 'de-DE',
  dateFormat: 'medium',
  timeFormat: '24h',
  showSeconds: false,
  showWeekday: true,
  displayScale: 100,
  hideCursor: true,
  nightModeEnabled: false,
  nightModeStart: '22:30',
  nightModeEnd: '06:30',
  nightModeStyle: 'dim',
  pixelShiftEnabled: true,
  notificationSoundEnabled: true,
  notificationSoundVolume: 80,
  audioOutput: 'hdmi',
  headerItems: [...DEFAULT_HEADER_ITEMS],
  widgets: [],
}

const widgetTypes = new Set<WidgetType>(['web', 'calendar', 'text', 'image', 'slideshow', 'waste', 'media', 'camera', 'fitness'])

export const widgetConstraints: Record<WidgetType, { minColumns: number; minRows: number; defaultColumns: number; defaultRows: number }> = {
  web: { minColumns: 4, minRows: 2, defaultColumns: 12, defaultRows: 3 },
  calendar: { minColumns: 6, minRows: 5, defaultColumns: 8, defaultRows: 5 },
  text: { minColumns: 4, minRows: 2, defaultColumns: 8, defaultRows: 3 },
  image: { minColumns: 4, minRows: 2, defaultColumns: 8, defaultRows: 3 },
  slideshow: { minColumns: 4, minRows: 2, defaultColumns: 8, defaultRows: 3 },
  waste: { minColumns: 4, minRows: 2, defaultColumns: 8, defaultRows: 3 },
  media: { minColumns: 4, minRows: 2, defaultColumns: 8, defaultRows: 3 },
  camera: { minColumns: 4, minRows: 3, defaultColumns: 8, defaultRows: 4 },
  fitness: { minColumns: 4, minRows: 4, defaultColumns: 6, defaultRows: 5 },
}

const widgetTitles: Record<WidgetType, string> = {
  web: 'Web-Widget',
  calendar: 'Kalender',
  text: 'Notiz',
  image: 'Bild',
  slideshow: 'Diashow',
  waste: 'Müllkalender',
  media: 'Radio',
  camera: 'Kamera',
  fitness: 'Fitness-Ringe',
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function dimension(value: unknown, fallback: number, minimum: number, maximum: number, multiplier = 1, round: (value: number) => number = Math.round) {
  return Math.max(minimum, Math.min(maximum, round((Number(value) || fallback) * multiplier)))
}

export function createWidget(type: WidgetType, index: number, id = `widget-${index}`): DashboardWidget {
  const constraints = widgetConstraints[type]
  const widget: DashboardWidget = {
    id,
    type,
    title: widgetTitles[type],
    url: '',
    columns: constraints.defaultColumns,
    rows: constraints.defaultRows,
  }
  if (type === 'slideshow') {
    widget.intervalSeconds = 8
  } else if (type === 'waste') {
    widget.wasteItems = 'Morgen: Gelber Sack\nMontag: Restmüll\n15.10.: Papiertonne\n22.10.: Biomüll'
  } else if (type === 'media') {
    widget.title = '1LIVE'
    widget.url = 'https://wdr-1live-live.icecastssl.wdr.de/wdr/1live/live/mp3/128/stream.mp3'
    widget.mediaTitle = '1LIVE'
    widget.mediaArtist = 'WDR - Eins Live'
    widget.mediaPlaying = false
  } else if (type === 'camera') {
    widget.title = 'Garten-Kamera'
    widget.cameraUrl = 'https://images.unsplash.com/photo-1508873696983-2df5293cb395?w=800&q=80'
    widget.cameraRefreshSeconds = 5
    widget.cameraType = 'snapshot'
    widget.cameraFit = 'cover'
  } else if (type === 'fitness') {
    widget.title = 'Michael'
    widget.userName = 'Michael'
    widget.userAvatar = '🏃'
    widget.moveCalories = 480
    widget.moveGoal = 500
    widget.exerciseMinutes = 35
    widget.exerciseGoal = 30
    widget.standHours = 9
    widget.standGoal = 12
    widget.steps = 7650
    widget.distanceKm = 5.4
    widget.heartRate = 72
    widget.healthToken = `user-${index}`
    widget.lastSync = Date.now()
  }
  return widget
}

function placeWidgets(widgets: Array<{ columns: number; rows: number }>, gridColumns: number, gridRows: number) {
  const grid = Array.from({ length: gridRows }, () => Array<boolean>(gridColumns).fill(false))
  const placements: Array<{ column: number; row: number }> = []

  for (const widget of widgets) {
    let placed = false
    for (let row = 0; row <= gridRows - widget.rows && !placed; row += 1) {
      for (let column = 0; column <= gridColumns - widget.columns && !placed; column += 1) {
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
        placements.push({ column, row })
        placed = true
      }
    }
    if (!placed) return null
  }

  return placements
}

export function layoutFits(widgets: DashboardWidget[]) {
  return widgets.every((widget) => (
    Number.isInteger(widget.columns)
    && Number.isInteger(widget.rows)
    && widget.columns >= 1
    && widget.rows >= 1
    && widget.columns <= MAX_WIDGET_COLUMNS
    && widget.rows <= MAX_WIDGET_ROWS
  ))
}

export function normalizeSettings(value: unknown): DisplaySettings {
  const parsed = record(value)
  const sourceVersion = Number(parsed.version)
  const legacyLayout = !Number.isFinite(sourceVersion) || sourceVersion < 2
  const columnMultiplier = legacyLayout ? GRID_COLUMNS / VERSION_1_COLUMNS : 1
  const rowMultiplier = legacyLayout
    ? GRID_ROWS / VERSION_1_ROWS
    : sourceVersion === 2
      ? GRID_ROWS / VERSION_2_ROWS
      : 1
  const rawWidgets = Array.isArray(parsed.widgets) ? parsed.widgets : []
  const migratesLayout = legacyLayout || sourceVersion === 2
  const sourceColumns = legacyLayout ? VERSION_1_COLUMNS : GRID_COLUMNS
  const sourceRows = legacyLayout ? VERSION_1_ROWS : VERSION_2_ROWS
  const sourceWidgets = migratesLayout ? rawWidgets.map((value) => {
    const widget = record(value)
    const requestedType = text(widget.type) as WidgetType
    const type = widgetTypes.has(requestedType) ? requestedType : 'web'
    const constraints = widgetConstraints[type]
    return {
      columns: dimension(widget.columns, Math.max(1, Math.round(constraints.defaultColumns / columnMultiplier)), 1, sourceColumns),
      rows: dimension(widget.rows, Math.max(1, Math.round(constraints.defaultRows / rowMultiplier)), 1, sourceRows),
    }
  }) : []
  const sourcePlacements = migratesLayout ? placeWidgets(sourceWidgets, sourceColumns, sourceRows) : null
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

    const sourcePlacement = sourcePlacements?.[index]
    const sourceWidget = sourceWidgets[index]
    const maximumColumns = migratesLayout ? GRID_COLUMNS : MAX_WIDGET_COLUMNS
    const maximumRows = migratesLayout ? GRID_ROWS : MAX_WIDGET_ROWS
    const boundaryScaledRows = sourcePlacement && sourceWidget
      ? Math.round((sourcePlacement.row + sourceWidget.rows) * rowMultiplier) - Math.round(sourcePlacement.row * rowMultiplier)
      : null

    const rawRefresh = Number(widget.refreshIntervalMinutes)
    const refreshIntervalMinutes = type === 'web' && Number.isFinite(rawRefresh) && rawRefresh > 0
      ? Math.max(1, Math.min(1440, Math.round(rawRefresh)))
      : undefined

    const rawInterval = Number(widget.intervalSeconds)
    const intervalSeconds = type === 'slideshow'
      ? (Number.isFinite(rawInterval) && rawInterval > 0 ? Math.max(2, Math.min(3600, Math.round(rawInterval))) : 8)
      : undefined

    const breakBefore = Boolean(widget.breakBefore)
    const showTitle = Boolean(widget.showTitle)

    return {
      id,
      type,
      title: text(widget.title) || `${widgetTitles[type]} ${index + 1}`,
      url: text(widget.url),
      columns: dimension(widget.columns, constraints.defaultColumns, constraints.minColumns, maximumColumns, columnMultiplier),
      rows: boundaryScaledRows === null
        ? dimension(widget.rows, constraints.defaultRows, constraints.minRows, maximumRows, rowMultiplier, migratesLayout ? Math.floor : Math.round)
        : Math.max(constraints.minRows, Math.min(GRID_ROWS, boundaryScaledRows)),
      ...(refreshIntervalMinutes !== undefined ? { refreshIntervalMinutes } : {}),
      ...(intervalSeconds !== undefined ? { intervalSeconds } : {}),
      ...(breakBefore ? { breakBefore: true } : {}),
      ...(showTitle ? { showTitle: true } : {}),
      ...(type === 'waste' && typeof widget.wasteItems === 'string' ? { wasteItems: widget.wasteItems } : {}),
      ...(type === 'media' ? {
        mediaTitle: text(widget.mediaTitle, 'Keine Wiedergabe'),
        mediaArtist: text(widget.mediaArtist, 'Bereit'),
        mediaAlbum: text(widget.mediaAlbum),
        mediaCoverUrl: text(widget.mediaCoverUrl),
        mediaPlaying: Boolean(widget.mediaPlaying),
      } : {}),
      ...(type === 'camera' ? {
        cameraUrl: text(widget.cameraUrl || widget.url),
        cameraRefreshSeconds: Number.isFinite(Number(widget.cameraRefreshSeconds)) && Number(widget.cameraRefreshSeconds) > 0
          ? Math.max(1, Math.min(3600, Math.round(Number(widget.cameraRefreshSeconds))))
          : 5,
        cameraFit: widget.cameraFit === 'contain' ? 'contain' : 'cover',
        cameraType: widget.cameraType === 'mjpeg' ? 'mjpeg' : (widget.cameraType === 'stream' ? 'stream' : 'snapshot'),
      } : {}),
      ...(type === 'fitness' ? {
        userName: text(widget.userName, text(widget.title, 'Sportler')),
        userAvatar: text(widget.userAvatar, '🏃'),
        moveCalories: Number.isFinite(Number(widget.moveCalories)) ? Math.max(0, Math.round(Number(widget.moveCalories))) : 0,
        moveGoal: Number.isFinite(Number(widget.moveGoal)) && Number(widget.moveGoal) > 0 ? Math.round(Number(widget.moveGoal)) : 500,
        exerciseMinutes: Number.isFinite(Number(widget.exerciseMinutes)) ? Math.max(0, Math.round(Number(widget.exerciseMinutes))) : 0,
        exerciseGoal: Number.isFinite(Number(widget.exerciseGoal)) && Number(widget.exerciseGoal) > 0 ? Math.round(Number(widget.exerciseGoal)) : 30,
        standHours: Number.isFinite(Number(widget.standHours)) ? Math.max(0, Math.round(Number(widget.standHours))) : 0,
        standGoal: Number.isFinite(Number(widget.standGoal)) && Number(widget.standGoal) > 0 ? Math.round(Number(widget.standGoal)) : 12,
        steps: Number.isFinite(Number(widget.steps)) ? Math.max(0, Math.round(Number(widget.steps))) : 0,
        distanceKm: Number.isFinite(Number(widget.distanceKm)) ? Math.max(0, Math.round(Number(widget.distanceKm) * 10) / 10) : 0,
        heartRate: Number.isFinite(Number(widget.heartRate)) ? Math.max(0, Math.round(Number(widget.heartRate))) : 0,
        healthToken: text(widget.healthToken, id),
        lastSync: Number.isFinite(Number(widget.lastSync)) ? Number(widget.lastSync) : Date.now(),
      } : {}),
    }
  })

  if (!widgets.length && typeof parsed.url === 'string' && parsed.url) {
    widgets.push({
      id: 'widget-1',
      type: 'web',
      title: 'Web-Widget',
      url: parsed.url,
      columns: parsed.size === 'wide' ? GRID_COLUMNS : 12,
      rows: Math.round((parsed.size === 'tall' ? 4 : 2) * GRID_ROWS / VERSION_2_ROWS),
    })
  }

  const timezone = typeof parsed.timezone === 'string' && parsed.timezone.trim() ? parsed.timezone.trim().slice(0, 50) : defaultSettings.timezone
  const locale = typeof parsed.locale === 'string' && parsed.locale.trim() ? parsed.locale.trim().slice(0, 20) : defaultSettings.locale
  const dateFormat: DateFormat = parsed.dateFormat === 'short' || parsed.dateFormat === 'long' ? parsed.dateFormat : 'medium'
  const timeFormat: TimeFormat = parsed.timeFormat === '12h' ? '12h' : '24h'
  const showSeconds = typeof parsed.showSeconds === 'boolean' ? parsed.showSeconds : defaultSettings.showSeconds
  const showWeekday = typeof parsed.showWeekday === 'boolean' ? parsed.showWeekday : defaultSettings.showWeekday
  const rawScale = Number(parsed.displayScale)
  const displayScale = Number.isFinite(rawScale) && rawScale >= 50 && rawScale <= 200 ? Math.round(rawScale) : defaultSettings.displayScale
  const hideCursor = typeof parsed.hideCursor === 'boolean' ? parsed.hideCursor : defaultSettings.hideCursor
  const nightModeEnabled = typeof parsed.nightModeEnabled === 'boolean' ? parsed.nightModeEnabled : defaultSettings.nightModeEnabled
  const nightModeStart = typeof parsed.nightModeStart === 'string' && /^\d{1,2}:\d{2}$/.test(parsed.nightModeStart.trim()) ? parsed.nightModeStart.trim() : defaultSettings.nightModeStart
  const nightModeEnd = typeof parsed.nightModeEnd === 'string' && /^\d{1,2}:\d{2}$/.test(parsed.nightModeEnd.trim()) ? parsed.nightModeEnd.trim() : defaultSettings.nightModeEnd
  const nightModeStyle = parsed.nightModeStyle === 'clock' ? 'clock' : 'dim'
  const pixelShiftEnabled = typeof parsed.pixelShiftEnabled === 'boolean' ? parsed.pixelShiftEnabled : defaultSettings.pixelShiftEnabled
  const notificationSoundEnabled = typeof parsed.notificationSoundEnabled === 'boolean' ? parsed.notificationSoundEnabled : defaultSettings.notificationSoundEnabled
  const rawVolume = Number(parsed.notificationSoundVolume)
  const notificationSoundVolume = Number.isFinite(rawVolume) ? Math.max(0, Math.min(100, Math.round(rawVolume))) : defaultSettings.notificationSoundVolume
  const audioOutput = parsed.audioOutput === 'jack' ? 'jack' : 'hdmi'
  const rawHeaderItems = Array.isArray(parsed.headerItems) ? parsed.headerItems : null
  const headerItems: HeaderItemType[] = rawHeaderItems !== null
    ? rawHeaderItems.filter((item): item is HeaderItemType => typeof item === 'string' && VALID_HEADER_ITEMS.has(item as HeaderItemType))
    : [...DEFAULT_HEADER_ITEMS]

  return {
    version: SETTINGS_VERSION,
    location: text(parsed.location) || defaultSettings.location,
    weatherCity: text(parsed.weatherCity),
    timezone,
    locale,
    dateFormat,
    timeFormat,
    showSeconds,
    showWeekday,
    displayScale,
    hideCursor,
    nightModeEnabled,
    nightModeStart,
    nightModeEnd,
    nightModeStyle,
    pixelShiftEnabled,
    notificationSoundEnabled,
    notificationSoundVolume,
    audioOutput,
    headerItems,
    widgets,
  }
}

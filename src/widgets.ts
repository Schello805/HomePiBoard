import { calendarMarkup, escapeHtml } from './dashboard-utils.ts'
import type { CalendarFeedEvent } from './calendar-feed.ts'
import type { DashboardWidget, WidgetType } from './settings.ts'

const typeLabels: Record<WidgetType, string> = {
  web: 'WEB',
  calendar: 'KALENDER',
  text: 'TEXT',
  image: 'BILD',
  slideshow: 'DIASHOW',
  waste: 'MÜLL',
  media: 'RADIO',
  camera: 'KAMERA',
  fitness: 'FITNESS',
}

export interface RadioStationPreset {
  id: string
  name: string
  slogan: string
  streamUrl: string
  category: string
}

export const GERMAN_RADIO_STATIONS: RadioStationPreset[] = [
  { id: '1live', name: '1LIVE', slogan: 'WDR - Eins Live', streamUrl: 'https://wdr-1live-live.icecastssl.wdr.de/wdr/1live/live/mp3/128/stream.mp3', category: 'WDR' },
  { id: 'wdr2', name: 'WDR 2', slogan: 'WDR - Pop & Information', streamUrl: 'https://wdr-wdr2-koeln.icecastssl.wdr.de/wdr/wdr2/koeln/mp3/128/stream.mp3', category: 'WDR' },
  { id: 'swr3', name: 'SWR3', slogan: 'SWR - Mehr Hits, mehr Kicks', streamUrl: 'https://liveradio.swr.de/sw282p3/swr3/mp3/128/stream.mp3', category: 'SWR' },
  { id: 'bayern3', name: 'Bayern 3', slogan: 'BR - Hits und Bayern', streamUrl: 'https://dispatcher.rndfnk.com/br/br3/live/mp3/mid', category: 'BR' },
  { id: 'antenne-bayern', name: 'ANTENNE BAYERN', slogan: 'Bayerns bester Musikmix', streamUrl: 'https://stream.antenne.de/antenne', category: 'Privat' },
  { id: 'ndr2', name: 'NDR 2', slogan: 'NDR - Genau meine Musik', streamUrl: 'https://icecast.ndr.de/ndr/ndr2/hamburg/mp3/128/stream.mp3', category: 'NDR' },
  { id: 'dlf', name: 'Deutschlandfunk', slogan: 'Nachrichten, Politik & Kultur', streamUrl: 'https://st01.sslstream.dlf.de/dlf/01/128/mp3/stream.mp3', category: 'Dlf' },
  { id: 'radiobob', name: 'RADIO BOB!', slogan: 'BOBs Rock\'n Roll Radio', streamUrl: 'https://streams.radiobob.de/bob-live/mp3-192/streams.radiobob.de/', category: 'Rock' },
  { id: 'rockantenne', name: 'ROCK ANTENNE', slogan: 'Der beste Rock nonstop', streamUrl: 'https://stream.rockantenne.de/rockantenne/stream/mp3', category: 'Rock' },
  { id: 'sunshine-live', name: 'sunshine live', slogan: 'Electronic Music Radio', streamUrl: 'https://stream.sunshine-live.de/live/mp3-192/stream.sunshine-live.de/', category: 'Electro' },
  { id: 'bigfm', name: 'bigFM', slogan: 'Deutschlands meiste neue Musik', streamUrl: 'https://stream.bigfm.de/bigfm-deutschland/mp3-128/', category: 'Charts' },
  { id: 'ffh', name: 'Hit Radio FFH', slogan: 'Einfach näher dran', streamUrl: 'https://mp3.ffh.de/radioffh/hqlivestream.mp3', category: 'Privat' },
  { id: 'mdr-jump', name: 'MDR JUMP', slogan: 'MDR - Im Osten zuhause', streamUrl: 'https://mdr-284320-0.sslstream.dlf.de/mdr/jump/live/mp3/128/stream.mp3', category: 'MDR' },
  { id: 'njoy', name: 'N-JOY', slogan: 'NDR - Enjoy the Music', streamUrl: 'https://icecast.ndr.de/ndr/njoy/live/mp3/128/stream.mp3', category: 'NDR' },
  { id: '80s80s', name: '80s80s Radio', slogan: 'Real 80s - Real Music', streamUrl: 'https://streams.80s80s.de/web/mp3-192/', category: 'Retro' },
  { id: 'custom', name: 'Eigener Webstream', slogan: 'Benutzerdefinierte Stream-URL', streamUrl: '', category: 'Benutzerdefiniert' },
]

export interface ParsedWasteItem {
  name: string
  date: string
  color: string
  icon: string
  badgeText: string
  isUrgent: boolean
}

export function renderWheelieBinSvg(color: string): string {
  return `<svg class="waste-wheelie-bin" viewBox="0 0 28 34" width="28" height="34" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="6" cy="29" r="3.5" fill="#171923" stroke="#4a5568" stroke-width="1.2"/><circle cx="22" cy="29" r="3.5" fill="#171923" stroke="#4a5568" stroke-width="1.2"/><circle cx="6" cy="29" r="1.2" fill="#a0aec0"/><circle cx="22" cy="29" r="1.2" fill="#a0aec0"/><path d="M5.5 9.5H22.5L20.5 28.5C20.4 29.6 19.5 30.5 18.4 30.5H9.6C8.5 30.5 7.6 29.6 7.5 28.5L5.5 9.5Z" fill="${escapeHtml(color)}" stroke="rgba(0,0,0,0.35)" stroke-width="1"/><path d="M10 13V26M14 13V26M18 13V26" stroke="rgba(0,0,0,0.22)" stroke-width="1.2" stroke-linecap="round"/><path d="M10.7 13V26M14.7 13V26M18.7 13V26" stroke="rgba(255,255,255,0.18)" stroke-width="0.8" stroke-linecap="round"/><path d="M3.5 8.5H5.5" stroke="#2d3748" stroke-width="2" stroke-linecap="round"/><rect x="3.5" y="6" width="21" height="3.5" rx="1.5" fill="${escapeHtml(color)}" stroke="rgba(0,0,0,0.4)" stroke-width="1"/><path d="M11 3.5C11 2.7 11.7 2 12.5 2H15.5C16.3 2 17 2.7 17 3.5V6H11V3.5Z" fill="${escapeHtml(color)}" stroke="rgba(0,0,0,0.3)" stroke-width="0.8"/></svg>`
}

function looksLikeDate(text: string): boolean {
  const trimmed = text.trim().toLowerCase()
  if (!trimmed) return false
  if (/^(heute|morgen|übermorgen|in \d+|nächste|naechste)\b/i.test(trimmed)) return true
  if (/^(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|mo|di|mi|do|fr|sa|so)\b/i.test(trimmed)) return true
  if (/^\d{1,2}\.\d{1,2}/.test(trimmed)) return true
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return true
  if (/\b(tage|tagen|woche|wochen)\b/i.test(trimmed)) return true
  return false
}

function hasWasteKeyword(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes('müll') ||
    lower.includes('muell') ||
    lower.includes('tonne') ||
    lower.includes('sack') ||
    lower.includes('abfall') ||
    lower.includes('abfuhr') ||
    lower.includes('papier') ||
    lower.includes('pappe') ||
    lower.includes('karton') ||
    lower.includes('bio') ||
    lower.includes('grün') ||
    lower.includes('gruen') ||
    lower.includes('kompost') ||
    lower.includes('gelb') ||
    lower.includes('wertstoff') ||
    lower.includes('plastik') ||
    lower.includes('glas') ||
    lower.includes('rest') ||
    lower.includes('sperr') ||
    lower.includes('schad') ||
    lower.includes('problem') ||
    lower.includes('dual')
  )
}

export function parseWasteItems(raw: string | undefined, now = new Date()): ParsedWasteItem[] {
  const content = (raw && raw.trim()) ? raw : 'Restmüll: In 2 Tagen\nBiomüll: Donnerstag\nGelber Sack: Nächste Woche\nPapiermüll: In 10 Tagen'
  const lines = content.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean)

  return lines.map((line) => {
    let name = line
    let date = ''
    let customColor = ''

    if (line.includes('|')) {
      const parts = line.split('|')
      line = parts[0]!.trim()
      customColor = parts[1]!.trim()
    }

    const colonIndex = line.lastIndexOf(':')
    if (colonIndex !== -1) {
      const part1 = line.slice(0, colonIndex).trim()
      const part2 = line.slice(colonIndex + 1).trim()

      if ((looksLikeDate(part1) && !looksLikeDate(part2)) || (hasWasteKeyword(part2) && !hasWasteKeyword(part1))) {
        name = part2
        date = part1
      } else {
        name = part1
        date = part2
      }
    }

    const lower = name.toLowerCase()
    let color = customColor
    let icon = ''

    if (lower.includes('tannen') || lower.includes('weihnacht')) {
      if (!color) color = '#38a169'
      icon = '🎄'
    } else if (lower.includes('sperr')) {
      if (!color) color = '#805ad5'
      icon = '🛋️'
    } else if (lower.includes('schad') || lower.includes('problem') || lower.includes('gift') || lower.includes('gefahr')) {
      if (!color) color = '#e53e3e'
      icon = '⚠️'
    } else if (lower.includes('bio') || lower.includes('grün') || lower.includes('kompost') || lower.includes('garten') || lower.includes('braun')) {
      if (!color) color = lower.includes('braun') ? '#8c5843' : '#38a169'
      icon = renderWheelieBinSvg(color)
    } else if (lower.includes('gelb') || lower.includes('wertstoff') || lower.includes('plastik') || lower.includes('sack') || lower.includes('dual')) {
      if (!color) color = '#eab308'
      icon = renderWheelieBinSvg(color)
    } else if (lower.includes('papier') || lower.includes('blau') || lower.includes('pappe') || lower.includes('karton')) {
      if (!color) color = '#3182ce'
      icon = renderWheelieBinSvg(color)
    } else if (lower.includes('glas')) {
      if (!color) color = '#319795'
      icon = renderWheelieBinSvg(color)
    } else {
      // Standard: Restmüll / Schwarze Tonne
      if (!color) color = '#374151'
      icon = renderWheelieBinSvg(color)
    }

    let badgeText = date || 'Geplant'
    let isUrgent = false
    const lowerDate = date.toLowerCase()
    if (lowerDate.includes('heute') || lowerDate.includes('morgen') || lowerDate === '1 tag' || lowerDate === 'in 1 tag') {
      isUrgent = true
      if (lowerDate.includes('heute')) badgeText = 'Heute!'
      else if (lowerDate.includes('morgen') && !lowerDate.includes('übermorgen')) badgeText = 'Morgen!'
    }

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    // 1. ISO-Datum: YYYY-MM-DD
    const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
      const target = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
      const diffDays = Math.round((target.getTime() - startOfToday) / (1000 * 60 * 60 * 24))
      if (diffDays < 0) {
        badgeText = 'Vorüber'
      } else if (diffDays === 0) {
        badgeText = 'Heute!'
        isUrgent = true
      } else if (diffDays === 1) {
        badgeText = 'Morgen!'
        isUrgent = true
      } else if (diffDays > 1 && diffDays <= 7) {
        badgeText = `In ${diffDays} Tagen`
      } else if (diffDays > 7) {
        badgeText = `In ${diffDays} Tagen`
      }
    }

    // 2. Deutsches Datumsformat: DD.MM. oder DD.MM.YYYY
    const germanMatch = date.match(/^(\d{1,2})\.(\d{1,2})\.?(?:(\d{4}))?$/)
    if (germanMatch) {
      const day = Number(germanMatch[1])
      const month = Number(germanMatch[2]) - 1
      const year = germanMatch[3] ? Number(germanMatch[3]) : now.getFullYear()
      const target = new Date(year, month, day)
      let diffDays = Math.round((target.getTime() - startOfToday) / (1000 * 60 * 60 * 24))
      if (diffDays < -30 && !germanMatch[3]) {
        target.setFullYear(year + 1)
        diffDays = Math.round((target.getTime() - startOfToday) / (1000 * 60 * 60 * 24))
      }
      if (diffDays < 0) {
        badgeText = 'Vorüber'
      } else if (diffDays === 0) {
        badgeText = 'Heute!'
        isUrgent = true
      } else if (diffDays === 1) {
        badgeText = 'Morgen!'
        isUrgent = true
      } else if (diffDays > 1 && diffDays <= 7) {
        badgeText = `In ${diffDays} Tagen`
      } else if (diffDays > 7) {
        badgeText = `In ${diffDays} Tagen`
      }
    }

    // 3. Wochentage: Montag, Dienstag, ...
    const weekdayMap: Record<string, number> = {
      sonntag: 0, so: 0,
      montag: 1, mo: 1,
      dienstag: 2, di: 2,
      mittwoch: 3, mi: 3,
      donnerstag: 4, do: 4,
      freitag: 5, fr: 5,
      samstag: 6, sa: 6,
    }
    const cleanWeekday = lowerDate.replace(/[^a-zäöü]/g, '')
    if (cleanWeekday in weekdayMap) {
      const targetDay = weekdayMap[cleanWeekday]!
      const currentDay = now.getDay()
      const diffDays = (targetDay - currentDay + 7) % 7
      if (diffDays === 0) {
        badgeText = 'Heute!'
        isUrgent = true
      } else if (diffDays === 1) {
        badgeText = 'Morgen!'
        isUrgent = true
      } else {
        badgeText = `In ${diffDays} Tagen`
      }
    }

    return { name, date, color, icon, badgeText, isUrgent }
  })
}

export function isWasteCalendarFeed(widget: DashboardWidget): boolean {
  if (widget.type !== 'waste') return false
  const url = (widget.url || '').trim()
  return /^https?:\/\//i.test(url) || /^webcal:\/\//i.test(url)
}

export function renderWasteItemsHtml(items: ParsedWasteItem[]): string {
  if (!items.length) {
    return '<div class="calendar-feed-empty" role="status">Keine anstehenden Termine eingetragen.</div>'
  }
  return items.map((item) => `
    <div class="waste-item ${item.isUrgent ? 'is-urgent' : ''}" style="--bin-color: ${escapeHtml(item.color)}">
      <div class="waste-bin-icon" aria-hidden="true">${item.icon}</div>
      <div class="waste-details">
        <strong class="waste-label">${escapeHtml(item.name)}</strong>
        <span class="waste-date-text">${escapeHtml(item.date)}</span>
      </div>
      <span class="waste-badge">${escapeHtml(item.badgeText)}</span>
    </div>
  `).join('')
}

export function renderWasteEvents(events: CalendarFeedEvent[], now = new Date()): string {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const upcoming = events
    .filter((event) => {
      const time = new Date(event.end || event.start).getTime()
      return time >= startOfToday
    })
    .slice(0, 10)

  if (!upcoming.length) {
    return '<div class="calendar-feed-empty" role="status">Keine anstehenden Müllabfuhren gefunden.</div>'
  }

  const lines = upcoming.map((e) => `${e.summary.replace(/[:|]/g, ' - ')}: ${e.start.slice(0, 10)}`).join('\n')
  const items = parseWasteItems(lines, now)
  return renderWasteItemsHtml(items)
}

export function wasteContent(widget: DashboardWidget) {
  if (isWasteCalendarFeed(widget)) {
    const cachedItems = widget.wasteItems ? renderWasteItemsHtml(parseWasteItems(widget.wasteItems)) : ''
    return `<div class="waste-widget-container" data-waste-feed data-waste-widget-id="${escapeHtml(widget.id)}">${cachedItems || '<div class="waste-loading-status" role="status"><span class="loading-spinner" aria-hidden="true"></span> <span>Müllkalender-Abo wird geladen …</span></div>'}</div>`
  }
  const items = parseWasteItems(widget.wasteItems)
  return `<div class="waste-widget-container" data-waste-widget>${renderWasteItemsHtml(items)}</div>`
}

export function mediaContent(widget: DashboardWidget) {
  const streamUrl = safeResourceUrl(widget.url || '', 'web') || (widget.url ? widget.url.trim() : '')
  const title = (widget.mediaTitle ?? (widget.title && widget.title !== 'Radio' && widget.title !== 'Now Playing' ? widget.title : '1LIVE')).trim() || '1LIVE'
  const artist = (widget.mediaArtist ?? 'Live Webradio').trim() || 'Live Webradio'
  const album = (widget.mediaAlbum ?? '').trim()
  const coverUrl = safeResourceUrl(widget.mediaCoverUrl ?? '', 'image')
  const isPlaying = widget.mediaPlaying !== false && title !== 'Keine Wiedergabe'

  return `<div class="media-widget-container ${isPlaying ? 'is-playing' : 'is-paused'}" data-media-widget data-stream-url="${escapeHtml(streamUrl)}">
    <div class="media-cover-wrapper" data-action="toggle-play" role="button" tabindex="0" title="${isPlaying ? 'Wiedergabe pausieren' : 'Wiedergabe starten'}" aria-label="Wiedergabe umschalten">
      ${coverUrl ? `<img class="media-cover" src="${escapeHtml(coverUrl)}" alt="Cover" />` : `
      <div class="media-cover-radio" aria-hidden="true">
        <svg class="media-radio-icon" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path>
          <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path>
          <circle cx="12" cy="12" r="2"></circle>
          <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path>
          <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"></path>
        </svg>
      </div>`}
      <button type="button" class="media-badge-status media-play-btn" data-action="toggle-play" aria-label="Wiedergabe umschalten" title="Wiedergabe starten/stoppen">
        <span class="media-play-icon" aria-hidden="true">${isPlaying ? '⏸' : '▶'}</span>
      </button>
    </div>
    <div class="media-info">
      <div class="media-header-tag">
        <span class="media-live-badge"><span class="media-live-dot"></span> LIVE RADIO</span>
        <span class="media-status-text" data-media-status>${isPlaying ? 'Auf Sendung' : 'Bereit'}</span>
        <span class="media-time-badge" data-media-duration title="Sendezeit / Wiedergabedauer">00:00</span>
      </div>
      <strong class="media-title" data-media-field="title">${escapeHtml(title)}</strong>
      <span class="media-artist" data-media-field="artist">${escapeHtml(artist)}</span>
      ${album ? `<span class="media-album" data-media-field="album">${escapeHtml(album)}</span>` : ''}
      <div class="media-controls-row">
        <div class="media-equalizer-bars ${isPlaying ? 'is-animated' : ''}" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="media-volume-control" title="Lautstärke anpassen">
          <span class="media-volume-icon" role="button" tabindex="0" title="Stummschalten / Ton an" aria-label="Stummschalten">🔊</span>
          <input type="range" class="media-volume-slider" data-action="volume-slider" min="0" max="1" step="0.05" value="0.8" aria-label="Lautstärke" />
          <span class="media-volume-val" data-media-volume-val>80%</span>
        </div>
      </div>
    </div>
    ${streamUrl ? `<audio preload="auto" playsinline data-media-audio src="${escapeHtml(streamUrl)}"></audio>` : ''}
  </div>`
}

function safeResourceUrl(value: string, type: WidgetType) {
  const url = value.trim()
  if (!url) return ''
  if ((type === 'image' || type === 'slideshow' || type === 'camera') && /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);/i.test(url)) return url

  try {
    const parsed = new URL(url, 'https://homepiboard.local')
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

export function parseSlideshowUrls(content: string): string[] {
  return content
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function frameContent(widget: DashboardWidget) {
  const url = safeResourceUrl(widget.url, widget.type)
  if (url === null) return '<span class="placeholder-icon">!</span><strong>URL nicht erlaubt</strong><span>Bitte HTTP oder HTTPS verwenden.</span>'
  if (!url) return '<span class="placeholder-icon">↗</span><strong>URL fehlt</strong><span>Webseiten-URL eintragen</span>'

  const refreshAttr = widget.refreshIntervalMinutes && widget.refreshIntervalMinutes > 0
    ? ` data-refresh-interval="${widget.refreshIntervalMinutes}"`
    : ''

  return `<div class="frame-container"${refreshAttr}><iframe data-widget-frame src="${escapeHtml(url)}" title="${escapeHtml(widget.title)}" loading="lazy" scrolling="no" referrerpolicy="no-referrer" sandbox="allow-forms allow-popups allow-same-origin allow-scripts"></iframe><div class="frame-status" role="status"><span class="loading-spinner" aria-hidden="true"></span> <span>Widget wird geladen …</span><button type="button" data-reload-frame>Neu laden</button></div></div>`
}

function slideshowContent(widget: DashboardWidget) {
  const rawUrls = parseSlideshowUrls(widget.url)
  const validUrls = rawUrls
    .map((url) => safeResourceUrl(url, 'slideshow'))
    .filter((url): url is string => Boolean(url))

  if (!validUrls.length) {
    return '<span class="placeholder-icon">▨</span><strong>Diashow</strong><span>Bild-URLs eintragen (eine pro Zeile)</span>'
  }

  const interval = widget.intervalSeconds || 8
  const slidesHtml = validUrls.map((url, i) =>
    `<div class="slideshow-slide ${i === 0 ? 'is-active' : ''}" style="background-image: url('${escapeHtml(url)}')"><img class="visually-hidden" src="${escapeHtml(url)}" alt="${escapeHtml(widget.title)} (Bild ${i + 1})" /></div>`
  ).join('')

  const indicatorsHtml = validUrls.length > 1
    ? `<div class="slideshow-indicators">${validUrls.map((_, i) => `<span class="slideshow-dot ${i === 0 ? 'is-active' : ''}"></span>`).join('')}</div>`
    : ''

  return `<div class="slideshow-container" data-slideshow-widget data-slideshow-interval="${interval}">${slidesHtml}${indicatorsHtml}</div>`
}

function calendarFeedContent(widget: DashboardWidget) {
  return `<div class="calendar-feed" data-calendar-feed data-calendar-widget-id="${escapeHtml(widget.id)}"><div class="calendar-feed-status" role="status">Kalender wird geladen …</div></div>`
}

function eventDateLabel(event: CalendarFeedEvent) {
  const start = new Date(event.start)
  if (event.allDay) return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(start)
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(start)
}

export function calendarAgendaMarkup(events: CalendarFeedEvent[], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const upcoming = events
    .filter((event) => new Date(event.end || event.start).getTime() >= startOfToday)
    .slice(0, 40)
  if (!upcoming.length) return '<div class="calendar-feed-empty" role="status">Keine anstehenden Termine.</div>'

  return `<ol class="calendar-agenda">${upcoming.map((event) => `<li class="calendar-agenda-event"><time datetime="${escapeHtml(event.start)}">${escapeHtml(eventDateLabel(event))}</time><div><strong>${escapeHtml(event.summary)}</strong>${event.location ? `<span>${escapeHtml(event.location)}</span>` : ''}</div></li>`).join('')}</ol>`
}

export function isBuiltInCalendar(type: WidgetType, url: string) {
  return type === 'calendar' && !url.trim()
}

export function renderFitnessRingsSvg(movePct: number, exercisePct: number, standPct: number): string {
  const rMove = 40
  const rExercise = 30
  const rStand = 20
  const cMove = 2 * Math.PI * rMove
  const cExercise = 2 * Math.PI * rExercise
  const cStand = 2 * Math.PI * rStand

  const offsetMove = cMove * (1 - Math.min(1, movePct / 100))
  const offsetExercise = cExercise * (1 - Math.min(1, exercisePct / 100))
  const offsetStand = cStand * (1 - Math.min(1, standPct / 100))

  return `
    <svg class="fitness-rings-svg" viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id="move-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fa114f" />
          <stop offset="100%" stop-color="#ff3366" />
        </linearGradient>
        <linearGradient id="exercise-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#a0ff00" />
          <stop offset="100%" stop-color="#65e000" />
        </linearGradient>
        <linearGradient id="stand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00f0ff" />
          <stop offset="100%" stop-color="#00a0ff" />
        </linearGradient>
      </defs>

      <!-- Background tracks -->
      <circle cx="50" cy="50" r="${rMove}" fill="none" stroke="rgba(250, 17, 79, 0.2)" stroke-width="7.5" />
      <circle cx="50" cy="50" r="${rExercise}" fill="none" stroke="rgba(160, 255, 0, 0.2)" stroke-width="7.5" />
      <circle cx="50" cy="50" r="${rStand}" fill="none" stroke="rgba(0, 240, 255, 0.2)" stroke-width="7.5" />

      <!-- Progress rings -->
      <g transform="rotate(-90 50 50)">
        <circle cx="50" cy="50" r="${rMove}" fill="none" stroke="url(#move-grad)" stroke-width="7.5" stroke-linecap="round" stroke-dasharray="${cMove}" stroke-dashoffset="${offsetMove}" />
        <circle cx="50" cy="50" r="${rExercise}" fill="none" stroke="url(#exercise-grad)" stroke-width="7.5" stroke-linecap="round" stroke-dasharray="${cExercise}" stroke-dashoffset="${offsetExercise}" />
        <circle cx="50" cy="50" r="${rStand}" fill="none" stroke="url(#stand-grad)" stroke-width="7.5" stroke-linecap="round" stroke-dasharray="${cStand}" stroke-dashoffset="${offsetStand}" />
      </g>
    </svg>
  `
}

export function cameraContent(widget: DashboardWidget) {
  const cameraUrl = widget.cameraUrl || widget.url || ''
  const safeUrl = safeResourceUrl(cameraUrl, 'camera')
  if (!safeUrl) {
    return `<div class="camera-empty-placeholder">
      <span class="placeholder-icon">📷</span>
      <strong>Keine Kamera-URL hinterlegt</strong>
      <span class="placeholder-sub">Klicke auf ⚙ um Snapshot- oder Stream-URL einzutragen.</span>
    </div>`
  }

  const interval = widget.cameraRefreshSeconds || 5
  const fit = widget.cameraFit === 'contain' ? 'contain' : 'cover'
  const isMjpeg = widget.cameraType === 'mjpeg'
  const isStream = widget.cameraType === 'stream'

  if (isStream) {
    return `<div class="camera-widget-container is-stream" data-camera-widget data-camera-type="stream">
      <iframe class="camera-stream-frame" src="${escapeHtml(safeUrl)}" allow="autoplay; fullscreen" loading="lazy"></iframe>
      <div class="camera-live-badge"><span class="pulse-dot"></span> LIVE</div>
    </div>`
  }

  return `<div class="camera-widget-container" data-camera-widget data-camera-url="${escapeHtml(safeUrl)}" data-camera-interval="${interval}" data-camera-type="${isMjpeg ? 'mjpeg' : 'snapshot'}">
    <img class="camera-snapshot-img" src="${escapeHtml(safeUrl)}" alt="${escapeHtml(widget.title || 'Kamerabild')}" style="object-fit: ${fit};" onerror="this.parentElement.classList.add('is-offline')" onload="this.parentElement.classList.remove('is-offline')" />
    <div class="camera-overlay">
      <div class="camera-live-badge"><span class="pulse-dot"></span> LIVE</div>
      ${!isMjpeg ? `<div class="camera-reload-indicator" title="Wird alle ${interval}s aktualisiert"><span class="reload-dot"></span> ${interval}s</div>` : ''}
    </div>
    <div class="camera-offline-msg">
      <span class="offline-icon">⚠️</span>
      <strong>Kamera nicht erreichbar</strong>
      <span>Verbindung wird alle ${interval}s neu versucht …</span>
    </div>
  </div>`
}

export function fitnessContent(widget: DashboardWidget) {
  const moveCal = widget.moveCalories ?? 480
  const moveGoal = widget.moveGoal ?? 500
  const exerciseMin = widget.exerciseMinutes ?? 35
  const exerciseGoal = widget.exerciseGoal ?? 30
  const standHrs = widget.standHours ?? 9
  const standGoal = widget.standGoal ?? 12
  const steps = widget.steps ?? 7650
  const distanceKm = widget.distanceKm ?? 5.4
  const heartRate = widget.heartRate ?? 72
  const name = widget.userName || widget.title || 'Sportler'
  const avatar = widget.userAvatar || '🏃'
  const token = widget.healthToken || widget.id

  const movePct = Math.round((moveCal / Math.max(1, moveGoal)) * 100)
  const exercisePct = Math.round((exerciseMin / Math.max(1, exerciseGoal)) * 100)
  const standPct = Math.round((standHrs / Math.max(1, standGoal)) * 100)
  const avgScore = Math.round((movePct + exercisePct + standPct) / 3)
  const ringsClosed = (movePct >= 100 ? 1 : 0) + (exercisePct >= 100 ? 1 : 0) + (standPct >= 100 ? 1 : 0)

  return `
    <div class="fitness-widget-card" data-fitness-widget data-user-token="${escapeHtml(token)}">
      <div class="fitness-card-header">
        <div class="fitness-user-badge">
          <span class="fitness-avatar">${escapeHtml(avatar)}</span>
          <strong class="fitness-name">${escapeHtml(name)}</strong>
        </div>
        <div class="fitness-score-tag ${ringsClosed === 3 ? 'is-all-closed' : ''}">
          <span class="score-icon">${ringsClosed === 3 ? '🏆' : '🔥'}</span>
          <span>${avgScore}%</span>
        </div>
      </div>

      <div class="fitness-main-row">
        <div class="fitness-rings-wrap" title="Bewegen: ${movePct}% | Trainieren: ${exercisePct}% | Stehen: ${standPct}%">
          ${renderFitnessRingsSvg(movePct, exercisePct, standPct)}
          <span class="fitness-center-score">${ringsClosed}/3</span>
        </div>

        <div class="fitness-metrics-list">
          <div class="fitness-metric-row metric-move">
            <span class="metric-bullet">●</span>
            <div class="metric-info">
              <span class="metric-label">Bewegen</span>
              <strong class="metric-val">${moveCal} <small>/ ${moveGoal} kcal</small></strong>
            </div>
            <span class="metric-pct">${movePct}%</span>
          </div>

          <div class="fitness-metric-row metric-exercise">
            <span class="metric-bullet">●</span>
            <div class="metric-info">
              <span class="metric-label">Trainieren</span>
              <strong class="metric-val">${exerciseMin} <small>/ ${exerciseGoal} min</small></strong>
            </div>
            <span class="metric-pct">${exercisePct}%</span>
          </div>

          <div class="fitness-metric-row metric-stand">
            <span class="metric-bullet">●</span>
            <div class="metric-info">
              <span class="metric-label">Stehen</span>
              <strong class="metric-val">${standHrs} <small>/ ${standGoal} Std.</small></strong>
            </div>
            <span class="metric-pct">${standPct}%</span>
          </div>
        </div>
      </div>

      <div class="fitness-footer-row">
        <div class="fitness-footer-item" title="Tages-Schritte">
          <span class="footer-icon">👟</span>
          <span>${steps.toLocaleString('de-DE')}</span>
        </div>
        <div class="fitness-footer-item" title="Zurückgelegte Distanz">
          <span class="footer-icon">📍</span>
          <span>${distanceKm} km</span>
        </div>
        <div class="fitness-footer-item" title="Aktueller Puls">
          <span class="footer-icon">❤️</span>
          <span>${heartRate > 0 ? `${heartRate} bpm` : '--'}</span>
        </div>
      </div>
    </div>
  `
}

export function renderWidgetContent(widget: DashboardWidget) {
  if (widget.type === 'calendar') return isBuiltInCalendar(widget.type, widget.url) ? calendarMarkup() : calendarFeedContent(widget)
  if (widget.type === 'text') return `<p class="text-widget-content">${escapeHtml(widget.url || 'Deinen Text hier eintragen')}</p>`
  if (widget.type === 'image') {
    const url = safeResourceUrl(widget.url, widget.type)
    if (url === null) return '<span class="placeholder-icon">!</span><strong>URL nicht erlaubt</strong>'
    return url
      ? `<img class="image-widget-content" src="${escapeHtml(url)}" alt="${escapeHtml(widget.title)}" />`
      : '<span class="placeholder-icon">▧</span><strong>Bild-URL fehlt</strong>'
  }
  if (widget.type === 'slideshow') return slideshowContent(widget)
  if (widget.type === 'waste') return wasteContent(widget)
  if (widget.type === 'media') return mediaContent(widget)
  if (widget.type === 'camera') return cameraContent(widget)
  if (widget.type === 'fitness') return fitnessContent(widget)
  return frameContent(widget)
}

export function renderSlideshowCrudList(urls: string[]): string {
  if (urls.length === 0) {
    return '<div class="slideshow-empty-state">Noch keine Bilder hinzugefügt. Lade oben Bilder hoch (max. 10) oder füge Bild-URLs ein.</div>'
  }
  return urls.map((url, i) => {
    let displayName = url
    try {
      const parsed = new URL(url, 'http://localhost')
      displayName = parsed.pathname.split('/').filter(Boolean).pop() || url
    } catch {
      displayName = url.slice(0, 30)
    }
    return `<div class="slideshow-image-item" data-index="${i}">
      <span class="image-order">#${i + 1}</span>
      <img class="image-thumb" src="${escapeHtml(url)}" alt="Bild ${i + 1}" loading="lazy" onerror="this.style.opacity='0.3'" />
      <span class="image-name" title="${escapeHtml(url)}">${escapeHtml(displayName)}</span>
      <div class="image-item-actions">
        <button type="button" class="icon-button" data-action="slide-up" data-index="${i}" title="Nach oben" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon-button" data-action="slide-down" data-index="${i}" title="Nach unten" ${i === urls.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="icon-button danger-button" data-action="slide-delete" data-index="${i}" title="Bild löschen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </div>
    </div>`
  }).join('')
}

function editorMarkup(widget: DashboardWidget, index: number) {
  const widgetIdToken = [...widget.id].map((character) => character.codePointAt(0)!.toString(36)).join('-') || 'empty'
  const controlId = `widget-editor-${widgetIdToken}`
  const urlPlaceholder = widget.type === 'text'
    ? 'Text eingeben'
    : widget.type === 'slideshow'
      ? 'https://example.com/bild1.jpg\nhttps://example.com/bild2.jpg'
      : 'https://example.com'
  const urlLabel = widget.type === 'slideshow' ? 'Bild-URLs (eine pro Zeile)' : 'Inhalt / URL'

  const extraSettingField = widget.type === 'web'
    ? `<label class="refresh-field" for="${controlId}-refresh">Aktualisierung<span>in Minuten (0 = aus)</span><input id="${controlId}-refresh" data-field="refreshIntervalMinutes" type="number" min="0" max="1440" value="${widget.refreshIntervalMinutes || 0}" /></label>`
    : widget.type === 'slideshow'
      ? `<label class="interval-field" for="${controlId}-interval">Wechsel<span>in Sekunden</span><input id="${controlId}-interval" data-field="intervalSeconds" type="number" min="2" max="3600" value="${widget.intervalSeconds || 8}" /></label>`
      : ''

  const slideshowUrls = widget.type === 'slideshow' ? parseSlideshowUrls(widget.url) : []

  return `<article class="widget-editor" data-widget-id="${escapeHtml(widget.id)}" data-columns="${widget.columns}" data-rows="${widget.rows}" ${widget.breakBefore ? 'data-break-before="true"' : ''} style="--widget-columns: ${widget.columns}; --widget-rows: ${widget.rows}">
    <header class="widget-card-header">
      <button class="drag-handle" type="button" draggable="true" aria-label="Widget ${index + 1} anordnen" title="Widget verschieben (anfassen und ziehen)">⠿</button>
      <div class="widget-card-title"><span class="widget-number">#${index + 1}</span><strong data-editor-title>${escapeHtml(widget.title)}</strong></div>
      <span class="type-badge" data-type-badge>${typeLabels[widget.type]}</span>
      <span class="dimension-label" id="${controlId}-dimensions" data-dimension-label aria-live="polite" aria-atomic="true">${widget.columns} × ${widget.rows}</span>
      <div class="widget-card-actions">
        <button class="icon-button toggle-editor" type="button" data-action="toggle" aria-expanded="false" aria-controls="${controlId}-dialog" title="Einstellungen bearbeiten (Typ, Titel, URL)">⚙</button>
        <button class="icon-button" type="button" data-action="move-left" aria-label="Widget nach links verschieben" title="Nach links">←</button>
        <button class="icon-button" type="button" data-action="move-right" aria-label="Widget nach rechts verschieben" title="Nach rechts">→</button>
        <button class="icon-button" type="button" data-action="move-up" aria-label="Widget eine Zeile nach oben verschieben" title="Zeile nach oben">↑</button>
        <button class="icon-button" type="button" data-action="move-down" aria-label="Widget eine Zeile nach unten verschieben" title="Zeile nach unten">↓</button>
        <button class="icon-button" type="button" data-action="duplicate" aria-label="Widget duplizieren" title="Duplizieren">⧉</button>
        <button class="icon-button danger-button" type="button" data-action="remove" aria-label="Widget löschen" title="Widget löschen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </div>
    </header>
    <div class="widget-card-body" id="${controlId}-body">
      <div class="widget-preview${widget.showTitle ? ' has-title' : ''}" data-widget-preview aria-label="Vorschau ${escapeHtml(widget.title)}">
        <div class="widget-preview-content" data-widget-preview-content>
          ${widget.showTitle ? `<header class="kiosk-widget-header preview-header"><h2 class="kiosk-widget-title">${escapeHtml(widget.title)}</h2></header>` : ''}
          <div class="iframe-placeholder">${renderWidgetContent(widget)}</div>
        </div>
      </div>
    </div>
    <div class="widget-resize-overlay" data-resize-overlay aria-hidden="true">
      <div class="widget-resize-overlay-badge">
        <span class="widget-resize-overlay-size" data-overlay-size>${widget.columns} × ${widget.rows}</span>
        <span class="widget-resize-overlay-label">Spalten × Zeilen</span>
      </div>
    </div>
    <button class="widget-resize-handle" type="button" data-resize-handle aria-label="Widgetgröße ziehen. Pfeiltasten ändern Breite und Höhe." aria-describedby="${controlId}-dimensions" title="Ecke ziehen, um Größe anzupassen (Breite &amp; Höhe)">
      <output class="widget-resize-readout" data-resize-readout aria-hidden="true">${widget.columns} × ${widget.rows}</output>
      <svg class="resize-handle-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="2" x2="2" y2="12"/><line x1="12" y1="6" x2="6" y2="12"/><line x1="12" y1="10" x2="10" y2="12"/></svg>
    </button>
    <dialog class="widget-dialog" id="${controlId}-dialog" data-widget-dialog>
      <div class="dialog-content">
        <div class="dialog-heading">
          <div><span class="widget-kicker">Widget ${index + 1}</span><h2 data-dialog-title>${escapeHtml(widget.title)}</h2></div>
          <button class="close-button" type="button" data-action="close-dialog" aria-label="Schließen">×</button>
        </div>
        <div class="dialog-form-fields">
          <label for="${controlId}-type">Typ<select id="${controlId}-type" data-field="type">
            <option value="web" ${widget.type === 'web' ? 'selected' : ''}>Webseite</option>
            <option value="calendar" ${widget.type === 'calendar' ? 'selected' : ''}>Kalender</option>
            <option value="text" ${widget.type === 'text' ? 'selected' : ''}>Text</option>
            <option value="image" ${widget.type === 'image' ? 'selected' : ''}>Bild</option>
            <option value="slideshow" ${widget.type === 'slideshow' ? 'selected' : ''}>Diashow</option>
            <option value="waste" ${widget.type === 'waste' ? 'selected' : ''}>Müllkalender</option>
            <option value="media" ${widget.type === 'media' ? 'selected' : ''}>Radio (Live-Stream)</option>
            <option value="camera" ${widget.type === 'camera' ? 'selected' : ''}>Kamera (Live / Snapshot)</option>
            <option value="fitness" ${widget.type === 'fitness' ? 'selected' : ''}>Fitness-Ringe (Apple Health)</option>
          </select></label>
          <label for="${controlId}-title">Titel<input id="${controlId}-title" data-field="title" value="${escapeHtml(widget.title)}" maxlength="30" /></label>
          <label class="content-field checkbox-label" for="${controlId}-show-title"><input type="checkbox" id="${controlId}-show-title" data-field="showTitle" ${widget.showTitle ? 'checked' : ''} /><span>Titel in der Anzeige anzeigen</span></label>
          ${widget.type === 'waste' ? `
          <label class="content-field" for="${controlId}-waste-url"><span>iCal-Abo / Webcal URL (vom Landratsamt / Entsorger)</span><input type="text" id="${controlId}-waste-url" data-field="url" value="${escapeHtml(widget.url)}" placeholder="https://.../abfall.ics oder webcal://..." /></label>
          <div class="content-field upload-field">
            <label class="upload-zone" for="${controlId}-ics-upload">
              <input type="file" id="${controlId}-ics-upload" data-action="upload-ics" accept=".ics,text/calendar" style="display: none;" />
              <span class="upload-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>📂 .ics-Datei importieren (vom Landratsamt / PC)</span>
              </span>
              <span class="upload-status" data-upload-status aria-live="polite"></span>
            </label>
          </div>
          <label class="content-field" for="${controlId}-waste"><span data-content-label>Abholtermine (aus .ics oder manuell)</span><textarea id="${controlId}-waste" data-field="wasteItems" rows="5" placeholder="Restmüll: In 2 Tagen&#10;Biomüll: Donnerstag&#10;Gelber Sack: 2026-10-02&#10;Papiermüll: In 10 Tagen">${escapeHtml(widget.wasteItems || '')}</textarea></label>
          <p class="editor-field-hint">💡 Entweder Webcal-URL deines Landratsamtes eintragen (synchronisiert live) oder heruntergeladene .ics-Datei direkt hochladen.</p>
          ` : widget.type === 'media' ? `
          <div class="media-form-group">
            <label for="${controlId}-media-preset">Deutscher Radiosender
              <select id="${controlId}-media-preset" data-action="radio-preset">
                ${GERMAN_RADIO_STATIONS.map((st) => {
                  const isSelected = (widget.url === st.streamUrl) || (!widget.url && st.id === '1live')
                  return `<option value="${st.id}" data-url="${escapeHtml(st.streamUrl)}" data-name="${escapeHtml(st.name)}" data-slogan="${escapeHtml(st.slogan)}" ${isSelected ? 'selected' : ''}>${escapeHtml(st.name)} (${escapeHtml(st.category)} - ${escapeHtml(st.slogan)})</option>`
                }).join('')}
              </select>
            </label>
            <label class="content-field" for="${controlId}-media-url">
              <span>Stream-URL (Live-Audio Stream)</span>
              <input type="url" id="${controlId}-media-url" data-field="url" value="${escapeHtml(widget.url || '')}" placeholder="https://...stream.mp3" />
            </label>
            <div class="grid-2-cols" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <label for="${controlId}-media-title">Sender-Name / Titel
                <input id="${controlId}-media-title" data-field="mediaTitle" value="${escapeHtml(widget.mediaTitle || '')}" placeholder="z. B. 1LIVE" />
              </label>
              <label for="${controlId}-media-artist">Zusatztext / Slogan
                <input id="${controlId}-media-artist" data-field="mediaArtist" value="${escapeHtml(widget.mediaArtist || '')}" placeholder="z. B. WDR - Eins Live" />
              </label>
            </div>
            <div class="media-actions-bar" style="display:flex;align-items:center;gap:12px;margin-top:6px;">
              <button type="button" class="secondary-button" data-action="test-radio-stream" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;font-size:0.8rem;">
                <span class="preview-play-icon">▶</span> <span>Sender antesten</span>
              </button>
              <span class="editor-field-status" data-radio-test-status style="font-size:0.8rem;color:var(--muted);"></span>
            </div>
            <label class="content-field checkbox-label" for="${controlId}-media-playing" style="margin-top:8px;">
              <input type="checkbox" id="${controlId}-media-playing" data-field="mediaPlaying" ${widget.mediaPlaying !== false ? 'checked' : ''} />
              <span>Autoplay / Sofort abspielen bei Start</span>
            </label>
            <input type="hidden" id="${controlId}-media-album" data-field="mediaAlbum" value="${escapeHtml(widget.mediaAlbum || '')}" />
            <input type="hidden" id="${controlId}-media-cover" data-field="mediaCoverUrl" value="${escapeHtml(widget.mediaCoverUrl || '')}" />
          </div>
          <p class="editor-field-hint">💡 Wähle einen der beliebtesten deutschen Sender aus. Stream-URL und Sender-Details werden automatisch ausgefüllt und die Tonausgabe erfolgt direkt über den Lautsprecher bzw. Monitor.</p>
          ` : widget.type === 'camera' ? `
          <div class="camera-form-group">
            <label class="content-field" for="${controlId}-camera-url">
              <span>Kamera-URL (Snapshot-Bild oder MJPEG/Web-Stream)</span>
              <input type="url" id="${controlId}-camera-url" data-field="cameraUrl" value="${escapeHtml(widget.cameraUrl || widget.url || '')}" placeholder="http://192.168.1.100/snapshot.jpg oder https://..." />
            </label>
            <div class="grid-3-cols" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
              <label for="${controlId}-camera-refresh">Aktualisierung
                <input type="number" id="${controlId}-camera-refresh" data-field="cameraRefreshSeconds" min="1" max="3600" value="${widget.cameraRefreshSeconds || 5}" />
                <small style="font-size:0.7rem;color:var(--muted);">in Sekunden</small>
              </label>
              <label for="${controlId}-camera-type">Kameratyp
                <select id="${controlId}-camera-type" data-field="cameraType">
                  <option value="snapshot" ${widget.cameraType !== 'mjpeg' && widget.cameraType !== 'stream' ? 'selected' : ''}>Snapshot (Auto-Reload)</option>
                  <option value="mjpeg" ${widget.cameraType === 'mjpeg' ? 'selected' : ''}>MJPEG Live-Stream</option>
                  <option value="stream" ${widget.cameraType === 'stream' ? 'selected' : ''}>Webseite / Iframe Stream</option>
                </select>
              </label>
              <label for="${controlId}-camera-fit">Bildanpassung
                <select id="${controlId}-camera-fit" data-field="cameraFit">
                  <option value="cover" ${widget.cameraFit !== 'contain' ? 'selected' : ''}>Ausfüllen (Cover)</option>
                  <option value="contain" ${widget.cameraFit === 'contain' ? 'selected' : ''}>Ganzes Bild (Contain)</option>
                </select>
              </label>
            </div>
            <p class="editor-field-hint">💡 Funktioniert mit allen IP-Kameras, Webcams, RTSP-to-HTTP Gateways, Home Assistant Kameras und öffentlichen Webcams.</p>
          </div>
          ` : widget.type === 'fitness' ? `
          <div class="fitness-form-group">
            <div class="grid-2-cols" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <label for="${controlId}-fitness-user">Sportler / Name
                <input id="${controlId}-fitness-user" data-field="userName" value="${escapeHtml(widget.userName || widget.title || 'Michael')}" placeholder="z. B. Michael" />
              </label>
              <label for="${controlId}-fitness-avatar">Avatar / Emoji
                <input id="${controlId}-fitness-avatar" data-field="userAvatar" value="${escapeHtml(widget.userAvatar || '🏃')}" placeholder="🏃, 🚴, 🏋️, 🧘" />
              </label>
            </div>

            <div class="fitness-goals-section" style="margin-top:10px;padding:10px;background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:6px;">
              <strong style="display:block;font-size:0.8rem;color:var(--acid);margin-bottom:8px;">🎯 Tagesziele &amp; Aktuelle Werte:</strong>
              <div class="grid-3-cols" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                <label for="${controlId}-fitness-move" style="color:#ff4d79;">🔴 Bewegen (kcal)
                  <input type="number" id="${controlId}-fitness-move" data-field="moveCalories" min="0" value="${widget.moveCalories ?? 480}" placeholder="Aktuell" />
                  <input type="number" id="${controlId}-fitness-move-goal" data-field="moveGoal" min="50" value="${widget.moveGoal ?? 500}" placeholder="Ziel" title="Tagesziel kcal" />
                </label>
                <label for="${controlId}-fitness-exercise" style="color:#a0ff00;">🟢 Trainieren (min)
                  <input type="number" id="${controlId}-fitness-exercise" data-field="exerciseMinutes" min="0" value="${widget.exerciseMinutes ?? 35}" placeholder="Aktuell" />
                  <input type="number" id="${controlId}-fitness-exercise-goal" data-field="exerciseGoal" min="5" value="${widget.exerciseGoal ?? 30}" placeholder="Ziel" title="Tagesziel Minuten" />
                </label>
                <label for="${controlId}-fitness-stand" style="color:#00f0ff;">🔵 Stehen (Std.)
                  <input type="number" id="${controlId}-fitness-stand" data-field="standHours" min="0" max="24" value="${widget.standHours ?? 9}" placeholder="Aktuell" />
                  <input type="number" id="${controlId}-fitness-stand-goal" data-field="standGoal" min="1" max="24" value="${widget.standGoal ?? 12}" placeholder="Ziel" title="Tagesziel Stunden" />
                </label>
              </div>
              <div class="grid-3-cols" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:8px;">
                <label for="${controlId}-fitness-steps">👟 Schritte
                  <input type="number" id="${controlId}-fitness-steps" data-field="steps" min="0" value="${widget.steps ?? 7650}" />
                </label>
                <label for="${controlId}-fitness-distance">📍 Distanz (km)
                  <input type="number" step="0.1" id="${controlId}-fitness-distance" data-field="distanceKm" min="0" value="${widget.distanceKm ?? 5.4}" />
                </label>
                <label for="${controlId}-fitness-hr">❤️ Puls (bpm)
                  <input type="number" id="${controlId}-fitness-hr" data-field="heartRate" min="0" value="${widget.heartRate ?? 72}" />
                </label>
              </div>
            </div>

            <div class="fitness-sync-guide" style="margin-top:10px;">
              <details class="raw-urls-details">
                <summary style="font-size:0.8rem;color:var(--acid);cursor:pointer;">📲 Apple Health / Apple Watch Auto-Sync einrichten</summary>
                <div style="padding:8px 0;font-size:0.75rem;color:var(--muted);line-height:1.4;">
                  <p style="margin:4px 0;">Sende deine Fitnessdaten automatisch von iPhone/Apple Watch per <strong>Apple Kurzbefehl (iOS Shortcuts)</strong> oder <strong>Health Auto Export App</strong>:</p>
                  <div style="background:#141613;padding:8px;border-radius:4px;border:1px solid var(--line);margin:6px 0;font-family:monospace;word-break:break-all;">
                    <strong>POST Webhook-URL:</strong><br>
                    <span style="color:var(--acid);">/api/health/sync</span>
                  </div>
                  <p style="margin:4px 0;">JSON-Payload: <code>{ "userName": "${escapeHtml(widget.userName || 'Michael')}", "moveCalories": 620, "moveGoal": 500, "exerciseMinutes": 45, "exerciseGoal": 30, "standHours": 10, "standGoal": 12, "steps": 9200, "distanceKm": 6.8, "heartRate": 74 }</code></p>
                </div>
              </details>
              <input type="hidden" id="${controlId}-fitness-token" data-field="healthToken" value="${escapeHtml(widget.healthToken || widget.id)}" />
            </div>
          </div>
          ` : `
          ${(widget.type === 'image' || widget.type === 'slideshow') ? `<div class="content-field upload-field"><label class="upload-zone" for="${controlId}-upload"><input type="file" id="${controlId}-upload" data-action="upload" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" ${widget.type === 'slideshow' ? 'multiple' : ''} style="display: none;" /><span class="upload-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>${widget.type === 'slideshow' ? 'Bilder hochladen (max. 10 Bilder, je max. 5 MB)' : 'Bild hochladen (max. 5 MB)'}</span></span><span class="upload-status" data-upload-status aria-live="polite"></span></label></div>` : ''}
          ${widget.type === 'image' && widget.url ? `
          <div class="single-image-item" data-single-image-item>
            <img class="single-image-thumb" src="${escapeHtml(widget.url)}" alt="Aktuelles Bild" onerror="this.style.opacity='0.3'" />
            <span class="single-image-name" title="${escapeHtml(widget.url)}">${escapeHtml(widget.url)}</span>
            <button type="button" class="icon-button danger-button" data-action="clear-image" title="Bild entfernen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
          </div>
          ` : ''}
          ${widget.type === 'slideshow' ? `
          <div class="slideshow-crud-section" data-slideshow-crud>
            <div class="slideshow-crud-header">
              <span class="slideshow-count-badge" data-slideshow-count>Bilder (${slideshowUrls.length} / 10)</span>
            </div>
            <div class="slideshow-crud-list" data-slideshow-list>
              ${renderSlideshowCrudList(slideshowUrls)}
            </div>
            <div class="slideshow-add-url-row">
              <input type="url" class="slideshow-url-input" data-slideshow-url-input placeholder="https://example.com/bild.jpg" />
              <button type="button" class="slideshow-add-url-btn" data-action="add-slideshow-url">+ URL hinzufügen</button>
            </div>
          </div>
          <details class="raw-urls-details">
            <summary>URLs manuell bearbeiten (Textform)</summary>
            <label class="content-field" for="${controlId}-url"><span data-content-label>${urlLabel}</span><textarea id="${controlId}-url" data-field="url" rows="3" placeholder="${urlPlaceholder}">${escapeHtml(widget.url)}</textarea></label>
          </details>
          ` : `
          <label class="content-field" for="${controlId}-url"><span data-content-label>${urlLabel}</span><textarea id="${controlId}-url" data-field="url" rows="3" placeholder="${urlPlaceholder}">${escapeHtml(widget.url)}</textarea></label>
          `}
          ${extraSettingField}
          `}
          <label class="content-field checkbox-label" for="${controlId}-break"><input type="checkbox" id="${controlId}-break" data-field="breakBefore" ${widget.breakBefore ? 'checked' : ''} /><span>In neuer Zeile beginnen (unterhalb vorheriger Widgets)</span></label>
          <input type="hidden" id="${controlId}-columns" data-field="columns" value="${widget.columns}" />
          <input type="hidden" id="${controlId}-rows" data-field="rows" value="${widget.rows}" />
        </div>
        <div class="dialog-actions">
          <button class="dialog-delete-btn danger-button" type="button" data-action="remove-dialog" title="Widget löschen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg><span>Widget löschen</span></button>
          <button class="secondary-button" type="button" data-action="close-dialog">Abbrechen</button>
          <button class="save-button" type="button" data-action="save-dialog">Fertig</button>
        </div>
      </div>
    </dialog>
  </article>`
}

export function renderWidget(widget: DashboardWidget, editable = false, index = 0) {
  if (editable) return editorMarkup(widget, index)

  const colStyle = widget.breakBefore ? `grid-column: 1 / span ${widget.columns};` : `grid-column: span ${widget.columns};`
  const titleHeader = widget.showTitle
    ? `<header class="kiosk-widget-header"><h2 class="kiosk-widget-title">${escapeHtml(widget.title)}</h2></header>`
    : `<h2 class="visually-hidden">${escapeHtml(widget.title)}</h2>`
  return `<article class="widget kiosk-widget${widget.showTitle ? ' has-title' : ''}" ${widget.breakBefore ? 'data-break-before="true"' : ''} style="${colStyle} grid-row: span ${widget.rows};" aria-label="${escapeHtml(widget.title)}">${titleHeader}<div class="iframe-placeholder">${renderWidgetContent(widget)}</div></article>`
}

export function widgetTypeLabel(type: WidgetType) {
  return typeLabels[type]
}

export function bindWidgetFrames(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('.frame-container').forEach((container) => {
    if (container.dataset.frameBound === 'true') return
    container.dataset.frameBound = 'true'
    const frame = container.querySelector<HTMLIFrameElement>('[data-widget-frame]')
    const reload = container.querySelector<HTMLButtonElement>('[data-reload-frame]')
    if (!frame || !reload) return

    let timer = 0
    const startLoading = () => {
      window.clearTimeout(timer)
      container.classList.remove('is-loaded', 'is-slow')
      timer = window.setTimeout(() => container.classList.add('is-slow'), 8000)
    }
    const markLoaded = () => {
      window.clearTimeout(timer)
      container.classList.add('is-loaded')
      container.classList.remove('is-slow')
    }

    frame.addEventListener('load', markLoaded)
    reload.addEventListener('click', () => {
      startLoading()
      frame.src = frame.src
    })
    startLoading()

    const refreshIntervalMinutes = Number(container.dataset.refreshInterval) || 0
    if (refreshIntervalMinutes > 0) {
      window.setInterval(() => {
        startLoading()
        frame.src = frame.src
      }, refreshIntervalMinutes * 60 * 1000)
    }
  })

  root.querySelectorAll<HTMLElement>('[data-slideshow-widget]').forEach((container) => {
    if (container.dataset.slideshowBound === 'true') return
    container.dataset.slideshowBound = 'true'
    const slides = container.querySelectorAll<HTMLElement>('.slideshow-slide')
    const dots = container.querySelectorAll<HTMLElement>('.slideshow-dot')
    if (slides.length <= 1) return

    const intervalSeconds = Math.max(2, Number(container.dataset.slideshowInterval) || 8)
    let currentIndex = 0

    window.setInterval(() => {
      slides[currentIndex]?.classList.remove('is-active')
      dots[currentIndex]?.classList.remove('is-active')
      currentIndex = (currentIndex + 1) % slides.length
      slides[currentIndex]?.classList.add('is-active')
      dots[currentIndex]?.classList.add('is-active')
    }, intervalSeconds * 1000)
  })

  root.querySelectorAll<HTMLElement>('[data-calendar-feed]').forEach((container) => {
    if (container.dataset.calendarBound === 'true') return
    container.dataset.calendarBound = 'true'
    const widgetId = container.dataset.calendarWidgetId
    if (!widgetId) return

    void fetch(`/api/calendar/${encodeURIComponent(widgetId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as { events?: CalendarFeedEvent[]; error?: string }
        if (!response.ok) throw new Error(body.error || 'Kalender konnte nicht geladen werden.')
        container.innerHTML = calendarAgendaMarkup(Array.isArray(body.events) ? body.events : [])
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Kalender konnte nicht geladen werden.'
        container.innerHTML = `<div class="calendar-feed-error" role="alert"><strong>Kalender konnte nicht geladen werden.</strong><span>${escapeHtml(message)}</span></div>`
      })
  })

  root.querySelectorAll<HTMLElement>('[data-waste-feed]').forEach((container) => {
    if (container.dataset.wasteBound === 'true') return
    container.dataset.wasteBound = 'true'
    const widgetId = container.dataset.wasteWidgetId
    if (!widgetId) return

    const loadWasteFeed = () => {
      void fetch(`/api/calendar/${encodeURIComponent(widgetId)}`, { cache: 'no-store' })
        .then(async (response) => {
          const body = await response.json() as { events?: CalendarFeedEvent[]; error?: string }
          if (!response.ok) throw new Error(body.error || 'Müllkalender konnte nicht geladen werden.')
          container.innerHTML = renderWasteEvents(Array.isArray(body.events) ? body.events : [])
        })
        .catch((error: unknown) => {
          if (!container.querySelector('.waste-item')) {
            const message = error instanceof Error ? error.message : 'Müllkalender konnte nicht geladen werden.'
            container.innerHTML = `<div class="calendar-feed-error" role="alert"><strong>Müllkalender-Abo Fehler</strong><span>${escapeHtml(message)}</span></div>`
          }
        })
    }
    loadWasteFeed()
    window.setInterval(loadWasteFeed, 30 * 60 * 1000)
  })

  bindCameraWidgets(root)
}

export function bindCameraWidgets(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-camera-widget]').forEach((container) => {
    if (container.dataset.cameraBound === 'true') return
    container.dataset.cameraBound = 'true'
    const type = container.dataset.cameraType
    if (type !== 'snapshot') return

    const baseUrl = container.dataset.cameraUrl
    const intervalSec = Math.max(1, Number(container.dataset.cameraInterval) || 5)
    const img = container.querySelector<HTMLImageElement>('.camera-snapshot-img')
    if (!baseUrl || !img) return

    window.setInterval(() => {
      const sep = baseUrl.includes('?') ? '&' : '?'
      const freshUrl = `${baseUrl}${sep}_t=${Date.now()}`
      const preloader = new Image()
      preloader.onload = () => {
        img.src = freshUrl
        container.classList.remove('is-offline')
      }
      preloader.onerror = () => {
        container.classList.add('is-offline')
      }
      preloader.src = freshUrl
    }, intervalSec * 1000)
  })
}
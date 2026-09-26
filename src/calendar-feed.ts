export type CalendarFeedEvent = {
  start: string
  end: string
  summary: string
  location: string
  allDay: boolean
}

function decodeCalendarText(value: string) {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function calendarDate(value: string) {
  const compact = value.trim()
  const allDay = /^\d{8}$/.test(compact)
  const match = compact.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
  if (!match) return null

  const [, year, month, day, hour = '00', minute = '00', second = '00', utc] = match
  const parts = [Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)] as const
  const date = utc
    ? new Date(Date.UTC(...parts))
    : new Date(...parts)
  if (Number.isNaN(date.getTime())) return null
  return { iso: date.toISOString(), allDay }
}

export function parseCalendarFeed(content: string): CalendarFeedEvent[] {
  const lines = content.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  const events: CalendarFeedEvent[] = []
  let properties: Record<string, string> | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      properties = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (!properties) continue
      const start = calendarDate(properties.DTSTART || '')
      const end = calendarDate(properties.DTEND || '')
      if (start) {
        events.push({
          start: start.iso,
          end: end?.iso || start.iso,
          summary: decodeCalendarText(properties.SUMMARY || 'Termin'),
          location: decodeCalendarText(properties.LOCATION || ''),
          allDay: start.allDay,
        })
      }
      properties = null
      continue
    }
    if (!properties) continue
    const separator = line.indexOf(':')
    if (separator < 1) continue
    const key = line.slice(0, separator).split(';', 1)[0]!.toUpperCase()
    properties[key] = line.slice(separator + 1)
  }

  return events.sort((left, right) => left.start.localeCompare(right.start))
}

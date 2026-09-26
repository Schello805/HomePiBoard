import assert from 'node:assert/strict'
import test from 'node:test'

import { parseCalendarFeed } from '../src/calendar-feed.ts'

const feed = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART;TZID=Europe/Berlin:20260928T081500\r\nDTEND;TZID=Europe/Berlin:20260928T090000\r\nSUMMARY:Elternabend\\, Klasse 5a\r\nLOCATION:Aula\\nHaupteingang\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:2\r\nDTSTART;VALUE=DATE:20260930\r\nDTEND;VALUE=DATE:20261001\r\nSUMMARY:Wandertag mit sehr langem \r\n Titel\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`

test('parseCalendarFeed reads timed and all-day iCalendar events', () => {
  const events = parseCalendarFeed(feed)

  assert.equal(events.length, 2)
  assert.equal(events[0]?.summary, 'Elternabend, Klasse 5a')
  assert.equal(events[0]?.location, 'Aula\nHaupteingang')
  assert.equal(events[0]?.allDay, false)
  assert.equal(events[1]?.summary, 'Wandertag mit sehr langem Titel')
  assert.equal(events[1]?.allDay, true)
  assert.equal(new Date(events[1]?.start || '').getDate(), 30)
})

test('parseCalendarFeed ignores malformed events and sorts valid events', () => {
  const events = parseCalendarFeed(`BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Ohne Datum\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20261002T120000Z\nSUMMARY:Später\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20260929T120000Z\nSUMMARY:Früher\nEND:VEVENT\nEND:VCALENDAR`)

  assert.deepEqual(events.map((event) => event.summary), ['Früher', 'Später'])
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { calendarMarkup, weatherSymbol } from '../src/dashboard-utils.ts'

test('weatherSymbol maps Open-Meteo weather code groups', () => {
  assert.equal(weatherSymbol(0), 'klar')
  assert.equal(weatherSymbol(3), 'bewölkt')
  assert.equal(weatherSymbol(61), 'Regen')
  assert.equal(weatherSymbol(75), 'Schnee')
  assert.equal(weatherSymbol(95), 'Gewitter')
})

test('calendarMarkup starts weeks on Monday and marks the selected day', () => {
  const markup = calendarMarkup(new Date('2026-09-24T12:00:00'))

  assert.match(markup, /September 2026/)
  assert.match(markup, /class="calendar-day today">24</)
  assert.equal((markup.match(/<span><\/span>/g) || []).length, 1)
})

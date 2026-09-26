import assert from 'node:assert/strict'
import test from 'node:test'
import { calculatePixelShift, isNightTime } from '../src/display.ts'

test('isNightTime detects nighttime within standard window', () => {
  const at1am = new Date(2026, 8, 26, 1, 30)
  const at12pm = new Date(2026, 8, 26, 12, 0)
  const at11pm = new Date(2026, 8, 26, 23, 15)

  // Overnight window: 22:00 to 06:00
  assert.equal(isNightTime('22:00', '06:00', at1am), true)
  assert.equal(isNightTime('22:00', '06:00', at11pm), true)
  assert.equal(isNightTime('22:00', '06:00', at12pm), false)

  // Same-day window: 01:00 to 05:00
  assert.equal(isNightTime('01:00', '05:00', at1am), true)
  assert.equal(isNightTime('01:00', '05:00', at12pm), false)
})

test('calculatePixelShift cycles through safe 1-2px offsets', () => {
  const s0 = calculatePixelShift(0)
  const s1 = calculatePixelShift(1)
  const s2 = calculatePixelShift(2)
  const s9 = calculatePixelShift(9)

  assert.deepEqual(s0, { x: 0, y: 0 })
  assert.deepEqual(s1, { x: 1, y: 0 })
  assert.deepEqual(s2, { x: 1, y: 1 })
  assert.deepEqual(s9, s0) // modulo wrap-around
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { bindRadioWidgets, calculatePixelShift, initScreenWakeLock, isNightTime, renderHeaderItemHtml } from '../src/display.ts'

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

test('bindRadioWidgets wires toggle-play button and volume slider to audio element', async () => {
  let playCalled = false
  let boundButtonClickHandler: ((e: any) => void) | null = null
  let boundVolumeHandler: ((e: any) => void) | null = null

  const mockAudio = {
    paused: true,
    src: '',
    volume: 1,
    load() {},
    play() {
      playCalled = true
      this.paused = false
      return Promise.resolve()
    },
    pause() {
      this.paused = true
    },
    addEventListener(_event: string, _fn: any) {},
  }

  const classList = new Set<string>(['is-paused'])
  const widget = {
    dataset: { streamUrl: 'https://stream.example.com/live.mp3' },
    classList: {
      contains: (c: string) => classList.has(c),
      toggle: (c: string, force: boolean) => {
        if (force) classList.add(c)
        else classList.delete(c)
      },
    },
    querySelector(sel: string) {
      if (sel.includes('toggle-play')) {
        return {
          addEventListener(_event: string, fn: any) {
            boundButtonClickHandler = fn
          },
        }
      }
      if (sel.includes('data-media-audio')) return mockAudio
      if (sel.includes('media-equalizer-bars')) {
        return {
          classList: {
            toggle(_c: string, _f: boolean) {},
          },
        }
      }
      if (sel.includes('data-media-status')) return { textContent: '' }
      if (sel.includes('volume-slider')) {
        return {
          value: '0.5',
          addEventListener(_event: string, fn: any) {
            boundVolumeHandler = fn
          },
        }
      }
      if (sel.includes('media-play-icon')) return { textContent: '▶' }
      return null
    },
  }

  const root = {
    querySelectorAll(sel: string) {
      if (sel === '[data-media-widget]') return [widget]
      return []
    },
  } as unknown as ParentNode

  bindRadioWidgets(root)
  assert.ok(boundButtonClickHandler !== null)
  assert.ok(boundVolumeHandler !== null)

  // Test volume slider event
  boundVolumeHandler!({ stopPropagation() {} })
  assert.equal(mockAudio.volume, 0.5)

  // Test button click triggering audio.play()
  await boundButtonClickHandler!({ stopPropagation() {} })
  assert.equal(playCalled, true)
  assert.equal(classList.has('is-playing'), true)
  assert.equal(classList.has('is-paused'), false)

  // Test clicking button again pauses audio
  await boundButtonClickHandler!({ stopPropagation() {} })
  assert.equal(mockAudio.paused, true)
  assert.equal(classList.has('is-playing'), false)
  assert.equal(classList.has('is-paused'), true)
})

test('bindRadioWidgets autoplays stream when is-playing is present', async () => {
  let playCalled = false
  const mockAudio = {
    paused: true,
    src: '',
    volume: 1,
    load() {},
    play() {
      playCalled = true
      this.paused = false
      return Promise.resolve()
    },
    pause() {
      this.paused = true
    },
    addEventListener() {},
  }

  const classList = new Set<string>(['is-playing'])
  const statusEl = { textContent: '' }
  const widget = {
    dataset: { streamUrl: 'https://stream.example.com/live.mp3' },
    classList: {
      contains: (c: string) => classList.has(c),
      toggle: (c: string, force: boolean) => {
        if (force) classList.add(c)
        else classList.delete(c)
      },
    },
    querySelector(sel: string) {
      if (sel.includes('data-media-audio')) return mockAudio
      if (sel.includes('media-equalizer-bars')) return { classList: { toggle() {} } }
      if (sel.includes('data-media-status')) return statusEl
      if (sel.includes('media-play-icon')) return { textContent: '' }
      return null
    },
  }

  const root = {
    querySelectorAll(sel: string) {
      if (sel === '[data-media-widget]') return [widget]
      return []
    },
  } as unknown as ParentNode

  bindRadioWidgets(root)
  // Allow microtask to resolve startAudio(true)
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(playCalled, true)
  assert.equal(classList.has('is-playing'), true)
  assert.equal(statusEl.textContent, 'Auf Sendung')
})

test('bindRadioWidgets handles NotAllowedError by waiting for user gesture', async () => {
  const notAllowedError = new Error('play() failed because the user didn\'t interact with the document first.')
  notAllowedError.name = 'NotAllowedError'

  const mockAudio = {
    paused: true,
    src: '',
    volume: 1,
    load() {},
    play() {
      return Promise.reject(notAllowedError)
    },
    pause() {},
    addEventListener() {},
  }

  const classList = new Set<string>(['is-playing'])
  const statusEl = { textContent: '' }
  const widget = {
    dataset: { streamUrl: 'https://stream.example.com/live.mp3' },
    classList: {
      contains: (c: string) => classList.has(c),
      toggle: (c: string, force: boolean) => {
        if (force) classList.add(c)
        else classList.delete(c)
      },
    },
    querySelector(sel: string) {
      if (sel.includes('data-media-audio')) return mockAudio
      if (sel.includes('media-equalizer-bars')) return { classList: { toggle() {} } }
      if (sel.includes('data-media-status')) return statusEl
      if (sel.includes('media-play-icon')) return { textContent: '' }
      return null
    },
  }

  const root = {
    querySelectorAll(sel: string) {
      if (sel === '[data-media-widget]') return [widget]
      return []
    },
  } as unknown as ParentNode

  bindRadioWidgets(root)
  await Promise.resolve()
  await Promise.resolve()

  assert.equal(classList.has('is-waiting-for-gesture'), true)
  assert.equal(statusEl.textContent, 'Tippen für Ton')
})

test('initScreenWakeLock safely handles environments without navigator or wakeLock', () => {
  assert.doesNotThrow(() => {
    initScreenWakeLock()
  })
})

test('renderHeaderItemHtml correctly outputs markup for all supported header item types', () => {
  const settings = {
    version: 3,
    location: 'Wohnzimmer',
    weatherCity: 'Berlin',
    widgets: [],
  }

  const clock = renderHeaderItemHtml('clock', settings, true, 'server')
  assert.match(clock, /id="clock"/)

  const date = renderHeaderItemHtml('date', settings, true, 'server')
  assert.match(date, /id="date"/)

  const weather = renderHeaderItemHtml('weather', settings, true, 'server')
  assert.match(weather, /id="weather"/)

  const location = renderHeaderItemHtml('location', settings, true, 'server')
  assert.match(location, /id="header-location"/)
  assert.match(location, /Wohnzimmer/)

  const cpu = renderHeaderItemHtml('cpu', settings, true, 'server')
  assert.match(cpu, /header-chip-cpu/)
  assert.match(cpu, /id="header-cpu-val"/)

  const ram = renderHeaderItemHtml('ram', settings, true, 'server')
  assert.match(ram, /header-chip-ram/)
  assert.match(ram, /id="header-ram-val"/)

  const uptime = renderHeaderItemHtml('uptime', settings, true, 'server')
  assert.match(uptime, /header-chip-uptime/)
  assert.match(uptime, /id="header-uptime-val"/)

  const ip = renderHeaderItemHtml('ip', settings, true, 'server')
  assert.match(ip, /header-chip-ip/)
  assert.match(ip, /id="header-ip-val"/)

  const networkOnline = renderHeaderItemHtml('network', settings, true, 'server')
  assert.match(networkOnline, /is-online/)
  assert.match(networkOnline, /ONLINE/)

  const networkOffline = renderHeaderItemHtml('network', settings, false, 'local')
  assert.match(networkOffline, /is-offline/)
  assert.match(networkOffline, /LOKAL/)
})




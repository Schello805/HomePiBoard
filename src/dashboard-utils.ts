export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]!)
}

export function weatherSymbol(code: number) {
  if (code === 0) return 'klar'
  if (code <= 3) return 'bewölkt'
  if (code <= 67) return 'Regen'
  if (code <= 77) return 'Schnee'
  return 'Gewitter'
}

export function calendarMarkup(now = new Date()) {
  const month = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const cells = Array.from({ length: offset + daysInMonth }, (_, index) => index < offset
    ? '<span></span>'
    : `<span class="calendar-day${index - offset + 1 === now.getDate() ? ' today' : ''}">${index - offset + 1}</span>`).join('')

  return `<div class="calendar-widget"><strong>${month}</strong><div class="calendar-weekdays"><span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span></div><div class="calendar-days">${cells}</div></div>`
}

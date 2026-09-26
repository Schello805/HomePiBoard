import './style.css'

import { renderAdminPage } from './admin.ts'
import { renderDisplayPage } from './display.ts'
import { renderSettingsPage } from './settings-page.ts'

const app = document.querySelector<HTMLElement>('#app')!

if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
  await renderAdminPage(app)
} else if (window.location.pathname === '/settings' || window.location.pathname === '/settings/') {
  await renderSettingsPage(app)
} else {
  await renderDisplayPage(app)
}
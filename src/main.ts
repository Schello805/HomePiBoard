import './style.css'

import { renderAdminPage } from './admin.ts'
import { renderDisplayPage } from './display.ts'

const app = document.querySelector<HTMLElement>('#app')!

if (window.location.pathname === '/admin' || window.location.pathname === '/admin/') {
  await renderAdminPage(app)
} else {
  await renderDisplayPage(app)
}
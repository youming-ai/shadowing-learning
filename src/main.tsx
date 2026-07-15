import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getRouter } from '~/router'
import '~/styles/app.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

const router = getRouter()
const root = createRoot(rootEl)

root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

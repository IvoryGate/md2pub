import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import 'katex/dist/katex.min.css'
import './index.css'
import './docs.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

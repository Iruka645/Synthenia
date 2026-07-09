import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { TTSProviderContextProvider } from './contexts/TTSProviderContext.jsx'
import { UIProvider } from './contexts/UIContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <UIProvider>
        <TTSProviderContextProvider>
          <App />
        </TTSProviderContextProvider>
      </UIProvider>
    </ErrorBoundary>
  </StrictMode>,
)

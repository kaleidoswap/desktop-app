import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'

import { Router } from './app/router'
import { store } from './app/store'
import { I18nProvider } from './components/I18nProvider'
import { ThemeProvider } from './components/ThemeProvider'
import { UpdateProvider } from './components/UpdateChecker'

import './i18n/config'
// Satoshi (display) + Geist Mono load via @font-face in styles.css.
import './styles.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <Provider store={store}>
    <ThemeProvider>
      <I18nProvider>
        <UpdateProvider>
          <Router />
        </UpdateProvider>
      </I18nProvider>
    </ThemeProvider>
  </Provider>
)

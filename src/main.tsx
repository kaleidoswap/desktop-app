import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import WebFont from 'webfontloader'

import { Router } from './app/router'
import { store } from './app/store'
import { I18nProvider } from './components/I18nProvider'
import { UpdateProvider } from './components/UpdateChecker'

import './i18n/config'
import './styles.css'

WebFont.load({
  google: {
    families: ['Mulish:400,500,600,700,800,900'],
  },
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <Provider store={store}>
    <I18nProvider>
      <UpdateProvider>
        <Router />
      </UpdateProvider>
    </I18nProvider>
  </Provider>
)

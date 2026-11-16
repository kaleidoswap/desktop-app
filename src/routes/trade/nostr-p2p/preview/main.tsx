import ReactDOM from 'react-dom/client'

import '../../../../i18n/config'
import '../../../../styles.css'
import { setTransport } from '../transport'

import { CostPreview } from './CostPreview'

document.documentElement.classList.add('dark')

setTransport({
  async request<T>(): Promise<T> {
    return null as T
  },
})

const view = new URLSearchParams(window.location.search).get('view') ?? 'market'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <CostPreview view={view} />
)

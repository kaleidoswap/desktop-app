import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import { MAINNET_PATH } from '../../app/router/paths'
import { Picker } from '../trade/nostr-p2p/market/Picker'
import { useOptionalP2pSession } from '../trade/nostr-p2p/session'
import { switchNetworkPath } from './navigation'

export function NetworkPicker({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const session = useOptionalP2pSession()
  const mainnet = pathname.startsWith(`${MAINNET_PATH}/`)
  const testLabel = t('unified.testNetworks', { defaultValue: 'Test networks' })
  const testOptions = session?.networks.map((network) => ({
    title: `${network.label} · ${t('unified.test', { defaultValue: 'test' })}`,
    value: network.key,
  }))
  const options = [
    { title: 'Bitcoin Mainnet', value: 'mainnet' },
    ...(testOptions?.length
      ? testOptions
      : [{ title: testLabel, value: 'test' }]),
  ]
  return (
    <Picker
      className={`${className} ${mainnet ? '[&>button]:bg-[#254635] [&>button]:text-[#b1f2ca]' : '[&>button]:bg-[#393049] [&>button]:text-[#d5baff]'}`}
      label={t('p2pSettings.network', { defaultValue: 'Network' })}
      onChange={(key) => {
        const nextMainnet = key === 'mainnet'
        if (session && !nextMainnet) session.setNetworkKey(key)
        if (nextMainnet !== mainnet)
          navigate(switchNetworkPath(pathname, nextMainnet))
      }}
      options={options.map((option) => ({
        ...option,
        leading: (
          <span
            aria-hidden
            className={`h-2.5 w-2.5 flex-none rounded-full ${option.value === 'mainnet' ? 'bg-status-success' : 'bg-violet-400'}`}
          />
        ),
      }))}
      value={mainnet ? 'mainnet' : (session?.config?.key ?? 'test')}
      variant="pill"
    />
  )
}

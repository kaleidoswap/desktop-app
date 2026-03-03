import { openUrl } from '@tauri-apps/plugin-opener'
import { ShieldCheck, ExternalLink } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { Card, Button } from '../../components/ui'

export const IconWrapper = `
  p-4 rounded-xl backdrop-blur-sm bg-opacity-20
  flex items-center justify-center
  transition-all duration-300
`

export const RemoteNodeInfo: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="mb-6 fade-in">
      <Card className="w-full bg-surface-elevated/40 border border-primary/10">
        <div className="flex items-start gap-3 p-4">
          <div className={`${IconWrapper} bg-primary/10 scale-90 mt-1`}>
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1 text-sm">
              {t('walletSetup.remoteNodePrerequisitesTitle')}
            </h3>
            <p className="text-content-secondary text-sm mb-3">
              {t('walletSetup.remoteNodePrerequisitesMessage')}
            </p>
            <Button
              className="border-primary/30 text-primary hover:bg-primary/10"
              icon={<ExternalLink className="w-3.5 h-3.5" />}
              onClick={() =>
                openUrl('https://docs.kaleidoswap.com/desktop-app/node-hosting')
              }
              size="sm"
              variant="outline"
            >
              {t('walletSetup.viewSetupGuide')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

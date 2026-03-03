import { openUrl } from '@tauri-apps/plugin-opener'
import { AlertTriangle, Info } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, Button } from '../../components/ui'

export const LocalNodeWarning: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="mb-8 fade-in">
      <Alert
        className="mb-8"
        icon={<AlertTriangle className="w-5 h-5" />}
        title={t('walletSetup.localNodeWarningTitle')}
        variant="warning"
      >
        <p className="leading-relaxed text-sm">
          {t('walletSetup.localNodeWarningMessage')}
          <Button
            className="ml-2 text-primary underline"
            icon={<Info className="w-3.5 h-3.5" />}
            onClick={() =>
              openUrl(
                'https://github.com/RGB-Tools/rgb-lightning-node/wiki/Node-Hosting'
              )
            }
            size="sm"
            variant="link"
          >
            {t('walletSetup.learnMore')}
          </Button>
        </p>
      </Alert>
    </div>
  )
}

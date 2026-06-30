import { ArrowLeft, ArrowRight, Check, RefreshCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui'

interface Props {
  error: string | null
  onFinish: VoidFunction
  onGoBack: VoidFunction
  onRetry: VoidFunction
}

export const Step4 = (props: Props) => {
  const { t } = useTranslation()
  if (props.error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 max-w-md mx-auto">
        <div className="text-center mt-6 bg-surface-overlay/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-border-default w-full">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
            <X className="w-7 h-7 text-red-400" />
          </div>

          <h3 className="text-2xl font-bold text-white mb-4">
            {t('createChannel.step4.failed')}
          </h3>

          <p className="text-red-400 mb-8 py-3 px-4 bg-red-900/20 rounded-lg border border-red-800/50 text-sm">
            {props.error}
          </p>

          <div className="flex items-center justify-between">
            <button
              className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
              onClick={props.onGoBack}
              type="button"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Go Back
            </button>
            <Button
              icon={<RefreshCw className="w-4 h-4" />}
              iconPosition="right"
              onClick={props.onRetry}
              size="md"
              variant="primary"
            >
              {t('createChannel.step4.tryAgain')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 max-w-lg mx-auto">
      <div className="text-center mt-6 bg-surface-overlay/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-border-default w-full">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
          <Check className="w-7 h-7 text-primary" />
        </div>

        <h3 className="text-2xl font-bold text-white mb-4">
          {t('createChannel.step4.success')}
        </h3>

        <p className="text-content-secondary mb-8 text-sm">
          {t('createChannel.step4.successMessage')}
        </p>

        <Button
          fullWidth
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
          onClick={props.onFinish}
          size="md"
          variant="primary"
        >
          Go to Manage Channels
        </Button>
      </div>
    </div>
  )
}

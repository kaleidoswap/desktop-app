import { Scale, ArrowRight, X } from 'lucide-react'
import { useState } from 'react'

import { TermsAndPrivacyContent } from '../TermsAndPrivacyContent'
import { Modal, Button } from '../ui'

interface TermsWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onAccept: () => void
}

type ContentType = 'terms' | 'privacy' | null

export const TermsWarningModal: React.FC<TermsWarningModalProps> = ({
  isOpen,
  onClose,
  onAccept,
}) => {
  const [showContent, setShowContent] = useState<ContentType>(null)

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="sm">
        <div>
          {/* Header — matches Deposit modal style */}
          <div className="flex items-center gap-3 pb-4 border-b border-divider/10 mb-4 px-6 pt-6">
            <Scale className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-bold text-white flex-1">
              Terms & Privacy Policy
            </h3>
            <button
              className="text-content-secondary hover:text-white p-1.5 rounded-lg hover:bg-surface-high/60 transition-colors"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-6 pb-6 space-y-5">
            <p className="text-content-secondary text-sm leading-relaxed">
              By using KaleidoSwap, you agree to our:
            </p>

            <ul className="space-y-2 text-sm text-content-secondary">
              <li className="flex items-start gap-2">
                <span className="text-content-tertiary mt-0.5">•</span>
                <span>
                  <button
                    className="text-content-secondary hover:text-white underline transition-colors"
                    onClick={() => setShowContent('terms')}
                  >
                    Terms of Service
                  </button>
                  {' '}— including notices about the experimental nature of the app
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-content-tertiary mt-0.5">•</span>
                <span>
                  <button
                    className="text-content-secondary hover:text-white underline transition-colors"
                    onClick={() => setShowContent('privacy')}
                  >
                    Privacy Policy
                  </button>
                  {' '}— how we handle your data and privacy
                </span>
              </li>
            </ul>

            <p className="text-xs text-content-tertiary">
              Click the links above to read the full documents.
            </p>

            <Button
              className="w-full"
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              onClick={onAccept}
              size="lg"
              type="button"
              variant="primary"
            >
              Accept & Continue
            </Button>
          </div>
        </div>
      </Modal>

      {showContent && (
        <TermsAndPrivacyContent
          isOpen={true}
          onClose={() => setShowContent(null)}
          type={showContent}
        />
      )}
    </>
  )
}

import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'

import { TermsAndPrivacyContent } from '../TermsAndPrivacyContent'
import { Modal } from '../ui'

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
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <div className="p-6">
          <div className="flex items-start mb-6">
            <AlertTriangle className="w-6 h-6 text-yellow-500 mr-4 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-bold text-white mb-4">
                Terms & Privacy Policy Agreement
              </h3>
              <p className="text-gray-300 mb-4">
                Before proceeding, please note that by using KaleidoSwap, you
                agree to our:
              </p>
              <ul className="list-disc pl-5 mb-6 space-y-2 text-gray-300">
                <li>
                  <button
                    className="text-blue-400 hover:text-blue-300 underline"
                    onClick={() => setShowContent('terms')}
                  >
                    Terms of Service
                  </button>{' '}
                  - Including important notices about the experimental nature of
                  the app
                </li>
                <li>
                  <button
                    className="text-blue-400 hover:text-blue-300 underline"
                    onClick={() => setShowContent('privacy')}
                  >
                    Privacy Policy
                  </button>{' '}
                  - How we handle your data and privacy
                </li>
              </ul>
              <p className="text-sm text-gray-400">
                Click the links above to read the full documents. By clicking "I
                Accept", you acknowledge that you have read and agree to both
                documents.
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-4">
            <button
              className="px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700 text-gray-300 transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              onClick={onAccept}
            >
              I Accept
            </button>
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

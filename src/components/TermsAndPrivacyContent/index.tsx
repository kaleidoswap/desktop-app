import { invoke } from '@tauri-apps/api/core'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'

import { Modal } from '../ui'

interface TermsAndPrivacyContentProps {
  type: 'terms' | 'privacy'
  isOpen: boolean
  onClose: () => void
}

export const TermsAndPrivacyContent: React.FC<TermsAndPrivacyContentProps> = ({
  type,
  isOpen,
  onClose,
}) => {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadContent = async () => {
      try {
        const filePath =
          type === 'terms'
            ? '../docs/ksw_terms_of_service.md'
            : '../docs/ksw_privacy_policy.md'

        const content = await invoke('get_markdown_content', {
          filePath,
        })
        setContent(content as string)
      } catch (error) {
        setError(
          `Failed to load ${type === 'terms' ? 'terms of service' : 'privacy policy'}`
        )
        console.error(`Failed to load ${type}:`, error)
      }
    }
    loadContent()
  }, [type])

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="flex flex-col h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-white">
            {type === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
          </h3>
          <button
            className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error ? (
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <p className="text-red-300">{error}</p>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none">
              {type === 'terms' ? (
                <>
                  <h1>TEST NET KALEIDOSWAP TERMS OF USE</h1>
                  <p>
                    <strong>Effective Date: 14 July 2025</strong>
                  </p>

                  <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4 my-6">
                    <p className="text-yellow-300 font-bold mb-4">
                      IMPORTANT NOTICE:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                      <li>
                        THE APP OPERATES ON THE RGB TEST NET PROTOCOL AND TEST
                        NET BITCOIN BLOCKCHAIN.
                      </li>
                      <li>
                        THE APP IS AN EXPERIMENTAL DIGITAL ASSET WALLET
                        APPLICATION.
                      </li>
                      <li>ALL USE OF THE APP IS AT YOUR OWN RISK.</li>
                      <li>
                        YOU SHOULD NOT USE THE APP TO SEND OR RECEIVE TEST NET
                        BTC OR RGB TEST NET TOKENS THAT YOU ARE NOT PREPARED TO
                        LOSE ENTIRELY.
                      </li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <h1>KaleidoSwap Privacy Policy</h1>
                  <p>
                    <strong>Last updated: 14 July 2025</strong>
                  </p>

                  <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4 my-6">
                    <p className="text-yellow-300 font-bold mb-4">
                      IMPORTANT NOTICE:
                    </p>
                    <p>
                      While the RGB protocol and RGB test net protocol attempt
                      to build enhanced privacy into the transactions in RGB
                      tokens or RGB test net tokens, as applicable, no
                      encryption or privacy enhancing systems is ever completely
                      secure. The RGB protocol and RGB test net protocol are
                      experimental protocols and the Apps are experimental
                      wallet applications for those experimental protocols. The
                      Apps are subject to failure and may contain defects. Your
                      transactions using the Apps may be exposed. We do not and
                      we cannot guarantee the security of your data transmitted
                      through the Apps; any transmission is at your own risk.
                    </p>
                  </div>
                </>
              )}

              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-700 bg-gray-900">
          <button
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}

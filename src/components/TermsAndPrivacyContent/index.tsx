import { invoke } from '@tauri-apps/api/core'
import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const isTerms = type === 'terms'

  const noticeItems = useMemo(
    () =>
      t('legal.terms.noticeItems', {
        returnObjects: true,
      }) as string[],
    [t]
  )

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
        setError(t(isTerms ? 'legal.terms.error' : 'legal.privacy.error'))
        console.error(`Failed to load ${type}:`, error)
      }
    }
    loadContent()
  }, [type, t, isTerms])

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="flex flex-col h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h3 className="text-xl font-bold text-white">
            {isTerms ? t('legal.terms.title') : t('legal.privacy.title')}
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
              <h1>
                {isTerms ? t('legal.terms.title') : t('legal.privacy.title')}
              </h1>
              <p>
                <strong>
                  {isTerms
                    ? t('legal.terms.effectiveDate', { date: '14 July 2025' })
                    : t('legal.privacy.lastUpdated', { date: '14 July 2025' })}
                </strong>
              </p>

              <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4 my-6">
                <p className="text-yellow-300 font-bold mb-4">
                  {t('legal.common.noticeTitle')}
                </p>
                {isTerms ? (
                  <ul className="list-disc pl-5 space-y-2">
                    {noticeItems.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{t('legal.privacy.noticeBody')}</p>
                )}
              </div>

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
            {t('common.close')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'

import { Layout } from '../../components/Layout'

export const Component = () => {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    const loadContent = async () => {
      try {
        const content = await invoke('get_markdown_content', {
          filePath: 'desktop-app/docs/ksw_privacy_policy.md',
        })
        setContent(content as string)
      } catch (error) {
        setError(t('legal.privacy.error'))
        console.error('Failed to load privacy policy:', error)
      }
    }
    loadContent()
  }, [t])

  return (
    <Layout>
      <div className="container mx-auto py-8 px-4">
        <div className="prose prose-invert max-w-none">
          {error ? (
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <p className="text-red-300">{error}</p>
            </div>
          ) : (
            <>
              <h1>{t('legal.privacy.title')}</h1>
              <p>
                <strong>
                  {t('legal.privacy.lastUpdated', { date: '14 July 2025' })}
                </strong>
              </p>

              <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4 my-6">
                <p className="text-yellow-300 font-bold mb-4">
                  {t('legal.common.noticeTitle')}
                </p>
                <p>{t('legal.privacy.noticeBody')}</p>
              </div>

              <ReactMarkdown>{content}</ReactMarkdown>

              <div className="flex justify-center mt-8">
                <button
                  className="px-6 py-2 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-lg font-medium transition-colors"
                  onClick={() => navigate(-1)}
                >
                  {t('common.ok')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

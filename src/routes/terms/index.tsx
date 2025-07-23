import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'

import { Layout } from '../../components/Layout'

export const Component = () => {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const loadContent = async () => {
      try {
        const content = await invoke('get_markdown_content', {
          filePath: 'desktop-app/docs/ksw_terms_of_service.md',
        })
        setContent(content as string)
      } catch (error) {
        setError('Failed to load terms of service')
        console.error('Failed to load terms of service:', error)
      }
    }
    loadContent()
  }, [])

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
                    THE APP OPERATES ON THE RGB TEST NET PROTOCOL AND TEST NET
                    BITCOIN BLOCKCHAIN.
                  </li>
                  <li>
                    THE APP IS AN EXPERIMENTAL DIGITAL ASSET WALLET APPLICATION.
                  </li>
                  <li>ALL USE OF THE APP IS AT YOUR OWN RISK.</li>
                  <li>
                    YOU SHOULD NOT USE THE APP TO SEND OR RECEIVE TEST NET BTC
                    OR RGB TEST NET TOKENS THAT YOU ARE NOT PREPARED TO LOSE
                    ENTIRELY.
                  </li>
                </ul>
              </div>

              <ReactMarkdown>{content}</ReactMarkdown>

              <div className="flex justify-center mt-8">
                <button
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  onClick={() => navigate(-1)}
                >
                  Okay
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

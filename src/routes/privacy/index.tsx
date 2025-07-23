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
          filePath: 'desktop-app/docs/ksw_privacy_policy.md',
        })
        setContent(content as string)
      } catch (error) {
        setError('Failed to load privacy policy')
        console.error('Failed to load privacy policy:', error)
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
              <h1>KaleidoSwap Privacy Policy</h1>
              <p>
                <strong>Last updated: 14 July 2025</strong>
              </p>

              <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4 my-6">
                <p className="text-yellow-300 font-bold mb-4">
                  IMPORTANT NOTICE:
                </p>
                <p>
                  While the RGB protocol and RGB test net protocol attempt to
                  build enhanced privacy into the transactions in RGB tokens or
                  RGB test net tokens, as applicable, no encryption or privacy
                  enhancing systems is ever completely secure. The RGB protocol
                  and RGB test net protocol are experimental protocols and the
                  Apps are experimental wallet applications for those
                  experimental protocols. The Apps are subject to failure and
                  may contain defects. Your transactions using the Apps may be
                  exposed. We do not and we cannot guarantee the security of
                  your data transmitted through the Apps; any transmission is at
                  your own risk.
                </p>
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

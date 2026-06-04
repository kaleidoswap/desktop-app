// Pairing — show the P2P pairing QR so the phone can delegate inference to this
// desktop brain.

import { Check, Copy, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import React, { useState } from 'react'

import { MindCard, useMindContext } from './shared'

export const Component: React.FC = () => {
  const mind = useMindContext()
  const { status } = mind
  const providerOn = status?.on === true

  const [copied, setCopied] = useState(false)
  const copyKey = async () => {
    if (!status?.publicKey) return
    try {
      await navigator.clipboard.writeText(status.publicKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <MindCard>
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-5 w-5 text-gray-300" />
        <h2 className="font-semibold text-white">Pair your phone</h2>
      </div>
      {providerOn && status?.publicKey ? (
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-lg bg-white p-3">
            <QRCodeSVG size={196} value={status.publicKey} />
          </div>
          <button
            className="flex items-center gap-2 rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            onClick={copyKey}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="font-mono">
              {status.publicKey.slice(0, 10)}…{status.publicKey.slice(-6)}
            </span>
          </button>
          <p className="max-w-sm text-center text-xs text-gray-500">
            In the KaleidoSwap app: AI → Settings → “Scan QR from desktop” (or
            paste the key).
          </p>
          {status.peers.length > 0 && (
            <div className="mt-1 w-full max-w-sm rounded-md bg-gray-800/50 p-2 text-center text-xs text-gray-300">
              {status.peers.length} phone
              {status.peers.length > 1 ? 's' : ''} connected
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Start the brain with a model (Models tab) to show a pairing QR. The
          phone scans it to run inference here instead of on-device.
        </p>
      )}
    </MindCard>
  )
}

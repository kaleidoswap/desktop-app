import React from 'react'
import QRCode from 'qrcode.react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { formatNumberWithCommas } from '../../../helpers/number'

interface PaymentSectionProps {
  paymentData: any
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({
  paymentData,
}) => {
  const { t } = useTranslation()

  const bolt11Invoice = paymentData?.bolt11?.invoice
  const onchainAddress = paymentData?.onchain?.address
  const amountSat = paymentData?.bolt11?.order_total_sat || paymentData?.onchain?.order_total_sat || 0
  const amountBTC = amountSat / 100_000_000
  const totalAmount = amountSat
  const expiresAt = paymentData?.bolt11?.expires_at || paymentData?.onchain?.expires_at

  let bip21URI = ''
  if (bolt11Invoice && onchainAddress) {
    bip21URI = `bitcoin:${onchainAddress}?amount=${amountBTC}&lightning=${bolt11Invoice}`
  } else if (bolt11Invoice) {
    bip21URI = `lightning:${bolt11Invoice}`
  } else if (onchainAddress) {
    bip21URI = `bitcoin:${onchainAddress}?amount=${amountBTC}`
  }

  return (
    <div className="space-y-3">
      {/* Amount + expiry row */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay/40 border border-border-subtle">
        <div>
          <p className="text-[11px] text-content-tertiary mb-0.5">Send exactly</p>
          <p className="text-lg font-bold text-white">
            {formatNumberWithCommas(totalAmount || 0)}{' '}
            <span className="text-sm text-content-secondary">sats</span>
          </p>
        </div>
        {expiresAt && (
          <div className="text-right">
            <p className="text-[11px] text-content-tertiary mb-0.5">Expires</p>
            <p className="text-xs text-yellow-400 font-medium">
              {new Date(expiresAt).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>

      {/* BIP21 QR */}
      {bip21URI && (
        <div className="flex justify-center p-5 rounded-xl bg-white/5 border border-border-subtle">
          <div className="bg-white p-3 rounded-xl shadow-lg">
            <QRCode size={168} value={bip21URI} />
          </div>
        </div>
      )}

      {/* Copy buttons side by side */}
      <div className="grid grid-cols-2 gap-2">
        {bolt11Invoice && (
          <CopyToClipboard onCopy={() => toast.success(t('buyChannel.copySuccess'))} text={bolt11Invoice}>
            <button className="py-2.5 rounded-xl text-xs font-semibold bg-surface-overlay border border-border-subtle hover:border-blue-400/50 hover:text-blue-300 transition-all flex items-center justify-center gap-1.5">
              ⚡ {t('buyChannel.copyInvoice')}
            </button>
          </CopyToClipboard>
        )}
        {onchainAddress && (
          <CopyToClipboard onCopy={() => toast.success(t('buyChannel.copySuccess'))} text={onchainAddress}>
            <button className="py-2.5 rounded-xl text-xs font-semibold bg-surface-overlay border border-border-subtle hover:border-amber-400/50 hover:text-amber-300 transition-all flex items-center justify-center gap-1.5">
              ₿ {t('buyChannel.copyAddress')}
            </button>
          </CopyToClipboard>
        )}
      </div>

      {/* Instructions */}
      <p className="text-[11px] text-content-tertiary text-center">
        {t('buyChannel.bip21Instructions', 'Scan with any Bitcoin wallet — it will automatically choose Lightning or on-chain.')}
      </p>
    </div>
  )
}

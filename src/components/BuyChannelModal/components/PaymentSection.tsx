import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import type { ReactNode } from 'react'

import { formatNumberWithCommas } from '../../../helpers/number'
import BitcoinLogo from '../../../assets/bitcoin-logo.svg'
import LightningLogo from '../../../assets/lightning-logo.svg'

interface PaymentSectionText {
  amountLabel: string
  copyAddress: string
  copyId: string
  copyInvoice: string
  lightningAddressLabel: string
  lightningAddressTitle: string
  onchainAddressLabel: string
  onchainAddressTitle: string
  paymentDescription: string
  paymentEyebrow: string
  paymentTitle: string
  qrBadge: string
  qrDescription: string
  qrTitle: string
}

interface PaymentSectionProps {
  amountDisplay?: string
  countdown?: ReactNode
  onCopy?: () => void
  paymentData: any
  text?: Partial<PaymentSectionText>
  walletSection?: ReactNode
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({
  amountDisplay,
  countdown,
  onCopy,
  paymentData,
  text,
  walletSection,
}) => {
  const { t } = useTranslation()

  const bolt11Invoice = paymentData?.bolt11?.invoice
  const onchainAddress = paymentData?.onchain?.address
  const amountSat =
    paymentData?.bolt11?.order_total_sat ||
    paymentData?.onchain?.order_total_sat ||
    0
  const amountBTC = amountSat / 100_000_000

  const bip21URI =
    bolt11Invoice && onchainAddress
      ? `bitcoin:${onchainAddress}?amount=${amountBTC}&lightning=${bolt11Invoice}`
      : bolt11Invoice
        ? `lightning:${bolt11Invoice}`
        : onchainAddress
          ? `bitcoin:${onchainAddress}?amount=${amountBTC}`
          : ''

  const copySuccess = () => {
    if (onCopy) {
      onCopy()
    } else {
      toast.success(t('buyChannel.copySuccess'))
    }
  }

  const labels: PaymentSectionText = {
    amountLabel:
      text?.amountLabel || t('components.buyChannelModal.sendExactly'),
    copyAddress: text?.copyAddress || t('buyChannel.copyAddress'),
    copyId: text?.copyId || 'Copy ID',
    copyInvoice: text?.copyInvoice || t('buyChannel.copyInvoice'),
    lightningAddressLabel:
      text?.lightningAddressLabel || t('buyChannel.lightning'),
    lightningAddressTitle:
      text?.lightningAddressTitle ||
      t('components.buyChannelModal.lightningInvoice'),
    onchainAddressLabel: text?.onchainAddressLabel || t('buyChannel.onchain'),
    onchainAddressTitle:
      text?.onchainAddressTitle ||
      t('components.buyChannelModal.onchainAddress'),
    paymentDescription:
      text?.paymentDescription ??
      t('components.buyChannelModal.paymentDescription'),
    paymentEyebrow:
      text?.paymentEyebrow ?? t('components.buyChannelModal.paymentEyebrow'),
    paymentTitle:
      text?.paymentTitle ?? t('components.buyChannelModal.paymentTitle'),
    qrBadge: text?.qrBadge || t('components.buyChannelModal.unifiedQrBadge'),
    qrDescription:
      text?.qrDescription ||
      t('components.buyChannelModal.unifiedQrDescription'),
    qrTitle: text?.qrTitle || t('components.buyChannelModal.unifiedQrTitle'),
  }

  const hasHeader = !!(
    labels.paymentEyebrow ||
    labels.paymentTitle ||
    labels.paymentDescription
  )

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {hasHeader && (
          <div className="min-w-0">
            {labels.paymentEyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-content-tertiary">
                {labels.paymentEyebrow}
              </p>
            )}
            {labels.paymentTitle && (
              <h3 className="mt-2 text-xl font-semibold text-content-primary">
                {labels.paymentTitle}
              </h3>
            )}
            {labels.paymentDescription && (
              <p className="mt-2 text-sm text-content-secondary">
                {labels.paymentDescription}
              </p>
            )}
          </div>
        )}
        <div className="flex items-stretch gap-4 w-full">
          <div className="shrink-0 rounded-xl border border-border-subtle bg-surface-overlay/60 px-3 py-2">
            <p className="text-sm font-medium text-content-primary">
              {labels.amountLabel}
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {amountDisplay || `${formatNumberWithCommas(amountSat)} SATS`}
            </p>
          </div>
          {countdown && <div className="flex-1">{countdown}</div>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        {/* Left: QR code */}
        {bip21URI && (
          <div className="rounded-[22px] border border-border-subtle bg-surface-overlay/50 p-4 flex flex-col items-center justify-center">
            <p className="text-sm font-medium text-content-primary mb-3">
              {labels.qrTitle}
            </p>
            <div className="w-full max-w-[200px] rounded-2xl bg-white p-3 shadow-lg">
              <QRCodeSVG
                size={256}
                style={{ display: 'block', height: 'auto', width: '100%' }}
                value={bip21URI}
              />
            </div>
            <span
              className="mt-3 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80"
              style={{
                background:
                  'linear-gradient(to right, rgba(249,115,22,0.15), rgba(234,179,8,0.15))',
                border: '1px solid rgba(249,115,22,0.25)',
              }}
            >
              Onchain + LN
            </span>
          </div>
        )}

        {/* Right: Onchain + Lightning stacked */}
        <div className="flex flex-col gap-4">
          {onchainAddress && (
            <div className="min-w-0 rounded-xl border border-border-subtle bg-surface-overlay/60 p-3.5 flex-1">
              <div className="flex items-center gap-1.5 mb-2.5">
                <img alt="Bitcoin" className="w-3.5 h-3.5" src={BitcoinLogo} />
                <p className="text-sm font-medium text-content-primary">
                  Onchain address
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-border-subtle bg-surface-base/45 px-3 py-2.5">
                <p className="flex-1 font-mono text-[11px] leading-5 text-content-primary break-all">
                  {onchainAddress}
                </p>
                <CopyToClipboard onCopy={copySuccess} text={onchainAddress}>
                  <button
                    className="shrink-0 mt-0.5 text-content-tertiary hover:text-white transition-colors"
                    type="button"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </CopyToClipboard>
              </div>
            </div>
          )}

          {bolt11Invoice && (
            <div className="min-w-0 rounded-xl border border-border-subtle bg-surface-overlay/60 p-3.5 flex-1">
              <div className="flex items-center gap-1.5 mb-2.5">
                <img
                  alt="Lightning"
                  className="w-3.5 h-3.5"
                  src={LightningLogo}
                />
                <p className="text-sm font-medium text-content-primary">
                  Lightning invoice
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-border-subtle bg-surface-base/45 px-3 py-2.5">
                <p className="flex-1 font-mono text-[11px] leading-5 text-content-primary break-all">
                  {bolt11Invoice.length > 70
                    ? bolt11Invoice.slice(0, 30) +
                      '...' +
                      bolt11Invoice.slice(-30)
                    : bolt11Invoice}
                </p>
                <CopyToClipboard onCopy={copySuccess} text={bolt11Invoice}>
                  <button
                    className="shrink-0 mt-0.5 text-content-tertiary hover:text-white transition-colors"
                    type="button"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </CopyToClipboard>
              </div>
            </div>
          )}
        </div>
      </div>

      {walletSection && <div>{walletSection}</div>}
    </div>
  )
}

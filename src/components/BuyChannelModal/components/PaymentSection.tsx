import React from 'react'
import { QRCodeSVG } from 'qrcode.react'
import CopyToClipboard from 'react-copy-to-clipboard'
import { Copy, QrCode } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import type { ReactNode } from 'react'

import { formatNumberWithCommas } from '../../../helpers/number'

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
      text?.paymentDescription ||
      t('components.buyChannelModal.paymentDescription'),
    paymentEyebrow:
      text?.paymentEyebrow || t('components.buyChannelModal.paymentEyebrow'),
    paymentTitle:
      text?.paymentTitle || t('components.buyChannelModal.paymentTitle'),
    qrBadge: text?.qrBadge || t('components.buyChannelModal.unifiedQrBadge'),
    qrDescription:
      text?.qrDescription ||
      t('components.buyChannelModal.unifiedQrDescription'),
    qrTitle: text?.qrTitle || t('components.buyChannelModal.unifiedQrTitle'),
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-content-tertiary">
            {labels.paymentEyebrow}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-content-primary">
            {labels.paymentTitle}
          </h3>
          <p className="mt-2 text-sm text-content-secondary">
            {labels.paymentDescription}
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <div className="w-fit rounded-xl border border-border-subtle bg-surface-overlay/60 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-content-tertiary">
              {labels.amountLabel}
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-300">
              {amountDisplay || `${formatNumberWithCommas(amountSat)} sats`}
            </p>
          </div>
          {countdown && <div className="w-full lg:w-fit">{countdown}</div>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        {bip21URI && (
          <div className="rounded-[22px] border border-border-subtle bg-surface-overlay/50 p-4 h-full flex flex-col">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-400/12 text-blue-200">
                <QrCode className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-content-primary">
                    {labels.qrTitle}
                  </p>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    {labels.qrBadge}
                  </span>
                </div>
                <p className="mt-1 text-xs text-content-secondary">
                  {labels.qrDescription}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-border-subtle bg-white/5 p-3">
              <div className="mx-auto w-full max-w-[200px] rounded-[16px] bg-white p-3 shadow-lg">
                <QRCodeSVG
                  size={256}
                  style={{ display: 'block', height: 'auto', width: '100%' }}
                  value={bip21URI}
                />
              </div>
            </div>
          </div>
        )}

        {walletSection && <div className="h-full">{walletSection}</div>}
      </div>

      <div className="space-y-4">
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {bolt11Invoice && (
            <div className="min-w-0 rounded-[18px] border border-cyan-400/18 bg-cyan-400/6 p-3.5">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-content-tertiary">
                    {labels.lightningAddressTitle}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-cyan-100">
                    {labels.lightningAddressLabel}
                  </p>
                </div>
                <CopyToClipboard onCopy={copySuccess} text={bolt11Invoice}>
                  <button className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-base/70 px-2 py-1 text-[11px] font-medium text-content-primary transition-colors hover:border-cyan-400/40 hover:text-cyan-200">
                    <Copy className="h-3 w-3" />
                    {labels.copyInvoice}
                  </button>
                </CopyToClipboard>
              </div>

              <p className="mt-3 max-h-24 overflow-auto break-all rounded-2xl border border-border-subtle bg-surface-base/45 px-3 py-2.5 font-mono text-[11px] leading-5 text-content-primary">
                {bolt11Invoice}
              </p>
            </div>
          )}

          {onchainAddress && (
            <div className="min-w-0 rounded-[18px] border border-amber-400/18 bg-amber-400/6 p-3.5">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-content-tertiary">
                    {labels.onchainAddressTitle}
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-amber-100">
                    {labels.onchainAddressLabel}
                  </p>
                </div>
                <CopyToClipboard onCopy={copySuccess} text={onchainAddress}>
                  <button className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-base/70 px-2 py-1 text-[11px] font-medium text-content-primary transition-colors hover:border-amber-400/40 hover:text-amber-200">
                    <Copy className="h-3 w-3" />
                    {labels.copyAddress}
                  </button>
                </CopyToClipboard>
              </div>

              <p className="mt-3 max-h-24 overflow-auto break-all rounded-2xl border border-border-subtle bg-surface-base/45 px-3 py-2.5 font-mono text-[11px] leading-5 text-content-primary">
                {onchainAddress}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

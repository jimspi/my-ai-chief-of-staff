'use client'

import { useState, useEffect } from 'react'
import { QrCode, Copy, Check } from 'lucide-react'
import QRCode from 'qrcode'
import { useToast } from '@/contexts/ToastContext'

export default function QRCodePage() {
  const { addToast } = useToast()
  const [svgData, setSvgData] = useState('')
  const [copied, setCopied] = useState(false)

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/register`
    : 'https://my-ai-chief-of-staff.vercel.app/register'

  useEffect(() => {
    QRCode.toString(shareUrl, {
      type: 'svg',
      margin: 2,
      color: { dark: '#e0e0e0', light: '#00000000' },
      errorCorrectionLevel: 'M',
    }).then(setSvgData)
  }, [shareUrl])

  async function handleCopyLink() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    addToast('Link copied to clipboard', 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 flex flex-col items-center">
      <div className="card p-8 max-w-sm w-full text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <QrCode className="w-5 h-5 text-accent-teal" />
          <h2 className="font-heading text-xl text-text-primary">Share Access</h2>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          Scan to create an account on AI Chief of Staff
        </p>

        {/* QR Code */}
        <div className="bg-surface-bg rounded-xl p-6 mb-6 inline-block">
          {svgData ? (
            <div
              className="w-56 h-56 mx-auto"
              dangerouslySetInnerHTML={{ __html: svgData }}
            />
          ) : (
            <div className="w-56 h-56 animate-pulse bg-surface-border rounded" />
          )}
        </div>

        {/* URL + Copy */}
        <div className="flex items-center gap-2 bg-surface-bg rounded-lg p-3 mb-4">
          <span className="text-xs text-text-secondary truncate flex-1 text-left">{shareUrl}</span>
          <button
            onClick={handleCopyLink}
            className="shrink-0 p-1.5 rounded-button text-text-secondary hover:text-accent-teal transition-colors"
            title="Copy link"
          >
            {copied ? <Check className="w-4 h-4 text-status-success" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <p className="text-xs text-text-secondary">
          Anyone who scans this code or visits the link can sign up for their own account.
        </p>
      </div>
    </div>
  )
}

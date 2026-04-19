'use client'

import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { phoneForUrl } from '@/lib/phone'

interface PhoneDisplayProps {
  phone: string
  className?: string
}

export function PhoneDisplay({ phone, className }: PhoneDisplayProps) {
  const stripped = phoneForUrl(phone)

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(stripped)
    toast.success('Đã sao chép số điện thoại')
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <a
        href={`tel:${stripped}`}
        onClick={(e) => e.stopPropagation()}
        className="font-mono hover:underline hover:text-primary transition-colors"
      >
        {phone}
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="text-muted-foreground hover:text-primary transition-colors shrink-0"
        aria-label="Sao chép số điện thoại"
        title="Sao chép số điện thoại"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

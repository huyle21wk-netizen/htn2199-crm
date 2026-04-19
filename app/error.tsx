'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="vi">
      <body className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center text-center gap-4 max-w-md">
          <div className="p-4 rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Đã xảy ra lỗi</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Có lỗi không mong muốn. Vui lòng thử lại.
            </p>
          </div>
          <Button onClick={reset}>Thử lại</Button>
        </div>
      </body>
    </html>
  )
}

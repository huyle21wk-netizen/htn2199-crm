import Link from 'next/link'
import { MapPin } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="flex flex-col items-center text-center gap-4 max-w-md">
        <div className="p-4 rounded-full bg-accent">
          <MapPin className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-4xl font-bold text-[#7C3AED] mb-2">404</h1>
          <h2 className="text-xl font-semibold">Trang không tồn tại</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Trang bạn đang tìm không có hoặc đã bị xoá.
          </p>
        </div>
        <Link
          href="/contacts"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { FolderOpen, Layers, Trash2, User } from 'lucide-react'

const items = [
  {
    href: '/settings/projects',
    icon: FolderOpen,
    title: 'Dự án',
    desc: 'Quản lý danh sách dự án bất động sản',
  },
  {
    href: '/settings/stages',
    icon: Layers,
    title: 'Giai đoạn',
    desc: 'Tuỳ chỉnh các bước trong quy trình bán hàng',
  },
  {
    href: '/settings/bad-numbers',
    icon: Trash2,
    title: 'Số rác',
    desc: 'Xem, export hoặc xoá các số điện thoại rác',
  },
  {
    href: '/settings/account',
    icon: User,
    title: 'Tài khoản',
    desc: 'Thông tin tài khoản và đăng xuất',
    soon: true,
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold">Cài đặt</h1>
      <div className="grid gap-2">
        {items.map((item) => {
          const Icon = item.icon
          const content = (
            <div className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-secondary/30 transition-colors">
              <div className="p-2 rounded-md bg-accent">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.soon && (
                    <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                      Sắp có
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          )

          return item.soon ? (
            <div key={item.href} className="opacity-60 cursor-not-allowed">
              {content}
            </div>
          ) : (
            <Link key={item.href} href={item.href}>
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

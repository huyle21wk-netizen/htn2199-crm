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
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold">Cài đặt</h1>
      <div className="grid gap-2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}>
              <div className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-secondary/30 transition-colors">
                <div className="p-2 rounded-md bg-accent">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

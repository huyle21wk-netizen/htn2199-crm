# CRM — Quản lý khách hàng cá nhân

Personal CRM cho sales bất động sản tại Việt Nam.

---

## Cài đặt local

### 1. Cài dependencies

```bash
pnpm install
```

### 2. Cấu hình biến môi trường

Sao chép file mẫu và điền thông tin Supabase:

```bash
cp .env.local.example .env.local
```

Mở `.env.local` và điền:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> Lấy các giá trị này trong Supabase dashboard → Project Settings → API.

### 3. Chạy ứng dụng

```bash
pnpm dev
```

Mở [http://localhost:3000](http://localhost:3000).

---

## Cài đặt Supabase

### Bước 1: Chạy migration SQL

1. Vào [Supabase Dashboard](https://app.supabase.com) → chọn project
2. Vào **SQL Editor**
3. Copy toàn bộ nội dung file `supabase/migrations/001_init.sql`
4. Paste vào SQL Editor và nhấn **Run**

Kiểm tra sau khi chạy:
- 4 tables tồn tại: `projects`, `stages`, `contacts`, `contact_logs`
- Bảng `stages` có 10 rows (Raw → Số rác)
- RLS đã bật trên cả 4 tables

### Bước 2: Tạo tài khoản người dùng

Chỉ tạo thủ công tối đa 2 tài khoản (không có signup public):

1. Vào Supabase Dashboard → **Authentication** → **Users**
2. Nhấn **Invite user** (hoặc **Add user** → **Create new user**)
3. Nhập email + password
4. Lặp lại cho tài khoản thứ 2 (nếu cần)

---

## Deploy lên Vercel

### Bước 1: Push code lên GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/crm-app.git
git push -u origin main
```

### Bước 2: Kết nối Vercel

1. Vào [vercel.com](https://vercel.com) → **Add New Project**
2. Chọn GitHub repo vừa tạo
3. Framework preset: **Next.js** (tự động nhận diện)

### Bước 3: Cấu hình biến môi trường

Trong Vercel project settings → **Environment Variables**, thêm:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL của Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key của Supabase project |

### Bước 4: Deploy

Nhấn **Deploy**. Mỗi lần push lên `main` sẽ tự động deploy.

---

## Cấu trúc project

```
crm-app/
├── app/
│   ├── (app)/              # Routes cần auth
│   │   ├── contacts/
│   │   ├── kanban/
│   │   ├── calendar/
│   │   ├── report/
│   │   ├── settings/
│   │   └── layout.tsx      # App shell (sidebar)
│   ├── login/              # Trang đăng nhập
│   ├── layout.tsx          # Root layout (font, theme)
│   └── page.tsx            # Redirect → /contacts
├── components/
│   ├── sidebar.tsx         # Sidebar + mobile drawer
│   ├── theme-provider.tsx
│   ├── theme-toggle.tsx
│   └── ui/                 # shadcn/ui components
├── lib/
│   └── supabase/
│       ├── client.ts       # Browser client
│       └── server.ts       # Server client
├── middleware.ts            # Session refresh + route protection
└── supabase/
    └── migrations/
        └── 001_init.sql    # Database schema + seed
```

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Mail, LogOut, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
})

type PasswordForm = z.infer<typeof passwordSchema>

export function AccountClient({ email }: { email: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const onChangePassword = async (data: PasswordForm) => {
    // Verify current password by signing in again
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: data.currentPassword,
    })
    if (signInError) {
      toast.error('Mật khẩu hiện tại không đúng.')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: data.newPassword })
    if (error) {
      toast.error('Không thể đổi mật khẩu. Vui lòng thử lại.')
      return
    }

    toast.success('Đã đổi mật khẩu thành công.')
    reset()
    setShowPasswordForm(false)
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-2xl font-semibold">Tài khoản</h1>

      {/* Email info */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Email đăng nhập</p>
            <p className="text-sm font-medium truncate">{email || '—'}</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Change password */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Mật khẩu</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPasswordForm((v) => !v)}
          >
            {showPasswordForm ? 'Huỷ' : 'Đổi mật khẩu'}
          </Button>
        </div>

        {showPasswordForm && (
          <form onSubmit={handleSubmit(onChangePassword)} className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
              <Input
                id="currentPassword"
                type="password"
                {...register('currentPassword')}
                className={errors.currentPassword ? 'border-destructive' : ''}
              />
              {errors.currentPassword && (
                <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <Input
                id="newPassword"
                type="password"
                {...register('newPassword')}
                className={errors.newPassword ? 'border-destructive' : ''}
              />
              {errors.newPassword && (
                <p className="text-xs text-destructive">{errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                className={errors.confirmPassword ? 'border-destructive' : ''}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</>
              ) : (
                'Lưu mật khẩu mới'
              )}
            </Button>
          </form>
        )}
      </div>

      <Separator />

      {/* Logout */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Đăng xuất</p>
          <p className="text-xs text-muted-foreground mt-0.5">Kết thúc phiên làm việc hiện tại</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <><LogOut className="h-4 w-4" /> Đăng xuất</>
          )}
        </Button>
      </div>

      {/* Logout confirm — not used per spec, but logout button is here */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Đăng xuất?</AlertDialogTitle>
            <AlertDialogDescription>Bạn sẽ được chuyển về trang đăng nhập.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Đăng xuất</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

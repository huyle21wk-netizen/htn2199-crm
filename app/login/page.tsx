"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast.error("Email hoặc mật khẩu không đúng");
      setLoading(false);
      return;
    }

    router.push("/contacts");
    router.refresh();
  };

  const handleForgotPassword = async () => {
    const email = getValues("email");
    if (!email) {
      toast.error("Vui lòng nhập email trước");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) {
      toast.error("Không thể gửi email đặt lại mật khẩu");
    } else {
      setResetSent(true);
      toast.success("Email đặt lại mật khẩu đã được gửi");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
      }}
    >
      <div className="w-full max-w-[400px] bg-card rounded-lg shadow-lg p-8 space-y-6">
        {/* Logo */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold">
            <span
              style={{
                background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              CRM
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Quản lý khách hàng cá nhân
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="email"
                type="email"
                placeholder="ten@email.com"
                autoComplete="email"
                className="w-full pl-10 pr-3 h-10 rounded-md border border-input bg-background text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="password">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full pl-10 pr-3 h-10 rounded-md border border-input bg-background text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                {...register("password")}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-md text-sm font-semibold text-white transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)" }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Đăng nhập
          </button>
        </form>

        {/* Forgot password */}
        <div className="text-center">
          {resetSent ? (
            <p className="text-xs text-success">
              Email đặt lại mật khẩu đã được gửi. Kiểm tra hộp thư của bạn.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Quên mật khẩu?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

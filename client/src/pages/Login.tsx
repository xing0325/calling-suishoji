import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type LoginMode = "password" | "email";
type AuthMode = "login" | "register";

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<LoginMode>("password");
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  // 账号密码表单
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // 邮箱验证码表单
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success("注册成功，欢迎加入 CALLING！");
      onLoginSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const loginPasswordMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: () => {
      toast.success("登录成功！");
      onLoginSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const sendCodeMutation = trpc.auth.sendEmailCode.useMutation({
    onSuccess: () => {
      setCodeSent(true);
      setCountdown(60);
      toast.success("验证码已发送，请查收邮件");
    },
    onError: (err) => toast.error(err.message),
  });

  const loginEmailMutation = trpc.auth.loginWithEmailCode.useMutation({
    onSuccess: () => {
      toast.success("登录成功！");
      onLoginSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === "register") {
      registerMutation.mutate({ username, password, name: displayName || username });
    } else {
      loginPasswordMutation.mutate({ username, password });
    }
  };

  const handleSendCode = () => {
    if (!email) return toast.error("请输入邮箱地址");
    sendCodeMutation.mutate({ email });
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeSent) return toast.error("请先发送验证码");
    loginEmailMutation.mutate({ email, code });
  };

  const isLoading =
    registerMutation.isPending ||
    loginPasswordMutation.isPending ||
    loginEmailMutation.isPending;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(135deg, #0F1419 0%, #1a1040 100%)" }}
    >
      {/* 背景装饰 */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, #7C3AED 0%, transparent 50%), radial-gradient(circle at 70% 80%, #4F46E5 0%, transparent 50%)",
        }}
      />

      <div className="relative w-full max-w-sm px-6">
        {/* Logo区域 */}
        <div className="text-center mb-10">
          <h1
            className="text-4xl font-bold text-white mb-2"
            style={{ fontFamily: "Poppins, sans-serif", letterSpacing: "0.1em" }}
          >
            CALLING
          </h1>
          <p className="text-sm" style={{ color: "#9F7AEA" }}>
            用爱呼唤你自己
          </p>
        </div>

        {/* 登录卡片 */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {/* 登录方式切换 */}
          <div
            className="flex rounded-xl p-1 mb-6"
            style={{ background: "rgba(0,0,0,0.3)" }}
          >
            <button
              onClick={() => setMode("password")}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: mode === "password" ? "#7C3AED" : "transparent",
                color: mode === "password" ? "white" : "rgba(255,255,255,0.5)",
              }}
            >
              账号密码
            </button>
            <button
              onClick={() => setMode("email")}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: mode === "email" ? "#7C3AED" : "transparent",
                color: mode === "email" ? "white" : "rgba(255,255,255,0.5)",
              }}
            >
              邮箱验证码
            </button>
          </div>

          {/* 账号密码登录/注册 */}
          {mode === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* 注册/登录切换 */}
              <div className="flex gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className="text-sm font-medium transition-colors"
                  style={{ color: authMode === "login" ? "white" : "rgba(255,255,255,0.4)" }}
                >
                  登录
                </button>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
                <button
                  type="button"
                  onClick={() => setAuthMode("register")}
                  className="text-sm font-medium transition-colors"
                  style={{ color: authMode === "register" ? "white" : "rgba(255,255,255,0.4)" }}
                >
                  注册
                </button>
              </div>

              {authMode === "register" && (
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                    昵称（可选）
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="你想让别人怎么称呼你？"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="输入用户名"
                  required
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "white",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={authMode === "register" ? "至少6位" : "输入密码"}
                  required
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "white",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !username || !password}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50"
                style={{ background: "#7C3AED", color: "white" }}
              >
                {isLoading ? "请稍候..." : authMode === "register" ? "注册并登录" : "登录"}
              </button>
            </form>
          )}

          {/* 邮箱验证码登录 */}
          {mode === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  邮箱地址
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sendCodeMutation.isPending || countdown > 0}
                    className="px-3 py-3 rounded-xl text-xs font-medium transition-all whitespace-nowrap disabled:opacity-50"
                    style={{
                      background: countdown > 0 ? "rgba(255,255,255,0.1)" : "#7C3AED",
                      color: "white",
                      minWidth: "72px",
                    }}
                  >
                    {sendCodeMutation.isPending
                      ? "发送中"
                      : countdown > 0
                      ? `${countdown}s`
                      : "发送验证码"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                  验证码
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="输入6位验证码"
                  maxLength={6}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all tracking-widest"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "white",
                    fontSize: "18px",
                    letterSpacing: "0.3em",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#7C3AED")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !email || code.length !== 6}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50"
                style={{ background: "#7C3AED", color: "white" }}
              >
                {isLoading ? "验证中..." : "登录 / 注册"}
              </button>

              <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                未注册的邮箱将自动创建账号
              </p>
            </form>
          )}
        </div>

        {/* 底部说明 */}
        <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>
          登录即表示你同意使用条款 · 数据安全加密存储
        </p>
      </div>
    </div>
  );
}

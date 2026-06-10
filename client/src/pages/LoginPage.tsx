import { FormEvent, useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CaptchaBox } from "../components/CaptchaBox";
import { authApi } from "../services/authApi";
import { ApiError } from "../services/http";
import { useAuthStore } from "../stores/authStore";

type AuthMode = "login" | "register";
type CaptchaRequiredData = {
  captcha_required?: boolean;
};

const usernamePattern = /^\w{3,20}$/;
const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [mode, setMode] = useState<AuthMode>("login");
  const [nickname, setNickname] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaVerifyParam, setCaptchaVerifyParam] = useState("");
  const [loginNeedsCaptcha, setLoginNeedsCaptcha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const updateCaptcha = useCallback((value: string) => {
    setCaptchaVerifyParam(value);
  }, []);

  const showCaptcha = mode === "register" || loginNeedsCaptcha;

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setCaptchaVerifyParam("");
    if (nextMode === "register") {
      setLoginNeedsCaptcha(false);
    }
  }

  function validate() {
    if (mode === "register" && nickname.trim().length > 24) {
      return "昵称最多 24 个字符";
    }
    if (!usernamePattern.test(username)) {
      return "登录账号需为 3-20 位英文、数字或下划线";
    }
    if (!passwordPattern.test(password)) {
      return "密码至少 8 位，且必须包含字母和数字";
    }
    if (mode === "register" && password !== confirmPassword) {
      return "两次输入的密码不一致";
    }
    if (showCaptcha && !captchaVerifyParam) {
      return "请先完成人机验证";
    }
    return "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationMessage = validate();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const result =
        mode === "register"
          ? await authApi.register(username, password, captchaVerifyParam, nickname)
          : await authApi.login(username, password, captchaVerifyParam);
      setAuth(result.token, result.user);
      navigate("/");
    } catch (error) {
      if (error instanceof ApiError && (error.data as CaptchaRequiredData | null)?.captcha_required) {
        setLoginNeedsCaptcha(true);
        setCaptchaVerifyParam("");
        setMessage(error.message || "登录失败次数过多，请完成人机验证");
      } else {
        setMessage(error instanceof Error ? error.message : mode === "register" ? "注册失败" : "登录失败");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white bg-[linear-gradient(#eaf1fb_1px,transparent_1px),linear-gradient(90deg,#eaf1fb_1px,transparent_1px)] bg-[size:56px_56px] px-4 py-8 text-ink">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-md flex-col justify-center">
        <Link to="/" className="mb-8 flex justify-center">
          <img src="/logo/getoffer_nobg.png" alt="GetOffer" className="h-24 w-auto object-contain" />
        </Link>

        <section className="border border-blue-100 bg-white/95 p-7 shadow-[0_24px_80px_rgba(37,99,235,0.12)] backdrop-blur">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand">
              Secure Login
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-ink">
              {mode === "login" ? "登录" : "注册"}
            </h1>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-5">
            {mode === "register" && (
              <label className="block">
                <span className="text-sm font-semibold text-ink">昵称</span>
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  className="mt-2 h-12 w-full border border-slate-200 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-blue-50"
                  placeholder="请输入你的昵称"
                  autoComplete="nickname"
                />
              </label>
            )}

            <label className="block">
              <span className="text-sm font-semibold text-ink">用户名</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 h-12 w-full border border-slate-200 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-blue-50"
                placeholder="请输入你的登陆账号"
                autoComplete="username"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-ink">密码</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-12 w-full border border-slate-200 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-blue-50"
                placeholder="请输入密码，至少8位，包含字母和数字"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>

            {mode === "register" && (
              <label className="block">
                <span className="text-sm font-semibold text-ink">确认密码</span>
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-2 h-12 w-full border border-slate-200 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-blue-50"
                  placeholder="请再次输入密码"
                  type="password"
                  autoComplete="new-password"
                />
              </label>
            )}

            {showCaptcha && <CaptchaBox onVerified={updateCaptcha} onError={setMessage} />}

            {message && <p className="text-sm text-muted">{message}</p>}

            <button
              disabled={loading}
              className="h-12 w-full bg-brand text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
            >
              {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
            </button>
          </form>

          <div className="mt-7 border-t border-slate-100 pt-5 text-sm text-muted">
            {mode === "login" ? (
              <button type="button" onClick={() => switchMode("register")} className="hover:text-brand">
                还没有账号？去注册
              </button>
            ) : (
              <button type="button" onClick={() => switchMode("login")} className="hover:text-brand">
                已有账号？去登录
              </button>
            )}
          </div>
        </section>

        <footer className="mt-6 text-center text-xs text-muted">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 hover:text-brand"
          >
            <img src="/logo/foot-icp.png" alt="" className="h-4 w-4 object-contain" />
            陕ICP备2026014560号-1
          </a>
        </footer>
      </div>
    </main>
  );
}

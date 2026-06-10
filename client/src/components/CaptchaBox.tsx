import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { USE_MOCK } from "../services/http";

type CaptchaBoxProps = {
  onVerified: (captchaVerifyParam: string) => void;
  onError?: (message: string) => void;
};

type AliyunCaptchaInstance = {
  refresh?: () => void;
  show?: () => void;
  startTracelessVerification?: () => void;
};

declare global {
  interface Window {
    AliyunCaptchaConfig?: {
      region: "cn" | "sgp";
      prefix: string;
    };
    initAliyunCaptcha?: (options: Record<string, unknown>) => void;
  }
}

const captchaScriptId = "aliyun-captcha-v2-script";
const captchaScriptUrl = "https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js";

function isLocalDemoCaptchaBypass() {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_DEMO_CAPTCHA_BYPASS === "true" &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
  );
}

function loadCaptchaScript(region: "cn" | "sgp", prefix: string) {
  window.AliyunCaptchaConfig = { region, prefix };

  return new Promise<void>((resolve, reject) => {
    if (window.initAliyunCaptcha) {
      resolve();
      return;
    }

    const existing = document.getElementById(captchaScriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("验证码脚本加载失败")), {
        once: true
      });
      return;
    }

    const script = document.createElement("script");
    script.id = captchaScriptId;
    script.src = captchaScriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("验证码脚本加载失败"));
    document.head.appendChild(script);
  });
}

export function CaptchaBox({ onVerified, onError }: CaptchaBoxProps) {
  const rawId = useId().replace(/:/g, "");
  const elementId = `aliyun-captcha-${rawId}`;
  const buttonId = `aliyun-captcha-button-${rawId}`;
  const sceneId = import.meta.env.VITE_ALIYUN_CAPTCHA_SCENE_ID || "";
  const prefix = import.meta.env.VITE_ALIYUN_CAPTCHA_PREFIX || "";
  const region = import.meta.env.VITE_ALIYUN_CAPTCHA_REGION === "sgp" ? "sgp" : "cn";
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const demoCaptchaBypass = isLocalDemoCaptchaBypass();

    if (USE_MOCK || demoCaptchaBypass) {
      setVerified(true);
      setMessage(demoCaptchaBypass ? "本地 demo 验证码已通过" : "mock 模式已通过人机验证");
      onVerified("mock_captcha_pass");
      return;
    }

    if (!prefix || !sceneId) {
      const text = "缺少 VITE_ALIYUN_CAPTCHA_PREFIX 或 VITE_ALIYUN_CAPTCHA_SCENE_ID，无法初始化验证码";
      setMessage(text);
      onError?.(text);
      return;
    }

    let disposed = false;
    let captcha: AliyunCaptchaInstance | null = null;

    loadCaptchaScript(region, prefix)
      .then(() => {
        if (disposed || !window.initAliyunCaptcha) return;
        window.initAliyunCaptcha({
          SceneId: sceneId,
          mode: "embed",
          element: `#${elementId}`,
          button: `#${buttonId}`,
          language: "cn",
          slideStyle: {
            width: 360,
            height: 40
          },
          success: (captchaVerifyParam: string) => {
            if (captchaVerifyParam) {
              setVerified(true);
              setMessage("人机验证已通过");
              onVerified(captchaVerifyParam);
            }
          },
          fail: (result: unknown) => {
            setVerified(false);
            setMessage("人机验证未通过，请重试");
            if (import.meta.env.DEV) {
              console.warn("Aliyun captcha failed", result);
            }
          },
          getInstance: (instance: AliyunCaptchaInstance) => {
            captcha = instance;
          },
          onError: (errorInfo: { code?: string; msg?: string }) => {
            const text = errorInfo?.msg || "验证码初始化失败";
            setMessage(text);
            onError?.(text);
          }
        });
      })
      .catch((error: Error) => {
        setMessage(error.message);
        onError?.(error.message);
      });

    return () => {
      disposed = true;
      captcha = null;
    };
  }, [elementId, buttonId, onError, onVerified, prefix, region, sceneId]);

  return (
    <div className="rounded-2xl border border-line bg-paper p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          <ShieldCheck size={16} />
          人机验证
        </span>
        {verified && (
          <span className="inline-flex items-center gap-1 text-xs text-mint">
            <CheckCircle2 size={14} />
            已通过
          </span>
        )}
      </div>
      <div id={elementId} className="min-h-10" />
      <button id={buttonId} type="button" className="sr-only">
        启动验证码
      </button>
      {message && <p className="mt-2 text-xs text-muted">{message}</p>}
    </div>
  );
}

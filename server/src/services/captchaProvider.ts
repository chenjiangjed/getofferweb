import * as CaptchaSdk from "@alicloud/captcha20230305";
import { config, hasCaptchaConfig } from "../config.js";

type CaptchaClientInstance = {
  verifyIntelligentCaptcha: (
    request: CaptchaSdk.VerifyIntelligentCaptchaRequest
  ) => Promise<CaptchaSdk.VerifyIntelligentCaptchaResponse>;
};

const CaptchaClient = (
  "default" in CaptchaSdk.default ? CaptchaSdk.default.default : CaptchaSdk.default
) as unknown as new (options: {
  accessKeyId: string;
  accessKeySecret: string;
  endpoint: string;
  regionId: string;
}) => CaptchaClientInstance;

function captchaEndpoint() {
  return `captcha.${config.aliyunCaptcha.region}.aliyuncs.com`;
}

function client() {
  return new CaptchaClient({
    accessKeyId: config.aliyunCaptcha.accessKeyId,
    accessKeySecret: config.aliyunCaptcha.accessKeySecret,
    endpoint: captchaEndpoint(),
    regionId: config.aliyunCaptcha.region
  });
}

export async function verifyCaptcha(captchaVerifyParam: string): Promise<boolean> {
  if (!captchaVerifyParam) return false;
  if (config.demoCaptchaBypass && captchaVerifyParam === "mock_captcha_pass") {
    return true;
  }
  if (!hasCaptchaConfig()) return false;

  const request = new CaptchaSdk.VerifyIntelligentCaptchaRequest({
    captchaVerifyParam,
    sceneId: config.aliyunCaptcha.sceneId
  });
  const response = await client().verifyIntelligentCaptcha(request);
  const result = response.body?.result;

  return result?.verifyResult === true && ["T001", "T005"].includes(result.verifyCode || "");
}

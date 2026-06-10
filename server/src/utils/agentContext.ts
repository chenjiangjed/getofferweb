import type { AuthUser } from "../types.js";

export function withAgentContext(message: string, user: AuthUser) {
  const nickname = user.nickname || user.username || "用户";
  const context = {
    account_user_id: user.profile_user_id,
    nickname,
    profile_rule: {
      profile_name_format: "姓名或昵称-专业",
      profile_key_format: "profiles/{profile_name}.json",
      default_name: nickname,
      requirements: [
        "调用 profile_manager 前必须传 profile_name、name、major、account_user_id、nickname",
        "禁止使用 demo_user、user_xxx、空字符串作为 profile_name",
        "同一个登录账号默认只绑定一个当前主 profile",
        "除非用户明确提出新建档案、切换身份或重新评测，不要主动创建多个 profile",
        "专业未知时必须先追问用户所学专业，不要保存 profile",
        "target_job 只作为档案内容字段保存，不参与 profile 文件名",
        "如果读取到 profiles/demo_user.json，只能作为兼容迁移来源；下一次保存必须迁移到 profiles/{姓名或昵称-专业}.json"
      ]
    }
  };

  return [
    "【本地 Demo 账号上下文】",
    JSON.stringify(context),
    "",
    "【用户消息】",
    message
  ].join("\n");
}

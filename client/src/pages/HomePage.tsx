import { ArrowRight, Sparkle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ChatInput } from "../components/ChatInput";
import { LogoSlot } from "../components/LogoSlot";
import { makeConversationId } from "../utils/agentMessage";

const greeting =
  "你好呀，我是“长大职通车”，你的 AI 求职陪伴导师~我可以陪你从职业迷茫走到面试准备：帮你梳理职业方向、匹配适合的岗位、优化简历表达、进行文本模拟面试，并记录你的求职进度。\n\n你可以从以下问题开启求职规划路线~";

const promptSuggestions = [
  "我有点职业迷茫，可以帮我规划适合的求职方向吗？",
  "我想找实习，帮我推荐几个适合大学生投递的岗位。",
  "帮我看看我的简历适合投什么岗位",
  "我已经有目标岗位了，可以帮我优化简历表达吗？",
  "我想体验一次模拟面试。"
];

export function HomePage() {
  const navigate = useNavigate();

  function submit(text: string, file?: File | null) {
    const id = makeConversationId();
    navigate(`/chat/${id}`, { state: { initialMessage: text, initialFile: file || null } });
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-6xl flex-col px-4 pb-10 pt-10 sm:px-8 lg:pt-14">
      <section className="mx-auto w-full max-w-4xl">
        <div className="mb-7">
          <LogoSlot />
        </div>

        <div>
          <ChatInput placeholder={greeting} minRows={9} onSubmit={submit} />
        </div>

        <div className="mt-5 rounded-[18px] border border-line bg-white p-3 shadow-soft">
          <div className="space-y-2">
            {promptSuggestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => submit(item)}
                className="flex h-12 w-full items-center justify-between gap-3 rounded-xl bg-paper px-4 text-left text-sm text-ink transition hover:bg-blue-50 hover:text-brand"
              >
                <span className="inline-flex min-w-0 items-center gap-3">
                  <Sparkle size={15} className="shrink-0 text-brand" />
                  <span className="truncate">{item}</span>
                </span>
                <ArrowRight size={15} className="shrink-0 text-muted" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

type AgentMessageProps = {
  role: "user" | "assistant";
  children: string;
};

export function AgentMessage({ role, children }: AgentMessageProps) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[84%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[72%]",
          isUser ? "bg-ink text-white" : "border border-line bg-white text-ink"
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

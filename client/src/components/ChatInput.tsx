import { ArrowUp, Paperclip, X } from "lucide-react";
import { FormEvent, KeyboardEvent, useRef, useState } from "react";

type ChatInputProps = {
  placeholder?: string;
  minRows?: number;
  onSubmit: (value: string, file?: File | null) => void;
  disabled?: boolean;
};

export function ChatInput({
  placeholder = "请输入任务，交给我来帮你完成",
  minRows = 5,
  onSubmit,
  disabled
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function submitValue() {
    const text = value.trim();
    if ((!text && !file) || disabled) return;
    onSubmit(text || "请分析我上传的文件", file);
    setValue("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    submitValue();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    submitValue();
  }

  return (
    <form onSubmit={submit} className="rounded-[24px] border border-line bg-white p-4 shadow-soft focus-within:border-slate-300">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={minRows}
        placeholder={placeholder}
        className="block w-full resize-none bg-transparent text-base text-ink outline-none placeholder:text-slate-400 focus:outline-none focus-visible:outline-none"
      />
      {file && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-ink">
          <span className="truncate">已选择：{file.name}</span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-white hover:text-ink"
            title="移除文件"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div className="mt-4 flex items-center justify-between">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".docx,.pdf,.txt,.md,.json,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json,text/csv,text/markdown"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink transition hover:bg-slate-50"
          title="选择文件"
        >
          <Paperclip size={16} />
          <span>选择文件</span>
        </button>
        <button
          type="submit"
          disabled={(!value.trim() && !file) || disabled}
          className="grid h-11 w-11 place-items-center rounded-full bg-brand text-white transition hover:bg-blue-700 disabled:bg-slate-200"
          title="发送"
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </form>
  );
}

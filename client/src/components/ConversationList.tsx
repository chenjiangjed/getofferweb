import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Pin, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { conversationApi } from "../services/conversationApi";
import type { Conversation } from "../types/api";

export function ConversationList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openMenuId, setOpenMenuId] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: conversationApi.list
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; pinned?: boolean } }) =>
      conversationApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] })
  });

  const deleteMutation = useMutation({
    mutationFn: conversationApi.delete,
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.removeQueries({ queryKey: ["conversation-messages", id] });
      navigate("/");
    }
  });

  const renamingConversation = data.find((item) => item.id === renamingId);

  function startRename(item: Conversation) {
    setRenamingId(item.id);
    setRenameValue(item.title || "新的对话");
    setOpenMenuId("");
  }

  function closeRename() {
    setRenamingId("");
    setRenameValue("");
  }

  function submitRename(event: FormEvent) {
    event.preventDefault();
    if (!renamingId || !renameValue.trim()) return;
    updateMutation.mutate({ id: renamingId, data: { title: renameValue.trim() } });
    closeRename();
  }

  function togglePin(item: Conversation) {
    updateMutation.mutate({ id: item.id, data: { pinned: !item.pinned } });
    setOpenMenuId("");
  }

  function remove(item: Conversation) {
    if (!window.confirm(`删除对话「${item.title || "新的对话"}」？`)) return;
    deleteMutation.mutate(item.id);
    setOpenMenuId("");
  }

  const groups = data.reduce<Record<string, typeof data>>((acc, item) => {
    const label = item.updatedAt && item.updatedAt !== "undefined" ? item.updatedAt : "最近对话";
    acc[label] = acc[label] || [];
    acc[label].push(item);
    return acc;
  }, {});

  return (
    <>
      <div className="mt-5 space-y-5">
        {Object.entries(groups).map(([label, items]) => (
          <section key={label}>
            <div className="px-2 text-xs text-muted">{label}</div>
            <div className="mt-2 space-y-1">
              {items.map((item) => (
                <div key={item.id} className="group relative flex items-center rounded-xl hover:bg-white">
                  <Link
                    to={`/chat/${item.id}`}
                    className="min-w-0 flex-1 truncate px-2 py-2 text-sm text-ink transition focus:outline-none focus-visible:outline-none"
                  >
                    {item.pinned && <Pin size={12} className="mr-1 inline text-brand" />}
                    {item.title || "新的对话"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpenMenuId((current) => (current === item.id ? "" : item.id))}
                    className="mr-1 grid h-7 w-7 place-items-center rounded-lg text-muted opacity-100 hover:bg-paper hover:text-ink"
                    title="对话操作"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  {openMenuId === item.id && (
                    <div className="absolute right-1 top-8 z-30 w-28 rounded-xl border border-line bg-white p-1 text-sm shadow-soft">
                      <button
                        type="button"
                        onClick={() => togglePin(item)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-paper"
                      >
                        <Pin size={14} />
                        {item.pinned ? "取消置顶" : "置顶"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startRename(item)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-paper"
                      >
                        <Pencil size={14} />
                        重命名
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-coral hover:bg-paper"
                      >
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {renamingConversation && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 px-4">
          <form
            onSubmit={submitRename}
            className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">编辑对话名称</h2>
              <button
                type="button"
                onClick={closeRename}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink"
                title="取消重命名"
              >
                <X size={17} />
              </button>
            </div>
            <input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              autoFocus
              className="mt-4 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-ink outline-none focus:border-brand focus:ring-4 focus:ring-blue-50"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeRename}
                className="h-10 rounded-lg border border-line px-5 text-sm text-muted hover:bg-paper"
              >
                取消
              </button>
              <button
                type="submit"
                className="h-10 rounded-lg bg-brand px-5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-300"
                disabled={!renameValue.trim() || updateMutation.isPending}
              >
                确定
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

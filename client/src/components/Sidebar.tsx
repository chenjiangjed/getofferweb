import { LogIn, LogOut, Menu, MessageSquarePlus, MoreHorizontal, PanelLeftClose } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useUiStore } from "../stores/uiStore";
import { LogoSlot } from "./LogoSlot";
import { ConversationList } from "./ConversationList";

type SidebarProps = {
  mobile?: boolean;
};

export function Sidebar({ mobile = false }: SidebarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const setCollapsed = useUiStore((state) => state.setSidebarCollapsed);
  const setMobileOpen = useUiStore((state) => state.setMobileSidebarOpen);

  function newConversation() {
    navigate("/");
    setMobileOpen(false);
  }

  if (collapsed && !mobile) {
    return (
      <aside className="hidden h-screen w-[72px] shrink-0 border-r border-line bg-paper p-3 lg:block">
        <button
          onClick={() => setCollapsed(false)}
          className="grid h-11 w-11 place-items-center rounded-xl hover:bg-white"
          title="展开侧边栏"
        >
          <Menu size={19} />
        </button>
        <button
          onClick={newConversation}
          className="mt-3 grid h-11 w-11 place-items-center rounded-xl bg-white shadow-sm"
          title="开启新对话"
        >
          <MessageSquarePlus size={19} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[288px] shrink-0 flex-col border-r border-line bg-paper p-4">
      <div className="flex items-center justify-between">
        <LogoSlot compact />
        <button
          onClick={() => (mobile ? setMobileOpen(false) : setCollapsed(true))}
          className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white"
          title="收起侧边栏"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      <button
        onClick={newConversation}
        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white text-sm font-medium text-ink shadow-sm transition hover:shadow"
      >
        <MessageSquarePlus size={17} />
        开启新对话
      </button>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1">
        <ConversationList />
      </div>

      <div className="mt-4 border-t border-line pt-3">
        {user ? (
          <div className="flex items-center justify-between rounded-xl bg-white p-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink">{user.nickname || user.username}</div>
            </div>
            <button onClick={logout} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-paper" title="退出登录">
              <LogOut size={17} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="flex w-full items-center justify-between rounded-xl bg-white p-3 text-sm font-medium text-ink"
          >
            <span className="inline-flex items-center gap-2">
              <LogIn size={17} />
              用户登录
            </span>
            <MoreHorizontal size={17} />
          </button>
        )}
      </div>
    </aside>
  );
}

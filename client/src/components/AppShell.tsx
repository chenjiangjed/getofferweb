import { Menu } from "lucide-react";
import { Outlet } from "react-router-dom";
import { useUiStore } from "../stores/uiStore";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const mobileOpen = useUiStore((state) => state.mobileSidebarOpen);
  const setMobileOpen = useUiStore((state) => state.setMobileSidebarOpen);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="flex min-h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              className="absolute inset-0 bg-black/20"
              onClick={() => setMobileOpen(false)}
              aria-label="关闭侧边栏"
            />
            <div className="absolute inset-y-0 left-0">
              <Sidebar mobile />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 flex flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center bg-paper/90 px-4 backdrop-blur lg:justify-start">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-xl bg-white lg:hidden"
              title="打开侧边栏"
            >
              <Menu size={19} />
            </button>
          </header>
          <div className="flex-1">
            <Outlet />
          </div>
          <footer className="py-4 text-center text-xs text-muted">
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
        </main>
      </div>
    </div>
  );
}

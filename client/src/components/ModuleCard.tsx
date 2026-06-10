import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

type ModuleCardProps = {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  color: string;
};

export function ModuleCard({ title, description, to, icon: Icon, color }: ModuleCardProps) {
  return (
    <Link
      to={to}
      className="group flex min-h-36 flex-col justify-between rounded-[18px] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-soft"
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${color}`}>
            <Icon size={18} />
          </span>
          <ArrowUpRight size={18} className="text-slate-400 transition group-hover:text-ink" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{description}</p>
    </Link>
  );
}

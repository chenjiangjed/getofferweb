type ReportPanelProps = {
  title: string;
  items: Array<{ label: string; value: string }>;
};

export function ReportPanel({ title, items }: ReportPanelProps) {
  return (
    <aside className="rounded-[18px] border border-line bg-white p-5">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl bg-paper px-3 py-2">
            <div className="text-xs text-muted">{item.label}</div>
            <div className="mt-1 text-sm font-medium text-ink">{item.value}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

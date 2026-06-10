type ResumeMaterialReviewProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ResumeMaterialReview({ value, onChange }: ResumeMaterialReviewProps) {
  return (
    <div className="rounded-[18px] border border-line bg-white p-5">
      <h3 className="text-base font-semibold text-ink">简历素材</h3>
      <p className="mt-1 text-sm text-muted">可以粘贴现有简历，也可以补充项目、实习、技能、荣誉等素材。</p>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={12}
        className="mt-4 w-full resize-none rounded-2xl border border-line px-4 py-3 text-sm leading-7 outline-none"
        placeholder="示例：长安大学，本科，目标产品经理实习。项目：校园二手交易小程序，负责需求调研和原型设计..."
      />
    </div>
  );
}

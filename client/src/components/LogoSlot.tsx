type LogoSlotProps = {
  compact?: boolean;
};

export function LogoSlot({ compact = false }: LogoSlotProps) {
  if (compact) {
    return (
      <div className="flex h-10 w-32 shrink-0 items-center sm:w-36">
        <img
          src="/logo/getoffer_nobg.png"
          alt="长大职通车"
          className="h-full w-full object-contain object-left"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <img
        src="/logo/getoffer_circle_nobg.png"
        alt="长大职通车"
        className="h-24 w-24 shrink-0 object-contain sm:h-28 sm:w-28"
      />
      <div>
        <h1 className="text-5xl font-extrabold tracking-normal text-ink sm:text-6xl">GetOffer</h1>
        <p className="mt-2 text-base text-muted">规划投递面试，AI一站搞定</p>
      </div>
    </div>
  );
}

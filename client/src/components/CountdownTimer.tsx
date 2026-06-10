import { useEffect } from "react";

type CountdownTimerProps = {
  secondsLeft: number;
  running: boolean;
  onTick: () => void;
  onDone: () => void;
};

export function CountdownTimer({ secondsLeft, running, onTick, onDone }: CountdownTimerProps) {
  useEffect(() => {
    if (!running) return;
    if (secondsLeft <= 0) {
      onDone();
      return;
    }
    const timer = window.setTimeout(onTick, 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, running, onTick, onDone]);

  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");

  return (
    <div className="text-center">
      <div className="text-5xl font-semibold text-ink sm:text-6xl">
        {minutes}:{seconds}
      </div>
      <div className="mt-2 text-sm text-muted">5 分钟限时作答</div>
    </div>
  );
}

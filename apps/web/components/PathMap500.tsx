'use client';

interface PathMap500Props {
  currentStep: number;
  totalSteps?: number;
}

export default function PathMap500({
  currentStep,
  totalSteps = 500,
}: PathMap500Props) {
  const cols = 25;
  const rows = Math.ceil(totalSteps / cols);
  return (
    <svg
      viewBox={`0 0 ${cols * 20} ${rows * 20}`}
      className="w-full"
      role="img"
      aria-label={`500 dars yo'l xaritasi: ${currentStep} / ${totalSteps}`}
    >
      {Array.from({ length: totalSteps }).map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // Snake pattern: even rows L->R, odd rows R->L
        const x = (row % 2 === 0 ? col : cols - 1 - col) * 20 + 10;
        const y = row * 20 + 10;
        const isCurrent = i + 1 === currentStep;
        const isUnlocked = i + 1 <= currentStep;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={isCurrent ? 7 : 5}
            className={
              isCurrent
                ? 'fill-emerald-500 animate-pulse'
                : isUnlocked
                ? 'fill-emerald-200'
                : 'fill-slate-300'
            }
          />
        );
      })}
    </svg>
  );
}

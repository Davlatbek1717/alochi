interface XpBarProps {
  totalXp: number;
  level: string;
  nextLevelXp: number;
}

const LEVEL_COLORS: Record<string, string> = {
  Novice: 'bg-gray-400',
  Learner: 'bg-blue-500',
  Scholar: 'bg-indigo-600',
  Expert: 'bg-purple-600',
  Master: 'bg-yellow-500',
};

const LEVEL_MINIMUMS: Record<string, number> = {
  Novice: 0, Learner: 500, Scholar: 2000, Expert: 5000, Master: 10000,
};

export function XpBar({ totalXp, level, nextLevelXp }: XpBarProps) {
  const levelMin = LEVEL_MINIMUMS[level] ?? 0;
  const progress = nextLevelXp === Infinity
    ? 100
    : ((totalXp - levelMin) / (nextLevelXp - levelMin)) * 100;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-bold text-indigo-700">{level}</span>
        <span className="text-gray-500">{totalXp.toLocaleString()} / {nextLevelXp === Infinity ? '∞' : nextLevelXp.toLocaleString()} XP</span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${LEVEL_COLORS[level] ?? 'bg-indigo-600'}`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
}

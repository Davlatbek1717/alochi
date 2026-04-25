interface StreakBadgeProps {
  streak: number;
  hasShield: boolean;
}

export function StreakBadge({ streak, hasShield }: StreakBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-2xl ${streak > 0 ? 'animate-pulse' : 'opacity-40'}`}>
        🔥
      </span>
      <div>
        <span className="font-bold text-lg">{streak}</span>
        <span className="text-gray-500 text-sm"> kun streak</span>
        {hasShield && (
          <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
            🛡 Shield
          </span>
        )}
      </div>
    </div>
  );
}

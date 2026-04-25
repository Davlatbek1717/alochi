'use client';

type VirtualCityProps = {
  level: number;
  buildings: string[];
  lessonsCompleted: number;
  nextLevelAt: number;
};

const BUILDING_EMOJIS: Record<string, string> = {
  tent: '⛺',
  house: '🏠',
  shop: '🏪',
  school: '🏫',
  castle: '🏰',
};

const BUILDING_NAMES: Record<string, string> = {
  tent: 'Palatka',
  house: 'Uy',
  shop: "Do'kon",
  school: 'Maktab',
  castle: "Qal'a",
};

export default function VirtualCity({ level, buildings, lessonsCompleted, nextLevelAt }: VirtualCityProps) {
  const progress = nextLevelAt > 0 ? Math.min((lessonsCompleted / nextLevelAt) * 100, 100) : 0;

  return (
    <div className="bg-gradient-to-b from-sky-100 to-green-50 rounded-2xl p-4 space-y-3 border border-sky-200">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">🏙️ Shahar darajasi: {level}</h2>
        <span className="text-xs text-gray-500">{lessonsCompleted}/{nextLevelAt} XP</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {buildings.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Hali binolar yo&apos;q</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {buildings.map((building, idx) => (
            <div
              key={`${building}-${idx}`}
              className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100"
            >
              <p className="text-3xl">{BUILDING_EMOJIS[building] ?? '🏗️'}</p>
              <p className="text-xs text-gray-600 mt-1 font-medium">
                {BUILDING_NAMES[building] ?? building}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

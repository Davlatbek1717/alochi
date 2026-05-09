interface Quest {
  questType: string;
  targetValue: number;
  progress: number;
  completed: boolean;
}

const QUEST_LABELS: Record<string, string> = {
  learn_words: "🔤 Yangi so'zlar o'rgan",
  watch_video: '📺 Videoni ko\'r',
  ask_tutor: '🤖 AI Tutor ga savol ber',
  lesson_complete: '📚 Darsni tamomla',
};

export function DailyQuests({ quests }: { quests: Quest[] }) {
  const completed = quests.filter((q) => q.completed).length;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">🎯 Bugungi Topshiriqlar</h3>
        <span className="text-sm text-gray-500">{completed}/{quests.length} bajarildi</span>
      </div>

      {quests.map((q, i) => (
        <div
          key={i}
          className={`flex items-center justify-between p-2 rounded-lg ${
            q.completed ? 'bg-green-50' : 'bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{q.completed ? '✅' : '⬜'}</span>
            <div>
              <p className={`text-sm font-medium ${q.completed ? 'line-through text-gray-400' : ''}`}>
                {QUEST_LABELS[q.questType] ?? q.questType}
                {q.targetValue > 1 && ` (${q.progress}/${q.targetValue})`}
              </p>
            </div>
          </div>
          {q.completed && <span className="text-emerald-600 text-sm font-medium">✓</span>}
        </div>
      ))}
    </div>
  );
}

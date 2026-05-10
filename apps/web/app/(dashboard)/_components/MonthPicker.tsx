'use client';

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
}

export default function MonthPicker({ value, onChange }: MonthPickerProps) {
  const max = new Date().toISOString().slice(0, 7);
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-600">Oy:</label>
      <input
        type="month"
        value={value}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full"
      />
    </div>
  );
}

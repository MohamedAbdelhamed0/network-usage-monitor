import React from 'react';
import { Calendar } from 'lucide-react';

interface TimeFilterPillsProps {
  selectedDays: number;
  onSelectDays: (days: number) => void;
}

export const TimeFilterPills: React.FC<TimeFilterPillsProps> = ({
  selectedDays,
  onSelectDays,
}) => {
  const options = [
    { label: 'Today', days: 1 },
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Full 45 Days', days: 45 },
  ];

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mr-2">
        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
        <span>Time Range:</span>
      </div>
      <div className="flex items-center p-1 rounded-xl bg-slate-900/90 border border-white/5 text-xs">
        {options.map((opt) => (
          <button
            key={opt.days}
            onClick={() => onSelectDays(opt.days)}
            className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
              selectedDays === opt.days
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

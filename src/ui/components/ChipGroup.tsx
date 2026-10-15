import React from 'react';

interface OptionItem {
  id: string;
  displayName: string;
}

interface ChipGroupProps<T extends OptionItem> {
  title?: string;
  options: T[];
  value: string | null | undefined;
  onChange: (val: string | null) => void;
  className?: string;
}

export function ChipGroup<T extends OptionItem>({
  title,
  options,
  value,
  onChange,
  className = '',
}: ChipGroupProps<T>) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {title && (
        <div className="text-xs font-medium text-slate-500">{title}</div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isSelected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(isSelected ? null : opt.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all duration-150 border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {opt.displayName}
            </button>
          );
        })}
      </div>
    </div>
  );
}

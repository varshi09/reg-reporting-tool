"use client";

import { useEffect, useRef, useState } from "react";

export default function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleOption(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((v) => v !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <p className="text-sm font-medium text-zinc-700">{label}</p>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="flex min-w-[160px] items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
        >
          <span className="truncate">
            {selected.length > 0 ? selected.join(", ") : "Select..."}
          </span>
          <span className="text-zinc-400">▾</span>
        </button>

        {isOpen && (
          <div className="absolute z-20 mt-1 w-full min-w-[160px] rounded-md border border-zinc-300 bg-white py-1 shadow-md">
            {options.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggleOption(option)}
                />
                {option}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

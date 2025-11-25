/**
 * Reusable Tab Button Component
 * Single component used for all tabs - DRY principle
 */
// import React from 'react';
import clsx from 'clsx';

interface TabButtonProps {
  icon: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export function TabButton({ icon, label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-4 py-2 rounded-lg font-semibold transition-all',
        isActive
          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
          : 'bg-white/10 text-gray-400 hover:bg-white/20'
      )}
    >
      {icon} {label}
    </button>
  );
}

/**
 * Tab Navigation Component
 * Handles all tab rendering logic - keeps App.tsx clean
 */
// import React from 'react';
import { TabButton } from './TabButton';
import type { TabType } from '../hooks/useTabs';

interface TabNavigationProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs = [
  { id: 'chat' as TabType, icon: '💬', label: 'Chat' },
  { id: 'agents' as TabType, icon: '🤖', label: 'Agents' },
  { id: 'recordings' as TabType, icon: '🎥', label: 'Recordings' },
  { id: 'tasks' as TabType, icon: '📋', label: 'Tasks' },
];

export function TabNavigation({ currentTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="bg-black/30 border-b border-white/10 p-4">
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            isActive={currentTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>
    </div>
  );
}

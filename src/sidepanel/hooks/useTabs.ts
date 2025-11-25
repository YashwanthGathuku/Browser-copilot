/**
 * Custom hook for managing tabs
 * Reusable across the app
 */
import { useState } from 'react';

export type TabType = 'chat' | 'agents' | 'recordings' | 'tasks';

export function useTabs(defaultTab: TabType = 'chat') {
  const [currentTab, setCurrentTab] = useState<TabType>(defaultTab);

  const switchTab = (tab: TabType) => setCurrentTab(tab);

  return { currentTab, switchTab };
}

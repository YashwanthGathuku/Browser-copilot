/**
 * Tab Content Router
 * Handles rendering of different tab panels - keeps App.tsx minimal
 */
import React, { Suspense, lazy } from 'react';
import type { TabType } from '../hooks/useTabs';

// Lazy load components for better performance
const RecordingPanel = lazy(() => import('./RecordingPanel').then(m => ({ default: m.RecordingPanel })));
// const AgentCoordinator = lazy(() => import('./AgentCoordinator').then(m => ({ default: m.AgentCoordinatorPanel })));
// const TaskScheduler = lazy(() => import('./TaskScheduler').then(m => ({ default: m.TaskSchedulerPanel })));

interface TabContentProps {
  currentTab: TabType;
  chatContent: React.ReactNode; // Pass existing chat UI as children
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-white">Loading...</div>
    </div>
  );
}

export function TabContent({ currentTab, chatContent }: TabContentProps) {
  return (
    <div className="flex-1 overflow-hidden">
      <Suspense fallback={<LoadingFallback />}>
        {currentTab === 'chat' && chatContent}
        {/* {currentTab === 'agents' && <AgentCoordinator />} */}
        {currentTab === 'recordings' && <RecordingPanel />}
        {/* {currentTab === 'tasks' && <TaskScheduler />} */}
      </Suspense>
    </div>
  );
}

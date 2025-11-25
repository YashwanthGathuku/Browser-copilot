import { useState } from 'react';
import clsx from 'clsx';

interface FocusModeProps {
  enabled: boolean;
  onToggle: () => void;
  blockedCount: number;
  elapsedTime: number;
  onEnableReading: () => void;
}

export function FocusModePanel({ 
  enabled, 
  onToggle, 
  blockedCount, 
  elapsedTime,
  onEnableReading 
}: FocusModeProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [blockedSites, setBlockedSites] = useState<string[]>([
    'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
    'reddit.com', 'youtube.com', 'tiktok.com', 'netflix.com'
  ]);
  const [newSite, setNewSite] = useState('');

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const addSite = () => {
    if (newSite.trim() && !blockedSites.includes(newSite.trim())) {
      setBlockedSites([...blockedSites, newSite.trim()]);
      setNewSite('');
    }
  };

  const removeSite = (site: string) => {
    setBlockedSites(blockedSites.filter(s => s !== site));
  };

  return (
    <div className="p-4 space-y-4">
      {/* Main Toggle Card */}
      <div className={clsx(
        "rounded-2xl p-5 transition-all duration-300",
        enabled
          ? "bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{enabled ? '🎯' : '😴'}</span>
            <div>
              <h3 className="text-lg font-bold">Focus Mode</h3>
              <p className={clsx("text-sm", enabled ? "text-white/80" : "text-zinc-500")}>
                {enabled ? 'Stay focused, stay productive' : 'Block distractions'}
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className={clsx(
              "px-4 py-2 rounded-xl font-semibold transition-all",
              enabled
                ? "bg-white text-orange-600 hover:bg-orange-50"
                : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg"
            )}
          >
            {enabled ? 'Stop' : 'Start Focus'}
          </button>
        </div>

        {enabled && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/20">
            <div className="text-center">
              <div className="text-2xl font-bold">{formatTime(elapsedTime)}</div>
              <div className="text-xs text-white/70">Focus time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{blockedCount}</div>
              <div className="text-xs text-white/70">Distractions blocked</div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onEnableReading}
          className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        >
          <span className="text-xl">📚</span>
          <div className="text-left">
            <div className="font-medium text-sm">Reading Mode</div>
            <div className="text-xs opacity-70">Distraction-free</div>
          </div>
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <span className="text-xl">⚙️</span>
          <div className="text-left">
            <div className="font-medium text-sm">Settings</div>
            <div className="text-xs text-zinc-500">{blockedSites.length} sites blocked</div>
          </div>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="space-y-3 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <span>🚫</span> Blocked Sites
          </h4>
          
          {/* Add new site */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newSite}
              onChange={e => setNewSite(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSite()}
              placeholder="Add site to block..."
              className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-sm"
            />
            <button
              onClick={addSite}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Add
            </button>
          </div>

          {/* Site list */}
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {blockedSites.map(site => (
              <span
                key={site}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs"
              >
                {site}
                <button
                  onClick={() => removeSite(site)}
                  className="hover:text-red-900 dark:hover:text-red-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Motivational Quote */}
      {enabled && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800">
          <p className="text-sm text-purple-800 dark:text-purple-200 italic text-center">
            "The secret of getting ahead is getting started." 🚀
          </p>
        </div>
      )}
    </div>
  );
}

// Reading Mode Overlay Component
interface ReadingModeOverlayProps {
  enabled: boolean;
  onClose: () => void;
  content: string;
  title: string;
}

export function ReadingModeOverlay({ enabled, onClose, content, title }: ReadingModeOverlayProps) {
  const [theme, setTheme] = useState<'light' | 'sepia' | 'dark'>('light');
  const [fontSize, setFontSize] = useState(18);

  if (!enabled) return null;

  const themes = {
    light: { bg: 'bg-white', text: 'text-zinc-900' },
    sepia: { bg: 'bg-[#f4ecd8]', text: 'text-[#5b4636]' },
    dark: { bg: 'bg-zinc-900', text: 'text-zinc-100' },
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-700">
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <span>←</span>
          <span>Exit Reading Mode</span>
        </button>
        
        <div className="flex items-center gap-3">
          {/* Theme Switcher */}
          <div className="flex gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
            {(['light', 'sepia', 'dark'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={clsx(
                  "w-6 h-6 rounded-md transition-all",
                  t === 'light' && "bg-white border border-zinc-300",
                  t === 'sepia' && "bg-[#f4ecd8]",
                  t === 'dark' && "bg-zinc-900 border border-zinc-600",
                  theme === t && "ring-2 ring-blue-500"
                )}
              />
            ))}
          </div>

          {/* Font Size */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFontSize(s => Math.max(14, s - 2))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-lg"
            >
              A-
            </button>
            <span className="text-sm text-zinc-500">{fontSize}px</span>
            <button
              onClick={() => setFontSize(s => Math.min(28, s + 2))}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-lg"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={clsx(
        "absolute inset-0 top-14 overflow-y-auto",
        themes[theme].bg,
        themes[theme].text
      )}>
        <div 
          className="max-w-[700px] mx-auto px-6 py-12"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}
        >
          <h1 className="text-3xl font-bold mb-8">{title}</h1>
          <div 
            className="prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      </div>
    </div>
  );
}

export default FocusModePanel;

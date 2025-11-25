import { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';

interface QuickCommand {
  id: string;
  label: string;
  description?: string;
  category: string;
  icon: string;
  shortcut?: string;
  requiresInput?: boolean;
  inputPlaceholder?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (commandId: string, input?: string) => void;
  commands: QuickCommand[];
}

export function CommandPalette({ isOpen, onClose, onExecute, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputMode, setInputMode] = useState<{ command: QuickCommand; value: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on query
  const filteredCommands = query.trim()
    ? commands.filter(cmd => 
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(query.toLowerCase())
      )
    : commands.slice(0, 10); // Show top 10 when no query

  // Reset selection when commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setInputMode(null);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && filteredCommands.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredCommands.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (inputMode) {
      if (e.key === 'Enter') {
        onExecute(inputMode.command.id, inputMode.value);
        onClose();
      } else if (e.key === 'Escape') {
        setInputMode(null);
        inputRef.current?.focus();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          const cmd = filteredCommands[selectedIndex];
          if (cmd.requiresInput) {
            setInputMode({ command: cmd, value: '' });
          } else {
            onExecute(cmd.id);
            onClose();
          }
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, inputMode, onExecute, onClose]);

  if (!isOpen) return null;

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      navigation: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      action: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      ai: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      memory: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
      template: 'bg-green-500/10 text-green-600 dark:text-green-400',
      focus: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      settings: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    };
    return colors[category] || 'bg-gray-500/10 text-gray-600';
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-zinc-200 dark:border-zinc-700">
          <span className="text-xl">🔍</span>
          {inputMode ? (
            <div className="flex-1">
              <div className="text-sm text-zinc-500 mb-1">
                {inputMode.command.icon} {inputMode.command.label}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={inputMode.value}
                onChange={e => setInputMode({ ...inputMode, value: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder={inputMode.command.inputPlaceholder}
                className="w-full bg-transparent text-lg outline-none placeholder:text-zinc-400"
                autoFocus
              />
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-lg outline-none placeholder:text-zinc-400"
            />
          )}
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 rounded">
            esc
          </kbd>
        </div>

        {/* Commands List */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <div className="text-3xl mb-2">🔎</div>
              <p>No commands found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                onClick={() => {
                  if (cmd.requiresInput) {
                    setInputMode({ command: cmd, value: '' });
                  } else {
                    onExecute(cmd.id);
                    onClose();
                  }
                }}
                className={clsx(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                  index === selectedIndex
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                )}
              >
                <span className="text-xl">{cmd.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {cmd.label}
                    </span>
                    <span className={clsx("px-1.5 py-0.5 text-[10px] font-medium rounded", getCategoryColor(cmd.category))}>
                      {cmd.category}
                    </span>
                  </div>
                  {cmd.description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                      {cmd.description}
                    </p>
                  )}
                </div>
                {cmd.shortcut && (
                  <kbd className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 rounded font-mono">
                    {cmd.shortcut}
                  </kbd>
                )}
                {cmd.requiresInput && (
                  <span className="text-xs text-zinc-400">→</span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">Enter</kbd> Select</span>
          </div>
          <span className="text-zinc-400">
            {filteredCommands.length} commands
          </span>
        </div>
      </div>
    </div>
  );
}

// Hook to use command palette
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}

export default CommandPalette;

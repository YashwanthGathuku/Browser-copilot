import { useState, useEffect } from 'react';
import clsx from 'clsx';

interface PageMemory {
  id: string;
  url: string;
  title: string;
  summary?: string;
  keywords: string[];
  visitedAt: number;
  duration: number;
  interactions: number;
  domain: string;
  category?: string;
}

interface MemoryStats {
  totalPages: number;
  totalTime: number;
  topDomains: { domain: string; visits: number; time: number }[];
  topCategories: { category: string; count: number }[];
  recentPages: PageMemory[];
}

interface MemoryPanelProps {
  memories: PageMemory[];
  stats: MemoryStats | null;
  onSearch: (query: string) => PageMemory[];
  onDeleteMemory: (url: string) => void;
  onOpenPage: (url: string) => void;
}

export function MemoryPanel({ 
  memories, 
  stats, 
  onSearch, 
  onDeleteMemory, 
  onOpenPage 
}: MemoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PageMemory[]>([]);
  const [activeTab, setActiveTab] = useState<'recent' | 'search' | 'stats'>('recent');

  useEffect(() => {
    if (searchQuery.trim()) {
      const results = onSearch(searchQuery);
      setSearchResults(results);
      if (activeTab !== 'search') setActiveTab('search');
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getCategoryIcon = (category?: string) => {
    const icons: Record<string, string> = {
      shopping: '🛒',
      research: '🔬',
      social: '💬',
      news: '📰',
      video: '📺',
      development: '💻',
      email: '📧',
      productivity: '⚡',
      finance: '💰',
      other: '📄',
    };
    return icons[category || 'other'] || '📄';
  };

  const renderMemoryCard = (memory: PageMemory) => (
    <div
      key={memory.id}
      className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 hover:border-blue-500 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">{getCategoryIcon(memory.category)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <button
              onClick={() => onOpenPage(memory.url)}
              className="text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <h4 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:text-blue-600">
                {memory.title}
              </h4>
              <p className="text-xs text-zinc-500 truncate mt-0.5">
                {memory.domain}
              </p>
            </button>
            <button
              onClick={() => onDeleteMemory(memory.url)}
              className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all p-1"
              title="Forget this page"
            >
              ×
            </button>
          </div>
          
          <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <span>🕐</span>
              {formatRelativeTime(memory.visitedAt)}
            </span>
            <span className="flex items-center gap-1">
              <span>⏱️</span>
              {formatDuration(memory.duration)}
            </span>
            {memory.interactions > 0 && (
              <span className="flex items-center gap-1">
                <span>👆</span>
                {memory.interactions}
              </span>
            )}
          </div>

          {memory.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {memory.keywords.slice(0, 4).map((kw, i) => (
                <span 
                  key={i}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header with Search */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
          <span>🧠</span>
          Memory
        </h2>
        
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search your browsing memory..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-700">
        {(['recent', 'search', 'stats'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
            )}
          >
            {tab === 'recent' && '🕐 Recent'}
            {tab === 'search' && `🔍 Results ${searchResults.length > 0 ? `(${searchResults.length})` : ''}`}
            {tab === 'stats' && '📊 Stats'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Recent Tab */}
        {activeTab === 'recent' && (
          <div className="space-y-3">
            {memories.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <div className="text-4xl mb-3">🧠</div>
                <p>No pages remembered yet</p>
                <p className="text-sm mt-1">Browse the web to build your memory</p>
              </div>
            ) : (
              memories.map(renderMemoryCard)
            )}
          </div>
        )}

        {/* Search Results Tab */}
        {activeTab === 'search' && (
          <div className="space-y-3">
            {searchQuery.trim() === '' ? (
              <div className="text-center py-12 text-zinc-500">
                <div className="text-4xl mb-3">🔍</div>
                <p>Type to search your memory</p>
                <p className="text-sm mt-1">Find pages by title, content, or keywords</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <div className="text-4xl mb-3">🤔</div>
                <p>No results for "{searchQuery}"</p>
                <p className="text-sm mt-1">Try different keywords</p>
              </div>
            ) : (
              searchResults.map(renderMemoryCard)
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && stats && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                <div className="text-3xl font-bold">{stats.totalPages}</div>
                <div className="text-sm opacity-80">Pages remembered</div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-green-500 to-teal-500 text-white">
                <div className="text-3xl font-bold">{formatDuration(stats.totalTime)}</div>
                <div className="text-sm opacity-80">Total browsing time</div>
              </div>
            </div>

            {/* Top Domains */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <span>🌐</span> Top Sites
              </h4>
              <div className="space-y-2">
                {stats.topDomains.slice(0, 5).map((domain, i) => (
                  <div key={domain.domain} className="flex items-center gap-3">
                    <span className="text-sm text-zinc-400 w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{domain.domain}</div>
                      <div className="text-xs text-zinc-500">
                        {domain.visits} visits · {formatDuration(domain.time)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <span>📊</span> Categories
              </h4>
              <div className="flex flex-wrap gap-2">
                {stats.topCategories.map(cat => (
                  <span 
                    key={cat.category}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-sm"
                  >
                    {getCategoryIcon(cat.category)}
                    <span className="font-medium">{cat.category}</span>
                    <span className="text-zinc-500">({cat.count})</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MemoryPanel;

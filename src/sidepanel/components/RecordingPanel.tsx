import { useState, useEffect } from 'react';
import { sendToBackground } from '../../common/messaging';
import { exportAsCode } from '../utils/recording-export';

export interface RecordedAction {
  type: 'click' | 'type' | 'navigate' | 'scroll' | 'select' | 'hover';
  selector?: string;
  value?: string;
  timestamp: number;
  screenshot?: string;
}

export interface Recording {
  id: string;
  name: string;
  actions: RecordedAction[];
  createdAt: number;
  duration: number;
}

export function RecordingPanel() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recordingName, setRecordingName] = useState('');
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [exportFormat, setExportFormat] = useState<'nano' | 'cypress' | 'puppeteer'>('nano');

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const stored = await chrome.storage.local.get('recordings');
      setRecordings(stored.recordings || []);
    } catch (error) {
      console.error('Failed to load recordings:', error);
    }
  };

  const handleStartRecording = async () => {
    try {
      await sendToBackground({ type: 'START_RECORDING', name: recordingName || `Recording ${Date.now()}` });
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStopRecording = async () => {
    try {
      await sendToBackground({ type: 'STOP_RECORDING' });
      setIsRecording(false);
      setRecordingName('');
      await loadRecordings();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handleReplay = async (recording: Recording) => {
    try {
      await sendToBackground({ type: 'REPLAY_RECORDING', recording });
    } catch (error) {
      console.error('Failed to replay recording:', error);
    }
  };

  const handleExport = (recording: Recording) => {
    const code = exportAsCode(recording, exportFormat);
    
    // Copy to clipboard
    navigator.clipboard.writeText(code);
    
    // Download as file
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.name}.${exportFormat === 'cypress' ? 'cy' : 'js'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (recordingId: string) => {
    try {
      const stored = await chrome.storage.local.get('recordings');
      const recordings = (stored.recordings || []).filter((r: Recording) => r.id !== recordingId);
      await chrome.storage.local.set({ recordings });
      await loadRecordings();
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          🎥 Action Recorder
        </h2>
        <p className="text-gray-400 text-sm">
          Record user interactions and replay them or export as code
        </p>
      </div>

      {/* Recording Controls */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 mb-4 border border-white/20">
        {!isRecording ? (
          <div className="space-y-3">
            <input
              type="text"
              value={recordingName}
              onChange={(e) => setRecordingName(e.target.value)}
              placeholder="Recording name (optional)"
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleStartRecording}
              className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              Start Recording
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-semibold">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              Recording in progress...
            </div>
            <button
              onClick={handleStopRecording}
              className="w-full px-4 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 rounded-lg font-semibold transition-all duration-200"
            >
              ⏹️ Stop Recording
            </button>
          </div>
        )}
      </div>

      {/* Recordings List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        <h3 className="text-lg font-semibold mb-2 text-gray-300">
          Saved Recordings ({recordings.length})
        </h3>
        
        {recordings.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">🎬</div>
            <p>No recordings yet</p>
            <p className="text-sm">Start recording to capture your actions</p>
          </div>
        ) : (
          recordings.map((recording) => (
            <div
              key={recording.id}
              className="bg-white/10 backdrop-blur-lg rounded-lg p-4 border border-white/20 hover:border-purple-400 transition-all duration-200 cursor-pointer"
              onClick={() => setSelectedRecording(recording === selectedRecording ? null : recording)}
            >
              {/* Recording Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-white">{recording.name}</h4>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                    <span>📅 {new Date(recording.createdAt).toLocaleDateString()}</span>
                    <span>⏱️ {formatDuration(recording.duration)}</span>
                    <span>🎬 {recording.actions.length} actions</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(recording.id);
                  }}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  🗑️
                </button>
              </div>

              {/* Expanded Actions */}
              {selectedRecording === recording && (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
                  {/* Actions Preview */}
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {recording.actions.slice(0, 10).map((action, idx) => (
                      <div key={idx} className="text-xs text-gray-400 flex items-center gap-2">
                        <span className="text-gray-500">#{idx + 1}</span>
                        <span className="text-purple-400">{action.type}</span>
                        {action.selector && <span className="text-gray-400 truncate">{action.selector}</span>}
                        {action.value && <span className="text-green-400">"{action.value}"</span>}
                      </div>
                    ))}
                    {recording.actions.length > 10 && (
                      <div className="text-xs text-gray-500">
                        ... and {recording.actions.length - 10} more actions
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReplay(recording);
                      }}
                      className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg text-sm font-semibold transition-all duration-200"
                    >
                      ▶️ Replay
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(recording);
                      }}
                      className="px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg text-sm font-semibold transition-all duration-200"
                    >
                      📤 Export
                    </button>
                  </div>

                  {/* Export Format Selector */}
                  <div className="flex gap-2">
                    {(['nano', 'cypress', 'puppeteer'] as const).map((format) => (
                      <button
                        key={format}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExportFormat(format);
                        }}
                        className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                          exportFormat === format
                            ? 'bg-purple-500 text-white'
                            : 'bg-white/10 text-gray-400 hover:bg-white/20'
                        }`}
                      >
                        {format.charAt(0).toUpperCase() + format.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

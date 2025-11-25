import React, { useState, useEffect } from 'react';
import { ttsService } from '../../common/tts-service';

export const VoiceFeedback: React.FC = () => {
  console.log('[VoiceFeedback] Component mounting...');
  
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [queueLength, setQueueLength] = useState(0);
  const [status, setStatus] = useState('idle');
  const [isPaused, setIsPaused] = useState(false);
  
  console.log('[VoiceFeedback] Initial state set:', { isSpeaking, transcript, queueLength, status, isPaused });

  const handleTtsStart = () => {
    console.log('[VoiceFeedback] TTS speaking-start event received');
    setIsSpeaking(true);
    setStatus('speaking');
    console.log('[VoiceFeedback] State updated: isSpeaking=true, status=speaking');
  };

  const handleTtsEnd = () => {
    console.log('[VoiceFeedback] TTS speaking-end event received');
    setIsSpeaking(false);
    setStatus('idle');
    console.log('[VoiceFeedback] State updated: isSpeaking=false, status=idle');
  };

  const handleTtsPause = () => {
    console.log('[VoiceFeedback] TTS speaking-pause event received');
    setIsPaused(true);
    setStatus('paused');
    console.log('[VoiceFeedback] State updated: isPaused=true, status=paused');
  };

  const handleTtsResume = () => {
    console.log('[VoiceFeedback] TTS speaking-resume event received');
    setIsPaused(false);
    setStatus('speaking');
    console.log('[VoiceFeedback] State updated: isPaused=false, status=speaking');
  };

  const handleTtsError = (error: any) => {
    console.log('[VoiceFeedback] TTS speaking-error event received:', error);
    setIsSpeaking(false);
    setStatus('error');
    console.log('[VoiceFeedback] State updated: isSpeaking=false, status=error');
  };

  const handleTtsQueueUpdate = (length: number) => {
    console.log('[VoiceFeedback] TTS queue-update event received, length:', length);
    setQueueLength(length);
    console.log('[VoiceFeedback] State updated: queueLength=', length);
  };

  const handleTtsText = (text: string) => {
    console.log('[VoiceFeedback] TTS text-update event received:', text);
    setTranscript(text);
    console.log('[VoiceFeedback] State updated: transcript=', text);
  };

  const handlePauseClick = () => {
    console.log('[VoiceFeedback] Pause button clicked');
    ttsService.pause();
    console.log('[VoiceFeedback] TTS pause() called');
  };

  const handleResumeClick = () => {
    console.log('[VoiceFeedback] Resume button clicked');
    ttsService.resume();
    console.log('[VoiceFeedback] TTS resume() called');
  };

  const handleStopClick = () => {
    console.log('[VoiceFeedback] Stop button clicked');
    ttsService.stop();
    console.log('[VoiceFeedback] TTS stop() called');
  };

  useEffect(() => {
    console.log('[VoiceFeedback] useEffect running - setting up event listeners');
    
    ttsService.on('speaking-start', handleTtsStart);
    ttsService.on('speaking-end', handleTtsEnd);
    ttsService.on('speaking-pause', handleTtsPause);
    ttsService.on('speaking-resume', handleTtsResume);
    ttsService.on('speaking-error', handleTtsError);
    ttsService.on('queue-update', handleTtsQueueUpdate);
    ttsService.on('text-update', handleTtsText);
    
    console.log('[VoiceFeedback] All TTS event listeners registered');
    
    return () => {
      console.log('[VoiceFeedback] useEffect cleanup - removing event listeners');
      ttsService.off('speaking-start', handleTtsStart);
      ttsService.off('speaking-end', handleTtsEnd);
      ttsService.off('speaking-pause', handleTtsPause);
      ttsService.off('speaking-resume', handleTtsResume);
      ttsService.off('speaking-error', handleTtsError);
      ttsService.off('queue-update', handleTtsQueueUpdate);
      ttsService.off('text-update', handleTtsText);
      console.log('[VoiceFeedback] All TTS event listeners removed');
    };
  }, []);

  console.log('[VoiceFeedback] Render cycle starting - current state:', {
    isSpeaking,
    transcript,
    queueLength,
    status,
    isPaused
  });

  const hasActivity = isSpeaking || queueLength > 0;
  console.log('[VoiceFeedback] Calculated hasActivity:', hasActivity);

  const logRender = (...args: unknown[]) => {
    console.log(...args);
    return null;
  };
  // Respect system theme (dark/light) so idle card doesn't show as white in dark panels
  const prefersDark = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  // Keep idle card visually minimal: transparent background so it blends into the panel
  const idleBackground = 'transparent';
  const idleBorder = prefersDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)';
  const idleText = prefersDark ? '#e5e7eb' : '#212529';

  const containerStyle: React.CSSProperties = {
    width: '100%',
    background: hasActivity ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : idleBackground,
    border: hasActivity ? '1px solid rgba(255, 255, 255, 0.12)' : idleBorder,
    boxShadow: hasActivity ? '0 8px 24px rgba(102, 126, 234, 0.25)' : 'none',
    transition: 'all 0.24s ease',
    borderRadius: '12px',
    padding: '10px 12px',
    margin: '6px 0',
    minHeight: 48,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    color: hasActivity ? 'white' : idleText,
    position: 'relative',
    overflow: 'hidden'
  };

  console.log('[VoiceFeedback] Container style calculated:', containerStyle);

  return (
    <div style={containerStyle}>
      {logRender('[VoiceFeedback] Rendering main container')}
      
      {/* Status Badge */}
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '12px',
        fontSize: '10px',
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        opacity: 0.8,
        background: hasActivity ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
        padding: '2px 6px',
        borderRadius: '8px',
        color: hasActivity ? 'white' : '#666'
      }}>
  {logRender('[VoiceFeedback] Rendering status badge:', status)}
        {status}
      </div>

      {/* Waveform Animation */}
      {isSpeaking && (
        <div style={{ display: 'flex', gap: '3px', height: '28px', alignItems: 'end' }}>
          {logRender('[VoiceFeedback] Rendering waveform animation')}
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              width: '3px',
              height: '8px',
              backgroundColor: 'white',
              borderRadius: '2px',
              animation: 'vf-wave-dance 0.5s ease-in-out infinite',
              animationDelay: `${i * 0.1}s`
            }} />
          ))}
        </div>
      )}

      {/* Pulsing Indicator */}
      {hasActivity && (
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: 'white',
          animation: 'vf-pulse 2s ease-in-out infinite'
        }}>
          {logRender('[VoiceFeedback] Rendering pulsing indicator')}
        </div>
      )}

      {/* Main Text */}
      <div style={{
        fontSize: '16px',
        fontWeight: '500',
        lineHeight: '1.4',
        marginLeft: hasActivity ? '20px' : '0',
        marginRight: '60px'
      }}>
        {logRender('[VoiceFeedback] Rendering main text:', transcript)}
  {transcript}
      </div>

      {/* Queue Counter */}
      {queueLength > 0 && (
        <div style={{
          fontSize: '12px',
          opacity: 0.8,
          marginLeft: '20px'
        }}>
          {logRender('[VoiceFeedback] Rendering queue counter:', queueLength)}
          {queueLength} item{queueLength > 1 ? 's' : ''} in queue
        </div>
      )}

      {/* Control Buttons */}
      {hasActivity && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          display: 'flex',
          gap: '4px'
        }}>
          {logRender('[VoiceFeedback] Rendering control buttons')}
          {isPaused ? (
            <button
              onClick={handleResumeClick}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '6px',
                width: '24px',
                height: '24px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}
            >
              ▶️
            </button>
          ) : (
            <button
              onClick={handlePauseClick}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '6px',
                width: '24px',
                height: '24px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}
            >
              ⏸️
            </button>
          )}
          <button
            onClick={handleStopClick}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '6px',
              width: '24px',
              height: '24px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}
            >
              ⏹️
            </button>
        </div>
      )}

      {/* CSS Animations */}
      <style>
        {`
          @keyframes vf-wave-dance {
            0%, 100% { height: 8px; }
            25% { height: 16px; }
            50% { height: 24px; }
            75% { height: 16px; }
          }
          
          @keyframes vf-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
          }
        `}
      </style>
    </div>
  );
};

export default VoiceFeedback;

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download, RotateCcw, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  blob: Blob | null;
  onRegenerate?: () => void;
  speed: number;
}

export default function AudioPlayer({ blob, onRegenerate, speed }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (blob) {
      const newUrl = URL.createObjectURL(blob);
      setUrl(newUrl);
      return () => URL.revokeObjectURL(newUrl);
    }
    setUrl(null);
  }, [blob]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const download = () => {
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `chunk-${Date.now()}.wav`;
      a.click();
    }
  };

  if (!blob || !url) {
    return (
      <div className="flex items-center gap-2 text-accent-soft italic text-sm">
        <Volume2 size={16} />
        Awaiting narration...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex-1 h-3 bg-accent-soft rounded-full overflow-hidden relative">
        <div className="absolute inset-0 bg-accent opacity-20 w-full animate-pulse-slow"></div>
      </div>

      <div className="flex items-center gap-2">
        <button 
          onClick={togglePlay}
          className="btn-icon"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>

        {onRegenerate && (
          <button onClick={onRegenerate} title="Re-narrate" className="btn-icon">
            <RotateCcw size={14} />
          </button>
        )}

        <button onClick={download} title="Download fragment" className="btn-icon ml-auto">
          <Download size={14} />
        </button>
      </div>

      <audio 
        ref={audioRef} 
        src={url} 
        onEnded={() => setIsPlaying(false)} 
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
}

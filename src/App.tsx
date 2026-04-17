import React, { useState, useCallback, useMemo } from 'react';
import { 
  FileText, 
  Settings, 
  PlayCircle, 
  Download, 
  Scroll, 
  Type, 
  ChevronRight, 
  Mic2,
  Trash2,
  CheckCircle2,
  Loader2,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateSpeech, VOICES } from './services/geminiService';
import AudioPlayer from './components/AudioPlayer';

interface StoryChunk {
  id: number;
  text: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  blob: Blob | null;
  pcm?: Uint8Array;
}

export default function App() {
  const [fullStory, setFullStory] = useState('');
  const [chunks, setChunks] = useState<StoryChunk[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('Charon'); // Using Charon as proxy for Algieba for now
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Stats
  const completionProgress = useMemo(() => {
    if (chunks.length === 0) return 0;
    const voiced = chunks.filter(c => c.status === 'success').length;
    return Math.round((voiced / chunks.length) * 100);
  }, [chunks]);

  const splitStory = useCallback(() => {
    if (!fullStory.trim()) return;

    // Split by sentences (very rough proxy for 30s chunks)
    // 30s is approx 75-100 words.
    const sentences = fullStory.match(/[^.!?]+[.!?]+/g) || [fullStory];
    const newChunks: StoryChunk[] = [];
    let currentText = '';
    let id = 0;

    sentences.forEach((sentence) => {
      // If adding this sentence exceeds roughly 500 chars, start new chunk
      if (currentText.length + sentence.length > 500 && currentText.length > 0) {
        newChunks.push({
          id: id++,
          text: currentText.trim(),
          status: 'idle',
          blob: null
        });
        currentText = sentence;
      } else {
        currentText += ' ' + sentence;
      }
    });

    if (currentText.trim()) {
      newChunks.push({
        id: id++,
        text: currentText.trim(),
        status: 'idle',
        blob: null
      });
    }

    setChunks(newChunks);
  }, [fullStory]);

  const voiceChunk = async (index: number) => {
    const chunk = chunks[index];
    if (!chunk) return;

    setChunks(prev => prev.map((c, i) => i === index ? { ...c, status: 'loading' } : c));

    try {
      const { blob: blobData, pcm: pcmData } = await generateSpeech(chunk.text, selectedVoice, playbackSpeed);
      // Store both blob for UI and pcm for combination
      setChunks(prev => prev.map((c, i) => i === index ? { 
        ...c, 
        status: 'success', 
        blob: blobData,
        pcm: pcmData
      } : c));
    } catch (err) {
      setChunks(prev => prev.map((c, i) => i === index ? { ...c, status: 'error' } : c));
    }
  };

  const voiceAll = async () => {
    setIsProcessing(true);
    // Voice one by one to avoid rate limits/overload
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].status !== 'success') {
        await voiceChunk(i);
      }
    }
    setIsProcessing(false);
  };

  const clearAll = () => {
    setFullStory('');
    setChunks([]);
  };

  const downloadFullAudio = async () => {
    const pcmChunks = chunks.map(c => c.pcm).filter((p): p is Uint8Array => !!p);
    if (pcmChunks.length === 0) return;

    // Concat PCM data
    const totalLength = pcmChunks.reduce((acc, current) => acc + current.length, 0);
    const combinedPcm = new Uint8Array(totalLength);
    let offset = 0;
    for (const pcm of pcmChunks) {
      combinedPcm.set(pcm, offset);
      offset += pcm.length;
    }

    // Wrap in a single WAV header
    const { createWavBlob } = await import('./services/geminiService');
    const finalBlob = createWavBlob(combinedPcm, 24000);
    
    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noirvoice-full-story-${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-base font-sans text-ink">
      {/* Header */}
      <header className="h-[70px] bg-white border-b border-accent-soft flex items-center justify-between px-10 shadow-sm z-10 shrink-0">
        <div className="font-serif text-2xl font-bold text-accent tracking-tighter">
          Studio Detective
        </div>
        <div className="flex items-center gap-5">
          <div className="text-sm font-medium opacity-80 lg:block hidden">Current Story: Cabinet Noir</div>
          <div className="flex items-center gap-3">
            <div className="w-[300px] h-3 bg-accent-soft rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${completionProgress}%` }}
              />
            </div>
            <div className="text-xs font-bold w-8">{completionProgress}%</div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 bg-bg-sidebar border-r border-accent-soft p-8 flex flex-col gap-10 overflow-y-auto shrink-0">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-60 mb-4">Voice Selection</div>
            <div className="flex flex-col gap-2">
              {VOICES.map(v => (
                <div 
                  key={v.id} 
                  onClick={() => setSelectedVoice(v.id)}
                  className={`voice-item ${selectedVoice === v.id ? 'voice-item-active' : 'hover:bg-white/40'}`}
                >
                  <span className="text-sm font-medium">{v.name}</span>
                  {selectedVoice === v.id && (
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-8">
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-60 mb-[-10px]">Playback Control</div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span>Speed: {playbackSpeed.toFixed(1)}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="w-full accent-accent h-1.5 rounded-full bg-accent-soft cursor-pointer"
              />
            </div>
          </div>

          <section className="mt-auto pt-4 border-t border-accent-soft flex flex-col gap-3">
             <button 
              onClick={downloadFullAudio}
              disabled={chunks.filter(c => c.status === 'success').length === 0}
              className="btn-main"
            >
              <Download size={18} /> Assemble Full Story
            </button>
            <button onClick={clearAll} className="btn-secondary py-3">
              <Trash2 size={16} /> Reset All
            </button>
          </section>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-10 flex flex-col gap-8 overflow-y-auto bg-bg-base">
          <section className="flex flex-col gap-6">
            <div className="text-[11px] font-bold uppercase tracking-widest opacity-60">Story Transcript</div>
            <div className="relative group">
              <textarea 
                value={fullStory}
                onChange={(e) => setFullStory(e.target.value)}
                placeholder="The shadows grew long in the city of rain..."
                className="w-full h-48 input-natural serif text-lg leading-relaxed placeholder:italic p-4 resize-none"
              />
            </div>

            <div className="flex gap-4">
              <button onClick={splitStory} className="btn-secondary flex-1">
                <Layers size={18} /> Analyze & Segment
              </button>
              <button 
                onClick={voiceAll} 
                disabled={chunks.length === 0 || isProcessing}
                className="btn-main flex-[1.5]"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <PlayCircle size={18} />}
                Narrate Entire Board
              </button>
            </div>
          </section>

          {chunks.length > 0 && (
            <section className="flex flex-col gap-6">
              <div className="text-[11px] font-bold uppercase tracking-widest opacity-60">Audio Evidence Fragments</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {chunks.map((chunk, idx) => (
                  <motion.div 
                    key={chunk.id} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="card-natural flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-sm">Fragment #{idx + 1}</span>
                      <span className="text-[11px] opacity-60">{chunk.status === 'loading' ? 'Processing...' : 'Ready'}</span>
                    </div>

                    <div className="text-sm p-4 bg-bg-base/50 rounded-lg italic serif text-ink/70 h-24 overflow-hidden mask-fade-bottom">
                      "{chunk.text}"
                    </div>

                    <AudioPlayer 
                      blob={chunk.blob} 
                      onRegenerate={() => voiceChunk(idx)} 
                      speed={playbackSpeed}
                    />
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {chunks.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-20 select-none">
              <Scroll size={80} strokeWidth={1} className="mb-4 text-accent" />
              <p className="font-serif text-xl italic">Prepare your case for transcription.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

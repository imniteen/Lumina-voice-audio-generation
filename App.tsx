
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceName, VoiceOption, AudioState } from './types';
import { generateSpeech } from './geminiService';
import { decodeBase64, decodeAudioData, createWavBlob } from './audioUtils';

const VOICE_OPTIONS: VoiceOption[] = [
  { id: VoiceName.ZEPHYR, name: 'Zephyr', description: 'Authoritative & Confident - Ideal for Product Demos' },
  { id: VoiceName.FENRIR, name: 'Fenrir', description: 'Smooth & Sophisticated - Professional Narrative' },
  { id: VoiceName.KORE, name: 'Kore', description: 'Bright & Energetic - Modern Start-up Vibe' },
  { id: VoiceName.PUCK, name: 'Puck', description: 'Youthful & Dynamic - Engaging Content' },
  { id: VoiceName.CHARON, name: 'Charon', description: 'Sturdy & Reliable - Technical Explanations' },
];

const DEFAULT_STORY = "Welcome to Lumina, the next generation of cloud-native infrastructure management. Our platform provides absolute visibility into your distributed microservices, allowing your engineering teams to deploy faster, resolve incidents with precision, and scale with total confidence. From real-time telemetry to automated healing, we've simplified the complex. Let me show you how Lumina can transform your workflow today.";

const App: React.FC = () => {
  const [text, setText] = useState(DEFAULT_STORY);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.ZEPHYR);
  const [lastAudioBlob, setLastAudioBlob] = useState<Blob | null>(null);
  const [visualData, setVisualData] = useState<number[]>(new Array(16).fill(0));
  const [status, setStatus] = useState<AudioState>({
    isGenerating: false,
    isPlaying: false,
    error: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // Source might have already stopped
      }
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setVisualData(new Array(16).fill(0));
    setStatus(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const startVisualizer = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      
      const step = Math.floor(bufferLength / 20); 
      const newVisualData = [];
      for (let i = 0; i < 16; i++) {
        let sum = 0;
        for (let j = 0; j < 4; j++) {
          sum += dataArray[i * step + j] || 0;
        }
        newVisualData.push(sum / 4);
      }
      setVisualData(newVisualData);
      animationFrameRef.current = requestAnimationFrame(update);
    };

    update();
  }, []);

  const handleGenerateAndPlay = async () => {
    if (status.isPlaying) {
      stopPlayback();
      return;
    }

    setStatus({ isGenerating: true, isPlaying: false, error: null });
    setLastAudioBlob(null);

    try {
      const base64Audio = await generateSpeech(text, selectedVoice);
      const audioBytes = decodeBase64(base64Audio);

      const wavBlob = createWavBlob(audioBytes, 24000);
      setLastAudioBlob(wavBlob);

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current, 24000, 1);
      
      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.8;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setStatus(prev => ({ ...prev, isPlaying: false }));
        setVisualData(new Array(16).fill(0));
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        sourceNodeRef.current = null;
      };

      sourceNodeRef.current = source;
      source.start();
      setStatus({ isGenerating: false, isPlaying: true, error: null });
      startVisualizer();

    } catch (err: any) {
      console.error("Speech Generation Error:", err);
      setStatus({ 
        isGenerating: false, 
        isPlaying: false, 
        error: err.message?.includes("500") 
          ? "The server encountered an internal error. Please try again with a shorter text or a different voice." 
          : err.message || 'An error occurred while generating speech.' 
      });
    }
  };

  const handleDownload = () => {
    if (!lastAudioBlob) return;
    const url = URL.createObjectURL(lastAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumina-demo-${selectedVoice.toLowerCase()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Controls */}
        <div className="w-full md:w-1/3 bg-slate-800/50 p-6 md:p-8 flex flex-col gap-8 border-b md:border-b-0 md:border-r border-slate-700">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Lumina Demo
            </h1>
            <p className="text-slate-400 text-sm mt-2">Professional Speech Synthesis</p>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-semibold uppercase tracking-wider text-slate-500">Demo Voice</label>
            <div className="grid grid-cols-1 gap-2">
              {VOICE_OPTIONS.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => {
                    setSelectedVoice(voice.id);
                    setLastAudioBlob(null);
                  }}
                  className={`p-3 rounded-xl text-left transition-all duration-200 border ${
                    selectedVoice === voice.id 
                    ? 'bg-blue-600/20 border-blue-500 text-blue-100' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <div className="font-bold">{voice.name}</div>
                  <div className="text-xs opacity-70 leading-tight">{voice.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto space-y-3">
             {status.error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-xs leading-relaxed">
                <strong>Error:</strong> {status.error}
              </div>
            )}
            
            <button
              onClick={handleGenerateAndPlay}
              disabled={status.isGenerating || !text.trim()}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                status.isPlaying
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {status.isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : status.isPlaying ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H10a1 1 0 01-1-1v-4z" />
                  </svg>
                  Stop Preview
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Generate Demo
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              disabled={!lastAudioBlob}
              className={`w-full py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-300 border ${
                lastAudioBlob
                ? 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500'
                : 'bg-transparent border-slate-800 text-slate-700 cursor-not-allowed'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export .WAV
            </button>
          </div>
        </div>

        {/* Right Side: Demo Script Area */}
        <div className="flex-1 p-6 md:p-8 flex flex-col relative bg-slate-900/40">
          <label className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4 block">Demo Script</label>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setLastAudioBlob(null);
            }}
            placeholder="Enter your product demo script here..."
            className="flex-1 w-full bg-transparent text-slate-100 text-lg md:text-xl leading-relaxed resize-none focus:outline-none placeholder:text-slate-700 selection:bg-blue-500/30"
          />
          
          <div className="mt-4 flex items-center justify-between text-slate-500 text-sm border-t border-slate-800 pt-4">
            <span>{text.length} characters</span>
            <div className="flex gap-4">
               <button 
                onClick={() => { setText(""); setLastAudioBlob(null); }}
                className="hover:text-slate-300 transition-colors"
              >
                Clear Script
              </button>
              <button 
                onClick={() => { setText(DEFAULT_STORY); setLastAudioBlob(null); }}
                className="hover:text-slate-300 transition-colors font-medium text-blue-400"
              >
                Reset to Demo
              </button>
            </div>
          </div>

          {/* Real Audio Visualizer */}
          <div className="absolute bottom-16 right-8 flex items-end gap-1.5 h-20 pointer-events-none">
            {visualData.map((value, i) => (
              <div 
                key={i} 
                className="w-2 rounded-full transition-all duration-75 ease-out shadow-[0_0_15px_rgba(96,165,250,0.2)]"
                style={{ 
                  height: `${Math.max(8, (value / 255) * 100)}%`,
                  backgroundColor: status.isPlaying 
                    ? `rgb(${Math.min(255, 60 + value)}, ${Math.min(255, 130 + value / 2)}, 255)` 
                    : '#1e293b',
                  opacity: status.isPlaying ? 0.9 : 0.1
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-8 text-slate-500 text-xs text-center opacity-70 flex flex-col gap-1">
        <p>Using <code>gemini-2.5-flash-preview-tts</code> for professional narration.</p>
        <p>Low-latency PCM-to-WAV pipeline ensuring broadcast-quality audio output.</p>
      </footer>
    </div>
  );
};

export default App;


import React, { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceName, VoiceOption, AudioState, Accent } from './types';
import { generateSpeech } from './geminiService';
import { decodeBase64, decodeAudioData, createWavBlob } from './audioUtils';

const VOICE_OPTIONS: VoiceOption[] = [
  { id: VoiceName.CHARON, name: 'Charon', description: 'Sturdy & Reliable - Technical Explanations' },
  { id: VoiceName.ZEPHYR, name: 'Zephyr', description: 'Authoritative & Confident - Ideal for Product Demos' },
  { id: VoiceName.FENRIR, name: 'Fenrir', description: 'Smooth & Sophisticated - Professional Narrative' },
  { id: VoiceName.KORE, name: 'Kore', description: 'Bright & Energetic - Modern Start-up Vibe' },
  { id: VoiceName.PUCK, name: 'Puck', description: 'Youthful & Dynamic - Engaging Content' },
];

const ACCENTS: Accent[] = ['Neutral', 'British', 'Australian', 'Indian', 'Southern US', 'Scottish'];

const DEFAULT_STORY = "Welcome to Lumina, the next generation of cloud-native infrastructure management. Our platform provides absolute visibility into your distributed microservices, allowing your engineering teams to deploy faster, resolve incidents with precision, and scale with total confidence. From real-time telemetry to automated healing, we've simplified the complex. Let me show you how Lumina can transform your workflow today.";

const App: React.FC = () => {
  const [text, setText] = useState(DEFAULT_STORY);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.CHARON);
  const [selectedAccent, setSelectedAccent] = useState<Accent>('Neutral');
  const [speakingRate, setSpeakingRate] = useState<number>(1.0);
  const [lastAudioBlob, setLastAudioBlob] = useState<Blob | null>(null);
  const [visualData, setVisualData] = useState<number[]>(new Array(16).fill(0));
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<AudioState>({
    isGenerating: false,
    isPlaying: false,
    error: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setText(prev => (prev.trim() ? prev + ' ' + finalTranscript : finalTranscript));
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        setStatus(prev => ({ ...prev, error: `Microphone error: ${event.error}` }));
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setStatus(prev => ({ ...prev, error: "Speech recognition is not supported in this browser." }));
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setStatus(prev => ({ ...prev, error: null }));
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start recognition", e);
      }
    }
  };

  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) { }
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

    if (isListening) toggleListening();

    setStatus({ isGenerating: true, isPlaying: false, error: null });
    setLastAudioBlob(null);

    try {
      const base64Audio = await generateSpeech(text, selectedVoice, speakingRate, selectedAccent);
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
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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
          ? "The server encountered an internal error. Please try again with a shorter text or a different accent." 
          : err.message || 'An error occurred while generating speech.' 
      });
    }
  };

  const handleDownload = () => {
    if (!lastAudioBlob) return;
    const url = URL.createObjectURL(lastAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    const accentStr = selectedAccent === 'Neutral' ? '' : `-${selectedAccent.toLowerCase().replace(' ', '-')}`;
    a.download = `lumina-${selectedVoice.toLowerCase()}${accentStr}.wav`;
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
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Controls */}
        <div className="w-full md:w-80 bg-slate-800/50 p-6 md:p-8 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-slate-700">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Lumina Voice
            </h1>
            <p className="text-slate-400 text-sm mt-2">AI Storytelling Engine</p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Voice Character</label>
            <div className="grid grid-cols-1 gap-2">
              {VOICE_OPTIONS.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => { setSelectedVoice(voice.id); setLastAudioBlob(null); }}
                  className={`p-3 rounded-xl text-left transition-all duration-200 border text-sm ${
                    selectedVoice === voice.id 
                    ? 'bg-blue-600/20 border-blue-500 text-blue-100 ring-1 ring-blue-500/50' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <div className="font-bold">{voice.name}</div>
                  <div className="text-[11px] opacity-60 leading-tight truncate">{voice.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Voice Accent</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ACCENTS.map((accent) => (
                <button
                  key={accent}
                  onClick={() => { setSelectedAccent(accent); setLastAudioBlob(null); }}
                  className={`px-2 py-2 rounded-lg text-xs font-medium transition-all border ${
                    selectedAccent === accent
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-100'
                      : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                  }`}
                >
                  {accent}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Pace</label>
              <span className="text-blue-400 font-bold text-[10px] bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/20">{speakingRate.toFixed(1)}x</span>
            </div>
            <input
              type="range" min="0.5" max="2.0" step="0.1" value={speakingRate}
              onChange={(e) => { setSpeakingRate(parseFloat(e.target.value)); setLastAudioBlob(null); }}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="mt-auto space-y-3 pt-4 border-t border-slate-700/50">
             {status.error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-[10px] leading-relaxed">
                {status.error}
              </div>
            )}
            
            <button
              onClick={handleGenerateAndPlay}
              disabled={status.isGenerating || !text.trim()}
              className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-300 ${
                status.isPlaying
                ? 'bg-slate-700 hover:bg-slate-600 text-white'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/20 disabled:opacity-30'
              }`}
            >
              {status.isGenerating ? (
                <div className="flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></div>
                </div>
              ) : status.isPlaying ? (
                <>Stop</>
              ) : (
                <>Generate & Play</>
              )}
            </button>

            <button
              onClick={handleDownload}
              disabled={!lastAudioBlob}
              className={`w-full py-3 rounded-2xl font-semibold text-xs flex items-center justify-center gap-2 border transition-all ${
                lastAudioBlob
                ? 'bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700'
                : 'bg-transparent border-slate-800 text-slate-700 cursor-not-allowed'
              }`}
            >
              Export High-Res .WAV
            </button>
          </div>
        </div>

        {/* Right Side: Demo Script Area */}
        <div className="flex-1 p-6 md:p-8 flex flex-col relative bg-slate-900/40">
          <div className="flex justify-between items-center mb-6">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 block">Narrative Script</label>
            <button
              onClick={toggleListening}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 text-[10px] font-bold uppercase tracking-widest ${
                isListening 
                  ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-900/40' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-white animate-pulse' : 'bg-red-500'}`}></div>
              {isListening ? 'Live Recording...' : 'Voice Dictation'}
            </button>
          </div>
          
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setLastAudioBlob(null); }}
            placeholder="Type your script or start dictation..."
            className="flex-1 w-full bg-transparent text-slate-200 text-lg md:text-2xl leading-relaxed resize-none focus:outline-none placeholder:text-slate-800 selection:bg-blue-500/30 font-light"
          />
          
          <div className="mt-6 flex items-center justify-between text-slate-600 text-[10px] border-t border-slate-800 pt-6 font-medium tracking-wider">
            <span>{text.split(/\s+/).filter(x => x).length} WORDS / {text.length} CHARS</span>
            <div className="flex gap-6">
               <button 
                onClick={() => { setText(""); setLastAudioBlob(null); }}
                className="hover:text-red-400 transition-colors uppercase"
              >
                Clear
              </button>
              <button 
                onClick={() => { setText(DEFAULT_STORY); setLastAudioBlob(null); }}
                className="hover:text-blue-400 transition-colors uppercase text-blue-500"
              >
                Restore Default
              </button>
            </div>
          </div>

          {/* Real Audio Visualizer */}
          <div className="absolute bottom-20 right-10 flex items-end gap-1.5 h-24 pointer-events-none">
            {visualData.map((value, i) => (
              <div 
                key={i} 
                className="w-2.5 rounded-full transition-all duration-75 ease-out"
                style={{ 
                  height: `${Math.max(4, (value / 255) * 100)}%`,
                  backgroundColor: status.isPlaying 
                    ? `rgba(96, 165, 250, ${0.3 + (value / 255) * 0.7})` 
                    : 'rgba(30, 41, 59, 0.3)',
                  boxShadow: status.isPlaying && value > 150 ? '0 0 15px rgba(96, 165, 250, 0.4)' : 'none'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <footer className="mt-8 text-slate-600 text-[10px] text-center opacity-70 flex flex-col gap-2 tracking-[0.2em] uppercase">
        <p>Engineered with Gemini 2.5 Flash TTS</p>
        <div className="h-px w-12 bg-slate-800 mx-auto"></div>
        <p>Broadcasting in Studio Quality 24kHz Mono</p>
      </footer>
    </div>
  );
};

export default App;

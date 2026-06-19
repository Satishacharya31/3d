import { useState, useRef, useEffect } from 'react';
import { Send, Volume2, Mic, MicOff, MonitorUp, Activity } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Myra3D } from './Myra3D';

type Role = 'user' | 'model';
interface Message {
  id: string;
  role: Role;
  text?: string;
  image?: string;
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: 'Live session initialized. I am Myra. How can I assist you?' }
  ]);
  const [input, setInput] = useState('');
  
  // Live API Connection state
  const [initialized, setInitialized] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const speakingTimeoutRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const initSystem = async () => {
     setInitialized(true);
     await connectToLive();
     await toggleMic(true);
  };

  const connectToLive = async () => {
    if (connected) return;
    setConnecting(true);
    setError(null);

    try {
      let wsUrl = '';
      const customWsUrl = (import.meta as any).env?.VITE_WS_URL || '';
      if (customWsUrl) {
        if (customWsUrl.startsWith('ws://') || customWsUrl.startsWith('wss://')) {
          wsUrl = customWsUrl;
        } else if (customWsUrl.startsWith('http://')) {
          wsUrl = customWsUrl.replace(/^http:/, 'ws:') + (customWsUrl.endsWith('/api/live') ? '' : '/api/live');
        } else if (customWsUrl.startsWith('https://')) {
          wsUrl = customWsUrl.replace(/^https:/, 'wss:') + (customWsUrl.endsWith('/api/live') ? '' : '/api/live');
        } else {
          wsUrl = customWsUrl;
        }
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/api/live`;
      }

      console.log("Connecting WebSocket to:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const outputCtx = new AudioContext({ sampleRate: 24000 });
      audioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setError(null);
      };

      ws.onerror = (e) => {
        console.error("WebSocket connection error:", e);
        setError("WebSocket connection failed. If you hosted on Vercel, set the VITE_WS_URL environment variable in your Vercel settings to your active Cloud Run/development backend URL (e.g., wss://ais-pre-...asia-southeast1.run.app/api/live).");
        setConnecting(false);
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.audio) {
           setIsThinking(false);
           const binary = atob(msg.audio);
           const bytes = new Uint8Array(binary.length);
           for (let i = 0; i < binary.length; i++) {
             bytes[i] = binary.charCodeAt(i);
           }
           try {
             // We need a 16-bit PCM to AudioBuffer conversion since we requested Modality.AUDIO
             // Actually, the Live API returns PCM 24kHz.
             const numSamples = bytes.byteLength / 2;
             const buffer = outputCtx.createBuffer(1, numSamples, 24000);
             const channelData = buffer.getChannelData(0);
             const dataView = new DataView(bytes.buffer);
             for (let i = 0; i < numSamples; i++) {
               channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
             }
             
             const source = outputCtx.createBufferSource();
             source.buffer = buffer;
             source.connect(outputCtx.destination);
             
             if (nextStartTimeRef.current < outputCtx.currentTime) {
               nextStartTimeRef.current = outputCtx.currentTime;
             }
             
             source.start(nextStartTimeRef.current);
             
             // Simple speaking detection
             setIsSpeaking(true);
             const playTime = nextStartTimeRef.current - outputCtx.currentTime + buffer.duration;
             if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
             speakingTimeoutRef.current = window.setTimeout(() => {
                setIsSpeaking(false);
             }, playTime * 1000);
             
             nextStartTimeRef.current += buffer.duration;
           } catch(e) { console.error("Audio playback error", e) }
        }

        if (msg.text) {
           setIsThinking(false);
           setMessages(prev => {
             const last = prev[prev.length - 1];
             if (last && last.role === 'model' && !last.image) {
               // Append to last text message
               return [...prev.slice(0, -1), { ...last, text: (last.text || '') + msg.text }];
             }
             return [...prev, { id: Date.now().toString() + Math.random(), role: 'model', text: msg.text }];
           });
        }

        if (msg.image) {
           setIsThinking(false);
           setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', image: `data:image/jpeg;base64,${msg.image}` }]);
        }

        if (msg.action) {
           if (msg.action === 'startScreenShare') {
              toggleScreenPreview(true);
           } else if (msg.action === 'stopScreenShare') {
              toggleScreenPreview(false);
           }
        }

        if (msg.interrupted) {
           nextStartTimeRef.current = outputCtx.currentTime;
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setMicActive(false);
        setScreenSharing(false);
        stopAudioCapture();
        stopScreenShare();
      };
    } catch(err) {
      console.error(err);
      setError(String(err));
      setConnecting(false);
    }
  };

  const disconnect = () => {
    wsRef.current?.close();
  };

  const toggleMic = async (forceState?: boolean) => {
    if (!connected) await connectToLive();
    
    if (forceState === false || (forceState === undefined && micActive)) {
      stopAudioCapture();
      setMicActive(false);
    } else {
      if (micActive) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        
        source.connect(processor);
        processor.connect(inputCtx.destination);
        
        processor.onaudioprocess = (e) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
             pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
          }
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
          wsRef.current.send(JSON.stringify({ audio: base64 }));
        };
        setMicActive(true);
      } catch(e) { console.error("Mic error", e); }
    }
  };

  const toggleScreenPreview = async (forceState?: boolean) => {
    if (!connected) await connectToLive();
    
    if (forceState === false || (forceState === undefined && screenSharing)) {
      stopScreenShare();
      setScreenSharing(false);
    } else {
      if (screenSharing) return;
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 } });
        screenStreamRef.current = stream;
        
        const videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        await videoElement.play();
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const captureFrame = setInterval(() => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !screenStreamRef.current?.active) {
            clearInterval(captureFrame);
            return;
          }
          if (videoElement.videoWidth === 0) return;
          canvas.width = 640;
          canvas.height = (640 / videoElement.videoWidth) * videoElement.videoHeight;
          if (ctx) {
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            const base64Jpeg = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
            wsRef.current.send(JSON.stringify({ video: base64Jpeg }));
          }
        }, 2000); // 1 frame every 2s
        
        stream.getVideoTracks()[0].onended = () => {
           clearInterval(captureFrame);
           setScreenSharing(false);
        };
        setScreenSharing(true);
      } catch(e) { console.error("Screen share error", e); }
    }
  };

  const stopAudioCapture = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    processorRef.current?.disconnect();
  };
  
  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
  };

  useEffect(() => {
    return () => {
      disconnect();
      stopAudioCapture();
      stopScreenShare();
    };
  }, []);

  const handleSendText = () => {
    if (!input.trim()) return;
    if (!connected) {
       connectToLive().then(() => sendText(input.trim()));
    } else {
       sendText(input.trim());
    }
  };

  const sendText = (text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text }]);
    wsRef.current?.send(JSON.stringify({ text }));
    setIsThinking(true);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {!initialized ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-1000">
          <div className="w-32 h-32 rounded-full bg-pink-500/10 flex items-center justify-center mb-8 relative">
             <div className="absolute inset-0 bg-pink-500/20 blur-xl rounded-full ai-glow animate-pulse"></div>
             <Activity className="w-12 h-12 text-pink-500 relative z-10" />
          </div>
          <h2 className="text-3xl font-bold tracking-widest uppercase mb-4 text-white">System Myra</h2>
          <p className="text-white/50 max-w-md mb-12">
             Autonomous intelligence core. By initializing, you authorize Myra to maintain an active audio link and request screen access when necessary.
          </p>
          <button
             onClick={initSystem}
             className="px-12 h-16 rounded-3xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold tracking-[0.2em] transform hover:scale-105 transition-all shadow-[0_0_40px_rgba(244,63,94,0.4)]"
          >
             INITIALIZE CORE
          </button>
        </div>
      ) : (
        <>
          {/* Top Status */}
      <div className="shrink-0 p-4 flex justify-end items-center gap-4 border-b border-white/5">
         {connected ? (
            <div className="flex items-center gap-2 text-xs font-mono text-pink-400">
               <Activity className="w-4 h-4 animate-pulse" />
               LIVE LINK ACTIVE
               <button onClick={disconnect} className="ml-4 text-white/50 hover:text-white underline">Disconnect</button>
            </div>
         ) : (
            <div className="flex items-center gap-2 text-xs font-mono text-white/30">
               <MicOff className="w-4 h-4" />
               OFFLINE
            </div>
         )}
      </div>

      {/* Chat Container */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* 3D View Background Overlay */}
        <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
           <Myra3D isSpeaking={isSpeaking} isThinking={isThinking} />
        </div>

        {/* Messaging Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 z-10 relative pointer-events-auto" ref={scrollRef}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl p-4 text-xs font-mono mb-4 backdrop-blur-sm animate-in fade-in duration-300">
              <p className="font-bold mb-1">⚠️ Connection Error</p>
              <p className="opacity-85 leading-relaxed">{error}</p>
              <p className="mt-2 text-[10px] opacity-60">
                You can configure this in your Vercel project environment variables (VITE_WS_URL) and rebuild/redeploy your app.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-2xl px-5 py-3 ${m.role === 'user' ? 'bg-white/10 text-white rounded-br-none backdrop-blur-md' : 'bg-pink-500/10 border border-pink-500/20 text-pink-50 rounded-bl-none backdrop-blur-md'}`}>
               {m.text && (
                 <div className="prose prose-invert prose-sm max-w-none">
                   <ReactMarkdown>{m.text}</ReactMarkdown>
                 </div>
               )}
               {m.image && (
                 <img src={m.image} alt="Generated" className="mt-2 rounded-xl border border-white/20 w-full" />
               )}
            </div>
          </div>
        ))}
          {connecting && (
             <div className="w-6 h-6 rounded-full border-t-2 border-r-2 border-pink-500 animate-spin ai-glow ml-4"></div>
          )}
        </div>

        {/* Input Dock */}
        <div className="p-6 shrink-0 z-10 relative">
          <form onSubmit={(e) => { e.preventDefault(); handleSendText(); }} className="flex items-center gap-4 w-full">
            <div className="flex-1 bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl h-14 flex items-center px-4 gap-4">
               <input
                 type="text"
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 placeholder="System listening (or type here)..."
                 className="bg-transparent border-none outline-none w-full text-white placeholder-white/20 font-light"
               />
               <button
                 type="submit"
                 disabled={connecting || !input.trim()}
                 className="h-10 px-6 shrink-0 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold text-sm tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
               >
                 SEND
               </button>
            </div>
          </form>
        </div>
      </div>
      </>
     )}
    </div>
  );
}

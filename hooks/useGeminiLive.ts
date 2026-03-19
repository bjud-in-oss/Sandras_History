
import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { AppState, EditorElement, ChatMessage, ImageElement } from '../types';
import { SYSTEM_INSTRUCTION, tools } from '../ai/config';
import { generateSticker } from '../services/geminiService';
import { CANVAS_PRESETS } from '../constants/presets';

// --- Audio Helper Functions ---
function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        // Simple downsampling/clamping
        const s = Math.max(-1, Math.min(1, data[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return new Blob([int16], { type: 'audio/pcm' });
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    // Gemini always sends 24kHz audio in current preview models
    const targetSampleRate = 24000; 
    const numChannels = 1;
    const frameCount = dataInt16.length / numChannels;
    
    const buffer = ctx.createBuffer(numChannels, frameCount, targetSampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

interface UseGeminiLiveProps {
    state: AppState;
    chatMessages: ChatMessage[];
    onUpdateElement: (id: string, updates: Partial<EditorElement>) => void;
    onAddElement: (el: EditorElement) => void;
    onSetBackground: (color: string) => void;
    getCanvasSnapshot: () => string | null;
    setHelpBubblePosition: (x: number, y: number) => void;
    onChatUpdate: (msg: ChatMessage) => void;
    isLiveConnected: boolean;
    onDisconnect: () => void;
    onConnected: () => void;
    latestContext: { text: string; image?: string; timestamp: number } | null;
    onAuthError?: (message: string) => void;
    onCloseRequested?: () => void;
    // New Actions
    onApplyLayout: (type: 'grid' | 'stack' | 'circle' | 'scatter') => void;
    onUndo: () => void;
    onRedo: () => void;
    onSaveProject: () => void;
    onDownloadImage: () => void;
    onResizeCanvas: (width: number, height: number) => void;
    onSelectElement: (id: string | null) => void;
}

export const useGeminiLive = ({
    state,
    chatMessages,
    onUpdateElement,
    onAddElement,
    onSetBackground,
    getCanvasSnapshot,
    setHelpBubblePosition,
    onChatUpdate,
    isLiveConnected,
    onDisconnect,
    onConnected,
    latestContext,
    onAuthError,
    onCloseRequested,
    onApplyLayout,
    onUndo,
    onRedo,
    onSaveProject,
    onDownloadImage,
    onResizeCanvas,
    onSelectElement
}: UseGeminiLiveProps) => {
    const [volume, setVolume] = useState(0);
    const [session, setSession] = useState<any>(null);
    const pendingMessageRef = useRef<string | null>(null);

    // Refs for safe async usage
    const stateRef = useRef(state);
    const chatMessagesRef = useRef(chatMessages);
    useEffect(() => { stateRef.current = state; }, [state]);
    useEffect(() => { chatMessagesRef.current = chatMessages; }, [chatMessages]);

    const lastContextTimeRef = useRef<number>(0);
    
    // Audio Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const outputNodeRef = useRef<GainNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    
    // Transcription accumulator
    const currentInputTransRef = useRef('');
    const currentOutputTransRef = useRef('');

    // --- STOPPING FLAG ---
    const isStoppedRef = useRef(false);

    // --- Cleanup Helper ---
    const cleanup = useCallback(() => {
        isStoppedRef.current = true; // Raise the shield!

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            mediaStreamRef.current = null;
        }

        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current.onaudioprocess = null;
            processorRef.current = null;
        }

        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(e => console.warn("Ctx close warning", e));
            audioContextRef.current = null;
        }

        setSession(null);
        setVolume(0);
    }, []);

    // --- Connection Logic ---
    useEffect(() => {
        if (!isLiveConnected) {
            cleanup();
            return;
        }

        // Reset the stop flag for a new connection
        isStoppedRef.current = false;
        let activeSession: any = null;

        const connect = async () => {
            try {
                if (!process.env.API_KEY) throw new Error("Saknar API_KEY.");

                // 1. Get Media Stream
                let stream: MediaStream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                } catch (err: any) {
                    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        throw new Error("Tillåt mikrofonen i webbläsaren för att fortsätta.");
                    }
                    throw err;
                }
                
                if (isStoppedRef.current) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                mediaStreamRef.current = stream;

                // 2. Setup AudioContext
                const AudioCtxClass = (window.AudioContext || (window as any).webkitAudioContext);
                const ctx = new AudioCtxClass();
                audioContextRef.current = ctx;

                const analyser = ctx.createAnalyser();
                analyser.fftSize = 32;
                analyserRef.current = analyser;
                
                const outputNode = ctx.createGain();
                outputNode.connect(analyser);
                analyser.connect(ctx.destination);
                outputNodeRef.current = outputNode;

                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                
                // Build history context
                const historyText = chatMessagesRef.current
                    .slice(-5)
                    .filter(m => m.role !== 'system')
                    .map(m => `[${m.role}]: ${m.text}`)
                    .join('\n');
                
                // Build Element Context (The Map for the Agent)
                const elementSummary = stateRef.current.elements.map(el => ({
                    id: el.id,
                    type: el.type,
                    x: Math.round(el.x),
                    y: Math.round(el.y),
                    text: el.type === 'text' ? (el as any).text.substring(0, 20) : undefined,
                    isSelected: stateRef.current.selectedIds.includes(el.id)
                }));

                const initInstruction = `${SYSTEM_INSTRUCTION}
SESSION CONTEXT:
Active Selection: ${stateRef.current.selectedIds.join(', ')}
ELEMENTS (Map of Canvas):
${JSON.stringify(elementSummary, null, 2)}
RECENT CHAT:
${historyText}`;

                // 3. Connect to Gemini Live
                const sessionPromise = ai.live.connect({
                    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                    config: {
                        tools: tools,
                        systemInstruction: initInstruction,
                        responseModalities: [Modality.AUDIO],
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                        // inputAudioTranscription: {}, // Disabled: Causes "Operation is not implemented"
                        // outputAudioTranscription: {}, // Disabled: Causes "Operation is not implemented"
                    },
                    callbacks: {
                        onopen: async () => {
                            if (isStoppedRef.current) return;
                            onConnected();
                            
                            const source = ctx.createMediaStreamSource(stream);
                            sourceRef.current = source;
                            const processor = ctx.createScriptProcessor(4096, 1, 1);
                            processorRef.current = processor;

                            processor.onaudioprocess = (e) => {
                                if (isStoppedRef.current) return;
                                const inputData = e.inputBuffer.getChannelData(0);
                                let pcmData: Blob;
                                
                                if (ctx.sampleRate > 24000) {
                                     const ratio = Math.floor(ctx.sampleRate / 16000);
                                     const downsampled = new Float32Array(Math.floor(inputData.length / ratio));
                                     for(let i=0; i<downsampled.length; i++) {
                                         downsampled[i] = inputData[i * ratio];
                                     }
                                     pcmData = createBlob(downsampled);
                                } else {
                                     pcmData = createBlob(inputData);
                                }

                                const reader = new FileReader();
                                reader.readAsDataURL(pcmData);
                                reader.onloadend = () => {
                                    // Use sessionPromise to prevent race conditions and ensure session is ready
                                    sessionPromise.then(session => {
                                        if (isStoppedRef.current) return;
                                        const base64data = (reader.result as string).split(',')[1];
                                        try {
                                            session.sendRealtimeInput({ 
                                                media: { mimeType: 'audio/pcm;rate=16000', data: base64data } 
                                            });
                                        } catch(err) { }
                                    });
                                };
                            };

                            source.connect(processor);
                            processor.connect(ctx.destination);
                        },
                        onmessage: (msg) => {
                            if (isStoppedRef.current) return;
                            // Need to pass the current session reference to handle tools
                            sessionPromise.then(sess => handleMessage(msg, sess));
                        },
                        onclose: () => {
                            if (!isStoppedRef.current) onDisconnect();
                        },
                        onerror: (err) => {
                            console.error("Gemini Error:", err);
                            if (!isStoppedRef.current) {
                                const msg = err instanceof Error ? err.message : String(err);
                                if (onAuthError) onAuthError(msg);
                                onDisconnect();
                            }
                        }
                    }
                });

                activeSession = await sessionPromise;
                
                if (isStoppedRef.current) {
                    activeSession.close();
                } else {
                    setSession(activeSession);
                    
                    // Send pending message if any
                    if (pendingMessageRef.current) {
                        try {
                            activeSession.sendRealtimeInput({ text: pendingMessageRef.current });
                            pendingMessageRef.current = null;
                        } catch(err) { console.error("Failed to send pending message", err); }
                    }

                    const updateVol = () => {
                        if (isStoppedRef.current) return;
                        if (analyserRef.current) {
                            const data = new Uint8Array(analyserRef.current.frequencyBinCount);
                            analyserRef.current.getByteFrequencyData(data);
                            const avg = data.reduce((a, b) => a + b, 0) / data.length;
                            setVolume(Math.min(1, avg / 100));
                        }
                        requestAnimationFrame(updateVol);
                    };
                    updateVol();
                }

            } catch (e: any) {
                console.error("Connection Setup Failed:", e);
                if (!isStoppedRef.current) {
                    const msg = e.message || "Anslutningen misslyckades.";
                    if (onAuthError) onAuthError(msg);
                    onDisconnect();
                }
            }
        };

        connect();

        return () => {
            cleanup();
        };
    }, [isLiveConnected]);

    const handleMessage = async (msg: LiveServerMessage, currentSession: any) => {
        // 1. Audio
        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData && audioContextRef.current && outputNodeRef.current) {
            const ctx = audioContextRef.current;
            if (nextStartTimeRef.current < ctx.currentTime) nextStartTimeRef.current = ctx.currentTime;
            
            try {
                const buffer = await decodeAudioData(decode(audioData), ctx);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(outputNodeRef.current);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
            } catch(e) { console.error("Decode error", e); }
        }

        // 2. Transcription (Disabled in config, but keeping logic harmless)
        if (msg.serverContent?.outputTranscription) currentOutputTransRef.current += msg.serverContent.outputTranscription.text;
        if (msg.serverContent?.inputTranscription) currentInputTransRef.current += msg.serverContent.inputTranscription.text;

        if (msg.serverContent?.turnComplete) {
            const userText = currentInputTransRef.current.trim();
            const modelText = currentOutputTransRef.current.trim();

            if (userText) onChatUpdate({ id: crypto.randomUUID(), role: 'user', text: userText, timestamp: Date.now() });
            if (modelText) onChatUpdate({ id: crypto.randomUUID(), role: 'model', text: modelText, timestamp: Date.now() });

            if (/^\s*(tack|tack så mycket|tusen tack|okej tack|bra tack|nej|nej tack|nej det är bra|nix)\s*[.!]?\s*$/i.test(userText)) {
                if (onCloseRequested) onCloseRequested();
                isStoppedRef.current = true;
                setTimeout(() => onDisconnect(), 100); 
            }

            currentInputTransRef.current = '';
            currentOutputTransRef.current = '';
        }

        // 3. Tools
        if (msg.toolCall) {
            const responses = [];
            for (const fc of msg.toolCall.functionCalls) {
                let result: any = { result: "ok" };
                try {
                    const args = fc.args as any;
                    
                    if (fc.name === 'selectElement') onSelectElement(args.id);
                    else if (fc.name === 'moveHelpBubble') setHelpBubblePosition(args.x, args.y);
                    else if (fc.name === 'setBackground') onSetBackground(args.color);
                    else if (fc.name === 'addImage') onAddElement({ id: crypto.randomUUID(), type: 'image', x: 400, y: 300, width: 300, height: 300, rotation: 0, aspectRatio: 1, src: args.url || "https://placehold.co/300x300/indigo/white?text=AI" });
                    else if (fc.name === 'addText') onAddElement({ id: crypto.randomUUID(), type: 'text', text: args.text || "Text", x: args.x || 400, y: args.y || 300, color: args.color || '#000', fontSize: args.fontSize || 32, rotation: 0, width: 300, height: 100, fontFamily: 'Inter', fontWeight: 'bold', textAlign: 'center', padding: 10, lineHeight: 1.4 });
                    else if (fc.name === 'updateElement') {
                        const id = args.id || stateRef.current.selectedIds[0];
                        if (id) onUpdateElement(id, args);
                    }
                    else if (fc.name === 'deleteElement') {
                        const id = args.id || stateRef.current.selectedIds[0];
                        if (id) onUpdateElement(id, { x: -9999 }); 
                    }
                    else if (fc.name === 'applyLayout') {
                        onApplyLayout(args.type);
                    }
                    else if (fc.name === 'manageHistory') {
                        if (args.action === 'undo') onUndo();
                        else if (args.action === 'redo') onRedo();
                    }
                    else if (fc.name === 'manageProject') {
                        if (args.action === 'save_project') onSaveProject();
                        else if (args.action === 'download_image') onDownloadImage();
                    }
                    else if (fc.name === 'resizeCanvas') {
                        if (args.preset) {
                            const p = CANVAS_PRESETS.find(cp => cp.id === args.preset);
                            if (p) onResizeCanvas(p.width, p.height);
                        } else if (args.width && args.height) {
                            onResizeCanvas(args.width, args.height);
                        }
                    }
                    else if (fc.name === 'generateImage') {
                        // Async generation with Context support
                        (async () => {
                           try {
                               // Check if reference image is requested
                               let imageContext: string | undefined = undefined;
                               let contextId = args.referenceId;
                               
                               // If no ID explicitly passed, but we have a selection, default to selection
                               if (!contextId && stateRef.current.selectedIds.length === 1) {
                                   contextId = stateRef.current.selectedIds[0];
                               }

                               if (contextId) {
                                   const refEl = stateRef.current.elements.find(el => el.id === contextId);
                                   if (refEl && refEl.type === 'image') {
                                       imageContext = (refEl as ImageElement).src;
                                   }
                               }

                               const base64 = await generateSticker(args.prompt, imageContext);
                               if (base64) {
                                   onAddElement({
                                       id: crypto.randomUUID(),
                                       type: 'image',
                                       x: 400,
                                       y: 300,
                                       rotation: 0,
                                       width: 350,
                                       height: 350,
                                       aspectRatio: 1,
                                       src: base64
                                   });
                               }
                           } catch(err) { console.error(err); }
                        })();
                        result = { result: "generation_started" };
                    }
                    else if (fc.name === 'requestVisualContext') {
                         const snap = getCanvasSnapshot();
                         if (snap) setTimeout(() => currentSession.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: snap.split(',')[1] } }), 100);
                    }
                } catch(e) { result = { error: String(e) }; }
                responses.push({ id: fc.id, name: fc.name, response: result });
            }
            try {
                if (!isStoppedRef.current) currentSession.sendToolResponse({ functionResponses: responses });
            } catch(e) { console.warn("Failed to send tool response", e); }
        }
    };

    const sendTextToModel = (text: string) => {
        if (session && !isStoppedRef.current) {
            try { session.sendRealtimeInput({ text }); } catch(e) { console.error(e); }
        } else if (isLiveConnected && !isStoppedRef.current) {
            // Queue message if we are connecting
            pendingMessageRef.current = text;
        }
    };

    // Context Injection
    useEffect(() => {
        if (latestContext?.image && session && latestContext.timestamp !== lastContextTimeRef.current && !isStoppedRef.current) {
            lastContextTimeRef.current = latestContext.timestamp;
            try { session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: latestContext.image.split(',')[1] } }); } catch(e) {}
        }
    }, [latestContext, session]);

    return { volume, sendTextToModel };
};
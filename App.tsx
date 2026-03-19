
/// <reference types="vite/client" />
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Toolbar } from './components/Toolbar';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { PropertiesPanel } from './components/PropertiesPanel';
import { HelpBubble } from './components/HelpBubble';
import { ChatMessage } from './types';
import { useEditorState } from './hooks/useEditorState';
import { useProjectSystem } from './hooks/useProjectSystem';
import { useGeminiLive } from './hooks/useGeminiLive';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { CANVAS_PRESETS } from './constants/presets';

import { 
  Undo2, 
  Redo2, 
  Archive, 
  Layout, 
  Image as ImageIcon, 
  Sparkles, 
  Layers, 
  ChevronDown,
  X,
  HelpCircle,
  Play,
  Info,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Add window.google type
declare global {
  interface Window {
    google?: any;
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INACTIVITY_TIMEOUT_MS = 60000; // 60 seconds

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  const loadMemory = () => {
    try {
        const chat = localStorage.getItem('skapa_chat_history');
        return { chat: chat ? JSON.parse(chat) : [] };
    } catch (e) { return { chat: [] }; }
  };
  const memory = loadMemory();

  // State
  // DIRECT FIX: Initialize true if env var exists, ignoring external tools
  const [hasApiKey, setHasApiKey] = useState(!!process.env.API_KEY);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(memory.chat);
  const [helpBubblePos, setHelpBubblePos] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 150 });
  const [latestContext, setLatestContext] = useState<{ text: string; image?: string; timestamp: number } | null>(null);
  const [isBubbleExpanded, setIsBubbleExpanded] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  
  const [activeSidebar, setActiveSidebar] = useState<'MEDIA' | 'AI' | 'LAYERS' | 'CANVAS' | 'ARCHIVE' | null>(null);
  
  // Google Auth State
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const handleLogin = () => {
    if (window.google) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '1046374102641-k4b39b036s5m2f78u499b2t05900r800.apps.googleusercontent.com', // Placeholder
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (response: any) => {
          if (response && response.access_token) {
            setAccessToken(response.access_token);
          }
        },
      });
      client.requestAccessToken();
    } else {
      alert("Google Identity Services kunde inte laddas.");
    }
  };
  
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isHeaderButton = target.closest('header button');
      const isSidebar = target.closest('.sidebar-container');
      const isHelpButton = target.closest('.help-trigger');
      
      if (activeSidebar && !isHeaderButton && !isSidebar && !isHelpButton) {
        setActiveSidebar(null);
      }
    };
    
    if (activeSidebar) {
      window.addEventListener('mousedown', handleGlobalClick);
    }
    
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, [activeSidebar]);

  const inactivityTimer = useRef<number | null>(null);

  const handleAuthError = useCallback((message: string) => {
      setIsLiveConnected(false);
      setIsConnecting(false);
      
      // Always show error in chat bubble instead of crashing app
      const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          text: `⚠️ Fel: ${message}`,
          timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, errorMsg]);
      setIsBubbleExpanded(true); 
  }, []);

  const toggleConnection = useCallback(() => {
      if (isLiveConnected) {
          setIsLiveConnected(false);
          setIsConnecting(false);
      } else {
          setIsConnecting(true);
          setIsLiveConnected(true);
          setIsBubbleExpanded(true);
      }
  }, [isLiveConnected]);

  const startTour = () => {
    setShowWelcomeModal(false);
    if (!isLiveConnected) {
        toggleConnection();
    } else {
        setIsBubbleExpanded(true);
    }
  };

  const wakeUp = useCallback(() => {
      if (isLiveConnected) {
          if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
          inactivityTimer.current = window.setTimeout(() => setIsLiveConnected(false), INACTIVITY_TIMEOUT_MS);
      }
  }, [isLiveConnected]);

  // Hooks
  const { state, actions, canUndo, canRedo } = useEditorState(wakeUp);
  const projectSystem = useProjectSystem(state, actions, canvasRef, wakeUp, accessToken);
  
  useKeyboardShortcuts(state, actions);
  
  const { volume, sendTextToModel } = useGeminiLive({
      state,
      chatMessages,
      onUpdateElement: actions.updateElement,
      onAddElement: actions.addElement,
      onSetBackground: actions.setBackgroundColor,
      onApplyLayout: actions.applyLayout,
      onUndo: actions.undo,
      onRedo: actions.redo,
      onSaveProject: projectSystem.handleSaveProject,
      onDownloadImage: projectSystem.handleDownloadImage,
      onResizeCanvas: actions.setManualSize,
      onSelectElement: (id) => actions.selectElement(id, false),
      getCanvasSnapshot: projectSystem.getCanvasSnapshot,
      setHelpBubblePosition: (x, y) => setHelpBubblePos({ x, y }),
      onChatUpdate: (msg) => setChatMessages(prev => [...prev, msg]),
      isLiveConnected,
      onDisconnect: () => {
          setIsLiveConnected(false);
          setIsConnecting(false);
      },
      onConnected: () => setIsConnecting(false),
      latestContext,
      onAuthError: handleAuthError,
      onCloseRequested: () => setIsBubbleExpanded(false)
  });

  useEffect(() => {
      return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
  }, []);

  useEffect(() => {
    localStorage.setItem('skapa_chat_history', JSON.stringify(chatMessages.slice(-20))); 
  }, [chatMessages]);

  const handleScan = (helpKey: string, title: string, text: string) => {
      const fullText = `${title}: ${text}`;
      
      if (chatMessages.length > 0) {
          const lastMsg = chatMessages[chatMessages.length - 1];
          if (lastMsg.role === 'system' && lastMsg.text === fullText) return;
      }

      const timestamp = Date.now();
      let image = undefined;
      if (helpKey === 'canvas-area') {
          const snapshot = projectSystem.getCanvasSnapshot();
          if (snapshot) image = snapshot;
      }
      
      const newMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'system',
          text: fullText,
          image: image,
          timestamp
      };
      setChatMessages(prev => [...prev, newMessage]);
      setLatestContext({ text: `${title} - ${text}`, image, timestamp });

      if (!isLiveConnected) {
          setIsLiveConnected(true);
          setIsConnecting(true);
      }
      
      setIsBubbleExpanded(true);
      setTimeout(() => {
          sendTextToModel(`Användaren scannade just verktyget: "${title}". Förklara kort på svenska vad man kan göra här: "${text}". Håll det koncist och hjälpsamt.`);
      }, 500);
      wakeUp();
  };

  const currentPage = state.pages.find(p => p.id === state.currentPageId) || state.pages[0];
  const primarySelectedElement = state.selectedIds.length === 1 
    ? currentPage.elements.find(el => el.id === state.selectedIds[0]) || null
    : null;

  // Fallback UI if env var is missing entirely
  if (!process.env.API_KEY && !hasApiKey) {
      return (
          <div className="flex flex-col items-center justify-center h-screen w-screen bg-gray-950 text-white gap-6 font-sans p-6">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Konfigurationsfel</h1>
              <p>Ingen API-nyckel hittades i miljön (process.env.API_KEY).</p>
          </div>
      );
  }

  if (!accessToken) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-gray-900 text-white gap-6 font-sans p-6">
        <div className="bg-gray-800 border border-white/10 rounded-[32px] p-12 max-w-md w-full shadow-2xl space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-white">Sandras Studio</h1>
            <p className="text-gray-400 text-lg">Logga in för att spara dina projekt på Google Drive</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 hover:bg-gray-100 py-4 px-6 rounded-2xl font-bold transition-all active:scale-95 shadow-lg"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Logga in med Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-900 text-white select-none overflow-hidden font-sans">
      
      {/* HEADER */}
      <header className="h-16 shrink-0 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-3 lg:px-6 z-40 shadow-xl">
        <div className="flex items-center gap-1 lg:gap-2">
            <button 
                onClick={() => setActiveSidebar(prev => prev === 'MEDIA' ? null : 'MEDIA')}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all active:scale-95",
                    activeSidebar === 'MEDIA' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                )}
                title="Media & Text"
            >
                <ImageIcon className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden md:inline text-xs font-bold">Media</span>
            </button>

            <button 
                onClick={() => setActiveSidebar(prev => prev === 'AI' ? null : 'AI')}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all active:scale-95",
                    activeSidebar === 'AI' ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                )}
                title="Studio"
            >
                <Sparkles className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden md:inline text-xs font-bold">Studio</span>
            </button>

            <button 
                onClick={() => setActiveSidebar(prev => prev === 'LAYERS' ? null : 'LAYERS')}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all active:scale-95",
                    activeSidebar === 'LAYERS' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                )}
                title="Lager"
            >
                <Layers className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden md:inline text-xs font-bold">Lager</span>
            </button>
            
            <button 
                onClick={() => setActiveSidebar(prev => prev === 'CANVAS' ? null : 'CANVAS')}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all active:scale-95",
                    activeSidebar === 'CANVAS' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                )}
                title="Canvas"
            >
                <Layout className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden md:inline text-xs font-bold">Canvas</span>
            </button>

            <button 
                onClick={() => setActiveSidebar(prev => prev === 'ARCHIVE' ? null : 'ARCHIVE')}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all active:scale-95",
                    activeSidebar === 'ARCHIVE' ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                )}
                title="Arkiv"
            >
                <Archive className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden md:inline text-xs font-bold">Arkiv</span>
            </button>

            <button 
                onClick={actions.undo} 
                disabled={!canUndo} 
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all active:scale-95 disabled:opacity-30 disabled:hover:bg-gray-800 disabled:cursor-not-allowed",
                    "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                )}
                title="Ångra (Ctrl+Z)"
            >
                <Undo2 className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden md:inline text-xs font-bold">Ångra</span>
            </button>

            <button 
                onClick={actions.redo} 
                disabled={!canRedo} 
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all active:scale-95 disabled:opacity-30 disabled:hover:bg-gray-800 disabled:cursor-not-allowed",
                    "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
                )}
                title="Gör om (Ctrl+Y)"
            >
                <Redo2 className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden md:inline text-xs font-bold">Gör om</span>
            </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex overflow-hidden touch-none relative bg-gray-900" data-help="canvas-area">
        <Toolbar 
          activeSidebar={activeSidebar}
          onClose={() => setActiveSidebar(null)}
          onAddElement={actions.addElement}
          onSetBackground={actions.setBackgroundColor}
          onApplyLayout={actions.applyLayout}
          backgroundColor={currentPage.backgroundColor}
          isGenerating={state.isGenerating}
          setIsGenerating={actions.setIsGenerating}
          customColors={state.customColors}
          onAddCustomColor={actions.addCustomColor}
          onUpdateContext={actions.setAiContext}
          aiContext={state.aiContext}
          elements={currentPage.elements}
          selectedIds={state.selectedIds}
          onSelect={actions.selectElement}
          onAlign={actions.alignElements}
          onMoveLayer={actions.moveLayer}
          onReorderElement={actions.reorderElement}
          onDeleteElement={actions.deleteElement}
          getSelectionImage={projectSystem.getSelectionAsBase64}
          // Project system actions
          onQuickSave={projectSystem.handleQuickSave}
          onSaveProject={projectSystem.handleSaveProject}
          onDownloadImage={projectSystem.handleDownloadImage}
          onDownloadSelection={projectSystem.handleDownloadSelection}
          hasSaved={projectSystem.hasSaved}
          fileInputRef={fileInputRef}
          handleLoadProject={projectSystem.handleLoadProject}
          // Canvas actions
          canvasWidth={state.canvasWidth}
          canvasHeight={state.canvasHeight}
          showGrid={state.showGrid}
          snapToGrid={state.snapToGrid}
          onSetSize={actions.setSize}
          onSetShowGrid={actions.setShowGrid}
          onSetSnapToGrid={actions.setSnapToGrid}
          onToggleOrientation={actions.toggleOrientation}
          onLogout={() => setAccessToken(null)}
        />
        
        <CanvasWorkspace 
          elements={currentPage.elements}
          selectedIds={state.selectedIds}
          editingId={state.editingId}
          backgroundColor={currentPage.backgroundColor}
          showGrid={state.showGrid}
          snapToGrid={state.snapToGrid}
          onSelect={actions.selectElement}
          onEdit={actions.setEditingId}
          onUpdateElement={actions.updateElement}
          onAddSnapshot={actions.addSnapshot}
          width={state.canvasWidth}
          height={state.canvasHeight}
          canvasRef={canvasRef}
        />

        
        <PropertiesPanel 
          selectedElement={primarySelectedElement}
          onUpdateElement={(updates) => actions.updateElement(state.selectedIds[0], updates)}
          onDeleteElement={actions.deleteElement}
          onDuplicate={actions.duplicateElement}
          onMoveLayer={actions.moveLayer}
          customColors={state.customColors}
          onAddCustomColor={actions.addCustomColor}
        />
        
        <HelpBubble 
            position={helpBubblePos}
            onMove={(x, y) => { setHelpBubblePos({ x, y }); wakeUp(); }}
            chatMessages={chatMessages}
            isLiveConnected={isLiveConnected}
            isConnecting={isConnecting}
            onConnectToggle={toggleConnection}
            onScan={handleScan}
            onSendText={(text) => { sendTextToModel(text); wakeUp(); }}
            volume={volume}
            expanded={isBubbleExpanded}
            setExpanded={setIsBubbleExpanded}
            hideBall={false}
            onStepChange={(index) => {
                // Mapping: 0: Intro, 1: Hjälp, 2: Media, 3: Text, 4: Bild, 5: Studio, 6: Lager, 7: Canvas, 8: Arkiv
                const sidebars: (typeof activeSidebar)[] = [null, null, 'MEDIA', 'MEDIA', 'MEDIA', 'AI', 'LAYERS', 'CANVAS', 'ARCHIVE'];
                setActiveSidebar(sidebars[index]);

                // Move bubble to target buttons
                const targets: Record<number, { x: number, y: number }> = {
                    2: { x: 40, y: 80 }, // Media button
                    3: { x: 160, y: 300 }, // Text button in sidebar
                    4: { x: 160, y: 220 }, // Image button in sidebar
                    5: { x: 120, y: 80 }, // Studio button
                    6: { x: 200, y: 80 }, // Lager button
                    7: { x: 280, y: 80 }, // Canvas button
                    8: { x: 360, y: 80 }, // Arkiv button
                };
                if (targets[index]) {
                    setHelpBubblePos(targets[index]);
                }
            }}
        />

        {/* WELCOME MODAL */}
        {showWelcomeModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-gray-900 border border-white/10 rounded-[32px] p-8 max-w-md w-full shadow-2xl space-y-8 text-center">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-bold tracking-tight text-white">Sandras Studio</h1>
                        <p className="text-gray-400 text-lg">Arbeta med bilder och text</p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                        <button 
                            onClick={startTour}
                            className="flex items-center justify-center gap-3 bg-pink-500 hover:bg-pink-400 text-white py-4 px-6 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-pink-500/20"
                        >
                            <Play className="w-5 h-5 fill-current" />
                            Starta guiden
                        </button>
                        <button 
                            onClick={() => setShowWelcomeModal(false)}
                            className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 text-gray-300 py-4 px-6 rounded-2xl font-bold transition-all active:scale-95 border border-white/5"
                        >
                            <Info className="w-5 h-5" />
                            Börja arbeta
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* BOTTOM PAGE NAVIGATION */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-gray-900/90 backdrop-blur-md border border-gray-800 px-4 py-2 rounded-full shadow-2xl z-40">
            <button 
                onClick={() => {
                    const idx = state.pages.findIndex(p => p.id === state.currentPageId);
                    if (idx > 0) actions.setCurrentPage(state.pages[idx - 1].id);
                }} 
                disabled={state.pages.findIndex(p => p.id === state.currentPageId) === 0}
                className="p-2 bg-gray-800 text-gray-300 rounded-full hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:hover:bg-gray-800 transition-all"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold min-w-[3rem] text-center">
                {state.pages.findIndex(p => p.id === state.currentPageId) + 1} / {state.pages.length}
            </span>
            <button 
                onClick={() => {
                    const idx = state.pages.findIndex(p => p.id === state.currentPageId);
                    if (idx < state.pages.length - 1) actions.setCurrentPage(state.pages[idx + 1].id);
                }} 
                disabled={state.pages.findIndex(p => p.id === state.currentPageId) === state.pages.length - 1}
                className="p-2 bg-gray-800 text-gray-300 rounded-full hover:bg-gray-700 hover:text-white disabled:opacity-30 disabled:hover:bg-gray-800 transition-all"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-gray-700 mx-1"></div>
            <button 
                onClick={actions.addPage} 
                className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
            >
                <Plus className="w-5 h-5" />
            </button>
        </div>
      </main>
    </div>
  );
}

export default App;
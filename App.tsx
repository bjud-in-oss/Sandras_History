
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
  Info
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  const projectSystem = useProjectSystem(state, actions, canvasRef, wakeUp);
  
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

        {/* Page Navigation */}
        <div className="flex items-center gap-2">
            <button onClick={() => {
                const idx = state.pages.findIndex(p => p.id === state.currentPageId);
                if (idx > 0) actions.setCurrentPage(state.pages[idx - 1].id);
            }} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700">Föregående</button>
            <span className="text-sm font-bold">{state.pages.findIndex(p => p.id === state.currentPageId) + 1} / {state.pages.length}</span>
            <button onClick={() => {
                const idx = state.pages.findIndex(p => p.id === state.currentPageId);
                if (idx < state.pages.length - 1) actions.setCurrentPage(state.pages[idx + 1].id);
            }} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700">Nästa</button>
            <button onClick={actions.addPage} className="p-2 bg-indigo-600 rounded-lg hover:bg-indigo-500">+</button>
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
      </main>
    </div>
  );
}

export default App;
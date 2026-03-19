import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../types';
import { useBubblePhysics } from '../hooks/useBubblePhysics';
import { 
  HelpCircle, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Send,
  Maximize2,
  Minimize2
} from "lucide-react";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HelpBubbleProps {
    position: { x: number, y: number };
    onMove: (x: number, y: number) => void;
    chatMessages: ChatMessage[];
    isLiveConnected: boolean;
    isConnecting?: boolean; // New prop for loading state
    onConnectToggle: () => void;
    onScan: (helpKey: string, title: string, text: string) => void;
    onSendText: (text: string) => void;
    volume: number;
    expanded: boolean;
    setExpanded: (expanded: boolean) => void;
    hideBall?: boolean;
    onStepChange?: (stepIndex: number) => void;
}

const HELP_TEXTS: Record<string, { title: string, text: string }> = {
    'canvas-area': { title: 'Arbetsyta', text: 'Detta är din canvas där du skapar din design. Jag kan se vad du gör här om du ber mig.' },
    'toolbar-media': { title: 'Media', text: 'Här laddar du upp bilder eller lägger till textrutor.' },
    'toolbar-ai': { title: 'AI Studio', text: 'Beskriv vad du vill skapa så genererar jag bilder eller texter åt dig.' },
    'toolbar-layers': { title: 'Lager', text: 'Hantera ordningen på dina objekt. Dra och släpp eller använd knapparna.' },
    'prop-color': { title: 'Färg & Bakgrund', text: 'Ändra färg på text, former eller hela bakgrunden.' },
    'prop-align': { title: 'Justering', text: 'Centrera eller justera dina objekt.' },
    'prop-rotate': { title: 'Rotation', text: 'Snurra på dina objekt.' },
    'prop-layers': { title: 'Lagerordning', text: 'Flytta objekt framåt eller bakåt i djupled.' },
    'header-save': { title: 'Spara', text: 'Ladda ner din bild eller spara projektet för att fortsätta senare.' },
    'header-grid': { title: 'Rutnät', text: 'Visa eller dölj hjälplinjer för enklare placering.' },
    'header-snap': { title: 'Snap', text: 'Slå på/av automatisk inpassning mot rutnätet.' },
    'toolbar-prompt': { title: 'AI Prompt', text: 'Skriv här vad du vill att jag ska skapa.' },
    'toolbar-context': { title: 'Kontext', text: 'Ge mig extra information (som text eller valda bilder) för bättre resultat.' }
};

export const HelpBubble: React.FC<HelpBubbleProps> = ({ 
    position, 
    onMove, 
    chatMessages, 
    isLiveConnected, 
    isConnecting,
    onConnectToggle,
    onScan,
    onSendText,
    volume,
    expanded,
    setExpanded,
    hideBall,
    onStepChange
}) => {
  const [inputText, setInputText] = useState('');
  const [currentStep, setCurrentStep] = useState(0);

  const HELP_STEPS = [
    {
      title: "Välkommen till Sandras Studio!",
      text: "Här kan du arbeta med bilder och text på ett enkelt sätt. Jag finns här för att guida dig genom de olika verktygen.",
    },
    {
      title: "Hjälp när du behöver",
      text: "Du kan flytta mig vart du vill genom att dra i mig. Om du drar mig över en knapp så berättar jag vad den gör!",
    },
    {
      title: "Media",
      text: "Klicka på Media-knappen för att öppna menyn där du kan lägga till egna bilder och texter.",
    },
    {
      title: "Lägg till Text",
      text: "Klicka på 'Textblock' för att lägga in en ny text på din arbetsyta. Du kan sedan dubbelklicka på texten för att ändra den.",
    },
    {
      title: "Lägg till Bild",
      text: "Använd 'Ladda upp bild' för att hämta bilder från din dator och placera dem i ditt projekt.",
    },
    {
      title: "Studio",
      text: "I Studion kan du skapa helt nya bilder och texter. Skriv bara vad du vill se så hjälper jag dig att ta fram det.",
    },
    {
      title: "Lager",
      text: "Här ser du alla delar i ditt projekt. Du kan flytta dem framåt eller bakåt för att skapa rätt djup.",
    },
    {
      title: "Canvas",
      text: "Detta är din arbetsyta. Här kan du placera ut bilder och text precis som du vill. Klicka och dra för att flytta runt saker.",
    },
    {
      title: "Arkiv",
      text: "Här sparas alla dina projekt så att du kan komma tillbaka till dem senare.",
    },
  ];

  const [isCollapsed, setIsCollapsed] = useState(true);

  const nextStep = () => {
    const next = (currentStep + 1) % HELP_STEPS.length;
    setCurrentStep(next);
    setIsCollapsed(false);
    onStepChange?.(next);
  };
  const prevStep = () => {
    const prev = (currentStep - 1 + HELP_STEPS.length) % HELP_STEPS.length;
    setCurrentStep(prev);
    setIsCollapsed(false);
    onStepChange?.(prev);
  };
  
  // Auto-expand on input
  useEffect(() => {
    if (inputText.length > 0) {
      setIsCollapsed(false);
    }
  }, [inputText]);

  // Trigger agent speech on step change
  useEffect(() => {
    if (expanded && isLiveConnected && !isConnecting) {
      const step = HELP_STEPS[currentStep];
      const timer = setTimeout(() => {
        onSendText(step.text);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentStep, expanded, isLiveConnected, isConnecting]);

  // Sync initial step if needed
  useEffect(() => {
    if (expanded) {
      onStepChange?.(currentStep);
    }
  }, [expanded]);

  const ballRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleBallClick = () => {
      // Toggle expanded state if connected
      if (isLiveConnected) {
          setExpanded(!expanded);
          if (!expanded) {
              setIsCollapsed(true);
          }
      } else {
          // Trigger connection logic if NOT connected
          onConnectToggle();
      }
  };

  const { 
      isDragging,
      handleBallPointerDown,
      handleBallPointerMove,
      handleBallPointerUp,
      handleTailPointerDown,
      handleTailPointerMove,
      handleTailPointerUp,
      tailOffset
  } = useBubblePhysics({
      position,
      onMove,
      isLiveConnected,
      onScan: (key, title, text) => {
          setIsCollapsed(false);
          onScan(key, title, text);
      },
      ballRef,
      tailRef,
      HELP_TEXTS,
      onClick: handleBallClick
  });

  useEffect(() => {
      if (expanded) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, expanded]);

  useEffect(() => {
      if (!isLiveConnected && !isConnecting) setExpanded(false);
  }, [isLiveConnected, isConnecting]);

  const handleInputSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (inputText.trim()) {
          onSendText(inputText);
          setInputText('');
      }
  };

  const ballScale = 1 + (volume * 0.3);
  
  const idealTailX = hideBall ? window.innerWidth - 160 : position.x + 28 + (isLiveConnected ? tailOffset.x : 0);
  const idealTailY = hideBall ? 200 : position.y + 28 + (isLiveConnected ? tailOffset.y : 0);
  
  return (
    <div className="fixed z-50 touch-none top-0 left-0 w-0 h-0">
        
        {/* THE TAIL (Content Box) */}
        <div 
            ref={tailRef}
            onPointerDown={handleTailPointerDown}
            onPointerMove={handleTailPointerMove}
            onPointerUp={handleTailPointerUp}
            className={`fixed flex flex-col overflow-hidden origin-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
            ${(isLiveConnected || isConnecting) && expanded ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}
            `}
            style={{ 
                transform: `translate(-50%, -50%)`,
                width: '280px',
                transition: isDragging ? 'none' : undefined,
                cursor: 'grab'
            }}
        >
             <div className={cn(
                 "w-full bg-gray-900/95 backdrop-blur-2xl border-2 rounded-3xl shadow-2xl flex flex-col transition-colors",
                 isDragging ? "border-pink-500/50" : "border-white/10"
             )}>
                {/* Header */}
                <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={prevStep}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                            title="Föregående"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={nextStep}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                            title="Nästa"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">
                            {currentStep + 1}/{HELP_STEPS.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-500 hover:text-white"
                            title={isCollapsed ? "Expandera" : "Minimera"}
                        >
                            {isCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setExpanded(false);
                            }}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-500 hover:text-white pointer-events-auto"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Collapsible Content */}
                <div className={cn(
                    "transition-all duration-500 ease-in-out overflow-hidden",
                    isCollapsed ? "max-h-0" : "max-h-96"
                )}>
                    <div className="p-6 space-y-4">
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-white tracking-tight">
                                {HELP_STEPS[currentStep].title}
                            </h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                {HELP_STEPS[currentStep].text}
                            </p>
                        </div>

                        {chatMessages.length > 0 && (
                            <div className="p-3 bg-pink-500/5 border border-pink-500/10 rounded-xl text-left">
                                <p className="text-[10px] font-bold text-pink-400 uppercase mb-1">Senaste svar</p>
                                <p className="text-xs text-gray-300 italic">
                                    "{chatMessages[chatMessages.length - 1].text}"
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer (Always Visible) */}
                <div className="p-4 border-t border-white/5 bg-black/20">
                    <form onSubmit={handleInputSubmit} className="relative">
                        <input 
                            type="text" 
                            value={inputText} 
                            onChange={(e) => setInputText(e.target.value)} 
                            placeholder="Fråga agenten..." 
                            className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-4 pr-10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 transition-colors"
                            onPointerDown={(e) => e.stopPropagation()} 
                        />
                        <button 
                            type="submit" 
                            className="absolute right-1 top-1 w-7 h-7 flex items-center justify-center bg-pink-500 rounded-full text-white hover:bg-pink-400 transition-colors shadow-lg shadow-pink-500/20"
                        >
                            <Send className="w-3 h-3" />
                        </button>
                    </form>
                </div>
            </div>
        </div>

        {/* THE BALL */}
        {!hideBall && (
            <div 
                ref={ballRef}
                onPointerDown={handleBallPointerDown}
                onPointerMove={handleBallPointerMove}
                onPointerUp={handleBallPointerUp}
                className={cn(
                    "fixed w-10 h-10 rounded-full shadow-xl cursor-pointer flex items-center justify-center transition-all duration-300 z-50",
                    expanded 
                        ? "bg-pink-500 text-white shadow-pink-500/40 scale-110" 
                        : "bg-white/5 backdrop-blur-sm text-pink-400 border border-white/10 hover:bg-white/15 hover:scale-105"
                )}
                style={{ 
                    left: position.x,
                    top: position.y,
                    transition: isDragging ? 'none' : 'all 0.3s ease',
                    transform: `scale(${isLiveConnected ? ballScale : 1})`
                }}
            >
                {isConnecting && <div className="absolute inset-0 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>}
                {isLiveConnected && !isConnecting && <div className="absolute inset-0 rounded-full bg-white opacity-20 animate-pulse"></div>}
                
                <HelpCircle className={cn("w-6 h-6 transition-transform", expanded && "rotate-12")} />
            </div>
        )}
    </div>
  );
};
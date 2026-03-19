import React, { useRef, useState, useEffect } from 'react';
import { EditorElement } from '../types';
import { useAiGenerator } from '../hooks/useAiGenerator';
import { 
  X, 
  Upload, 
  Type, 
  Plus, 
  Image as ImageIcon, 
  Sparkles, 
  Layers, 
  Layout, 
  Archive,
  Save,
  Download,
  FolderOpen,
  Check,
  RefreshCw
} from 'lucide-react';
import { CANVAS_PRESETS } from '../constants/presets';

interface ToolbarProps {
  activeSidebar: 'MEDIA' | 'AI' | 'LAYERS' | 'CANVAS' | 'ARCHIVE' | null;
  onClose: () => void;
  onAddElement: (element: EditorElement) => void;
  onSetBackground: (color: string) => void;
  onApplyLayout: (type: 'grid' | 'stack' | 'circle' | 'scatter') => void;
  backgroundColor: string;
  isGenerating: boolean;
  setIsGenerating: (loading: boolean) => void;
  customColors: string[];
  onAddCustomColor: (color: string) => void;
  onUpdateContext: (text: string) => void;
  aiContext: string;
  elements: EditorElement[];
  selectedIds: string[];
  onSelect: (id: string | null, multiSelect?: boolean) => void;
  onAlign: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onMoveLayer: (id: string, dir: 'front' | 'back' | 'forward' | 'backward') => void;
  onReorderElement: (id: string, newIndex: number) => void;
  onDeleteElement: (id: string) => void;
  getSelectionImage: () => Promise<string | null>;
  // Project system actions
  onQuickSave: () => void;
  onSaveProject: () => void;
  onDownloadImage: (format: 'png' | 'jpeg') => void;
  onDownloadSelection: (format: 'png' | 'jpeg') => void;
  hasSaved: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleLoadProject: (e: React.ChangeEvent<HTMLInputElement>, ref: React.RefObject<HTMLInputElement | null>) => void;
  // Canvas actions
  canvasWidth: number;
  canvasHeight: number;
  showGrid: boolean;
  snapToGrid: boolean;
  onSetSize: (id: string) => void;
  onSetShowGrid: (show: boolean) => void;
  onSetSnapToGrid: (snap: boolean) => void;
  onToggleOrientation: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  activeSidebar,
  onClose,
  onAddElement, 
  onSetBackground, 
  backgroundColor,
  isGenerating,
  setIsGenerating,
  onAddCustomColor,
  onUpdateContext,
  aiContext,
  elements,
  selectedIds,
  onSelect,
  onReorderElement,
  onDeleteElement,
  getSelectionImage,
  onQuickSave,
  onSaveProject,
  onDownloadImage,
  onDownloadSelection,
  hasSaved,
  fileInputRef,
  handleLoadProject,
  canvasWidth,
  canvasHeight,
  showGrid,
  snapToGrid,
  onSetSize,
  onSetShowGrid,
  onSetSnapToGrid,
  onToggleOrientation
}) => {
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  // Modularized Logic
  const { 
      prompt, setPrompt, 
      aiSubTab, setAiSubTab, 
      useSelectionAsContext, setUseSelectionAsContext, 
      handleGenerateAi 
  } = useAiGenerator({
      onAddElement,
      setIsGenerating,
      isGenerating,
      aiContext,
      onUpdateContext,
      selectedIds,
      getSelectionImage
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const src = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          onAddElement({
            id: crypto.randomUUID(),
            type: 'image',
            x: 400,
            y: 300,
            rotation: 0,
            width: 300,
            height: 300 * (img.height / img.width),
            aspectRatio: img.width / img.height,
            constrainProportions: true,
            src
          });
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    }
    if (imageUploadRef.current) imageUploadRef.current.value = '';
  };

  const handleAddText = () => {
      onAddElement({ 
          id: crypto.randomUUID(), 
          type: 'text', 
          x: 400, 
          y: 300, 
          rotation: 0, 
          width: 300, 
          height: 100, 
          text: 'Dubbelklicka för att skriva', 
          fontSize: 32, 
          color: '#000000', 
          fontFamily: 'Inter', 
          fontWeight: 'bold',
          textAlign: 'center',
          padding: 10,
          lineHeight: 1.4,
          strokeColor: '#000000',
          strokeWidth: 0,
          shadowColor: '#000000',
          shadowBlur: 0,
          shadowOffsetX: 0,
          shadowOffsetY: 0
      });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
      setDraggedId(id);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
      e.preventDefault();
      if (draggedId !== id) {
          e.dataTransfer.dropEffect = 'move';
          setDragOverId(id);
      }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      setDragOverId(null);
      if (!draggedId || draggedId === targetId) return;
      const targetIndex = elements.findIndex(el => el.id === targetId);
      if (targetIndex !== -1) {
          onReorderElement(draggedId, targetIndex);
      }
      setDraggedId(null);
  };

  const handleDragEnd = () => {
      setDraggedId(null);
      setDragOverId(null);
  };

  if (!activeSidebar) return null;

  const sidebarTitle = {
    MEDIA: 'Text & Bild',
    AI: 'AI Studio',
    LAYERS: 'Lager',
    CANVAS: 'Canvas Inställningar',
    ARCHIVE: 'Arkiv'
  }[activeSidebar];

  return (
    <div className="sidebar-container absolute inset-y-0 left-0 z-50 w-80 bg-gray-950 border-r border-gray-800 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">{sidebarTitle}</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth pb-20">
        {/* MEDIA TAB */}
        {activeSidebar === 'MEDIA' && (
          <>
            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Infoga</h3>
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => imageUploadRef.current?.click()} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-indigo-500 hover:bg-gray-800 text-white shadow-sm text-left transition-all active:scale-95">
                  <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-400"><Upload className="w-5 h-5" /></div>
                  <div>
                    <div className="text-sm font-bold">Ladda upp bild</div>
                    <div className="text-xs text-gray-500">JPG, PNG</div>
                  </div>
                </button>
                <input type="file" ref={imageUploadRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

                <button onClick={handleAddText} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-green-500 hover:bg-gray-800 text-white shadow-sm text-left transition-all active:scale-95">
                  <div className="w-8 h-8 rounded bg-green-500/20 flex items-center justify-center text-green-400"><Type className="w-5 h-5" /></div>
                  <div>
                    <div className="text-sm font-bold">Textblock</div>
                    <div className="text-xs text-gray-500">Rubriker, brödtext</div>
                  </div>
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Bakgrund</h3>
              <div className="flex flex-wrap gap-2">
                {['#ffffff', '#000000', '#f3f4f6', '#1f2937'].map(color => (
                  <button key={color} onClick={() => onSetBackground(color)} className={`w-8 h-8 rounded-lg border-2 shadow-sm ${backgroundColor === color ? 'border-indigo-500 scale-110' : 'border-gray-800'}`} style={{ backgroundColor: color }} />
                ))}
                <label className="w-8 h-8 rounded-lg border border-gray-700 bg-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-700 text-white">
                  <input type="color" className="hidden" onChange={(e) => { onSetBackground(e.target.value); onAddCustomColor(e.target.value); }} />
                  <Plus className="w-4 h-4" />
                </label>
              </div>
            </section>
          </>
        )}

        {/* AI TAB */}
        {activeSidebar === 'AI' && (
          <div className="space-y-6">
            <div className="flex bg-gray-900 p-1 rounded-lg">
              <button onClick={() => setAiSubTab('IMAGE')} className={`flex-1 py-1 text-[10px] font-bold rounded ${aiSubTab === 'IMAGE' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>Bild</button>
              <button onClick={() => setAiSubTab('TEXT')} className={`flex-1 py-1 text-[10px] font-bold rounded ${aiSubTab === 'TEXT' ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>Text</button>
            </div>

            {selectedIds.length > 0 && aiSubTab === 'IMAGE' && (
              <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                <input type="checkbox" id="useSelection" checked={useSelectionAsContext} onChange={(e) => setUseSelectionAsContext(e.target.checked)} className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"/>
                <label htmlFor="useSelection" className="text-xs font-bold text-indigo-300 select-none">Använd {selectedIds.length} objekt som referens</label>
              </div>
            )}

            <section className="space-y-2">
              <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Källa / Sammanhang</label>
              <textarea className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs text-gray-300 placeholder-gray-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none" rows={3} placeholder="Text/fakta som AI ska veta om..." value={aiContext} onChange={(e) => onUpdateContext(e.target.value)}/>
            </section>

            <section className="space-y-4">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Prompt</label>
              <textarea className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-sm text-white placeholder-gray-600 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none" rows={4} placeholder="Beskriv vad du vill skapa..." value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isGenerating}/>
              <button onClick={handleGenerateAi} disabled={isGenerating || !prompt.trim()} className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all">{isGenerating ? 'Arbetar...' : 'Generera'}</button>
            </section>
          </div>
        )}

        {/* LAYERS TAB */}
        {activeSidebar === 'LAYERS' && (
          <div className="space-y-4">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Dra för att ändra ordning</p>
            <div className="space-y-2">
              {elements.length === 0 && <div className="text-gray-600 text-xs text-center py-4">Inga lager än</div>}
              {[...elements].reverse().map((el, i) => {
                const isSelected = selectedIds.includes(el.id);
                const isBeingDragged = draggedId === el.id;
                const isDropTarget = dragOverId === el.id;
                
                return (
                  <div 
                    key={el.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, el.id)}
                    onDragOver={(e) => handleDragOver(e, el.id)}
                    onDrop={(e) => handleDrop(e, el.id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center justify-between p-2 border rounded group transition-all cursor-move
                      ${isBeingDragged ? 'opacity-50' : 'opacity-100'}
                      ${isDropTarget ? 'border-t-2 border-t-indigo-500' : ''}
                      ${isSelected ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-gray-900 border-gray-800 hover:border-gray-600'}`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden flex-1" onClick={() => onSelect(el.id, true)}>
                      <div className="w-6 h-6 flex-shrink-0 bg-gray-800 rounded flex items-center justify-center text-xs text-gray-400 select-none">
                        <Layers className="w-3 h-3" />
                      </div>
                      <div className="w-6 h-6 flex-shrink-0 bg-gray-800 rounded flex items-center justify-center text-xs">{el.type === 'image' ? '🖼️' : 'Tt'}</div>
                      <span className="text-xs truncate w-20 pointer-events-none">{el.type === 'text' ? (el as any).text : 'Bild'}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100">
                      <button onClick={() => onDeleteElement(el.id)} className="p-1 hover:text-red-400 text-gray-400 text-lg">×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CANVAS TAB */}
        {activeSidebar === 'CANVAS' && (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Storlek</h3>
              <select 
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs font-bold text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                onChange={(e) => { onSetSize(e.target.value); onClose(); }}
                value={CANVAS_PRESETS.find(p => p.width === canvasWidth && p.height === canvasHeight)?.id || ''}
              >
                <option value="" disabled>Anpassad storlek</option>
                {CANVAS_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </section>

            <div className="h-px bg-gray-800"></div>

            <section className="space-y-2">
              <button 
                onClick={() => onSetShowGrid(!showGrid)} 
                className={`w-full text-left px-4 py-3 text-xs font-bold rounded-xl flex items-center justify-between transition-all ${showGrid ? 'text-indigo-300 bg-indigo-500/10 border border-indigo-500/30' : 'text-gray-300 bg-gray-900 border border-gray-800 hover:bg-gray-800'}`}
              >
                <span>Visa rutnät</span>
                {showGrid && <Check className="w-4 h-4" />}
              </button>

              <button 
                onClick={() => onSetSnapToGrid(!snapToGrid)} 
                className={`w-full text-left px-4 py-3 text-xs font-bold rounded-xl flex items-center justify-between transition-all ${snapToGrid ? 'text-indigo-300 bg-indigo-500/10 border border-indigo-500/30' : 'text-gray-300 bg-gray-900 border border-gray-800 hover:bg-gray-800'}`}
              >
                <span>Snap mot rutnät</span>
                {snapToGrid && <Check className="w-4 h-4" />}
              </button>

              <button 
                onClick={onToggleOrientation} 
                className="w-full text-left px-4 py-3 text-xs font-bold text-gray-300 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl flex items-center justify-between transition-all"
              >
                <span>Växla stående/liggande</span>
                <RefreshCw className={`w-4 h-4 text-gray-500 transition-transform ${canvasWidth > canvasHeight ? 'rotate-90' : 'rotate-0'}`} />
              </button>
            </section>
          </div>
        )}

        {/* ARCHIVE TAB */}
        {activeSidebar === 'ARCHIVE' && (
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Projekt</h3>
              <button 
                onClick={() => { onQuickSave(); onClose(); }} 
                disabled={!hasSaved}
                className={`w-full text-left px-4 py-3 text-xs font-bold rounded-xl flex items-center gap-3 transition-all ${hasSaved ? 'text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20' : 'text-gray-600 bg-gray-900 border border-gray-800 cursor-not-allowed'}`}
              >
                <Save className="w-4 h-4" />
                Spara
              </button>
              <button onClick={() => { onSaveProject(); onClose(); }} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-300 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl flex items-center gap-3 transition-all">
                <Download className="w-4 h-4" />
                Spara som...
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-300 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl flex items-center gap-3 transition-all">
                <FolderOpen className="w-4 h-4" />
                Öppna projekt...
              </button>
              <input type="file" ref={fileInputRef} onChange={(e) => { handleLoadProject(e, fileInputRef); onClose(); }} accept=".json" className="hidden" />
            </section>

            <div className="h-px bg-gray-800"></div>

            <section className="space-y-2">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Exportera Canvas</h3>
              <button onClick={() => { onDownloadImage('png'); onClose(); }} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-300 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl flex items-center gap-3 transition-all">
                <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center text-gray-500 text-[10px] font-black">PNG</div>
                Som PNG-bild
              </button>
              <button onClick={() => { onDownloadImage('jpeg'); onClose(); }} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-300 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl flex items-center gap-3 transition-all">
                <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center text-gray-500 text-[10px] font-black">JPG</div>
                Som JPG-bild
              </button>
            </section>

            {selectedIds.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Exportera Markering</h3>
                <button onClick={() => { onDownloadSelection('png'); onClose(); }} className="w-full text-left px-4 py-3 text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 rounded-xl flex items-center gap-3 transition-all">
                  <div className="w-8 h-8 bg-indigo-500/20 rounded flex items-center justify-center text-indigo-400 text-[10px] font-black">PNG</div>
                  Som PNG (Transparent)
                </button>
                <button onClick={() => { onDownloadSelection('jpeg'); onClose(); }} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-300 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl flex items-center gap-3 transition-all">
                  <div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center text-gray-500 text-[10px] font-black">JPG</div>
                  Som JPG
                </button>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
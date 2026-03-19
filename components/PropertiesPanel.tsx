import React from 'react';
import { EditorElement, TextElement, ImageElement } from '../types';

interface PropertiesPanelProps {
  selectedElement: EditorElement | null;
  onUpdateElement: (updates: Partial<EditorElement>) => void;
  onDeleteElement: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMoveLayer: (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => void;
  customColors: string[];
  onAddCustomColor: (color: string) => void;
}

const FONTS = [
    { name: 'Inter', value: 'Inter' },
    { name: 'Roboto', value: 'Roboto' },
    { name: 'Playfair Display', value: 'Playfair Display' },
    { name: 'Montserrat', value: 'Montserrat' },
    { name: 'Oswald', value: 'Oswald' },
    { name: 'Merriweather', value: 'Merriweather' },
    { name: 'Anton', value: 'Anton' },
    { name: 'Pacifico', value: 'Pacifico' },
];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
  selectedElement, 
  onUpdateElement,
  onDeleteElement,
  onDuplicate,
  onMoveLayer,
  customColors,
  onAddCustomColor
}) => {
  // Mobile: If no element, hide completely. Desktop: Show placeholder.
  if (!selectedElement) {
    return (
      <div className="hidden lg:flex w-80 bg-gray-950 border-l border-gray-800 p-10 flex-col items-center justify-center text-center text-gray-600 h-full">
        <div className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-widest">Redigera</h3>
        <p className="text-xs">Klicka på ett objekt för att ändra färg, storlek och vinkel.</p>
      </div>
    );
  }

  const isText = selectedElement.type === 'text';
  const isImage = selectedElement.type === 'image';
  const textElement = selectedElement as TextElement;
  const imageElement = selectedElement as ImageElement;

  // Common styles section (Opacity, Shadow, Border)
  const renderStyleSection = () => (
      <div className="space-y-6 pt-4 border-t border-gray-800">
           {/* Opacity */}
           <div>
               <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span className="font-bold uppercase tracking-wider text-[10px]">Genomskinlighet</span> 
                    <span className="font-mono">{Math.round((selectedElement.opacity ?? 1) * 100)}%</span>
               </div>
               <input type="range" min="0" max="1" step="0.05" value={selectedElement.opacity ?? 1} onChange={(e) => onUpdateElement({ opacity: Number(e.target.value) })} className="w-full h-2 bg-gray-900 rounded-full appearance-none accent-indigo-500" />
           </div>

           {/* Border Radius (Image only) */}
           {isImage && (
               <div>
                   <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span className="font-bold uppercase tracking-wider text-[10px]">Runda Hörn</span> 
                        <span className="font-mono">{imageElement.borderRadius ?? 0}px</span>
                   </div>
                   <input type="range" min="0" max="150" value={imageElement.borderRadius ?? 0} onChange={(e) => onUpdateElement({ borderRadius: Number(e.target.value) })} className="w-full h-2 bg-gray-900 rounded-full appearance-none accent-indigo-500" />
               </div>
           )}

           {/* Stroke / Border */}
           <div className="space-y-3">
              <div className="flex items-center justify-between">
                   <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{isText ? 'Textkontur' : 'Ram'}</h3>
                   <input type="color" value={(isText ? textElement.strokeColor : imageElement.strokeColor) || '#000000'} onChange={(e) => onUpdateElement({ strokeColor: e.target.value })} className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer" />
              </div>
              <div className="flex items-center gap-3">
                   <span className="text-xs text-gray-400 w-8">Tjock</span>
                   <input type="range" min="0" max="20" step="0.5" value={(isText ? textElement.strokeWidth : imageElement.strokeWidth) || 0} onChange={(e) => onUpdateElement({ strokeWidth: Number(e.target.value) })} className="flex-1 h-2 bg-gray-900 rounded-full appearance-none accent-indigo-500" />
                   <span className="text-xs text-white font-mono w-6 text-right">{(isText ? textElement.strokeWidth : imageElement.strokeWidth) || 0}</span>
              </div>
           </div>

           {/* Shadow */}
           <div className="space-y-3">
              <div className="flex items-center justify-between">
                   <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Skugga</h3>
                   <input type="color" value={(isText ? textElement.shadowColor : imageElement.shadowColor) || '#000000'} onChange={(e) => onUpdateElement({ shadowColor: e.target.value })} className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer" />
              </div>
              <div className="flex items-center gap-3">
                   <span className="text-xs text-gray-400 w-8">Blur</span>
                   <input type="range" min="0" max="50" value={(isText ? textElement.shadowBlur : imageElement.shadowBlur) || 0} onChange={(e) => onUpdateElement({ shadowBlur: Number(e.target.value) })} className="flex-1 h-2 bg-gray-900 rounded-full appearance-none accent-indigo-500" />
                   <span className="text-xs text-white font-mono w-6 text-right">{(isText ? textElement.shadowBlur : imageElement.shadowBlur) || 0}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">X</span>
                      <input type="number" value={(isText ? textElement.shadowOffsetX : imageElement.shadowOffsetX) || 0} onChange={(e) => onUpdateElement({ shadowOffsetX: Number(e.target.value) })} className="w-full bg-gray-900 border border-gray-800 rounded p-1 text-xs text-center"/>
                  </div>
                  <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">Y</span>
                      <input type="number" value={(isText ? textElement.shadowOffsetY : imageElement.shadowOffsetY) || 0} onChange={(e) => onUpdateElement({ shadowOffsetY: Number(e.target.value) })} className="w-full bg-gray-900 border border-gray-800 rounded p-1 text-xs text-center"/>
                  </div>
              </div>
           </div>
      </div>
  );
  
  return (
    // Mobile: Absolute Bottom Sheet (max-h-1/2). Desktop: Fixed Right Sidebar (w-80)
    <div className="absolute bottom-0 left-0 w-full lg:static lg:w-80 h-[50vh] lg:h-full bg-gray-950 border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col shadow-2xl z-40 lg:z-30 overflow-hidden transition-transform duration-300">
      
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-gray-800 sticky top-0 bg-gray-950/95 backdrop-blur-xl z-20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
            <button className="lg:hidden p-1 bg-gray-800 rounded" onClick={() => onUpdateElement({})}>▼</button>
            <div>
                <h2 className="text-sm lg:text-lg font-black text-white tracking-tight">Redigera</h2>
                <p className="text-[10px] text-indigo-400 uppercase font-black tracking-widest">{isText ? 'Text' : 'Bild'}</p>
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => onDuplicate(selectedElement.id)} className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center bg-gray-900 border border-gray-800 hover:border-indigo-500 rounded-xl text-indigo-400 shadow-sm" title="Kopiera"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg></button>
            <button onClick={() => onDeleteElement(selectedElement.id)} className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 shadow-sm" title="Radera"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
        </div>
      </div>

      <div className="p-4 lg:p-6 space-y-6 lg:space-y-8 overflow-y-auto pb-20 custom-scrollbar">
        {/* TEXT CONTROLS */}
        {isText && (
            <div className="space-y-6">
                 <div>
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Typsnitt</h3>
                    <div className="relative">
                        <select 
                            value={textElement.fontFamily} 
                            onChange={(e) => onUpdateElement({ fontFamily: e.target.value })} 
                            className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-sm font-bold text-white appearance-none focus:outline-none focus:border-indigo-500 transition-colors"
                        >
                            {FONTS.map(f => (
                                <option key={f.value} value={f.value}>{f.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                 </div>

                 <div data-help="prop-align">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Justering</h3>
                    <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-800">
                        <button onClick={() => onUpdateElement({ textAlign: 'left' })} className={`flex-1 py-2 rounded-lg flex justify-center ${textElement.textAlign === 'left' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" /></svg></button>
                        <button onClick={() => onUpdateElement({ textAlign: 'center' })} className={`flex-1 py-2 rounded-lg flex justify-center ${textElement.textAlign === 'center' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                        <button onClick={() => onUpdateElement({ textAlign: 'right' })} className={`flex-1 py-2 rounded-lg flex justify-center ${textElement.textAlign === 'right' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M13 18h7" /></svg></button>
                    </div>
                 </div>
                 
                 <div data-help="prop-color">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Färg</h3>
                    <div className="flex flex-wrap gap-2">
                         {['#000000', '#ffffff', '#ef4444', '#f59e0b', '#10b981', '#3b82f6'].map(c => (
                            <button key={c} onClick={() => onUpdateElement({ color: c })} className={`w-8 h-8 rounded-lg border-2 ${textElement.color === c ? 'border-indigo-500 scale-110' : 'border-gray-800'}`} style={{ backgroundColor: c }} />
                        ))}
                        <label className="w-8 h-8 rounded-lg border border-gray-700 bg-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-700 text-white">
                            <input type="color" className="hidden" onChange={(e) => { onUpdateElement({ color: e.target.value }); onAddCustomColor(e.target.value); }} />
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </label>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-[10px] text-gray-500 uppercase font-bold">Textstorlek</label>
                        <input type="number" value={textElement.fontSize} onChange={(e) => onUpdateElement({ fontSize: Number(e.target.value) })} className="w-full bg-gray-900 border border-gray-800 rounded p-2 mt-1"/>
                     </div>
                 </div>
            </div>
        )}

        {isImage && (
            <div className="space-y-6">
                 <div className="flex items-center justify-between bg-gray-900 border border-gray-800 p-3 rounded-xl">
                     <span className="text-xs font-bold text-gray-300">Lås proportioner</span>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={imageElement.constrainProportions !== false} onChange={(e) => onUpdateElement({ constrainProportions: e.target.checked })} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                     </label>
                 </div>

                 {/* IMAGE FILTERS */}
                 <div className="space-y-4 pt-4 border-t border-gray-800">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Filter & Effekt</h3>
                    
                    <div>
                         <div className="flex justify-between text-xs text-gray-400 mb-1">
                             <span>Ljusstyrka</span> <span className="font-mono">{imageElement.filterBrightness ?? 100}%</span>
                         </div>
                         <input type="range" min="0" max="200" value={imageElement.filterBrightness ?? 100} onChange={(e) => onUpdateElement({ filterBrightness: Number(e.target.value) })} className="w-full h-2 bg-gray-900 rounded-full appearance-none accent-indigo-500" />
                    </div>

                    <div>
                         <div className="flex justify-between text-xs text-gray-400 mb-1">
                             <span>Kontrast</span> <span className="font-mono">{imageElement.filterContrast ?? 100}%</span>
                         </div>
                         <input type="range" min="0" max="200" value={imageElement.filterContrast ?? 100} onChange={(e) => onUpdateElement({ filterContrast: Number(e.target.value) })} className="w-full h-2 bg-gray-900 rounded-full appearance-none accent-indigo-500" />
                    </div>

                    <div>
                         <div className="flex justify-between text-xs text-gray-400 mb-1">
                             <span>Mättnad (Svartvitt)</span> <span className="font-mono">{imageElement.filterGrayscale ?? 0}%</span>
                         </div>
                         <input type="range" min="0" max="100" value={imageElement.filterGrayscale ?? 0} onChange={(e) => onUpdateElement({ filterGrayscale: Number(e.target.value) })} className="w-full h-2 bg-gray-900 rounded-full appearance-none accent-indigo-500" />
                    </div>

                     <div>
                         <div className="flex justify-between text-xs text-gray-400 mb-1">
                             <span>Sepia</span> <span className="font-mono">{imageElement.filterSepia ?? 0}%</span>
                         </div>
                         <input type="range" min="0" max="100" value={imageElement.filterSepia ?? 0} onChange={(e) => onUpdateElement({ filterSepia: Number(e.target.value) })} className="w-full h-2 bg-gray-900 rounded-full appearance-none accent-indigo-500" />
                    </div>

                    <div>
                         <div className="flex justify-between text-xs text-gray-400 mb-1">
                             <span>Oskärpa (Blur)</span> <span className="font-mono">{imageElement.filterBlur ?? 0}px</span>
                         </div>
                         <input type="range" min="0" max="20" value={imageElement.filterBlur ?? 0} onChange={(e) => onUpdateElement({ filterBlur: Number(e.target.value) })} className="w-full h-2 bg-gray-900 rounded-full appearance-none accent-indigo-500" />
                    </div>

                    <button onClick={() => onUpdateElement({ filterBrightness: 100, filterContrast: 100, filterGrayscale: 0, filterBlur: 0, filterSepia: 0 })} className="w-full py-2 bg-gray-900 hover:bg-gray-800 rounded text-xs text-gray-400 hover:text-white transition-colors">
                        Återställ filter
                    </button>
                 </div>
            </div>
        )}

        {/* Style Section (Opacity, Borders, Shadows) - Rendered for both */}
        {renderStyleSection()}

        {/* COMMON CONTROLS */}
        <section className="space-y-4 pt-4 border-t border-gray-800" data-help="prop-layers">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Lager</h3>
          <div className="grid grid-cols-4 gap-2">
            {[{ id: 'front', label: 'Överst' }, { id: 'forward', label: 'Upp' }, { id: 'backward', label: 'Ner' }, { id: 'back', label: 'Underst' }].map(btn => (
              <button key={btn.id} onClick={() => onMoveLayer(selectedElement.id, btn.id as any)} className="flex-1 h-10 flex items-center justify-center bg-gray-900 border border-gray-800 hover:border-indigo-500 rounded-lg text-xs font-bold text-gray-400">{btn.label}</button>
            ))}
          </div>
        </section>

        <section className="space-y-4" data-help="prop-rotate">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Rotation</h3>
            <input type="range" min="0" max="360" value={selectedElement.rotation} onChange={(e) => onUpdateElement({ rotation: Number(e.target.value) })} className="w-full h-3 bg-gray-900 rounded-full appearance-none cursor-pointer accent-indigo-500 border border-gray-800" />
        </section>
      </div>
    </div>
  );
};
import { useState, useRef, useCallback } from 'react';
import { AppState, EditorElement, CanvasPage } from '../types';
import { CANVAS_PRESETS, DEFAULT_PRESET } from '../constants/presets';

export const useEditorState = (onInteraction?: () => void) => {
  // Main State
  const [state, setState] = useState<AppState>({
    pages: [{ id: 'page-1', elements: [], backgroundColor: '#ffffff' }],
    currentPageId: 'page-1',
    bookTitle: 'Min bok',
    selectedIds: [],
    editingId: null,
    canvasWidth: DEFAULT_PRESET.width,
    canvasHeight: DEFAULT_PRESET.height,
    isGenerating: false,
    showGrid: true,
    snapToGrid: true,
    customColors: ['#FF5733', '#33FF57', '#3357FF'],
    aiContext: ''
  });

  // History Stacks
  const [history, setHistory] = useState<AppState[]>([]);
  const [future, setFuture] = useState<AppState[]>([]);
  
  // Clipboard (In-memory)
  const clipboard = useRef<EditorElement[]>([]);

  const notifyInteraction = () => {
      if (onInteraction) onInteraction();
  };

  // --- HISTORY MANAGEMENT ---

  const addSnapshot = useCallback(() => {
      setHistory(prev => {
          const newHistory = [...prev, state];
          // Limit history to 50 steps to save memory
          if (newHistory.length > 50) return newHistory.slice(1);
          return newHistory;
      });
      setFuture([]); // Clear future on new action
  }, [state]);

  const undo = useCallback(() => {
      notifyInteraction();
      if (history.length === 0) return;
      const previous = history[history.length - 1];
      const newHistory = history.slice(0, -1);
      
      setFuture(prev => [state, ...prev]);
      setState(previous);
      setHistory(newHistory);
  }, [history, state]);

  const redo = useCallback(() => {
      notifyInteraction();
      if (future.length === 0) return;
      const next = future[0];
      const newFuture = future.slice(1);

      setHistory(prev => [...prev, state]);
      setState(next);
      setFuture(newFuture);
  }, [future, state]);

  // --- ACTIONS ---

  const setSize = (presetId: string) => {
      addSnapshot();
      notifyInteraction();
      const preset = CANVAS_PRESETS.find(p => p.id === presetId);
      if (preset) {
          setState(prev => ({
              ...prev,
              canvasWidth: preset.width,
              canvasHeight: preset.height
          }));
      }
  };

  const setManualSize = (width: number, height: number) => {
      addSnapshot();
      notifyInteraction();
      setState(prev => ({ ...prev, canvasWidth: width, canvasHeight: height }));
  };

  const toggleOrientation = () => {
      addSnapshot();
      notifyInteraction();
      setState(prev => ({ ...prev, canvasWidth: prev.canvasHeight, canvasHeight: prev.canvasWidth }));
  };

  const addPage = () => {
      addSnapshot();
      notifyInteraction();
      const newPage: CanvasPage = { id: crypto.randomUUID(), elements: [], backgroundColor: '#ffffff' };
      setState(prev => ({ ...prev, pages: [...prev.pages, newPage], currentPageId: newPage.id }));
  };

  const removePage = (id: string) => {
      addSnapshot();
      notifyInteraction();
      setState(prev => {
          if (prev.pages.length <= 1) return prev;
          const newPages = prev.pages.filter(p => p.id !== id);
          const newCurrentPageId = prev.currentPageId === id ? newPages[0].id : prev.currentPageId;
          return { ...prev, pages: newPages, currentPageId: newCurrentPageId };
      });
  };

  const setCurrentPage = (id: string) => {
      notifyInteraction();
      setState(prev => ({ ...prev, currentPageId: id, selectedIds: [] }));
  };

  const addElement = (element: EditorElement) => {
    addSnapshot();
    notifyInteraction();
    setState(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === prev.currentPageId ? { ...p, elements: [...p.elements, element] } : p),
      selectedIds: [element.id], 
      editingId: element.type === 'text' ? element.id : null
    }));
  };

  const updateElement = (id: string, updates: Partial<EditorElement>, skipHistory = false) => {
    if (!skipHistory) addSnapshot();
    notifyInteraction();
    setState(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === prev.currentPageId ? { ...p, elements: p.elements.map(el => el.id === id ? { ...el, ...updates } as EditorElement : el) } : p)
    }));
  };

  const selectElement = (id: string | null, multiSelect = false) => {
    notifyInteraction();
    if (id === null) {
        setState(prev => ({ ...prev, selectedIds: [], editingId: null }));
        return;
    }

    setState(prev => {
        const editingId = prev.editingId === id ? prev.editingId : null;
        if (multiSelect) {
            const exists = prev.selectedIds.includes(id);
            let newIds;
            if (exists) newIds = prev.selectedIds.filter(existingId => existingId !== id);
            else newIds = [...prev.selectedIds, id];
            return { ...prev, selectedIds: newIds, editingId };
        } else {
            return { ...prev, selectedIds: [id], editingId };
        }
    });
  };

  const setEditingId = (id: string | null) => {
      notifyInteraction();
      setState(prev => ({ ...prev, editingId: id }));
  };

  const deleteElement = (id: string) => {
    addSnapshot();
    notifyInteraction();
    setState(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === prev.currentPageId ? { ...p, elements: p.elements.filter(el => el.id !== id) } : p),
      selectedIds: prev.selectedIds.filter(sid => sid !== id),
      editingId: null
    }));
  };

  const deleteSelected = () => {
      if (state.selectedIds.length === 0) return;
      addSnapshot();
      notifyInteraction();
      setState(prev => ({
          ...prev,
          pages: prev.pages.map(p => p.id === prev.currentPageId ? { ...p, elements: p.elements.filter(el => !prev.selectedIds.includes(el.id)) } : p),
          selectedIds: [],
          editingId: null
      }));
  };

  const duplicateElement = (id: string) => {
    addSnapshot();
    notifyInteraction();
    const page = state.pages.find(p => p.id === state.currentPageId);
    const el = page?.elements.find(e => e.id === id);
    if (!el) return;
    const newEl = { ...el, id: crypto.randomUUID(), x: el.x + 20, y: el.y + 20 };
    addElement(newEl as EditorElement);
  };

  // --- CLIPBOARD ---
  const copySelection = () => {
      const page = state.pages.find(p => p.id === state.currentPageId);
      const selected = page?.elements.filter(el => state.selectedIds.includes(el.id)) || [];
      if (selected.length > 0) {
          clipboard.current = selected;
      }
  };

  const pasteClipboard = () => {
      if (clipboard.current.length === 0) return;
      addSnapshot();
      notifyInteraction();
      
      const newElements = clipboard.current.map(el => ({
          ...el,
          id: crypto.randomUUID(),
          x: el.x + 20,
          y: el.y + 20
      }));

      setState(prev => ({
          ...prev,
          pages: prev.pages.map(p => p.id === prev.currentPageId ? { ...p, elements: [...p.elements, ...newElements] } : p),
          selectedIds: newElements.map(e => e.id)
      }));
  };

  const moveLayer = (id: string, direction: 'front' | 'back' | 'forward' | 'backward') => {
    addSnapshot();
    notifyInteraction();
    setState(prev => {
      const page = prev.pages.find(p => p.id === prev.currentPageId);
      if (!page) return prev;
      const idx = page.elements.findIndex(el => el.id === id);
      if (idx === -1) return prev;
      const newElements = [...page.elements];
      const [item] = newElements.splice(idx, 1);
      
      if (direction === 'front') newElements.push(item);
      else if (direction === 'back') newElements.unshift(item);
      else if (direction === 'forward') {
        const targetIdx = Math.min(idx + 1, newElements.length);
        newElements.splice(targetIdx, 0, item);
      } else if (direction === 'backward') {
        const targetIdx = Math.max(idx - 1, 0);
        newElements.splice(targetIdx, 0, item);
      }
      return { ...prev, pages: prev.pages.map(p => p.id === prev.currentPageId ? { ...p, elements: newElements } : p) };
    });
  };

  const reorderElement = (id: string, newIndex: number) => {
      addSnapshot();
      notifyInteraction();
      setState(prev => {
          const page = prev.pages.find(p => p.id === prev.currentPageId);
          if (!page) return prev;
          const currentIndex = page.elements.findIndex(el => el.id === id);
          if (currentIndex === -1) return prev;
          
          const newElements = [...page.elements];
          const [moved] = newElements.splice(currentIndex, 1);
          
          // Clamp index
          const targetIndex = Math.max(0, Math.min(newIndex, page.elements.length - 1));
          newElements.splice(targetIndex, 0, moved);
          
          return { ...prev, pages: prev.pages.map(p => p.id === prev.currentPageId ? { ...p, elements: newElements } : p) };
      });
  };

  const alignElements = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      addSnapshot();
      notifyInteraction();
      if (state.selectedIds.length < 2) return;
      const page = state.pages.find(p => p.id === state.currentPageId);
      const selectedElements = page?.elements.filter(el => state.selectedIds.includes(el.id)) || [];
      if (selectedElements.length === 0) return;

      const minX = Math.min(...selectedElements.map(el => el.x));
      const maxX = Math.max(...selectedElements.map(el => el.x));
      const minY = Math.min(...selectedElements.map(el => el.y));
      const maxY = Math.max(...selectedElements.map(el => el.y));
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      const updates: {id: string, update: Partial<EditorElement>}[] = [];

      selectedElements.forEach(el => {
          if (alignment === 'left') updates.push({ id: el.id, update: { x: minX } });
          if (alignment === 'center') updates.push({ id: el.id, update: { x: midX } });
          if (alignment === 'right') updates.push({ id: el.id, update: { x: maxX } });
          if (alignment === 'top') updates.push({ id: el.id, update: { y: minY } });
          if (alignment === 'middle') updates.push({ id: el.id, update: { y: midY } });
          if (alignment === 'bottom') updates.push({ id: el.id, update: { y: maxY } });
      });

      setState(prev => ({
          ...prev,
          pages: prev.pages.map(p => p.id === prev.currentPageId ? { 
              ...p, 
              elements: p.elements.map(el => {
                  const update = updates.find(u => u.id === el.id);
                  return update ? { ...el, ...update.update } as EditorElement : el;
              }) 
          } : p)
      }));
  };

  const applyLayout = (type: 'grid' | 'stack' | 'circle' | 'scatter') => {
    addSnapshot();
    notifyInteraction();
    setState(prev => {
      const page = prev.pages.find(p => p.id === prev.currentPageId);
      if (!page || page.elements.length === 0) return prev;
      
      const newElements = page.elements.map((el, i) => {
        const centerX = prev.canvasWidth / 2;
        const centerY = prev.canvasHeight / 2;
        const count = page.elements.length;
        
        if (type === 'grid') {
          const cols = Math.ceil(Math.sqrt(count));
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cellW = prev.canvasWidth / cols;
          const cellH = prev.canvasHeight / Math.ceil(count / cols);
          return { ...el, x: cellW * col + cellW / 2, y: cellH * row + cellH / 2, rotation: 0 };
        } else if (type === 'circle') {
          const radius = Math.min(prev.canvasWidth, prev.canvasHeight) * 0.35;
          const angle = (i / count) * Math.PI * 2;
          return { ...el, x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle), rotation: (angle * 180) / Math.PI };
        } else if (type === 'scatter') {
          return { 
            ...el, 
            x: 100 + Math.random() * (prev.canvasWidth - 200), 
            y: 100 + Math.random() * (prev.canvasHeight - 200), 
            rotation: Math.random() * 360 
          };
        } else {
          return { ...el, x: centerX + (i * 15), y: centerY + (i * 15), rotation: i * 8 };
        }
      });
      return { ...prev, pages: prev.pages.map(p => p.id === prev.currentPageId ? { ...p, elements: newElements as EditorElement[] } : p) };
    });
  };

  // State Setters (Simple wrappers)
  const setBackgroundColor = (color: string) => { addSnapshot(); notifyInteraction(); setState(prev => ({ ...prev, pages: prev.pages.map(p => p.id === prev.currentPageId ? { ...p, backgroundColor: color } : p) })); };
  const setShowGrid = (show: boolean) => setState(prev => ({ ...prev, showGrid: show }));
  const setSnapToGrid = (snap: boolean) => setState(prev => ({ ...prev, snapToGrid: snap }));
  const setIsGenerating = (val: boolean) => setState(prev => ({ ...prev, isGenerating: val }));
  const addCustomColor = (c: string) => setState(prev => ({ ...prev, customColors: [...prev.customColors, c] }));
  const setAiContext = (c: string) => setState(prev => ({ ...prev, aiContext: c }));
  const loadState = (newState: AppState) => { addSnapshot(); notifyInteraction(); setState(newState); };
  
  // Helpers
  const setGridSilent = (show: boolean) => setState(prev => ({ ...prev, showGrid: show }));
  const setSelectionSilent = (ids: string[]) => setState(prev => ({ ...prev, selectedIds: ids, editingId: null }));

  return {
      state,
      canUndo: history.length > 0,
      canRedo: future.length > 0,
      actions: {
          setSize,
          setManualSize,
          toggleOrientation,
          addPage,
          removePage,
          setCurrentPage,
          addElement,
          updateElement,
          selectElement,
          setEditingId,
          deleteElement,
          deleteSelected,
          duplicateElement,
          copySelection,
          pasteClipboard,
          undo,
          redo,
          addSnapshot,
          moveLayer,
          reorderElement,
          alignElements,
          applyLayout,
          setBackgroundColor,
          setShowGrid,
          setSnapToGrid,
          setIsGenerating,
          addCustomColor,
          setAiContext,
          loadState,
          setGridSilent,
          setSelectionSilent
      }
  };
};

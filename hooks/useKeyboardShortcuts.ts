import { useEffect } from 'react';
import { AppState } from '../types';

interface KeyboardActions {
    deleteSelected: () => void;
    undo: () => void;
    redo: () => void;
    copySelection: () => void;
    pasteClipboard: () => void;
    updateElement: (id: string, updates: any, skipHistory?: boolean) => void;
    addSnapshot: () => void;
}

export const useKeyboardShortcuts = (
    state: AppState,
    actions: KeyboardActions
) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input or textarea
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
                return;
            }

            // Undo / Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) actions.redo();
                else actions.undo();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                actions.redo();
                return;
            }

            // Copy / Paste
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                actions.copySelection();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                actions.pasteClipboard();
                return;
            }

            // Delete
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                actions.deleteSelected();
                return;
            }

            // Nudge (Arrow Keys)
            if (state.selectedIds.length > 0) {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.preventDefault();
                    // We need to snapshot BEFORE the first move in a sequence, but that's hard to detect.
                    // For simplicity in nudge, we just update.
                    // Ideally, we'd throttle snapshots, but let's just snapshot on every key press for now to ensure Undo works.
                    // To avoid spamming history, we could check if future is empty (meaning we are at tip), 
                    // but simplest is just save.
                    
                    const step = e.shiftKey ? 10 : 1;
                    actions.addSnapshot();
                    
                    const currentPage = state.pages.find(p => p.id === state.currentPageId) || state.pages[0];
                    state.selectedIds.forEach(id => {
                        const el = currentPage.elements.find(e => e.id === id);
                        if (!el) return;
                        
                        let dx = 0;
                        let dy = 0;
                        if (e.key === 'ArrowUp') dy = -step;
                        if (e.key === 'ArrowDown') dy = step;
                        if (e.key === 'ArrowLeft') dx = -step;
                        if (e.key === 'ArrowRight') dx = step;

                        actions.updateElement(id, { x: el.x + dx, y: el.y + dy }, true); // Pass true to skip internal snapshot since we did it manually above (or if we want granular undo)
                        // Actually, let's remove the manual addSnapshot above and let updateElement handle it if we want every step undoable.
                        // OR pass skipHistory=false (default).
                    });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [state, actions]);
};
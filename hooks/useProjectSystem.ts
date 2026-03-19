
import React, { RefObject, useState } from 'react';
import { AppState, EditorElement, ImageElement, TextElement } from '../types';
import { wrapText } from './useCanvasRender';
import { saveProjectState, fetchProjectState } from '../services/driveService';

interface ProjectSystemActions {
    loadState: (state: AppState) => void;
    setSelectionSilent: (ids: string[]) => void;
    setGridSilent: (show: boolean) => void;
    selectElement: (id: string | null, multi: boolean) => void;
}

export const useProjectSystem = (
    state: AppState,
    actions: ProjectSystemActions,
    canvasRef: RefObject<HTMLCanvasElement>,
    onInteraction: () => void,
    accessToken: string | null
) => {

    // --- HELPER: Calculate Rotated Bounding Box ---
    const getBoundingBox = (elements: EditorElement[]) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        elements.forEach(el => {
            const w = el.width || 0;
            const h = el.height || 0;
            const angle = (el.rotation * Math.PI) / 180;
            
            // Calculate corners relative to center
            const corners = [
                { x: -w/2, y: -h/2 },
                { x: w/2, y: -h/2 },
                { x: w/2, y: h/2 },
                { x: -w/2, y: h/2 }
            ];

            // Rotate and translate corners
            corners.forEach(p => {
                const rx = p.x * Math.cos(angle) - p.y * Math.sin(angle);
                const ry = p.x * Math.sin(angle) + p.y * Math.cos(angle);
                const absX = el.x + rx;
                const absY = el.y + ry;
                
                if (absX < minX) minX = absX;
                if (absX > maxX) maxX = absX;
                if (absY < minY) minY = absY;
                if (absY > maxY) maxY = absY;
            });
        });

        return { minX, minY, width: maxX - minX, height: maxY - minY };
    };

    // --- SNAPSHOTS (For AI Context) ---
    const getCanvasSnapshot = (): string | null => {
        if (canvasRef.current) {
            // Low quality jpeg for AI context is sufficient and faster
            return canvasRef.current.toDataURL('image/jpeg', 0.8);
        }
        return null;
    };

    const getSelectionAsBase64 = async (): Promise<string | null> => {
        if (state.selectedIds.length === 0) return null;
        const currentPage = state.pages.find(p => p.id === state.currentPageId) || state.pages[0];
        const selectedEls = currentPage.elements.filter(el => state.selectedIds.includes(el.id));
        if (selectedEls.length === 0) return null;

        const bounds = getBoundingBox(selectedEls);
        // Add margin
        const margin = 20;
        const width = bounds.width + (margin * 2);
        const height = bounds.height + (margin * 2);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return null;

        // White background for selection context (AI reads shapes better on white usually)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // Translate context so the top-left of the bounding box is at (margin, margin)
        ctx.translate(-bounds.minX + margin, -bounds.minY + margin);

        await drawElementsToContext(ctx, selectedEls);
        return tempCanvas.toDataURL('image/png');
    };

    // --- DRAWING HELPER ---
    const drawElementsToContext = async (ctx: CanvasRenderingContext2D, elements: EditorElement[]) => {
        const drawPromises = elements.map(el => {
            return new Promise<void>((resolve) => {
                ctx.save();
                ctx.translate(el.x, el.y);
                ctx.rotate((el.rotation * Math.PI) / 180);
                
                // Opacity
                ctx.globalAlpha = typeof el.opacity === 'number' ? el.opacity : 1;

                if (el.type === 'image') {
                    const imgEl = el as ImageElement;
                    const img = new Image();
                    img.crossOrigin = "anonymous"; // Try to avoid taint issues
                    img.src = imgEl.src;
                    
                    img.onload = () => {
                        const w = imgEl.width!;
                        const h = imgEl.height!;
                        const x = -w / 2;
                        const y = -h / 2;

                        // Apply Filters (Simplified for export)
                        const brightness = imgEl.filterBrightness ?? 100;
                        const contrast = imgEl.filterContrast ?? 100;
                        const grayscale = imgEl.filterGrayscale ?? 0;
                        const sepia = imgEl.filterSepia ?? 0;
                        const blur = imgEl.filterBlur ?? 0;
                        
                        if (brightness !== 100 || contrast !== 100 || grayscale !== 0 || sepia !== 0 || blur !== 0) {
                            ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%) sepia(${sepia}%) blur(${blur}px)`;
                        }

                        // Rounded Corners
                        if (imgEl.borderRadius && imgEl.borderRadius > 0) {
                            ctx.beginPath();
                            // Fix for TS considering else branch unreachable if roundRect is in interface
                            if (typeof (ctx as any).roundRect === 'function') {
                                (ctx as any).roundRect(x, y, w, h, imgEl.borderRadius);
                            } else {
                                ctx.rect(x, y, w, h);
                            }
                            ctx.clip();
                        }

                        ctx.drawImage(img, x, y, w, h);
                        
                        // Border
                        if (imgEl.strokeWidth && imgEl.strokeWidth > 0) {
                            ctx.filter = 'none'; // Reset filter for border
                            ctx.lineWidth = imgEl.strokeWidth;
                            ctx.strokeStyle = imgEl.strokeColor || '#000000';
                            ctx.strokeRect(x, y, w, h);
                        }

                        ctx.restore();
                        resolve();
                    };
                    img.onerror = () => { ctx.restore(); resolve(); }
                } else if (el.type === 'text') {
                    const t = el as TextElement;
                    ctx.font = `${t.fontWeight} ${t.fontSize}px ${t.fontFamily}`;
                    ctx.textBaseline = 'top';
                    
                    const padding = t.padding || 0;
                    const lines = wrapText(ctx, t.text, t.width!, t.fontSize, padding);
                    const lineHeight = t.fontSize * (t.lineHeight || 1.2);
                    const totalHeight = lines.length * lineHeight;
                    let startY = -totalHeight / 2;

                    // Alignment
                    if (t.textAlign === 'left') ctx.textAlign = 'left';
                    else if (t.textAlign === 'right') ctx.textAlign = 'right';
                    else ctx.textAlign = 'center';

                    let xPos = 0;
                    if (t.textAlign === 'left') xPos = -t.width! / 2 + padding;
                    else if (t.textAlign === 'right') xPos = t.width! / 2 - padding;
                    else xPos = 0;

                    // Stroke
                    if (t.strokeWidth && t.strokeWidth > 0) {
                        ctx.lineWidth = t.strokeWidth;
                        ctx.strokeStyle = t.strokeColor || '#000000';
                        ctx.lineJoin = 'round';
                        lines.forEach((line, i) => ctx.strokeText(line, xPos, startY + (i * lineHeight)));
                    }

                    // Fill
                    ctx.fillStyle = t.color;
                    lines.forEach((line, i) => ctx.fillText(line, xPos, startY + (i * lineHeight)));
                    
                    ctx.restore();
                    resolve();
                }
            });
        });
        await Promise.all(drawPromises);
    };

    // --- FILE I/O ---

    const [hasSaved, setHasSaved] = useState(false);

    const handleDownloadSelection = async (format: 'png' | 'jpeg') => {
        onInteraction();
        if (state.selectedIds.length === 0) {
            alert("Inget markerat att spara.");
            return;
        }

        const currentPage = state.pages.find(p => p.id === state.currentPageId) || state.pages[0];
        // 1. Get Elements
        // Better: Filter from main element list to keep layer order
        const orderedSelectedEls = currentPage.elements.filter(el => state.selectedIds.includes(el.id));

        // 2. Calculate Bounding Box
        const bounds = getBoundingBox(orderedSelectedEls);
        
        // 3. Setup Canvas
        const margin = 0; // No margin for precise export
        const width = Math.ceil(bounds.width);
        const height = Math.ceil(bounds.height);
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const ctx = tempCanvas.getContext('2d');
        
        if (!ctx) return;

        // 4. Background
        if (format === 'jpeg') {
            ctx.fillStyle = currentPage.backgroundColor; // Use canvas background for JPEG
            ctx.fillRect(0, 0, width, height);
        } else {
            ctx.clearRect(0, 0, width, height); // Transparent for PNG
        }

        // 5. Draw
        ctx.translate(-bounds.minX, -bounds.minY);
        await drawElementsToContext(ctx, orderedSelectedEls);

        // 6. Download
        const link = document.createElement('a');
        link.download = `markering-${Date.now()}.${format === 'jpeg' ? 'jpg' : 'png'}`;
        link.href = tempCanvas.toDataURL(`image/${format}`, 1.0);
        link.click();
    };

    const handleDownloadImage = (format: 'png' | 'jpeg' = 'jpeg') => {
        onInteraction();
        const canvas = canvasRef.current;
        if (canvas) {
            // 1. Save current visual state
            const oldSelection = state.selectedIds;
            const wasGridOn = state.showGrid;

            // 2. Prepare for export (hide UI helpers)
            actions.setSelectionSilent([]);
            actions.setGridSilent(false);

            // 3. Wait for React/Canvas render cycle, then capture
            setTimeout(() => {
                const link = document.createElement('a');
                const ext = format === 'jpeg' ? 'jpg' : 'png';
                link.download = `bild-${Date.now()}.${ext}`;
                link.href = canvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.95 : 1.0);
                link.click();

                // 4. Restore state
                actions.setGridSilent(wasGridOn);
                if (oldSelection.length > 0) {
                    actions.setSelectionSilent(oldSelection);
                }
            }, 100);
        }
    };

    const handleSaveProject = async () => {
        onInteraction();
        if (!accessToken) {
            alert("Du måste vara inloggad för att spara till Google Drive.");
            return;
        }
        
        try {
            // Spara till Drive
            const fileId = await saveProjectState(accessToken, state);
            if (fileId) {
                setHasSaved(true);
                alert(`Projektet "${state.bookTitle}" har sparats till Google Drive!`);
            } else {
                alert("Ett fel uppstod när projektet skulle sparas.");
            }
        } catch (error) {
            console.error("Kunde inte spara till Drive:", error);
            alert("Ett fel uppstod när projektet skulle sparas.");
        }
    };

    const handleQuickSave = () => {
        onInteraction();
        // For a browser app without file system access, "Save" can update LocalStorage
        // or just re-download with a generic name.
        // Let's use LocalStorage for "Quick Save" to provide a better UX.
        localStorage.setItem('skapa_project_autosave', JSON.stringify(state));
        alert('Projektet sparades i webbläsarens minne.');
    };

    const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>, fileInputRef: RefObject<HTMLInputElement>) => {
        onInteraction();
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target?.result as string);
                if (Array.isArray(json.pages)) {
                    actions.loadState(json);
                } else {
                    alert('Ogiltig projektfil');
                }
            } catch (err) {
                console.error(err);
                alert('Kunde inte läsa filen');
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return {
        getCanvasSnapshot,
        getSelectionAsBase64,
        handleDownloadImage,
        handleDownloadSelection,
        handleSaveProject,
        handleQuickSave,
        handleLoadProject,
        hasSaved
    };
};

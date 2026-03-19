
import { useEffect, useRef, useCallback, RefObject } from 'react';
import { EditorElement, ImageElement, TextElement } from '../types';

// Helper to wrap text for Canvas
export const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number, padding: number) => {
    const lines: string[] = [];
    const paragraphs = text.split('\n');
    const availableWidth = Math.max(1, maxWidth - (padding * 2));

    paragraphs.forEach(paragraph => {
        if (paragraph === '') {
            lines.push('');
            return;
        }
        const words = paragraph.split(' ');
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine ? currentLine + " " + word : word;
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth <= availableWidth || currentLine === '') {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
    });
    return lines;
};

interface RenderParams {
    elements: EditorElement[];
    selectedIds: string[];
    editingId: string | null;
    backgroundColor: string;
    showGrid: boolean;
    width: number;
    height: number;
}

export const useCanvasRender = (
    canvasRef: RefObject<HTMLCanvasElement>,
    { elements, selectedIds, editingId, backgroundColor, showGrid, width, height }: RenderParams
) => {
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    // Preload images when elements change
    useEffect(() => {
        elements.forEach(el => {
            if (el.type === 'image' && !imageCache.current.has(el.src)) {
                const img = new Image();
                img.src = (el as ImageElement).src;
                img.onload = () => {
                    imageCache.current.set((el as ImageElement).src, img);
                    draw(); // Redraw when loaded
                };
            }
        });
    }, [elements]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // 2. Grid
        if (showGrid) {
            ctx.strokeStyle = backgroundColor === '#ffffff' || backgroundColor === 'white' ? '#9ca3af' : 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let x = 0; x <= width; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
            for (let y = 0; y <= height; y += 100) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
            ctx.stroke();
        }

        // 3. Elements
        elements.forEach(el => {
            if (el.id === editingId) return; // Skip rendering currently edited text (textarea overlays it)

            ctx.save();
            ctx.translate(el.x, el.y);
            ctx.rotate((el.rotation * Math.PI) / 180);
            
            // Global Opacity
            ctx.globalAlpha = typeof el.opacity === 'number' ? el.opacity : 1;

            if (el.type === 'image') {
                const imgEl = el as ImageElement;
                const img = imageCache.current.get(imgEl.src);
                if (img) {
                    const w = imgEl.width!;
                    const h = imgEl.height!;
                    const x = -w / 2;
                    const y = -h / 2;

                    // Apply Filters
                    const brightness = imgEl.filterBrightness ?? 100;
                    const contrast = imgEl.filterContrast ?? 100;
                    const grayscale = imgEl.filterGrayscale ?? 0;
                    const sepia = imgEl.filterSepia ?? 0;
                    const blur = imgEl.filterBlur ?? 0;
                    
                    if (brightness !== 100 || contrast !== 100 || grayscale !== 0 || sepia !== 0 || blur !== 0) {
                        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%) sepia(${sepia}%) blur(${blur}px)`;
                    }

                    // Rounded Corners & Shadows for Images
                    const borderRadius = imgEl.borderRadius || 0;
                    
                    if (borderRadius > 0) {
                        // Create shape path
                        ctx.beginPath();
                        // Fix for TS considering else branch unreachable if roundRect is in interface
                        if (typeof (ctx as any).roundRect === 'function') {
                            (ctx as any).roundRect(x, y, w, h, borderRadius);
                        } else {
                            ctx.rect(x, y, w, h); // Fallback
                        }

                        // Draw Shadow (needs to be done before clip to be visible outside)
                        if (imgEl.shadowColor && imgEl.shadowBlur) {
                            ctx.save();
                            ctx.shadowColor = imgEl.shadowColor;
                            ctx.shadowBlur = imgEl.shadowBlur;
                            ctx.shadowOffsetX = imgEl.shadowOffsetX || 0;
                            ctx.shadowOffsetY = imgEl.shadowOffsetY || 0;
                            ctx.fillStyle = '#000000'; // Fill color doesn't matter, only shadow
                            ctx.fill();
                            ctx.restore();
                        }

                        ctx.clip();
                        ctx.drawImage(img, x, y, w, h);
                        
                        // Draw Border (Stroke) inside the clip? No, usually on top of edge.
                        // We need to re-stroke the path after clipping/drawing.
                        if (imgEl.strokeWidth && imgEl.strokeWidth > 0) {
                            ctx.lineWidth = imgEl.strokeWidth;
                            ctx.strokeStyle = imgEl.strokeColor || '#000000';
                            ctx.stroke();
                        }
                    } else {
                        // Standard Rectangular Image
                        if (imgEl.shadowColor && imgEl.shadowBlur) {
                            ctx.shadowColor = imgEl.shadowColor;
                            ctx.shadowBlur = imgEl.shadowBlur;
                            ctx.shadowOffsetX = imgEl.shadowOffsetX || 0;
                            ctx.shadowOffsetY = imgEl.shadowOffsetY || 0;
                        }

                        ctx.drawImage(img, x, y, w, h);

                        if (imgEl.strokeWidth && imgEl.strokeWidth > 0) {
                            // Turn off shadow for stroke to keep it clean, or keep it if desired. 
                            // Usually border casts shadow too.
                            ctx.lineWidth = imgEl.strokeWidth;
                            ctx.strokeStyle = imgEl.strokeColor || '#000000';
                            ctx.strokeRect(x, y, w, h);
                        }
                    }
                    
                    // Reset filter
                    ctx.filter = 'none';
                }
            } else if (el.type === 'text') {
                const textEl = el as TextElement;
                const padding = textEl.padding || 0;
                ctx.font = `${textEl.fontWeight} ${textEl.fontSize}px ${textEl.fontFamily}`;
                ctx.textBaseline = 'top';

                const lines = wrapText(ctx, textEl.text, textEl.width!, textEl.fontSize, padding);
                const lineHeight = textEl.fontSize * (textEl.lineHeight || 1.2);
                const totalTextHeight = lines.length * lineHeight;

                let startY = -totalTextHeight / 2;

                // Configure Shadow
                if (textEl.shadowColor && textEl.shadowBlur !== undefined && textEl.shadowBlur > 0) {
                    ctx.shadowColor = textEl.shadowColor;
                    ctx.shadowBlur = textEl.shadowBlur;
                    ctx.shadowOffsetX = textEl.shadowOffsetX || 0;
                    ctx.shadowOffsetY = textEl.shadowOffsetY || 0;
                } else {
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                }

                // Setup alignment
                let x = 0;
                if (textEl.textAlign === 'left') {
                    x = -textEl.width! / 2 + padding;
                    ctx.textAlign = 'left';
                }
                else if (textEl.textAlign === 'right') {
                    x = textEl.width! / 2 - padding;
                    ctx.textAlign = 'right';
                }
                else {
                    x = 0;
                    ctx.textAlign = 'center';
                }

                // Loop for Stroke (First pass, if enabled)
                if (textEl.strokeWidth && textEl.strokeWidth > 0) {
                    ctx.lineWidth = textEl.strokeWidth;
                    ctx.strokeStyle = textEl.strokeColor || '#000000';
                    ctx.lineJoin = 'round';
                    lines.forEach((line, i) => {
                        ctx.strokeText(line, x, startY + (i * lineHeight));
                    });
                }

                // Loop for Fill (Second pass, on top)
                ctx.fillStyle = textEl.color;
                lines.forEach((line, i) => {
                    ctx.fillText(line, x, startY + (i * lineHeight));
                });
            }

            // 4. Selection Outline
            if (selectedIds.includes(el.id) && el.id !== editingId) {
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
                ctx.globalAlpha = 1; // Reset opacity for selection box

                let w = el.width!;
                let h = el.height!;
                if (el.type === 'text') {
                    const textEl = el as TextElement;
                    const lineHeight = textEl.fontSize * (textEl.lineHeight || 1.2);
                    ctx.font = `${textEl.fontWeight} ${textEl.fontSize}px ${textEl.fontFamily}`;
                    const lines = wrapText(ctx, textEl.text, textEl.width!, textEl.fontSize, textEl.padding);
                    h = Math.max(lines.length * lineHeight + (textEl.padding * 2), 50);
                }

                ctx.strokeStyle = '#6366f1';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(-w / 2, -h / 2, w, h);
                ctx.setLineDash([]);

                if (selectedIds.length === 1) {
                    // Rotate Handle
                    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(0, h / 2 + 25); ctx.stroke();
                    ctx.beginPath(); ctx.arc(0, h / 2 + 25, 8, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill(); ctx.stroke();

                    // Corner Handles
                    const handles = [[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2], [w / 2, h / 2]];
                    handles.forEach(([hx, hy]) => {
                        ctx.fillStyle = 'white';
                        ctx.fillRect(hx - 5, hy - 5, 10, 10);
                        ctx.strokeRect(hx - 5, hy - 5, 10, 10);
                    });
                }
            }
            ctx.restore();
        });
    }, [elements, backgroundColor, selectedIds, editingId, width, height, showGrid]);

    useEffect(() => {
        draw();
    }, [draw]);

    return { draw };
};

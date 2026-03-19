
import React, { useRef, useState } from 'react';
import { EditorElement, TextElement, ImageElement } from '../types';
import { useCanvasRender, wrapText } from '../hooks/useCanvasRender';

interface CanvasWorkspaceProps {
  elements: EditorElement[];
  selectedIds: string[];
  editingId: string | null;
  backgroundColor: string;
  showGrid: boolean;
  snapToGrid: boolean;
  onSelect: (id: string | null, multiSelect?: boolean) => void;
  onEdit: (id: string | null) => void;
  onUpdateElement: (id: string, updates: Partial<EditorElement>, skipHistory?: boolean) => void;
  onAddSnapshot: () => void;
  width: number;
  height: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

interface TouchPoint {
  clientX: number;
  clientY: number;
}

const getDistance = (t1: TouchPoint, t2: TouchPoint) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
};

const getAngle = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
};

const SNAP_GRID_SIZE = 10;
const SNAP_ROTATION_STEP = 45;
const DRAG_THRESHOLD = 5; 

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  elements,
  selectedIds,
  editingId,
  backgroundColor,
  showGrid,
  snapToGrid,
  onSelect,
  onEdit,
  onUpdateElement,
  onAddSnapshot,
  width,
  height,
  canvasRef
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewTransform, setViewTransform] = useState({ scale: 0.8, x: 0, y: 0 });
  const [interactionMode, setInteractionMode] = useState<'IDLE' | 'DRAG_ELEMENT' | 'RESIZE_ELEMENT' | 'ROTATE_ELEMENT' | 'PAN_ZOOM_CANVAS' | 'MAYBE_DRAG'>('IDLE');
  
  const startTouches = useRef<{x: number, y: number, d: number}[]>([]);
  const startViewTransform = useRef({ scale: 1, x: 0, y: 0 });
  const startElementProps = useRef<Map<string, {x: number, y: number, width: number, height: number, rotation: number}>>(new Map());
  const initialRotationAngle = useRef(0);
  const lastTapRef = useRef<number>(0);
  const maybeDragTarget = useRef<string | null>(null);

  // Modularized Rendering Logic
  useCanvasRender(canvasRef, { elements, selectedIds, editingId, backgroundColor, showGrid, width, height });

  // Initialize View
  React.useEffect(() => {
    if (containerRef.current) {
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const scale = Math.min((cw - 40) / width, (ch - 40) / height, 1);
        setViewTransform({
            scale,
            x: (cw - width * scale) / 2,
            y: (ch - height * scale) / 2
        });
    }
  }, [width, height]);

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  // Helper to get precise dimensions for hit testing
  const getElementDims = (el: EditorElement) => {
      let w = el.width!;
      let h = el.height!;
      
      if (el.type === 'text') {
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) {
              const textEl = el as TextElement;
              ctx.font = `${textEl.fontWeight} ${textEl.fontSize}px ${textEl.fontFamily}`;
              const lines = wrapText(ctx, textEl.text, textEl.width!, textEl.fontSize, textEl.padding || 0);
              const lineHeight = textEl.fontSize * (textEl.lineHeight || 1.2);
              h = Math.max(lines.length * lineHeight + ((textEl.padding || 0) * 2), 50);
          } else {
              // Fallback if no context
              h = Math.max((el as TextElement).fontSize * 2, 50);
          }
      }
      return { w, h };
  };

  const hitTest = (x: number, y: number) => {
    // Check handles first (only for single selection)
    if (selectedIds.length === 1) {
         const el = elements.find(e => e.id === selectedIds[0]);
         if (el) {
             const rad = -el.rotation * Math.PI / 180;
             const dx = x - el.x;
             const dy = y - el.y;
             const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
             const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
             
             const { w, h } = getElementDims(el);

             // Increased hit area slightly (25 -> 30) for better usability
             if (Math.sqrt(rx*rx + (ry - (h/2 + 25))**2) < 30) return { id: el.id, type: 'rotate' };
             if (Math.abs(Math.abs(rx) - w/2) < 30 && Math.abs(Math.abs(ry) - h/2) < 30) return { id: el.id, type: 'resize' };
         }
    }

    // Check bodies
    for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        const rad = -el.rotation * Math.PI / 180;
        const dx = x - el.x;
        const dy = y - el.y;
        const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
        const ry = dx * Math.sin(rad) + dy * Math.cos(rad);

        const { w, h } = getElementDims(el);

        if (Math.abs(rx) < w/2 + 10 && Math.abs(ry) < h/2 + 10) return { id: el.id, type: 'body' };
    }
    return null;
  };

  const handlePointerDown = (e: React.TouchEvent | React.MouseEvent) => {
    const touches: TouchPoint[] = (e as React.TouchEvent).touches 
      ? Array.from((e as React.TouchEvent).touches) 
      : [{ clientX: (e as React.MouseEvent).clientX, clientY: (e as React.MouseEvent).clientY }];
    
    const pt = getCanvasPoint(touches[0].clientX, touches[0].clientY);

    // Double Tap detection
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
         const hit = hitTest(pt.x, pt.y);
         if (hit && elements.find(el => el.id === hit.id)?.type === 'text') {
             onEdit(hit.id);
             return;
         }
    }
    lastTapRef.current = now;

    if (editingId) {
        onEdit(null);
        return;
    }

    if (touches.length === 2) {
         setInteractionMode('PAN_ZOOM_CANVAS');
         startTouches.current = [{ x: (touches[0].clientX + touches[1].clientX)/2, y: (touches[0].clientY + touches[1].clientY)/2, d: getDistance(touches[0], touches[1]) }];
         startViewTransform.current = { ...viewTransform };
         return;
    }

    const hit = hitTest(pt.x, pt.y);
    if (hit) {
        // --- HISTORY SNAPSHOT ---
        // We are about to modify the element, so save current state to history.
        onAddSnapshot();

        if (hit.type === 'rotate' || hit.type === 'resize') {
            onSelect(hit.id, false); 
            setInteractionMode(hit.type === 'rotate' ? 'ROTATE_ELEMENT' : 'RESIZE_ELEMENT');
             const el = elements.find(e => e.id === hit.id);
             if (el) initialRotationAngle.current = getAngle(el.x, el.y, pt.x, pt.y) - el.rotation;
             if (el) {
                 const props = new Map();
                 props.set(el.id, {...el});
                 startElementProps.current = props;
             }
             startTouches.current = [{x: pt.x, y: pt.y, d: 0}];
             return;
        }

        setInteractionMode('MAYBE_DRAG');
        maybeDragTarget.current = hit.id;
        startTouches.current = [{x: pt.x, y: pt.y, d: 0}];
        
        const props = new Map();
        elements.forEach(el => props.set(el.id, { ...el }));
        startElementProps.current = props;
    } else {
        setInteractionMode('PAN_ZOOM_CANVAS');
        startTouches.current = [{ x: touches[0].clientX, y: touches[0].clientY, d: 0 }];
        startViewTransform.current = { ...viewTransform };
    }
  };

  const handlePointerMove = (e: React.TouchEvent | React.MouseEvent) => {
      if (interactionMode === 'IDLE') return;
      const touches: TouchPoint[] = (e as React.TouchEvent).touches 
      ? Array.from((e as React.TouchEvent).touches) 
      : [{ clientX: (e as React.MouseEvent).clientX, clientY: (e as React.MouseEvent).clientY }];
      const pt = getCanvasPoint(touches[0].clientX, touches[0].clientY);

      if (interactionMode === 'MAYBE_DRAG') {
          const dx = pt.x - startTouches.current[0].x;
          const dy = pt.y - startTouches.current[0].y;
          if (Math.sqrt(dx*dx + dy*dy) > DRAG_THRESHOLD) {
              setInteractionMode('DRAG_ELEMENT');
              if (maybeDragTarget.current && !selectedIds.includes(maybeDragTarget.current)) {
                  onSelect(maybeDragTarget.current, false);
                  const props = new Map();
                  const el = elements.find(e => e.id === maybeDragTarget.current);
                  if (el) props.set(el.id, {...el});
                  startElementProps.current = props;
              }
          }
      }

      if (interactionMode === 'DRAG_ELEMENT') {
          const dx = pt.x - startTouches.current[0].x;
          const dy = pt.y - startTouches.current[0].y;
          selectedIds.forEach(id => {
              const start = startElementProps.current.get(id);
              if (start) {
                  let newX = start.x + dx;
                  let newY = start.y + dy;
                  if (snapToGrid) {
                      newX = Math.round(newX / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
                      newY = Math.round(newY / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
                  }
                  // Pass true to skip history on every pixel move
                  onUpdateElement(id, { x: newX, y: newY }, true);
              }
          });
      } else if (interactionMode === 'RESIZE_ELEMENT' && selectedIds.length === 1) {
          const id = selectedIds[0];
          const start = startElementProps.current.get(id);
          const el = elements.find(e => e.id === id);

          if (start && el) {
             const dx = pt.x - start.x;
             const dy = pt.y - start.y;
             
             // Check if we should constrain proportions
             const shouldConstrain = el.type === 'image' && (el as ImageElement).constrainProportions !== false;

             if (shouldConstrain) {
                 // Proportional scaling based on diagonal distance (center scaling)
                 const distOriginal = Math.sqrt(((startTouches.current[0].x - start.x)**2) + ((startTouches.current[0].y - start.y)**2));
                 const distNew = Math.sqrt(dx*dx + dy*dy);
                 const scale = distNew / distOriginal;
                 
                 const newWidth = (start.width || 100) * scale;
                 const newHeight = (start.height || 100) * scale;
                 onUpdateElement(id, { width: newWidth, height: newHeight }, true);

             } else if (el.type === 'text') {
                 // Text only scales width
                 const distOriginal = Math.sqrt(((startTouches.current[0].x - start.x)**2) + ((startTouches.current[0].y - start.y)**2));
                 const distNew = Math.sqrt(((pt.x - start.x)**2) + ((pt.y - start.y)**2));
                 const scale = distNew / distOriginal;
                 onUpdateElement(id, { width: (start.width || 100) * scale }, true);

             } else {
                 // Non-proportional (Free form) scaling
                 // Project mouse vector onto local element axes
                 const rad = -start.rotation * Math.PI / 180;
                 const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
                 const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
                 
                 // Absolute distance from center x 2 gives new dimensions
                 const newWidth = Math.abs(localX) * 2;
                 const newHeight = Math.abs(localY) * 2;
                 onUpdateElement(id, { width: Math.max(10, newWidth), height: Math.max(10, newHeight) }, true);
             }
          }
      } else if (interactionMode === 'ROTATE_ELEMENT' && selectedIds.length === 1) {
          const id = selectedIds[0];
          const el = elements.find(e => e.id === id);
          if (el) {
               const angle = getAngle(el.x, el.y, pt.x, pt.y);
               let newRot = angle - initialRotationAngle.current;
               if (snapToGrid) {
                   const rem = newRot % SNAP_ROTATION_STEP;
                   if (Math.abs(rem) < 5) newRot = Math.round(newRot / SNAP_ROTATION_STEP) * SNAP_ROTATION_STEP;
               }
               onUpdateElement(id, { rotation: newRot }, true);
          }
      } else if (interactionMode === 'PAN_ZOOM_CANVAS') {
           if (touches.length === 2) {
               const dist = getDistance(touches[0], touches[1]);
               const scale = Math.max(0.1, Math.min(3, startViewTransform.current.scale * (dist / startTouches.current[0].d)));
               const midX = (touches[0].clientX + touches[1].clientX)/2;
               const midY = (touches[0].clientY + touches[1].clientY)/2;
               const dx = midX - startTouches.current[0].x;
               const dy = midY - startTouches.current[0].y;
               setViewTransform({ scale, x: startViewTransform.current.x + dx, y: startViewTransform.current.y + dy });
           } else {
               const dx = touches[0].clientX - startTouches.current[0].x;
               const dy = touches[0].clientY - startTouches.current[0].y;
               setViewTransform({ ...viewTransform, x: startViewTransform.current.x + dx, y: startViewTransform.current.y + dy });
           }
      }
  };

  const handlePointerUp = () => {
      if (interactionMode === 'MAYBE_DRAG') {
          if (maybeDragTarget.current) onSelect(maybeDragTarget.current, false);
          else onSelect(null);
      }

      if (interactionMode === 'PAN_ZOOM_CANVAS') {
           const dist = Math.sqrt(
               Math.pow(viewTransform.x - startViewTransform.current.x, 2) +
               Math.pow(viewTransform.y - startViewTransform.current.y, 2)
           );
           // If moved less than 3 pixels, treat as click on canvas -> Deselect
           if (dist < 3) {
               onSelect(null);
           }
      }

      setInteractionMode('IDLE');
      maybeDragTarget.current = null;
  };

  const editingElement = elements.find(el => el.id === editingId) as TextElement | undefined;

  return (
    <div data-help="canvas-area" className="flex-1 bg-gray-900 overflow-hidden relative touch-none" ref={containerRef}>
      <div 
        className="absolute origin-top-left shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-white transition-transform duration-75 ease-out"
        style={{
            transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
            width: width,
            height: height,
            cursor: interactionMode === 'PAN_ZOOM_CANVAS' ? 'grabbing' : 'default',
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <canvas ref={canvasRef} width={width} height={height} className="w-full h-full block" />
        {editingElement && (
            <div style={{ position: 'absolute', left: editingElement.x, top: editingElement.y, transform: `translate(-50%, -50%) rotate(${editingElement.rotation}deg)`, width: editingElement.width }}>
                <div className="relative">
                    {/* Ghost div for auto-height calculation */}
                    <div 
                        style={{ 
                            width: '100%', 
                            visibility: 'hidden', 
                            whiteSpace: 'pre-wrap', 
                            wordBreak: 'break-word',
                            padding: editingElement.padding, 
                            fontFamily: editingElement.fontFamily, 
                            fontSize: `${editingElement.fontSize}px`, 
                            fontWeight: editingElement.fontWeight, 
                            lineHeight: editingElement.lineHeight,
                            minHeight: editingElement.fontSize * 1.5
                        }}
                    >
                        {editingElement.text + '\n'}
                    </div>
                    <textarea
                        autoFocus
                        value={editingElement.text}
                        onChange={(e) => onUpdateElement(editingElement.id, { text: e.target.value })}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        style={{ 
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%', 
                            height: '100%', 
                            resize: 'none', 
                            background: 'transparent', 
                            border: '1px dashed #6366f1', 
                            outline: 'none', 
                            padding: editingElement.padding, 
                            fontFamily: editingElement.fontFamily, 
                            fontSize: `${editingElement.fontSize}px`, 
                            fontWeight: editingElement.fontWeight, 
                            color: editingElement.color, 
                            textAlign: editingElement.textAlign, 
                            lineHeight: editingElement.lineHeight, 
                            overflow: 'hidden', 
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}
                    />
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

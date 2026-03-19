import React, { useState, useRef, useEffect, RefObject } from 'react';

interface PhysicsProps {
    position: { x: number, y: number };
    onMove: (x: number, y: number) => void;
    isLiveConnected: boolean;
    onScan: (helpKey: string, title: string, text: string) => void;
    ballRef: RefObject<HTMLDivElement | null>;
    tailRef: RefObject<HTMLDivElement | null>;
    HELP_TEXTS: Record<string, { title: string, text: string }>;
    onClick?: () => void;
}

export const useBubblePhysics = ({
    position,
    onMove,
    isLiveConnected,
    onScan,
    ballRef,
    tailRef,
    HELP_TEXTS,
    onClick
}: PhysicsProps) => {
    const isDraggingBall = useRef(false);
    const isDraggingTail = useRef(false);
    
    // Tracking drag start
    const dragStartMouse = useRef({ x: 0, y: 0 }); 
    const dragStartBallPos = useRef({ x: 0, y: 0 });
    const dragStartTailOffset = useRef({ x: 0, y: 0 });

    // The vector from Ball Center to Tail Center
    // We initialize it to the bottom-right
    const tailOffset = useRef({ x: 170, y: 170 });
    
    // For calculating velocity/direction
    const lastBallPos = useRef({ x: position.x, y: position.y });

    const [isDragging, setIsDragging] = useState(false);

    // Physics Constants
    const TAIL_WIDTH = 256;
    const TAIL_HEIGHT = 256;
    const BALL_SIZE = 56; // Updated to match new smaller ball size
    const PADDING = 12;
    const CLICK_THRESHOLD = 10;
    
    // The "ideal" distance we want to keep between ball and tail center
    const PREFERRED_DIST = 240;

    // --- CORE LOGIC: Update DOM based on state ---
    const updateVisuals = (ballX: number, ballY: number, currentOffset: {x: number, y: number}) => {
        // 1. Position Ball
        if (ballRef.current) {
            // Add transition if not dragging
            ballRef.current.style.transition = isDraggingBall.current ? 'none' : 'all 1s cubic-bezier(0.23, 1, 0.32, 1)';
            ballRef.current.style.left = `${ballX}px`;
            ballRef.current.style.top = `${ballY}px`;
        }

        // 2. Position Tail
        if (tailRef.current) {
            // Add transition if not dragging
            tailRef.current.style.transition = (isDraggingBall.current || isDraggingTail.current) ? 'none' : 'all 1s cubic-bezier(0.23, 1, 0.32, 1)';
            // Calculate absolute target position for tail center
            let tailCenterX = ballX + (BALL_SIZE/2) + currentOffset.x;
            let tailCenterY = ballY + (BALL_SIZE/2) + currentOffset.y;

            // 3. Screen Clamping (Hard constraints)
            // Ensure the entire box is visible
            const minX = (TAIL_WIDTH/2) + PADDING;
            const maxX = window.innerWidth - (TAIL_WIDTH/2) - PADDING;
            const minY = (TAIL_HEIGHT/2) + PADDING;
            const maxY = window.innerHeight - (TAIL_HEIGHT/2) - PADDING;

            tailCenterX = Math.max(minX, Math.min(tailCenterX, maxX));
            tailCenterY = Math.max(minY, Math.min(tailCenterY, maxY));

            tailRef.current.style.left = `${tailCenterX}px`;
            tailRef.current.style.top = `${tailCenterY}px`;
            
            // Note: We intentionally DO NOT write back the clamped value to `tailOffset`.
            // This creates a "sliding against the wall" feel where the physics 
            // remembers where it *wants* to be, but the wall stops it.
        }
    };

    // --- BALL DRAG ---

    const handleBallPointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

        isDraggingBall.current = true;
        dragStartMouse.current = { x: e.clientX, y: e.clientY };
        dragStartBallPos.current = position;
        lastBallPos.current = position;
        
        setIsDragging(true);

        if (ballRef.current) ballRef.current.style.transform = 'scale(0.90)';
        // Enable smooth follow for the tail while dragging the ball
        if (tailRef.current) tailRef.current.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'; 
    };

    const handleBallPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingBall.current) return;
        e.preventDefault();

        const dx = e.clientX - dragStartMouse.current.x;
        const dy = e.clientY - dragStartMouse.current.y;

        let newBallX = dragStartBallPos.current.x + dx;
        let newBallY = dragStartBallPos.current.y + dy;

        // Clamp ball strictly to screen
        newBallX = Math.max(0, Math.min(newBallX, window.innerWidth - BALL_SIZE));
        newBallY = Math.max(0, Math.min(newBallY, window.innerHeight - BALL_SIZE));

        // --- DYNAMIC TAIL PHYSICS (The "Wind" Effect) ---
        // Calculate movement delta since last frame
        const moveX = newBallX - lastBallPos.current.x;
        const moveY = newBallY - lastBallPos.current.y;

        // If moving significantly, push tail to opposite side
        if (Math.abs(moveX) > 2 || Math.abs(moveY) > 2) {
            // Target angle is opposite to movement
            const angle = Math.atan2(-moveY, -moveX);
            
            // Calculate a target offset based on that angle
            const targetOffsetX = Math.cos(angle) * PREFERRED_DIST;
            const targetOffsetY = Math.sin(angle) * PREFERRED_DIST;

            // Lerp current offset towards target (Smooth transition)
            // Factor 0.1 gives a nice delayed "swing" effect
            tailOffset.current.x += (targetOffsetX - tailOffset.current.x) * 0.1;
            tailOffset.current.y += (targetOffsetY - tailOffset.current.y) * 0.1;
        }

        lastBallPos.current = { x: newBallX, y: newBallY };
        updateVisuals(newBallX, newBallY, tailOffset.current);
    };

    const handleBallPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingBall.current) return;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        
        isDraggingBall.current = false;
        setIsDragging(false);
        if (ballRef.current) ballRef.current.style.transform = '';

        // Save final position
        const finalBallX = parseFloat(ballRef.current?.style.left || '0');
        const finalBallY = parseFloat(ballRef.current?.style.top || '0');
        onMove(finalBallX, finalBallY);

        const dist = Math.hypot(e.clientX - dragStartMouse.current.x, e.clientY - dragStartMouse.current.y);
        
        if (dist < CLICK_THRESHOLD && onClick) {
            onClick();
        } else {
            // Scanning Logic
            if (ballRef.current) ballRef.current.style.visibility = 'hidden';
            if (tailRef.current) tailRef.current.style.visibility = 'hidden';
            const elem = document.elementFromPoint(e.clientX, e.clientY);
            if (ballRef.current) ballRef.current.style.visibility = 'visible';
            if (tailRef.current) tailRef.current.style.visibility = 'visible';

            const helpTarget = elem?.closest('[data-help]');
            if (helpTarget) {
                const key = helpTarget.getAttribute('data-help');
                if (key && HELP_TEXTS[key]) {
                    onScan(key, HELP_TEXTS[key].title, HELP_TEXTS[key].text);
                }
            }
        }
    };

    // --- TAIL DRAG (Manual adjustment) ---

    const handleTailPointerDown = (e: React.PointerEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('input') || target.closest('button')) return;

        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        
        isDraggingTail.current = true;
        dragStartMouse.current = { x: e.clientX, y: e.clientY };
        dragStartTailOffset.current = { ...tailOffset.current };
        setIsDragging(true);
        if (tailRef.current) tailRef.current.style.transition = 'none';
    };

    const handleTailPointerMove = (e: React.PointerEvent) => {
        if (!isDraggingTail.current) return;
        e.preventDefault();

        const dx = e.clientX - dragStartMouse.current.x;
        const dy = e.clientY - dragStartMouse.current.y;

        // Apply drag to the offset directly
        tailOffset.current = {
            x: dragStartTailOffset.current.x + dx,
            y: dragStartTailOffset.current.y + dy
        };

        updateVisuals(position.x, position.y, tailOffset.current);
    };

    const handleTailPointerUp = (e: React.PointerEvent) => {
        if (!isDraggingTail.current) return;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        isDraggingTail.current = false;
        setIsDragging(false);
        if (tailRef.current) tailRef.current.style.transition = 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        
        // Ensure connection stays valid after drag (pull towards ball if too far)
        const currentLen = Math.hypot(tailOffset.current.x, tailOffset.current.y);
        if (currentLen > PREFERRED_DIST * 1.5) {
             const scale = (PREFERRED_DIST * 1.5) / currentLen;
             tailOffset.current.x *= scale;
             tailOffset.current.y *= scale;
             updateVisuals(position.x, position.y, tailOffset.current);
        }
    };

    // Sync on mount/update
    useEffect(() => {
        if (!isDraggingBall.current && !isDraggingTail.current) {
            updateVisuals(position.x, position.y, tailOffset.current);
        }
    }, [position]);

    return {
        isDragging,
        handleBallPointerDown,
        handleBallPointerMove,
        handleBallPointerUp,
        handleTailPointerDown,
        handleTailPointerMove,
        handleTailPointerUp,
        tailOffset: tailOffset.current
    };
};
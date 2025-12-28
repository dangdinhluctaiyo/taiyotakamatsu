import React, { useState, useRef } from 'react';
import { haptic } from '../hooks/useHaptic';

interface SwipeableCardProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    leftAction?: React.ReactNode;
    rightAction?: React.ReactNode;
    leftColor?: string;
    rightColor?: string;
    threshold?: number;
    className?: string;
}

/**
 * SwipeableCard - A card that can be swiped left or right to reveal actions
 */
export const SwipeableCard: React.FC<SwipeableCardProps> = ({
    children,
    onSwipeLeft,
    onSwipeRight,
    leftAction,
    rightAction,
    leftColor = 'bg-red-500',
    rightColor = 'bg-green-500',
    threshold = 80,
    className = ''
}) => {
    const [translateX, setTranslateX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);
    const currentX = useRef(0);
    const cardRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        currentX.current = startX.current;
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;

        currentX.current = e.touches[0].clientX;
        const diff = currentX.current - startX.current;

        // Apply resistance at edges
        const resistance = 0.4;
        let newTranslate = diff * resistance;

        // Limit max translate
        const maxTranslate = 120;
        newTranslate = Math.max(-maxTranslate, Math.min(maxTranslate, newTranslate));

        // Only allow swipe in directions with actions
        if (diff > 0 && !onSwipeRight) return;
        if (diff < 0 && !onSwipeLeft) return;

        setTranslateX(newTranslate);
    };

    const handleTouchEnd = () => {
        setIsDragging(false);

        if (Math.abs(translateX) >= threshold) {
            // Trigger action
            haptic('medium');

            if (translateX > 0 && onSwipeRight) {
                // Animate out then reset
                setTranslateX(150);
                setTimeout(() => {
                    onSwipeRight();
                    setTranslateX(0);
                }, 200);
            } else if (translateX < 0 && onSwipeLeft) {
                setTranslateX(-150);
                setTimeout(() => {
                    onSwipeLeft();
                    setTranslateX(0);
                }, 200);
            }
        } else {
            // Snap back
            setTranslateX(0);
        }
    };

    // Calculate action visibility
    const leftActionOpacity = Math.min(translateX / threshold, 1);
    const rightActionOpacity = Math.min(-translateX / threshold, 1);

    return (
        <div className={`relative overflow-hidden rounded-2xl ${className}`}>
            {/* Left action (swipe right to reveal) */}
            {onSwipeRight && (
                <div
                    className={`absolute inset-y-0 left-0 ${rightColor} flex items-center justify-start px-4 transition-opacity`}
                    style={{
                        opacity: leftActionOpacity,
                        width: Math.abs(translateX) + 20
                    }}
                >
                    {rightAction}
                </div>
            )}

            {/* Right action (swipe left to reveal) */}
            {onSwipeLeft && (
                <div
                    className={`absolute inset-y-0 right-0 ${leftColor} flex items-center justify-end px-4 transition-opacity`}
                    style={{
                        opacity: rightActionOpacity,
                        width: Math.abs(translateX) + 20
                    }}
                >
                    {leftAction}
                </div>
            )}

            {/* Main card content */}
            <div
                ref={cardRef}
                className={`relative bg-white transition-transform ${isDragging ? '' : 'duration-200'}`}
                style={{ transform: `translateX(${translateX}px)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    );
};

export default SwipeableCard;

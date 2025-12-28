import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { haptic } from '../hooks/useHaptic';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    height?: 'auto' | 'half' | 'full';
    showHandle?: boolean;
    showCloseButton?: boolean;
}

/**
 * BottomSheet - iOS/Android style bottom sheet modal
 * Supports drag to dismiss gesture
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
    isOpen,
    onClose,
    title,
    children,
    height = 'auto',
    showHandle = true,
    showCloseButton = true
}) => {
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const sheetRef = useRef<HTMLDivElement>(null);

    // Reset translate when opening
    useEffect(() => {
        if (isOpen) {
            setTranslateY(0);
            haptic('light');
        }
    }, [isOpen]);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handleTouchStart = (e: React.TouchEvent) => {
        startY.current = e.touches[0].clientY;
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;

        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        // Only allow dragging down
        if (diff > 0) {
            setTranslateY(diff);
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);

        const threshold = 100;
        if (translateY > threshold) {
            // Close with animation
            haptic('light');
            setTranslateY(window.innerHeight);
            setTimeout(onClose, 200);
        } else {
            // Snap back
            setTranslateY(0);
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            haptic('light');
            onClose();
        }
    };

    const getHeightClass = () => {
        switch (height) {
            case 'half': return 'max-h-[50vh]';
            case 'full': return 'max-h-[90vh]';
            default: return 'max-h-[85vh]';
        }
    };

    if (!isOpen) return null;

    const content = (
        <div
            className={`fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-200 ${translateY > 100 ? 'bg-black/0' : 'bg-black/50'
                }`}
            onClick={handleBackdropClick}
        >
            <div
                ref={sheetRef}
                className={`w-full bg-white rounded-t-3xl shadow-2xl transition-transform ${isDragging ? '' : 'duration-200'
                    } ${getHeightClass()} flex flex-col`}
                style={{
                    transform: `translateY(${translateY}px)`,
                    paddingBottom: 'env(safe-area-inset-bottom)'
                }}
            >
                {/* Drag handle */}
                {showHandle && (
                    <div
                        className="py-3 cursor-grab active:cursor-grabbing flex-shrink-0"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto" />
                    </div>
                )}

                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="px-4 pb-3 flex items-center justify-between flex-shrink-0 border-b">
                        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                        {showCloseButton && (
                            <button
                                onClick={() => { haptic('light'); onClose(); }}
                                className="p-2 rounded-full hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        )}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};

export default BottomSheet;

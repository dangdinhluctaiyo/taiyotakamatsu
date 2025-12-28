import React, { useState, useRef, useCallback, useEffect } from 'react';

interface UsePullToRefreshOptions {
    onRefresh: () => Promise<void>;
    threshold?: number; // pixels to pull before triggering
    resistance?: number; // how hard to pull (higher = harder)
}

interface UsePullToRefreshReturn {
    pullDistance: number;
    isRefreshing: boolean;
    isPulling: boolean;
    handlers: {
        onTouchStart: (e: React.TouchEvent) => void;
        onTouchMove: (e: React.TouchEvent) => void;
        onTouchEnd: () => void;
    };
}

export const usePullToRefresh = ({
    onRefresh,
    threshold = 80,
    resistance = 2.5
}: UsePullToRefreshOptions): UsePullToRefreshReturn => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isPulling, setIsPulling] = useState(false);

    const startY = useRef(0);
    const currentY = useRef(0);
    const scrollableRef = useRef<Element | null>(null);

    // Find the nearest scrollable parent
    const findScrollableParent = (element: Element | null): Element | null => {
        if (!element) return null;
        if (element.scrollTop > 0) return element;
        if (element === document.body || element === document.documentElement) return element;
        return findScrollableParent(element.parentElement);
    };

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        if (isRefreshing) return;

        const target = e.target as Element;
        scrollableRef.current = findScrollableParent(target);

        // Only enable pull-to-refresh when scrolled to top
        const scrollTop = scrollableRef.current?.scrollTop ?? 0;
        if (scrollTop > 5) return;

        startY.current = e.touches[0].clientY;
        setIsPulling(true);
    }, [isRefreshing]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling || isRefreshing) return;

        currentY.current = e.touches[0].clientY;
        const diff = currentY.current - startY.current;

        if (diff > 0) {
            // Apply resistance to make it harder to pull
            const distance = Math.min(diff / resistance, threshold * 1.5);
            setPullDistance(distance);
        }
    }, [isPulling, isRefreshing, resistance, threshold]);

    const onTouchEnd = useCallback(async () => {
        if (!isPulling) return;

        setIsPulling(false);

        if (pullDistance >= threshold && !isRefreshing) {
            setIsRefreshing(true);
            setPullDistance(threshold); // Hold at threshold during refresh

            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
    }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

    return {
        pullDistance,
        isRefreshing,
        isPulling,
        handlers: {
            onTouchStart,
            onTouchMove,
            onTouchEnd
        }
    };
};

// Pull-to-refresh indicator component
interface PullIndicatorProps {
    pullDistance: number;
    isRefreshing: boolean;
    threshold?: number;
}

export const PullIndicator: React.FC<PullIndicatorProps> = ({
    pullDistance,
    isRefreshing,
    threshold = 80
}) => {
    if (pullDistance === 0 && !isRefreshing) return null;

    const progress = Math.min(pullDistance / threshold, 1);
    const rotation = isRefreshing ? 0 : progress * 180;

    return (
        <div
            className="flex justify-center items-center overflow-hidden transition-all duration-200"
            style={{ height: pullDistance }}
        >
            <div
                className={`w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent ${isRefreshing ? 'animate-spin' : ''}`}
                style={{
                    transform: `rotate(${rotation}deg)`,
                    opacity: progress
                }}
            />
        </div>
    );
};

export default usePullToRefresh;

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions<T> {
    items: T[];
    pageSize?: number;
    threshold?: number; // px from bottom to trigger load more
}

interface UseInfiniteScrollReturn<T> {
    visibleItems: T[];
    hasMore: boolean;
    loadMore: () => void;
    reset: () => void;
    containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * useInfiniteScroll hook - implements infinite scroll with auto-load
 * Shows items in batches, loads more when scrolling near bottom
 */
export function useInfiniteScroll<T>({
    items,
    pageSize = 20,
    threshold = 200
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
    const [displayCount, setDisplayCount] = useState(pageSize);
    const containerRef = useRef<HTMLDivElement>(null);

    const visibleItems = items.slice(0, displayCount);
    const hasMore = displayCount < items.length;

    const loadMore = useCallback(() => {
        if (hasMore) {
            setDisplayCount(prev => Math.min(prev + pageSize, items.length));
        }
    }, [hasMore, pageSize, items.length]);

    const reset = useCallback(() => {
        setDisplayCount(pageSize);
    }, [pageSize]);

    // Reset when items change significantly
    useEffect(() => {
        setDisplayCount(pageSize);
    }, [items.length, pageSize]);

    // Auto-load when scrolling near bottom
    useEffect(() => {
        const handleScroll = () => {
            if (!containerRef.current || !hasMore) return;

            const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

            if (scrollHeight - scrollTop - clientHeight < threshold) {
                loadMore();
            }
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [hasMore, threshold, loadMore]);

    // Also check window scroll for non-scrollable containers
    useEffect(() => {
        const handleWindowScroll = () => {
            if (!hasMore) return;

            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight;
            const clientHeight = window.innerHeight;

            if (scrollHeight - scrollTop - clientHeight < threshold) {
                loadMore();
            }
        };

        window.addEventListener('scroll', handleWindowScroll);
        return () => window.removeEventListener('scroll', handleWindowScroll);
    }, [hasMore, threshold, loadMore]);

    return {
        visibleItems,
        hasMore,
        loadMore,
        reset,
        containerRef
    };
}

export default useInfiniteScroll;

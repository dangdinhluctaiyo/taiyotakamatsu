import React from 'react';

// Skeleton base component with shimmer animation
const SkeletonBase: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] ${className}`} />
);

// Skeleton for product cards in grid view
export const SkeletonProductCard: React.FC = () => (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border">
        {/* Image placeholder */}
        <SkeletonBase className="h-28 w-full" />

        {/* Content */}
        <div className="p-2.5 space-y-2">
            {/* Title */}
            <SkeletonBase className="h-4 w-3/4 rounded" />
            {/* Category */}
            <SkeletonBase className="h-3 w-1/2 rounded" />

            {/* Stock badge */}
            <div className="flex gap-2 mt-2">
                <SkeletonBase className="h-5 w-12 rounded-full" />
            </div>

            {/* Stock bar */}
            <SkeletonBase className="h-1 w-full rounded-full mt-2" />

            {/* Actions */}
            <div className="flex justify-end gap-1 pt-2 mt-2 border-t">
                <SkeletonBase className="w-7 h-7 rounded-lg" />
                <SkeletonBase className="w-7 h-7 rounded-lg" />
                <SkeletonBase className="w-7 h-7 rounded-lg" />
            </div>
        </div>
    </div>
);

// Skeleton for order cards
export const SkeletonOrderCard: React.FC = () => (
    <div className="bg-white rounded-2xl shadow-sm p-4 border">
        <div className="flex items-start gap-3">
            {/* Avatar */}
            <SkeletonBase className="w-12 h-12 rounded-xl shrink-0" />

            {/* Content */}
            <div className="flex-1 space-y-2">
                <SkeletonBase className="h-5 w-1/2 rounded" />
                <SkeletonBase className="h-4 w-3/4 rounded" />
                <div className="flex gap-2">
                    <SkeletonBase className="h-6 w-16 rounded-lg" />
                    <SkeletonBase className="h-6 w-20 rounded-lg" />
                </div>
            </div>

            {/* Status */}
            <SkeletonBase className="w-20 h-6 rounded-full" />
        </div>
    </div>
);

// Skeleton for task cards in warehouse dashboard
export const SkeletonTaskCard: React.FC = () => (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Urgency bar */}
        <SkeletonBase className="h-1 w-full" />

        <div className="p-4">
            <div className="flex items-start gap-3">
                {/* Icon */}
                <SkeletonBase className="w-12 h-12 rounded-xl shrink-0" />

                {/* Content */}
                <div className="flex-1 space-y-2">
                    <SkeletonBase className="h-5 w-2/3 rounded" />
                    <SkeletonBase className="h-3 w-1/3 rounded" />
                    <div className="flex gap-2 mt-2">
                        <SkeletonBase className="h-6 w-16 rounded-lg" />
                        <SkeletonBase className="h-6 w-24 rounded-lg" />
                    </div>
                </div>

                {/* Quantity */}
                <SkeletonBase className="w-12 h-8 rounded" />
            </div>

            {/* Action button */}
            <SkeletonBase className="h-12 w-full rounded-xl mt-4" />
        </div>
    </div>
);

// Skeleton for history log items
export const SkeletonLogItem: React.FC = () => (
    <div className="p-3 border-b flex items-center gap-3">
        <SkeletonBase className="w-8 h-8 rounded-lg shrink-0" />
        <div className="flex-1 space-y-1">
            <SkeletonBase className="h-4 w-1/3 rounded" />
            <SkeletonBase className="h-3 w-1/4 rounded" />
        </div>
        <SkeletonBase className="w-12 h-6 rounded" />
    </div>
);

// Grid of skeleton product cards
export const SkeletonProductGrid: React.FC<{ count?: number }> = ({ count = 8 }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonProductCard key={i} />
        ))}
    </div>
);

// List of skeleton task cards
export const SkeletonTaskList: React.FC<{ count?: number }> = ({ count = 3 }) => (
    <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonTaskCard key={i} />
        ))}
    </div>
);

export default {
    SkeletonProductCard,
    SkeletonOrderCard,
    SkeletonTaskCard,
    SkeletonLogItem,
    SkeletonProductGrid,
    SkeletonTaskList
};

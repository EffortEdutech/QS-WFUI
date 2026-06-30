'use client';

/**
 * ResourceHistoryPanel — Phase 11
 *
 * Standalone panel showing state-transition history for any resource.
 * Wraps the existing StateHistoryTimeline with a card shell + refresh
 * control so it can be dropped into any page outside the canvas.
 *
 * Usage:
 *   <ResourceHistoryPanel resourceId="abc-123" orgId="org-456" />
 */

import { useState, useCallback } from 'react';
import { StateHistoryTimeline } from '@/components/resource/StateHistoryTimeline';

interface Props {
  resourceId:    string;
  orgId:         string;
  resourceName?: string;
  className?:    string;
}

export function ResourceHistoryPanel({
  resourceId,
  orgId,
  resourceName,
  className = '',
}: Props) {
  // key increment forces StateHistoryTimeline to remount + re-fetch
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Resource History</h3>
          {resourceName && (
            <p className="text-xs text-gray-400 mt-0.5">{resourceName}</p>
          )}
        </div>
        <button
          onClick={refresh}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Refresh
        </button>
      </div>

      {/* Timeline */}
      <div className="p-4">
        <StateHistoryTimeline
          key={refreshKey}
          resourceId={resourceId}
          orgId={orgId}
        />
      </div>
    </div>
  );
}

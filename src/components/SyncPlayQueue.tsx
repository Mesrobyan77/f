import { useState } from "react";
import type { SyncQueueItem } from "../types";

interface SyncPlayQueueProps {
  queue: SyncQueueItem[];
  onAdd: (url: string) => void;
  onRemove: (queueId: string) => void;
  onNext: () => void;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function SyncPlayQueue({ queue, onAdd, onRemove, onNext }: SyncPlayQueueProps) {
  const [url, setUrl] = useState("");

  const handleAdd = () => {
    const trimmed = url.trim();
    if (!trimmed || !extractYouTubeId(trimmed)) return;
    onAdd(trimmed);
    setUrl("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="YouTube URL..."
            className="flex-1 bg-gray-800 text-gray-200 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={!url.trim() || !extractYouTubeId(url.trim())}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {queue.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            No videos in queue
          </div>
        ) : (
          queue.map((item, i) => (
            <div key={item._id} className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg">
              <img
                src={`https://img.youtube.com/vi/${item.videoId}/default.jpg`}
                alt=""
                className="w-16 h-12 rounded object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{item.title || `Video ${i + 1}`}</p>
                <p className="text-[10px] text-gray-500 truncate">{item.url}</p>
              </div>
              <button
                onClick={() => onRemove(item._id)}
                className="text-gray-500 hover:text-red-400 p-1 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {queue.length > 0 && (
        <div className="p-3 border-t border-gray-700">
          <button
            onClick={onNext}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
          >
            Skip to Next
          </button>
        </div>
      )}
    </div>
  );
}

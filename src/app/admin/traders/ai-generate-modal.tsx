'use client';

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

interface AiGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart?: (count: number) => void;
}

export default function AiGenerateModal({ isOpen, onClose, onStart }: AiGenerateModalProps) {
  const [count, setCount] = useState(1);

  if (!isOpen) return null;

  const handleGenerate = () => {
    // Close modal immediately and start generation in background
    handleClose();

    // Start generation without waiting - fire and forget
    fetch('/api/traders/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Generation failed:', errorData.error);
          // Could show a toast notification here
        } else {
          console.log('Generation started successfully');
          // Trigger refresh callback
          if (onStart) {
            onStart(count);
          }
        }
      })
      .catch((error) => {
        console.error('Error starting generation:', error);
        // Could show a toast notification here
      });
  };

  const handleClose = () => {
    setCount(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-lg rounded-xl p-6"
        style={{ backgroundColor: '#2D2D2D' }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-700 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 p-2">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI-Generated Traders</h2>
            </div>
          </div>
        </div>

        {/* Select count */}
        <div className="space-y-6">
          <div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 10].map((num) => (
                <button
                  key={num}
                  onClick={() => setCount(num)}
                  className={`rounded-lg py-4 text-lg font-semibold transition-all ${
                    count === num
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              onClick={handleClose}
              className="rounded-lg px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-2.5 text-sm text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/30"
            >
              <Sparkles className="h-4 w-4" />
              Generate {count} Trader{count > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

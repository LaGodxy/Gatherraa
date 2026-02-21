import React from 'react';

interface VoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVote: (vote: 'for' | 'against') => void;
  proposalTitle: string;
}

const VoteModal: React.FC<VoteModalProps> = ({ isOpen, onClose, onVote, proposalTitle }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Vote on Proposal</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{proposalTitle}</p>
        <div className="flex space-x-4">
          <button
            onClick={() => {
              onVote('for');
              onClose();
            }}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Vote For
          </button>
          <button
            onClick={() => {
              onVote('against');
              onClose();
            }}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Vote Against
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default VoteModal;
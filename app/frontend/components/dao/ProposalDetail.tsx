import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import VoteProgress from './VoteProgress';
import VotingCountdown from './VotingCountdown';
import VoteModal from './VoteModal';
import { Proposal } from '@/types/proposal';
import { voteOnProposal } from '@/lib/api/dao';

interface ProposalDetailProps {
  proposal: Proposal;
}

const ProposalDetail: React.FC<ProposalDetailProps> = ({ proposal: initialProposal }) => {
  const [proposal, setProposal] = useState(initialProposal);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (vote: 'for' | 'against') => {
    setIsVoting(true);
    // Optimistic update
    setProposal(prev => ({
      ...prev,
      votesFor: vote === 'for' ? prev.votesFor + 1 : prev.votesFor,
      votesAgainst: vote === 'against' ? prev.votesAgainst + 1 : prev.votesAgainst,
    }));

    try {
      await voteOnProposal(proposal.id, vote);
      // In real app, refetch or update from server
    } catch (error) {
      // Revert on error
      setProposal(prev => ({
        ...prev,
        votesFor: vote === 'for' ? prev.votesFor - 1 : prev.votesFor,
        votesAgainst: vote === 'against' ? prev.votesAgainst - 1 : prev.votesAgainst,
      }));
      console.error('Voting failed', error);
    } finally {
      setIsVoting(false);
    }
  };

  const isVotingActive = proposal.status === 'Active' && new Date() < proposal.deadline;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{proposal.title}</h1>
          <StatusBadge status={proposal.status} />
        </div>
        <p className="text-gray-700 dark:text-gray-300 mb-6">{proposal.description}</p>
        <div className="mb-6">
          <VoteProgress votesFor={proposal.votesFor} votesAgainst={proposal.votesAgainst} />
        </div>
        <div className="flex justify-between items-center mb-6">
          <VotingCountdown deadline={proposal.deadline} />
          {isVotingActive && (
            <button
              onClick={() => setIsVoteModalOpen(true)}
              disabled={isVoting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              {isVoting ? 'Voting...' : 'Vote'}
            </button>
          )}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
          Created by: {proposal.creator}
        </div>
      </div>
      <VoteModal
        isOpen={isVoteModalOpen}
        onClose={() => setIsVoteModalOpen(false)}
        onVote={handleVote}
        proposalTitle={proposal.title}
      />
    </div>
  );
};

export default ProposalDetail;
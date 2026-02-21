import React from 'react';
import Link from 'next/link';
import StatusBadge from './StatusBadge';
import VoteProgress from './VoteProgress';
import VotingCountdown from './VotingCountdown';
import { Proposal } from '@/types/proposal';

interface ProposalCardProps {
  proposal: Proposal;
}

const ProposalCard: React.FC<ProposalCardProps> = ({ proposal }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{proposal.title}</h3>
        <StatusBadge status={proposal.status} />
      </div>
      <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{proposal.description}</p>
      <VoteProgress votesFor={proposal.votesFor} votesAgainst={proposal.votesAgainst} />
      <div className="flex justify-between items-center  mt-4">
        <VotingCountdown deadline={proposal.deadline} />
        <Link href={`/dao/${proposal.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
          View Details
        </Link>
      </div>
    </div>
  );
};

export default ProposalCard;
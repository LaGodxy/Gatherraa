import React from 'react';

interface VoteProgressProps {
    votesFor: number;
    votesAgainst: number;
}

const VoteProgress: React.FC<VoteProgressProps> = ({ votesFor, votesAgainst }) => {
    const totalVotes = votesFor + votesAgainst;
    const forPercentage = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 0;
    const againstPercentage = totalVotes > 0 ? (votesAgainst / totalVotes) * 100 : 0;

    return (
        <div className="w-full">
            <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">For: {votesFor}</span>
                <span className="text-gray-600 dark:text-gray-400">Against: {votesAgainst}</span>
            </div>
            <div className="w-full space-y-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                    className="bg-green-600 h-2.5 rounded-full"
                    style={{ width: `${forPercentage}%` }}
                >
                </div>
                <div className='bg-gray-200 rounded-full dark:bg-gray-700'>
                    <div
                        className="bg-red-600 h-2.5 rounded-full"
                        style={{ width: `${againstPercentage}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};

export default VoteProgress;
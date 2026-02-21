'use client';

import React, { useEffect, useState } from 'react';
import ProposalList from '@/components/dao/ProposalList';
import { getProposals } from '@/lib/api/dao';
import { Proposal } from '@/types/proposal';
import { WalletButton } from '@/components/wallet/WalletButton';
import { WalletAddress } from '@/components/wallet/WalletAddress';
import { WrongNetworkAlert } from '@/components/wallet/WrongNetworkAlert';

const DaoPage: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProposals = async () => {
      try {
        const data = await getProposals();
        setProposals(data);
      } catch (error) {
        console.error('Failed to fetch proposals', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProposals();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading proposals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation */}
      <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Gatherraa</h1>
          <div className="flex items-center gap-3">
            <WalletAddress />
            <WalletButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Wrong Network Alert */}
        <div className="mb-6">
          <WrongNetworkAlert />
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">DAO Proposals</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Vote on governance proposals</p>
        </div>
        <ProposalList proposals={proposals} />
      </div>
    </div>
  );
};

export default DaoPage;
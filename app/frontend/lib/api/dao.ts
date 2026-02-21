import { Proposal } from '../../types/proposal';

export const mockProposals: Proposal[] = [
  {
    id: '1',
    title: 'Increase Treasury Allocation for Development',
    description: 'Proposal to allocate 20% more funds from the treasury towards software development initiatives.',
    status: 'Active',
    votesFor: 150,
    votesAgainst: 50,
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    creator: 'Alice',
  },
  {
    id: '2',
    title: 'Implement New Voting Mechanism',
    description: 'Introduce quadratic voting to ensure fairer decision-making processes.',
    status: 'Passed',
    votesFor: 200,
    votesAgainst: 30,
    deadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    creator: 'Bob',
  },
  {
    id: '3',
    title: 'Partnership with External Company',
    description: 'Form a partnership with XYZ Corp for joint marketing efforts.',
    status: 'Failed',
    votesFor: 80,
    votesAgainst: 120,
    deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    creator: 'Charlie',
  },
  {
    id: '4',
    title: 'Update Governance Rules',
    description: 'Revise the DAO constitution to include new member onboarding procedures.',
    status: 'Active',
    votesFor: 100,
    votesAgainst: 40,
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    creator: 'Diana',
  },
];

export const getProposals = (): Promise<Proposal[]> => {
  return Promise.resolve(mockProposals);
};

export const getProposal = (id: string): Promise<Proposal | null> => {
  const proposal = mockProposals.find(p => p.id === id);
  return Promise.resolve(proposal || null);
};

export const voteOnProposal = (proposalId: string, vote: 'for' | 'against'): Promise<void> => {
  // Simulate API call
  return new Promise(resolve => setTimeout(resolve, 1000));
};
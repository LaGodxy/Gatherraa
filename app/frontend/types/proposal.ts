export interface Proposal {
  id: string;
  title: string;
  description: string;
  status: 'Active' | 'Passed' | 'Failed';
  votesFor: number;
  votesAgainst: number;
  deadline: Date;
  creator: string;
}

export interface Vote {
  proposalId: string;
  vote: 'for' | 'against';
}
# Resource-Efficient Whitelist System

This system uses **Merkle Trees** to manage large-scale whitelists on Stellar Soroban with minimal on-chain storage. 

## Features
- **Scalable**: Supports millions of whitelisted users for the cost of a single 32-byte hash.
- **Dynamic**: Roots can be updated or rotated by the campaign admin.
- **Resource-Efficient**: Dramatic reduction in persistent storage fees compared to mapping-based approaches.
- **Airdrops & Refunds**: Built-in support for token distributions and reclaiming unclaimed assets.
- **Delegation**: Allow whitelisted users to delegate their claim rights to another wallet.

## Architecture

### On-Chain (Soroban)
The contract stores a `Campaign` object containing:
- `root`: The Merkle root of all (Address, Amount) pairs.
- `token`: The Stellar Asset address.
- `deadline`: After which claims are closed and admin can refund.
- `claimed`: A mapping to ensure each leaf is only claimed once.

### Off-Chain (Tree Generation)
Whitelists are processed off-chain to generate the Merkle root and individual proofs.

#### Root Calculation
1. Serialize each (Address, Amount) pair using XDR.
2. Hash the serialized data using SHA256 (this is the leaf).
3. Build the tree by hashing pairs of nodes until the root is reached.

## Comparison: Merkle vs. Mapping

| Feature | Mapping Approach | Merkle Tree Approach |
|---------|------------------|-----------------------|
| On-Chain Storage | `O(N)` | `O(1)` |
| Gas Cost (Claim) | Lower (1 map lookup) | Medium (`log N` hashes) |
| Setup Cost | Very High (N writes) | Extreme Low (1 write) |
| Scalability | Limited by Ledger size | Virtually Unlimited |
| Best For | Small whitelists (<100) | Large whitelists (>1,000) |

## Documentation on Tree Generation

To generate the tree, use the provided script in `tools/merkle_gen.js`:

```bash
node tools/merkle_gen.js --input whitelist.json
```

**Input Format (`whitelist.json`):**
```json
[
  {"address": "GA...", "amount": 100},
  {"address": "GB...", "amount": 200}
]
```

**Output:**
- `root`: To be used in `create_campaign`.
- `proofs`: Mapping of addresses to their Merkle proofs.

## Contract Functions

### Admin API
- `init(admin)`: Setup the contract.
- `create_campaign(admin, token, root, deadline, total_amount)`: Start a new campaign.
- `update_root(campaign_id, new_root)`: Batch update/fix the root.
- `refund(campaign_id)`: Reclaim unclaimed tokens after the deadline.

### User API
- `claim(campaign_id, claimant, amount, proof, recipient)`: Claim allocated tokens.
- `delegate_claim(campaign_id, delegator, delegatee)`: Delegate rights.
- `claim_as_delegate(...)`: Claim on behalf of a delegator.

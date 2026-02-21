# Escrow Contract for Gathera

A secure, professional escrow contract for event payments with automatic revenue splitting, dispute resolution, and referral tracking on the Stellar network using Soroban.

## Features

### 🏦 Multi-Token Support
- **Native XLM** support
- **Soroban-compatible tokens** (any token implementing the Soroban token interface)
- **Precision handling** with 7 decimal places support

### 💰 Revenue Splitting
- **Configurable percentages** for organizer, platform, and referral rewards
- **Automatic distribution** upon payment release
- **Basis points precision** (10,000 = 100%)
- **Default split**: 85% organizer, 10% platform, 5% referral

### ⏰ Time-Locked Escrow
- **Configurable release times** for payment protection
- **Automatic release** when time conditions are met
- **Prevents premature withdrawals**

### ⚖️ Dispute Resolution
- **Two-party dispute system** (payer/payee can raise disputes)
- **Admin resolution** with refund or release options
- **Evidence tracking** for dispute resolution
- **Status tracking** throughout the dispute process

### 🎯 Milestone Payments
- **Multi-day event support** with milestone-based payments
- **Configurable percentages** for each milestone
- **Individual milestone completion** and release
- **Flexible payment schedules**

### 🎁 Referral System
- **Referral code creation** and tracking
- **Automatic reward distribution** to referrers
- **Earnings tracking** per referral code
- **Configurable reward percentages**

### 🚨 Emergency Procedures
- **Emergency admin** with withdrawal privileges
- **Crisis fund recovery** for platform protection
- **Separation of powers** between regular and emergency admins

### 🛡️ Security Features
- **Comprehensive authorization** checks
- **Status validation** for all operations
- **Amount validation** with minimum thresholds
- **Revenue split validation** to prevent over-allocation
- **Contract pause/unpause** functionality

## Contract Structure

### Storage Types
- **Instance Storage**: Admin addresses, fee configurations, counters
- **Persistent Storage**: Escrows, disputes, milestones, referrals
- **Time-to-live (TTL)** management for efficient storage

### Key Data Structures

```rust
struct Escrow {
    id: EscrowId,
    token_type: TokenType,        // Native or SorobanToken
    amount: i128,
    payer: Address,
    payee: Address,
    status: EscrowStatus,
    release_time: u64,
    revenue_split: RevenueSplit,
    // ... other fields
}

struct RevenueSplit {
    organizer_share_bps: u32,
    platform_fee_bps: u32,
    referral_reward_bps: u32,
    organizer: Address,
    referral_code: Option<ReferralCode>,
}
```

## Usage Examples

### 1. Basic Escrow Creation

```rust
// Initialize contract
client.initialize(&admin, &emergency_admin);

// Create revenue split (85% organizer, 10% platform, 5% referral)
let revenue_split = RevenueSplit {
    organizer_share_bps: 8500,
    platform_fee_bps: 1000,
    referral_reward_bps: 500,
    organizer: organizer_address,
    referral_code: None,
};

// Create escrow
let escrow_id = client.create_escrow(
    &TokenType::SorobanToken(token_address),
    &50_000_000,  // 50 tokens
    &payer_address,
    &payee_address,
    &release_timestamp,
    &revenue_split,
    &description,
    &metadata,
    &false,  // not multi-day
    &None,   // no milestones
);
```

### 2. Funding and Releasing

```rust
// Payer funds the escrow
token_client.approve(&payer, &contract_id, &amount, &u32::MAX);
client.fund_escrow(&escrow_id);

// After release time, payee can release funds
client.release_escrow(&escrow_id);
```

### 3. Milestone Payments

```rust
// Create milestones for multi-day event
let milestones = vec![
    Milestone {
        id: 1,
        name: "Day 1".to_string(),
        amount_percentage: 4000,  // 40%
        due_date: day1_timestamp,
        status: MilestoneStatus::Pending,
        // ... other fields
    },
    Milestone {
        id: 2,
        name: "Day 2".to_string(),
        amount_percentage: 6000,  // 60%
        due_date: day2_timestamp,
        status: MilestoneStatus::Pending,
        // ... other fields
    }
];

// Create escrow with milestones
let escrow_id = client.create_escrow(/* ... with milestones */);

// Complete and release milestones
client.complete_milestone(&escrow_id, &1);
client.release_milestone(&escrow_id, &1);
```

### 4. Dispute Handling

```rust
// Raise a dispute
let dispute_id = client.raise_dispute(
    &escrow_id,
    &"Service not delivered".to_string(),
    &"ipfs://evidence_hash".to_string(),
);

// Admin resolves dispute
client.resolve_dispute(
    &dispute_id,
    &"Valid complaint, refunding".to_string(),
    &true,  // refund to payer
);
```

### 5. Referral System

```rust
// Create referral code
let referral_code = "REF123".to_string();
client.create_referral(&referral_code);

// Use referral in escrow
let revenue_split = RevenueSplit {
    // ... other fields
    referral_code: Some(referral_code),
};

// Referrer automatically receives reward when escrow completes
```

## Fee Structure

### Default Configuration
- **Platform Fee**: 10% (1000 basis points)
- **Referral Reward**: 5% (500 basis points)
- **Organizer Share**: 85% (8500 basis points)

### Custom Configuration
Admins can update fee structures:
```rust
client.update_platform_fee(&1500);    // 15%
client.update_referral_reward(&800);  // 8%
```

## Error Handling

The contract uses custom error types for clear error reporting:

```rust
enum EscrowError {
    AlreadyInitialized,
    NotAuthorized,
    EscrowNotFound,
    DisputeNotFound,
    InvalidStatus,
    AmountTooSmall,
    TimeNotReached,
    // ... more errors
}
```

## Testing

Run the comprehensive test suite:

```bash
cd contract/escrow_contract
cargo test
```

Tests cover:
- ✅ Complete escrow lifecycle
- ✅ Milestone payments
- ✅ Dispute resolution
- ✅ Referral system
- ✅ Error conditions
- ✅ Admin functions
- ✅ Pause/unpause functionality

## Deployment

### Build the contract:
```bash
cd contract/escrow_contract
cargo build --target wasm32-unknown-unknown --release
```

### Deploy to Futurenet:
```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/escrow_contract.wasm \
  --source your-account \
  --network futurenet
```

## Security Considerations

### Authorization
- All sensitive operations require proper authentication
- Admin-only functions are clearly separated
- Emergency admin has limited, specific privileges

### Validation
- Amount minimums prevent dust transactions
- Revenue split validation prevents over-allocation
- Status checks prevent invalid state transitions

### Storage Management
- Time-to-live extension for efficient storage
- Proper cleanup of completed escrows
- Event emission for off-chain monitoring

## Integration with Gathera

This escrow contract is designed to integrate seamlessly with the Gathera ecosystem:

1. **Event Factory Integration**: Link escrows to specific events
2. **Identity Verification**: Use DID from identity contract for participant verification
3. **Ticket Integration**: Connect escrow payments to ticket purchases
4. **Analytics**: Track payment patterns and dispute resolution metrics

## Future Enhancements

- [ ] Multi-signature escrow approvals
- [ ] Automated dispute resolution with oracles
- [ ] Yield-bearing escrow accounts
- [ ] Cross-chain escrow support
- [ ] Advanced milestone conditions
- [ ] Batch operations for gas efficiency

## License

MIT License - see LICENSE file for details.
use soroban_sdk::{Address, Env, String, Vec, symbol_short};
use soroban_sdk::contracttype;

// Storage keys for instance data
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Paused,
    NextEscrowId,
    PlatformFeeBps,
    ReferralRewardBps,
    OrganizerShareBps,
    EmergencyAdmin,
    TotalEscrows,
}

// Storage keys for persistent data
#[derive(Clone)]
#[contracttype]
pub enum PersistentKey {
    Escrow(EscrowId),
    EscrowByParticipant(Address, EscrowId),
    Dispute(DisputeId),
    Referral(ReferralCode),
    Milestone(EscrowId, MilestoneId),
}

// Escrow ID type
pub type EscrowId = u64;
pub type DisputeId = u64;
pub type MilestoneId = u32;
pub type ReferralCode = String;

// Token types supported
#[derive(Clone, Debug)]
#[contracttype]
pub enum TokenType {
    Native, // XLM
    SorobanToken(Address), // Contract address for Soroban tokens
}

// Escrow status
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub enum EscrowStatus {
    Created,
    Funded,
    InDispute,
    Resolved,
    Refunded,
    Completed,
    Cancelled,
}

// Dispute status
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub enum DisputeStatus {
    Open,
    InReview,
    Resolved,
    Rejected,
}

// Milestone status
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub enum MilestoneStatus {
    Pending,
    Completed,
    Released,
}

// Revenue split configuration
#[derive(Clone)]
#[contracttype]
pub struct RevenueSplit {
    pub organizer_share_bps: u32,      // Basis points (e.g., 8000 = 80%)
    pub platform_fee_bps: u32,         // Basis points (e.g., 1000 = 10%)
    pub referral_reward_bps: u32,      // Basis points (e.g., 500 = 5%)
    pub organizer: Address,            // Organizer's address
    pub referral_code: Option<ReferralCode>, // Optional referral code
}

// Escrow details
#[derive(Clone)]
#[contracttype]
pub struct Escrow {
    pub id: EscrowId,
    pub token_type: TokenType,
    pub amount: i128,
    pub payer: Address,
    pub payee: Address,
    pub status: EscrowStatus,
    pub created_at: u64,
    pub release_time: u64,             // Time when funds can be released
    pub revenue_split: RevenueSplit,
    pub description: String,
    pub metadata: String,              // JSON metadata
    pub total_milestones: u32,
    pub completed_milestones: u32,
    pub is_multi_day_event: bool,
}

// Dispute information
#[derive(Clone)]
#[contracttype]
pub struct Dispute {
    pub id: DisputeId,
    pub escrow_id: EscrowId,
    pub raiser: Address,
    pub resolver: Option<Address>,     // Admin who will resolve
    pub status: DisputeStatus,
    pub reason: String,
    pub evidence: String,              // IPFS hash or similar
    pub raised_at: u64,
    pub resolved_at: Option<u64>,
    pub resolution_notes: Option<String>,
}

// Milestone for multi-day events
#[derive(Clone)]
#[contracttype]
pub struct Milestone {
    pub id: MilestoneId,
    pub escrow_id: EscrowId,
    pub name: String,
    pub description: String,
    pub amount_percentage: u32,        // Percentage of total (basis points)
    pub due_date: u64,
    pub completed_at: Option<u64>,
    pub released_at: Option<u64>,
    pub status: MilestoneStatus,
}

// Referral tracking
#[derive(Clone)]
#[contracttype]
pub struct Referral {
    pub code: ReferralCode,
    pub creator: Address,
    pub total_earnings: i128,
    pub total_referrals: u32,
    pub created_at: u64,
    pub is_active: bool,
}

// Event types for contract events
#[derive(Clone)]
#[contracttype]
pub enum EscrowEvent {
    EscrowCreated(EscrowId),
    EscrowFunded(EscrowId),
    EscrowReleased(EscrowId),
    EscrowRefunded(EscrowId),
    DisputeRaised(EscrowId, DisputeId),
    DisputeResolved(EscrowId, DisputeId),
    MilestoneCompleted(EscrowId, MilestoneId),
    MilestoneReleased(EscrowId, MilestoneId),
    RevenueDistributed(EscrowId),
}

// Custom error types
#[derive(Debug, Clone, PartialEq)]
#[contracttype]
pub enum EscrowError {
    AlreadyInitialized,
    NotAuthorized,
    EscrowNotFound,
    DisputeNotFound,
    InvalidStatus,
    AmountTooSmall,
    TimeNotReached,
    MilestoneNotFound,
    ReferralNotFound,
    InvalidRevenueSplit,
    ContractPaused,
    EmergencyOnly,
    InvalidTokenType,
    ArithmeticError,
}

// Constants
pub const BASIS_POINTS: u32 = 10000; // 100% in basis points
pub const MIN_AMOUNT: i128 = 1_000_000; // 1 XLM minimum (in stroops)
pub const DEFAULT_PLATFORM_FEE_BPS: u32 = 1000; // 10%
pub const DEFAULT_REFERRAL_REWARD_BPS: u32 = 500; // 5%
pub const DEFAULT_ORGANIZER_SHARE_BPS: u32 = 8500; // 85%
pub const TTL_INSTANCE: u32 = 17280 * 30; // 30 days
pub const TTL_PERSISTENT: u32 = 17280 * 90; // 90 days
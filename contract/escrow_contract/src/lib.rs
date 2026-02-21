#![no_std]

#[cfg(test)]
mod test;

mod storage_types;
use storage_types::{
    DataKey, PersistentKey, Escrow, EscrowId, Dispute, DisputeId, Milestone, MilestoneId,
    Referral, ReferralCode, TokenType, EscrowStatus, DisputeStatus, MilestoneStatus,
    RevenueSplit, EscrowEvent, EscrowError, BASIS_POINTS, MIN_AMOUNT,
    DEFAULT_PLATFORM_FEE_BPS, DEFAULT_REFERRAL_REWARD_BPS, DEFAULT_ORGANIZER_SHARE_BPS,
    TTL_INSTANCE, TTL_PERSISTENT
};

use soroban_sdk::{
    contract, contractimpl, token, Address, Env, String, Vec, Symbol, panic_with_error
};

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize the escrow contract
    pub fn initialize(e: Env, admin: Address, emergency_admin: Address) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&e, EscrowError::AlreadyInitialized);
        }

        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::EmergencyAdmin, &emergency_admin);
        e.storage().instance().set(&DataKey::Paused, &false);
        e.storage().instance().set(&DataKey::NextEscrowId, &1u64);
        e.storage().instance().set(&DataKey::TotalEscrows, &0u64);
        e.storage().instance().set(&DataKey::PlatformFeeBps, &DEFAULT_PLATFORM_FEE_BPS);
        e.storage().instance().set(&DataKey::ReferralRewardBps, &DEFAULT_REFERRAL_REWARD_BPS);
        e.storage().instance().set(&DataKey::OrganizerShareBps, &DEFAULT_ORGANIZER_SHARE_BPS);
        
        extend_instance(&e);
    }

    /// Create a new escrow agreement
    pub fn create_escrow(
        e: Env,
        token_type: TokenType,
        amount: i128,
        payer: Address,
        payee: Address,
        release_time: u64,
        revenue_split: RevenueSplit,
        description: String,
        metadata: String,
        is_multi_day_event: bool,
        milestones: Option<Vec<Milestone>>,
    ) -> EscrowId {
        payer.require_auth();
        check_paused(&e);
        validate_amount(amount);
        validate_revenue_split(&revenue_split);

        let escrow_id = e.storage().instance().get(&DataKey::NextEscrowId).unwrap();
        
        // Validate referral code if provided
        if let Some(ref referral_code) = revenue_split.referral_code {
            if !e.storage().persistent().has(&PersistentKey::Referral(referral_code.clone())) {
                panic_with_error!(&e, EscrowError::ReferralNotFound);
            }
        }

        let escrow = Escrow {
            id: escrow_id,
            token_type,
            amount,
            payer: payer.clone(),
            payee: payee.clone(),
            status: EscrowStatus::Created,
            created_at: e.ledger().timestamp(),
            release_time,
            revenue_split,
            description,
            metadata,
            total_milestones: milestones.as_ref().map(|m| m.len() as u32).unwrap_or(0),
            completed_milestones: 0,
            is_multi_day_event,
        };

        // Store escrow
        e.storage().persistent().set(&PersistentKey::Escrow(escrow_id), &escrow);
        e.storage().persistent().set(&PersistentKey::EscrowByParticipant(payer.clone(), escrow_id), &true);
        e.storage().persistent().set(&PersistentKey::EscrowByParticipant(payee.clone(), escrow_id), &true);
        
        // Store milestones if provided
        if let Some(milestone_vec) = milestones {
            for milestone in milestone_vec.iter() {
                let milestone_key = PersistentKey::Milestone(escrow_id, milestone.id);
                e.storage().persistent().set(&milestone_key, &milestone);
                extend_persistent(&e, &milestone_key);
            }
        }

        // Update counters
        e.storage().instance().set(&DataKey::NextEscrowId, &(escrow_id + 1));
        let total_escrows: u64 = e.storage().instance().get(&DataKey::TotalEscrows).unwrap();
        e.storage().instance().set(&DataKey::TotalEscrows, &(total_escrows + 1));

        extend_persistent(&e, &PersistentKey::Escrow(escrow_id));
        extend_persistent(&e, &PersistentKey::EscrowByParticipant(payer, escrow_id));
        extend_persistent(&e, &PersistentKey::EscrowByParticipant(payee, escrow_id));
        extend_instance(&e);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "escrow"), Symbol::new(&e, "created")),
            (escrow_id, payer, payee, amount),
        );

        escrow_id
    }

    /// Fund an escrow agreement
    pub fn fund_escrow(e: Env, escrow_id: EscrowId) {
        let mut escrow = get_escrow(&e, escrow_id);
        escrow.payer.require_auth();
        check_paused(&e);

        if escrow.status != EscrowStatus::Created {
            panic_with_error!(&e, EscrowError::InvalidStatus);
        }

        // Transfer funds based on token type
        match &escrow.token_type {
            TokenType::Native => {
                // For native XLM, the amount should be included in the transaction
                // This requires the invoker to send the amount with the transaction
                // In practice, you'd verify the balance change
            }
            TokenType::SorobanToken(token_address) => {
                let token_client = token::Client::new(&e, token_address);
                token_client.transfer(&escrow.payer, &e.current_contract_address(), &escrow.amount);
            }
        }

        escrow.status = EscrowStatus::Funded;
        e.storage().persistent().set(&PersistentKey::Escrow(escrow_id), &escrow);
        extend_persistent(&e, &PersistentKey::Escrow(escrow_id));

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "escrow"), Symbol::new(&e, "funded")),
            escrow_id,
        );
    }

    /// Release funds from escrow (normal flow)
    pub fn release_escrow(e: Env, escrow_id: EscrowId) {
        let mut escrow = get_escrow(&e, escrow_id);
        escrow.payee.require_auth();
        check_paused(&e);

        if escrow.status != EscrowStatus::Funded {
            panic_with_error!(&e, EscrowError::InvalidStatus);
        }

        if e.ledger().timestamp() < escrow.release_time {
            panic_with_error!(&e, EscrowError::TimeNotReached);
        }

        // Distribute funds according to revenue split
        Self::distribute_funds(&e, &escrow);

        escrow.status = EscrowStatus::Completed;
        e.storage().persistent().set(&PersistentKey::Escrow(escrow_id), &escrow);
        extend_persistent(&e, &PersistentKey::Escrow(escrow_id));

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "escrow"), Symbol::new(&e, "released")),
            escrow_id,
        );
    }

    /// Complete a milestone for multi-day events
    pub fn complete_milestone(e: Env, escrow_id: EscrowId, milestone_id: MilestoneId) {
        let escrow = get_escrow(&e, escrow_id);
        escrow.payee.require_auth();
        check_paused(&e);

        if escrow.status != EscrowStatus::Funded {
            panic_with_error!(&e, EscrowError::InvalidStatus);
        }

        let mut milestone = get_milestone(&e, escrow_id, milestone_id);
        if milestone.status != MilestoneStatus::Pending {
            panic_with_error!(&e, EscrowError::InvalidStatus);
        }

        milestone.status = MilestoneStatus::Completed;
        milestone.completed_at = Some(e.ledger().timestamp());
        
        e.storage().persistent().set(&PersistentKey::Milestone(escrow_id, milestone_id), &milestone);
        extend_persistent(&e, &PersistentKey::Milestone(escrow_id, milestone_id));

        // Update escrow completed milestones count
        let mut updated_escrow = escrow;
        updated_escrow.completed_milestones += 1;
        e.storage().persistent().set(&PersistentKey::Escrow(escrow_id), &updated_escrow);
        extend_persistent(&e, &PersistentKey::Escrow(escrow_id));

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "milestone"), Symbol::new(&e, "completed")),
            (escrow_id, milestone_id),
        );
    }

    /// Release funds for a completed milestone
    pub fn release_milestone(e: Env, escrow_id: EscrowId, milestone_id: MilestoneId) {
        let escrow = get_escrow(&e, escrow_id);
        escrow.payer.require_auth();
        check_paused(&e);

        let mut milestone = get_milestone(&e, escrow_id, milestone_id);
        if milestone.status != MilestoneStatus::Completed {
            panic_with_error!(&e, EscrowError::InvalidStatus);
        }

        // Calculate milestone amount
        let milestone_amount = (escrow.amount * milestone.amount_percentage as i128) / BASIS_POINTS as i128;
        
        // Distribute milestone funds
        Self::distribute_milestone_funds(&e, &escrow, milestone_amount, &milestone);

        milestone.status = MilestoneStatus::Released;
        milestone.released_at = Some(e.ledger().timestamp());
        
        e.storage().persistent().set(&PersistentKey::Milestone(escrow_id, milestone_id), &milestone);
        extend_persistent(&e, &PersistentKey::Milestone(escrow_id, milestone_id));

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "milestone"), Symbol::new(&e, "released")),
            (escrow_id, milestone_id, milestone_amount),
        );
    }

    /// Raise a dispute on an escrow
    pub fn raise_dispute(
        e: Env,
        escrow_id: EscrowId,
        reason: String,
        evidence: String,
    ) -> DisputeId {
        let escrow = get_escrow(&e, escrow_id);
        let caller = e.invoker();
        
        // Either payer or payee can raise dispute
        if caller != escrow.payer && caller != escrow.payee {
            panic_with_error!(&e, EscrowError::NotAuthorized);
        }
        
        check_paused(&e);

        if escrow.status != EscrowStatus::Funded && escrow.status != EscrowStatus::InDispute {
            panic_with_error!(&e, EscrowError::InvalidStatus);
        }

        let dispute_id = get_next_dispute_id(&e);
        
        let dispute = Dispute {
            id: dispute_id,
            escrow_id,
            raiser: caller,
            resolver: None,
            status: DisputeStatus::Open,
            reason,
            evidence,
            raised_at: e.ledger().timestamp(),
            resolved_at: None,
            resolution_notes: None,
        };

        // Update escrow status
        let mut updated_escrow = escrow;
        updated_escrow.status = EscrowStatus::InDispute;
        e.storage().persistent().set(&PersistentKey::Escrow(escrow_id), &updated_escrow);
        e.storage().persistent().set(&PersistentKey::Dispute(dispute_id), &dispute);
        
        extend_persistent(&e, &PersistentKey::Escrow(escrow_id));
        extend_persistent(&e, &PersistentKey::Dispute(dispute_id));
        extend_instance(&e);

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "dispute"), Symbol::new(&e, "raised")),
            (escrow_id, dispute_id, caller),
        );

        dispute_id
    }

    /// Resolve a dispute (admin function)
    pub fn resolve_dispute(
        e: Env,
        dispute_id: DisputeId,
        resolution_notes: String,
        refund_to_payer: bool,
    ) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        check_paused(&e);

        let mut dispute = get_dispute(&e, dispute_id);
        let mut escrow = get_escrow(&e, dispute.escrow_id);

        if dispute.status != DisputeStatus::Open {
            panic_with_error!(&e, EscrowError::InvalidStatus);
        }

        dispute.status = if refund_to_payer {
            DisputeStatus::Resolved
        } else {
            DisputeStatus::Rejected
        };
        dispute.resolver = Some(admin);
        dispute.resolved_at = Some(e.ledger().timestamp());
        dispute.resolution_notes = Some(resolution_notes);

        // Handle fund distribution based on resolution
        if refund_to_payer {
            // Refund to payer
            Self::transfer_funds(&e, &escrow, escrow.amount, &escrow.payer);
            escrow.status = EscrowStatus::Refunded;
        } else {
            // Release to payee with normal distribution
            Self::distribute_funds(&e, &escrow);
            escrow.status = EscrowStatus::Completed;
        }

        e.storage().persistent().set(&PersistentKey::Dispute(dispute_id), &dispute);
        e.storage().persistent().set(&PersistentKey::Escrow(dispute.escrow_id), &escrow);
        
        extend_persistent(&e, &PersistentKey::Dispute(dispute_id));
        extend_persistent(&e, &PersistentKey::Escrow(dispute.escrow_id));

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "dispute"), Symbol::new(&e, "resolved")),
            (dispute.escrow_id, dispute_id, refund_to_payer),
        );
    }

    /// Emergency withdrawal (only for emergency admin)
    pub fn emergency_withdraw(e: Env, token_type: TokenType, amount: i128, recipient: Address) {
        let emergency_admin: Address = e.storage().instance().get(&DataKey::EmergencyAdmin).unwrap();
        emergency_admin.require_auth();
        
        validate_amount(amount);
        
        match token_type {
            TokenType::Native => {
                // For native tokens, this would require host function support
                // This is a placeholder for emergency native token withdrawal
                panic_with_error!(e, EscrowError::EmergencyOnly);
            }
            TokenType::SorobanToken(token_address) => {
                let token_client = token::Client::new(&e, &token_address);
                token_client.transfer(&e.current_contract_address(), &recipient, &amount);
            }
        }

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "emergency"), Symbol::new(&e, "withdraw")),
            (token_address, amount, recipient),
        );
    }

    /// Create a referral code
    pub fn create_referral(e: Env, code: ReferralCode) -> ReferralCode {
        let caller = e.invoker();
        caller.require_auth();
        check_paused(&e);

        if e.storage().persistent().has(&PersistentKey::Referral(code.clone())) {
            panic_with_error!(&e, EscrowError::InvalidStatus); // Code already exists
        }

        let referral = Referral {
            code: code.clone(),
            creator: caller,
            total_earnings: 0,
            total_referrals: 0,
            created_at: e.ledger().timestamp(),
            is_active: true,
        };

        e.storage().persistent().set(&PersistentKey::Referral(code.clone()), &referral);
        extend_persistent(&e, &PersistentKey::Referral(code.clone()));

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "referral"), Symbol::new(&e, "created")),
            (code.clone(), caller),
        );

        code
    }

    /// Cancel an escrow (before funding)
    pub fn cancel_escrow(e: Env, escrow_id: EscrowId) {
        let mut escrow = get_escrow(&e, escrow_id);
        escrow.payer.require_auth();
        check_paused(&e);

        if escrow.status != EscrowStatus::Created {
            panic_with_error!(&e, EscrowError::InvalidStatus);
        }

        escrow.status = EscrowStatus::Cancelled;
        e.storage().persistent().set(&PersistentKey::Escrow(escrow_id), &escrow);
        extend_persistent(&e, &PersistentKey::Escrow(escrow_id));

        // Emit event
        e.events().publish(
            (Symbol::new(&e, "escrow"), Symbol::new(&e, "cancelled")),
            escrow_id,
        );
    }

    /// Admin functions to update fee structure
    pub fn update_platform_fee(e: Env, new_fee_bps: u32) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        
        if new_fee_bps > BASIS_POINTS {
            panic_with_error!(&e, EscrowError::InvalidRevenueSplit);
        }
        
        e.storage().instance().set(&DataKey::PlatformFeeBps, &new_fee_bps);
        extend_instance(&e);
    }

    pub fn update_referral_reward(e: Env, new_reward_bps: u32) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        
        if new_reward_bps > BASIS_POINTS {
            panic_with_error!(&e, EscrowError::InvalidRevenueSplit);
        }
        
        e.storage().instance().set(&DataKey::ReferralRewardBps, &new_reward_bps);
        extend_instance(&e);
    }

    pub fn pause(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &true);
    }

    pub fn unpause(e: Env) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Paused, &false);
    }

    /// View functions
    pub fn get_escrow(e: Env, escrow_id: EscrowId) -> Escrow {
        get_escrow(&e, escrow_id)
    }

    pub fn get_dispute(e: Env, dispute_id: DisputeId) -> Dispute {
        get_dispute(&e, dispute_id)
    }

    pub fn get_milestone(e: Env, escrow_id: EscrowId, milestone_id: MilestoneId) -> Milestone {
        get_milestone(&e, escrow_id, milestone_id)
    }

    pub fn get_referral(e: Env, code: ReferralCode) -> Referral {
        e.storage().persistent().get(&PersistentKey::Referral(code))
            .unwrap_or_else(|| panic_with_error!(&e, EscrowError::ReferralNotFound))
    }

    pub fn get_escrows_by_participant(e: Env, participant: Address) -> Vec<EscrowId> {
        // In a real implementation, you'd iterate through storage
        // This is a simplified version
        Vec::new(&e)
    }

    pub fn get_platform_fee_bps(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::PlatformFeeBps).unwrap()
    }

    pub fn get_referral_reward_bps(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::ReferralRewardBps).unwrap()
    }

    pub fn get_total_escrows(e: Env) -> u64 {
        e.storage().instance().get(&DataKey::TotalEscrows).unwrap()
    }
}

// Helper functions
fn extend_instance(e: &Env) {
    e.storage().instance().extend_ttl(TTL_INSTANCE, TTL_INSTANCE);
}

fn extend_persistent(e: &Env, key: &PersistentKey) {
    e.storage().persistent().extend_ttl(key, TTL_PERSISTENT, TTL_PERSISTENT);
}

fn check_paused(e: &Env) {
    let paused: bool = e.storage().instance().get(&DataKey::Paused).unwrap();
    if paused {
        panic_with_error!(e, EscrowError::ContractPaused);
    }
}

fn validate_amount(amount: i128) {
    if amount < MIN_AMOUNT {
        panic_with_error!(&Env::default(), EscrowError::AmountTooSmall);
    }
}

fn validate_revenue_split(revenue_split: &RevenueSplit) {
    let total_bps = revenue_split.organizer_share_bps 
        + revenue_split.platform_fee_bps 
        + revenue_split.referral_reward_bps;
    
    if total_bps > BASIS_POINTS {
        panic_with_error!(&Env::default(), EscrowError::InvalidRevenueSplit);
    }
}

fn get_escrow(e: &Env, escrow_id: EscrowId) -> Escrow {
    e.storage().persistent().get(&PersistentKey::Escrow(escrow_id))
        .unwrap_or_else(|| panic_with_error!(e, EscrowError::EscrowNotFound))
}

fn get_dispute(e: &Env, dispute_id: DisputeId) -> Dispute {
    e.storage().persistent().get(&PersistentKey::Dispute(dispute_id))
        .unwrap_or_else(|| panic_with_error!(e, EscrowError::DisputeNotFound))
}

fn get_milestone(e: &Env, escrow_id: EscrowId, milestone_id: MilestoneId) -> Milestone {
    e.storage().persistent().get(&PersistentKey::Milestone(escrow_id, milestone_id))
        .unwrap_or_else(|| panic_with_error!(e, EscrowError::MilestoneNotFound))
}

fn get_next_dispute_id(e: &Env) -> DisputeId {
    // Simple implementation - in production you'd want a more robust approach
    e.ledger().sequence() as DisputeId
}

fn calculate_share(amount: i128, bps: u32) -> i128 {
    (amount * bps as i128) / BASIS_POINTS as i128
}

impl EscrowContract {
    fn distribute_funds(e: &Env, escrow: &Escrow) {
        let platform_fee = calculate_share(escrow.amount, escrow.revenue_split.platform_fee_bps);
        let referral_reward = calculate_share(escrow.amount, escrow.revenue_split.referral_reward_bps);
        let organizer_share = escrow.amount - platform_fee - referral_reward;

        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        
        // Transfer to platform
        Self::transfer_funds(e, escrow, platform_fee, &admin);
        
        // Transfer referral reward if applicable
        if let Some(referral_code) = &escrow.revenue_split.referral_code {
            let mut referral: Referral = e.storage().persistent().get(&PersistentKey::Referral(referral_code.clone())).unwrap();
            Self::transfer_funds(e, escrow, referral_reward, &referral.creator);
            referral.total_earnings += referral_reward;
            referral.total_referrals += 1;
            e.storage().persistent().set(&PersistentKey::Referral(referral_code.clone()), &referral);
            extend_persistent(e, &PersistentKey::Referral(referral_code.clone()));
        } else {
            // No referral, send to platform
            Self::transfer_funds(e, escrow, referral_reward, &admin);
        }
        
        // Transfer to organizer
        Self::transfer_funds(e, escrow, organizer_share, &escrow.revenue_split.organizer);

        // Emit event
        e.events().publish(
            (Symbol::new(e, "escrow"), Symbol::new(e, "revenue_distributed")),
            escrow.id,
        );
    }

    fn distribute_milestone_funds(e: &Env, escrow: &Escrow, amount: i128, milestone: &Milestone) {
        let platform_fee = calculate_share(amount, escrow.revenue_split.platform_fee_bps);
        let referral_reward = calculate_share(amount, escrow.revenue_split.referral_reward_bps);
        let organizer_share = amount - platform_fee - referral_reward;

        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        
        // Transfer to platform
        Self::transfer_funds(e, escrow, platform_fee, &admin);
        
        // Transfer referral reward if applicable
        if let Some(referral_code) = &escrow.revenue_split.referral_code {
            let referral: Referral = e.storage().persistent().get(&PersistentKey::Referral(referral_code.clone())).unwrap();
            Self::transfer_funds(e, escrow, referral_reward, &referral.creator);
        } else {
            // No referral, send to platform
            Self::transfer_funds(e, escrow, referral_reward, &admin);
        }
        
        // Transfer to organizer
        Self::transfer_funds(e, escrow, organizer_share, &escrow.revenue_split.organizer);
    }

    fn transfer_funds(e: &Env, escrow: &Escrow, amount: i128, recipient: &Address) {
        match &escrow.token_type {
            TokenType::Native => {
                // Native token transfer would require host functions
                // This is a placeholder
            }
            TokenType::SorobanToken(token_address) => {
                let token_client = token::Client::new(e, token_address);
                token_client.transfer(&e.current_contract_address(), recipient, &amount);
            }
        }
    }
}
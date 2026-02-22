use soroban_sdk::{contracttype, Address, BytesN};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Campaign(u32),
    Claimed(u32, Address),
    CampaignCount,
    Delegate(u32, Address), // (CampaignID, Delegator) -> Delegatee
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Campaign {
    pub admin: Address,
    pub token: Address,
    pub root: BytesN<32>,
    pub total_amount: i128,
    pub claimed_amount: i128,
    pub deadline: u64,
    pub is_active: bool,
    pub refunded: bool,
}

#![no_std]
use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, Vec, IntoVal, xdr::ToXdr, Bytes};

mod merkle;
mod storage;

#[cfg(test)]
mod test;

use crate::storage::{Campaign, DataKey};

#[contract]
pub struct WhitelistContract;

#[contractimpl]
impl WhitelistContract {
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::CampaignCount, &0u32);
    }

    pub fn create_campaign(
        env: Env,
        admin: Address,
        token: Address,
        root: BytesN<32>,
        deadline: u64,
        total_amount: i128,
    ) -> u32 {
        admin.require_auth();
        
        let mut count: u32 = env.storage().instance().get(&DataKey::CampaignCount).unwrap_or(0);
        count += 1;
        
        let campaign = Campaign {
            admin,
            token: token.clone(),
            root,
            total_amount,
            claimed_amount: 0,
            deadline,
            is_active: true,
            refunded: false,
        };

        // Transfer tokens from admin to contract
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&campaign.admin, &env.current_contract_address(), &total_amount);

        env.storage().persistent().set(&DataKey::Campaign(count), &campaign);
        env.storage().instance().set(&DataKey::CampaignCount, &count);
        
        count
    }

    pub fn update_root(env: Env, campaign_id: u32, new_root: BytesN<32>) {
        let mut campaign: Campaign = env.storage().persistent().get(&DataKey::Campaign(campaign_id)).expect("campaign not found");
        campaign.admin.require_auth();
        
        campaign.root = new_root;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
    }

    pub fn batch_update_roots(env: Env, campaign_ids: Vec<u32>, new_roots: Vec<BytesN<32>>) {
        if campaign_ids.len() != new_roots.len() {
            panic!("mismatched lengths");
        }

        for i in 0..campaign_ids.len() {
            let id = campaign_ids.get(i).unwrap();
            let root = new_roots.get(i).unwrap();
            Self::update_root(env.clone(), id, root);
        }
    }

    pub fn delegate_claim(env: Env, campaign_id: u32, delegator: Address, delegatee: Address) {
        delegator.require_auth();
        env.storage().persistent().set(&DataKey::Delegate(campaign_id, delegator), &delegatee);
    }

    pub fn claim(
        env: Env,
        campaign_id: u32,
        claimant: Address,
        amount: i128,
        proof: Vec<BytesN<32>>,
        recipient: Option<Address>,
    ) {
        claimant.require_auth();
        Self::internal_claim(env, campaign_id, claimant, amount, proof, recipient)
    }

    pub fn claim_as_delegate(
        env: Env,
        campaign_id: u32,
        delegator: Address,
        delegatee: Address,
        amount: i128,
        proof: Vec<BytesN<32>>,
        recipient: Option<Address>,
    ) {
        delegatee.require_auth();
        
        let stored_delegatee: Address = env.storage().persistent()
            .get(&DataKey::Delegate(campaign_id, delegator.clone()))
            .expect("no delegation found for this claimant");
            
        if stored_delegatee != delegatee {
            panic!("unauthorized delegate");
        }

        Self::internal_claim(env, campaign_id, delegator, amount, proof, recipient)
    }

    fn internal_claim(
        env: Env,
        campaign_id: u32,
        claimant: Address, // This is the whitelisted address
        amount: i128,
        proof: Vec<BytesN<32>>,
        recipient: Option<Address>,
    ) {
        let mut campaign: Campaign = env.storage().persistent().get(&DataKey::Campaign(campaign_id)).expect("campaign not found");
        
        if !campaign.is_active {
            panic!("campaign inactive");
        }
        if env.ledger().timestamp() > campaign.deadline {
            panic!("campaign expired");
        }
        if env.storage().persistent().has(&DataKey::Claimed(campaign_id, claimant.clone())) {
            panic!("already claimed");
        }

        // Verify Merkle Proof
        let leaf = Self::hash_leaf(&env, &claimant, amount);
        if !merkle::verify(&env, campaign.root.clone(), leaf, proof) {
            panic!("invalid proof");
        }

        // Update state
        campaign.claimed_amount += amount;
        if campaign.claimed_amount > campaign.total_amount {
            panic!("insufficient funds in campaign");
        }

        env.storage().persistent().set(&DataKey::Claimed(campaign_id, claimant.clone()), &true);
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);

        // Transfer tokens
        let destination = recipient.unwrap_or(claimant.clone());
        let token_client = token::Client::new(&env, &campaign.token);
        token_client.transfer(&env.current_contract_address(), &destination, &amount);
    }

    pub fn refund(env: Env, campaign_id: u32) {
        let mut campaign: Campaign = env.storage().persistent().get(&DataKey::Campaign(campaign_id)).expect("campaign not found");
        campaign.admin.require_auth();

        if env.ledger().timestamp() <= campaign.deadline {
            panic!("campaign not yet finished");
        }
        if campaign.refunded {
            panic!("already refunded");
        }

        let remaining = campaign.total_amount - campaign.claimed_amount;
        if remaining > 0 {
            let token_client = token::Client::new(&env, &campaign.token);
            token_client.transfer(&env.current_contract_address(), &campaign.admin, &remaining);
        }

        campaign.refunded = true;
        campaign.is_active = false;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
    }

    pub fn get_campaign(env: Env, campaign_id: u32) -> Campaign {
        env.storage().persistent().get(&DataKey::Campaign(campaign_id)).expect("campaign not found")
    }

    fn hash_leaf(env: &Env, address: &Address, amount: i128) -> BytesN<32> {
        let mut bytes = address.to_xdr(env);
        bytes.extend(&amount.to_xdr(env));
        env.crypto().sha256(&bytes)
    }
}

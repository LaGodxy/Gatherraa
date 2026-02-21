#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};
use soroban_sdk::token;

#[test]
fn test_escrow_lifecycle() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let emergency_admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let payee = Address::generate(&env);
    let organizer = Address::generate(&env);

    // Create test token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_contract_wasm(None, token::StellarAssetClient::new(&env, &token_admin).contract_id());
    let token_client = token::Client::new(&env, &token_contract);
    token_client.initialize(&token_admin, &String::from_str(&env, "Test Token"), &String::from_str(&env, "TST"), &8);

    // Initialize contract
    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &emergency_admin);

    // Mint tokens to payer
    token_client.mint(&token_admin, &payer, &100_000_000); // 100 tokens

    // Create revenue split
    let revenue_split = RevenueSplit {
        organizer_share_bps: 8500,
        platform_fee_bps: 1000,
        referral_reward_bps: 500,
        organizer: organizer.clone(),
        referral_code: None,
    };

    // Create escrow
    let escrow_id = client.create_escrow(
        &TokenType::SorobanToken(token_contract.clone()),
        &50_000_000, // 50 tokens
        &payer,
        &payee,
        &env.ledger().timestamp() + 1000,
        &revenue_split,
        &String::from_str(&env, "Test Event Payment"),
        &String::from_str(&env, "{\"eventId\": \"123\"}"),
        &false,
        &None,
    );

    assert_eq!(escrow_id, 1);

    // Check escrow was created
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.id, escrow_id);
    assert_eq!(escrow.amount, 50_000_000);
    assert_eq!(escrow.status, EscrowStatus::Created);

    // Fund escrow
    token_client.approve(&payer, &contract_id, &50_000_000, &u32::MAX);
    client.fund_escrow(&escrow_id);

    // Check escrow is funded
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Funded);

    // Advance time
    env.ledger().with_mut(|li| {
        li.timestamp += 1000;
    });

    // Release escrow
    client.release_escrow(&escrow_id);

    // Check final status
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Completed);

    // Check balances
    let platform_fee = 50_000_000 * 1000 / 10000; // 10%
    let referral_reward = 50_000_000 * 500 / 10000; // 5%
    let organizer_share = 50_000_000 - platform_fee - referral_reward; // 85%

    assert_eq!(token_client.balance(&admin), platform_fee + referral_reward); // Admin gets both fees
    assert_eq!(token_client.balance(&organizer), organizer_share);
    assert_eq!(token_client.balance(&contract_id), 0); // Contract should be empty
}

#[test]
fn test_milestone_payments() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let emergency_admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let payee = Address::generate(&env);
    let organizer = Address::generate(&env);

    // Create test token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_contract_wasm(None, token::StellarAssetClient::new(&env, &token_admin).contract_id());
    let token_client = token::Client::new(&env, &token_contract);
    token_client.initialize(&token_admin, &String::from_str(&env, "Test Token"), &String::from_str(&env, "TST"), &8);

    // Initialize contract
    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &emergency_admin);

    // Mint tokens to payer
    token_client.mint(&token_admin, &payer, &100_000_000);

    // Create milestones
    let milestones = Vec::from_array(&env, [
        Milestone {
            id: 1,
            escrow_id: 0, // Will be set when creating escrow
            name: String::from_str(&env, "Day 1"),
            description: String::from_str(&env, "First day of event"),
            amount_percentage: 4000, // 40%
            due_date: env.ledger().timestamp() + 1000,
            completed_at: None,
            released_at: None,
            status: MilestoneStatus::Pending,
        },
        Milestone {
            id: 2,
            escrow_id: 0,
            name: String::from_str(&env, "Day 2"),
            description: String::from_str(&env, "Second day of event"),
            amount_percentage: 6000, // 60%
            due_date: env.ledger().timestamp() + 2000,
            completed_at: None,
            released_at: None,
            status: MilestoneStatus::Pending,
        }
    ]);

    // Create revenue split
    let revenue_split = RevenueSplit {
        organizer_share_bps: 8500,
        platform_fee_bps: 1000,
        referral_reward_bps: 500,
        organizer: organizer.clone(),
        referral_code: None,
    };

    // Create escrow with milestones
    let escrow_id = client.create_escrow(
        &TokenType::SorobanToken(token_contract.clone()),
        &100_000_000,
        &payer,
        &payee,
        &env.ledger().timestamp() + 3000,
        &revenue_split,
        &String::from_str(&env, "Multi-day Event"),
        &String::from_str(&env, "{\"eventId\": \"456\"}"),
        &true,
        &Some(milestones),
    );

    // Fund escrow
    token_client.approve(&payer, &contract_id, &100_000_000, &u32::MAX);
    client.fund_escrow(&escrow_id);

    // Complete first milestone
    client.complete_milestone(&escrow_id, &1);

    // Release first milestone payment
    client.release_milestone(&escrow_id, &1);

    // Check milestone status
    let milestone = client.get_milestone(&escrow_id, &1);
    assert_eq!(milestone.status, MilestoneStatus::Released);

    // Check balances after first milestone
    let milestone_amount = 100_000_000 * 4000 / 10000; // 40% = 40 tokens
    let platform_fee = milestone_amount * 1000 / 10000; // 10% = 4 tokens
    let referral_reward = milestone_amount * 500 / 10000; // 5% = 2 tokens
    let organizer_share = milestone_amount - platform_fee - referral_reward; // 85% = 34 tokens

    assert_eq!(token_client.balance(&admin), platform_fee + referral_reward);
    assert_eq!(token_client.balance(&organizer), organizer_share);
}

#[test]
fn test_dispute_resolution() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let emergency_admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let payee = Address::generate(&env);
    let organizer = Address::generate(&env);

    // Create test token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_contract_wasm(None, token::StellarAssetClient::new(&env, &token_admin).contract_id());
    let token_client = token::Client::new(&env, &token_contract);
    token_client.initialize(&token_admin, &String::from_str(&env, "Test Token"), &String::from_str(&env, "TST"), &8);

    // Initialize contract
    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &emergency_admin);

    // Mint tokens to payer
    token_client.mint(&token_admin, &payer, &50_000_000);

    // Create revenue split
    let revenue_split = RevenueSplit {
        organizer_share_bps: 8500,
        platform_fee_bps: 1000,
        referral_reward_bps: 500,
        organizer: organizer.clone(),
        referral_code: None,
    };

    // Create escrow
    let escrow_id = client.create_escrow(
        &TokenType::SorobanToken(token_contract.clone()),
        &50_000_000,
        &payer,
        &payee,
        &env.ledger().timestamp() + 1000,
        &revenue_split,
        &String::from_str(&env, "Disputed Payment"),
        &String::from_str(&env, "{\"eventId\": \"789\"}"),
        &false,
        &None,
    );

    // Fund escrow
    token_client.approve(&payer, &contract_id, &50_000_000, &u32::MAX);
    client.fund_escrow(&escrow_id);

    // Raise dispute
    let dispute_id = client.raise_dispute(
        &escrow_id,
        &String::from_str(&env, "Service not delivered"),
        &String::from_str(&env, "ipfs://QmHash123"),
    );

    // Check dispute was created
    let dispute = client.get_dispute(&dispute_id);
    assert_eq!(dispute.status, DisputeStatus::Open);
    assert_eq!(dispute.escrow_id, escrow_id);

    // Check escrow status updated
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::InDispute);

    // Resolve dispute - refund to payer
    client.resolve_dispute(
        &dispute_id,
        &String::from_str(&env, "Valid complaint, refunding payer"),
        &true, // refund_to_payer
    );

    // Check final states
    let dispute = client.get_dispute(&dispute_id);
    assert_eq!(dispute.status, DisputeStatus::Resolved);
    
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Refunded);

    // Check funds returned to payer
    assert_eq!(token_client.balance(&payer), 50_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn test_referral_system() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let emergency_admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let payee = Address::generate(&env);
    let organizer = Address::generate(&env);
    let referrer = Address::generate(&env);

    // Create test token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_contract_wasm(None, token::StellarAssetClient::new(&env, &token_admin).contract_id());
    let token_client = token::Client::new(&env, &token_contract);
    token_client.initialize(&token_admin, &String::from_str(&env, "Test Token"), &String::from_str(&env, "TST"), &8);

    // Initialize contract
    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &emergency_admin);

    // Create referral code
    let referral_code = String::from_str(&env, "REF123");
    client.create_referral(&referral_code);

    // Check referral was created
    let referral = client.get_referral(&referral_code);
    assert_eq!(referral.code, referral_code);
    assert_eq!(referral.creator, referrer);
    assert_eq!(referral.total_earnings, 0);
    assert_eq!(referral.total_referrals, 0);

    // Mint tokens to payer
    token_client.mint(&token_admin, &payer, &100_000_000);

    // Create escrow with referral
    let revenue_split = RevenueSplit {
        organizer_share_bps: 8000,
        platform_fee_bps: 1000,
        referral_reward_bps: 1000,
        organizer: organizer.clone(),
        referral_code: Some(referral_code.clone()),
    };

    let escrow_id = client.create_escrow(
        &TokenType::SorobanToken(token_contract.clone()),
        &50_000_000,
        &payer,
        &payee,
        &env.ledger().timestamp() + 1000,
        &revenue_split,
        &String::from_str(&env, "Referral Payment"),
        &String::from_str(&env, "{\"eventId\": \"101\"}"),
        &false,
        &None,
    );

    // Fund and release escrow
    token_client.approve(&payer, &contract_id, &50_000_000, &u32::MAX);
    client.fund_escrow(&escrow_id);
    
    env.ledger().with_mut(|li| {
        li.timestamp += 1000;
    });
    
    client.release_escrow(&escrow_id);

    // Check referral earnings
    let referral = client.get_referral(&referral_code);
    let expected_reward = 50_000_000 * 1000 / 10000; // 10% = 5 tokens
    assert_eq!(referral.total_earnings, expected_reward);
    assert_eq!(referral.total_referrals, 1);

    // Check referrer received reward
    assert_eq!(token_client.balance(&referrer), expected_reward);
}

#[test]
fn test_invalid_operations() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let emergency_admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let payee = Address::generate(&env);
    let organizer = Address::generate(&env);

    // Create test token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_contract_wasm(None, token::StellarAssetClient::new(&env, &token_admin).contract_id());
    let token_client = token::Client::new(&env, &token_contract);
    token_client.initialize(&token_admin, &String::from_str(&env, "Test Token"), &String::from_str(&env, "TST"), &8);

    // Initialize contract
    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &emergency_admin);

    // Test: Try to create escrow with invalid revenue split
    let invalid_revenue_split = RevenueSplit {
        organizer_share_bps: 9000,
        platform_fee_bps: 1500,
        referral_reward_bps: 1000, // Total > 10000 bps
        organizer: organizer.clone(),
        referral_code: None,
    };

    let result = client.try_create_escrow(
        &TokenType::SorobanToken(token_contract.clone()),
        &50_000_000,
        &payer,
        &payee,
        &env.ledger().timestamp() + 1000,
        &invalid_revenue_split,
        &String::from_str(&env, "Invalid Payment"),
        &String::from_str(&env, "{\"eventId\": \"202\"}"),
        &false,
        &None,
    );
    assert!(result.is_err());

    // Test: Try to fund non-existent escrow
    let result = client.try_fund_escrow(&999);
    assert!(result.is_err());

    // Test: Try to release before funding
    let revenue_split = RevenueSplit {
        organizer_share_bps: 8500,
        platform_fee_bps: 1000,
        referral_reward_bps: 500,
        organizer: organizer.clone(),
        referral_code: None,
    };

    let escrow_id = client.create_escrow(
        &TokenType::SorobanToken(token_contract.clone()),
        &50_000_000,
        &payer,
        &payee,
        &env.ledger().timestamp() + 1000,
        &revenue_split,
        &String::from_str(&env, "Test Payment"),
        &String::from_str(&env, "{\"eventId\": \"303\"}"),
        &false,
        &None,
    );

    let result = client.try_release_escrow(&escrow_id);
    assert!(result.is_err());
}

#[test]
fn test_pause_functionality() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let emergency_admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let payee = Address::generate(&env);
    let organizer = Address::generate(&env);

    // Create test token
    let token_admin = Address::generate(&env);
    let token_contract = env.register_contract_wasm(None, token::StellarAssetClient::new(&env, &token_admin).contract_id());
    let token_client = token::Client::new(&env, &token_contract);
    token_client.initialize(&token_admin, &String::from_str(&env, "Test Token"), &String::from_str(&env, "TST"), &8);

    // Initialize contract
    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &emergency_admin);

    // Pause contract
    client.pause();

    // Try to create escrow when paused
    let revenue_split = RevenueSplit {
        organizer_share_bps: 8500,
        platform_fee_bps: 1000,
        referral_reward_bps: 500,
        organizer: organizer.clone(),
        referral_code: None,
    };

    let result = client.try_create_escrow(
        &TokenType::SorobanToken(token_contract.clone()),
        &50_000_000,
        &payer,
        &payee,
        &env.ledger().timestamp() + 1000,
        &revenue_split,
        &String::from_str(&env, "Paused Test"),
        &String::from_str(&env, "{\"eventId\": \"404\"}"),
        &false,
        &None,
    );
    assert!(result.is_err());

    // Unpause contract
    client.unpause();

    // Should work now
    let result = client.try_create_escrow(
        &TokenType::SorobanToken(token_contract.clone()),
        &50_000_000,
        &payer,
        &payee,
        &env.ledger().timestamp() + 1000,
        &revenue_split,
        &String::from_str(&env, "Unpaused Test"),
        &String::from_str(&env, "{\"eventId\": \"505\"}"),
        &false,
        &None,
    );
    assert!(result.is_ok());
}

#[test]
fn test_admin_functions() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let emergency_admin = Address::generate(&env);

    // Initialize contract
    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(&env, &contract_id);
    client.initialize(&admin, &emergency_admin);

    // Test updating platform fee
    let new_fee = 1500u32; // 15%
    client.update_platform_fee(&new_fee);
    assert_eq!(client.get_platform_fee_bps(), new_fee);

    // Test updating referral reward
    let new_reward = 800u32; // 8%
    client.update_referral_reward(&new_reward);
    assert_eq!(client.get_referral_reward_bps(), new_reward);
}
#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, Address, Env};

#[test]
fn test_governance_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let emergency = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    // Create a mock token
    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &token_addr);
    let token_query = token::Client::new(&env, &token_addr);

    // Mint tokens
    token_client.mint(&proposer, &500);
    token_client.mint(&voter1, &1000);
    token_client.mint(&voter2, &200);

    // Register governance contract
    let contract_id = env.register_contract(None, GovernanceContract);
    let client = GovernanceContractClient::new(&env, &contract_id);

    // Init
    client.init(&admin, &token_addr, &100, &emergency);

    // Create Proposal
    let action = GovernanceAction::ParameterChange(String::from_str(&env, "fee"), 50);
    let prop_id = client.create_proposal(
        &proposer,
        &action,
        &ProposalCategory::ParameterUpdate,
        &String::from_str(&env, "Increase fee to 50 bps")
    );

    assert_eq!(prop_id, 1);

    // Vote
    client.vote(&voter1, &prop_id, &true, &false, &Vec::new(&env));
    client.vote(&voter2, &prop_id, &false, &false, &Vec::new(&env));

    // Fast forward ledgers to end of voting period
    env.ledger().set_sequence(env.ledger().sequence() + 101);

    // Queue
    client.queue(&prop_id);

    // Check status
    // (In a real test we'd check the proposal struct, but we need a way to read it)
    // Let's add a getter or just check if execute works
    
    // Fast forward time for timelock
    env.ledger().set_timestamp(env.ledger().timestamp() + 101);

    // Execute
    client.execute(&prop_id);
}

#[test]
fn test_quadratic_voting() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let emergency = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &token_addr);

    token_client.mint(&proposer, &500);
    token_client.mint(&voter, &400); // sqrt(400) = 20

    let contract_id = env.register_contract(None, GovernanceContract);
    let client = GovernanceContractClient::new(&env, &contract_id);

    client.init(&admin, &token_addr, &100, &emergency);

    let action = GovernanceAction::FeeChange(100);
    let prop_id = client.create_proposal(&proposer, &action, &ProposalCategory::FeeAdjustment, &String::from_str(&env, "Desc"));

    client.vote(&voter, &prop_id, &true, &true, &Vec::new(&env));

    // We can't easily check the proposal state without a getter, 
    // but we can check if it passes quorum if we set quorum to 20
    client.set_category_settings(&1, &20, &50, &50);
    
    env.ledger().set_sequence(env.ledger().sequence() + 100);
    client.queue(&prop_id); // Should succeed if power is 20
}

#[test]
fn test_delegation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let emergency = Address::generate(&env);
    let proposer = Address::generate(&env);
    let delegator = Address::generate(&env);
    let delegatee = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_addr = env.register_stellar_asset_contract(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &token_addr);

    token_client.mint(&proposer, &500);
    token_client.mint(&delegator, &1000);
    token_client.mint(&delegatee, &100);

    let contract_id = env.register_contract(None, GovernanceContract);
    let client = GovernanceContractClient::new(&env, &contract_id);

    client.init(&admin, &token_addr, &100, &emergency);

    // Delegate
    client.delegate(&delegator, &delegatee);

    let action = GovernanceAction::FeeChange(100);
    let prop_id = client.create_proposal(&proposer, &action, &ProposalCategory::FeeAdjustment, &String::from_str(&env, "Desc"));

    // Delegatee votes for both
    let mut delegators = Vec::new(&env);
    delegators.push_back(delegator.clone());
    client.vote(&delegatee, &prop_id, &true, &false, &delegators);
    
    // Total power should be 1100
    // Set quorum to 1100
    client.set_category_settings(&1, &1100, &50, &50);
    
    env.ledger().set_sequence(env.ledger().sequence() + 100);
    client.queue(&prop_id); // Should succeed
}

#[test]
fn test_emergency_procedures() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let emergency = Address::generate(&env);

    let token_addr = Address::generate(&env);

    let contract_id = env.register_contract(None, GovernanceContract);
    let client = GovernanceContractClient::new(&env, &contract_id);

    client.init(&admin, &token_addr, &100, &emergency);

    let action = GovernanceAction::EmergencyAction;
    client.emergency_action(&emergency, &action);
}

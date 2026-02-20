#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol};

fn create_contract(e: &Env, admin: &Address) -> SoulboundTicketContractClient<'static> {
    let contract_id = e.register_contract(None, SoulboundTicketContract);
    let client = SoulboundTicketContractClient::new(e, &contract_id);

    client.initialize(
        admin,
        &String::from_str(e, "EventTicket"),
        &String::from_str(e, "TKT"),
        &String::from_str(e, "https://example.com"),
        &e.ledger().timestamp(),
        &(e.ledger().timestamp() + 100000), // Refund cutoff
    );
    client
}

#[test]
fn test_initialize_and_tier_creation() {
    let e = Env::default();
    e.mock_all_auths();
    let admin = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "VIP");
    client.add_tier(&tier_sym, &String::from_str(&e, "VIP Ticket"), &100, &50);

    let price = client.get_ticket_price(&tier_sym);
    assert_eq!(price, 100);
}

#[test]
fn test_batch_mint() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "GEN");
    client.add_tier(&tier_sym, &String::from_str(&e, "General"), &50, &100);

    client.batch_mint(&user, &tier_sym, &5);

    let balance = client.balance(&user);
    assert_eq!(balance, 5);

    let ticket = client.get_ticket(&1);
    assert_eq!(ticket.tier_symbol, tier_sym);
}

#[test]
#[should_panic(expected = "Soulbound: Tickets cannot be transferred")]
fn test_soulbound_restriction() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user1 = Address::generate(&e);
    let user2 = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "VIP");
    client.add_tier(&tier_sym, &String::from_str(&e, "VIP"), &100, &10);
    client.batch_mint(&user1, &tier_sym, &1);

    // This should panic
    client.transfer(&user1, &user2, &1);
}

#[test]
fn test_dynamic_pricing() {
    let e = Env::default();
    e.mock_all_auths();

    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    let client = create_contract(&e, &admin);

    let tier_sym = Symbol::new(&e, "GEN");
    client.add_tier(&tier_sym, &String::from_str(&e, "General"), &100, &10); // thresholds every 2 tickets

    // Initial price should be base
    assert_eq!(client.get_ticket_price(&tier_sym), 100);

    // Mint 2 tickets (hits 20% threshold, max_supply=10, 10/5=2)
    client.batch_mint(&user, &tier_sym, &2);

    // Price should increase by 5%
    assert_eq!(client.get_ticket_price(&tier_sym), 105);

    // Mint 2 more (hits 40%)
    client.batch_mint(&user, &tier_sym, &2);

    // Price should increase by 10%
    assert_eq!(client.get_ticket_price(&tier_sym), 110);
}

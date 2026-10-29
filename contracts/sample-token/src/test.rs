#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{vec, BytesN, Env, String};

fn setup() -> (Env, SampleTokenClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(
        SampleToken,
        (admin.clone(), 7u32, String::from_str(&env, "Playground Token"), String::from_str(&env, "PLAY")),
    );
    (env.clone(), SampleTokenClient::new(&env, &id), admin)
}

#[test]
fn metadata_is_set_by_constructor() {
    let (env, client, admin) = setup();
    assert_eq!(client.decimals(), 7);
    assert_eq!(client.symbol(), String::from_str(&env, "PLAY"));
    assert_eq!(client.metadata().name, String::from_str(&env, "Playground Token"));
    assert_eq!(client.admin(), admin);
}

#[test]
fn mint_and_transfer() {
    let (env, client, admin) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.mint(&alice, &1_000);
    assert_eq!(env.auths()[0].0, admin);
    client.transfer(&alice, &bob, &400);
    assert_eq!(client.balance(&alice), 600);
    assert_eq!(client.balance(&bob), 400);
    assert_eq!(client.total_supply(), 1_000);
}

#[test]
fn rejects_bad_amounts_and_overdrafts() {
    let (env, client, _) = setup();
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    assert_eq!(client.try_mint(&alice, &0), Err(Ok(TokenError::InvalidAmount)));
    client.mint(&alice, &10);
    assert_eq!(client.try_transfer(&alice, &bob, &11), Err(Ok(TokenError::InsufficientBalance)));
}

#[test]
fn allowances_expire() {
    let (env, client, _) = setup();
    let (alice, bob, carol) = (Address::generate(&env), Address::generate(&env), Address::generate(&env));
    client.mint(&alice, &100);
    let expiry = env.ledger().sequence() + 10;
    client.approve(&alice, &bob, &50, &expiry);
    assert_eq!(client.allowance(&alice, &bob), 50);
    client.transfer_from(&bob, &alice, &carol, &20);
    assert_eq!(client.allowance(&alice, &bob), 30);
    env.ledger().with_mut(|l| l.sequence_number = expiry + 1);
    assert_eq!(client.allowance(&alice, &bob), 0);
    assert_eq!(client.try_transfer_from(&bob, &alice, &carol, &1), Err(Ok(TokenError::InsufficientAllowance)));
}

#[test]
fn batch_and_memo() {
    let (env, client, _) = setup();
    let (alice, bob, carol) = (Address::generate(&env), Address::generate(&env), Address::generate(&env));
    client.mint(&alice, &100);
    let payments = vec![
        &env,
        Payment { to: bob.clone(), amount: 10 },
        Payment { to: carol.clone(), amount: 15 },
    ];
    assert_eq!(client.transfer_batch(&alice, &payments), 25);
    assert_eq!(client.try_transfer_batch(&alice, &vec![&env]), Err(Ok(TokenError::InvalidBatch)));
    client.transfer_with_memo(&alice, &bob, &5, &Some(Memo::Hash(BytesN::from_array(&env, &[7; 32]))));
    client.transfer_with_memo(&alice, &bob, &5, &None);
    assert_eq!(client.balance(&bob), 20);
}

#[test]
fn burn_reduces_supply() {
    let (env, client, _) = setup();
    let alice = Address::generate(&env);
    client.mint(&alice, &100);
    client.burn(&alice, &30);
    assert_eq!(client.total_supply(), 70);
    assert_eq!(client.try_burn(&alice, &71), Err(Ok(TokenError::InsufficientBalance)));
}

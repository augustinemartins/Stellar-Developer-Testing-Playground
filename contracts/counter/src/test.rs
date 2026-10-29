#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::testutils::{Address as _, Events as _};
use soroban_sdk::{Event, Env};

fn setup() -> (Env, CounterClient<'static>, Address) {
    let env = Env::default();
    let owner = Address::generate(&env);
    let id = env.register(Counter, (owner.clone(),));
    let client = CounterClient::new(&env, &id);
    (env, client, owner)
}

#[test]
fn starts_at_zero() {
    let (_env, client, owner) = setup();
    assert_eq!(client.get(), 0);
    let stats = client.stats();
    assert_eq!(stats.owner, owner);
    assert_eq!(stats.max_step, MAX_STEP);
}

#[test]
fn increments_and_emits_events() {
    let (env, client, _) = setup();
    assert_eq!(client.increment(), 1);
    assert_eq!(
        env.events().all(),
        std::vec![Incremented { step: 1, count: 1 }.to_xdr(&env, &client.address)]
    );
    assert_eq!(client.increment_by(&10), 11);
    assert_eq!(client.stats().last_step, 10);
}

#[test]
fn rejects_invalid_steps() {
    let (_env, client, _) = setup();
    assert_eq!(client.try_increment_by(&0), Err(Ok(CounterError::InvalidStep)));
    assert_eq!(client.try_increment_by(&(MAX_STEP + 1)), Err(Ok(CounterError::InvalidStep)));
}

#[test]
fn reset_requires_owner_auth() {
    let (env, client, owner) = setup();
    env.mock_all_auths();
    client.increment_by(&5);
    assert_eq!(client.reset(&owner), 5);
    assert_eq!(env.auths()[0].0, owner);
    assert_eq!(client.get(), 0);

    let stranger = Address::generate(&env);
    assert_eq!(client.try_reset(&stranger), Err(Ok(CounterError::NotOwner)));
}

//! # Counter
//!
//! A deliberately small contract that exercises the features the playground
//! inspects: return values, typed errors, events, authorization and storage.
#![no_std]

use soroban_sdk::{contract, contracterror, contractevent, contractimpl, contracttype, Address, Env};

/// Largest step accepted by `increment_by`.
pub const MAX_STEP: u32 = 100;

const TTL_THRESHOLD: u32 = 17_280; // ~1 day of ledgers
const TTL_EXTEND_TO: u32 = 518_400; // ~30 days of ledgers

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CounterError {
    /// The counter would exceed `u32::MAX`.
    Overflow = 1,
    /// The step passed to `increment_by` is zero or larger than `MAX_STEP`.
    InvalidStep = 2,
    /// The caller is not the owner recorded at deployment.
    NotOwner = 3,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Count,
    Owner,
    LastStep,
}

/// Snapshot of the counter state.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CounterStats {
    pub count: u32,
    pub last_step: u32,
    pub owner: Address,
    pub max_step: u32,
}

/// Emitted every time the counter changes.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Incremented {
    #[topic]
    pub step: u32,
    pub count: u32,
}

/// Emitted when the owner resets the counter.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Reset {
    #[topic]
    pub owner: Address,
    pub previous: u32,
}

#[contract]
pub struct Counter;

#[contractimpl]
impl Counter {
    /// Deploys the counter with an owner who is allowed to reset it.
    pub fn __constructor(env: Env, owner: Address) {
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Count, &0u32);
    }

    /// Returns the current count.
    pub fn get(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    /// Adds one to the counter and returns the new value.
    pub fn increment(env: Env) -> Result<u32, CounterError> {
        Self::add(&env, 1)
    }

    /// Adds `step` (1..=100) to the counter and returns the new value.
    pub fn increment_by(env: Env, step: u32) -> Result<u32, CounterError> {
        if step == 0 || step > MAX_STEP {
            return Err(CounterError::InvalidStep);
        }
        Self::add(&env, step)
    }

    /// Resets the counter to zero. Requires the owner's authorization.
    pub fn reset(env: Env, caller: Address) -> Result<u32, CounterError> {
        caller.require_auth();
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        if caller != owner {
            return Err(CounterError::NotOwner);
        }
        let previous = Self::get(env.clone());
        env.storage().instance().set(&DataKey::Count, &0u32);
        Self::bump(&env);
        Reset { owner, previous }.publish(&env);
        Ok(previous)
    }

    /// Returns a structured snapshot of the counter state.
    pub fn stats(env: Env) -> CounterStats {
        let storage = env.storage().instance();
        CounterStats {
            count: storage.get(&DataKey::Count).unwrap_or(0),
            last_step: storage.get(&DataKey::LastStep).unwrap_or(0),
            owner: storage.get(&DataKey::Owner).unwrap(),
            max_step: MAX_STEP,
        }
    }

    fn add(env: &Env, step: u32) -> Result<u32, CounterError> {
        let count = Self::get(env.clone())
            .checked_add(step)
            .ok_or(CounterError::Overflow)?;
        let storage = env.storage().instance();
        storage.set(&DataKey::Count, &count);
        storage.set(&DataKey::LastStep, &step);
        Self::bump(env);
        Incremented { step, count }.publish(env);
        Ok(count)
    }

    fn bump(env: &Env) {
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

#[cfg(test)]
mod test;

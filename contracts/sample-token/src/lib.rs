//! # Sample token
//!
//! A compact fungible token used by the playground's tutorials. It follows the
//! shape of the SEP-41 token interface and adds a few methods with richer
//! argument types (structs, vectors, options and unions) so the playground's
//! typed input editor has something interesting to work with.
//!
//! This contract is for testing and education only. It has not been audited.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env, String, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BALANCE_BUMP: u32 = 30 * DAY_IN_LEDGERS;
const BALANCE_THRESHOLD: u32 = BALANCE_BUMP - DAY_IN_LEDGERS;
const INSTANCE_BUMP: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;

/// Maximum number of transfers accepted by `transfer_batch`.
pub const MAX_BATCH: u32 = 20;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum TokenError {
    /// The amount is zero or negative.
    InvalidAmount = 1,
    /// The sender does not hold enough tokens.
    InsufficientBalance = 2,
    /// The spender's allowance is too small or has expired.
    InsufficientAllowance = 3,
    /// The allowance expiration ledger is in the past.
    InvalidExpiration = 4,
    /// The batch is empty or larger than `MAX_BATCH`.
    InvalidBatch = 5,
    /// A balance would overflow `i128`.
    Overflow = 6,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Metadata,
    Supply,
    Balance(Address),
    Allowance(AllowanceKey),
}

#[contracttype]
#[derive(Clone)]
struct AllowanceKey {
    from: Address,
    spender: Address,
}

#[contracttype]
#[derive(Clone)]
struct AllowanceValue {
    amount: i128,
    expiration_ledger: u32,
}

/// Token metadata fixed at deployment.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenMetadata {
    pub decimals: u32,
    pub name: String,
    pub symbol: String,
}

/// One leg of a `transfer_batch` call.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Payment {
    pub to: Address,
    pub amount: i128,
}

/// An optional memo attached to `transfer_with_memo`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Memo {
    Text(String),
    Id(u64),
    Hash(soroban_sdk::BytesN<32>),
}

#[contractevent(topics = ["transfer"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Transfer {
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contractevent(topics = ["mint"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Mint {
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contractevent(topics = ["burn"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Burn {
    #[topic]
    pub from: Address,
    pub amount: i128,
}

#[contractevent(topics = ["approve"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Approve {
    #[topic]
    pub from: Address,
    #[topic]
    pub spender: Address,
    pub amount: i128,
    pub expiration_ledger: u32,
}

#[contractevent(topics = ["memo"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MemoAttached {
    #[topic]
    pub from: Address,
    pub memo: Memo,
}

#[contract]
pub struct SampleToken;

#[contractimpl]
impl SampleToken {
    /// Deploys the token with an admin allowed to mint.
    pub fn __constructor(env: Env, admin: Address, decimals: u32, name: String, symbol: String) {
        let storage = env.storage().instance();
        storage.set(&DataKey::Admin, &admin);
        storage.set(&DataKey::Metadata, &TokenMetadata { decimals, name, symbol });
        storage.set(&DataKey::Supply, &0i128);
    }

    // --- Read-only methods -------------------------------------------------

    /// Balance held by `id`.
    pub fn balance(env: Env, id: Address) -> i128 {
        read_balance(&env, &id)
    }

    /// Amount `spender` may still transfer on behalf of `from`.
    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        read_allowance(&env, &from, &spender).amount
    }

    pub fn decimals(env: Env) -> u32 {
        metadata(&env).decimals
    }

    pub fn name(env: Env) -> String {
        metadata(&env).name
    }

    pub fn symbol(env: Env) -> String {
        metadata(&env).symbol
    }

    /// All metadata in one call.
    pub fn metadata(env: Env) -> TokenMetadata {
        metadata(&env)
    }

    /// Total amount minted minus burned.
    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Supply).unwrap_or(0)
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    // --- State-changing methods --------------------------------------------

    /// Mints `amount` to `to`. Requires the admin's authorization.
    pub fn mint(env: Env, to: Address, amount: i128) -> Result<(), TokenError> {
        Self::admin(env.clone()).require_auth();
        check_amount(amount)?;
        bump_instance(&env);
        credit(&env, &to, amount)?;
        let supply = Self::total_supply(env.clone()).checked_add(amount).ok_or(TokenError::Overflow)?;
        env.storage().instance().set(&DataKey::Supply, &supply);
        Mint { to, amount }.publish(&env);
        Ok(())
    }

    /// Allows `spender` to move up to `amount` until `expiration_ledger`.
    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) -> Result<(), TokenError> {
        from.require_auth();
        if amount < 0 {
            return Err(TokenError::InvalidAmount);
        }
        if amount > 0 && expiration_ledger < env.ledger().sequence() {
            return Err(TokenError::InvalidExpiration);
        }
        bump_instance(&env);
        let key = DataKey::Allowance(AllowanceKey { from: from.clone(), spender: spender.clone() });
        let value = AllowanceValue { amount, expiration_ledger };
        env.storage().temporary().set(&key, &value);
        if amount > 0 {
            let live_for = expiration_ledger.saturating_sub(env.ledger().sequence());
            env.storage().temporary().extend_ttl(&key, live_for, live_for);
        }
        Approve { from, spender, amount, expiration_ledger }.publish(&env);
        Ok(())
    }

    /// Moves `amount` from `from` to `to`. Requires `from`'s authorization.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), TokenError> {
        from.require_auth();
        check_amount(amount)?;
        bump_instance(&env);
        move_balance(&env, &from, &to, amount)
    }

    /// Like `transfer`, with an optional memo published as an event.
    pub fn transfer_with_memo(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
        memo: Option<Memo>,
    ) -> Result<(), TokenError> {
        Self::transfer(env.clone(), from.clone(), to, amount)?;
        if let Some(memo) = memo {
            MemoAttached { from, memo }.publish(&env);
        }
        Ok(())
    }

    /// Pays several recipients in one call and returns the total sent.
    pub fn transfer_batch(env: Env, from: Address, payments: Vec<Payment>) -> Result<i128, TokenError> {
        from.require_auth();
        if payments.is_empty() || payments.len() > MAX_BATCH {
            return Err(TokenError::InvalidBatch);
        }
        bump_instance(&env);
        let mut total: i128 = 0;
        for payment in payments.iter() {
            check_amount(payment.amount)?;
            move_balance(&env, &from, &payment.to, payment.amount)?;
            total = total.checked_add(payment.amount).ok_or(TokenError::Overflow)?;
        }
        Ok(total)
    }

    /// Moves tokens using an allowance. Requires `spender`'s authorization.
    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), TokenError> {
        spender.require_auth();
        check_amount(amount)?;
        bump_instance(&env);
        spend_allowance(&env, &from, &spender, amount)?;
        move_balance(&env, &from, &to, amount)
    }

    /// Destroys `amount` of `from`'s tokens.
    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), TokenError> {
        from.require_auth();
        check_amount(amount)?;
        bump_instance(&env);
        debit(&env, &from, amount)?;
        let supply = Self::total_supply(env.clone()) - amount;
        env.storage().instance().set(&DataKey::Supply, &supply);
        Burn { from, amount }.publish(&env);
        Ok(())
    }
}

fn metadata(env: &Env) -> TokenMetadata {
    env.storage().instance().get(&DataKey::Metadata).unwrap()
}

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
}

fn check_amount(amount: i128) -> Result<(), TokenError> {
    if amount <= 0 {
        Err(TokenError::InvalidAmount)
    } else {
        Ok(())
    }
}

fn read_balance(env: &Env, id: &Address) -> i128 {
    let key = DataKey::Balance(id.clone());
    match env.storage().persistent().get::<_, i128>(&key) {
        Some(balance) => {
            env.storage().persistent().extend_ttl(&key, BALANCE_THRESHOLD, BALANCE_BUMP);
            balance
        }
        None => 0,
    }
}

fn write_balance(env: &Env, id: &Address, amount: i128) {
    let key = DataKey::Balance(id.clone());
    env.storage().persistent().set(&key, &amount);
    env.storage().persistent().extend_ttl(&key, BALANCE_THRESHOLD, BALANCE_BUMP);
}

fn credit(env: &Env, id: &Address, amount: i128) -> Result<(), TokenError> {
    let next = read_balance(env, id).checked_add(amount).ok_or(TokenError::Overflow)?;
    write_balance(env, id, next);
    Ok(())
}

fn debit(env: &Env, id: &Address, amount: i128) -> Result<(), TokenError> {
    let balance = read_balance(env, id);
    if balance < amount {
        return Err(TokenError::InsufficientBalance);
    }
    write_balance(env, id, balance - amount);
    Ok(())
}

fn move_balance(env: &Env, from: &Address, to: &Address, amount: i128) -> Result<(), TokenError> {
    debit(env, from, amount)?;
    credit(env, to, amount)?;
    Transfer { from: from.clone(), to: to.clone(), amount }.publish(env);
    Ok(())
}

fn read_allowance(env: &Env, from: &Address, spender: &Address) -> AllowanceValue {
    let key = DataKey::Allowance(AllowanceKey { from: from.clone(), spender: spender.clone() });
    match env.storage().temporary().get::<_, AllowanceValue>(&key) {
        Some(value) if value.expiration_ledger >= env.ledger().sequence() => value,
        _ => AllowanceValue { amount: 0, expiration_ledger: 0 },
    }
}

fn spend_allowance(env: &Env, from: &Address, spender: &Address, amount: i128) -> Result<(), TokenError> {
    let allowance = read_allowance(env, from, spender);
    if allowance.amount < amount {
        return Err(TokenError::InsufficientAllowance);
    }
    let key = DataKey::Allowance(AllowanceKey { from: from.clone(), spender: spender.clone() });
    env.storage().temporary().set(
        &key,
        &AllowanceValue { amount: allowance.amount - amount, expiration_ledger: allowance.expiration_ledger },
    );
    Ok(())
}

#[cfg(test)]
mod test;

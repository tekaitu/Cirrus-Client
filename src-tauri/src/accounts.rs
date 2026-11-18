//! The Microsoft accounts this installation knows about.
//!
//! Only the Minecraft profile name and id are kept here, in `accounts.json` in
//! the app config folder. The refresh tokens that make sign-in work live in
//! Windows Credential Manager, one entry per account (`microsoft-refresh-token:<id>`),
//! never in this file.
//!
//! The list is deliberately small and boring: it decides which account is
//! active and what the account menu shows. Nothing here is trusted for
//! launching — that still needs a live session from `auth`.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// A known account, exactly what the account menu needs.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    /// The Minecraft profile id (32 hex digits), also the Credential Manager suffix.
    pub id: String,
    /// The Minecraft player name, kept up to date on every successful sign-in.
    pub name: String,
}

/// The account list and which one is active.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownAccounts {
    #[serde(default)]
    pub active: Option<String>,
    #[serde(default)]
    pub accounts: Vec<Account>,
}

pub fn accounts_file(config_dir: &Path) -> PathBuf {
    config_dir.join("accounts.json")
}

/// A missing or damaged file means "no accounts yet" — never a crash.
pub fn load(path: &Path) -> KnownAccounts {
    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str::<KnownAccounts>(&text).ok())
        .map(sanitize)
        .unwrap_or_default()
}

fn save(path: &Path, known: &KnownAccounts) -> Result<(), String> {
    let text = serde_json::to_string_pretty(known).map_err(|e| format!("Could not save the account list: {e}"))?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("Could not create the account folder: {e}"))?;
    }
    fs::write(path, text).map_err(|e| format!("Could not save the account list: {e}"))
}

/// Keep the file honest: no empty ids, no duplicates, an active id that exists.
fn sanitize(mut known: KnownAccounts) -> KnownAccounts {
    let mut seen = std::collections::HashSet::new();
    known.accounts.retain(|a| !a.id.trim().is_empty() && !a.name.trim().is_empty() && seen.insert(a.id.clone()));
    known.active = known
        .active
        .filter(|id| known.accounts.iter().any(|a| &a.id == id))
        .or_else(|| known.accounts.first().map(|a| a.id.clone()));
    known
}

/// Adds the account (or refreshes its name) and makes it active.
pub fn upsert(path: &Path, id: &str, name: &str) -> Result<KnownAccounts, String> {
    let mut known = load(path);
    match known.accounts.iter_mut().find(|a| a.id == id) {
        Some(existing) => existing.name = name.to_string(),
        None => known.accounts.insert(0, Account { id: id.to_string(), name: name.to_string() }),
    }
    known.active = Some(id.to_string());
    let known = sanitize(known);
    save(path, &known)?;
    Ok(known)
}

/// Forgets one account. The active account moves to the next one, if any.
pub fn remove(path: &Path, id: &str) -> Result<KnownAccounts, String> {
    let mut known = load(path);
    known.accounts.retain(|a| a.id != id);
    if known.active.as_deref() == Some(id) {
        known.active = None;
    }
    let known = sanitize(known);
    save(path, &known)?;
    Ok(known)
}

/// Selects an account that is already in the list.
pub fn set_active(path: &Path, id: &str) -> Result<KnownAccounts, String> {
    let mut known = load(path);
    if !known.accounts.iter().any(|a| a.id == id) {
        return Err("That account is not signed in on this PC.".to_string());
    }
    known.active = Some(id.to_string());
    save(path, &known)?;
    Ok(known)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id(n: u8) -> String {
        format!("{:032x}", n)
    }

    #[test]
    fn a_missing_or_damaged_file_means_no_accounts() {
        let dir = tempfile::tempdir().unwrap();
        let path = accounts_file(dir.path());
        assert_eq!(load(&path), KnownAccounts::default());
        fs::write(&path, "{ not json").unwrap();
        assert_eq!(load(&path), KnownAccounts::default());
    }

    #[test]
    fn accounts_are_added_once_and_the_newest_becomes_active() {
        let dir = tempfile::tempdir().unwrap();
        let path = accounts_file(dir.path());
        upsert(&path, &id(1), "Steve").unwrap();
        upsert(&path, &id(2), "Alex").unwrap();
        let known = upsert(&path, &id(2), "Alexandra").unwrap();
        assert_eq!(known.accounts.len(), 2);
        assert_eq!(known.active.as_deref(), Some(id(2).as_str()));
        assert_eq!(known.accounts[0].name, "Alexandra");
        // The order stays stable when a name changes (no duplicate entry).
        assert_eq!(known.accounts[1].name, "Steve");
    }

    #[test]
    fn removing_the_active_account_picks_the_next_and_never_leaves_a_dangling_id() {
        let dir = tempfile::tempdir().unwrap();
        let path = accounts_file(dir.path());
        upsert(&path, &id(1), "Steve").unwrap();
        upsert(&path, &id(2), "Alex").unwrap();
        let known = remove(&path, &id(2)).unwrap();
        assert_eq!(known.accounts.len(), 1);
        assert_eq!(known.active.as_deref(), Some(id(1).as_str()));
        let known = remove(&path, &id(1)).unwrap();
        assert!(known.accounts.is_empty());
        assert_eq!(known.active, None);
    }

    #[test]
    fn only_listed_accounts_can_become_active_and_the_file_is_cleaned_up() {
        let dir = tempfile::tempdir().unwrap();
        let path = accounts_file(dir.path());
        upsert(&path, &id(1), "Steve").unwrap();
        assert!(set_active(&path, &id(9)).is_err());
        fs::write(
            &path,
            format!(
                r#"{{"active":"{}","accounts":[{{"id":"{}","name":"Steve"}},{{"id":"{}","name":"Steve"}},{{"id":"","name":"x"}}]}}"#,
                id(9),
                id(1),
                id(1)
            ),
        )
        .unwrap();
        let known = load(&path);
        assert_eq!(known.accounts.len(), 1);
        assert_eq!(known.active.as_deref(), Some(id(1).as_str()));
    }
}

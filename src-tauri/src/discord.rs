//! Discord Rich Presence ("Discord Status").
//!
//! Talks to the Discord desktop app over its local IPC pipe, so it needs no
//! login, no token and no internet access of its own. If Discord is not
//! running, every call quietly does nothing and the launcher works as usual.
//!
//! The Discord *Application ID* is public (it is not a secret). Create one at
//! https://discord.com/developers/applications, then build it into the EXE with
//! the `CIRRUS_DISCORD_APP_ID` environment variable (see docs/DISCORD.md).

use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use serde::Deserialize;
use std::sync::Mutex;

/// Name of the image uploaded under "Rich Presence > Art Assets" in the Discord developer portal.
pub const LARGE_IMAGE_KEY: &str = "cirrus_logo";
pub const COMMUNITY_URL: &str = "https://discord.gg/tWmvXNP7Af";

/// Discord application IDs are numeric "snowflakes" of 17 to 20 digits.
pub fn is_valid_app_id(id: &str) -> bool {
    (17..=20).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_digit())
}

/// The application ID built into this copy of Cirrus Client, if the build had one.
pub fn builtin_app_id() -> Option<&'static str> {
    option_env!("CIRRUS_DISCORD_APP_ID")
        .map(str::trim)
        .filter(|id| is_valid_app_id(id))
}

/// What the interface wants shown on the person's Discord profile.
#[derive(Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Presence {
    /// First line, e.g. "Playing Minecraft 1.21.11".
    pub details: String,
    /// Second line, e.g. "Fabric" (optional).
    pub state: Option<String>,
    /// Unix time in seconds; Discord shows "elapsed" from it (optional).
    pub started_at: Option<i64>,
}

/// Keeps the pipe to Discord open between updates.
#[derive(Default)]
pub struct DiscordState {
    client: Mutex<Option<DiscordIpcClient>>,
}

/// Discord limits these fields to 128 characters.
fn clip(s: &str) -> String {
    s.chars().take(120).collect()
}

fn build<'a>(details: &'a str, state: Option<&'a str>, started_at: Option<i64>) -> activity::Activity<'a> {
    let mut a = activity::Activity::new()
        .details(details)
        .assets(
            activity::Assets::new()
                .large_image(LARGE_IMAGE_KEY)
                .large_text("Cirrus Client"),
        )
        .buttons(vec![activity::Button::new("Join the community", COMMUNITY_URL)]);
    if let Some(s) = state {
        a = a.state(s);
    }
    if let Some(t) = started_at {
        a = a.timestamps(activity::Timestamps::new().start(t));
    }
    a
}

impl DiscordState {
    /// Shows `p` on Discord. `Ok(true)` = shown, `Ok(false)` = Discord is not running.
    pub fn set(&self, app_id: &str, p: &Presence) -> Result<bool, String> {
        let mut slot = self.client.lock().map_err(|_| "Discord state is unavailable.".to_string())?;
        let details = clip(&p.details);
        let state = p.state.as_deref().map(clip);
        // Two tries: the second one reconnects if Discord was restarted since the last update.
        for _ in 0..2 {
            if slot.is_none() {
                let mut client = DiscordIpcClient::new(app_id).map_err(|e| e.to_string())?;
                if client.connect().is_err() {
                    return Ok(false); // Discord is not running
                }
                *slot = Some(client);
            }
            if let Some(client) = slot.as_mut() {
                if client.set_activity(build(&details, state.as_deref(), p.started_at)).is_ok() {
                    return Ok(true);
                }
            }
            if let Some(mut dead) = slot.take() {
                let _ = dead.close();
            }
        }
        Ok(false)
    }

    /// Removes the status by closing the pipe (Discord clears a status when its app disconnects).
    pub fn clear(&self) {
        if let Ok(mut slot) = self.client.lock() {
            if let Some(mut client) = slot.take() {
                let _ = client.close();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_ids_are_17_to_20_digits() {
        assert!(is_valid_app_id("123456789012345678"));
        assert!(!is_valid_app_id("12345"));
        assert!(!is_valid_app_id("12345678901234567x"));
        assert!(!is_valid_app_id(""));
        assert!(!is_valid_app_id("123456789012345678901"));
    }

    #[test]
    fn presence_comes_from_camel_case_json() {
        let p: Presence = serde_json::from_str(r#"{"details":"Playing","state":"Fabric","startedAt":1700000000}"#).unwrap();
        assert_eq!(p, Presence { details: "Playing".into(), state: Some("Fabric".into()), started_at: Some(1_700_000_000) });
        let q: Presence = serde_json::from_str(r#"{"details":"In the launcher"}"#).unwrap();
        assert_eq!(q.state, None);
        assert_eq!(q.started_at, None);
    }

    #[test]
    fn long_text_is_clipped() {
        assert_eq!(clip(&"a".repeat(300)).chars().count(), 120);
        assert_eq!(clip("short"), "short");
    }

    #[test]
    fn without_discord_running_nothing_breaks() {
        // Clearing with no connection is a no-op.
        DiscordState::default().clear();
    }
}

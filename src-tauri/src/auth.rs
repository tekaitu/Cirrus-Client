//! Official Microsoft sign-in for Minecraft Java Edition.
//!
//! Flow (the one documented by Microsoft and Mojang for third-party launchers):
//! 1. Microsoft identity platform *device code* flow: the person opens a
//!    Microsoft page and types a short code. Limited FPS never sees a password.
//! 2. Xbox Live user token, then XSTS token for `rp://api.minecraftservices.com/`.
//! 3. Minecraft services `login_with_xbox`, then the Minecraft profile.
//!
//! Rules this module follows:
//! * Only the fixed Microsoft/Xbox/Minecraft endpoints are contacted (no redirects).
//! * The Microsoft refresh token is stored in Windows Credential Manager, never
//!   in a file. Tokens are never logged, never put into error messages, and never
//!   sent to the user interface; the UI only gets the profile name and id.
//! * The Azure application (client) ID is configured by the person who owns the
//!   app registration. Another launcher's ID is never used.
//! * Mojang must approve each new app registration; until then the final step
//!   fails with HTTP 403 and we say so plainly.

use reqwest::blocking::Client;
use serde::Serialize;
use serde_json::{json, Value};
use std::io::Read;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

pub const SCOPE: &str = "XboxLive.signin offline_access";
pub const KEYRING_SERVICE: &str = "Limited FPS";
pub const KEYRING_USER: &str = "microsoft-refresh-token";
const MAX_BODY: u64 = 1024 * 1024;

// ------------------------------------------------------------------ types

#[derive(Debug, Clone)]
pub struct Endpoints {
    pub authorize: String,
    pub device_code: String,
    pub token: String,
    pub xbox_user: String,
    pub xsts: String,
    pub mc_login: String,
    pub mc_profile: String,
}

impl Endpoints {
    pub fn production() -> Endpoints {
        Endpoints {
            authorize: "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize".into(),
            device_code: "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode".into(),
            token: "https://login.microsoftonline.com/consumers/oauth2/v2.0/token".into(),
            xbox_user: "https://user.auth.xboxlive.com/user/authenticate".into(),
            xsts: "https://xsts.auth.xboxlive.com/xsts/authorize".into(),
            mc_login: "https://api.minecraftservices.com/authentication/login_with_xbox".into(),
            mc_profile: "https://api.minecraftservices.com/minecraft/profile".into(),
        }
    }
}

/// What the person needs to see to finish signing in. The secret device code
/// stays inside this module.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCodeInfo {
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
}

#[derive(Debug, Clone)]
pub struct DeviceCode {
    device_code: String,
    pub info: DeviceCodeInfo,
    interval: u64,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Profile {
    pub id: String,
    pub name: String,
}

/// A signed-in Minecraft session. `mc_token` is kept in memory only, for the
/// future launch step, and is deliberately not `Serialize`.
#[derive(Clone)]
pub struct Session {
    pub profile: Profile,
    #[allow(dead_code)]
    pub mc_token: String,
    /// False when the refresh token could not be saved to Credential Manager.
    pub persisted: bool,
}

impl std::fmt::Debug for Session {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Session")
            .field("profile", &self.profile)
            .field("mc_token", &"<hidden>")
            .field("persisted", &self.persisted)
            .finish()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum AuthError {
    Cancelled,
    Expired,
    Declined,
    /// The server refused the saved or supplied credentials (e.g. `invalid_grant`).
    Rejected(String),
    Failed(String),
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::Cancelled => write!(f, "Sign-in cancelled."),
            AuthError::Expired => write!(f, "The sign-in code expired before it was used. Start again to get a new code."),
            AuthError::Declined => write!(f, "The sign-in was declined on the Microsoft page."),
            AuthError::Rejected(m) | AuthError::Failed(m) => write!(f, "{m}"),
        }
    }
}

fn failed(msg: impl Into<String>) -> AuthError {
    AuthError::Failed(msg.into())
}

// ----------------------------------------------------------- secret store

pub trait SecretStore: Send + Sync {
    fn save(&self, secret: &str) -> Result<(), String>;
    fn load(&self) -> Result<Option<String>, String>;
    fn clear(&self) -> Result<(), String>;
}

/// Windows Credential Manager (through the `keyring` crate).
pub struct KeyringStore;

impl KeyringStore {
    fn entry() -> Result<keyring::Entry, String> {
        keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
            .map_err(|e| format!("Credential Manager is not available: {e}"))
    }
}

impl SecretStore for KeyringStore {
    fn save(&self, secret: &str) -> Result<(), String> {
        Self::entry()?
            .set_password(secret)
            .map_err(|e| format!("Could not save the sign-in to Credential Manager: {e}"))
    }
    fn load(&self) -> Result<Option<String>, String> {
        match Self::entry()?.get_password() {
            Ok(s) => Ok(Some(s)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Could not read the saved sign-in: {e}")),
        }
    }
    fn clear(&self) -> Result<(), String> {
        match Self::entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Could not remove the saved sign-in: {e}")),
        }
    }
}

/// In-memory store, used by tests.
#[derive(Default)]
pub struct MemoryStore(Mutex<Option<String>>);

impl SecretStore for MemoryStore {
    fn save(&self, secret: &str) -> Result<(), String> {
        *self.0.lock().map_err(|_| "store poisoned".to_string())? = Some(secret.to_string());
        Ok(())
    }
    fn load(&self) -> Result<Option<String>, String> {
        Ok(self.0.lock().map_err(|_| "store poisoned".to_string())?.clone())
    }
    fn clear(&self) -> Result<(), String> {
        *self.0.lock().map_err(|_| "store poisoned".to_string())? = None;
        Ok(())
    }
}

// ----------------------------------------------------------------- helpers

/// Azure application (client) IDs are GUIDs: 8-4-4-4-12 hex digits.
pub fn is_valid_client_id(id: &str) -> bool {
    let parts: Vec<&str> = id.split('-').collect();
    let lens = [8usize, 4, 4, 4, 12];
    parts.len() == 5
        && parts
            .iter()
            .zip(lens.iter())
            .all(|(p, n)| p.len() == *n && p.bytes().all(|b| b.is_ascii_hexdigit()))
}

/// Only Microsoft pages may be opened from the sign-in dialog.
pub fn is_allowed_link(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://") else { return false };
    let host = rest.split(['/', '?', '#']).next().unwrap_or("");
    if host.contains('@') || host.contains(':') {
        return false;
    }
    matches!(
        host.to_ascii_lowercase().as_str(),
        "microsoft.com" | "www.microsoft.com" | "login.microsoftonline.com" | "login.live.com" | "aka.ms"
    )
}

pub fn http_client() -> Result<Client, AuthError> {
    Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(30))
        .user_agent(concat!("LimitedFPS/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| failed(format!("Could not set up a secure connection: {e}")))
}

fn net_error(e: reqwest::Error) -> AuthError {
    if e.is_timeout() {
        failed("The connection timed out. Check your internet connection and try again.")
    } else if e.is_connect() {
        failed("Could not connect to Microsoft. Check your internet connection and try again.")
    } else {
        failed("A network problem interrupted sign-in. Please try again.")
    }
}

fn read(resp: reqwest::blocking::Response) -> Result<(u16, Value), AuthError> {
    let status = resp.status().as_u16();
    let mut body = String::new();
    resp.take(MAX_BODY)
        .read_to_string(&mut body)
        .map_err(|_| failed("The server's answer could not be read."))?;
    Ok((status, serde_json::from_str(&body).unwrap_or(Value::Null)))
}

fn post_form(client: &Client, url: &str, params: &[(&str, &str)]) -> Result<(u16, Value), AuthError> {
    read(client.post(url).form(params).send().map_err(net_error)?)
}

fn post_json(client: &Client, url: &str, body: &Value) -> Result<(u16, Value), AuthError> {
    read(
        client
            .post(url)
            .header("Accept", "application/json")
            .header("x-xbl-contract-version", "1")
            .json(body)
            .send()
            .map_err(net_error)?,
    )
}

fn get_bearer(client: &Client, url: &str, token: &str) -> Result<(u16, Value), AuthError> {
    read(
        client
            .get(url)
            .header("Accept", "application/json")
            .bearer_auth(token)
            .send()
            .map_err(net_error)?,
    )
}

fn text(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).map(str::to_string)
}

/// Turn a Microsoft identity platform error into a plain-language message.
fn oauth_error(v: &Value, fallback: &str) -> AuthError {
    let code = text(v, "error").unwrap_or_default();
    let desc = text(v, "error_description").unwrap_or_default();
    let first_line = desc.lines().next().unwrap_or("").trim().to_string();
    let message = if desc.contains("AADSTS700016") || desc.contains("AADSTS700025") {
        "Microsoft does not recognise this app ID. Check the Application (client) ID in Settings.".to_string()
    } else if desc.contains("AADSTS7000218") || code == "invalid_client" || desc.contains("AADSTS70002") {
        "In Azure, open the app registration, then Authentication, and turn on \"Allow public client flows\".".to_string()
    } else if desc.contains("AADSTS50020") || desc.contains("AADSTS500200") {
        "In Azure, set the app's supported account types to include personal Microsoft accounts.".to_string()
    } else if !first_line.is_empty() {
        format!("{fallback}: {first_line}")
    } else if !code.is_empty() {
        format!("{fallback} ({code}).")
    } else {
        format!("{fallback}.")
    };
    if code == "invalid_grant" {
        AuthError::Rejected("Your Microsoft sign-in expired or was revoked. Please sign in again.".to_string())
    } else {
        AuthError::Failed(message)
    }
}

/// Sleep in short slices so cancelling feels instant.
fn wait(total: Duration, cancel: &AtomicBool) -> Result<(), AuthError> {
    let end = Instant::now() + total;
    loop {
        if cancel.load(Ordering::SeqCst) {
            return Err(AuthError::Cancelled);
        }
        let now = Instant::now();
        if now >= end {
            return Ok(());
        }
        std::thread::sleep((end - now).min(Duration::from_millis(200)));
    }
}

// ------------------------------------------------- sign-in window (PKCE)

/// Register this exact address under "Mobile and desktop applications" in Azure.
pub const REDIRECT_URI: &str = "https://login.microsoftonline.com/consumers/oauth2/nativeclient";

/// The public app ID built into this copy of Limited FPS, if the build had one.
pub fn builtin_client_id() -> Option<&'static str> {
    option_env!("LIMITEDFPS_MS_CLIENT_ID")
        .map(str::trim)
        .filter(|id| is_valid_client_id(id))
}

/// URL-safe base64 without padding (RFC 4648 section 5).
pub fn b64url(bytes: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::with_capacity(bytes.len() * 4 / 3 + 4);
    for chunk in bytes.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = (u32::from(b[0]) << 16) | (u32::from(b[1]) << 8) | u32::from(b[2]);
        out.push(T[(n >> 18) as usize & 63] as char);
        out.push(T[(n >> 12) as usize & 63] as char);
        if chunk.len() > 1 {
            out.push(T[(n >> 6) as usize & 63] as char);
        }
        if chunk.len() > 2 {
            out.push(T[n as usize & 63] as char);
        }
    }
    out
}

pub fn pkce_challenge(verifier: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(verifier.as_bytes());
    b64url(&h.finalize())
}

fn random_token(len: usize) -> Result<String, AuthError> {
    let mut bytes = vec![0u8; len];
    getrandom::getrandom(&mut bytes).map_err(|_| failed("Windows could not provide secure random numbers."))?;
    Ok(b64url(&bytes))
}

pub struct AuthRequest {
    pub url: String,
    pub state: String,
    verifier: String,
}

pub fn build_auth_request(ep: &Endpoints, client_id: &str) -> Result<AuthRequest, AuthError> {
    let verifier = random_token(48)?;
    let state = random_token(24)?;
    let challenge = pkce_challenge(&verifier);
    let url = reqwest::Url::parse_with_params(
        &ep.authorize,
        &[
            ("client_id", client_id),
            ("response_type", "code"),
            ("redirect_uri", REDIRECT_URI),
            ("scope", SCOPE),
            ("code_challenge", challenge.as_str()),
            ("code_challenge_method", "S256"),
            ("state", state.as_str()),
            ("prompt", "select_account"),
        ],
    )
    .map_err(|_| failed("Could not build the sign-in address."))?;
    Ok(AuthRequest { url: url.to_string(), state, verifier })
}

/// True for the address Microsoft sends the browser to when sign-in is done.
pub fn is_redirect(url: &str) -> bool {
    url.starts_with(REDIRECT_URI)
        && matches!(url.as_bytes().get(REDIRECT_URI.len()), None | Some(b'?') | Some(b'#') | Some(b'/'))
}

/// Pages the sign-in window may show: HTTPS pages on Microsoft's sign-in hosts.
pub fn is_login_page(url: &reqwest::Url) -> bool {
    if url.scheme() != "https" || url.port().is_some() || !url.username().is_empty() {
        return false;
    }
    let host = url.host_str().unwrap_or("").to_ascii_lowercase();
    ["microsoftonline.com", "microsoft.com", "live.com", "msauth.net", "msftauth.net", "microsoftonline-p.com"]
        .iter()
        .any(|d| host == *d || host.ends_with(&format!(".{d}")))
}

/// Pull the authorization code out of the final redirect, checking `state`.
pub fn parse_redirect(redirect: &str, expected_state: &str) -> Result<String, AuthError> {
    let url = reqwest::Url::parse(redirect).map_err(|_| failed("Microsoft's answer could not be read."))?;
    let get = |k: &str| url.query_pairs().find(|(key, _)| key == k).map(|(_, v)| v.to_string());
    if let Some(err) = get("error") {
        return Err(if err == "access_denied" {
            AuthError::Declined
        } else {
            let desc = get("error_description").unwrap_or_default();
            let line = desc.lines().next().unwrap_or("").trim();
            failed(if line.is_empty() { format!("Sign-in failed ({err}).") } else { format!("Sign-in failed: {line}") })
        });
    }
    if get("state").as_deref() != Some(expected_state) {
        return Err(failed("The sign-in answer did not match this request, so it was ignored."));
    }
    get("code").ok_or_else(|| failed("Microsoft's answer had no sign-in code."))
}

fn exchange_code(
    client: &Client,
    ep: &Endpoints,
    client_id: &str,
    code: &str,
    verifier: &str,
) -> Result<MsTokens, AuthError> {
    let (status, v) = post_form(
        client,
        &ep.token,
        &[
            ("grant_type", "authorization_code"),
            ("client_id", client_id),
            ("code", code),
            ("redirect_uri", REDIRECT_URI),
            ("code_verifier", verifier),
            ("scope", SCOPE),
        ],
    )?;
    if status != 200 {
        return Err(oauth_error(&v, "Sign-in failed"));
    }
    tokens_from(&v)
}

/// Sign in through Microsoft's own page shown in a window. `show_window` opens
/// the given address, waits for the person to finish, and returns the final
/// redirect address (or `Cancelled`).
pub fn sign_in_window(
    ep: &Endpoints,
    client_id: &str,
    store: &dyn SecretStore,
    cancel: &AtomicBool,
    show_window: &dyn Fn(&str) -> Result<String, AuthError>,
) -> Result<Session, AuthError> {
    if !is_valid_client_id(client_id) {
        return Err(failed("Sign-in is not set up in this build of Limited FPS."));
    }
    let client = http_client()?;
    let request = build_auth_request(ep, client_id)?;
    let redirect = show_window(&request.url)?;
    if cancel.load(Ordering::SeqCst) {
        return Err(AuthError::Cancelled);
    }
    let code = parse_redirect(&redirect, &request.state)?;
    let ms = exchange_code(&client, ep, client_id, &code, &request.verifier)?;
    let (mc_token, profile) = finish(&client, ep, &ms.access_token)?;
    let persisted = persist(store, &ms.refresh_token);
    Ok(Session { profile, mc_token, persisted })
}

// ----------------------------------------------------------- Microsoft OAuth

pub fn request_device_code(client: &Client, ep: &Endpoints, client_id: &str) -> Result<DeviceCode, AuthError> {
    let (status, v) = post_form(client, &ep.device_code, &[("client_id", client_id), ("scope", SCOPE)])?;
    if status != 200 {
        return Err(oauth_error(&v, "Microsoft could not start sign-in"));
    }
    let user_code = text(&v, "user_code").ok_or_else(|| failed("Microsoft's answer had no sign-in code."))?;
    let device_code = text(&v, "device_code").ok_or_else(|| failed("Microsoft's answer was incomplete."))?;
    let verification_uri = text(&v, "verification_uri").unwrap_or_else(|| "https://www.microsoft.com/link".to_string());
    let expires_in = v.get("expires_in").and_then(Value::as_u64).unwrap_or(900);
    let interval = v.get("interval").and_then(Value::as_u64).unwrap_or(5);
    Ok(DeviceCode {
        device_code,
        info: DeviceCodeInfo { user_code, verification_uri, expires_in },
        interval,
    })
}

struct MsTokens {
    access_token: String,
    refresh_token: Option<String>,
}

fn tokens_from(v: &Value) -> Result<MsTokens, AuthError> {
    Ok(MsTokens {
        access_token: text(v, "access_token").ok_or_else(|| failed("Microsoft's answer had no access token."))?,
        refresh_token: text(v, "refresh_token"),
    })
}

fn poll_for_token(
    client: &Client,
    ep: &Endpoints,
    client_id: &str,
    dc: &DeviceCode,
    cancel: &AtomicBool,
) -> Result<MsTokens, AuthError> {
    let deadline = Instant::now() + Duration::from_secs(dc.info.expires_in);
    let mut interval = dc.interval;
    loop {
        wait(Duration::from_secs(interval), cancel)?;
        if Instant::now() >= deadline {
            return Err(AuthError::Expired);
        }
        let (status, v) = post_form(
            client,
            &ep.token,
            &[
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("client_id", client_id),
                ("device_code", &dc.device_code),
            ],
        )?;
        if status == 200 {
            return tokens_from(&v);
        }
        match v.get("error").and_then(Value::as_str) {
            Some("authorization_pending") => continue,
            Some("slow_down") => interval += 5,
            Some("authorization_declined") => return Err(AuthError::Declined),
            Some("expired_token") | Some("bad_verification_code") => return Err(AuthError::Expired),
            _ => return Err(oauth_error(&v, "Sign-in failed")),
        }
    }
}

fn refresh_tokens(client: &Client, ep: &Endpoints, client_id: &str, refresh_token: &str) -> Result<MsTokens, AuthError> {
    let (status, v) = post_form(
        client,
        &ep.token,
        &[
            ("grant_type", "refresh_token"),
            ("client_id", client_id),
            ("refresh_token", refresh_token),
            ("scope", SCOPE),
        ],
    )?;
    if status != 200 {
        return Err(oauth_error(&v, "Could not renew the sign-in"));
    }
    tokens_from(&v)
}

// --------------------------------------------------------- Xbox + Minecraft

fn xsts_error_message(code: u64) -> String {
    match code {
        2148916233 => "This Microsoft account has no Xbox profile. Create one at xbox.com, then try again.".to_string(),
        2148916235 => "Xbox Live is not available in this account's country or region.".to_string(),
        2148916236 | 2148916237 => "This account needs adult verification on the Xbox website before it can sign in.".to_string(),
        2148916238 => "This is a child account. A family organiser must add it to a Microsoft family group first.".to_string(),
        other => format!("Xbox Live refused the sign-in (code {other})."),
    }
}

/// Microsoft access token -> (XSTS token, user hash).
fn xbox_chain(client: &Client, ep: &Endpoints, ms_access_token: &str) -> Result<(String, String), AuthError> {
    let (status, v) = post_json(
        client,
        &ep.xbox_user,
        &json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={ms_access_token}")
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        }),
    )?;
    if status != 200 {
        return Err(failed(format!("Xbox Live sign-in failed (HTTP {status}).")));
    }
    let xbl = text(&v, "Token").ok_or_else(|| failed("Xbox Live's answer had no token."))?;

    let (status, v) = post_json(
        client,
        &ep.xsts,
        &json!({
            "Properties": { "SandboxId": "RETAIL", "UserTokens": [xbl] },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        }),
    )?;
    if status == 401 {
        let code = v.get("XErr").and_then(Value::as_u64).unwrap_or(0);
        return Err(failed(xsts_error_message(code)));
    }
    if status != 200 {
        return Err(failed(format!("Xbox security token request failed (HTTP {status}).")));
    }
    let token = text(&v, "Token").ok_or_else(|| failed("Xbox's answer had no security token."))?;
    let uhs = v
        .get("DisplayClaims")
        .and_then(|d| d.get("xui"))
        .and_then(|x| x.get(0))
        .and_then(|x| x.get("uhs"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| failed("Xbox's answer had no user hash."))?;
    Ok((token, uhs))
}

fn minecraft_login(client: &Client, ep: &Endpoints, xsts: &str, uhs: &str) -> Result<String, AuthError> {
    let (status, v) = post_json(
        client,
        &ep.mc_login,
        &json!({ "identityToken": format!("XBL3.0 x={uhs};{xsts}") }),
    )?;
    match status {
        200 => text(&v, "access_token").ok_or_else(|| failed("Minecraft's answer had no access token.")),
        403 => Err(failed(
            "Minecraft services rejected this app registration (HTTP 403). New Azure apps must be approved by Mojang before sign-in works; see docs/AUTH.md.",
        )),
        429 => Err(failed("Minecraft services are rate-limiting sign-in. Wait a few minutes and try again.")),
        other => Err(failed(format!("Minecraft sign-in failed (HTTP {other})."))),
    }
}

fn fetch_profile(client: &Client, ep: &Endpoints, mc_token: &str) -> Result<Profile, AuthError> {
    let (status, v) = get_bearer(client, &ep.mc_profile, mc_token)?;
    match status {
        200 => {
            let id = text(&v, "id").ok_or_else(|| failed("The Minecraft profile had no id."))?;
            let name = text(&v, "name").ok_or_else(|| failed("The Minecraft profile had no name."))?;
            Ok(Profile { id, name })
        }
        404 => Err(failed(
            "This Microsoft account does not own Minecraft: Java Edition (no profile was found).",
        )),
        401 => Err(failed("Minecraft rejected the sign-in token.")),
        other => Err(failed(format!("Could not read the Minecraft profile (HTTP {other}).")),),
    }
}

/// Microsoft access token -> Minecraft session.
fn finish(client: &Client, ep: &Endpoints, ms_access_token: &str) -> Result<(String, Profile), AuthError> {
    let (xsts, uhs) = xbox_chain(client, ep, ms_access_token)?;
    let mc_token = minecraft_login(client, ep, &xsts, &uhs)?;
    let profile = fetch_profile(client, ep, &mc_token)?;
    Ok((mc_token, profile))
}

fn persist(store: &dyn SecretStore, refresh_token: &Option<String>) -> bool {
    match refresh_token {
        Some(t) => store.save(t).is_ok(),
        None => false,
    }
}

// --------------------------------------------------------------- public flow

/// Full interactive sign-in. `on_code` is called once with the code to show.
pub fn sign_in(
    ep: &Endpoints,
    client_id: &str,
    store: &dyn SecretStore,
    cancel: &AtomicBool,
    on_code: &dyn Fn(&DeviceCodeInfo),
) -> Result<Session, AuthError> {
    if !is_valid_client_id(client_id) {
        return Err(failed("Sign-in is not set up: enter your Azure Application (client) ID in Settings."));
    }
    let client = http_client()?;
    let dc = request_device_code(&client, ep, client_id)?;
    on_code(&dc.info);
    let ms = poll_for_token(&client, ep, client_id, &dc, cancel)?;
    if cancel.load(Ordering::SeqCst) {
        return Err(AuthError::Cancelled);
    }
    let (mc_token, profile) = finish(&client, ep, &ms.access_token)?;
    let persisted = persist(store, &ms.refresh_token);
    Ok(Session { profile, mc_token, persisted })
}

/// Silent sign-in from the saved refresh token. `Ok(None)` means nothing was saved.
pub fn restore(ep: &Endpoints, client_id: &str, store: &dyn SecretStore) -> Result<Option<Session>, AuthError> {
    let Some(saved) = store.load().map_err(AuthError::Failed)? else {
        return Ok(None);
    };
    let client = http_client()?;
    let ms = match refresh_tokens(&client, ep, client_id, &saved) {
        Ok(ms) => ms,
        Err(AuthError::Rejected(m)) => {
            let _ = store.clear();
            return Err(AuthError::Rejected(m));
        }
        Err(e) => return Err(e),
    };
    let (mc_token, profile) = finish(&client, ep, &ms.access_token)?;
    // Microsoft may rotate the refresh token; keep the newest one.
    let persisted = if ms.refresh_token.is_some() { persist(store, &ms.refresh_token) } else { true };
    Ok(Some(Session { profile, mc_token, persisted }))
}

pub fn sign_out(store: &dyn SecretStore) -> Result<(), String> {
    store.clear()
}

// ------------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::sync::atomic::AtomicUsize;
    use std::sync::Arc;

    const ID: &str = "12345678-90ab-cdef-1234-567890abcdef";

    /// Tiny HTTP server: `handler(method, path, body) -> (status, json)`.
    fn serve(
        handler: impl Fn(&str, &str, &str) -> (u16, String) + Send + 'static,
    ) -> (String, Arc<AtomicUsize>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://127.0.0.1:{}", listener.local_addr().unwrap().port());
        let hits = Arc::new(AtomicUsize::new(0));
        let counter = hits.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { return };
                counter.fetch_add(1, Ordering::SeqCst);
                let mut data = Vec::new();
                let mut buf = [0u8; 4096];
                let header_end;
                loop {
                    let n = stream.read(&mut buf).unwrap_or(0);
                    if n == 0 {
                        return;
                    }
                    data.extend_from_slice(&buf[..n]);
                    if let Some(pos) = data.windows(4).position(|w| w == b"\r\n\r\n") {
                        header_end = pos + 4;
                        break;
                    }
                }
                let head = String::from_utf8_lossy(&data[..header_end]).to_string();
                let len: usize = head
                    .lines()
                    .find_map(|l| l.to_ascii_lowercase().strip_prefix("content-length:").map(|v| v.trim().parse().unwrap_or(0)))
                    .unwrap_or(0);
                while data.len() < header_end + len {
                    let n = stream.read(&mut buf).unwrap_or(0);
                    if n == 0 {
                        break;
                    }
                    data.extend_from_slice(&buf[..n]);
                }
                let body = String::from_utf8_lossy(&data[header_end..]).to_string();
                let mut first = head.lines().next().unwrap_or("").split_whitespace();
                let method = first.next().unwrap_or("").to_string();
                let path = first.next().unwrap_or("").to_string();
                let (status, reply) = handler(&method, &path, &body);
                let out = format!(
                    "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{reply}",
                    reply.len()
                );
                let _ = stream.write_all(out.as_bytes());
            }
        });
        (base, hits)
    }
    use std::io::Write;

    fn endpoints(base: &str) -> Endpoints {
        Endpoints {
            authorize: format!("{base}/authorize"),
            device_code: format!("{base}/devicecode"),
            token: format!("{base}/token"),
            xbox_user: format!("{base}/xbl"),
            xsts: format!("{base}/xsts"),
            mc_login: format!("{base}/mclogin"),
            mc_profile: format!("{base}/profile"),
        }
    }

    /// A server that behaves like the real chain; `tweak` can override a path.
    fn happy_chain(
        tweak: impl Fn(&str, &str) -> Option<(u16, String)> + Send + 'static,
    ) -> (String, Arc<AtomicUsize>) {
        serve(move |_m, path, body| {
            if let Some(r) = tweak(path, body) {
                return r;
            }
            match path {
                "/devicecode" => (200, json!({"user_code":"ABCD1234","device_code":"DEV-SECRET","verification_uri":"https://www.microsoft.com/link","expires_in":60,"interval":0}).to_string()),
                "/token" => (200, json!({"access_token":"MS-ACCESS","refresh_token":"MS-REFRESH","expires_in":3600}).to_string()),
                "/xbl" => (200, json!({"Token":"XBL-TOKEN","DisplayClaims":{"xui":[{"uhs":"UHS1"}]}}).to_string()),
                "/xsts" => (200, json!({"Token":"XSTS-TOKEN","DisplayClaims":{"xui":[{"uhs":"UHS1"}]}}).to_string()),
                "/mclogin" => {
                    assert!(body.contains("XBL3.0 x=UHS1;XSTS-TOKEN"), "unexpected login body: {body}");
                    (200, json!({"access_token":"MC-TOKEN","expires_in":86400}).to_string())
                }
                "/profile" => (200, json!({"id":"0123456789abcdef0123456789abcdef","name":"Steve"}).to_string()),
                _ => (404, "{}".to_string()),
            }
        })
    }

    #[test]
    fn pkce_challenge_matches_the_rfc_7636_example() {
        assert_eq!(
            pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn base64url_handles_every_padding_case() {
        assert_eq!(b64url(b""), "");
        assert_eq!(b64url(b"f"), "Zg");
        assert_eq!(b64url(b"fo"), "Zm8");
        assert_eq!(b64url(b"foo"), "Zm9v");
        assert_eq!(b64url(&[0xfb, 0xff]), "-_8");
    }

    #[test]
    fn auth_request_carries_pkce_state_and_the_fixed_redirect() {
        let a = build_auth_request(&Endpoints::production(), ID).unwrap();
        let u = reqwest::Url::parse(&a.url).unwrap();
        assert_eq!(u.host_str(), Some("login.microsoftonline.com"));
        let q: std::collections::HashMap<_, _> = u.query_pairs().into_owned().collect();
        assert_eq!(q["client_id"], ID);
        assert_eq!(q["response_type"], "code");
        assert_eq!(q["redirect_uri"], REDIRECT_URI);
        assert_eq!(q["code_challenge_method"], "S256");
        assert_eq!(q["scope"], SCOPE);
        assert_eq!(q["state"], a.state);
        assert_eq!(q["code_challenge"], pkce_challenge(&a.verifier));
        assert!(a.verifier.len() >= 43);
        let b = build_auth_request(&Endpoints::production(), ID).unwrap();
        assert_ne!(a.state, b.state);
    }

    #[test]
    fn redirect_detection_and_login_page_allow_list() {
        assert!(is_redirect(&format!("{REDIRECT_URI}?code=abc&state=s")));
        assert!(is_redirect(REDIRECT_URI));
        assert!(!is_redirect(&format!("{REDIRECT_URI}evil?code=abc")));
        assert!(!is_redirect("https://evil.example.com/?https://login.microsoftonline.com/consumers/oauth2/nativeclient"));
        for ok in ["https://login.microsoftonline.com/x", "https://login.live.com/", "https://account.live.com/x", "https://aadcdn.msauth.net/a.js", "https://www.microsoft.com/"] {
            assert!(is_login_page(&reqwest::Url::parse(ok).unwrap()), "{ok}");
        }
        for bad in ["http://login.live.com/", "https://evil.com/", "https://login.live.com.evil.com/", "https://notlive.com/", "https://login.live.com:8443/", "https://a@login.live.com/"] {
            assert!(!is_login_page(&reqwest::Url::parse(bad).unwrap()), "{bad}");
        }
    }

    #[test]
    fn redirect_parsing_checks_state_and_reports_denials() {
        let ok = format!("{REDIRECT_URI}?code=CODE%2B1&state=S");
        assert_eq!(parse_redirect(&ok, "S").unwrap(), "CODE+1");
        assert!(parse_redirect(&ok, "OTHER").unwrap_err().to_string().contains("did not match"));
        assert!(parse_redirect(&format!("{REDIRECT_URI}?state=S"), "S").is_err());
        assert_eq!(parse_redirect(&format!("{REDIRECT_URI}?error=access_denied&state=S"), "S").unwrap_err(), AuthError::Declined);
        let e = parse_redirect(&format!("{REDIRECT_URI}?error=server_error&error_description=Oops%0D%0Atrace&state=S"), "S").unwrap_err();
        assert!(e.to_string().contains("Oops"));
    }

    #[test]
    fn window_sign_in_exchanges_the_code_with_the_pkce_verifier() {
        let (base, _) = happy_chain(|path, body| {
            (path == "/token").then(|| {
                assert!(body.contains("grant_type=authorization_code"), "{body}");
                assert!(body.contains("code=THE-CODE") && body.contains("code_verifier="), "{body}");
                (200, json!({"access_token":"MS-ACCESS","refresh_token":"MS-REFRESH"}).to_string())
            })
        });
        let store = MemoryStore::default();
        let shown = Mutex::new(String::new());
        let session = sign_in_window(&endpoints(&base), ID, &store, &AtomicBool::new(false), &|url| {
            *shown.lock().unwrap() = url.to_string();
            let state = reqwest::Url::parse(url).unwrap().query_pairs().find(|(k, _)| k == "state").unwrap().1.to_string();
            Ok(format!("{REDIRECT_URI}?code=THE-CODE&state={state}"))
        })
        .unwrap();
        assert_eq!(session.profile.name, "Steve");
        assert!(shown.lock().unwrap().starts_with(&format!("{base}/authorize?")));
        assert_eq!(store.load().unwrap().as_deref(), Some("MS-REFRESH"));
    }

    #[test]
    fn window_sign_in_stops_on_cancel_or_forged_answers() {
        let (base, hits) = happy_chain(|_, _| None);
        let err = sign_in_window(&endpoints(&base), ID, &MemoryStore::default(), &AtomicBool::new(false), &|_| Err(AuthError::Cancelled)).unwrap_err();
        assert_eq!(err, AuthError::Cancelled);
        let err = sign_in_window(&endpoints(&base), ID, &MemoryStore::default(), &AtomicBool::new(false), &|_| Ok(format!("{REDIRECT_URI}?code=X&state=forged"))).unwrap_err();
        assert!(err.to_string().contains("did not match"));
        assert_eq!(hits.load(Ordering::SeqCst), 0); // no request ever left
    }

    #[test]
    fn client_ids_must_be_guids() {
        assert!(is_valid_client_id(ID));
        assert!(is_valid_client_id("ABCDEF12-3456-7890-ABCD-EF1234567890"));
        for bad in ["", "abc", "12345678-90ab-cdef-1234-567890abcde", "12345678-90ab-cdef-1234-567890abcdeg", "12345678_90ab_cdef_1234_567890abcdef"] {
            assert!(!is_valid_client_id(bad), "{bad}");
        }
    }

    #[test]
    fn only_microsoft_pages_may_be_opened() {
        assert!(is_allowed_link("https://www.microsoft.com/link"));
        assert!(is_allowed_link("https://login.microsoftonline.com/common/oauth2/deviceauth"));
        assert!(is_allowed_link("https://aka.ms/remoteconnect"));
        for bad in [
            "http://www.microsoft.com/link",
            "https://microsoft.com.evil.net/link",
            "https://evil.net/https://microsoft.com",
            "https://user@www.microsoft.com/link",
            "https://www.microsoft.com:8443/link",
            "file:///C:/Windows/System32/calc.exe",
            "javascript:alert(1)",
            "",
        ] {
            assert!(!is_allowed_link(bad), "{bad}");
        }
    }

    #[test]
    fn full_sign_in_returns_the_profile_and_saves_only_the_refresh_token() {
        let (base, _) = happy_chain(|_, _| None);
        let store = MemoryStore::default();
        let shown = Mutex::new(None);
        let session = sign_in(&endpoints(&base), ID, &store, &AtomicBool::new(false), &|info| {
            *shown.lock().unwrap() = Some(info.clone());
        })
        .unwrap();
        assert_eq!(session.profile, Profile { id: "0123456789abcdef0123456789abcdef".into(), name: "Steve".into() });
        assert!(session.persisted);
        assert_eq!(store.load().unwrap().as_deref(), Some("MS-REFRESH"));
        let info = shown.lock().unwrap().clone().unwrap();
        assert_eq!(info.user_code, "ABCD1234");
        // The secret device code and tokens never appear in what the UI is shown or in Debug output.
        let ui = serde_json::to_string(&info).unwrap();
        assert!(!ui.contains("DEV-SECRET"));
        assert!(!format!("{session:?}").contains("MC-TOKEN"));
    }

    #[test]
    fn polling_waits_through_pending_and_slow_down() {
        let polls = Arc::new(AtomicUsize::new(0));
        let p = polls.clone();
        let (base, _) = happy_chain(move |path, _| {
            if path == "/token" {
                let n = p.fetch_add(1, Ordering::SeqCst);
                return match n {
                    0 => Some((400, json!({"error":"authorization_pending"}).to_string())),
                    // slow_down adds 5 s to the interval, so keep this test to one pending round
                    _ => None,
                };
            }
            None
        });
        let session = sign_in(&endpoints(&base), ID, &MemoryStore::default(), &AtomicBool::new(false), &|_| {}).unwrap();
        assert_eq!(session.profile.name, "Steve");
        assert_eq!(polls.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn declined_and_expired_codes_are_reported() {
        let (base, _) = happy_chain(|path, _| (path == "/token").then(|| (400, json!({"error":"authorization_declined"}).to_string())));
        let err = sign_in(&endpoints(&base), ID, &MemoryStore::default(), &AtomicBool::new(false), &|_| {}).unwrap_err();
        assert_eq!(err, AuthError::Declined);
        let (base, _) = happy_chain(|path, _| (path == "/token").then(|| (400, json!({"error":"expired_token"}).to_string())));
        let err = sign_in(&endpoints(&base), ID, &MemoryStore::default(), &AtomicBool::new(false), &|_| {}).unwrap_err();
        assert_eq!(err, AuthError::Expired);
    }

    #[test]
    fn cancelling_stops_before_any_token_request() {
        let (base, hits) = happy_chain(|_, _| None);
        let cancel = AtomicBool::new(false);
        let err = sign_in(&endpoints(&base), ID, &MemoryStore::default(), &cancel, &|_| cancel.store(true, Ordering::SeqCst)).unwrap_err();
        assert_eq!(err, AuthError::Cancelled);
        assert_eq!(hits.load(Ordering::SeqCst), 1); // only the device-code request
    }

    #[test]
    fn invalid_client_id_is_refused_without_network() {
        let (base, hits) = happy_chain(|_, _| None);
        let err = sign_in(&endpoints(&base), "nope", &MemoryStore::default(), &AtomicBool::new(false), &|_| {}).unwrap_err();
        assert!(err.to_string().contains("Settings"));
        assert_eq!(hits.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn azure_misconfiguration_gets_actionable_messages() {
        let (base, _) = happy_chain(|path, _| (path == "/devicecode").then(|| (400, json!({"error":"unauthorized_client","error_description":"AADSTS700016: Application with identifier 'x' was not found"}).to_string())));
        let err = sign_in(&endpoints(&base), ID, &MemoryStore::default(), &AtomicBool::new(false), &|_| {}).unwrap_err();
        assert!(err.to_string().contains("app ID"));
        let (base, _) = happy_chain(|path, _| (path == "/devicecode").then(|| (400, json!({"error":"invalid_client","error_description":"AADSTS7000218: The request body must contain client_assertion"}).to_string())));
        let err = sign_in(&endpoints(&base), ID, &MemoryStore::default(), &AtomicBool::new(false), &|_| {}).unwrap_err();
        assert!(err.to_string().contains("public client"));
    }

    #[test]
    fn xbox_account_problems_are_explained() {
        for (code, expect) in [(2148916233u64, "no Xbox profile"), (2148916235, "country"), (2148916238, "family")] {
            let (base, _) = happy_chain(move |path, _| (path == "/xsts").then(|| (401, json!({"XErr": code}).to_string())));
            let err = sign_in(&endpoints(&base), ID, &MemoryStore::default(), &AtomicBool::new(false), &|_| {}).unwrap_err();
            assert!(err.to_string().contains(expect), "{err}");
        }
    }

    #[test]
    fn unapproved_app_registration_and_missing_game_are_explained() {
        let (base, _) = happy_chain(|path, _| (path == "/mclogin").then(|| (403, "{}".to_string())));
        let err = sign_in(&endpoints(&base), ID, &MemoryStore::default(), &AtomicBool::new(false), &|_| {}).unwrap_err();
        assert!(err.to_string().contains("approved by Mojang"));
        let (base, _) = happy_chain(|path, _| (path == "/profile").then(|| (404, "{}".to_string())));
        let err = sign_in(&endpoints(&base), ID, &MemoryStore::default(), &AtomicBool::new(false), &|_| {}).unwrap_err();
        assert!(err.to_string().contains("does not own Minecraft"));
    }

    #[test]
    fn restore_without_a_saved_login_does_nothing() {
        let (base, hits) = happy_chain(|_, _| None);
        assert!(restore(&endpoints(&base), ID, &MemoryStore::default()).unwrap().is_none());
        assert_eq!(hits.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn restore_renews_and_keeps_the_newest_refresh_token() {
        let (base, _) = happy_chain(|path, body| {
            (path == "/token").then(|| {
                assert!(body.contains("grant_type=refresh_token") && body.contains("OLD-REFRESH"));
                (200, json!({"access_token":"MS-ACCESS","refresh_token":"NEW-REFRESH"}).to_string())
            })
        });
        let store = MemoryStore::default();
        store.save("OLD-REFRESH").unwrap();
        let session = restore(&endpoints(&base), ID, &store).unwrap().unwrap();
        assert_eq!(session.profile.name, "Steve");
        assert_eq!(store.load().unwrap().as_deref(), Some("NEW-REFRESH"));
    }

    #[test]
    fn a_revoked_saved_login_is_cleared() {
        let (base, _) = happy_chain(|path, _| (path == "/token").then(|| (400, json!({"error":"invalid_grant"}).to_string())));
        let store = MemoryStore::default();
        store.save("OLD").unwrap();
        let err = restore(&endpoints(&base), ID, &store).unwrap_err();
        assert!(matches!(err, AuthError::Rejected(_)));
        assert!(err.to_string().contains("sign in again"));
        assert_eq!(store.load().unwrap(), None);
    }

    #[test]
    fn a_network_failure_during_restore_keeps_the_saved_login() {
        let store = MemoryStore::default();
        store.save("KEEP").unwrap();
        let err = restore(&endpoints("http://127.0.0.1:1"), ID, &store).unwrap_err();
        assert!(matches!(err, AuthError::Failed(_)));
        assert_eq!(store.load().unwrap().as_deref(), Some("KEEP"));
    }

    #[test]
    fn sign_out_removes_the_saved_login() {
        let store = MemoryStore::default();
        store.save("x").unwrap();
        sign_out(&store).unwrap();
        assert_eq!(store.load().unwrap(), None);
        sign_out(&store).unwrap(); // idempotent
    }

    #[test]
    fn error_messages_never_contain_tokens() {
        let (base, _) = happy_chain(|path, _| (path == "/profile").then(|| (500, json!({"access_token":"MC-TOKEN"}).to_string())));
        let err = sign_in(&endpoints(&base), ID, &MemoryStore::default(), &AtomicBool::new(false), &|_| {}).unwrap_err();
        let text = err.to_string();
        for secret in ["MC-TOKEN", "MS-ACCESS", "MS-REFRESH", "XSTS-TOKEN", "DEV-SECRET"] {
            assert!(!text.contains(secret), "{text}");
        }
    }
}

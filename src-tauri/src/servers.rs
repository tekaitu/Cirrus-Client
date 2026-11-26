//! Minecraft Java server status.
//!
//! The launcher asks the server itself, using the same Server List Ping the game
//! uses: a handshake, a status request, and the JSON the server answers with.
//! Nothing is cached or invented here — a field is `None` when the server stayed
//! silent about it, and `online` is false whenever the exchange did not finish.

use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::io::{Cursor, Read, Write};
use std::net::{IpAddr, TcpStream, ToSocketAddrs};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

pub const DEFAULT_PORT: u16 = 25565;
/// How long one host's SRV answer is reused before it is asked for again.
const SRV_TTL: Duration = Duration::from_secs(600);
/// The protocol the request claims; servers accept any number for a status ping.
const STATUS_PROTOCOL: i32 = 767;
/// A status answer is a few kilobytes; anything far larger is refused unread.
const MAX_STATUS_BYTES: i32 = 2 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    /// The address exactly as it was asked for.
    pub address: String,
    pub online: bool,
    pub latency_ms: Option<u64>,
    pub version: Option<String>,
    pub players_online: Option<u32>,
    pub players_max: Option<u32>,
    /// The message of the day, with its colour codes removed.
    pub motd: Option<String>,
    /// The server icon as a `data:image/png;base64,` address, when it sent one.
    pub icon: Option<String>,
    /// Why the check failed; only set when `online` is false.
    pub error: Option<String>,
}

impl ServerStatus {
    fn new(address: &str) -> ServerStatus {
        ServerStatus {
            address: address.trim().to_string(),
            online: false,
            latency_ms: None,
            version: None,
            players_online: None,
            players_max: None,
            motd: None,
            icon: None,
            error: None,
        }
    }

    fn failed(address: &str, message: &str) -> ServerStatus {
        ServerStatus {
            error: Some(message.to_string()),
            ..ServerStatus::new(address)
        }
    }
}

/// A host name, optional port, and nothing that could be used as an argument or a path.
pub fn valid_address(address: &str) -> bool {
    let text = address.trim();
    if text.is_empty() || text.chars().count() > 255 {
        return false;
    }
    if !text
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ':'))
    {
        return false;
    }
    match split_address(text) {
        Ok((host, port)) => {
            !host.is_empty()
                && !host.starts_with('.')
                && !host.starts_with('-')
                && port != 0
        }
        Err(_) => false,
    }
}

/// `play.example.com` gets the default port; `play.example.com:25566` keeps its own.
fn split_address(address: &str) -> Result<(String, u16), String> {
    let text = address.trim();
    if text.is_empty() || text.chars().count() > 255 {
        return Err("Enter a server address like play.example.com.".to_string());
    }
    if !text
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ':'))
    {
        return Err("That is not a Minecraft server address.".to_string());
    }
    match text.rsplit_once(':') {
        Some((host, port)) if !host.is_empty() && !host.contains(':') => {
            let port: u16 = port
                .parse()
                .map_err(|_| "That server address has an invalid port.".to_string())?;
            if port == 0 {
                return Err("That server address has an invalid port.".to_string());
            }
            Ok((host.to_string(), port))
        }
        Some(_) => Err("That is not a Minecraft server address.".to_string()),
        None => Ok((text.to_string(), DEFAULT_PORT)),
    }
}

fn write_varint(out: &mut Vec<u8>, value: i32) {
    let mut rest = value as u32;
    loop {
        let mut byte = (rest & 0x7f) as u8;
        rest >>= 7;
        if rest != 0 {
            byte |= 0x80;
        }
        out.push(byte);
        if rest == 0 {
            return;
        }
    }
}

fn read_varint(reader: &mut impl Read) -> std::io::Result<i32> {
    let mut value: u32 = 0;
    for shift in 0..5 {
        let mut byte = [0u8; 1];
        reader.read_exact(&mut byte)?;
        value |= ((byte[0] & 0x7f) as u32) << (7 * shift);
        if byte[0] & 0x80 == 0 {
            return Ok(value as i32);
        }
    }
    Err(std::io::Error::new(
        std::io::ErrorKind::InvalidData,
        "varint too long",
    ))
}

fn framed(body: &[u8]) -> Vec<u8> {
    let mut packet = Vec::with_capacity(body.len() + 5);
    write_varint(&mut packet, body.len() as i32);
    packet.extend_from_slice(body);
    packet
}

fn handshake(host: &str, port: u16) -> Vec<u8> {
    let mut body = Vec::new();
    write_varint(&mut body, 0x00);
    write_varint(&mut body, STATUS_PROTOCOL);
    write_varint(&mut body, host.len() as i32);
    body.extend_from_slice(host.as_bytes());
    body.extend_from_slice(&port.to_be_bytes());
    write_varint(&mut body, 1);
    framed(&body)
}

const STATUS_REQUEST: [u8; 2] = [0x01, 0x00];

struct SrvEntry {
    target: Option<(String, u16)>,
    at: Instant,
}

fn srv_cache() -> &'static Mutex<HashMap<String, SrvEntry>> {
    static CACHE: OnceLock<Mutex<HashMap<String, SrvEntry>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// One DNS SRV answer as `0 5 17515 aurora.dathost.net` means it.
fn parse_srv(data: &str) -> Option<(String, u16)> {
    let mut parts = data.split_whitespace();
    let _priority = parts.next()?;
    let _weight = parts.next()?;
    let port: u16 = parts.next()?.parse().ok()?;
    let target = parts.next()?.trim_end_matches('.').to_string();
    // A SRV answer has exactly four fields; anything after them is not one.
    if parts.next().is_some() {
        return None;
    }
    if port == 0 || target.is_empty() || !valid_address(&target) {
        return None;
    }
    Some((target, port))
}

/// The `_minecraft._tcp` SRV target of a host name, the way the game finds one.
///
/// Shared Minecraft hosts publish their real port only in that record, so pinging
/// 25565 would report a healthy server as offline. The lookup goes over
/// DNS-over-HTTPS, so no resolver configuration has to be read or parsed; when it
/// cannot be asked, the launcher falls back to the host on the default port.
fn srv_target(host: &str) -> Option<(String, u16)> {
    if host.parse::<IpAddr>().is_ok() {
        return None;
    }
    if let Ok(cache) = srv_cache().lock() {
        if let Some(entry) = cache.get(host) {
            if entry.at.elapsed() < SRV_TTL {
                return entry.target.clone();
            }
        }
    }
    let url = format!("https://cloudflare-dns.com/dns-query?name=_minecraft._tcp.{host}&type=SRV");
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .ok()?;
    let found = client
        .get(&url)
        .header("accept", "application/dns-json")
        .send()
        .ok()
        .and_then(|resp| resp.json::<Value>().ok())
        .and_then(|answer| {
            answer
                .get("Answer")
                .and_then(Value::as_array)
                .and_then(|items| {
                    items
                        .iter()
                        .find(|item| item.get("type").and_then(Value::as_u64) == Some(33))
                        .and_then(|item| item.get("data").and_then(Value::as_str))
                        .and_then(parse_srv)
                })
        });
    if let Ok(mut cache) = srv_cache().lock() {
        cache.insert(
            host.to_string(),
            SrvEntry {
                target: found.clone(),
                at: Instant::now(),
            },
        );
    }
    found
}

/// Ask one server for its status. Never panics: every failure becomes `online: false`.
pub fn query(address: &str, timeout: Duration) -> ServerStatus {
    let typed_port = address.trim().contains(':');
    let (host, port) = match split_address(address) {
        Ok(parts) => parts,
        Err(message) => return ServerStatus::failed(address, &message),
    };
    // A port typed by hand always wins; otherwise the server's own SRV record is followed.
    let (connect_host, port) = if typed_port {
        (host.clone(), port)
    } else {
        srv_target(&host).unwrap_or((host.clone(), port))
    };
    let target = match (connect_host.as_str(), port).to_socket_addrs() {
        Ok(mut addrs) => match addrs.next() {
            Some(addr) => addr,
            None => return ServerStatus::failed(address, "That server name could not be found."),
        },
        Err(_) => return ServerStatus::failed(address, "That server name could not be found."),
    };

    let started = Instant::now();
    let mut stream = match TcpStream::connect_timeout(&target, timeout) {
        Ok(stream) => stream,
        Err(_) => return ServerStatus::failed(address, "The server did not answer."),
    };
    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));
    if stream.write_all(&handshake(&host, port)).is_err() || stream.write_all(&STATUS_REQUEST).is_err() {
        return ServerStatus::failed(address, "The server did not answer.");
    }

    let length = match read_varint(&mut stream) {
        Ok(n) if n > 0 && n <= MAX_STATUS_BYTES => n,
        Ok(_) => return ServerStatus::failed(address, "The server sent an unexpected answer."),
        Err(_) => return ServerStatus::failed(address, "The server did not answer."),
    };
    let mut payload = vec![0u8; length as usize];
    if stream.read_exact(&mut payload).is_err() {
        return ServerStatus::failed(address, "The server did not finish its answer.");
    }
    let latency = started.elapsed().as_millis() as u64;

    let mut cursor = Cursor::new(payload.as_slice());
    let _packet_id = match read_varint(&mut cursor) {
        Ok(id) if id == 0x00 => id,
        _ => return ServerStatus::failed(address, "The server sent an unexpected answer."),
    };
    let text_length = match read_varint(&mut cursor) {
        Ok(n) if n >= 0 && n <= MAX_STATUS_BYTES => n as usize,
        _ => return ServerStatus::failed(address, "The server sent an unexpected answer."),
    };
    let start = cursor.position() as usize;
    let Some(bytes) = payload.get(start..start + text_length) else {
        return ServerStatus::failed(address, "The server sent an incomplete answer.");
    };
    let json: Value = match serde_json::from_slice(bytes) {
        Ok(value) => value,
        Err(_) => return ServerStatus::failed(address, "The server sent an unexpected answer."),
    };

    ServerStatus {
        online: true,
        latency_ms: Some(latency),
        version: json
            .get("version")
            .and_then(|v| v.get("name"))
            .and_then(Value::as_str)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        players_online: count(json.get("players").and_then(|p| p.get("online"))),
        players_max: count(json.get("players").and_then(|p| p.get("max"))),
        motd: json
            .get("description")
            .map(flatten)
            .map(|text| plain(&text))
            .filter(|text| !text.is_empty()),
        icon: json
            .get("favicon")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|icon| icon.starts_with("data:image/") && icon.len() <= 400_000)
            .map(str::to_string),
        ..ServerStatus::new(address)
    }
}

fn count(value: Option<&Value>) -> Option<u32> {
    value
        .and_then(Value::as_u64)
        .and_then(|n| u32::try_from(n).ok())
}

/// A chat component as plain text: its own text, then everything in `extra`.
fn flatten(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Array(items) => items.iter().map(flatten).collect::<Vec<_>>().join(""),
        Value::Object(map) => {
            let mut out = map
                .get("text")
                .map(flatten)
                .unwrap_or_default();
            if let Some(extra) = map.get("extra") {
                out.push_str(&flatten(extra));
            }
            out
        }
        _ => String::new(),
    }
}

/// Removes the section sign colour codes and collapses the whitespace.
fn plain(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars();
    while let Some(c) = chars.next() {
        if c == '§' {
            chars.next();
            continue;
        }
        out.push(c);
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::thread;

    /// A one-connection stand-in for a Minecraft server: it answers with `body`.
    fn fake_server(body: &'static str) -> (String, thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let handle = thread::spawn(move || {
            if let Ok((mut socket, _)) = listener.accept() {
                let mut buffer = [0u8; 1024];
                let _ = socket.read(&mut buffer);
                let mut packet = Vec::new();
                write_varint(&mut packet, 0x00);
                write_varint(&mut packet, body.len() as i32);
                packet.extend_from_slice(body.as_bytes());
                let _ = socket.write_all(&framed(&packet));
            }
        });
        (format!("127.0.0.1:{port}"), handle)
    }

    #[test]
    fn a_status_answer_is_read_as_online_with_real_numbers() {
        let (address, server) = fake_server(
            r#"{"version":{"name":"Paper 1.21.11","protocol":767},
                "players":{"online":412,"max":1000},
                "description":{"text":"Vanguards ","extra":[{"text":"SMP","color":"green"}]},
                "favicon":"data:image/png;base64,AAAA"}"#,
        );
        let status = query(&address, Duration::from_secs(4));
        server.join().unwrap();
        assert!(status.online, "{:?}", status.error);
        assert_eq!(status.version.as_deref(), Some("Paper 1.21.11"));
        assert_eq!(status.players_online, Some(412));
        assert_eq!(status.players_max, Some(1000));
        assert_eq!(status.motd.as_deref(), Some("Vanguards SMP"));
        assert_eq!(status.icon.as_deref(), Some("data:image/png;base64,AAAA"));
        assert!(status.latency_ms.is_some());
        assert_eq!(status.error, None);
    }

    #[test]
    fn colour_codes_and_missing_fields_are_handled_honestly() {
        let (address, server) = fake_server(r#"{"description":"§6Vanguards §7SMP","players":{}}"#);
        let status = query(&address, Duration::from_secs(4));
        server.join().unwrap();
        assert!(status.online);
        assert_eq!(status.motd.as_deref(), Some("Vanguards SMP"));
        assert_eq!(status.version, None, "no version was sent, so none is shown");
        assert_eq!(status.players_online, None);
        assert_eq!(status.players_max, None);
        assert_eq!(status.icon, None);
    }

    #[test]
    fn a_closed_port_is_offline_with_a_reason() {
        // Bind, read the port, then drop the listener so nothing is listening there.
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        let status = query(&format!("127.0.0.1:{port}"), Duration::from_millis(800));
        assert!(!status.online);
        assert_eq!(status.players_online, None, "no count is invented for an offline server");
        assert!(status.error.is_some());
    }

    #[test]
    fn srv_answers_are_read_the_way_minecraft_reads_them() {
        assert_eq!(
            parse_srv("0 5 17515 aurora.dathost.net."),
            Some(("aurora.dathost.net".to_string(), 17515))
        );
        assert_eq!(
            parse_srv("0 5 25565 example.org"),
            Some(("example.org".to_string(), 25565))
        );
        for bad in ["nonsense", "0 5", "0 5 0 host.", "0 5 17515 ", "0 5 17515 bad host"] {
            assert_eq!(parse_srv(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn addresses_are_narrowly_validated() {
        assert!(valid_address("vanguards.ggwp.cc"));
        assert!(valid_address("play.example.com:25566"));
        assert!(valid_address("localhost"));
        for bad in ["", "  ", "has space.com", "example.com/../x", "a;b", "-bad.com", "host:0", "host:99999", "host:"] {
            assert!(!valid_address(bad), "{bad:?}");
        }
        assert_eq!(
            split_address("vanguards.ggwp.cc").unwrap(),
            ("vanguards.ggwp.cc".to_string(), 25565)
        );
        assert_eq!(
            split_address("play.example.com:25566").unwrap(),
            ("play.example.com".to_string(), 25566)
        );
    }

    #[test]
    fn a_server_that_answers_nonsense_does_not_crash_the_launcher() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let handle = thread::spawn(move || {
            if let Ok((mut socket, _)) = listener.accept() {
                let mut buffer = [0u8; 512];
                let _ = socket.read(&mut buffer);
                let _ = socket.write_all(b"not a packet at all");
            }
        });
        let status = query(&format!("127.0.0.1:{port}"), Duration::from_secs(2));
        handle.join().unwrap();
        assert!(!status.online);
        assert!(status.error.is_some());
    }
}

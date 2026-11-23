//! Base64 for files that come from the window.
//!
//! A jar chosen with the file picker reaches Rust as base64 text, because the
//! page only has the file's bytes. This decoder accepts the standard and the
//! URL-safe alphabets, ignores whitespace, tolerates missing padding, and
//! refuses anything else instead of guessing.

/// 90 MB of text is about a 67 MB file, which is above the 64 MB mod limit.
pub const MAX_ENCODED_BYTES: usize = 90 * 1024 * 1024;

pub fn decode(text: &str) -> Result<Vec<u8>, String> {
    if text.len() > MAX_ENCODED_BYTES {
        return Err("That file is too large to install as a mod.".to_string());
    }
    let mut out = Vec::with_capacity(text.len() * 3 / 4);
    let mut buffer: u32 = 0;
    let mut bits = 0;
    let mut padded = false;
    for byte in text.bytes() {
        let value = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' | b'-' => 62,
            b'/' | b'_' => 63,
            b'=' => {
                padded = true;
                continue;
            }
            b' ' | b'\n' | b'\r' | b'\t' => continue,
            _ => return Err("The file could not be read.".to_string()),
        };
        if padded {
            // Data after the padding marker is not base64 at all.
            return Err("The file could not be read.".to_string());
        }
        buffer = ((buffer << 6) | value as u32) & 0xffff_ffff;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buffer >> bits) as u8);
            // Keep only the bits that still belong to the next byte.
            buffer &= if bits == 0 { 0 } else { (1u32 << bits) - 1 };
        }
    }
    if out.is_empty() {
        return Err("That file is empty.".to_string());
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_the_standard_alphabet_with_and_without_padding() {
        assert_eq!(decode("aGVsbG8=").unwrap(), b"hello");
        assert_eq!(decode("aGVsbG8").unwrap(), b"hello");
        assert_eq!(decode("").unwrap_err(), "That file is empty.");
    }

    #[test]
    fn accepts_the_url_safe_alphabet_and_whitespace() {
        // The same bytes as "+/8=" in the standard alphabet.
        assert_eq!(decode("-_-_").unwrap(), decode("+/+/").unwrap());
        assert_eq!(decode("aGVs\nbG8=").unwrap(), b"hello");
        assert_eq!(decode("  aGVsbG8=  ").unwrap(), b"hello");
    }

    #[test]
    fn keeps_multi_byte_payloads_intact() {
        let mut bytes = Vec::new();
        for i in 0..1024u32 {
            bytes.push((i % 256) as u8);
        }
        // Encode with the same rules the page uses, then decode again.
        let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut text = String::new();
        for chunk in bytes.chunks(3) {
            let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
            let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
            text.push(alphabet[((n >> 18) & 63) as usize] as char);
            text.push(alphabet[((n >> 12) & 63) as usize] as char);
            if chunk.len() > 1 {
                text.push(alphabet[((n >> 6) & 63) as usize] as char);
            } else {
                text.push('=');
            }
            if chunk.len() > 2 {
                text.push(alphabet[(n & 63) as usize] as char);
            } else {
                text.push('=');
            }
        }
        assert_eq!(decode(&text).unwrap(), bytes);
    }

    #[test]
    fn refuses_what_is_not_base64() {
        assert!(decode("not base64!").is_err());
        assert!(decode("aGVsbG8=extra").is_err());
    }
}

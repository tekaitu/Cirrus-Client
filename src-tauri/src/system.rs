//! Real hardware / OS information for the Diagnostics page.

use serde::Serialize;
use sysinfo::System;

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os_name: Option<String>,
    pub os_version: Option<String>,
    pub os_long_version: Option<String>,
    pub kernel_version: Option<String>,
    pub arch: &'static str,
    pub cpu_brand: Option<String>,
    pub cpu_logical_cores: usize,
    pub cpu_physical_cores: Option<usize>,
    pub total_ram_mb: u64,
    pub available_ram_mb: u64,
}

pub fn bytes_to_mb(bytes: u64) -> u64 {
    bytes / (1024 * 1024)
}

pub fn collect() -> SystemInfo {
    let mut sys = System::new();
    sys.refresh_memory();
    sys.refresh_cpu_all();

    let cpus = sys.cpus();
    let cpu_brand = cpus
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|b| !b.is_empty());
    let cpu_logical_cores = if cpus.is_empty() {
        std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(1)
    } else {
        cpus.len()
    };

    SystemInfo {
        os_name: System::name(),
        os_version: System::os_version(),
        os_long_version: System::long_os_version(),
        kernel_version: System::kernel_version(),
        arch: std::env::consts::ARCH,
        cpu_brand,
        cpu_logical_cores,
        cpu_physical_cores: sys.physical_core_count(),
        total_ram_mb: bytes_to_mb(sys.total_memory()),
        available_ram_mb: bytes_to_mb(sys.available_memory()),
    }
}

/// Total installed RAM in MB, or 0 if it could not be read.
pub fn total_ram_mb() -> u64 {
    let mut sys = System::new();
    sys.refresh_memory();
    bytes_to_mb(sys.total_memory())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_bytes_to_megabytes() {
        assert_eq!(bytes_to_mb(0), 0);
        assert_eq!(bytes_to_mb(1024 * 1024), 1);
        assert_eq!(bytes_to_mb(16 * 1024 * 1024 * 1024), 16384);
    }

    #[test]
    fn collect_reports_basic_facts() {
        let info = collect();
        assert!(!info.arch.is_empty());
        assert!(info.cpu_logical_cores >= 1);
    }
}

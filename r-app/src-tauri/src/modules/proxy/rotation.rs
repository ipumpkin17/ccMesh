use std::sync::Mutex;
use std::time::Duration;

/// 瞬时网络错误的重试延迟（重试同一端点）。
pub const TRANSIENT_RETRY_DELAY: Duration = Duration::from_millis(300);
/// 同一端点连续失败达到此次数后切换到下一个端点。
pub const CONSECUTIVE_FAIL_SWITCH: u32 = 2;

/// 线程安全的轮换器：维护当前端点索引。
#[derive(Default)]
pub struct Rotation {
    current: Mutex<usize>,
}

impl Rotation {
    pub fn new() -> Self {
        Self {
            current: Mutex::new(0),
        }
    }

    /// 当前索引（对 n 取模防越界）。n == 0 返回 None。
    pub fn current_index(&self, n: usize) -> Option<usize> {
        if n == 0 {
            return None;
        }
        let mut g = self.current.lock().unwrap();
        *g %= n;
        Some(*g)
    }

    /// 前进到下一个端点：`old = cur % n; cur = (old + 1) % n`。返回新索引。
    pub fn advance(&self, n: usize) -> Option<usize> {
        if n == 0 {
            return None;
        }
        let mut g = self.current.lock().unwrap();
        let old = *g % n;
        *g = (old + 1) % n;
        Some(*g)
    }

    /// 手动设置当前索引（按端点名定位后由调用方传入）。
    pub fn set_index(&self, idx: usize) {
        *self.current.lock().unwrap() = idx;
    }
}

/// 最大重试次数 = 启用端点数 × 2（Token Pool 额外重试在本项目 Out of Scope）。
pub fn max_retries(enabled_count: usize) -> usize {
    enabled_count.saturating_mul(2)
}

/// HTTP 状态是否应重试「下一个」端点：除 200 / 400 / 401 外都重试。
pub fn should_retry_status(status: u16) -> bool {
    !matches!(status, 200 | 400 | 401)
}

/// 是否瞬时网络错误（重试「同一」端点 + 300ms 延迟）。
pub fn is_transient_network_error(msg: &str) -> bool {
    let m = msg.to_lowercase();
    m.contains("eof")
        || m.contains("timeout awaiting response headers")
        || m.contains("i/o timeout")
        || m.contains("connection reset by peer")
        || m.contains("timed out")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn advance_wraps_modulo_n() {
        let r = Rotation::new();
        assert_eq!(r.current_index(3), Some(0));
        assert_eq!(r.advance(3), Some(1));
        assert_eq!(r.advance(3), Some(2));
        assert_eq!(r.advance(3), Some(0)); // wrap
    }

    #[test]
    fn current_index_handles_shrunk_list() {
        let r = Rotation::new();
        r.set_index(5);
        assert_eq!(r.current_index(3), Some(2)); // 5 % 3
    }

    #[test]
    fn zero_endpoints_yields_none() {
        let r = Rotation::new();
        assert_eq!(r.current_index(0), None);
        assert_eq!(r.advance(0), None);
    }

    #[test]
    fn max_retries_is_double() {
        assert_eq!(max_retries(3), 6);
        assert_eq!(max_retries(0), 0);
    }

    #[test]
    fn status_retry_classification() {
        assert!(!should_retry_status(200));
        assert!(!should_retry_status(400));
        assert!(!should_retry_status(401));
        assert!(should_retry_status(403));
        assert!(should_retry_status(429));
        assert!(should_retry_status(500));
        assert!(should_retry_status(502));
    }

    #[test]
    fn transient_error_detection() {
        assert!(is_transient_network_error("unexpected EOF"));
        assert!(is_transient_network_error("connection reset by peer"));
        assert!(is_transient_network_error("request timed out"));
        assert!(!is_transient_network_error("400 Bad Request"));
    }
}

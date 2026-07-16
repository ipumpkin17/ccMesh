use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

/// 瞬时网络错误的重试延迟（重试同一端点）。
pub const TRANSIENT_RETRY_DELAY: Duration = Duration::from_millis(300);
/// 同一端点连续失败达到此次数后切换到下一个端点。
pub const CONSECUTIVE_FAIL_SWITCH: u32 = 2;

/// 线程安全的轮换器：按入站协议维护当前端点 ID。
///
/// 候选端点会因协议、快速队列、模型与熔断状态动态变化，不能跨候选集合保存裸下标。
#[derive(Default)]
pub struct Rotation {
    current: Mutex<HashMap<String, String>>,
}

impl Rotation {
    pub fn new() -> Self {
        Self::default()
    }

    /// 返回当前协议队列内的端点索引。已保存端点不在本次候选中时回落首项。
    pub fn current_index(&self, queue: &str, endpoint_ids: &[String]) -> Option<usize> {
        if endpoint_ids.is_empty() {
            return None;
        }
        let mut g = self.current.lock().unwrap();
        let index = g
            .get(queue)
            .and_then(|current_id| endpoint_ids.iter().position(|id| id == current_id))
            .unwrap_or(0);
        g.insert(queue.to_string(), endpoint_ids[index].clone());
        Some(index)
    }

    /// 在当前协议的本次候选中前进到下一端点，并保存稳定端点 ID。
    pub fn advance(&self, queue: &str, endpoint_ids: &[String]) -> Option<usize> {
        if endpoint_ids.is_empty() {
            return None;
        }
        let mut g = self.current.lock().unwrap();
        let old = g
            .get(queue)
            .and_then(|current_id| endpoint_ids.iter().position(|id| id == current_id))
            .unwrap_or(0);
        let next = (old + 1) % endpoint_ids.len();
        g.insert(queue.to_string(), endpoint_ids[next].clone());
        Some(next)
    }

    /// 手动切换时按协议记录稳定端点 ID。
    pub fn set_endpoint(&self, queue: &str, endpoint_id: &str) {
        self.current
            .lock()
            .unwrap()
            .insert(queue.to_string(), endpoint_id.to_string());
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

/// 一次尝试结果对熔断器的归类。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    /// 可重试故障（5xx/429/网络错误等）：计入熔断失败。
    Retryable,
    /// 客户端错误（4xx 业务错误）：不计入熔断（中性），仅释放半开许可。
    NonRetryable,
}

/// 客户端错误状态码（请求本身的问题，不应污染端点熔断）。
fn is_client_error(status: u16) -> bool {
    matches!(status, 400 | 401 | 405 | 406 | 413 | 414 | 415 | 422)
}

/// 按状态码归类熔断结果（200 视为成功由调用方单独处理；此处用于非 200 路径）。
pub fn categorize_status(status: u16) -> Outcome {
    if is_client_error(status) {
        Outcome::NonRetryable
    } else {
        Outcome::Retryable
    }
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
        let ids = ["a".into(), "b".into(), "c".into()];
        assert_eq!(r.current_index("claude", &ids), Some(0));
        assert_eq!(r.advance("claude", &ids), Some(1));
        assert_eq!(r.advance("claude", &ids), Some(2));
        assert_eq!(r.advance("claude", &ids), Some(0));
    }

    #[test]
    fn current_endpoint_survives_candidate_reorder() {
        let r = Rotation::new();
        r.set_endpoint("claude", "c");

        assert_eq!(
            r.current_index("claude", &["a".into(), "c".into()]),
            Some(1)
        );
        assert_eq!(
            r.current_index("claude", &["c".into(), "a".into()]),
            Some(0)
        );
    }

    #[test]
    fn protocol_queues_keep_independent_endpoints() {
        let r = Rotation::new();
        r.set_endpoint("claude", "b");
        r.set_endpoint("responses", "c");

        let claude = ["a".into(), "b".into()];
        let responses = ["c".into(), "d".into()];
        assert_eq!(r.current_index("claude", &claude), Some(1));
        assert_eq!(r.current_index("responses", &responses), Some(0));
        assert_eq!(r.advance("claude", &claude), Some(0));
        assert_eq!(r.current_index("responses", &responses), Some(0));
    }

    #[test]
    fn zero_endpoints_yields_none() {
        let r = Rotation::new();
        assert_eq!(r.current_index("claude", &[]), None);
        assert_eq!(r.advance("claude", &[]), None);
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

    #[test]
    fn categorize_status_separates_client_errors() {
        // 客户端错误 → 不污染熔断
        assert_eq!(categorize_status(400), Outcome::NonRetryable);
        assert_eq!(categorize_status(401), Outcome::NonRetryable);
        assert_eq!(categorize_status(422), Outcome::NonRetryable);
        // 服务端/限流/网关错误 → 计入熔断
        assert_eq!(categorize_status(403), Outcome::Retryable);
        assert_eq!(categorize_status(429), Outcome::Retryable);
        assert_eq!(categorize_status(500), Outcome::Retryable);
        assert_eq!(categorize_status(502), Outcome::Retryable);
        assert_eq!(categorize_status(503), Outcome::Retryable);
    }
}

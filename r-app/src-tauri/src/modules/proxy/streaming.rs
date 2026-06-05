//! SSE 流式响应处理。P1 阶段上游响应（含 SSE）以字节流直通转发；
//! Claude ↔ OpenAI 的流式增量转换在阶段 2（P2-5）接入。

/// 响应是否为 SSE 事件流（Content-Type 含 `text/event-stream`）。
pub fn is_event_stream(content_type: Option<&str>) -> bool {
    content_type
        .map(|ct| ct.to_ascii_lowercase().contains("text/event-stream"))
        .unwrap_or(false)
}

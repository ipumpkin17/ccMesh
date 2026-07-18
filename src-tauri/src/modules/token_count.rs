use serde_json::Value;

/// 读取上游 usage 中的 token 数值。
///
/// 常见形态是数字；部分 provider 会返回数字字符串，或把 cache write 拆成
/// `{ephemeral_5m_input_tokens, ephemeral_1h_input_tokens}` 这类分桶对象。
pub fn token_count(value: &Value) -> Option<i64> {
    match value {
        Value::Number(n) => n.as_i64().or_else(|| n.as_u64().and_then(|v| i64::try_from(v).ok())),
        Value::String(s) => s.trim().parse::<i64>().ok(),
        Value::Object(object) => {
            let sum: i64 = object.values().filter_map(token_count).filter(|v| *v > 0).sum();
            (sum > 0).then_some(sum)
        }
        Value::Array(values) => {
            let sum: i64 = values.iter().filter_map(token_count).filter(|v| *v > 0).sum();
            (sum > 0).then_some(sum)
        }
        _ => None,
    }
}

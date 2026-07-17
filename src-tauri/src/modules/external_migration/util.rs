//! 外部迁移通用工具：脱敏、冲突命名。

/// 脱敏 api_key：保留前缀与末 4 位，中间用 *** 代替；过短则全遮。
pub fn mask_key(key: &str) -> String {
    let k = key.trim();
    if k.is_empty() {
        return String::new();
    }
    if k.len() <= 8 {
        return "***".into();
    }
    let head = &k[..4];
    let tail = &k[k.len() - 4..];
    format!("{head}***{tail}")
}

/// 在已有同名端点时生成不冲突名称：`name` → `name (suffix)` → `name (suffix)-2`…
/// `exists` 返回某名称是否已被占用（含本轮已生成）。
pub fn unique_name(base: &str, suffix: &str, exists: impl Fn(&str) -> bool) -> String {
    if !exists(base) {
        return base.to_string();
    }
    let cand1 = format!("{base} ({suffix})");
    if !exists(&cand1) {
        return cand1;
    }
    let mut n = 2;
    loop {
        let cand = format!("{base} ({suffix})-{n}");
        if !exists(&cand) {
            return cand;
        }
        n += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mask_key_short_and_long() {
        assert_eq!(mask_key(""), "");
        assert_eq!(mask_key("short"), "***");
        assert_eq!(mask_key("sk-abcdefghij"), "sk-a***ghij");
    }

    #[test]
    fn unique_name_no_conflict() {
        assert_eq!(unique_name("A", "src", |_| false), "A");
    }

    #[test]
    fn unique_name_one_conflict() {
        let taken = ["A".to_string()];
        assert_eq!(
            unique_name("A", "src", |n| taken.contains(&n.to_string())),
            "A (src)"
        );
    }

    #[test]
    fn unique_name_two_conflicts() {
        let taken = ["A".to_string(), "A (src)".to_string()];
        assert_eq!(
            unique_name("A", "src", |n| taken.contains(&n.to_string())),
            "A (src)-2"
        );
    }
}

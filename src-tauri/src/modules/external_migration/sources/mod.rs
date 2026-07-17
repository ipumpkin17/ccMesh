//! 外部迁移源适配器。
//!
//! 每个源只负责：默认路径、读取与解析为 `MappedEndpoint`。
//! 预览脱敏、探测写库由上层公共模块完成。

pub mod cc_switch;
pub mod cpa;

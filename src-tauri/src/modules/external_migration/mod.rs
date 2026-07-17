//! 外部配置迁移：公共管道 + 多源适配器。
//!
//! - 公共层：`types` / `importer` / `url_normalize` / `util`（与具体来源无关）
//! - 源适配：`sources/*` 只负责读源并产出 `MappedEndpoint`
//! - `preview`：脱敏组装预览列表（不写库、不探测）
//! - `import`：探测模型并写 endpoints（见 `importer`）

pub mod importer;
pub mod sources;
pub mod types;
pub mod url_normalize;
pub mod util;

use crate::modules::external_migration::types::{MappedEndpoint, PreviewItem};
use crate::modules::external_migration::util::mask_key;

/// 将映射候选组装为预览项（不写库、不探测）。
pub fn preview(items: Vec<MappedEndpoint>) -> Vec<PreviewItem> {
    items
        .into_iter()
        .map(|m| {
            let masked = mask_key(&m.api_key);
            PreviewItem::from_mapped(m, masked)
        })
        .collect()
}

# 端点表单体验

## 问题

编辑端点弹窗偏窄；输入 URL/模型名时浏览器会自动纠正，干扰配置。

## 决策

- Dialog 宽度升到 max-w-2xl
- 名称/URL/Key/模型/备注输入关闭 autoCorrect、autoCapitalize、spellCheck、autoComplete

## 验收

- 弹窗明显更宽
- 输入模型名/URL 不再被浏览器自动改写

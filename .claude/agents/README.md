# DramiaOS Agents

> Claude Code 自定义代理 - 自动执行项目规则和约束

## 目录架构

```
agents/
├── i18n-enforcer.md       # 国际化规则执行器
├── loro-guardian.md       # Loro CRDT 守护者
├── screenplay-enforcer.md # 剧本格式执行器
└── README.md              # 本文件
```

## Agent 概览

| Agent | 职责 | 触发条件 |
|-------|------|----------|
| **i18n-enforcer** | 确保所有用户可见文本通过 i18n | 创建/修改 UI 组件 |
| **loro-guardian** | 禁止 Yjs，强制使用 Loro CRDT | 添加实时协作代码 |
| **screenplay-enforcer** | 限制剧本元素为 6 种标准类型 | 修改编辑器/数据模型 |

## 核心规则速查

### i18n-enforcer (11 语言)
```
en | es | hi | fr | ja | ko | de | pt | it | zh-CN | zh-TW
```

### loro-guardian
```
✅ loro-crdt
❌ yjs, y-websocket, y-indexeddb
```

### screenplay-enforcer (6 种元素)
```
scene | character | dialogue | action | transition | parenthetical
```

## 使用方式

这些 agents 会在 Claude Code 工作时自动检查相关操作。
如需手动调用，可以在对话中提及相应的规则检查。

---
*DramiaOS Agents v1.0 | 最后更新: 2024-12-24*

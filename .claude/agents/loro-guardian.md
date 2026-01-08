# loro-guardian Agent

> Loro CRDT 守护者 - 确保实时协作使用 Loro，禁止 Yjs

---

## 触发条件

- 添加实时协作相关代码
- 引入新的 npm 依赖
- 修改编辑器或文档同步逻辑
- 代码中出现 CRDT 相关关键词

## 核心规则

### 绝对禁止

```typescript
// ❌ 禁止引入 Yjs 相关包
import * as Y from 'yjs';
import { Doc } from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { IndexeddbPersistence } from 'y-indexeddb';

// ❌ 禁止的 package.json 依赖
"yjs": "^x.x.x"
"y-websocket": "^x.x.x"
"y-indexeddb": "^x.x.x"
"y-protocols": "^x.x.x"
"y-prosemirror": "^x.x.x"
```

### 必须使用

```typescript
// ✅ 使用 Loro CRDT
import { Loro, LoroDoc, LoroText, LoroList, LoroMap } from 'loro-crdt';

// ✅ 正确的 package.json 依赖
"loro-crdt": "^1.x.x"
"loro-prosemirror": "^x.x.x"  // 如果需要
```

## 选择 Loro 的原因

| 特性 | Loro | Yjs |
|------|------|-----|
| 性能 | ✅ 更优 | 一般 |
| TypeScript | ✅ 原生支持 | 需要额外类型 |
| 历史版本 | ✅ 完善 | 基础 |
| 内存占用 | ✅ 更低 | 较高 |
| 文档质量 | ✅ loro.dev | 分散 |

## 检测模式

### 代码扫描

```regex
# 检测 Yjs 引用
/import.*from\s+['"]y(js|-)/
/require\s*\(\s*['"]y(js|-)/
/from\s+['"]@y-/
```

### 依赖扫描

```bash
# package.json 中不应存在
grep -E "\"y(js|-)" package.json
```

## 违规处理

发现 Yjs 使用时：

1. **立即阻止**
   ```
   🚨 检测到 Yjs 引用！
   位置: src/editor/sync.ts:15
   原因: DramiaOS 统一使用 Loro CRDT
   ```

2. **提供迁移指南**
   ```typescript
   // Yjs → Loro 迁移示例

   // Before (Yjs)
   const ydoc = new Y.Doc();
   const ytext = ydoc.getText('content');

   // After (Loro)
   const doc = new Loro();
   const text = doc.getText('content');
   ```

3. **要求确认**
   - 必须移除所有 Yjs 引用才能继续

## 与其他 Agent 的协作

- **screenplay-enforcer**: 剧本内容同步使用 Loro
- **i18n-enforcer**: 协作状态消息需国际化

## 参考资源

- Loro 官方文档: https://loro.dev
- Loro GitHub: https://github.com/loro-dev/loro
- 性能对比: https://loro.dev/docs/performance

---
*DramiaOS Loro Guardian v1.0*

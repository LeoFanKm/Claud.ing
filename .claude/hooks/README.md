# DramiaOS Hooks

> Claude Code 钩子 - 会话生命周期事件处理

## 目录架构

```
hooks/
├── todo-continuation.js   # Todo 状态持久化
└── README.md              # 本文件
```

## Hook 概览

| Hook | 职责 | 触发时机 |
|------|------|----------|
| **todo-continuation** | 保存/恢复 Todo 状态 | 会话开始/结束 |

## todo-continuation.js

### 功能

- 会话结束时自动保存当前 Todo 列表
- 会话开始时显示上次未完成的任务
- 自动备份历史状态（保留最近 5 个）

### 状态文件位置

```
.claude/
├── state/
│   ├── todo-state.json       # 当前状态
│   └── backups/              # 历史备份
│       ├── todo-state-2024-12-24T10-30-00-000Z.json
│       └── ...
```

### 导出的函数

```javascript
const hook = require('./todo-continuation.js');

// 保存状态
hook.saveTodoState(todos);

// 加载状态
const todos = hook.loadTodoState();

// 生成继续提示
const prompt = hook.generateContinuationPrompt(todos);
```

## 配置

在 `todo-continuation.js` 中可以修改：

```javascript
const CONFIG = {
  todoStatePath: '...',  // 状态文件路径
  backupDir: '...',      // 备份目录
  maxBackups: 5,         // 最大备份数量
};
```

---
*DramiaOS Hooks v1.0 | 最后更新: 2024-12-24*

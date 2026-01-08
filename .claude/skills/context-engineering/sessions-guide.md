# Sessions 详细指南

> **Session 定义**：单次对话的容器，包含按时间顺序的事件流（Events）和代理的工作记忆（State）

## 📋 核心概念

### Session 结构

```
Session
├── Events（事件流）- 时间顺序的对话历史
│   ├── User Input（用户输入）
│   ├── Agent Response（代理响应）
│   ├── Tool Call（工具调用）
│   └── Tool Output（工具输出）
│
└── State（状态）- 代理的工作记忆
    ├── Variables（变量）
    ├── Context（上下文）
    └── Metadata（元数据）
```

### Event 类型

| Event 类型 | 描述 | 示例 |
|-----------|------|------|
| **User Input** | 用户的消息或请求 | "帮我分析这段代码" |
| **Agent Response** | AI 代理的回复 | "这段代码使用了递归..." |
| **Tool Call** | 代理调用工具的请求 | `execute_code(language="python")` |
| **Tool Output** | 工具返回的结果 | `{"result": 42, "status": "success"}` |

## 🔄 Session 生命周期

### 1. 初始化（Initialization）

```python
# 创建新 Session
session = {
    "session_id": "unique_session_id",
    "user_id": "user_123",
    "created_at": "2025-01-17T10:00:00Z",
    "events": [],
    "state": {
        "context": {},
        "metadata": {"platform": "web", "language": "zh"}
    }
}
```

### 2. 事件追加（Event Appending）

```python
# 添加用户输入
session["events"].append({
    "type": "user_input",
    "timestamp": "2025-01-17T10:01:00Z",
    "content": "What is 2 + 2?"
})

# 添加代理响应
session["events"].append({
    "type": "agent_response",
    "timestamp": "2025-01-17T10:01:05Z",
    "content": "The answer is 4."
})
```

### 3. 状态更新（State Update）

```python
# 更新工作记忆
session["state"]["context"]["last_calculation"] = "2 + 2 = 4"
session["state"]["context"]["topic"] = "mathematics"
```

### 4. 压缩（Compression）

当 Session 变得过长（接近上下文窗口限制）：

#### 策略 1: 截断（Truncation）
```python
# 保留最近 N 个事件
MAX_EVENTS = 100
if len(session["events"]) > MAX_EVENTS:
    # 保留前 10 个（重要上下文）+ 最近 90 个
    session["events"] = (
        session["events"][:10] +
        session["events"][-90:]
    )
```

#### 策略 2: 摘要（Summarization）
```python
# 使用 LLM 生成摘要
def summarize_events(events):
    prompt = f"""
    Summarize the following conversation history concisely:
    {events}

    Focus on: key decisions, user preferences, important facts.
    """
    summary = llm.generate(prompt)
    return summary

# 替换旧事件为摘要
if len(session["events"]) > 100:
    old_events = session["events"][:80]
    summary = summarize_events(old_events)
    session["events"] = [
        {"type": "summary", "content": summary}
    ] + session["events"][80:]
```

#### 策略 3: 混合策略
```python
# 保留关键事件 + 摘要其他
def compress_session(session):
    important_events = [
        e for e in session["events"]
        if e.get("important", False)  # 用户标记的重要事件
    ]

    other_events = [
        e for e in session["events"]
        if not e.get("important", False)
    ]

    # 摘要非重要事件
    summary = summarize_events(other_events[:50])

    return {
        "events": [
            {"type": "summary", "content": summary}
        ] + important_events + other_events[50:]
    }
```

## 🏗️ Session 管理模式

### 模式 1: 简单内存模式

```python
class SimpleSessionManager:
    def __init__(self):
        self.sessions = {}  # 存储在内存中

    def create_session(self, user_id):
        session_id = generate_unique_id()
        self.sessions[session_id] = {
            "user_id": user_id,
            "events": [],
            "state": {}
        }
        return session_id

    def add_event(self, session_id, event):
        self.sessions[session_id]["events"].append(event)

    def get_session(self, session_id):
        return self.sessions[session_id]
```

**优点**：简单、快速
**缺点**：无持久化、服务器重启丢失

### 模式 2: 数据库持久化模式

```python
class PersistentSessionManager:
    def __init__(self, db_connection):
        self.db = db_connection

    def create_session(self, user_id):
        session = {
            "session_id": generate_unique_id(),
            "user_id": user_id,
            "events": [],
            "state": {},
            "created_at": datetime.now()
        }
        self.db.sessions.insert_one(session)
        return session["session_id"]

    def add_event(self, session_id, event):
        self.db.sessions.update_one(
            {"session_id": session_id},
            {"$push": {"events": event}}
        )

    def get_session(self, session_id):
        return self.db.sessions.find_one({"session_id": session_id})
```

**优点**：持久化、可恢复
**缺点**：需要数据库、稍慢

### 模式 3: 分布式缓存模式（生产环境）

```python
import redis

class DistributedSessionManager:
    def __init__(self, redis_client):
        self.cache = redis_client
        self.ttl = 3600  # 1小时过期

    def create_session(self, user_id):
        session_id = generate_unique_id()
        session = {
            "user_id": user_id,
            "events": [],
            "state": {}
        }
        # 存储到 Redis
        self.cache.setex(
            f"session:{session_id}",
            self.ttl,
            json.dumps(session)
        )
        return session_id

    def add_event(self, session_id, event):
        session = self.get_session(session_id)
        session["events"].append(event)
        # 更新缓存
        self.cache.setex(
            f"session:{session_id}",
            self.ttl,
            json.dumps(session)
        )

    def get_session(self, session_id):
        data = self.cache.get(f"session:{session_id}")
        return json.loads(data) if data else None
```

**优点**：高性能、分布式、自动过期
**缺点**：需要 Redis、成本较高

## 🧪 Session 压缩策略对比

### ADK 自动压缩配置

```python
from google.adk.apps import App
from google.adk.apps.app import EventsCompactionConfig

app = App(
    name='my_agent_app',
    root_agent=agent,
    events_compaction_config=EventsCompactionConfig(
        compaction_interval=5,  # 每 5 轮对话压缩一次
        overlap_size=1,         # 保留 1 轮重叠
    ),
)
```

**工作原理**：
1. 每 5 轮对话触发压缩
2. 将旧事件发送给 LLM 生成摘要
3. 用摘要替换旧事件
4. 保留 1 轮重叠以维持连贯性

### 手动压缩策略

```python
def manual_compress(session, max_tokens=4000):
    """
    手动压缩策略：
    1. 计算当前 token 数
    2. 如果超过阈值，执行压缩
    3. 保留最近对话 + 重要事件
    """
    current_tokens = estimate_tokens(session["events"])

    if current_tokens > max_tokens:
        # 保留最近 20 轮对话
        recent_events = session["events"][-20:]

        # 保留标记为重要的事件
        important_events = [
            e for e in session["events"][:-20]
            if e.get("metadata", {}).get("important", False)
        ]

        # 其他事件生成摘要
        old_events = [
            e for e in session["events"][:-20]
            if not e.get("metadata", {}).get("important", False)
        ]

        summary = generate_summary(old_events)

        session["events"] = [
            {"type": "summary", "content": summary}
        ] + important_events + recent_events

    return session
```

## 🎯 Multi-Agent Session 模式

### 模式 1: Unified History（统一历史）

```python
# 所有代理共享同一个 Session
session = {
    "session_id": "shared_session",
    "events": [
        {"role": "user", "content": "Book a flight"},
        {"role": "travel_agent", "content": "Searching flights..."},
        {"role": "payment_agent", "content": "Processing payment..."}
    ]
}
```

**优点**：
- 完整的上下文共享
- 代理可以看到其他代理的操作
- 协作紧密

**缺点**：
- 隐私风险（所有代理看到所有信息）
- 上下文污染（无关信息混杂）

**适用场景**：协作任务（旅行预订、项目管理）

### 模式 2: Separate Histories（独立历史）

```python
# 每个代理维护自己的 Session
agent1_session = {
    "session_id": "agent1_session",
    "events": [{"role": "user", "content": "Book flight"}]
}

agent2_session = {
    "session_id": "agent2_session",
    "events": [{"role": "agent1", "content": "Flight booked, proceed to payment"}]
}
```

**优点**：
- 隐私保护（代理只看到需要的信息）
- 清晰边界（职责分明）

**缺点**：
- 需要显式同步机制
- 可能丢失上下文

**适用场景**：隐私敏感任务（医疗、金融）

### 模式 3: Hierarchical Sessions（层级会话）

```python
# 主 Session + 子 Sessions
master_session = {
    "session_id": "master",
    "events": [
        {"role": "user", "content": "Plan a trip"},
        {"role": "coordinator", "content": "Delegating to agents..."}
    ]
}

flight_agent_session = {
    "session_id": "flight_agent",
    "parent_session_id": "master",
    "events": [{"role": "coordinator", "content": "Book flight to Paris"}]
}

hotel_agent_session = {
    "session_id": "hotel_agent",
    "parent_session_id": "master",
    "events": [{"role": "coordinator", "content": "Book hotel in Paris"}]
}
```

**优点**：
- 结合了统一和独立的优点
- 清晰的指挥链

**缺点**：
- 复杂度较高

**适用场景**：复杂多代理系统（企业级应用）

## 📊 Session 监控指标

### 关键指标

| 指标 | 描述 | 阈值建议 |
|-----|------|---------|
| **Session 长度** | 事件数量 | <100 events |
| **Token 使用** | 估算的 token 数 | <上下文窗口的 80% |
| **压缩频率** | 压缩操作次数 | 根据需要 |
| **延迟** | Session 加载时间 | <500ms |

### 监控代码示例

```python
import time

class SessionMetrics:
    def __init__(self, session):
        self.session = session

    def get_event_count(self):
        return len(self.session["events"])

    def estimate_tokens(self):
        # 简单估算：每 4 个字符 ≈ 1 token
        text = json.dumps(self.session["events"])
        return len(text) // 4

    def check_health(self):
        event_count = self.get_event_count()
        token_count = self.estimate_tokens()

        warnings = []

        if event_count > 100:
            warnings.append(f"High event count: {event_count}")

        if token_count > 8000:  # 假设 10k token 上下文窗口
            warnings.append(f"High token usage: {token_count}")

        return {
            "event_count": event_count,
            "token_count": token_count,
            "warnings": warnings
        }

# 使用示例
metrics = SessionMetrics(session)
health = metrics.check_health()
print(health)
# 输出: {"event_count": 120, "token_count": 9500, "warnings": ["High event count: 120", "High token usage: 9500"]}
```

## 🚀 生产环境最佳实践

### 1. 设置 Session 过期时间

```python
# 使用 Redis 自动过期
redis_client.setex(
    f"session:{session_id}",
    ttl=3600,  # 1小时后自动删除
    value=json.dumps(session)
)
```

### 2. 定期清理旧 Session

```python
def cleanup_old_sessions(db, days=7):
    """删除 7 天前的 Session"""
    cutoff_date = datetime.now() - timedelta(days=days)
    db.sessions.delete_many({
        "created_at": {"$lt": cutoff_date}
    })
```

### 3. 实现 Session 备份

```python
def backup_session(session, backup_storage):
    """在压缩前备份原始 Session"""
    backup_id = f"{session['session_id']}_backup_{datetime.now().isoformat()}"
    backup_storage.save(backup_id, session)
```

### 4. 处理并发访问

```python
import threading

class ThreadSafeSessionManager:
    def __init__(self):
        self.sessions = {}
        self.locks = {}

    def add_event(self, session_id, event):
        if session_id not in self.locks:
            self.locks[session_id] = threading.Lock()

        with self.locks[session_id]:
            self.sessions[session_id]["events"].append(event)
```

## 🔗 延伸阅读

- **[Memory 详细指南](./memory-guide.md)** - 了解跨会话的长期记忆
- **[生产环境检查清单](./production-checklist.md)** - 部署前的安全和性能检查
- **[主 Skill 文档](./skill.md)** - Context Engineering 核心概念

---

**关键要点**：
- Session 是对话的容器，包含 Events + State
- 压缩策略：截断、摘要、混合
- Multi-Agent 模式：Unified、Separate、Hierarchical
- 生产环境必须考虑：过期、清理、备份、并发

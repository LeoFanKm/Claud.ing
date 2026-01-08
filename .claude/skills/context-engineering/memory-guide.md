# Memory 详细指南

> **Memory 定义**：跨会话的长期持久化机制，让 AI 代理在多次对话中记住关键信息

## 📋 核心概念

### Memory 的两种类型

#### 1. Declarative Memory（陈述性记忆）

**"Knowing What"** - 知道是什么

```json
{
  "type": "declarative",
  "content": {
    "user_preferences": {
      "communication_style": "concise",
      "language": "zh",
      "expertise_level": "intermediate"
    },
    "facts": {
      "user_name": "张三",
      "location": "上海",
      "timezone": "Asia/Shanghai"
    }
  }
}
```

**示例**：
- 用户偏好："喜欢简洁的回答"
- 个人信息："住在上海"
- 历史事实："上次讨论了 React Hooks"

#### 2. Procedural Memory（程序性记忆）

**"Knowing How"** - 知道如何做

```json
{
  "type": "procedural",
  "content": {
    "workflows": {
      "code_review": [
        "1. 检查代码风格",
        "2. 分析性能影响",
        "3. 提出改进建议"
      ]
    },
    "strategies": {
      "debugging": "先检查日志，然后复现问题，最后定位根因"
    }
  }
}
```

**示例**：
- 工作流程："代码审查的步骤"
- 策略："调试问题的方法"
- 自我改进："用户反馈后的调整"

### Memory 的组织形式

#### Structured（结构化）

```json
{
  "user_profile": {
    "name": "李四",
    "preferences": {
      "code_style": "functional",
      "indent": "2 spaces"
    },
    "history": {
      "projects": ["web-app", "mobile-app"]
    }
  }
}
```

**优点**：易于查询、更新、验证
**缺点**：需要预定义结构

#### Unstructured（非结构化）

```
用户喜欢函数式编程风格，代码缩进使用 2 个空格。
之前参与过 web-app 和 mobile-app 两个项目。
```

**优点**：灵活、自然语言
**缺点**：查询和更新较复杂

## 🔄 Memory 生命周期

### 1. Extraction（提取）

**目标**：从对话中提取值得记住的信息

#### LLM 驱动的提取

```python
def extract_memories(conversation_history, topics):
    """
    使用 LLM 从对话中提取记忆

    topics: 定义要提取的主题
    """
    prompt = f"""
    Analyze the following conversation and extract information about:
    {topics}

    Conversation:
    {conversation_history}

    Return JSON with extracted information.
    """

    response = llm.generate(prompt)
    return parse_json(response)

# 示例使用
topics = [
    "user preferences",
    "user's technical expertise",
    "important decisions made"
]

memories = extract_memories(session["events"], topics)
```

#### 基于规则的提取

```python
def rule_based_extraction(events):
    """
    使用规则从对话中提取记忆
    """
    memories = []

    for event in events:
        # 规则 1: 用户明确表达偏好
        if "I prefer" in event["content"]:
            memories.append({
                "type": "preference",
                "content": event["content"],
                "confidence": 0.9
            })

        # 规则 2: 用户分享个人信息
        if any(word in event["content"] for word in ["my name is", "I live in"]):
            memories.append({
                "type": "personal_info",
                "content": event["content"],
                "confidence": 0.95
            })

    return memories
```

### 2. Consolidation（整合）

**目标**：合并、更新、删除记忆以保持一致性

#### 合并重复记忆

```python
def merge_duplicate_memories(memories):
    """
    合并重复或相似的记忆
    """
    merged = []
    seen = set()

    for memory in memories:
        # 计算相似度
        similar_found = False
        for existing in merged:
            if calculate_similarity(memory, existing) > 0.8:
                # 合并（保留更新的）
                if memory["timestamp"] > existing["timestamp"]:
                    merged.remove(existing)
                    merged.append(memory)
                similar_found = True
                break

        if not similar_found:
            merged.append(memory)

    return merged
```

#### 更新冲突记忆

```python
def update_conflicting_memories(memories):
    """
    处理冲突的记忆（例如：用户偏好改变）
    """
    conflicts = find_conflicts(memories)

    for conflict in conflicts:
        old_memory = conflict["old"]
        new_memory = conflict["new"]

        # 策略 1: 保留最新的
        if new_memory["timestamp"] > old_memory["timestamp"]:
            memories.remove(old_memory)

        # 策略 2: 标记为已过时
        else:
            old_memory["status"] = "outdated"
            old_memory["superseded_by"] = new_memory["id"]

    return memories
```

#### 删除过时记忆

```python
def cleanup_outdated_memories(memories, max_age_days=90):
    """
    删除过时的记忆
    """
    cutoff_date = datetime.now() - timedelta(days=max_age_days)

    cleaned = [
        m for m in memories
        if m["timestamp"] > cutoff_date or m.get("important", False)
    ]

    return cleaned
```

### 3. Storage（存储）

#### Vector Database 存储

```python
from pinecone import Pinecone

# 初始化向量数据库
pc = Pinecone(api_key="YOUR_API_KEY")
index = pc.Index("memories")

def store_memory_vector(memory, user_id):
    """
    将记忆存储到向量数据库
    """
    # 生成 embedding
    embedding = generate_embedding(memory["content"])

    # 存储
    index.upsert(vectors=[{
        "id": memory["id"],
        "values": embedding,
        "metadata": {
            "user_id": user_id,
            "type": memory["type"],
            "timestamp": memory["timestamp"],
            "content": memory["content"]
        }
    }])
```

#### Knowledge Graph 存储

```python
from neo4j import GraphDatabase

class KnowledgeGraphMemory:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def store_memory(self, memory, user_id):
        """
        将记忆存储为知识图谱
        """
        with self.driver.session() as session:
            session.run("""
                MERGE (u:User {id: $user_id})
                CREATE (m:Memory {
                    id: $memory_id,
                    content: $content,
                    type: $type,
                    timestamp: $timestamp
                })
                CREATE (u)-[:HAS_MEMORY]->(m)
            """,
            user_id=user_id,
            memory_id=memory["id"],
            content=memory["content"],
            type=memory["type"],
            timestamp=memory["timestamp"]
            )
```

### 4. Retrieval（检索）

#### 语义检索（Vector DB）

```python
def retrieve_relevant_memories(query, user_id, top_k=5):
    """
    基于语义相似度检索记忆
    """
    # 生成查询的 embedding
    query_embedding = generate_embedding(query)

    # 检索
    results = index.query(
        vector=query_embedding,
        top_k=top_k,
        filter={"user_id": user_id}
    )

    return [r["metadata"] for r in results["matches"]]
```

#### 关系检索（Knowledge Graph）

```python
def retrieve_connected_memories(memory_id):
    """
    检索相关联的记忆
    """
    with self.driver.session() as session:
        result = session.run("""
            MATCH (m:Memory {id: $memory_id})-[r*1..2]-(related:Memory)
            RETURN related
        """, memory_id=memory_id)

        return [record["related"] for record in result]
```

## 🏗️ Memory 组织模式

### 模式 1: Collections（集合）

```python
memories = {
    "preferences": [
        {"key": "communication_style", "value": "concise"},
        {"key": "language", "value": "zh"}
    ],
    "facts": [
        {"key": "location", "value": "上海"},
        {"key": "timezone", "value": "Asia/Shanghai"}
    ],
    "workflows": [
        {
            "name": "code_review",
            "steps": ["检查风格", "分析性能", "提建议"]
        }
    ]
}
```

**优点**：按类别组织，易于管理
**缺点**：需要预定义类别

### 模式 2: Structured User Profile（结构化用户画像）

```python
user_profile = {
    "basic_info": {
        "name": "张三",
        "location": "上海",
        "timezone": "Asia/Shanghai"
    },
    "preferences": {
        "communication": {
            "style": "concise",
            "language": "zh",
            "formality": "casual"
        },
        "technical": {
            "code_style": "functional",
            "indent": "2 spaces",
            "framework": "React"
        }
    },
    "history": {
        "projects": ["web-app", "mobile-app"],
        "topics_discussed": ["React", "TypeScript", "Testing"]
    }
}
```

**优点**：结构清晰，易于查询和更新
**缺点**：需要维护复杂结构

### 模式 3: Rolling Summary（滚动摘要）

```python
rolling_summary = {
    "current_summary": """
    用户是一位中级 React 开发者，偏好函数式编程风格。
    最近在学习 TypeScript 和测试最佳实践。
    喜欢简洁的回答，时区为上海。
    """,
    "version": 5,
    "last_updated": "2025-01-17T10:00:00Z",
    "history": [
        {
            "version": 4,
            "summary": "用户是 React 开发者...",
            "timestamp": "2025-01-10T10:00:00Z"
        }
    ]
}
```

**优点**：简洁，易于加载到上下文
**缺点**：可能丢失细节

## 🔍 Provenance Tracking（来源追踪）

### 为什么需要 Provenance？

**问题**：如何判断记忆的可信度？

**解决**：追踪记忆的来源、新鲜度、置信度

### Provenance 结构

```python
memory_with_provenance = {
    "id": "memory_123",
    "content": "用户喜欢简洁的回答",
    "type": "preference",

    # Provenance 信息
    "provenance": {
        "source_type": "direct_statement",  # 直接陈述 > 推断
        "session_id": "session_456",
        "timestamp": "2025-01-17T10:00:00Z",
        "confidence": 0.95,  # 0-1 的置信度
        "verification_count": 3,  # 被验证的次数
        "last_verified": "2025-01-17T10:00:00Z"
    }
}
```

### Source Type 优先级

| Source Type | 置信度 | 示例 |
|------------|--------|------|
| **direct_statement** | 0.9-1.0 | "我喜欢简洁的回答" |
| **observed_behavior** | 0.7-0.9 | 用户多次要求简洁回答 |
| **inference** | 0.5-0.7 | 从上下文推断 |
| **third_party** | 0.3-0.5 | 其他系统提供的信息 |

### Provenance 更新策略

```python
def update_memory_provenance(memory, new_evidence):
    """
    根据新证据更新 Provenance
    """
    # 增加验证计数
    memory["provenance"]["verification_count"] += 1
    memory["provenance"]["last_verified"] = datetime.now()

    # 根据验证次数提高置信度
    if memory["provenance"]["verification_count"] > 3:
        memory["provenance"]["confidence"] = min(
            memory["provenance"]["confidence"] + 0.05,
            1.0
        )

    return memory
```

## 📊 Memory vs RAG 对比

| 维度 | Memory | RAG（检索增强生成） |
|-----|--------|-------------------|
| **目标** | 了解用户 | 了解知识 |
| **内容** | 个人偏好、历史、状态 | 文档、知识库、公开信息 |
| **更新频率** | 动态（对话中） | 相对静态（定期更新） |
| **个性化** | 高度个性化 | 通用知识 |
| **存储** | 用户级别 | 全局级别 |
| **示例** | "用户喜欢简洁回答" | "Python 的最新语法" |

### 结合使用示例

```python
def generate_response(user_query, user_id):
    """
    结合 Memory 和 RAG 生成响应
    """
    # 1. 检索用户记忆（了解用户）
    user_memories = retrieve_memories(user_id)
    user_context = format_memories(user_memories)

    # 2. 检索相关知识（了解事实）
    relevant_docs = rag_retrieve(user_query)
    knowledge_context = format_docs(relevant_docs)

    # 3. 组合上下文生成响应
    prompt = f"""
    User Context:
    {user_context}

    Relevant Knowledge:
    {knowledge_context}

    User Query: {user_query}

    Generate a response that:
    - Respects user preferences (from Memory)
    - Provides accurate information (from RAG)
    """

    response = llm.generate(prompt)
    return response
```

## 🚀 生产环境最佳实践

### 1. 异步 Memory 生成

```python
import asyncio

async def generate_memories_async(session_id, user_id):
    """
    后台异步生成记忆，不阻塞用户交互
    """
    # 获取 Session 历史
    session = await get_session(session_id)

    # 提取记忆
    memories = await extract_memories(session["events"])

    # 整合记忆
    consolidated = await consolidate_memories(memories, user_id)

    # 存储记忆
    await store_memories(consolidated, user_id)

    return consolidated

# 在响应后触发（不阻塞）
@app.post("/chat")
async def chat_endpoint(request):
    # 处理用户请求
    response = generate_response(request.query)

    # 后台生成记忆（异步）
    asyncio.create_task(
        generate_memories_async(request.session_id, request.user_id)
    )

    return response
```

### 2. PII 处理

```python
import re

def redact_pii(memory):
    """
    删除或脱敏个人敏感信息（PII）
    """
    # 邮箱
    memory["content"] = re.sub(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        '[EMAIL_REDACTED]',
        memory["content"]
    )

    # 电话号码
    memory["content"] = re.sub(
        r'\b\d{3}[-.]?\d{4}[-.]?\d{4}\b',
        '[PHONE_REDACTED]',
        memory["content"]
    )

    # 信用卡号
    memory["content"] = re.sub(
        r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',
        '[CARD_REDACTED]',
        memory["content"]
    )

    return memory
```

### 3. Memory 访问控制

```python
class MemoryAccessControl:
    def __init__(self, db):
        self.db = db

    def can_access_memory(self, user_id, memory_id):
        """
        验证用户是否有权访问记忆
        """
        memory = self.db.get_memory(memory_id)

        # 检查所有权
        if memory["user_id"] != user_id:
            return False

        # 检查共享权限
        if memory.get("shared_with") and user_id in memory["shared_with"]:
            return True

        return memory["user_id"] == user_id

    def retrieve_memories(self, user_id, query):
        """
        只检索用户有权访问的记忆
        """
        all_memories = self.db.query_memories(query)

        accessible = [
            m for m in all_memories
            if self.can_access_memory(user_id, m["id"])
        ]

        return accessible
```

### 4. Memory 防投毒

```python
def validate_memory(memory):
    """
    验证记忆的有效性，防止恶意输入
    """
    # 检查内容长度
    if len(memory["content"]) > 10000:
        raise ValueError("Memory content too long")

    # 检查恶意模式
    malicious_patterns = [
        r"ignore previous instructions",
        r"system: you are now",
        r"<script>",
    ]

    for pattern in malicious_patterns:
        if re.search(pattern, memory["content"], re.IGNORECASE):
            raise ValueError("Potentially malicious content detected")

    # 检查元数据
    if "provenance" not in memory:
        raise ValueError("Missing provenance information")

    return True
```

## 🔗 延伸阅读

- **[Sessions 详细指南](./sessions-guide.md)** - 了解单次会话的管理
- **[生产环境检查清单](./production-checklist.md)** - 部署前的安全和性能检查
- **[主 Skill 文档](./skill.md)** - Context Engineering 核心概念

---

**关键要点**：
- Memory 分为 Declarative（知道什么）和 Procedural（知道如何）
- 生命周期：提取 → 整合 → 存储 → 检索
- Provenance 追踪来源和置信度
- Memory ≠ RAG，但可以结合使用
- 生产环境必须考虑：异步处理、PII、访问控制、防投毒

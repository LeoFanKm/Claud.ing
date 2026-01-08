# 生产环境检查清单

> **目标**：确保 Context Engineering 系统在生产环境中安全、高性能、可扩展

## 🔐 安全性检查清单

### 1. PII（个人敏感信息）处理

#### ✅ 必须实现

- [ ] **PII 检测和脱敏**
  ```python
  def redact_pii(text):
      # 邮箱
      text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', text)
      # 电话
      text = re.sub(r'\b\d{3}[-.]?\d{4}[-.]?\d{4}\b', '[PHONE]', text)
      # 身份证号（中国）
      text = re.sub(r'\b\d{17}[\dXx]\b', '[ID_NUMBER]', text)
      return text
  ```

- [ ] **存储前自动脱敏**
  ```python
  def store_memory(memory):
      memory["content"] = redact_pii(memory["content"])
      db.save(memory)
  ```

- [ ] **日志中不记录 PII**
  ```python
  # ❌ 错误
  logger.info(f"User {user_email} logged in")

  # ✅ 正确
  logger.info(f"User {hash(user_email)} logged in")
  ```

#### 📋 合规要求

| 法规 | 要求 | 检查项 |
|-----|------|--------|
| **GDPR**（欧盟） | 数据删除权 | 实现 `delete_user_data()` API |
| **CCPA**（加州） | 数据访问权 | 实现 `export_user_data()` API |
| **PIPL**（中国） | 数据本地化 | 中国用户数据存储在中国 |

### 2. 数据隔离

#### ✅ 必须实现

- [ ] **用户级别隔离**
  ```python
  # 所有查询必须包含 user_id 过滤
  def get_memories(user_id):
      return db.query("SELECT * FROM memories WHERE user_id = ?", user_id)
  ```

- [ ] **Multi-tenancy（多租户）隔离**
  ```python
  # 如果支持企业客户，必须隔离租户数据
  def get_memories(tenant_id, user_id):
      return db.query(
          "SELECT * FROM memories WHERE tenant_id = ? AND user_id = ?",
          tenant_id, user_id
      )
  ```

- [ ] **访问控制验证**
  ```python
  def can_access_memory(user_id, memory_id):
      memory = db.get_memory(memory_id)
      return memory["user_id"] == user_id
  ```

### 3. Memory 防投毒

#### ✅ 必须实现

- [ ] **输入验证**
  ```python
  def validate_memory_input(content):
      # 长度限制
      if len(content) > 10000:
          raise ValueError("Content too long")

      # 恶意模式检测
      malicious_patterns = [
          r"ignore previous instructions",
          r"system:\s*you are now",
          r"<script>",
          r"eval\(",
      ]

      for pattern in malicious_patterns:
          if re.search(pattern, content, re.IGNORECASE):
              raise ValueError("Potentially malicious content")

      return True
  ```

- [ ] **Provenance 验证**
  ```python
  # 每条记忆必须有来源追踪
  required_provenance_fields = [
      "source_type",
      "timestamp",
      "confidence",
      "session_id"
  ]

  for field in required_provenance_fields:
      if field not in memory["provenance"]:
          raise ValueError(f"Missing provenance field: {field}")
  ```

- [ ] **内容审核**
  ```python
  # 使用 AI 审核（可选但推荐）
  def moderate_content(content):
      result = moderation_api.check(content)
      if result["flagged"]:
          raise ValueError("Content violates policy")
      return True
  ```

## ⚡ 性能检查清单

### 1. 延迟目标

| 操作 | P50 | P95 | P99 |
|-----|-----|-----|-----|
| **Session 创建** | <50ms | <100ms | <200ms |
| **Event 追加** | <20ms | <50ms | <100ms |
| **Memory 检索** | <100ms | <200ms | <500ms |
| **Memory 生成** | 异步 | 异步 | 异步 |

#### ✅ 必须实现

- [ ] **异步 Memory 生成**
  ```python
  @app.post("/chat")
  async def chat(request):
      # 同步：返回响应
      response = generate_response(request)

      # 异步：后台生成记忆（不阻塞）
      asyncio.create_task(generate_memories(request.session_id))

      return response
  ```

- [ ] **缓存热门数据**
  ```python
  from functools import lru_cache

  @lru_cache(maxsize=1000)
  def get_user_profile(user_id):
      return db.query("SELECT * FROM user_profiles WHERE user_id = ?", user_id)
  ```

- [ ] **批量操作**
  ```python
  # ❌ 错误：N 次数据库调用
  for memory in memories:
      db.insert(memory)

  # ✅ 正确：1 次批量插入
  db.bulk_insert(memories)
  ```

### 2. Token 优化

#### ✅ 必须实现

- [ ] **上下文窗口监控**
  ```python
  def estimate_tokens(events):
      # 简单估算：4 字符 ≈ 1 token
      text = json.dumps(events)
      return len(text) // 4

  def check_context_size(session):
      tokens = estimate_tokens(session["events"])
      max_tokens = 128000  # 例如：Gemini 2.0 Pro

      if tokens > max_tokens * 0.8:
          logger.warning(f"High token usage: {tokens}/{max_tokens}")
          compress_session(session)
  ```

- [ ] **智能压缩策略**
  ```python
  def compress_session(session):
      # 保留最近 20 轮对话
      recent = session["events"][-20:]

      # 保留重要事件
      important = [
          e for e in session["events"][:-20]
          if e.get("important", False)
      ]

      # 摘要其他事件
      old_events = [
          e for e in session["events"][:-20]
          if not e.get("important", False)
      ]
      summary = generate_summary(old_events)

      session["events"] = [
          {"type": "summary", "content": summary}
      ] + important + recent
  ```

### 3. 数据库优化

#### ✅ 必须实现

- [ ] **索引优化**
  ```sql
  -- 必须创建的索引
  CREATE INDEX idx_memories_user_id ON memories(user_id);
  CREATE INDEX idx_memories_timestamp ON memories(timestamp);
  CREATE INDEX idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX idx_sessions_created_at ON sessions(created_at);
  ```

- [ ] **查询优化**
  ```python
  # ❌ 错误：SELECT *
  db.query("SELECT * FROM memories WHERE user_id = ?", user_id)

  # ✅ 正确：只查询需要的字段
  db.query("SELECT id, content, type FROM memories WHERE user_id = ?", user_id)
  ```

- [ ] **连接池配置**
  ```python
  # 数据库连接池
  db_pool = create_pool(
      min_size=10,
      max_size=100,
      timeout=30
  )
  ```

## 📈 可扩展性检查清单

### 1. 架构模式

#### ✅ 必须实现

- [ ] **无状态服务**
  ```python
  # ❌ 错误：全局变量存储状态
  user_sessions = {}

  # ✅ 正确：存储在数据库/缓存
  def get_session(session_id):
      return redis.get(f"session:{session_id}")
  ```

- [ ] **水平扩展支持**
  ```python
  # 使用负载均衡器（如：Nginx）分发请求
  # 多个服务实例共享同一个数据库和缓存

  # 配置示例（docker-compose）
  services:
    app:
      image: my-app:latest
      replicas: 3  # 3 个实例
      environment:
        - DB_HOST=postgres
        - REDIS_HOST=redis
  ```

- [ ] **数据分片（Sharding）**
  ```python
  def get_shard_id(user_id, num_shards=10):
      return hash(user_id) % num_shards

  def get_user_db(user_id):
      shard_id = get_shard_id(user_id)
      return db_connections[shard_id]
  ```

### 2. 容量规划

#### 📊 估算指标

| 指标 | 小规模 | 中规模 | 大规模 |
|-----|--------|--------|--------|
| **用户数** | <10K | 10K-100K | >100K |
| **每用户记忆** | <100 | 100-1K | >1K |
| **每日对话** | <10K | 10K-100K | >100K |
| **存储需求** | <1GB | 1-100GB | >100GB |

#### ✅ 必须实现

- [ ] **数据清理策略**
  ```python
  # 定期清理旧 Session（例如：7 天前）
  def cleanup_old_sessions(days=7):
      cutoff = datetime.now() - timedelta(days=days)
      db.execute(
          "DELETE FROM sessions WHERE created_at < ?",
          cutoff
      )

  # 定期清理过时 Memory（例如：90 天未访问）
  def cleanup_stale_memories(days=90):
      cutoff = datetime.now() - timedelta(days=days)
      db.execute(
          "DELETE FROM memories WHERE last_accessed < ? AND important = false",
          cutoff
      )
  ```

- [ ] **归档策略**
  ```python
  # 归档旧数据到冷存储（如：S3）
  def archive_old_data(days=180):
      cutoff = datetime.now() - timedelta(days=days)
      old_data = db.query(
          "SELECT * FROM memories WHERE created_at < ?",
          cutoff
      )

      # 上传到 S3
      s3.put_object(
          Bucket="archived-memories",
          Key=f"archive_{cutoff.isoformat()}.json",
          Body=json.dumps(old_data)
      )

      # 从数据库删除
      db.execute("DELETE FROM memories WHERE created_at < ?", cutoff)
  ```

### 3. 监控和告警

#### ✅ 必须实现

- [ ] **关键指标监控**
  ```python
  from prometheus_client import Counter, Histogram

  # 请求计数
  request_counter = Counter('memory_requests_total', 'Total memory requests')

  # 延迟分布
  latency_histogram = Histogram('memory_latency_seconds', 'Memory operation latency')

  # 错误率
  error_counter = Counter('memory_errors_total', 'Total memory errors')

  @latency_histogram.time()
  def retrieve_memories(user_id):
      try:
          request_counter.inc()
          memories = db.query("SELECT * FROM memories WHERE user_id = ?", user_id)
          return memories
      except Exception as e:
          error_counter.inc()
          raise
  ```

- [ ] **告警规则**
  ```yaml
  # Prometheus 告警规则示例
  groups:
    - name: memory_system
      rules:
        # 错误率 > 5%
        - alert: HighErrorRate
          expr: rate(memory_errors_total[5m]) / rate(memory_requests_total[5m]) > 0.05
          for: 5m
          annotations:
            summary: "High error rate in memory system"

        # P95 延迟 > 500ms
        - alert: HighLatency
          expr: histogram_quantile(0.95, memory_latency_seconds) > 0.5
          for: 5m
          annotations:
            summary: "High P95 latency in memory operations"
  ```

## 🧪 测试检查清单

### 1. 单元测试

#### ✅ 必须覆盖

- [ ] **Memory 提取逻辑**
  ```python
  def test_memory_extraction():
      events = [
          {"content": "I prefer concise answers"},
          {"content": "My name is Alice"}
      ]

      memories = extract_memories(events)

      assert len(memories) == 2
      assert memories[0]["type"] == "preference"
      assert memories[1]["type"] == "personal_info"
  ```

- [ ] **Memory 整合逻辑**
  ```python
  def test_merge_duplicate_memories():
      memories = [
          {"content": "User likes concise answers", "timestamp": "2025-01-01"},
          {"content": "User prefers brief responses", "timestamp": "2025-01-02"}
      ]

      merged = merge_duplicate_memories(memories)

      assert len(merged) == 1  # 合并重复
      assert merged[0]["timestamp"] == "2025-01-02"  # 保留最新
  ```

- [ ] **PII 脱敏**
  ```python
  def test_pii_redaction():
      text = "My email is test@example.com and phone is 138-0000-0000"
      redacted = redact_pii(text)

      assert "test@example.com" not in redacted
      assert "138-0000-0000" not in redacted
      assert "[EMAIL]" in redacted
      assert "[PHONE]" in redacted
  ```

### 2. 集成测试

#### ✅ 必须覆盖

- [ ] **端到端 Session 流程**
  ```python
  def test_session_lifecycle():
      # 创建 Session
      session_id = create_session(user_id="user_123")

      # 添加事件
      add_event(session_id, {"type": "user_input", "content": "Hello"})
      add_event(session_id, {"type": "agent_response", "content": "Hi there!"})

      # 检索 Session
      session = get_session(session_id)
      assert len(session["events"]) == 2

      # 压缩 Session
      compress_session(session)
      assert len(session["events"]) < 2  # 已压缩
  ```

- [ ] **Memory 生成和检索**
  ```python
  def test_memory_generation_and_retrieval():
      # 生成 Memory
      session_id = create_session_with_events(user_id="user_123")
      generate_memories(session_id)

      # 检索 Memory
      memories = retrieve_memories("user_123", query="user preferences")
      assert len(memories) > 0
      assert "preference" in memories[0]["type"]
  ```

### 3. 性能测试

#### ✅ 必须覆盖

- [ ] **负载测试**
  ```python
  import time
  from concurrent.futures import ThreadPoolExecutor

  def test_load():
      # 模拟 100 个并发用户
      with ThreadPoolExecutor(max_workers=100) as executor:
          futures = [
              executor.submit(retrieve_memories, f"user_{i}")
              for i in range(100)
          ]

          # 等待所有请求完成
          results = [f.result() for f in futures]

      # 验证延迟
      assert all(r["latency"] < 500 for r in results)  # P99 < 500ms
  ```

- [ ] **压力测试**
  ```python
  def test_stress():
      # 持续 1 分钟，每秒 1000 请求
      duration = 60
      rps = 1000

      start_time = time.time()
      request_count = 0
      error_count = 0

      while time.time() - start_time < duration:
          try:
              retrieve_memories(f"user_{request_count % 100}")
              request_count += 1
          except Exception:
              error_count += 1

          time.sleep(1 / rps)

      # 错误率 < 1%
      assert error_count / request_count < 0.01
  ```

## 📋 部署前检查清单

### ✅ 安全性

- [ ] PII 脱敏机制已实现
- [ ] 数据隔离已验证
- [ ] Memory 防投毒已实现
- [ ] 访问控制已测试
- [ ] 合规要求已满足（GDPR/CCPA/PIPL）

### ✅ 性能

- [ ] 异步 Memory 生成已实现
- [ ] 缓存策略已配置
- [ ] 数据库索引已创建
- [ ] Token 优化已实现
- [ ] 延迟目标已验证（P50/P95/P99）

### ✅ 可扩展性

- [ ] 无状态服务架构
- [ ] 水平扩展已测试
- [ ] 数据清理策略已实现
- [ ] 容量规划已完成
- [ ] 监控和告警已配置

### ✅ 测试

- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试已通过
- [ ] 负载测试已通过
- [ ] 压力测试已通过

### ✅ 运维

- [ ] 日志记录已配置
- [ ] 监控指标已暴露
- [ ] 告警规则已设置
- [ ] 备份策略已实现
- [ ] 回滚计划已准备

## 🔗 延伸阅读

- **[Sessions 详细指南](./sessions-guide.md)** - Session 管理最佳实践
- **[Memory 详细指南](./memory-guide.md)** - Memory 系统设计
- **[主 Skill 文档](./skill.md)** - Context Engineering 核心概念

---

**关键要点**：
- 安全优先：PII、数据隔离、防投毒
- 性能目标：P50 <100ms、P95 <200ms、P99 <500ms
- 可扩展：无状态、水平扩展、数据分片
- 监控告警：关键指标、告警规则、日志记录
- 充分测试：单元、集成、负载、压力测试

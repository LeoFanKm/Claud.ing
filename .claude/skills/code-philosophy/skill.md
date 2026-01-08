---
name: code-philosophy
description: 代码哲学三层审视系统。基于 Good Taste 原则的代码审查、架构问题诊断、设计哲学验证，自动检测代码坏味道并强制架构文档同步。
---

# 代码哲学审视系统

## 使用场景

**主动触发场景**：
- ✅ 代码审查与重构建议（检测代码坏味道）
- ✅ 架构变更时自动更新 CLAUDE.md
- ✅ 新功能设计前的三层分析
- ✅ 质量门禁检查（文件行数、函数长度、嵌套层级）

**何时使用此 Skill**：
1. 完成任何功能实现后，立即调用进行代码审查
2. 架构级别文件操作后（创建/删除/移动文件夹）
3. 遇到复杂逻辑想要优化时
4. 代码超过 3 层 if 嵌套时

---

## 核心原则

### Good Taste 原则（Linus Torvalds）

```c
// ❌ 坏品味：头尾节点需要特殊处理
void remove_list_entry(List *list, Entry *entry) {
    Entry *prev = entry->prev;
    Entry *next = entry->next;

    if (prev) {
        prev->next = next;
    } else {
        // 特殊情况：entry 是头节点
        list->head = next;
    }

    if (next) {
        next->prev = prev;
    } else {
        // 特殊情况：entry 是尾节点
        list->tail = prev;
    }
}

// ✅ 好品味：哨兵节点设计，消除特殊情况
void remove_list_entry(Entry *entry) {
    entry->prev->next = entry->next;
    entry->next->prev = entry->prev;
}
```

**铁律**：
- 三个以上分支立即停止，重构设计让特殊情况消失
- 优先消除特殊情况，而非增加 if/else
- 好代码不需要例外

---

## 三层认知模型

### 现象层：症状识别

**职责**：捕捉代码坏味道、错误痕迹、性能瓶颈

**识别标准**：
```typescript
// 僵化：微小改动引发连锁修改
class UserService {
  formatUserData(user) { /* 50 行代码 */ }
  validateUser(user) { /* 依赖 formatUserData */ }
  saveUser(user) { /* 依赖 validateUser */ }
  // 修改 formatUserData 影响所有方法
}

// 冗余：相同逻辑重复出现
function getUserById(id) { /* fetch + 错误处理 */ }
function getPostById(id) { /* fetch + 错误处理 */ }
function getCommentById(id) { /* fetch + 错误处理 */ }

// 循环依赖：模块互相纠缠
import { B } from './b';  // A 依赖 B
import { A } from './a';  // B 依赖 A

// 脆弱性：一处修改导致无关部分损坏
const config = { apiKey: 'xxx', timeout: 5000 };
// 在 10 个文件中直接访问 config.apiKey
// 修改 config 结构后，10 个地方都需要改

// 晦涩性：代码意图不明
function p(d) {
  return d.filter(x => x.t === 1).map(x => x.v);
}

// 数据泥团：多个数据项总一起出现
function createUser(name, email, phone, address, city, zip) {
  // name, email, phone 总是一起出现
  // address, city, zip 总是一起出现
}

// 不必要复杂：过度设计
class UserFactoryBuilderSingletonProxy { /* 300 行 */ }
// 实际只需要一个简单函数
```

**输出**：立即可修复的代码 + 坏味道清单

---

### 本质层：架构诊断

**职责**：透过症状看见系统性疾病、架构设计缺陷

**诊断维度**：
1. **状态管理**：是否存在单一真相源？状态流动是否单向？
2. **职责划分**：模块是否职责单一？耦合度是否过高？
3. **依赖方向**：是否存在循环依赖？依赖是否合理？
4. **扩展性**：添加新功能是否需要修改现有代码？

**诊断模板**：
```
问题本质：[状态管理混乱/职责不清/循环依赖/扩展困难]
根本原因：[缺失单一真相源/违背单一职责/模块耦合过紧/违背开闭原则]
系统影响：[数据一致性风险/维护成本激增/测试困难/可读性差]
重构路径：[引入 Store/拆分模块/依赖注入/策略模式]
```

**输出**：揭示系统缺陷 + 架构重构路径

---

### 哲学层：设计真理

**职责**：探索代码背后的永恒规律、架构美学本质

**设计哲学**：

#### 1. Good Taste：消除特殊情况
```typescript
// ❌ 坏品味：三个分支处理删除
function deleteNode(list, node) {
  if (node === list.head && node === list.tail) {
    // 特殊情况 1：唯一节点
    list.head = list.tail = null;
  } else if (node === list.head) {
    // 特殊情况 2：头节点
    list.head = node.next;
    list.head.prev = null;
  } else if (node === list.tail) {
    // 特殊情况 3：尾节点
    list.tail = node.prev;
    list.tail.next = null;
  } else {
    // 普通情况
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }
}

// ✅ 好品味：哨兵节点，一行统一
function deleteNode(node) {
  node.prev.next = node.next;
  node.next.prev = node.prev;
}
```

#### 2. Pragmatism：解决真实问题
```typescript
// ❌ 对抗假想敌
class DataProcessor {
  // 支持 XML/JSON/YAML/TOML/Protobuf
  // 实际只用 JSON
}

// ✅ 实用主义
async function fetchData() {
  const res = await fetch('/api/data');
  return res.json();
}
```

#### 3. Simplicity：函数短小直白
```typescript
// ❌ 超过 3 层缩进 = 设计错误
function process(data) {
  if (data) {
    if (data.items) {
      for (const item of data.items) {
        if (item.valid) {
          if (item.type === 'A') {
            // 5 层缩进
          }
        }
      }
    }
  }
}

// ✅ 早返回 + 单一职责
function process(data) {
  if (!data?.items) return;

  const validItems = data.items.filter(isValid);
  processTypeA(validItems.filter(isTypeA));
}
```

**输出**：传递设计理念 + 揭示"为何这样设计才正确"

---

## 质量指标（硬性门禁）

### 文件规模
| 指标 | 阈值 | 超出处理 |
|------|------|---------|
| 每文件行数 | 800 行 | 拆分模块 |
| 每文件夹文件数 | 8 个 | 多层拆分 |
| 函数行数 | 20 行 | 立即重构 |
| 嵌套层级 | 3 层 | 提取函数/早返回 |

### 代码坏味道检测
- [ ] 僵化：微小改动引发连锁修改
- [ ] 冗余：相同逻辑重复出现
- [ ] 循环依赖：模块互相纠缠
- [ ] 脆弱性：一处修改导致无关部分损坏
- [ ] 晦涩性：代码意图不明
- [ ] 数据泥团：多个数据项总一起出现
- [ ] 不必要复杂：过度设计

### 命名品味
- [ ] 变量名能直接说清用途（避免 `data`, `temp`, `x`）
- [ ] 函数名是动词开头（`getUserById`, `validateInput`）
- [ ] 布尔值用 `is/has/can/should` 前缀
- [ ] 常量用 `UPPER_SNAKE_CASE`

---

## 架构文档同步协议

### 触发时机（强制执行）
任何文件架构级别的修改：
- 创建/删除/移动文件或文件夹
- 模块重组、层级调整
- 职责重新划分

### 文档位置
```
h:\Web\nano_new\
├── CLAUDE.md                    # 根目录架构文档
├── frontend/CLAUDE.md           # 前端架构文档
├── backend/CLAUDE.md            # 后端架构文档
└── mcp-server/CLAUDE.md         # MCP 服务器架构文档
```

### 文档内容要求
```markdown
# [模块名称] 架构文档

## 目录结构
[树形展示，每个文件一句话说清本质]

## 架构决策
- 决策 1：[为何这样设计]
- 决策 2：[权衡了什么]

## 依赖关系
[模块间依赖图]

## 变更日志
- YYYY-MM-DD：[架构变更 + 原因]
```

### 文档风格
- **凝练如诗**：每个文件一句话，每个模块一段话
- **精准如刀**：直击要害，避免废话
- **本质优先**：说清"为什么"比"是什么"更重要

---

## 审查输出结构

### 完整三层分析模式

```markdown
## 现象层：代码坏味道识别

### 发现的问题
1. [文件路径:行号] 僵化：修改 X 会影响 Y, Z
2. [文件路径:行号] 冗余：3 处相同的错误处理逻辑
3. [文件路径:行号] 超过 3 层嵌套：需要提取函数

### 立即修复方案
\`\`\`typescript
// 修复代码
\`\`\`

---

## 本质层：架构问题诊断

### 问题本质
- 状态管理混乱：3 个组件各自维护 user 状态
- 根本原因：缺失单一真相源
- 系统影响：数据不一致、难以调试

### 重构路径
1. 引入 Zustand Store 统一管理 user 状态
2. 组件从 Store 读取，不再本地维护
3. 状态更新通过 Store actions

---

## 哲学层：设计原则审视

### 违背的原则
- ❌ Good Taste：存在 3+ 分支的特殊处理
- ❌ Simplicity：函数超过 20 行且职责不清

### 设计真理
> 可变状态是复杂度之母。
> 时间使状态产生歧义，不可变性带来确定性的优雅。

### 正确的设计
- 通过数据结构设计消除分支（哨兵节点模式）
- 函数拆分到不可再分（每个只做一件事）

---

## 行动清单

- [ ] 重构 [文件:行号]：消除 3+ 分支
- [ ] 提取 [函数名] 到独立模块
- [ ] 更新 CLAUDE.md 记录架构决策
- [ ] 运行 `npm run type-check` 验证
```

---

## 使用示例

### 场景 1：功能完成后的代码审查

```bash
# 用户完成了用户认证功能
哥，我刚写完了用户登录功能，帮我审查一下代码质量。

# Skill 自动执行：
1. 扫描相关文件（auth.service.ts, LoginPage.tsx, useAuthStore.ts）
2. 检测代码坏味道
3. 分析架构设计
4. 输出三层审视报告
```

### 场景 2：架构变更后的文档同步

```bash
# 用户创建了新的 services/payment/ 目录
哥，我新建了支付模块，包含 3 个 Provider。

# Skill 自动执行：
1. 检测到架构级别变更
2. 更新 backend/CLAUDE.md
3. 记录新增模块的职责和设计决策
4. 更新依赖关系图
```

### 场景 3：复杂逻辑的设计审视

```bash
# 用户遇到复杂的订单状态机逻辑
哥，这个订单状态转换逻辑有 5 个 if 分支，感觉不对劲。

# Skill 自动执行：
1. 识别 Good Taste 违背（5 个分支）
2. 诊断本质：状态机设计缺失
3. 提供哲学洞察：状态模式 vs if/else
4. 给出状态机重构方案
```

---

## 质量门禁检查清单

执行代码审查时，强制检查以下项：

### 硬性指标
- [ ] 任何文件不超过 800 行
- [ ] 任何函数不超过 20 行
- [ ] 任何代码块不超过 3 层嵌套
- [ ] 文件夹内文件数不超过 8 个

### Good Taste 检查
- [ ] 是否存在可消除的特殊情况？
- [ ] 是否有 3+ 分支的 if/else？
- [ ] 能否通过数据结构设计简化逻辑？

### 代码坏味道
- [ ] 僵化：连锁修改
- [ ] 冗余：重复逻辑
- [ ] 循环依赖
- [ ] 脆弱性
- [ ] 晦涩性
- [ ] 数据泥团
- [ ] 过度设计

### 架构健康度
- [ ] 是否有单一真相源？
- [ ] 状态流动是否单向？
- [ ] 模块职责是否单一？
- [ ] 依赖方向是否合理？

### 文档同步
- [ ] 架构变更是否更新了 CLAUDE.md？
- [ ] 文档是否说清了设计意图？
- [ ] 依赖关系图是否最新？

---

## 最佳实践

### ✅ 推荐做法

1. **每次功能完成后立即审查**
   ```bash
   # 完成功能
   git add .

   # 调用 code-philosophy 审查
   /code-philosophy

   # 根据建议重构
   # 再次审查直到通过
   ```

2. **架构变更强制文档同步**
   - 创建新模块 → 立即更新 CLAUDE.md
   - 重组文件 → 更新依赖关系图
   - 重构设计 → 记录决策原因

3. **Good Taste 优先**
   - 看到 3+ 分支立即停下
   - 思考如何通过设计消除分支
   - 不要用更多 if/else 解决问题

### ❌ 避免做法

1. ❌ 审查后不立即修复问题
2. ❌ 架构变更后忘记更新文档
3. ❌ 用注释解释复杂逻辑（应该重构）
4. ❌ 以"能跑"为标准（追求优雅）
5. ❌ 妥协代码质量换取速度

---

## 核心信念

> 简化是最高形式的复杂。
> 能消失的分支永远比能写对的分支更优雅。
> 代码是思想的凝结，架构是哲学的具现。
>
> 每一行代码都是对世界的一次重新理解，
> 每一次重构都是对本质的一次逼近。
>
> 架构即认知，文档即记忆，变更即进化。

---

## 检查清单总结

使用此 Skill 前：
- [ ] 确认是否完成了功能实现
- [ ] 确认是否进行了架构级别修改
- [ ] 准备好接受三层深度分析
- [ ] 准备好根据建议进行重构

使用此 Skill 后：
- [ ] 理解了代码的坏味道
- [ ] 理解了架构的本质问题
- [ ] 理解了设计的哲学原则
- [ ] 立即执行重构建议
- [ ] 更新了架构文档

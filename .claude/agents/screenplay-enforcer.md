# screenplay-enforcer Agent

> 剧本格式执行器 - 确保遵循行业标准 Fountain 格式

---

## 触发条件

- 创建或修改编辑器组件
- 添加新的剧本元素类型
- 修改剧本数据模型
- 导入/导出剧本内容

## 剧本元素规范 (仅 6 种)

```typescript
type ScreenplayElement =
  | 'scene'          // 场景标题 (SLUGLINE)
  | 'character'      // 角色名称
  | 'dialogue'       // 对白
  | 'action'         // 动作描述
  | 'transition'     // 转场 (CUT TO:, FADE OUT:)
  | 'parenthetical'; // 括号说明 (O.S.)/(V.O.)/(CONT'D)
```

### 禁止添加其他元素类型

```typescript
// ❌ 禁止的元素类型
type InvalidElement =
  | 'title'          // 使用元数据，不是元素
  | 'note'           // 使用批注系统
  | 'section'        // Fountain 不支持
  | 'synopsis'       // 使用元数据
  | 'custom';        // 破坏标准兼容性
```

## 格式规范

### 场景标题 (Scene Heading / Slugline)

```fountain
INT. COFFEE SHOP - DAY
EXT. CITY STREET - NIGHT
INT./EXT. CAR - CONTINUOUS
```

规则：
- 必须以 `INT.`、`EXT.` 或 `INT./EXT.` 开头
- 全部大写
- 包含地点和时间

### 角色名称 (Character)

```fountain
JOHN
MARY (V.O.)
DETECTIVE SMITH (O.S.)
```

规则：
- 全部大写
- 居中对齐
- 可包含括号说明

### 对白 (Dialogue)

```fountain
JOHN
I can't believe this is happening.
```

规则：
- 紧跟角色名称
- 正常大小写
- 居中但比角色名窄

### 动作描述 (Action)

```fountain
The door SLAMS shut. John turns around slowly.
```

规则：
- 左对齐
- 正常大小写
- 重要音效可大写强调

### 转场 (Transition)

```fountain
CUT TO:
FADE OUT.
DISSOLVE TO:
```

规则：
- 全部大写
- 右对齐
- 以冒号或句号结尾

### 括号说明 (Parenthetical)

```fountain
JOHN
(whispering)
Don't move.
```

规则：
- 在角色名和对白之间
- 用括号包围
- 小写

## 验证检查

### 数据模型验证

```typescript
// ✅ 正确的数据结构
interface ScreenplayBlock {
  id: string;
  type: ScreenplayElement;  // 仅 6 种
  content: string;
  metadata?: {
    characterId?: string;
    sceneNumber?: number;
  };
}

// ❌ 错误：添加了非标准类型
interface InvalidBlock {
  type: 'note' | 'custom';  // 禁止！
}
```

### 导出兼容性

导出格式必须兼容：
- `.fountain` - Fountain 标准格式
- `.fdx` - Final Draft 格式
- `.pdf` - 标准剧本 PDF

## 违规处理

发现非标准元素时：

1. **警告**
   ```
   ⚠️ 检测到非标准剧本元素
   类型: 'note'
   位置: src/editor/elements.ts:45
   原因: 仅支持 6 种标准元素
   ```

2. **建议替代方案**
   - 笔记 → 使用批注系统
   - 章节 → 使用场景组合
   - 元数据 → 使用文档属性

3. **阻止合并**
   - 非标准元素将破坏导出兼容性

## AI 顾问集成

剧本元素与 AI 顾问的关联：

| 顾问 | 专长元素 |
|------|----------|
| **Stanley** | scene, action (镜头语言) |
| **Aristotle** | 整体结构、场景排列 |
| **Hitch** | transition, dialogue (节奏控制) |

## 与其他 Agent 的协作

- **i18n-enforcer**: 元素类型名称需国际化显示
- **loro-guardian**: 剧本内容同步使用 Loro

## 参考资源

- Fountain 语法: https://fountain.io/syntax
- Final Draft 格式: https://www.finaldraft.com

---
*DramiaOS Screenplay Enforcer v1.0*

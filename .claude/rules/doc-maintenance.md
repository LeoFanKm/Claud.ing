# Fractal-Docs 文档维护规则

> 此规则确保代码与文档同步更新，是 fractal-docs 系统的核心组件

## 触发条件

当以下情况发生时，自动应用此规则：
- 创建新文件
- 修改现有文件
- 删除文件
- 重构目录结构

## 核心原则

```
📖 读取先行：修改代码前必须先读取现有文档
🔄 同步更新：代码变更必须伴随文档更新
⬆️ 向上传播：子目录变更需通知父目录
```

## 执行流程

### Phase 1: 修改前（必须）

```typescript
// 伪代码：修改任何文件前的检查清单
async function beforeModify(filePath: string) {
  // 1. 读取文件头注释
  const header = await readFileHeader(filePath);

  // 2. 读取目录 README
  const readme = await readDirectoryReadme(path.dirname(filePath));

  // 3. 理解上下文
  understand(header, readme);
}
```

### Phase 2: 修改时

- 更新文件头注释（如功能变化）
- 保持 @input/@output/@position 标注准确
- 遵循项目命名规范

### Phase 3: 修改后

1. **检查目录 README 是否需要更新**
   - 新增文件 → 添加到文件索引表
   - 删除文件 → 从索引表移除
   - 重命名 → 更新索引表

2. **向上传播变更**
   ```
   文件变更 → 目录 README → 父目录 README → 根 README/CLAUDE.md
   ```

3. **架构变更通知**
   - 新模块 → 更新 CLAUDE.md
   - 技术栈变化 → 更新 CLAUDE.md
   - 重大重构 → 更新所有相关文档

## 标准文件头格式

```typescript
/**
 * @file filename.ts
 * @description 一句话描述文件功能
 *
 * @input 输入参数或依赖说明
 * @output 返回值或副作用说明
 * @position 在项目架构中的位置（如：components/editor）
 *
 * @lastModified 2024-12-24
 */
```

## 目录 README 必含内容

1. **标题和描述** - 一行概述
2. **目录架构图** - ASCII 树形结构
3. **核心职责** - 功能定位
4. **文件索引表** - 表格形式
5. **注意事项** - 使用说明
6. **更新时间戳** - 底部标注

## 排除规则

以下内容无需维护文档：
```
node_modules/
.git/
dist/
build/
*.log
.DS_Store
package-lock.json
```

## 自动化检查点

在以下时机自动检查文档完整性：
- [ ] 每次 `git commit` 前
- [ ] 每次 PR 创建时
- [ ] 每周一次全量检查

## 与 CLAUDE.md 的关系

```
CLAUDE.md（项目指令）
├── 引用 → @.claude/rules/doc-maintenance.md（本规则）
├── 引用 → @.claude/fractal-docs/config.json（配置）
└── 引用 → 各目录 README.md（索引）
```

## 违规处理

如果发现文档与代码不同步：
1. 停止当前操作
2. 先更新文档
3. 再继续代码修改
4. 提交时包含文档更新

---
*Fractal-Docs v1.0 | DramiaOS 项目专用*

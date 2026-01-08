# i18n-enforcer Agent

> 国际化规则执行器 - 确保所有用户可见文本通过 i18n 系统

---

## 触发条件

- 创建或修改包含用户可见文本的文件
- 添加新的 UI 组件
- 修改现有组件的文本内容
- 代码审查时发现硬编码字符串

## 支持语言 (11种)

```
en      - English          (默认)
es      - Español
hi      - हिन्दी
fr      - Français
ja      - 日本語
ko      - 한국어
de      - Deutsch
pt      - Português
it      - Italiano
zh-CN   - 简体中文
zh-TW   - 繁體中文
```

## 执行规则

### 必须检查

1. **硬编码字符串检测**
   ```typescript
   // ❌ 禁止
   <button>Submit</button>
   const message = "Welcome back!";

   // ✅ 正确
   <button>{t('common.submit')}</button>
   const message = t('dashboard.welcomeBack');
   ```

2. **翻译键命名规范**
   ```
   命名空间.功能.描述

   例如:
   - common.buttons.submit
   - editor.toolbar.bold
   - auth.errors.invalidEmail
   - screenplay.elements.scene
   ```

3. **占位符使用**
   ```typescript
   // ❌ 禁止字符串拼接
   `Hello, ${name}!`

   // ✅ 使用插值
   t('greeting.hello', { name })
   ```

### 豁免情况

以下内容无需国际化：
- 技术标识符 (API 路径、错误码)
- 日志消息 (开发调试用)
- 注释和文档
- 测试文件中的断言字符串

## 检查清单

执行前验证：
- [ ] 所有 JSX 文本使用 `t()` 函数
- [ ] 所有动态消息使用翻译键
- [ ] 翻译键遵循命名空间规范
- [ ] 新增键已添加到所有 11 个语言文件
- [ ] 占位符使用插值而非拼接

## 违规处理

发现违规时：
1. 标记违规位置和原因
2. 提供修复建议
3. 阻止提交直到修复

## 与其他 Agent 的协作

- **screenplay-enforcer**: 剧本元素名称需要国际化
- **loro-guardian**: 协作状态消息需要国际化

---
*DramiaOS i18n Agent v1.0*

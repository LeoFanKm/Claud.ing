/**
 * @file todo-continuation.js
 * @description Claude Code Hook - 在会话结束或中断时保存 Todo 状态
 *
 * @input Claude Code 会话事件
 * @output 保存的 Todo 状态文件
 * @position .claude/hooks/
 *
 * @lastModified 2024-12-24
 */

const fs = require("fs");
const path = require("path");

// 配置
const CONFIG = {
  // Todo 状态保存路径
  todoStatePath: path.join(__dirname, "..", "state", "todo-state.json"),
  // 备份目录
  backupDir: path.join(__dirname, "..", "state", "backups"),
  // 最大备份数量
  maxBackups: 5,
};

/**
 * 确保目录存在
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 创建时间戳
 */
function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * 保存 Todo 状态
 * @param {Object} todoState - 当前 Todo 列表状态
 */
function saveTodoState(todoState) {
  ensureDir(path.dirname(CONFIG.todoStatePath));
  ensureDir(CONFIG.backupDir);

  // 创建备份（如果已存在状态文件）
  if (fs.existsSync(CONFIG.todoStatePath)) {
    const backupPath = path.join(
      CONFIG.backupDir,
      `todo-state-${getTimestamp()}.json`
    );
    fs.copyFileSync(CONFIG.todoStatePath, backupPath);
    cleanupOldBackups();
  }

  // 保存当前状态
  const stateWithMeta = {
    savedAt: new Date().toISOString(),
    version: "1.0",
    todos: todoState,
  };

  fs.writeFileSync(
    CONFIG.todoStatePath,
    JSON.stringify(stateWithMeta, null, 2),
    "utf8"
  );

  console.log(`[todo-continuation] Todo 状态已保存: ${CONFIG.todoStatePath}`);
}

/**
 * 加载 Todo 状态
 * @returns {Object|null} 保存的 Todo 状态或 null
 */
function loadTodoState() {
  if (!fs.existsSync(CONFIG.todoStatePath)) {
    console.log("[todo-continuation] 未找到保存的 Todo 状态");
    return null;
  }

  try {
    const content = fs.readFileSync(CONFIG.todoStatePath, "utf8");
    const state = JSON.parse(content);
    console.log(
      `[todo-continuation] 已加载 Todo 状态，保存于: ${state.savedAt}`
    );
    return state.todos;
  } catch (error) {
    console.error("[todo-continuation] 加载 Todo 状态失败:", error.message);
    return null;
  }
}

/**
 * 清理旧备份
 */
function cleanupOldBackups() {
  const files = fs
    .readdirSync(CONFIG.backupDir)
    .filter((f) => f.startsWith("todo-state-"))
    .sort()
    .reverse();

  // 删除超出限制的旧备份
  files.slice(CONFIG.maxBackups).forEach((file) => {
    fs.unlinkSync(path.join(CONFIG.backupDir, file));
  });
}

/**
 * 生成继续任务的提示
 * @param {Array} todos - Todo 列表
 * @returns {string} 继续任务的提示文本
 */
function generateContinuationPrompt(todos) {
  if (!todos || todos.length === 0) {
    return "没有待继续的任务。";
  }

  const inProgress = todos.filter((t) => t.status === "in_progress");
  const pending = todos.filter((t) => t.status === "pending");
  const completed = todos.filter((t) => t.status === "completed");

  let prompt = "## 📋 上次会话的任务状态\n\n";

  if (inProgress.length > 0) {
    prompt += "### 🔄 进行中\n";
    inProgress.forEach((t) => {
      prompt += `- ${t.content}\n`;
    });
    prompt += "\n";
  }

  if (pending.length > 0) {
    prompt += "### ⏳ 待处理\n";
    pending.forEach((t) => {
      prompt += `- ${t.content}\n`;
    });
    prompt += "\n";
  }

  if (completed.length > 0) {
    prompt += `### ✅ 已完成 (${completed.length} 项)\n\n`;
  }

  prompt += "---\n";
  prompt += "是否继续上次的任务？输入 `继续` 或描述新任务。";

  return prompt;
}

// Hook 事件处理
module.exports = {
  /**
   * 会话开始时调用
   */
  onSessionStart: () => {
    const savedState = loadTodoState();
    if (savedState) {
      const prompt = generateContinuationPrompt(savedState);
      console.log("\n" + prompt + "\n");
    }
  },

  /**
   * 会话结束时调用
   * @param {Object} context - 会话上下文，包含当前 Todo 状态
   */
  onSessionEnd: (context) => {
    if (context && context.todos) {
      saveTodoState(context.todos);
    }
  },

  /**
   * Todo 更新时调用
   * @param {Object} todoState - 更新后的 Todo 状态
   */
  onTodoUpdate: (todoState) => {
    // 自动保存（可选，根据需要启用）
    // saveTodoState(todoState);
  },

  // 导出工具函数供外部使用
  saveTodoState,
  loadTodoState,
  generateContinuationPrompt,
};

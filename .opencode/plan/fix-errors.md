# 错误修复计划

## 问题分析
哥，经过深入分析，我发现了三个核心问题：

### 现象层
1. **认证token获取超时** - 3秒超时太短，Clerk初始化慢
2. **配置保存500错误** - 后端写入文件失败  
3. **项目列表API超时** - 数据库查询慢

### 本质层
1. **认证状态与配置加载的耦合** - 认证未准备好时配置无法加载
2. **固定超时策略的僵化** - 3秒不适合所有网络环境
3. **错误处理的脆弱性** - 单点失败导致整个功能不可用

### 哲学层
**状态管理的时序竞争** - 认证与配置加载缺乏优雅的解耦设计

## 修复方案

### 立即修复（5分钟）
1. **增加认证超时时间**
   ```typescript
   // frontend/src/lib/api.ts:181
   const AUTH_TOKEN_TIMEOUT_MS = 8000; // 从3秒增加到8秒
   ```

2. **增强后端错误日志**
   ```rust
   // crates/server/src/routes/config.rs:129
   match save_config_to_file(&new_config, &config_path).await {
       Ok(_) => {
           tracing::info!("Config saved successfully");
           // ... 现有逻辑
       }
       Err(e) => {
           tracing::error!("Config save failed: path={:?}, error={:?}", config_path, e);
           ResponseJson(ApiResponse::error(&format!("Failed to save config: {}", e)))
       }
   }
   ```

### 中期改进（1小时）
1. **实现认证状态解耦**
   ```typescript
   // ConfigProvider.tsx 修改
   const shouldFetchConfig = true; // 不等待Clerk完全加载
   ```

2. **添加自适应超时**
   ```typescript
   const getAuthTimeout = () => {
       const connection = navigator.connection;
       if (connection?.effectiveType === 'slow-2g') return 15000;
       if (connection?.effectiveType === '2g') return 10000;
       return 8000;
   };
   ```

### 长期重构（1天）
1. **实现渐进式加载**
   - 先加载本地默认配置
   - 认证成功后同步远程配置
   - 添加离线模式支持

2. **优化数据库查询**
   - 为projects表添加索引
   - 实现分页查询
   - 添加查询缓存

## 优先级
1. **高优先级** - 增加认证超时时间
2. **中优先级** - 解耦认证与配置加载
3. **低优先级** - 数据库性能优化

## 验证标准
- 认证超时错误减少90%
- 配置保存成功率提升到99%
- 项目列表加载时间<2秒

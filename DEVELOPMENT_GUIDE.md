# 二次开发与部署完整指南

**适用于**: 非程序员 + Claude Code 开发模式
**架构**: Cloudflare Pages (前端) + DigitalOcean $12 Droplet (后端)
**认证**: Clerk | **支付**: Stripe

---

## 目录

1. [准备工作](#一准备工作)
2. [本地开发环境](#二本地开发环境搭建)
3. [二次开发任务](#三二次开发任务清单)
4. [Clerk认证集成](#四clerk认证集成)
5. [Stripe支付集成](#五stripe支付集成)
6. [后端部署到DigitalOcean](#六后端部署到digitalocean)
7. [前端部署到Cloudflare Pages](#七前端部署到cloudflare-pages)
8. [域名配置](#八域名配置)
9. [上线检查清单](#九上线检查清单)

---

## 一、准备工作

### 1.1 需要注册的账号

在开始之前，请先注册以下账号：

| 服务 | 网址 | 用途 | 费用 |
|------|------|------|------|
| GitHub | github.com | 代码托管 | 免费 |
| DigitalOcean | digitalocean.com | 后端服务器 | $12/月 |
| Cloudflare | cloudflare.com | 前端托管+CDN | 免费 |
| Clerk | clerk.com | 用户认证 | 免费(5000用户内) |
| Stripe | stripe.com | 支付处理 | 按交易收费 |

### 1.2 需要准备的信息

```
□ 产品名称：________________（例如：DevFlow）
□ 域名：________________（例如：devflow.io）
□ 品牌颜色：________________（例如：#6366f1）
□ Logo文件：________________（PNG/SVG格式）
```

### 1.3 定价方案设计

```
免费版 (Free)
├── 功能：基础任务管理
├── 限制：3个项目，1个AI代理
└── 价格：$0

专业版 (Pro)
├── 功能：完整功能
├── 限制：无限项目，所有AI代理
└── 价格：$15/月 或 $150/年

团队版 (Team)
├── 功能：专业版 + 团队协作
├── 限制：最多10人
└── 价格：$49/月
```

---

## 二、本地开发环境搭建

### 2.1 安装必要软件

在你的电脑上（Mac/Windows/Linux），需要安装：

**Mac 用户在终端执行：**
```bash
# 安装 Homebrew（如果没有）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装 Node.js
brew install node

# 安装 pnpm
npm install -g pnpm

# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Git
brew install git
```

**Windows 用户：**
```
1. 下载安装 Node.js: https://nodejs.org/ (选LTS版本)
2. 下载安装 Rust: https://rustup.rs/
3. 下载安装 Git: https://git-scm.com/download/win
4. 打开 PowerShell，运行: npm install -g pnpm
```

### 2.2 验证安装

打开终端/命令行，运行以下命令确认安装成功：

```bash
node --version    # 应显示 v18.x.x 或更高
pnpm --version    # 应显示 8.x.x 或更高
rustc --version   # 应显示 rustc 1.x.x
git --version     # 应显示 git version 2.x.x
```

### 2.3 克隆项目到本地

```bash
# 创建工作目录
mkdir ~/projects
cd ~/projects

# 克隆你fork的项目（替换为你的GitHub用户名）
git clone https://github.com/你的用户名/MoeCode-Kanban.git

# 进入项目目录
cd MoeCode-Kanban

# 安装依赖
pnpm install
```

### 2.4 启动本地开发环境

```bash
# 启动开发服务器（前端+后端同时启动）
pnpm run dev
```

打开浏览器访问 `http://localhost:3000`，应该能看到应用界面。

---

## 三、二次开发任务清单

### 3.1 品牌定制（第1周）

让 Claude Code 帮你完成以下任务：

**任务1：修改应用名称和Logo**
```
提示词：
"帮我把这个项目的名称从 Vibe Kanban 改成 [你的产品名]，
包括：
1. 页面标题
2. Logo显示
3. 页脚版权信息
我的Logo文件在 [路径]"
```

**任务2：修改品牌颜色**
```
提示词：
"帮我把主题色从当前颜色改成 [你的颜色代码]，
需要修改 Tailwind 配置和所有相关组件"
```

**任务3：修改首页内容**
```
提示词：
"帮我修改首页的标题、描述和功能介绍，
新的内容是：
- 标题：[你的标题]
- 副标题：[你的副标题]
- 功能点：[列出3-5个功能点]"
```

### 3.2 移除原有分析代码（第1周）

**任务4：移除PostHog分析**
```
提示词：
"帮我移除项目中所有的 PostHog 分析代码，
我之后会用自己的分析工具"
```

### 3.3 安全修复（第1周）

**任务5：修复CORS配置**
```
提示词：
"帮我修复 crates/remote/src/routes/mod.rs 中的CORS配置，
只允许来自 [你的域名] 的请求"
```

### 3.4 功能调整（第2-3周）

根据你的产品定位，可能需要：

**任务6：简化功能（如果需要）**
```
提示词：
"帮我移除 [功能名称] 功能，我的MVP不需要它"
```

**任务7：添加定价页面**
```
提示词：
"帮我创建一个定价页面，包含三个套餐：
- Free: 免费，基础功能
- Pro: $15/月，完整功能
- Team: $49/月，团队协作
页面风格参考 [某网站] 的定价页"
```

---

## 四、Clerk认证集成

### 4.1 创建Clerk应用

1. 登录 https://dashboard.clerk.com
2. 点击 "Add application"
3. 输入应用名称
4. 选择登录方式（推荐：Email + Google + GitHub）
5. 创建完成后，获取以下密钥：

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
```

### 4.2 集成到前端

让 Claude Code 执行：

```
提示词：
"帮我集成Clerk认证到这个React项目，需要：
1. 安装 @clerk/clerk-react
2. 在 App.tsx 中添加 ClerkProvider
3. 创建登录/注册页面
4. 保护需要登录的路由
5. 显示用户头像和登出按钮

我的Clerk密钥是：
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
"
```

### 4.3 集成到后端

```
提示词：
"帮我在Rust后端验证Clerk的JWT token，需要：
1. 添加验证中间件
2. 从请求头获取token
3. 验证token有效性
4. 提取用户ID

Clerk的JWT公钥可以从这里获取：https://api.clerk.com/v1/jwks"
```

### 4.4 创建环境变量文件

在项目根目录创建 `.env` 文件：

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx

# 其他配置
VITE_API_URL=http://localhost:8080
```

---

## 五、Stripe支付集成

### 5.1 创建Stripe账号和产品

1. 登录 https://dashboard.stripe.com
2. 进入 "Products" 创建产品：
   - Pro Plan: $15/月
   - Team Plan: $49/月
3. 获取密钥（先用测试密钥）：

```
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

### 5.2 集成到前端

```
提示词：
"帮我集成Stripe支付到React项目，需要：
1. 安装 @stripe/stripe-js 和 @stripe/react-stripe-js
2. 创建结账按钮组件
3. 跳转到Stripe Checkout页面
4. 处理支付成功/失败回调

我的Stripe测试密钥是：
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx

产品Price ID：
- Pro: price_xxxxx
- Team: price_xxxxx
"
```

### 5.3 集成到后端

```
提示词：
"帮我在Rust后端添加Stripe webhook处理，需要：
1. 创建 /api/stripe/webhook 端点
2. 验证webhook签名
3. 处理 checkout.session.completed 事件
4. 更新用户的订阅状态到数据库

我的STRIPE_WEBHOOK_SECRET是：whsec_xxxxx
"
```

### 5.4 数据库添加订阅表

```
提示词：
"帮我在数据库中添加用户订阅相关的表，需要：
1. subscriptions 表（用户ID、套餐类型、状态、过期时间）
2. 相关的Rust模型和迁移文件
3. 查询用户当前订阅状态的API"
```

---

## 六、后端部署到DigitalOcean

### 6.1 创建Droplet

1. 登录 DigitalOcean 控制台
2. 点击 "Create" → "Droplets"
3. 选择配置：
   ```
   Region: Singapore (sgp1)
   Image: Ubuntu 24.04 LTS
   Size: Basic - $12/mo (1 vCPU, 2GB RAM)
   Authentication: SSH Key（推荐）或 Password
   Hostname: 你的产品名-api
   ```
4. 点击 "Create Droplet"
5. 记录服务器IP地址：`xxx.xxx.xxx.xxx`

### 6.2 连接到服务器

```bash
# Mac/Linux 终端
ssh root@xxx.xxx.xxx.xxx

# Windows 使用 PowerShell 或安装 PuTTY
ssh root@xxx.xxx.xxx.xxx
```

### 6.3 服务器初始化

连接到服务器后，执行以下命令：

```bash
# 更新系统
apt update && apt upgrade -y

# 安装必要软件
apt install -y build-essential pkg-config libssl-dev curl git nginx certbot python3-certbot-nginx

# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env

# 创建应用用户（更安全）
useradd -m -s /bin/bash app
```

### 6.4 添加Swap空间（重要！$12配置必须）

```bash
# 创建2GB swap文件
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# 永久生效
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

# 优化swap使用
echo 'vm.swappiness=10' | tee -a /etc/sysctl.conf
sysctl -p
```

### 6.5 部署后端代码

```bash
# 切换到app用户
su - app

# 克隆代码
git clone https://github.com/你的用户名/MoeCode-Kanban.git
cd MoeCode-Kanban

# 创建环境变量文件
cat > .env << 'EOF'
# Server
HOST=127.0.0.1
PORT=8080

# Clerk
CLERK_SECRET_KEY=sk_live_xxxxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Database
DATABASE_URL=sqlite:./data/db.sqlite
EOF

# 编译发布版本（需要10-20分钟）
cargo build --release --bin server

# 创建数据目录
mkdir -p data
```

### 6.6 创建系统服务

```bash
# 回到root用户
exit

# 创建 systemd 服务文件
cat > /etc/systemd/system/myapp.service << 'EOF'
[Unit]
Description=My App Backend
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/home/app/MoeCode-Kanban
ExecStart=/home/app/MoeCode-Kanban/target/release/server
Restart=always
RestartSec=5
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
systemctl daemon-reload
systemctl enable myapp
systemctl start myapp

# 检查状态
systemctl status myapp
```

### 6.7 配置Nginx反向代理

```bash
# 创建Nginx配置
cat > /etc/nginx/sites-available/myapp << 'EOF'
server {
    listen 80;
    server_name api.你的域名.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 启用配置
ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 6.8 配置SSL证书

```bash
# 确保域名已指向服务器IP后执行
certbot --nginx -d api.你的域名.com
```

---

## 七、前端部署到Cloudflare Pages

### 7.1 修改前端API地址

让 Claude Code 执行：

```
提示词：
"帮我修改前端的API地址配置，
开发环境使用 http://localhost:8080
生产环境使用 https://api.我的域名.com
"
```

### 7.2 构建前端

```bash
# 在本地项目目录
cd frontend
pnpm run build
```

### 7.3 部署到Cloudflare Pages

**方法A：通过Git自动部署（推荐）**

1. 登录 Cloudflare Dashboard
2. 进入 "Workers & Pages"
3. 点击 "Create" → "Pages" → "Connect to Git"
4. 选择你的GitHub仓库
5. 配置构建设置：
   ```
   Framework preset: None
   Build command: cd frontend && pnpm install && pnpm run build
   Build output directory: frontend/dist
   Root directory: /
   ```
6. 添加环境变量：
   ```
   VITE_API_URL=https://api.你的域名.com
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
   ```
7. 点击 "Save and Deploy"

**方法B：手动上传**

1. 在 Cloudflare Pages 点击 "Upload assets"
2. 将 `frontend/dist` 文件夹拖入上传

### 7.4 配置自定义域名

1. 在 Pages 项目设置中点击 "Custom domains"
2. 添加你的域名（如 `app.你的域名.com`）
3. 按提示配置DNS记录

---

## 八、域名配置

### 8.1 DNS记录设置

在你的域名DNS设置中添加：

| 类型 | 名称 | 值 | 说明 |
|------|------|-----|------|
| A | api | xxx.xxx.xxx.xxx | DigitalOcean服务器IP |
| CNAME | app | xxx.pages.dev | Cloudflare Pages地址 |
| CNAME | www | app.你的域名.com | 重定向到app |

### 8.2 Clerk配置域名

1. 在 Clerk Dashboard 中进入 "Domains"
2. 添加你的生产域名
3. 配置允许的回调URL

### 8.3 Stripe配置Webhook

1. 在 Stripe Dashboard 进入 "Webhooks"
2. 添加端点：`https://api.你的域名.com/api/stripe/webhook`
3. 选择要监听的事件：
   - checkout.session.completed
   - customer.subscription.updated
   - customer.subscription.deleted

---

## 九、上线检查清单

### 9.1 功能测试

```
□ 首页正常显示
□ 用户注册流程正常
□ 用户登录流程正常
□ Google/GitHub登录正常
□ 创建项目正常
□ 创建任务正常
□ AI代理执行正常
□ 支付流程正常（测试模式）
□ 订阅状态显示正确
```

### 9.2 安全检查

```
□ HTTPS已启用（前端和后端）
□ CORS只允许自己的域名
□ 环境变量未暴露在前端代码中
□ 敏感API需要认证
□ Stripe webhook签名验证正常
```

### 9.3 性能检查

```
□ 页面加载时间 < 3秒
□ API响应时间 < 500ms
□ 服务器内存使用 < 1.5GB
□ Swap使用正常
```

### 9.4 监控设置

```
□ DigitalOcean监控已开启
□ 设置服务器告警（CPU > 80%, 内存 > 90%）
□ Cloudflare Analytics已开启
□ 错误日志可以查看
```

### 9.5 上线前最后步骤

```
1. □ 将Stripe从测试模式切换到生产模式
2. □ 更新所有环境变量为生产密钥
3. □ 通知几个测试用户帮忙验证
4. □ 准备好客服邮箱
5. □ 准备好隐私政策和服务条款页面
```

---

## 常见问题解决

### Q: 编译Rust时内存不足怎么办？

```bash
# 确保swap已配置
free -h

# 如果编译仍然失败，尝试限制并行编译
CARGO_BUILD_JOBS=1 cargo build --release
```

### Q: 服务启动失败怎么查看日志？

```bash
# 查看服务日志
journalctl -u myapp -f

# 查看最近100行
journalctl -u myapp -n 100
```

### Q: 如何更新代码？

```bash
# SSH到服务器
ssh root@xxx.xxx.xxx.xxx

# 切换到app用户
su - app
cd MoeCode-Kanban

# 拉取最新代码
git pull

# 重新编译
cargo build --release --bin server

# 退出app用户，重启服务
exit
systemctl restart myapp
```

### Q: 如何查看服务器资源使用？

```bash
# 查看内存
free -h

# 查看CPU和进程
htop

# 查看磁盘
df -h
```

---

## 联系与支持

开发过程中遇到问题，可以：

1. 让 Claude Code 帮你诊断和解决
2. 搜索错误信息
3. 查看项目的GitHub Issues

---

*文档版本: 1.0 | 更新日期: 2025-12-31*

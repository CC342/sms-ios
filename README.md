这是一份为你定制的 `README.md`，已经包含了我们刚才讨论的所有功能点（纯文本消息、KV 去重、日志存储、时区修正）。

你可以直接复制下面的内容，保存为 `README.md` 文件放在你的 GitHub 仓库里。

---

# 📨 iOS SMS Forwarder to WeChat (Cloudflare Worker)

这是一个部署在 **Cloudflare Workers** 上的轻量级脚本，配合 iOS 快捷指令自动化，实现将 iPhone 收到的短信（特别是验证码）毫秒级转发到 **企业微信（WeCom）**。

> **特别优化**：本项目使用企业微信的 `text`（纯文本）消息接口。相比 `Markdown` 或 `TextCard` 消息，纯文本模式在**普通微信（非企业微信APP）**中也能完美显示，且无点击跳转，防止误触，体验更佳。

## ✨ 功能特性

* **☁️ Serverless 部署**：完全依托 Cloudflare Workers，免费版额度足够个人使用，无需购买服务器。
* **🚀 极速推送**：利用 iOS 快捷指令触发，毫秒级送达。
* **📱 微信兼容**：采用纯文本消息格式，**普通微信**关注企业微信插件后可直接接收，排版整洁。
* **🔍 智能提取**：自动识别并提取短信中的验证码。
* **🛡️ 防重复发送**：利用 Cloudflare KV 数据库进行消息指纹去重，防止 iOS 快捷指令重复触发。
* **💾 历史备份**：短信内容自动存入 KV 数据库，保留 30 天，方便回溯。
* **🌏 时区自定义**：支持自定义时区（如 `Asia/Seoul`, `Asia/Shanghai`），确保显示时间准确。

## 🛠️ 准备工作

1. **Cloudflare 账号**：用于部署 Worker 和 KV。
2. **企业微信账号**：
* 注册企业微信（个人可注册）。
* 创建一个“应用” (Agent)，获取 `AgentId` and `Secret`。
* 获取企业 ID (`CorpId`)。
* **重要**：在应用的“可见范围”中添加你自己，否则收不到消息。



## 🚀 部署步骤 (网页版 Dashboard)

如果你不想使用命令行，可以直接在浏览器操作：

### 1. 创建 Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 进入 **Workers & Pages** -> **Create Application** -> **Create Worker**。
3. 命名为 `sms-forwarder`，点击 **Deploy**。
4. 点击 **Edit Code**，将本项目 `worker.js` 的完整代码粘贴进去覆盖原内容。
* *注意：代码顶部的 `const TIME_ZONE = "Asia/Seoul";` 可按需修改。*



### 2. 创建 KV 数据库 (用于去重和存储)

1. 在 Cloudflare侧边栏点击 **Storage & Databases** -> **KV**。
2. 点击 **Create a Namespace**，命名为 `SMS_CACHE`，点击 Add。
3. 回到你的 Worker 页面 -> **Settings** -> **Bindings**。
4. 点击 **Add** -> **KV Namespace**。
* **Variable name**: `SMS_CACHE` (必须大写，完全一致)。
* **KV Namespace**: 选择刚才创建的数据库。


5. 保存并 **Deploy**。

### 3. 配置环境变量

在 Worker 页面 -> **Settings** -> **Variables**，添加以下环境变量：

| 变量名 | 示例值 | 说明 |
| --- | --- | --- |
| `API_TOKEN` | `mySuperSecretPassword` | 自定义密码，用于 iOS 快捷指令鉴权 |
| `WECOM_CORPID` | `wwdxxxxxxxxxxxx` | 企业微信 CorpID |
| `WECOM_SECRET` | `FromWeComAppSecret` | 应用 Secret |
| `WECOM_AGENTID` | `1000001` | 应用 AgentID |

## 📱 iOS 快捷指令配置

这是最关键的一步，请严格按照以下步骤操作：

1. **新建自动化**：
* 打开“快捷指令” App -> 自动化 -> 点击 `+`。
* 选择 **“信息”**。
* **发件人**：选择“任何人”。
* **信息包含**：留空（或填入关键词如“验证码”）。
* **运行**：选择 **“立即运行”**。
* **运行时通知**：建议关闭。


2. **编辑动作**：
* **动作 1**: 搜索并添加 **“获取文本”** (Get Text from Input)。
* 输入源选择：**“快捷指令输入”** (Shortcut Input)。


* **动作 2**: 搜索并添加 **“获取 URL 的内容”** (Get Contents of URL)。
* **URL**: `https://你的worker域名.workers.dev` (或你绑定的自定义域名)。
* **方法**: `POST`。
* **头部 (Headers)**:
* `Authorization`: `Bearer 你的API_TOKEN` (注意 Bearer 后有空格)。


* **请求体 (Request Body)**: 选择 `JSON`。
* `content`: **[文本]** (选择动作1获取的那个文本变量，不要直接选快捷指令输入，防止格式错误)。
* `device`: `iPhone` (手动输入设备名)。
* `timestamp`: `当前日期` (可选)。







## 📝 常见问题 (FAQ)

### Q: 时间显示不正确？

A: 请在 `worker.js` 代码顶部找到 `const TIME_ZONE`，修改为你所在的时区，例如 `"Asia/Shanghai"` (中国) 或 `"Asia/Seoul"` (韩国)。

### Q: 哪里查看备份的短信？

A: 登录 Cloudflare -> **Storage & Databases** -> **KV** -> 点击 `SMS_CACHE` -> **View**。以 `log:` 开头的 Key 就是备份的短信。

### Q: 为什么普通微信显示“不支持的消息类型”？

A: 请确保你使用的是本项目的最新代码（`msgtype` 为 `text`）。旧版本使用的 `markdown` 或 `textcard` 在普通微信上可能无法正常渲染。

## 📄 License

MIT License. Feel free to modify and distribute.

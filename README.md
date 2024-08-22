# AI-Powered WeChat Bot

这是一个基于 Wechaty 和多种 AI 服务（包括 OpenAI GPT、Kimi、科大讯飞和 Deepseek）实现的智能微信机器人。本项目在原有的聊天机器人基础上，增加了提醒、记账、资产查询等功能。

## 功能特性

- 多 AI 服务支持：集成了 OpenAI GPT、Kimi、科大讯飞和 Deepseek 的 API，可根据配置灵活切换
- 智能对话：能够理解和回应用户的各种查询
- 意图分析：能够分析用户意图，触发已支持的场景功能，若未触发则智能对话，且支持上下文理解（仅科大讯飞API）
- 提醒功能：可以设置并发送定时提醒，支持相对时间和绝对时间（仅科大讯飞 API）
- 记账功能：支持简单的记账和资产查询，可记录多个账户的收支情况（仅科大讯飞 API）
- 资产查询：允许用户查询当前的资产状况和净资产（仅科大讯飞 API）
- 定时任务：可以定期发送特定内容，如每日文章推送
- 群聊和私聊支持：可同时在群聊和私聊中使用
- 白名单机制：可以限制对特定用户或群组的响应，提高安全性
- 会话记录存储：独立存储每个聊天的历史记录，提供更加个性化的回复

## 系统要求

- Node.js (推荐 v14 或更高版本)
- Python 3.7+
- Yarn 包管理器

## 安装

1. 克隆仓库：

   git clone https://github.com/Haydenzzz/AI-Powered-WeChat-Bot

   cd your-repo-name

2. 安装后端依赖：

   cd backend

   pip install -r requirements.txt

3. 安装前端依赖：

   cd ../frontend

   yarn install

4. 配置环境变量：
- 复制 `config/.env.example` 到 `config/.env` ，并填写必要的配置

## 使用方法

1. 启动后端服务：

   cd backend

   python app.py

2. 在新的终端窗口中启动前端服务：

   cd frontend

   yarn start

3. 扫描终端中显示的二维码登录微信。

## 配置说明

在 `config/.env.example` 文件中设置以下配置：
- AI 服务接口密钥（OpenAI、Kimi、科大讯飞、Deepseek）
- 机器人名称和白名单
- 目标用户和群组
- 定时任务设置

注意：要使用高级功能（提醒、记账、定时任务），请确保配置并使用科大讯飞的 API（默认使用的是讯飞4.0Ultra模型，如需使用其他版本，可自行调整xunfei.js文件中的httpUrl和modelDomain信息）。

## 注意事项

- 请确保您有权限使用相关的 AI 服务，并遵守其使用条款。
- 使用微信机器人时，请遵守微信的使用规则，避免被封号。
- 高级功能仅在使用科大讯飞 API 时可用。

## 贡献

欢迎提交问题和合并请求。对于重大更改，请先开 issue 讨论您想要更改的内容。

## 许可证

本项目采用 MIT 许可证。详情请见 [LICENSE.md](LICENSE.md) 文件。

## 致谢

本项目基于 [wechat-bot](https://github.com/wangrongding/wechat-bot) 开发，感谢原作者的贡献。
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 哲学文稿处理与索引系统 V6.0

这是一个用于处理和分析哲学文稿的系统，支持主义主义文稿分析、综合文稿分析和对比分析等功能。

View your app in AI Studio: https://ai.studio/apps/drive/1J5IT1YAAIahFadd6X9_E-KAKVe1wVAvs

## 🚀 快速开始（推荐）

**无需安装任何依赖，直接在浏览器中运行！**

1. 下载 `index-standalone.html` 文件
2. 双击打开该文件（或右键选择用浏览器打开）
3. 开始使用！

**注意：** 需要联网才能加载外部依赖（React、Tailwind CSS等）。

## 🔧 本地开发运行

如果你想进行开发或修改代码，可以使用以下方式：

**前置要求：** Node.js

1. 安装依赖：
   ```bash
   npm install
   ```

2. 配置API密钥（可选）：
   - 在应用设置中输入 SiliconFlow API Key
   - 或在 [.env.local](.env.local) 中设置 `GEMINI_API_KEY`

3. 运行开发服务器：
   ```bash
   npm run dev
   ```

4. 构建生产版本：
   ```bash
   npm run build
   ```

## 📦 文件说明

- `index-standalone.html` - **独立运行的HTML文件，包含所有编译后的代码（推荐使用）**
- `standalone.html` - 同上（备份）
- `index.html` - 开发模式使用的HTML模板
- `App.tsx` - 主应用组件
- `components/` - React组件目录
- `services/` - API服务
- `data/` - 哲学索引数据

## ✨ 主要功能

- **主义主义文稿处理**：上传文档进行结构化分析
- **索引查看器**：浏览和搜索哲学主义索引
- **拼拼乐**：对比分析不同主义
- **综合文稿分析**：深入分析综合性哲学文稿

## 🛠 技术栈

- React 19
- TypeScript
- Tailwind CSS
- Vite
- SiliconFlow API

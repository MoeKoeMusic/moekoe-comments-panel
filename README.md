# MoeKoe 评论面板

为 MoeKoe Music 增加歌单/专辑评论区。

## 功能

- 歌单详情页自动请求 `/comment/playlist`
- 专辑详情页可选请求 `/comment/album`
- 评论卡片展示用户、时间、地区、点赞和回复数
- 支持分页加载更多
- 提供插件弹窗设置开关和每页评论数

## 目录

```text
moekoe-comments-panel/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
└── README.md
```

## 安装方式

### 方式一：自动安装（推荐）

适用场景：插件已上架到 MoeKoe [插件市场](https://github.com/MoeKoeMusic/MoeKoeMusic-Plugins)。

1. 打开 `设置 -> 插件管理`
2. 切换到 `插件市场`
3. 搜索插件并点击 `安装`
4. 安装完成后刷新页面或重启应用

### 方式二：手动安装（本地开发常用）

1. 从 GitHub 下载本项目源码（`Code -> Download ZIP`）
2. 安装方式二选一：
   - 复制解压后的文件夹到 MoeKoe 插件目录（`plugins/extensions`），然后在插件管理中刷新
   - 将该下载的 `zip` 文件，在 `设置 -> 插件管理 -> 安装插件` 中选择 zip 安装
3. 安装完成后刷新页面或重启应用

## 配置

- 启用评论面板
- 每页评论数：10 / 20 / 30
- 是否在专辑详情页展示评论

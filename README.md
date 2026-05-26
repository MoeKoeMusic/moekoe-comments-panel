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

### 方式一：手动安装

1. 将插件目录放入 MoeKoe Music 插件目录 `plugins/extensions/`
2. 打开 MoeKoe Music 的插件管理页
3. 点击刷新插件，或重启主程序

### 方式二：自动安装（插件市场）

1. 把插件发布到 [插件市场源](https://github.com/MoeKoeMusic/moekoe-comments-panel)
2. 在 MoeKoe Music 插件管理中进入“插件市场”
3. 点击安装，程序会自动下载并安装 zip 包

## 配置

- 启用评论面板
- 每页评论数：10 / 20 / 30
- 是否在专辑详情页展示评论

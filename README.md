# 旅人天气 · Travel Weather

多城市天气管理：在一个页面查看多个城市的当前天气和未来五日预报，简洁、无广告，方便出行规划。目前仅支持 Android。

Multi-city weather at a glance, with current conditions and a five-day forecast. Clean, ad-free, and made for trip planning. Android only.

**版本：0.1**

**作者：Leo Gorge（liu-gongjie）与 Codex**

## 功能

- 当前区县自动定位；打开页面立即显示已有内容，后台核对位置并更新天气。
- 每次启动、返回前台及手动刷新，更新当前位置和所有已添加城市的实时天气与五日预报。
- 支持添加 1–10 个城市、中文和拼音搜索、长按卡片拖动排序。
- 小雨、中雨、大雨、暴雨分别显示 1、2、3、4 条雨线，支持浅色及深色主题。
- 设置和上次天气保存在本机；网络失败保留已有内容并提示。

## 文档与下载

- [设计开发文档](docs/DESIGN.md)：架构、功能、数据结构、流程、构建、测试与维护。
- [城市索引来源](CITY-DATA.md)
- [作者](AUTHORS.md)
- [0.1 发布说明](docs/RELEASE-0.1.md)
- [APK 下载](https://github.com/liu-gongjie/TravelWeather/releases/tag/v0.1)

## 开发入口

页面使用原生 JavaScript、HTML、CSS；Android 外壳使用 Java WebView。没有 Kotlin、Vue 或 React 运行时依赖，也没有自建后端。

```sh
# 在项目根目录预览（原生定位地址解析只在 Android 中可用）
python3 -m http.server 8765 --directory web

# 安装 Android SDK Build Tools 35.0.0、Platform android-34 与 JDK 后构建
python3 build_android.py
```

构建参数、测试环境和签名限制见设计开发文档。0.1 APK 使用本地测试签名，适合下载测试；签名密钥不会提交到仓库。

## 数据来源

天气：Open-Meteo。国内地名：和风天气公开城市列表的本地快照。补充地名搜索：Open-Meteo Geocoding（GeoNames）。尚未接入和风在线城市或天气 API。

第三方数据和原有样式资产的来源见设计文档。仓库尚未指定统一开源许可证；公开可读不代表第三方数据许可被重新授予。

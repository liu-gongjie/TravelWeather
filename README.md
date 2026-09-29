# 旅人天气 · Travel Weather

多城市天气管理：在一个页面查看多个城市的当前天气和未来五日预报，简洁、无广告，方便出行规划。目前仅支持 Android，仅有中文版本。

Multi-city weather at a glance, with current conditions and a five-day forecast. Clean, ad-free, and made for trip planning. Android only. Chinese version only.

**开发版本：0.11；已发布稳定版本：0.1**

**作者：Leo Gorge（liu-gongjie）**

## 下载与文档

- [APK 下载](https://github.com/liu-gongjie/TravelWeather/releases/tag/v0.1)     下载链接：https://github.com/liu-gongjie/TravelWeather/releases/tag/v0.1
- [0.1版 发布说明](docs/RELEASE-0.1.md)
- [0.11 开发说明与测试范围](docs/RELEASE-0.11.md)
- [设计开发文档](docs/DESIGN.md)：架构、功能、数据结构、流程、构建、测试与维护。
- [城市索引来源](CITY-DATA.md)
- [作者](AUTHORS.md)
  
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

第三方数据和原有样式资产的来源见设计文档。

## 许可证

本项目采用 [MIT License](LICENSE)，版权归 Leo Gorge（liu-gongjie）所有。作者与主要贡献者见 [AUTHORS.md](AUTHORS.md)。

第三方数据、服务及资产仍遵循各自的许可和使用条款，不因本项目采用 MIT 而改变。

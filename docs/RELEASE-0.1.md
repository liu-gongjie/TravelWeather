# 旅人天气 · Travel Weather 0.1

首个公开 Release，作者：Leo Gorge（liu-gongjie）

- 同屏显示多个城市的实时天气与五日预报。
- 当前城市自动定位，手动刷新更新全部城市天气。
- 国内中文 / 拼音城市搜索，长按拖动排序。
- 提供完整源码、设计开发文档和城市索引来源说明。

安装附件 `TravelWeather-0.1.apk`；最低 Android 6.0（API 23）。包名 `com.travelweather.app`，versionName `0.1`，versionCode `15`。此包使用测试签名，保留原机签名以支持后续覆盖升级，不是应用商店正式签名包。

天气来源 Open-Meteo；国内索引为和风公开地名快照，额外地名来自 GeoNames。未接入和风在线 API。地名可能滞后，自动定位依赖设备服务；离线保留上次天气并提示失败。

自动化测试使用模拟接口；测试范围见 `docs/DESIGN.md`。附件 `SHA256SUMS` 用于校验 APK 完整性。

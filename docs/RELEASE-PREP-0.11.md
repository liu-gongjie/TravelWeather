# 0.11 发布准备清单

发布附件与操作记录；源码标签及附件发布状态分别核对，以 GitHub Release 页面为准。

## 发布元数据

- 标题：旅人天气 · Travel Weather 0.11
- 拟用标签：`v0.11`（不移动 `v0.1`）
- 当前准备分支：`develop/0.11`
- Release 正文：`docs/RELEASE-0.11.md`
- 作者：Leo Gorge（liu-gongjie）；主要贡献者：Codex
- 许可证：MIT；第三方数据与服务条款独立适用
- Android：versionName `0.11`，versionCode `16`，最低 API 23，目标 API 35

## 附件

| 文件 | 用途 |
| --- | --- |
| `TravelWeather-0.11.apk` | 与三星 S26+ 本轮验收相同的含高德备用 Key 安装包 |
| `TravelWeather-0.11-source.zip` | 从确定的 Git 提交导出的源码和文档，无开发者 Key 或签名私钥 |
| `SHA256SUMS` | 以上两个文件的 SHA-256 校验值 |

本地准备目录在仓库旁 `release-0.11/`；额外的 `SOURCE-COMMIT.txt` 记录源码提交，`RELEASE-NOTES.md` 是发布正文副本。目录不进入 Git。源码包由 `git archive` 生成，历史 `dist/TravelWeather-0.1.apk` 是既有 0.1 文件，不是本版安装包。

## 验证结果

- 已完成构建及 APK 签名校验，检查安装包内的 Key 与本地配置一致，不打印 Key。
- 已完成三星 S26+ 覆盖安装、启动、手动刷新；城市配置保留，区县天气正常，成功更新时间推进。用户本轮未发现新问题。
- 已完成高德坐标转换及逆地理编码真实接口调用；真机高德备用链路、跨城市及省电模式全场景仍未专项确认，已在发布说明披露。
- 本次仅更新文档与发布资料，不改动已验收应用代码，不重新构建 APK。
- 发布前检查 Git 源码与源码归档不含 Key；含 Key 的 0.11 APK 只作为 Release 附件，不提交到 `dist/` 或任何源码路径。

## 正式发布操作

1. 确认最终源码提交与附件校验值；若之后修改应用代码，重新构建并验证附件。
2. 将最终 0.11 代码合入发布分支，创建指向最终发布提交的 `v0.11` 标签。
3. 以 `docs/RELEASE-0.11.md` 为正文创建 Release，上传 APK、源码归档和 `SHA256SUMS`。
4. 发布后将 README 的稳定版本与下载链接更新为 0.11，检查下载文件和校验值。

现有 `.github/workflows/release.yml` 固定用于 0.1，不支持发布 0.11；不要手动运行它来发布新版本，也不要覆盖旧 Release 附件。新版本使用独立的 `v0.11` 标签和 Release 发布，不运行旧工作流。

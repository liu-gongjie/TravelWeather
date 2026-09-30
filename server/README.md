# 0.12 逆地理编码代理

手机优先系统 Geocoder，失败后请求此代理。服务器将 WGS84 转为高德坐标再查询地址，仅返回 `name` 和 `key`，不返回 Key 或完整门牌。天气请求仍用原 WGS84 坐标。

## 部署需要

- 服务器公网 IP、系统版本、SSH 用户与端口、本机 SSH 私钥路径。
- 可解析到该服务器的域名，用于可信 HTTPS 证书；没有域名时先确定可信 HTTPS 方案，不能关闭证书校验。
- 安全组允许 SSH（建议限本人 IP）和 80/443；8081 不开放公网。
- 高德 Web 服务 Key 在服务器 `/etc/travelweather/geocoder.env` 保存，权限 `600`、root 所有。内容为 `AMAP_WEB_KEY=实际密钥`，不要提交此文件。

Ubuntu/Debian 部署：安装 Python 3、Nginx 和 Certbot，创建无登录权限的 `travelweather` 用户。将 `geocoder.py` 放入 `/opt/travelweather/`，由 root 所有、服务用户只读；将 `travelweather-geocoder.service` 放入 `/etc/systemd/system/`。运行 `systemctl daemon-reload` 和 `systemctl enable --now travelweather-geocoder`。本机 `http://127.0.0.1:8081/health` 可检查进程，不代表高德链路成功。

申请域名证书后，将 `nginx.conf.example` 中 `WEATHER_DOMAIN` 全部替换为真实域名并启用；先运行 `nginx -t` 再重载。部署到已有服务器时必须先检查现有站点和端口。代理只监听 loopback，必须配合 Nginx 限流。

构建客户端：

```sh
GEOCODER_PROXY_URL=https://真实域名/v1/reverse-geocode python3 build_android.py
```

0.12 构建不读取或打包旧高德 Key，并主动清理 0.11 留在构建资产中的密钥文件。未指定代理地址时只使用系统 Geocoder。

## 安全与运维

Key 永远保留服务器；APK 的代理地址公开。代理没有客户端秘密，不声称能识别正版 APK；内嵌 token 同样可提取。采用单 IP 和总请求频率限制、4 个上游请求并发限制、严格坐标参数校验、固定上游地址、响应大小限制和超时。Nginx 总限流默认每分钟 30 个代理请求，单 IP 每分钟 6 个，仍需按高德真实配额调整。每次成功解析通常调用两次高德 API。

没有坐标持久化或访问 URL 日志。配置文件、异常响应、日志不输出 Key、上游 URL 或精确坐标。服务器管理员仍能接触进程内坐标；系统 Geocoder 失败时用户坐标会传给本代理和高德，隐私说明应包含该用途。

0.11 已发布 APK 内的旧 Key 仍可能被提取。正式迁移建议申请一个服务器专用新 Key、配置服务器出口 IP 白名单；完成真实验证后再停用旧 Key，这会影响旧版 APK 的高德备用链路，系统 Geocoder 和天气仍可用。不要在新代理中直接重新公开旧 Key。

验证顺序：单元测试 → 本机代理接口错误处理 → HTTPS 证书及限流 → 高德真实地址解析 → APK 无密钥检查 → 真机系统成功/失败两条链路。当前只完成本地代码和单元测试，云端部署待连接信息。

接口依据：[高德逆地理编码](https://lbs.amap.com/api/webservice/guide/api/georegeo)、[坐标转换](https://lbs.amap.com/api/webservice/guide/api/convert)。

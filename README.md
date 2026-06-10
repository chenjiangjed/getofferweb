# GetOffer 正式上线迁移说明

本目录是 ICP 备案批准后的上线迁移代码包。

```text
迁移基线：C:\Users\PC\Desktop\chujobfinder\backups\web_demo_base_20260605_184152
迁移目标：C:\Users\PC\Desktop\chujobfinder\backups\web_backup
前端域名：https://www.getofferai.cn
后端域名：https://api.getofferai.cn
```

本次迁移以本地 demo 基线为功能源，只合并正式上线所需改动：生产域名、正式环境变量、后端生产校验、`/api/health`、前端生产构建配置、ASR SDK 参数修正和上线文档。

## 1. 目录内容

```text
client/   React + Vite 前端
server/   Node.js + Express 微后端
```

未迁移内容：

```text
node_modules/       依赖目录，按 package-lock.json 重新安装
server/data/*.db    本地 SQLite 运行数据，生产放到 /var/www/getoffer/server-data
.env/.env.local     本地密钥文件，生产在 ECS 手动创建
旧 dist/            构建产物，按当前源码重新生成
```

不迁移 `node_modules` 的原因：依赖目录体积大，且包含平台、Node 版本、安装脚本和缓存状态；上线应使用 `package-lock.json + npm ci` 在目标环境复现依赖。

## 2. 本地构建验证

前端：

```powershell
cd C:\Users\PC\Desktop\chujobfinder\backups\web_backup\client
npm ci
npm run build
```

后端：

```powershell
cd C:\Users\PC\Desktop\chujobfinder\backups\web_backup\server
npm ci
npm run build
```

如果 `npm ci` 卡在 `ffmpeg-static node install.js`，通常是下载 ffmpeg 二进制较慢或网络被阻塞。可切换 npm 镜像、检查代理，或在 ECS 上重新执行 `npm ci`。只要依赖完整，`npm run build` 应通过。

## 3. 前端生产变量

生产构建读取：

```text
client/.env.production
```

必须确认：

```env
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://api.getofferai.cn
VITE_DEMO_CAPTCHA_BYPASS=false
VITE_ALIYUN_CAPTCHA_REGION=cn
VITE_ALIYUN_CAPTCHA_PREFIX=your-captcha-prefix
VITE_ALIYUN_CAPTCHA_SCENE_ID=your-captcha-scene-id
```

`VITE_ALIYUN_CAPTCHA_PREFIX` 和 `VITE_ALIYUN_CAPTCHA_SCENE_ID` 是前端公开配置，不是 AK/SK；仍建议只通过环境变量维护，不写死到源码。

## 4. 后端生产变量

生产环境在 ECS 的后端目录创建：

```text
server/.env.production
```

模板来自：

```text
server/.env.example
```

需要填写：

```env
NODE_ENV=production
PORT=3001
FRONTEND_ORIGIN=https://www.getofferai.cn
JWT_SECRET=replace-with-a-strong-random-string
DATABASE_PATH=/var/www/getoffer/server-data/chujobfinder.sqlite
DEMO_CAPTCHA_BYPASS=false

DASHSCOPE_API_KEY=your-dashscope-api-key
BAILIAN_APP_ID=your-bailian-app-id
BAILIAN_COMPLETION_TIMEOUT_MS=300000
BAILIAN_STREAM_TIMEOUT_MS=300000

ALIYUN_OSS_REGION=oss-cn-beijing
ALIYUN_OSS_ENDPOINT=https://oss-cn-beijing.aliyuncs.com
ALIYUN_OSS_BUCKET=your-private-business-bucket
ALIYUN_OSS_ACCESS_KEY_ID=your-oss-ak
ALIYUN_OSS_ACCESS_KEY_SECRET=your-oss-sk

ALIYUN_CAPTCHA_REGION=cn-beijing
ALIYUN_CAPTCHA_SCENE_ID=your-server-captcha-scene-id
ALIYUN_CAPTCHA_ACCESS_KEY_ID=your-captcha-ak
ALIYUN_CAPTCHA_ACCESS_KEY_SECRET=your-captcha-sk

ALIYUN_ASR_REGION=cn-beijing
ALIYUN_AK_ID=your-nls-ak
ALIYUN_AK_SECRET=your-nls-sk
NLS_APP_KEY=your-nls-app-key
ASR_KEEP_DEBUG_AUDIO=false
ASR_DEBUG_LOG=false
```

生产启动时会校验必需变量，并拒绝以下值：

```text
JWT_SECRET=replace-me
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_PATH=./data/chujobfinder.sqlite
```

不要把真实 AK/SK、JWT secret、DashScope key 写进 Git、README 或前端代码。

## 5. 阿里云资源准备

参考阿里云官方文档：

```text
OSS 静态网站托管：
https://help.aliyun.com/zh/oss/user-guide/hosting-static-websites

OSS 自定义域名：
https://help.aliyun.com/zh/oss/user-guide/access-buckets-via-custom-domain-names

CDN 刷新和预热：
https://help.aliyun.com/zh/cdn/user-guide/refresh-and-prefetch-resources

ECS 部署 Node.js 环境：
https://help.aliyun.com/zh/ecs/user-guide/deploy-a-node-js-environment/

ECS 部署业务代码：
https://help.aliyun.com/zh/ecs/user-guide/deploy-applications

智能语音交互 Node.js 录音文件识别：
https://help.aliyun.com/zh/isi/developer-reference/node-js-demo-1
```

建议资源：

```text
ECS：北京地域，Ubuntu 22.04，Node.js 20 LTS，Nginx，PM2
前端 Bucket：托管 client/dist
业务 Bucket：私有读写，保存头像、生成简历、临时面试音频、MCP 数据
CDN 域名：www.getofferai.cn
API 域名：api.getofferai.cn 指向 ECS 公网 IP
```

## 6. 后端 ECS 部署

服务器初始化：

```bash
apt update && apt upgrade -y
apt install -y git curl unzip nginx ufw build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
mkdir -p /var/www/getoffer/repo
mkdir -p /var/www/getoffer/server-data
```

上传或拉取代码到：

```text
/var/www/getoffer/repo
```

后端首次部署：

```bash
cd /var/www/getoffer/repo/web_backup/server
npm ci
cp .env.example .env.production
nano .env.production
npm run build
NODE_ENV=production pm2 start dist/index.js --name getoffer-api
pm2 save
```

后端更新部署：

```bash
cd /var/www/getoffer/repo/web_backup/server
npm ci
npm run build
NODE_ENV=production pm2 reload getoffer-api || NODE_ENV=production pm2 start dist/index.js --name getoffer-api
pm2 save
```

健康检查：

```bash
curl http://127.0.0.1:3001/api/health
curl https://api.getofferai.cn/api/health
```

期望返回：

```json
{
  "ok": true,
  "version": "0.1.0",
  "time": "2026-06-10T00:00:00.000Z"
}
```

## 7. Nginx API 反向代理

证书文件示例：

```text
/etc/nginx/ssl/api.getofferai.cn.pem
/etc/nginx/ssl/api.getofferai.cn.key
```

配置：

```nginx
server {
    listen 80;
    server_name api.getofferai.cn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.getofferai.cn;

    ssl_certificate /etc/nginx/ssl/api.getofferai.cn.pem;
    ssl_certificate_key /etc/nginx/ssl/api.getofferai.cn.key;

    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

启用：

```bash
ln -s /etc/nginx/sites-available/getoffer-api /etc/nginx/sites-enabled/getoffer-api
nginx -t
systemctl reload nginx
```

## 8. 前端 OSS/CDN 部署

构建：

```powershell
cd C:\Users\PC\Desktop\chujobfinder\backups\web_backup\client
npm ci
npm run build
```

上传：

```text
将 client/dist/* 上传到前端 OSS Bucket 根目录
```

OSS 静态网站配置：

```text
默认首页：index.html
默认 404 页：index.html
错误文档响应码：200
```

这一步是 SPA 路由刷新不 404 的关键。

CDN：

```text
加速域名：www.getofferai.cn
源站：前端 OSS Bucket
HTTPS：绑定 www.getofferai.cn 证书
刷新：/
刷新：/index.html
```

## 9. DNS 解析

备案通过后配置：

```text
www  CNAME  CDN 分配的 CNAME
api  A      ECS 公网 IP
@    可选 301 跳转到 https://www.getofferai.cn
```

确认：

```bash
nslookup www.getofferai.cn
nslookup api.getofferai.cn
```

## 10. OSS 路径与权限

不要改变业务路径：

```text
data/mock_jobs.json
data/mock_resumes.json
profiles/{safe_user_id}.json
templates/resume/temp_1.docx
templates/resume/temp_2.docx
templates/resume/temp_3.docx
templates/resume/temp_4.docx
profile_photos/{safe_user_id}/{photo_id}.jpg
generated_resumes/{safe_user_id}/{resume_id}.docx
interview_audio/{safe_user_id}/{audio_id}.{ext}
```

业务 Bucket 建议私有读写。后端负责：

```text
证件照上传签名：POST /api/oss/photo-upload-token
简历下载签名：GET /api/files/download-url
ASR 临时音频：上传到 interview_audio/，转写完成后删除
```

RAM 建议拆分：

```text
前端部署 RAM：只允许前端 Bucket 上传、CDN 刷新
后端业务 RAM：允许业务 Bucket 指定路径读写、删除临时音频
验证码 RAM：只允许验证码服务端校验
智能语音 RAM：只允许智能语音交互相关权限
```

## 11. Agent 与 MCP

不要改变 MCP 工具名：

```text
mock_job_search
mock_resume_loader
profile_manager
fluency_analyzer
resume_docx_generator
interview_answer_analyzer
```

不要改变 Agent intent：

```text
career_plan_collect_materials
generate_resume_docx
submit_interview_answer
```

百炼应用需要确认：

```text
DASHSCOPE_API_KEY 可用
BAILIAN_APP_ID 对应已发布应用
MCP 服务版本和 OSS 路径仍与本项目一致
```

## 12. ASR 验收

后端使用官方 `aliyun-nls-filetrans` SDK，并在上传到 OSS 前将浏览器录音转换为 16k 单声道 WAV。

检查项：

```text
ALIYUN_AK_ID / ALIYUN_AK_SECRET / NLS_APP_KEY 已填写
ALIYUN_ASR_REGION 与智能语音项目地域一致
业务 OSS 临时签名 URL 能被公网访问
ASR 成功后 interview_audio/ 临时文件被删除
POST /api/asr/transcribe 返回 text、duration、provider
```

保留接口结构：

```json
{
  "text": "转写后的文本",
  "duration": 123,
  "provider": "aliyun-nls-filetrans"
}
```

## 13. 上线验收清单

基础：

```text
https://api.getofferai.cn/api/health 正常
https://www.getofferai.cn 正常打开
刷新 /chat/:id、/resume、/interview 不 404
浏览器控制台无生产 API localhost 请求
```

登录：

```text
注册可触发阿里云验证码
登录失败多次后可触发验证码
JWT 登录态正常
```

业务：

```text
一站式求职方案能调用 Agent
简历生成能上传照片、触发 resume_docx_generator、获取 docx 下载链接
模拟面试能录音、ASR 转写、提交 interview_answer_analyzer
面试总结能触发 fluency_analyzer
```

安全：

```text
前端没有 AK/SK
后端 .env.production 不进 Git
业务 Bucket 非公开读写
DATABASE_PATH 位于 /var/www/getoffer/server-data
ASR_KEEP_DEBUG_AUDIO=false
```

## 14. 回滚方案

后端：

```bash
pm2 list
pm2 logs getoffer-api
cd /var/www/getoffer/repo/web_backup/server
git checkout <last-good-commit>
npm ci
npm run build
NODE_ENV=production pm2 reload getoffer-api
```

前端：

```text
保留上一版 client/dist 上传包
如新版本异常，重新上传上一版 dist 到 OSS
刷新 CDN / 和 /index.html
```

数据：

```text
上线前备份 /var/www/getoffer/server-data/chujobfinder.sqlite
不要把生产 SQLite 放在 repo 目录内
```

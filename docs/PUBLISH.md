# 发布到 GitHub / npm（以及"插件市场"到底是什么）

## 先说结论：DSH 没有开放的第三方插件市场提交入口

DSH 插件页里的条目来自三处：

1. **随安装提供的组合包**（`@deepseek-ai/dsh-base` 这类，来自安装目录）；
2. **官方可选组合包**：由启动器的 `OPTIONAL_BUNDLES` 点名，随安装提供、默认关闭，用户自己开启
   （见 `@deepseek-ai/dsh-plugin-manager/README` 的 `listBundles` 说明）；
3. **按需官方目录项**：同样由 DSH 安装侧维护，安装时使用 `package@<当前 DSH 版本>`。

**第三方插件不进这个目录**。插件页的"安装"输入框接受的是 `pnpm add` 形式的 spec，所以第三方插件
的标准分发方式是：

- **npm 包名**（`dsh-supreme-command`）
- **GitHub 仓库**（`github:用户名/dsh-supreme-command`，或完整 git URL）
- 本地目录（`file:` / 绝对路径，开发时用）

也就是说：**发到 npm + GitHub，就等于"能被 DSH 插件页搜到/安装到"**；官方市场目录里出现不了第三方包。

## 一、推到 GitHub

`gh` CLI 本机没装、也没有登录信息，所以推送这一步需要你本人执行（或者装 `gh` 后 `gh auth login`）。

### 1) 先在 GitHub 网页建空仓库

名称建议 `dsh-supreme-command`，**不要**勾选 README / .gitignore / LICENSE（我们本地已经有）。

### 2) 本地仓库已经初始化好（`main` 分支、首次提交已完成），只需加远端并推

```powershell
cd F:\dsh-startup-theme
git remote add origin https://github.com/<你的用户名>/dsh-supreme-command.git
git push -u origin main
```

首次推送会要求登录：建议用 **GitHub Personal Access Token** 当密码（`repo` 权限），
或在 Git Credential Manager 弹窗里选 "Sign in with your browser"。

### 3) 把占位符换掉

`package.json` 里的 `repository` / `bugs` / `homepage` 目前是 `<你的GitHub用户名>` 占位，
推送前替换成真实地址（`npm pkg set repository.url=...` 或直接编辑）。

## 二、发到 npm（插件页能按包名安装的关键）

```powershell
cd F:\dsh-startup-theme
npm login                     # 浏览器授权
npm pack --dry-run            # 先看清会发哪些文件（语音素材已排除）
npm publish --access public
```

发完之后，DSH 里安装：

- 设置 → 插件 → 安装插件 → 填 `dsh-supreme-command`
- 或命令行：`dsh plugin --profile desktop add dsh-supreme-command`

## 三、GitHub 直装（不发 npm 也能装）

```powershell
dsh plugin --profile desktop add github:dingb/dsh-supreme-command
```

DSH Desktop 的插件页也支持粘贴同样的 spec。

## 四、发布前必须注意的三件事

1. **语音素材不发布**：`lib/assets/voice/*.mp3` 来自本机已安装的第三方插件，来源与授权不明，
   已在 `.gitignore` 排除、并在 `package.json` 的 `files` 里用 `!lib/assets/voice` 排除。
   用户需要真声就自己跑 `node scripts/import-voice.mjs`。
2. **同人性质要写清楚**：本插件参考《流浪地球 2》视觉，不含电影素材；`NOTICE` 里已写明
   "非官方、无隶属关系、名称与标识归原权利人"。商用/大规模分发前请自行评估风险。
3. **字体授权**：`YOU SheBiaoTiHei`（优设标题黑）为免费商用字体，随包分发时保留版权声明
   （见 `NOTICE`）。不想分发字体可在 `files` 里加 `!lib/assets/fonts`。

## 五、版本与更新

- 语义化版本：`major` 改契约/配置不兼容、`minor` 加功能、`patch` 修问题；
- 每次发布前跑 `npm test` + `node scripts/check-*.mjs`（见 README 的"开发与验证"）。

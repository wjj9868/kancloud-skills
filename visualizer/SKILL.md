---
name: visualizer
description: 生成项目新人入职报告。脚本只生成骨架，AI 必须读取真实代码填充所有内容。
allowed-tools: Bash(python:*), read_file, list_dir, view_file, view_code_item, grep_search, find_by_name, write_to_file, replace_file_content
context: fork
---

# Project Visualizer

## 触发条件

用户请求包含：生成入职报告、项目可视化、分析项目结构、新人文档

## 执行流程

### Phase 1: 初始化

```bash
python "e:\.claude\skills\visualizer\scripts\scanner.py" "项目路径" -o "项目路径/modules.json"
python "e:\.claude\skills\visualizer\scripts\module_analyzer.py" -i "项目路径/modules.json" -o "项目路径/.docs"
```

此时生成的文档都是骨架，包含 `<!-- AI_FILL -->` 占位符。

### Phase 2: AI 填充所有内容

脚本不填内容，所有内容都由 AI 读取真实代码后填充。

#### 2.1 填充 QUICKSTART.md

必须读取以下文件：
- pom.xml - 获取 JDK 版本、Maven 配置
- application.yml / application.properties - 获取端口、数据库配置
- package.json - 获取 Node 版本、启动命令

基于这些真实配置填写：
- 环境要求（真实版本号）
- 数据库配置（真实配置项路径）
- 启动命令（真实命令）

#### 2.2 填充每个模块文档

对每个模块（必须全部完成）：

1. find_by_name 搜索 Controller/Service 文件
2. view_file 阅读核心代码
3. replace_file_content 替换 `<!-- AI_FILL -->` 占位符

必须填充的内容：
- 模块概述：真实职责
- 核心功能：真实接口路径和方法
- 关键类说明：真实类名和方法
- 数据流向：真实调用链
- 开发注意事项：从代码中发现的

#### 2.3 检查完成度

每填充完一个模块，更新 INDEX.md 的状态：
- 待分析 -> 已完成

所有模块状态变为"已完成"后才能进入 Phase 3。

### Phase 3: 渲染报告

确认所有 `<!-- AI_FILL -->` 都已替换后：

```bash
python "e:\.claude\skills\visualizer\scripts\project_visualizer.py" -m "项目路径/modules.json" -d "项目路径/.docs" -o "项目路径/ONBOARDING_REPORT.html"
```

## 模块分析详细步骤

### Java 模块

```
1. find_by_name *Controller*.java
2. view_file 最重要的 Controller（看接口路径）
3. find_by_name *Service*.java  
4. view_file 核心 Service（看业务逻辑）
5. view_file pom.xml（看依赖）
6. view_file application*.yml（看配置）
7. replace_file_content 更新 .docs/模块名.md
```

填充内容示例：
```markdown
### 核心功能

1. **微信登录** (`UserLoginController`)
   - 接口：`GET /user/auth/wechat/login-url`
   - 说明：生成微信扫码二维码链接
   - 相关类：WechatService.generateLoginUrl()

2. **用户信息获取** (`UserLoginController.getInfo`)
   - 接口：`GET /user/auth/getInfo`
   - 返回：用户基本信息、VIP状态、面试次数
```

### 前端模块

```
1. view_file package.json（框架、依赖）
2. list_dir src/（目录结构）
3. view_file src/main.ts 或 main.js（入口）
4. replace_file_content 更新文档
```

### 文档模块

```
1. list_dir 列出所有文件
2. 对重要文件 view_file 查看内容
3. replace_file_content 填写用途说明
```

## 约束

必须：
- Phase 1 完成后，所有 .md 文件都有 `<!-- AI_FILL -->` 占位符
- Phase 2 中，AI 必须用真实内容替换每一个占位符
- Phase 2 必须处理每一个模块，不可跳过
- Phase 3 前，INDEX.md 中所有模块状态都是"已完成"

禁止：
- 脚本生成最终内容（脚本只生成骨架）
- AI 跳过任何模块
- AI 使用猜测的内容
- 保留任何 `<!-- AI_FILL -->` 占位符

## 验收标准

最终文档中：
- 无 `<!-- AI_FILL -->` 残留
- 每个接口路径都是真实的
- 每个类名/方法名都是真实的
- 每个配置项都来自实际配置文件

---
name: code-review
description: Java代码审查与Git变更分析。触发词：review code、代码审查、分析变更、diff分析。
---

# 代码审查

## 模式选择
- 用户提到 Git/diff/变更 → 模式二
- 用户提供代码文件 → 模式一

## 模式一：静态规范审查

### 触发条件
- review code / code review / 代码审查
- 检查这段代码 / 帮我看看这段代码
- 粘贴代码片段或打开代码文件

### 执行流程
1. 读取目标文件
2. 按红线规范检查代码 → [references/redline-rules.md](./references/redline-rules.md)
3. 生成审查结果（行格式）→ [references/output-formats.md](./references/output-formats.md)
4. 调用脚本生成 HTML 报告

```bash
node ./scripts/generate-report-html.js --input ai-review-result.txt --output review-report.html
```

## 模式二：变更影响分析

### 触发条件
- 分析这次变更 / diff / 这次改动影响
- 调用链分析

### 执行流程
1. 收集 Git 变更
```bash
node ./scripts/git-change-collector.js --source <项目路径> --output changes.json --mode <all|last:N|diff>
```

2. 准备审查数据
```bash
node ./scripts/prepare-for-ai.js --input changes.json --output review-data.json
```

3. 分析变更影响
   - 入口点: @RestController, @GetMapping, @PostMapping
   - 调用链: Controller → Service → Mapper → SQL/HTTP/RPC
   - 标记: [新增] [修改] [删除]

4. 生成审查结果（行格式）

5. 调用脚本生成 HTML 报告
```bash
node ./scripts/generate-report-html.js --input ai-review-result.txt --output review-report.html
```

## 脚本清单

| 脚本 | 用途 |
|-----|------|
| git-change-collector.js | 收集 Git 变更 |
| prepare-for-ai.js | 准备审查数据 |
| generate-report-html.js | 生成 HTML 报告 |

## 错误处理
- 脚本执行失败时，检查文件路径和参数
- 向用户报告错误信息并建议修复方案

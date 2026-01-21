---
name: Claude-Code-Skills-完整教程
description: 本文档是 Claude Code Skills 的完整教程，教会你创建、使用和管理 Skills。学会这些后，你可以教会 Claude 任何专业技能。
---

# Claude Code Skills 完整教程

## 目录

1. [什么是 Skills？](#什么是-skills)
2. [快速开始](#快速开始)
3. [Skill 文件结构](#skill-文件结构)
4. [核心概念详解](#核心概念详解)
5. [实战示例](#实战示例)
6. [进阶功能](#进阶功能)
7. [调试和排查](#调试和排查)
8. [最佳实践](#最佳实践)
9. [常见问题](#常见问题)

---
fe
## 什么是 Skills？

**Skills = 教会 Claude 特定技能的文件**

它让 Claude 能够：
- 按照你的标准执行任务
- 使用你指定的工具和流程
- 遵循你的团队的规范

### 对比其他功能

| 功能 | 触发方式 | 何时使用 |
|------|----------|----------|
| **Skills** | Claude 根据描述自动匹配 | 专业化知识（"用我们的标准审查 PR"） |
| **Slash Commands** | 手动输入 `/命令` | 常用命令（`/deploy staging`） |
| **CLAUDE.md** | 每个对话自动加载 | 项目级通用设置 |
| **Subagents** | 手动或自动调用 | 需要隔离上下文时 |

---

## 快速开始

### 步骤 1：检查现有 Skills

在 Claude Code 中输入：
```
What Skills are available?
```

### 步骤 2：创建 Skill 目录

```bash
mkdir -p ~/.claude/skills/你的技能名
```

### 步骤 3：创建 SKILL.md

```yaml
---
name: my-first-skill
description: 简短描述 WHEN TO USE
---

# 我的技能

## 指令
1. 第一步
2. 第二步
```

### 步骤 4：测试

在 Claude Code 中输入匹配描述的请求，Claude 会自动激活 Skill。

---

## Skill 文件结构

### 基础结构

```
my-skill/
├── SKILL.md              # 必需：主文件
├── reference.md          # 可选：详细文档
└── scripts/              # 可选：脚本目录
    └── helper.py
```

### SKILL.md 结构

```yaml
---
name: skill-name          # 必需：技能名（小写字母、数字、连字符）
description: 描述 WHEN TO USE  # 必需：触发条件
allowed-tools: Read, Bash  # 可选：限制工具
model: claude-sonnet-4    # 可选：指定模型
context: fork             # 可选：独立上下文
---

# 技能标题

## 指令
提供清晰的步骤指导。

## 示例
展示具体使用例子。
```

---

## 核心概念详解

### 1. 名称 (name)

- 只能包含：小写字母、数字、连字符
- 最大长度：64 字符
- 应该与目录名一致
- 示例：`commit-helper`、`code-explainer`

### 2. 描述 (description) ⭐ 最重要

这是 Claude 决定何时使用 Skill 的依据！

**好描述的要素：**
1. 具体能力（"生成 commit messages"）
2. 触发词（"commit"、"git"、"版本控制"）

**示例：**
```yaml
# ✅ 好
description: Generate clear commit messages from git diffs. Use when writing commit messages, reviewing staged changes, or when the user mentions commits, git, or version control.

# ❌ 差
description: Helps with git stuff.
```

### 3. 工具限制 (allowed-tools)

```yaml
# 逗号分隔
allowed-tools: Read, Grep, Bash(git:*)

# 或 YAML 列表
allowed-tools:
  - Read
  - Grep
  - Bash(git:*)
```

### 4. 模型指定 (model)

```yaml
model: claude-sonnet-4-20250514
```

### 5. 上下文模式 (context)

```yaml
context: fork  # 独立子代理上下文
```

---

## 实战示例

### 示例 1：代码审查 Skill

```yaml
---
name: pr-reviewer
description: Review pull requests using our team's coding standards. Use when reviewing PRs, checking code quality, or when the user asks to review, check, or audit code changes.
allowed-tools: Read, Bash(git:*)
---

# 代码审查标准

## 审查清单

1. **代码风格**
   - [ ] 遵循项目代码规范
   - [ ] 变量命名清晰
   - [ ] 函数职责单一

2. **逻辑正确**
   - [ ] 边界条件已处理
   - [ ] 错误处理完善
   - [ ] 没有明显的 bug

3. **测试覆盖**
   - [ ] 有对应的测试
   - [ ] 测试通过

## 审查输出格式

```
## 审查结果

### ✅ 通过
- 改动点

### ⚠️ 建议
- 建议改进的地方

### ❌ 问题
- 必须修复的问题
```
```

### 示例 2：API 文档 Skill

```yaml
---
name: api-docs
description: Generate OpenAPI documentation for REST APIs. Use when documenting endpoints, creating API specs, or when the user asks to generate docs or describe APIs.
allowed-tools: Read
---

# API 文档生成器

## OpenAPI 3.0 格式

```yaml
paths:
  /endpoint:
    get:
      summary: 接口简短描述
      description: 详细描述
      parameters:
        - name: param1
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Response'
```
```

### 示例 3：测试生成 Skill

```yaml
---
name: test-generator
description: Generate unit tests using pytest/Jest. Use when writing tests, creating test cases, or when the user asks to test, cover, or write tests.
allowed-tools: Read, Glob
---

# 测试生成器

## pytest 模板

```python
import pytest

class TestFeature:
    def test_normal_case(self):
        """测试正常情况"""
        result = function(input_data)
        assert result == expected

    def test_edge_case(self):
        """测试边界情况"""
        with pytest.raises(ExpectedError):
            function(invalid_data)

    @pytest.mark.parametrize("input,expected", [
        ("a", "A"),
        ("b", "B"),
    ])
    def test_parametrized(self, input, expected):
        """参数化测试"""
        assert function(input) == expected
```
```

---

## 进阶功能

### 1. 渐进式披露

将详细文档放到单独文件，只在需要时加载：

```
my-skill/
├── SKILL.md          # 核心指令（< 500 行）
├── reference.md      # 详细参考（按需加载）
└── examples.md       # 示例集合（按需加载）
```

**SKILL.md 引用：**
```markdown
## 详细参考
- API 细节见 [reference.md](reference.md)
- 更多示例见 [examples.md](examples.md)
```

### 2. 脚本绑定

```yaml
---
name: data-analyzer
description: Analyze data files and generate reports
allowed-tools: Bash(python:*)
---

运行分析脚本：
bash scripts/analyze.py input.csv --format html
```

**脚本自动执行，不消耗上下文！**

### 3. Hooks（钩子）

```yaml
---
name: secure-coding
description: Apply security best practices
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/security-check.sh $TOOL_INPUT"
          once: true
```

### 4. 独立上下文

```yaml
---
name: complex-analysis
description: Perform complex multi-step analysis
context: fork
agent: Explore
```

### 5. 子代理集成

```yaml
# .claude/agents/code-reviewer.md
---
name: code-reviewer
description: Review code for quality
skills: pr-reviewer, test-generator
---
```

---

## 调试和排查

### Skill 不触发

**检查描述是否包含触发词：**

```yaml
# 用户说："帮我写测试"
description: Generate unit tests... Use when writing tests, creating test cases, or when the user asks to test, cover, or write tests.
                                      ↑ 这些词要匹配用户的表达
```

### Skill 不加载

| 问题 | 解决 |
|------|------|
| 路径错误 | `~/.claude/skills/xxx/SKILL.md` |
| YAML 语法错误 | 确保 `---` 在第一行 |
| 缩进错误 | 用空格，不用 Tab |
| 文件名错误 | 必须是 `SKILL.md`（大小写敏感） |

### 查看加载错误

```bash
claude --debug
```

---

## 最佳实践

### 1. 描述写作

**包含：**
- 具体能力（"生成 commit messages"）
- 触发词（"commit"、"git"）
- 使用场景（"writing commits"）

**示例：**
```yaml
description: Generate clear commit messages from git diffs. Use when writing commit messages, reviewing staged changes, or when the user mentions commits, git, or version control.
```

### 2. 保持 SKILL.md 简洁

- 核心指令 < 500 行
- 详细文档放到单独文件
- 使用渐进式披露

### 3. 工具限制

```yaml
# 只读操作
allowed-tools: Read, Grep, Glob

# Git 操作
allowed-tools: Bash(git:*)

# 避免
allowed-tools: Write, Edit, Delete  # 除非需要
```

### 4. 脚本最佳实践

- 使用标准库（减少依赖）
- 脚本可独立测试
- 提供清晰的命令行参数
- 返回结构化输出

### 5. 目录结构规范

```
skills/
├── commit-helper/         # 目录名 = name
│   ├── SKILL.md
│   └── scripts/
│       └── helper.py
├── code-explainer/
│   ├── SKILL.md
│   └── reference.md
└── test-generator/
    ├── SKILL.md
    └── templates/
        └── test_template.py
```

---

## 常见问题

### Q1: Skills 和 CLAUDE.md 有什么区别？

| CLAUDE.md | Skills |
|-----------|--------|
| 每个对话自动加载 | Claude 根据描述匹配 |
| 项目级通用设置 | 专业化任务指导 |
| 不能包含脚本 | 可以绑定脚本 |

### Q2: Skills 会消耗上下文吗？

- `SKILL.md` 的名称和描述 → 始终加载
- `SKILL.md` 的完整内容 → 只在激活时加载
- 脚本 → 执行但不加载内容

### Q3: 多个同名的 Skill 怎么办？

优先级（从高到低）：
1. 企业管理（managed）
2. 个人（`~/.claude/skills/`）
3. 项目（`.claude/skills/`）
4. 插件

### Q4: 如何分享 Skills？

1. **项目级**：提交 `.claude/skills/` 到 Git
2. **插件级**：创建插件，发布到市场
3. **企业级**：通过管理配置部署

### Q5: Skill 可以删除或更新吗？

- **删除**：删除目录即可
- **更新**：编辑 `SKILL.md`，立即生效
- **重新加载**：Claude 自动检测变化

---

## 已安装的 Skills

本教程包含以下 Skills（位于 `E:\.claude\skills\`）：

| Skill | 功能 |
|-------|------|
| `commit-helper` | 生成规范的 commit messages |
| `code-explainer` | 用图表和类比解释代码 |
| `test-generator` | 生成单元测试和集成测试 |
| `api-docs` | 生成 API 文档（OpenAPI） |
| `debug-helper` | 调试代码、定位 bug |
| `visualizer` | 生成代码库可视化 |

---

## 下一步

1. **尝试使用**：在 Claude Code 中说 "帮我写一个 commit message"
2. **创建自己的 Skill**：基于你的团队规范
3. **分享给团队**：将 Skill 提交到项目仓库
4. **深入学习**：查看 [官方文档](https://code.claude.com/docs/en/skills)

---

**Happy Coding! 🚀**

---
name: code-review
description: Java代码审查与Git变更分析。触发词：review code、代码审查、分析变更、diff分析。
---

# 代码审查

核心原则：基于真实场景判断，不要吹毛求疵，只报告真正真实有影响的问题。

- 1 Critical：必须修复，可能导致生产事故（安全漏洞、并发问题、事务问题、空指针）
- 2 Warning：建议修复，存在明显性能风险或资源泄漏
- 3 Info：代码规范问题，基于真实场景判断是否有影响

判断标准：
- 这段代码在实际运行中真的会出问题吗？
- 这个问题会影响系统稳定性、安全性或性能吗？
- 还是只是代码风格偏好？
- 避免过度设计，关注真实风险

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

2. 预处理：为代码添加行号前缀
   - 格式：行号: 代码内容
   - 示例：
     ```
     1: package com.example;
     2: public class UserDao {
     3:     public User findById(Long id) {
     ```

3. 按红线规范检查代码

   所有问题都要基于真实场景判断，不要吹毛求疵：

   Critical（可能导致生产事故）：
   - SQL字符串拼接 → SQL_INJECTION
   - 硬编码密码/token → HARDCODED_SECRET
   - URL传递敏感参数 → SENSITIVE_DATA_IN_URL
   - HTML输出未编码 → XSS_RISK
   - DELETE/UPDATE无WHERE → MISSING_WHERE_CLAUSE
   - 非线程安全类并发使用 → THREAD_SAFETY
   - 事务中调用外部HTTP → TRANSACTION_WITH_HTTP
   - 同类内部调用事务方法 → TRANSACTION_SELF_INVOCATION
   - 直接调用可能为null的方法 → NPE_RISK
   - 空catch块 → EMPTY_CATCH

   Warning（有明显性能影响）：
   - 循环内单条查询/插入/更新/删除 → LOOP_DATABASE_OPERATION
   - Redis循环内单个命令 → LOOP_REDIS_COMMAND
   - 流未关闭 → RESOURCE_LEAK
   - ERROR无堆栈/入参 → INCOMPLETE_ERROR_LOG

   Info（代码规范）：
   - 魔法数字 → MAGIC_NUMBER
   - SELECT * → SELECT_ALL

4. 生成审查结果并保存到文件

   输出文件：ai-review-result.txt
   
   格式：type§severity§title§location§description§code§fix§flowchart
   
   字段说明：
   - type: 问题类型，如 SQL_INJECTION
   - severity: 1=Critical, 2=Warning, 3=Info
   - title: 问题标题
   - location: 文件位置，如 UserDao.java:45 或 UserDao.java:45-48
   - description: 问题描述
   - code: 相关代码，多行用 \n 分隔
   - fix: 修复建议，多行用 \n 分隔
   - flowchart: 可选，Mermaid流程图语法
   
   META行（可选首行）：META§文件数§总行数
   
   示例：
   ```
   META§5§1200
   SQL_INJECTION§1§SQL注入风险§UserDao.java:45§使用字符串拼接§String sql = "SELECT * FROM user WHERE id = " + userId;§使用预编译语句
   NPE_RISK§2§空指针风险§OrderService.java:30§未校验参数§order.getUser().getName()§添加null检查
   ```
   
   流程图示例（复杂逻辑问题时添加）：
   ```
   SQL_INJECTION§1§SQL注入风险§UserDao.java:45-48§使用字符串拼接§String sql = "..." + id;\nreturn jdbcTemplate.query(sql);§使用预编译语句§flowchart TD\n    A[用户输入] --> B[拼接SQL]\n    B --> C{检查}\n    C -->|危险| D[SQL注入]
   ```

5. 调用脚本生成HTML报告
   ```
   node e:\skills-project\openskills\code-review\scripts\generate-report-html.js --input=ai-review-result.txt --output=review-report.html
   ```

## 模式二：变更影响分析

### 触发条件
- 分析这次变更 / diff / 这次改动影响
- 调用链分析

### 执行流程

1. 收集Git变更
   ```
   node ./scripts/git-change-collector.js --source=<项目路径> --output=changes.json --mode=<all|last:N|diff>
   ```

2. 准备审查数据
   ```
   node ./scripts/prepare-for-ai.js --input=changes.json --output=review-data.json
   ```

3. 分析变更影响
   - 入口点: @RestController, @GetMapping, @PostMapping
   - 调用链: Controller → Service → Mapper → SQL/HTTP/RPC
   - 标记: [新增] [修改] [删除]

4. 预处理：为代码添加行号前缀

5. 按红线规范检查代码（同模式一）

6. 生成审查结果并保存到文件（同模式一）

7. 调用脚本生成HTML报告
   ```
   node e:\skills-project\openskills\code-review\scripts\generate-report-html.js --input=ai-review-result.txt --output=review-report.html
   ```

## 脚本清单
- git-change-collector.js: 收集Git变更
- prepare-for-ai.js: 准备审查数据
- generate-report-html.js: 生成HTML报告

## 错误处理
- 脚本执行失败时检查文件路径和参数
- 向用户报告错误信息并建议修复方案

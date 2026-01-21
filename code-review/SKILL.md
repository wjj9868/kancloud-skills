---
name: code-review
description: Enforce coding standards and review code for SQL, Java logging, IO performance, exception handling, null safety, and security. Use when writing backend Java code, reviewing code changes, performing code audits, or when the user asks to review, audit, validate, optimize, follow standards, or write code. Activates after code edits or code writing requests.
allowed-tools: Read, Grep, Glob, Edit
context: fork
---

# 代码规范（编码 + 审查）

**本规范同时适用于编码和审查场景：**
- **编码时**：编写代码必须遵循以下规范
- **审查时**：检查代码是否违反以下规范

## SQL规范

### 强制规则

1. 建表必须包含 id, create_time, update_time 三个字段
2. 禁止使用 SELECT *，必须指定具体字段
3. UPDATE 语句分隔符必须是逗号，不能写成 AND
4. DELETE/UPDATE 必须带 WHERE 子句
5. 禁止使用 ORDER BY RAND() 随机排序
6. 分页查询必须带 ORDER BY，除非业务明确不需要排序
7. InnoDB 引擎表必须设置主键

### 推荐规则

1. WHERE 条件字段禁止使用函数（包括类型转换函数）
2. 相同字段 OR 条件大于 3 个，使用 IN 代替
3. 不同字段 OR 条件大于 3 个，使用 UNION ALL 代替
4. 关联表数量控制在 2 个以内，超过则拆分子查询
5. 外连接统一使用 LEFT JOIN，避免 RIGHT JOIN
6. 表和字段建议指定字符集 utf8 或 utf8mb4
7. 索引命名规范：idx_字段、uk_字段、pk_表名

---

## Java日志规范

### 日志级别定义

ERROR - 系统故障/NPE/金额错误，必须包含异常堆栈、入参、描述
WARN - 预期风险/业务降级，必须包含原因和业务ID
INFO - 关键里程碑，使用 Key=Value 格式输出参数
DEBUG - 仅开发环境使用

### 红线规则（必须修复）

1. 禁止"挤牙膏"式打印：连续多行 log.info 打印同一对象的不同字段
2. ERROR 日志必须包含异常堆栈 e 参数
3. 禁止在 for/while 循环内打印 INFO 日志
4. 禁止使用 System.out.println
5. 禁止打印无意义的神秘代码如 "111111"、"Here" 等
6. 禁止打印完整报文、HTML 等大文本内容
7. 禁止在日志中直接打印密码、token 等敏感信息

### 标准格式

log.info("[Tag] Context | key1={}, key2={}", val1, val2);
log.error("[Tag] Failed | param={}, error={}", param, e);

Tag 命名规范：[QueryXxx] 查询类、[CreateXxx] 创建类、[BatchXxx] 批处理类、[JobXxx] 定时任务类

---

## 循环IO操作（红线）

### MySQL操作

1. 禁止在循环内执行单条查询（N+1 问题）
   反例：for (Long id : ids) { query("SELECT * WHERE id=?", id); }
   正例：query("SELECT * WHERE id IN (...)", ids);

2. 禁止在循环内逐条插入数据
   反例：for (User u : users) { insert(u); }
   正例：insertBatch(users);

3. 禁止在循环内逐条更新数据
   反例：for (User u : users) { update(u); }
   正例：updateBatch(users);

4. 禁止在循环内逐条删除数据
   反例：for (Long id : ids) { delete(id); }
   正例：deleteBatch(ids);

5. 大批量操作建议分批处理，每批 100-500 条
   for (int i = 0; i < list.size(); i += 500) {
       batch(list.subList(i, Math.min(i + 500, list.size())));
   }

### Redis操作

1. 禁止在循环内执行单个命令
   反例：for (String key : keys) { jedis.get(key); }
   正例：使用 Pipeline 批量执行命令

2. 禁止在循环内创建连接
   反例：for (String key : keys) { try (Jedis j = new Jedis("host")) { j.get(key); } }
   正例：使用连接池 JedisPool/LettucePool 复用连接

Pipeline 标准写法：
try (Pipeline p = jedis.pipelined()) {
    List<Response<String>> res = new ArrayList<>();
    for (String key : keys) res.add(p.get(key));
    p.sync();
    // 使用 res 中结果
}

### 通用IO规范

1. 资源必须释放：使用 try-with-resources 自动关闭
   try (Connection conn = dataSource.getConnection()) { }

2. 必须配置超时：连接超时、读取超时、命令执行超时

3. 事务粒度控制：大循环必须拆分事务，不能让事务包含整个大循环

---

## 异常处理

### 强制规则

1. 禁止吞掉异常：catch 块不能为空或只打印不处理
   反例：try { } catch (Exception e) { }
   正例：try { } catch (Exception e) { log.error("failed", e); throw new RuntimeException(e); }

2. 禁止 catch NullPointerException，应该使用防御性 null 检查
   反例：try { } catch (NullPointerException e) { }
   正例：if (obj != null) { obj.method(); }

3. finally 块不能抛出异常，否则会覆盖原异常
   反例：finally { file.close(); }
   正例：finally { closeQuietly(file); }

4. 避免泛化 catch：catch Exception 无法区分不同异常类型
   反例：catch (Exception e) { }
   正例：catch (SQLException e) { }

### 推荐规则

1. 异常需要文档化：方法使用 @throws 声明可能抛出的异常
2. 定义业务异常体系：自定义业务异常类，区分系统异常和业务异常
3. 保留异常链：throw new ServiceException("message", e) 保留原异常堆栈

---

## 空指针防范

### 强制规则

1. 禁止直接调用可能为 null 对象的方法
   反例：getUser().getName()
   正例：User u = getUser(); return u != null ? u.getName() : null;

2. 公共方法参数必须校验：禁止参数为 null 或空
   public void createUser(String name) {
       if (name == null || name.isEmpty()) throw new IllegalArgumentException("name不能为空");
   }

3. 集合查找结果可能为 null，需要处理
   反例：User u = map.get("key");
   正例：Optional.ofNullable(map.get("key")).orElse(null);

---

## 安全规范（红线）

### SQL注入防护

1. 禁止 SQL 语句字符串拼接
   反例：String sql = "SELECT * FROM user WHERE id = " + id;
   正例：String sql = "SELECT * FROM user WHERE id = ?"; query(sql, id);

2. 动态 ORDER BY 必须使用白名单校验
   反例：String sql = "SELECT * FROM user ORDER BY " + sortField;
   正例：Set<String> ALLOWED = Set.of("id", "name", "time"); if (!ALLOWED.contains(sortField)) throw ...;

### XSS防护

1. 输出到 HTML 前必须进行 HTML 编码
   反例：response.getWriter().print(userInput);
   正例：response.getWriter().print(encodeForHtml(userInput));

### 敏感信息保护

1. 禁止硬编码密码、密钥、token 等敏感信息
   反例：private static final String API_KEY = "sk-xxx";
   正例：使用配置中心或环境变量管理敏感信息

2. 禁止在 URL 中传递敏感参数（token、password 等）
   反例：redirect:/payment?token=xxx
   正例：使用 POST 请求或 Session/FlashAttribute 传递

---

## 审查输出格式

## 代码审查结果

### 通过
- 改动点描述

### 建议改进
- 文件:行号 问题描述 修正建议

### 红线（必须修复）
- 文件:行号 问题描述 修正方案

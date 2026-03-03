# 代码审查红线规范

## SQL 红线
- 建表必须有 id, create_time, update_time
- 禁止 SELECT *
- UPDATE 分隔符是逗号不是 AND
- DELETE/UPDATE 必须带 WHERE
- 禁止 ORDER BY RAND()
- 分页必须带 ORDER BY
- InnoDB 表必须有主键

## IO 红线
- 禁止循环内单条查询
- 禁止循环内逐条插入
- 禁止循环内逐条更新
- 禁止循环内逐条删除
- Redis 禁止循环内单个命令
- Redis 禁止循环内创建连接

## 异常处理红线
- 禁止空 catch 块
- 禁止 catch NullPointerException
- finally 不能抛异常
- 避免泛化 catch Exception

## 空指针红线
- 禁止直接调用可能为 null 的方法
- 公共方法参数必须校验
- 集合查找结果必须处理 null

## 安全红线
- 禁止 SQL 字符串拼接
- 动态 ORDER BY 必须白名单
- 输出 HTML 必须编码
- 禁止硬编码密码/token
- 禁止 URL 传递敏感参数

## 并发红线
- 禁止非线程安全类并发使用（如 SimpleDateFormat、HashMap）
- 禁止单例可变成员
- 双重检查锁定必须用 volatile

## 事务红线
- 禁止事务中调用外部 HTTP
- 禁止同类内部调用事务方法
- 禁止事务中吞异常

## 枚举规范
- 禁止枚举可变字段
- switch 枚举必须有 default

## 日志规范
- ERROR 必须包含异常堆栈、入参、描述
- WARN 必须包含原因和业务ID
- INFO 使用占位符输出参数

## 其他规范
- 禁止魔法数字
- 禁止硬编码配置
- 日期格式化必须线程安全
- 流必须关闭（使用 try-with-resources）

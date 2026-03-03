# 输出格式规范

## 行格式

每行一个问题，字段用 `§` 分隔：

```
type§severity§title§location§description§code§fix
```

severity: 1=critical, 2=warning, 3=info

### 示例

```
SQL_INJECTION§1§SQL注入风险§UserDao.java:45§使用字符串拼接§String sql = "SELECT * FROM user WHERE id = " + userId;§使用预编译语句
NPE_RISK§2§空指针风险§OrderService.java:30§未校验参数§order.getUser().getName()§添加null检查
MAGIC_NUMBER§3§魔法数字§Config.java:12§直接使用数字常量§if (status == 3)§使用常量定义
```

### 元数据行（可选首行）

```
META§文件数§总行数
```

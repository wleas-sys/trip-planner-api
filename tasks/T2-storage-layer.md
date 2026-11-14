# T2 · 存储层：把景点放进数据库

> **目标产出**：`store_places.py` —— 把 `places.json` 灌进 SQLite，之后能统计和搜索。
> **只用 Python 标准库**（`sqlite3` / `json` / `argparse` / `pathlib`），不装任何第三方包。
> **规模**：20–40 行（不含空行和注释）。
> **前置**：T1 已通过。

---

## 一、动手前先写这三行

```
1. 数据从哪来：
2. 循环判断做什么：
3. 输出什么：
```

---

## 二、背景：为什么要数据库

T1 每次运行都重新读一遍 JSON 文件。这在 82 条数据时没问题，但：

- 数据一旦要人工订正（比如把某个景点的票价改对），改 JSON 会被下次导出覆盖
- 没法做「模糊搜索」「聚合统计」这类操作
- 多个人同时用的时候，没有一个统一的写入口

**数据库就是那个统一的写入口。** 这一层做完，后面才有 API 的数据基础。

---

## 三、表结构（按这个建，不要自己发挥）

```sql
CREATE TABLE places (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    region   TEXT,
    area     TEXT,
    category TEXT,
    duration INTEGER,
    intro    TEXT
)
```

字段来自 `places.json` 里现成的字段。**只存这 7 个**，其他字段（地图坐标、图片、标签等）先不存——保持简单。

---

## 四、需求

`store_places.py` 提供以下能力：

| 参数 | 行为 |
|---|---|
| （不传） | 建表 + 把 JSON 灌进数据库，然后打印统计信息 |
| `--count` | 只输出库里的总条数 |
| `--by-area <区域>` | 输出该区域有多少条 |
| `--search <关键词>` | 在 `name` 和 `intro` 里做模糊匹配，输出命中的条目 |

**幂等是硬要求**：第一次运行写入 82 条，第二次运行**不能重复插入**，也不能报错。

---

## 五、验收标准（7 条全过才算完成）

1. 首次运行后，数据库文件出现在 `data/places.db`
2. 首次运行时输出类似 `已写入 82 条` 的信息
3. **再次运行时输出 `已存在 82 条，跳过`**，且库里仍然是 82 条（不是 164 条）
4. `--count` 输出 `82`
5. `--by-area hotSpring` 输出的数量，与 `data/meta.json` 里各区域的数量对得上
6. `--search 温泉` 能搜出 name 或 intro 里含「温泉」的条目
7. `data/places.db` **不能提交进 git**（加进 `.gitignore`）

---

## 六、可以看的参考资料

- `data/places.json` —— 字段名对照
- `data/meta.json` —— 各区域的预期数量，可用来验证你的统计对不对
- Python 官方文档 `sqlite3`：`https://docs.python.org/3/library/sqlite3.html`（重点看 `execute` / `executemany` / `commit`）
- 提示：`INSERT OR IGNORE` 配合 `id` 主键，天然就能做到幂等

---

## 七、卡点提示

| 类型 | 典型表现 |
|---|---|
| **启动卡** | 数据库文件路径不对、模块名写错（是 `sqlite3` 不是 `sqlite`）、忘了 `import` |
| **命名卡** | 表名或列名和上面不一致（`places` 写成 `place`）、参数名和实际读取的键对不上 |
| **结构卡** | `executemany` 传了 list 而不是 list of tuple、占位符数量不对、循环里没 `commit` |
| **收尾卡** | 忘了 `conn.close()`、忘了把 `db` 加进 `.gitignore`、重复插入没做处理 |

---

## 八、验收方式

```bash
python store_places.py
python store_places.py
python store_places.py --count
python store_places.py --by-area hotSpring
python store_places.py --search 温泉
```

第二条命令重复运行，输出必须显示"跳过"而不是再次写入。

---

## 九、完成后要留下的东西

- [ ] `store_places.py` 跑通 7 条验收
- [ ] `.gitignore` 已包含 `*.db`
- [ ] git commit
- [ ] 100 字以内的复盘

---

*T2 ｜ 完成后进入 `tasks/T3-service-layer.md`*

# T1 · 数据层：把 JSON 变成能筛选的列表

> **目标产出**：`explore_places.py` —— 一个命令行程序，能列出和筛选景点。
> **只用 Python 标准库**（json / argparse / pathlib），不装任何第三方包。
> **规模**：20–40 行（不含空行和注释）。

---

## 一、动手前先写这三行（写在你的笔记里，不要跳过）

```
1. 数据从哪来：
2. 循环判断做什么：
3. 输出什么：
```

写完再动手。

---

## 二、需求

`explore_places.py` 从 `data/places.json` 读取景点数据，提供以下能力：

| 命令行参数 | 含义 | 示例 |
|---|---|---|
| （不传） | 列出前 10 条 | `python explore_places.py` |
| `--area <区域>` | 只看某个区域 | `--area hotSpring` |
| `--category <分类>` | 只看某个分类 | `--category 温泉` |
| `--limit <条数>` | 限制输出条数 | `--limit 3` |
| `--help` | 显示帮助 | — |

**区域和分类可以组合使用**，两个条件是「与」的关系。

**输出格式**：每条景点一行，四列，用 ` | ` 分隔：

```
konglong | 河源恐龙博物馆 | 源城区 | 120
```

四列依次是：`id`、`name`、`region`、`duration`（分钟）。

---

## 三、验收标准（8 条全过才算完成）

1. 不带任何参数运行，输出**恰好 10 行**，每行 4 列且用 ` | ` 分隔
2. `--area hotSpring` 输出的每一行，`area` 字段都等于 `hotSpring`
3. `--category 温泉` 输出的每一行，`category` 字段都等于 `温泉`
4. `--area hotSpring --category 温泉` 两个条件同时生效（结果是上面两者的交集）
5. `--limit 3` 时输出不超过 3 行
6. 传入一个不存在的区域（例如 `--area 不存在的区域`）时，**程序给出明确提示**（例如"没有符合条件的景点"），而不是空白输出
7. `data/places.json` 不存在或内容不是合法 JSON 时，程序输出**可读的错误信息**（说清是哪个文件、什么原因），并以**非 0 退出码**结束
8. 文件总行数控制在 20–40 行（不含空行和注释行）

---

## 四、可以看的参考资料

- `data/places.json` 的前 30 行 —— 看清楚一条景点有哪些字段（`id` / `name` / `shortName` / `region` / `area` / `category` / `duration` / `intro` / `tags` / `map` / `sourceKeys` …）
- `data/meta.json` —— 看有哪些合法的 `area` 和 `category` 取值
- `python-foundations/week1/score_tool.py` —— 你自己写的，里面已经有 `argparse` 和 `json` 的用法可以参考

---

## 五、卡点提示

卡住了**只报类型**，不要贴报错截图：

| 类型 | 典型表现 |
|---|---|
| **启动卡** | 文件读不到、参数没解析出来、运行就报错退出 |
| **命名卡** | 变量名/字段名写错，比如把 `category` 写成 `catagory`，或者把 `places` 写成 `place` |
| **结构卡** | `for` / `if` 的缩进错、`elif` 漏写、`and` / `or` 用反了、列表推导式写不出来 |
| **收尾卡** | 循环里都算对了但最后没打印、忘了 `sys.exit(1)`、没处理空结果的情况 |

---

## 六、验收方式

跑完这一条，全部输出应该符合上面的格式：

```bash
python explore_places.py
python explore_places.py --area hotSpring
python explore_places.py --category 温泉 --limit 3
python explore_places.py --area 不存在的区域
```

---

## 七、完成后要留下的东西

- [ ] `explore_places.py` 能跑通 8 条验收
- [ ] git commit（提交信息写清楚做了什么，比如"feat: add place explorer with area and category filters"）
- [ ] README 加一节"怎么跑起来"
- [ ] 100 字以内的复盘：这次卡在哪、下次怎么避免

---

*T1 ｜ 完成后进入 `tasks/T2-storage-layer.md`*

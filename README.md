# trip-planner-api · 旅行规划后端服务

> **这是一个练习仓库，不是模板仓库。** 每个任务由你独立完成，我只给需求、验收标准和卡点提示。
> **动手前先写三行伪代码**（数据从哪来 / 循环判断做什么 / 输出什么），写完再动手。
> 卡住了只报类型：**启动卡 / 命名卡 / 结构卡 / 收尾卡**。

---

## 一、这个项目要解决什么问题

把河源小程序里那 82 个景点，变成一个**能被别的程序调用的后端服务**。

小程序的数据现在写死在前端 JS 里（`utils/data.js`，3926 行）。这意味着：

- 换一台设备、换一个小程序，都得各自带一份数据
- 小程序改一条票价，得发一次版
- 别的程序想用这份数据，只能去读那个 JS 文件

后端服务的价值是：**数据只存一份，谁需要谁通过接口来取。**

这个项目同时是你简历上的第三个项目，也是你 2027 年寒假实习期间能对外展示的东西。

---

## 二、为什么数据源是小程序

因为它已经存在，而且质量比随便找的公开数据集高：

| 事实 | 来源 |
|---|---|
| 82 个景点 / 11 条路线 / 36 个来源 | `data/meta.json`（由导出脚本生成） |
| 13 个区域（city / lake / hotSpring / longchuan / east / heping / south / lakeWest / northEast / lianping / jiangdong / zijin） | 同上 |
| 4 个分类（人文 / 山水 / 温泉 / 休闲） | 同上 |
| 每条景点含 24 个字段 | `data/places.json` |
| 数据来源可追溯 | `data/sources.json` 保留了 36 条来源的标题与 URL（含河源市政府门户、区县文旅局、景区官网） |
| 数据版本可追溯 | `data/meta.json` 的 `dataVersion` = 2026-10-28 |

**面试时这一条很值钱**：不是"我用了个数据集"，而是"我为自己的产品写了后端，数据沿用了我自己核验过来源的景点库，每条数据都能追溯到政府门户或景区官网"。

---

## 三、目录结构（你要建的部分）

```
trip-planner-api/
├── README.md                      ← 你在读的这个
├── .gitignore
├── data/
│   ├── places.json                ✅ 已生成（82 条）
│   ├── routes.json                ✅ 已生成（11 条）
│   ├── sources.json               ✅ 已生成（36 条）
│   ├── modes.json                 ✅ 已生成（3 条）
│   ├── meta.json                  ✅ 已生成
│   └── places.db                  ← T2 任务生成，不入库
├── scripts/
│   └── export-from-miniprogram.js ✅ 已提供（数据准备，不是练习）
├── tasks/
│   ├── T1-data-layer.md
│   ├── T2-storage-layer.md
│   └── T3-service-layer.md
├── explore_places.py              ← T1 你来写
├── store_places.py                ← T2 你来写
├── app/
│   ├── __init__.py
│   └── main.py                    ← T3 你来写
└── tests/
    └── test_api.py                ← T3 你来写
```

---

## 四、三个任务的依赖关系

```
T1 数据层（纯 Python 标准库）
  │  输出：能列出、能筛选景点
  ▼
T2 存储层（Python 标准库 sqlite3）
  │  输出：景点进了数据库，能查能统计
  ▼
T3 服务层（FastAPI + Pydantic + pytest）
     输出：HTTP 接口 + 自动化测试
```

**T1、T2 不需要装任何第三方包**，只用 Python 标准库。T3 才需要 FastAPI。

### 环境准备（T3 之前做）

```bash
cd trip-planner-api
python -m venv .venv
.venv/Scripts/activate          # Windows Git Bash
pip install fastapi uvicorn pytest httpx
```

> 你已有的 `python-foundations` 仓库里有一个可用的 `.venv`（Python 3.12.10）。可以复用那个解释器，也可以在这里新建一个——**但不要把 `.venv` 提交进仓库**。

---

## 五、里程碑总表

| 任务 | 产出 | 难度 | 预计用时 | 验收通过标准（全部满足才算过） |
|---|---|---|---|---|
| **T1** | `explore_places.py` | ★☆☆☆☆ | 60–90 分钟 | 8 条验收全过 |
| **T2** | `store_places.py` + `places.db` | ★★☆☆☆ | 90–120 分钟 | 7 条验收全过 |
| **T3** | `app/main.py` + `tests/test_api.py` | ★★★☆☆ | 3–4 小时 | 8 条验收全过 |

> **T1 到 T3 做完，你的简历上就能写**：
> "基于 FastAPI + SQLite/PostgreSQL 实现旅行数据服务，82 条景点数据可分页检索、按区域聚合，提供 RESTful API 与 pytest 自动化测试，CI 自动运行"

---

## 六、后续（不在本次三个任务内）

三个任务通过后，再按这个顺序继续：

1. **接 LLM**：用 `data/places.json` 做上下文，实现"给我 2 天温泉行程"的问答接口
2. **简易 RAG**：景点介绍切分 + 向量检索 + 引用来源
3. **Docker + CI**：容器化 + GitHub Actions 自动跑 pytest
4. **部署**：拿到一个公网链接（面试时"点开就能用"比任何描述都有力）

---

## 七、每个任务都必须留下的证据

按你原计划的证据标准，完成不等于"跑通了"，而是要留下能被别人验证的东西：

- [ ] 代码提交到 git，提交信息写清楚做了什么
- [ ] 每个任务至少 1 条 pytest 用例（T1/T2 可用简单的断言脚本）
- [ ] README 里补一节"怎么跑起来"，命令要能复制粘贴
- [ ] 至少一张运行结果截图（终端输出即可）
- [ ] 一段 100 字以内的复盘：这次卡在哪、下次怎么避免

---

## 八、贯穿全程的三条硬规则（来自你原计划）

1. **不粘贴无法解释的代码。** 每一行你都得能说出它在干什么。
2. **报错时先保存完整错误信息**，从 traceback 最后一行开始分析，再查资料或问 AI。
3. **每天至少提交一次项目代码。** 不要攒到周末。

---

*项目 v0.1 ｜ 2026-11-14 ｜ 数据来自 `heyuan-v2.2/utils/data.js`（DATA_VERSION 2026-10-28）*

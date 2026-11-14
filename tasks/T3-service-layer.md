# T3 · 服务层：把数据库变成 HTTP 接口

> **目标产出**：`app/main.py`（FastAPI 服务）+ `tests/test_api.py`（pytest 用例）
> **规模**：`app/main.py` 控制在 80–120 行；接口不超过 5 个（宁少勿滥）
> **为什么超出 20–40 行**：协议 §0.3 的「20–40 行」约束针对**单文件练习单元**；服务层需要框架装配 + 路由 + Pydantic 模型 + 错误处理，压不进 40 行。**替代约束**：接口数 ≤ 5、**单个接口函数 ≤ 20 行**；`tests/test_api.py` ≤ 60 行。
> **前置**：T1、T2 已通过

---

## 一、动手前先写这三行

```
1. 数据从哪来：
2. 循环判断做什么：
3. 输出什么：
```

---

## 二、背景：接口是给谁用的

T2 之后，数据在数据库里，但只有**运行脚本的人**能用它。接口的作用是：**让别人（小程序、另一个程序、面试官）也能用**。

一个好的接口设计原则：**先想清楚调用方需要什么，再决定暴露几个接口**。不要为了"看起来完整"而加接口。

这里调用方只有一类需求：**查景点**。所以接口只围绕查询设计。

---

## 三、环境准备

```bash
cd trip-planner-api
python -m venv .venv
.venv/Scripts/activate
pip install fastapi uvicorn pytest httpx
```

> `httpx` 是 FastAPI 的 `TestClient` 依赖，必须一起装，否则测试起不来。

---

## 四、接口需求（4 个，不要更多）

| 方法 | 路径 | 行为 | 响应 |
|---|---|---|---|
| GET | `/health` | 健康检查 | `{"status": "ok"}` |
| GET | `/places` | 分页列出景点 | `{"total": 82, "page": 1, "size": 20, "items": [...]}` |
| GET | `/places/{place_id}` | 单条详情 | 景点对象；**不存在时返回 404** |
| GET | `/areas` | 所有区域及各自数量 | `[{"area": "longchuan", "count": 12}, {"area": "hotSpring", "count": 3}, ...]` |

**查询参数**（`/places`）：
- `page`：默认 1，从 1 开始
- `size`：默认 20
- 可选 `area`、`category`：筛选

**排序**：`/places` 按 `duration` 升序（先给短时长的，符合行程规划的实际用法）。如果你想按别的字段排，改一处即可，但要在 README 里写明。

---

## 五、数据来源

T2 已经把数据写进 `data/places.db` 了。**T3 只读不写**——服务层不做数据维护，那是 T2 的职责。

> 如果 T3 启动时数据库不存在，是 T2 没跑。直接跑一次 `python store_places.py` 即可。

---

## 六、验收标准（8 条全过才算完成）

1. `uvicorn app.main:app --reload` 能启动，访问 `/health` 返回 `{"status":"ok"}`
2. `GET /places` 返回 `total` 为 82，`items` 的长度等于 `size`
3. `GET /places?page=2&size=10` 正确翻页，且返回的条目与第 1 页不重复
4. `GET /places/konglong` 返回河源恐龙博物馆，且字段完整
5. `GET /places/不存在` 返回 **404**（不是 500）
6. `GET /areas` 返回 **12** 个区域，每个带正确的 `count`。各区域真实数量如下（合计 82，与 `data/meta.json` 的 `areas` 列表一致）：

   | area | count | | area | count |
   |---|---|---|---|---|
   | longchuan | 12 | | city | 8 |
   | heping | 12 | | east | 8 |
   | zijin | 12 | | lianping | 8 |
   | jiangdong | 9 | | south | 6 |
   | hotSpring | 3 | | lake | 2 |
   | lakeWest | 1 | | northEast | 1 |
7. `pytest` 至少 2 个用例通过（建议覆盖：分页总数正确 + 404 行为正确）
8. `GET /places?area=hotSpring` 返回的条目，`area` 字段全是 `hotSpring`

---

## 七、可以看的参考资料

- FastAPI 官方教程：<https://fastapi.tiangolo.com/tutorial/first-steps/>
- Pydantic 模型定义：<https://docs.pydantic.dev/latest/concepts/models/>
- pytest 入门：<https://docs.pytest.org/en/stable/getting-started.html>
- FastAPI 的 `TestClient` 用法：<https://fastapi.tiangolo.com/tutorial/testing/>

---

## 八、卡点提示

| 类型 | 典型表现 |
|---|---|
| **启动卡** | `uvicorn` 找不到模块、导入路径错（`app.main:app` 的冒号写错）、`httpx` 没装导致测试报错 |
| **命名卡** | 路径参数名和函数参数名不一致（`place_id` vs `placeid`）、响应模型字段名和数据库列名对不上 |
| **结构卡** | 路由装饰器写在了函数里面、异步函数里用了同步的数据库调用导致卡死、`try/except` 包住了整个函数导致 404 变 500 |
| **收尾卡** | 忘了 `response_model`、忘了 `status_code=404`、异常没抛出导致返回 null 而不是 404 |

---

## 九、验收方式

```bash
# 启动服务（另开一个终端）
uvicorn app.main:app --reload

# 逐条检查
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/places?page=1&size=5
curl http://127.0.0.1:8000/places/konglong
curl -i http://127.0.0.1:8000/places/not-exist
curl http://127.0.0.1:8000/areas

# 跑测试
pytest -v
```

---

## 十、完成后要留下的东西

- [ ] `app/main.py` + `tests/test_api.py` 跑通 8 条验收
- [ ] `pytest -v` 输出全绿，**把输出截图存下来**（面试时用）
- [ ] README 补两节：**接口清单**（每个接口的路径、参数、示例响应）和**怎么跑起来**
- [ ] git commit
- [ ] 100 字以内的复盘

---

## 十一、三个任务全部完成后的下一步

按顺序做，每一步都是简历上的一句实话：

1. **接 LLM**：新增 `/recommend` 接口，用 `places.json` 做上下文，实现"帮我排 2 天温泉行程"
2. **加 RAG**：景点介绍切分 + 向量检索 + **回答里必须带引用来源**
3. **Docker + CI**：`docker-compose.yml`（app + postgres）+ GitHub Actions 自动跑 pytest
4. **部署**：拿到公网链接
5. **写一篇技术博客**：讲清楚"为什么 T1/T2 用标准库、T3 才引框架"——这是工程判断，不是炫技

---

*T3 ｜ 三个任务完成后，项目二（骨架版）完成，进入 2027.02 的项目二 v1.0 阶段*

> 修订：2026-11-14 修正区域数量（13→12）与 hotSpring 计数（12→3），依据 places.json 实测

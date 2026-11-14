# T4 · LLM 层：让模型开口，并让它用上你的工具

> **目标产出**：`llm_client.py`（T4-a 最小调用）+ `llm_tools.py`（T4-b 结构化输出与一个工具）
> **只用 `requests`**（`pip install requests`），**不许装任何 Agent 框架**。
> **规模**：**每个子任务控制在 20–40 行**（不含空行和注释）。T4-a 若写不进 40 行，说明它该被拆开；T4-b 建议拆成**工具文件**（20–40 行）+ **循环文件**（20–40 行）两个文件。
> **前置**：T1、T2 已通过（`data/places.db` 已存在）。**T3 未完成不影响 T4**，T4 不依赖 HTTP 层。

---

## 一、动手前先写这三行（写在你的笔记里，不要跳过）

```
1. 数据从哪来：
2. 循环判断做什么：
3. 输出什么：
```

写完再动手。**T4-a 和 T4-b 各写一次**，因为它们是两件不同的事。

---

## 二、背景：为什么从"调一次模型"开始，而不是从"搭 Agent"开始

你现在有 82 条自己核验过来源的景点数据、有 HTTP 接口、有 119 条测试用例。**但你从来没有让一个模型说过一句话。**

这是真的"零"。Phase 1 全量扫描三个仓库，`openai|anthropic|langchain|deepseek` 命中 0，`tool_call|function_call|agent_loop` 命中 0。你有的全部是**模型外面的东西**——数据层、存储层、服务层、测试体系。缺的是**模型里面**的东西。

所以第一刀不能是"Agent"。原因有三个，都很实在：

1. **Agent 是循环，循环里必然藏 bug。** 如果你连"一次请求能不能成功"都没验证过就开始写循环，失败时你分不清是 key 没配、endpoint 写错、JSON 解析炸了，还是循环逻辑有问题。**先用最小可复现的单元把不确定性压到最小。**
2. **你手上有评测底子，先用上。** 119 条用例 + 1,200 组覆盖诊断是你最大的优势。会评测的人学 Agent，比不会评测的人快得多——因为你能回答"它到底做对没有"，而不是"看起来还行"。T4-b 末尾的评测集要求就是为这件事准备的。
3. **不引框架。** 第一个 Agent 自己手写循环，这是行业共识。原因很实在：**框架会把"循环"藏起来，而你恰恰需要先看懂循环**。LangGraph 的图、LangChain 的 AgentExecutor，在你手写之前都只是黑盒；等你手写过一个 40 行的 `while` 循环，你再看框架，就知道它在替你做什么、以及它替你藏了什么风险。

> **本卡的硬约束**：`pip install requests`，**仅此而已**。不许 `langchain` / `langgraph` / `crewai` / `openai` SDK / `semantic-kernel`。
> 为什么连 `openai` SDK 也不用？DeepSeek 提供的是 **OpenAI 兼容端点**（`https://api.deepseek.com`），用 `requests` 直接打 HTTP，你能看清"请求体长什么样、响应体长什么样、错误码长什么样"。SDK 会替你封一层，等于放弃了这一层认知。**等你手写完 T4，再去用 SDK，那时你才知道 SDK 替你省了什么。**

---

## 三、T4-a · 最小 LLM 调用

### 3.1 环境准备

```bash
cd trip-planner-api
python -m venv .venv
.venv/Scripts/activate
pip install requests
```

> `python-foundations` 仓库里已有一个可用的 `.venv`（Python 3.12.10），可以复用。但**不要把 `.venv` 提交进仓库**（`.gitignore` 已包含）。

### 3.2 模型与端点（已核对官方文档，2026-11-14）

| 项 | 值 |
|---|---|
| Base URL（OpenAI 兼容） | `https://api.deepseek.com` |
| 模型名（日常够用） | `deepseek-flash` |
| 模型名（更强，贵） | `deepseek-v4-pro` |
| 聊天接口 | `POST {base_url}/chat/completions` |
| 请求头 | `Authorization: Bearer <你的 key>`、`Content-Type: application/json` |
| 工具调用 | 支持（`tools` 数组） |
| JSON 输出 | 支持（`response_format: {"type": "json_object"}`） |

**关键 API 事实（会让你少踩坑）**：

- **`response_format: {"type":"json_object"}` 模式下，如果模型输出无法被识别为 JSON，API 会把非 JSON 内容替换成空格（U+0020）**。结果就是 `content` 可能**全是空格**，`finish_reason` 却仍然是 `stop`。**你的代码必须处理"content 看起来是空的"这种情况**，不能只看 `finish_reason`。
- 用 JSON 模式时，**system 或 user 提示词里必须出现 "json" 这个词**，并且最好给一个示例格式，否则模型容易不按结构输出。
- `max_tokens` 要设得合理，否则 JSON 会被截断在半路（截断的 JSON 解析必然失败）。
- 官方还提供 `strict` 模式（`base_url` 换成 `https://api.deepseek.com/beta`，每个 function 加 `"strict": true`），能让模型严格遵守你的 schema。**T4-b 先不用它**——先学会在"不用 strict"的情况下自己兜住非法 JSON，这是面试官真正会问的。

### 3.3 拿 key（**只要 3 步，别跳过**）

1. 打开 DeepSeek 开放平台 `https://platform.deepseek.com`，用微信或支付宝注册并登录（国内直连，可充值，余额不过期）。
2. 进入「API Keys」页面，创建一个 key，**复制保存**。
3. 把 key 放进项目根目录的 `.env` 文件：

   ```
   DEEPSEEK_API_KEY=sk-REPLACE_ME
   ```

**三条铁律**：

- **`.env` 绝对不能提交进 git。** `trip-planner-api/.gitignore` 里已经有 `.env` 这一行（已存在，不用你加），但你要**自己确认一遍**。
- **key 绝对不能写进任何 `.py` 文件、任何 `.md` 文档、任何提交信息、任何截图。** 一旦提交进 git 历史，就算后来删掉也还在历史里。
- 读 key 用 `os.environ.get('DEEPSEEK_API_KEY')`。**不要 `pip install python-dotenv` 再引一堆包**——标准库 `os.environ` 就够了。如果你确实想用 `.env` 文件，先自己写一个 5 行的读取函数，或者用 `python-dotenv` 但要说清为什么。

### 3.4 `llm_client.py` 需求

| 能力 | 行为 |
|---|---|
| 读 key | 从环境变量 `DEEPSEEK_API_KEY` 读；**读不到时打印中文提示并以非 0 退出码结束** |
| 发请求 | 用 `requests.post` 打 `{base_url}/chat/completions`，带超时（建议 30 秒） |
| 重试 | 网络异常或 5xx 时**最多重试 2 次**；4xx（含 401 鉴权失败）**不重试**，直接报错 |
| 取结果 | 从 `choices[0].message.content` 取文本；**content 为空或全是空格时，按"空响应"处理** |
| 留痕 | 每次调用把 `时间 / 问题 / 模型回答 / token 用量` **追加**写入 `data/llm_calls.jsonl`（每行一个 JSON 对象） |

**jsonl 的行长什么样**（这是格式示例，不是代码）：

```json
{"ts": "2026-11-15T20:14:03", "model": "deepseek-flash", "question": "河源有哪些温泉景点？", "answer": "……", "prompt_tokens": 812, "completion_tokens": 96, "latency_ms": 1420}
```

**为什么要有 jsonl**：这是你**第一批 LLM 轨迹数据**。后面 L5 做评测集、成本统计、失败案例复盘，全靠它。**现在多写 10 行，后面省你 10 小时。**

### 3.5 T4-a 验收标准（8 条全过才算完成）

1. `DEEPSEEK_API_KEY` 未设置时运行，输出**一句中文提示**（说明"请在 .env 里配置 DEEPSEEK_API_KEY"），**不打印 Python 堆栈**，且退出码非 0
2. 正常配置后运行，能拿到模型返回的一段中文文本并打印出来
3. `data/llm_calls.jsonl` 被创建，且**每行都是一个合法 JSON 对象**，字段齐全
4. 连续运行 2 次，jsonl **追加**为 2 行（不是覆盖成 1 行）
5. 把 key 改成错误值时，程序给出**可读的鉴权失败提示**（如"API key 无效，请检查 DEEPSEEK_API_KEY"），而不是把 401 的原始响应糊在脸上
6. 请求设置了**显式超时**（源码里能看到 timeout 参数，不是默认值）
7. 网络异常时**最多重试 2 次**后放弃，且重试次数可从输出或 jsonl 里看出来
8. 文件中**不出现任何硬编码的 key 字面量**（`grep -n "sk-" llm_client.py` 应无输出）

---

## 四、T4-b · 结构化输出与一个工具

### 4.1 这一层到底要解决什么

T4-a 里，模型只能"说话"。你问它"河源有哪些温泉景点"，它可能说得很好，也可能**编一个不存在的景点**——因为它根本不知道你的 82 条数据长什么样，你也没给它查的途径。

**L2 的核心是：让模型用一套固定格式提出"我要调用某个工具、参数是什么"，然后由你的程序去执行工具、把真实结果回喂给模型。**

模型**只负责决策和措辞**，**数据永远来自你的数据库**。这条边界是整个 Agent 可靠性的地基。

### 4.2 工具定义（就一个，不要多）

**工具名**：`search_places`
**用途**：按关键词查景点，或按区域/分类列出景点。

工具参数的 JSON Schema 就这样（这是你**要传给 API 的 schema**，字段与类型照抄，描述可以自己写）：

```json
{
  "type": "object",
  "properties": {
    "place_id":  { "type": "string",  "description": "景点唯一 id，可为空" },
    "keyword":  { "type": "string",  "description": "景点名或介绍中的关键词，可为空" },
    "area":     { "type": "string",  "description": "区域标识，可为空" },
    "category": { "type": "string",  "description": "分类，可选值：人文/山水/温泉/休闲，可为空" },
    "limit":    { "type": "integer", "description": "返回条数上限，默认 5，最大 10" }
  },
  "required": ["place_id", "keyword", "area", "category", "limit"]
}
```

**合法 area 取值只有 12 个**（来自 `data/meta.json`，T3 已修正）：

```
city / east / heping / hotSpring / jiangdong / lake / lakeWest /
lianping / longchuan / northEast / south / zijin
```

**place_id 必须来自白名单校验**（这是硬要求，不是建议）：

`place_id` 是模型**自己生成**的字符串，**它完全可能编一个不存在的 id**（比如 `konglongmuseum`、`heping-hot-spring-01`）。所以：

- **白名单来源**：`data/places.json` 里那 82 个真实 id（**不要硬编码一份 id 列表**，从数据文件读，否则数据一变就过期）
- **校验时机**：**执行查询之前**校验，不是在拼 SQL 之后
- **不在白名单里怎么办**：按"查不到"处理 —— 返回 `found: 0` 的同一套结构，**不是报错，也不是当成空字符串继续查**
- **为什么这条这么重要**：`place_id` 直接进 SQL。如果不做白名单校验就拼进查询，模型编出来的 id 会变成查询条件；即使当前用参数化查询没有注入风险，**"模型编造 id 被静默当成合法查询"本身就是不可靠的行为**——它会让最终答案里出现一个数据库里根本没有的景点

> 合法 id 长什么样（真实样本）：`konglong`（河源恐龙博物馆）、`guifengta`、`wanlvhu`、`yequgou`、`huoshan`…… **小写拼音，无连字符无数字后缀。** 模型大概率会编 `konglong-museum` 或 `HePingHotSpring` 这类——**这正是要拦的**。

**注意**：区域**没有** `hotSpring` 之外的温泉相关 id，**温泉是一个 `category`（分类），不是 `area`（区域）**。`hotSpring` 这个 area 真实存在但**只有 3 条**。这是最容易搞混的地方——**先想清楚"温泉"是分类还是区域**。

**工具执行**：读 `data/places.db`（T2 建的库），用 `sqlite3` 查询，**不要重造数据层**。返回给模型的形如：

```json
{"found": 2, "items": [{"id": "yequgou", "name": "叶园温泉", "area": "heping", "duration": 120, "intro": "…"}]}
```

**查不到时返回**（不是空字符串、不是 null、不是编一个）：

```json
{"found": 0, "items": [], "note": "没有匹配的景点"}
```

### 4.3 工具调用循环（你要实现的那 30 行）

```
1. 把用户问题 + 工具定义发给模型
2. 模型返回 tool_calls → 你解析出工具名和参数
3. 你执行工具，拿到结果
4. 把结果以 role="tool" 的消息追加回对话
5. 再发给模型 → 模型输出最终自然语言答案
```

**必须实现的 4 个护栏**（这是这张卡真正的考点）：

| 护栏 | 具体要求 |
|---|---|
| **参数校验** | 模型给的参数可能不合法（如 `area="温泉"`、`limit=999`、`place_id="konglongmuseum"`）。**执行前校验**：area 不在 12 个合法值里就当作空；limit 夹到 1–10；category 不在 4 个分类里就当作空；**place_id 不在 82 个真实 id 白名单里就当作查不到** |
| **非法 JSON 降级** | `arguments` 解析失败时，**不能崩、不能把异常抛给用户**。确定的降级路径：捕获 → 记一条日志 → 重试 1 次（带上"上次参数不合法"的提示）→ 仍失败则**直接告诉用户"我没能理解要查什么"**并停止循环 |
| **调用次数上限** | 最多 **3 轮**工具调用。超过就停止，并明确告诉用户"已经查了 3 次仍未确定答案"。**这是防无限循环的关键** |
| **不许编造** | 工具返回 `found: 0` 时，最终答案**必须**包含"未找到"之类的说明，**不能**输出任何景点名。**这条要有自动化测试**（见 §4.6） |

### 4.4 关于"模型返回非法 JSON"

**先记住一个 DeepSeek 的行为**（§3.2 已提过，这里再强调一次，因为它直接影响你的降级逻辑）：

> `response_format: {"type":"json_object"}` 下，模型输出若无法识别为 JSON，API 会把非 JSON 部分**替换成空格**。于是 `content` 可能是**一串空格**，`finish_reason` 仍是 `stop`。

所以你的解析逻辑要能区分**三种"拿不到内容"**：

| 情况 | 现象 | 你的处理 |
|---|---|---|
| 空内容 | `content` 是 `""` | 空响应 → 走空响应分支 |
| 全空格 | `content` 是 `"    "` | **同样当空响应处理**（这是 DeepSeek 特有的坑） |
| 非法 JSON | `content` 有字但 `json.loads` 抛异常 | 走"非法 JSON 降级"分支 |

**这三种是不同分支，不要合并成一个 `if not content`。**

### 4.5 T4-b 验收标准（12 条全过才算完成）

1. `search_places` 工具能被模型正确调用（你在日志里能看到模型返回了 `tool_calls`，参数是你预期的）
2. 传入 `keyword="温泉"` 时，工具返回的 `found` **大于 0**，且返回的条目 `category` 全是 `温泉`
3. 传入一个**不存在**的关键词（如 `keyword="潜水艇"`），工具返回 `found: 0`，且 `items` 是空数组
4. 模型给出**非法 area**（如 `area="温泉"`）时，程序**不报错**，且工具按"area 为空"处理
5. 模型给出**超大 limit**（如 `limit=999`）时，实际返回条数 **≤ 10**
6. 模型给出**不存在的 place_id**（如 `place_id="konglongmuseum"`）时，工具返回 `found: 0`，且**不报错**；该 id 必须在执行查询**之前**被白名单拦下
7. 模型给出**真实存在的 place_id**（如 `place_id="konglong"`）时，工具返回 `found: 1` 且 `items[0].name` 为「河源恐龙博物馆」
8. 连续追问导致模型反复调工具时，程序在**第 3 轮后停止**，并输出明确的"已停止"提示
9. **"查不到就不编造"有自动化测试**：构造一个必然查不到的问题，断言最终输出里**不含任何景点名称**（可用 `data/places.json` 里的真实名字做反向断言）
10. 非法 JSON 有降级路径：能构造出一次解析失败，程序**不崩溃**，而是按"没能理解要查什么"处理
11. **整个流程最多 3 轮**调用，且程序里**能看出**这个上限是写死的常量（不是散落在各处）
12. 全流程有 **jsonl 留痕**：每一轮的工具名、参数、结果条数都被记录，能复盘"模型为什么这么查"

### 4.6 必须写的自动化测试（这是你强项的落点）

**至少 4 个 pytest 用例**，文件名 `tests/test_llm_tools.py`：

| 用例 | 断言 |
|---|---|
| 工具层：查温泉 | `found > 0`，且所有条目 `category == "温泉"` |
| 工具层：查不存在 | `found == 0`，`items == []` |
| **白名单层：伪造 place_id** | `place_id="konglongmuseum"` → `found == 0`，**不抛异常** |
| 护栏层：非法参数 | `area="温泉"` 不抛异常；`limit=999` 被夹到 ≤ 10 |

**再往上一层（可选，但强烈建议做）**：写一个**不依赖真实 API 的离线用例**——把模型返回的 JSON 字符串**预先写死**（比如一段故意少逗号的、或者一段带多余文本的），喂给你的解析函数，断言它走了降级分支。**这叫"mock 掉不确定的部分，只测你自己的逻辑"，正是你 `harness.cjs` 里那套思路的 Python 版本。**

---

## 五、没有 API key 怎么办（**先做这一步，不要卡住**）

**没有 key 不许跳过 T4-b 的循环部分。** 协议第 5 条是"卡住只报类型"——但"没 key"不是卡点，是环境问题。

**做法：先 mock 响应，把循环跑通；再换真 key。**

| 步骤 | 做什么 |
|---|---|
| 1 | 在 `llm_client.py` 里加一个开关：环境变量 `LLM_MOCK=1` 时**不真的发请求**，而是返回一段你手写的、**事先准备好的** JSON 字符串 |
| 2 | 用这 3 段固定样例驱动你的循环：① 一次正常 tool_call；② 一段非法 JSON；③ 连续 3 次 tool_call（测上限） |
| 3 | 循环跑通、护栏生效、测试能跑之后，再拿真 key 接上去 |

**这条路的价值**：你的循环逻辑和 API 可用性**解耦**了。面试时这句话很有分量——"**我把模型输出当成不可信输入来测，所以测试不依赖网络**"。这正是 `harness.cjs` 精神的直接迁移。

> 顺序建议：**先 mock 跑通 T4-b 的全部护栏 → 再申请 key → 换真 key 重跑**。这样 key 到手时，你的代码已经是对的，只是换了数据源。

---

## 六、评测集（T4 的隐藏主线，也是 L5 的起点）

T4 做完，**不要急着做 RAG**。先把这批评测问题固定下来——**它是你从"能跑"走向"能判断好坏"的分界线**。

**要求：在 `data/eval_questions.json` 里放至少 10 条评估问题**，格式：

```json
{"id": "E01", "question": "河源有哪些温泉景点？", "expect": "found_gt_0"}
```

**`expect` 的取值（先只用这 4 种，够用了）**：

| expect | 含义 | 判定方式 |
|---|---|---|
| `found_gt_0` | 必须查到至少 1 条 | 工具返回 `found > 0` |
| `found_eq_0` | 必须查不到 | 工具返回 `found == 0` |
| `contains_area` | 结果里必须包含某个区域 | 条目的 `area` 字段命中 |
| `no_fabrication` | 输出里不许出现任何景点名 | 用真实景点名做反向断言 |

**⚠️ 写预期的方式：写「显示 X 且不出现 Y」，不写「结果合理」。**

这是评测集能不能用的分水岭。**「结果合理」没法判定，等于没写。** 每条 `expect` 必须能翻译成一句**机器能执行的断言**：

| ❌ 不可接受 | ✅ 可判定 |
|---|---|
| "结果合理" | "输出包含『叶园温泉』，且不包含『热带温泉』" |
| "应该能查到温泉" | "工具返回 `found > 0`，且所有条目 `category == '温泉'`" |
| "不要瞎编" | "输出中不出现 `places.json` 里任何一个 `name`" |
| "回答得通" | "输出包含『未找到』四个字" |

**「不出现 Y」这一半最容易被漏掉，但它是关键。** 只断言"该出现什么"测不出编造——模型可以一边说对了一边多说了一句不存在的景点。

**10 条里必须包含至少 2 条 `found_eq_0` 的"应该查不到"的问题**（下表给了 3 条）——比如问一个河源根本没有的东西。**这几条是整份评测集里最重要的**：它们直接测"模型会不会编造"。**每条都要带 `no_fabrication` 断言**（不出现任何景点名）。

**参考问题（可改写，但数量和类型按这个来）**：

| id | 问题 | expect | 判定断言（写成这样） |
|---|---|---|---|
| E01 | 河源有哪些温泉景点？ | found_gt_0 | 找到 ≥1 条，且所有条目 `category == '温泉'` |
| E02 | 连平县有什么景点？ | contains_area=lianping | 找到 ≥1 条，且所有条目 `area == 'lianping'` |
| E03 | 河源市区适合亲子玩的景点有哪些？ | found_gt_0 | 找到 ≥1 条，且所有条目 `area == 'city'` |
| E04 | 万绿湖好玩吗？ | found_gt_0 | 找到 ≥1 条，且输出包含『万绿湖』 |
| E05 | 有没有钓鱼的地方？ | found_gt_0 | 找到 ≥1 条，或输出明确说未找到 |
| E06 | 河源有没有滑雪场？ | found_eq_0 + no_fabrication | `found == 0`，且输出**不含** `places.json` 里任何 `name` |
| E07 | 河源有哪个机场？ | found_eq_0 + no_fabrication | 同上 |
| E08 | 有没有紫色的温泉？ | found_eq_0 + no_fabrication | 同上 |
| E09 | 源城区有哪些人文景点？ | contains_area=city | 找到 ≥1 条，且所有条目 `area == 'city'` |
| E10 | 紫金县有什么值得去的地方？ | contains_area=zijin | 找到 ≥1 条，且所有条目 `area == 'zijin'` |

> E07「河源有哪个机场」考的是**模型会不会拿常识补**——河源确实有机场（但不在你的 82 条景点库里），所以模型很容易"贴心地"回答一个真实存在的机场名。**这正是要测的：工具查不到时，答案必须来自工具，而不是模型的记忆。**
> E08「紫色的温泉」考的是**模型会不会把"没找到"翻译成"温泉一般都不分颜色"**——这是另一种形式的编造（编造规律而不是编造实体），同样要拦住。

**完成标准**：写一个 `tests/test_eval_set.py`，跑一遍这 10 条（mock 模式即可），**输出一个通过率**，比如 `9/10`。**不要求 10/10**——跑出 8/10 然后知道差的那 2 条为什么差，**比硬凑 10/10 有价值得多**。

> **断言怎么写才不脆**：不要把 82 个景点名硬编码进测试文件——从 `data/places.json` 读出来做反向断言集合。**这样数据更新时测试不用改。**

---

## 七、可以看的参考资料

| 主题 | 链接 |
|---|---|
| DeepSeek 定价与模型列表（**先看这个**，确认端点与模型名） | `https://api-docs.deepseek.com/quick_start/pricing` |
| DeepSeek 工具调用（tool_calls 的请求/响应长什么样） | `https://api-docs.deepseek.com/guides/tool_calls` |
| DeepSeek JSON 输出（`response_format` 与"内容被替换成空格"的坑） | `https://api-docs.deepseek.com/guides/json_mode` |
| DeepSeek 迁移指南（旧模型名 `deepseek-chat` 已于 2026-07-24 下线，**别用**） | `https://api-docs.deepseek.com/` 首页 |
| `requests` 快速上手（重点看 `timeout` 与异常） | `https://requests.readthedocs.io/en/latest/user/quickstart/` |
| Python `sqlite3`（T2 已用过，这里查查询写法） | `https://docs.python.org/3/library/sqlite3.html` |
| pytest 断言与参数化 | `https://docs.pytest.org/en/stable/how-to/asserts.html` |

**看资料的顺序**：先读 DeepSeek 官方的 **tool_calls** 页，把"请求体长什么样、响应体长什么样"抄在笔记上，再动手写。**不要先看第三方教程**——第三方教程的端点、模型名、参数经常是旧的。

---

## 八、卡点提示

卡住了**只报类型**，不要贴报错截图：

| 类型 | 典型表现 |
|---|---|
| **启动卡** | `ModuleNotFoundError: No module named 'requests'`（虚拟环境没激活 / 没装）、`.env` 没被读到（key 取到空字符串）、`ConnectionError` / 请求超时、401 鉴权失败却看不懂 |
| **命名卡** | `response_format` 写成 `responseForm`（DeepSeek 用**下划线**，和 OpenAI SDK 的驼峰不一样）、`tool_calls` 取成 `toolCalls`、`choices` 取成 `choice`、`arguments` 是字符串要 `json.loads` 一次 |
| **结构卡** | 忘记把模型返回的 `message` **整个**追加回 `messages`（不追加模型就"失忆"）、`role="tool"` 的消息缺 `tool_call_id`、工具结果没放进 `content`、循环里 `messages` 越攒越长没上限 |
| **收尾卡** | jsonl 没 `flush` 或没用追加模式、异常直接抛出没捕获、无限循环没上限、key 写进了代码里、`content` 全是空格没当空响应处理 |

---

## 九、验收方式

```bash
# 0) 准备
cd trip-planner-api
python -m venv .venv
.venv/Scripts/activate
pip install requests

# 1) 确认 key 没被提交
git check-ignore -v .env && echo ".env 已被忽略 ✔"
grep -rn "sk-" *.py 2>/dev/null && echo "⚠ 代码里有 key，检查！" || echo "代码里没有 key ✔"

# 2) T4-a：无 key 时的报错
env -u DEEPSEEK_API_KEY python llm_client.py
#    期望：一句中文提示 + 非 0 退出码，没有堆栈

# 3) T4-a：正常调用（先 mock 跑通，再用真 key）
LLM_MOCK=1 python llm_client.py
python llm_client.py

# 4) 看留痕
cat data/llm_calls.jsonl

# 5) T4-b：跑护栏与评测
pytest -v tests/test_llm_tools.py tests/test_eval_set.py
```

**验收的关键命令是最后一条 pytest**——它同时验证工具层、护栏层和评测集。**输出全绿才算完成。**

---

## 十、完成后要留下的东西

- [ ] `llm_client.py` 跑通 T4-a 的 8 条验收
- [ ] `llm_tools.py` 跑通 T4-b 的 12 条验收
- [ ] `tests/test_llm_tools.py` ≥ 4 个用例通过（工具层 2 + 白名单 1 + 护栏 1）
- [ ] `data/eval_questions.json` ≥ 10 条，其中 ≥ 2 条 `found_eq_0`
- [ ] `tests/test_eval_set.py` 跑出通过率（如 `9/10`）并**把输出留在 README**
- [ ] `data/llm_calls.jsonl` 里有真实调用记录
- [ ] **`.env` 没进 git**（`git check-ignore -v .env` 有输出）
- [ ] **代码与文档里没有任何 key 字面量**（`grep -rn "sk-" .` 无输出）
- [ ] README 补一节：**"怎么跑起来"** + **"成本"**（跑一次大约花多少钱）
- [ ] git commit
- [ ] 100 字以内的复盘

---

## 十一、成本说明（写进 README 那一节的内容）

**DeepSeek 按 token 计费，官方价目（2026-11-14 核对）**：

| 模型 | 1M 输入（缓存未命中） | 1M 输出 |
|---|---|---|
| `deepseek-flash` | $0.15（谷）/ $0.30（峰） | $0.60（谷）/ $1.20（峰） |
| `deepseek-v4-pro` | $0.66（谷）/ $1.32（峰） | $1.98（谷）/ $3.96（峰） |

> 峰谷时段按 UTC 01:00–04:00、06:00–10:00 为高峰（北京时间 09:00–12:00、14:00–18:00），其余（含周末）按谷时价。

**算给你看**（用 `deepseek-flash`，一次调用大约：输入 800 token + 输出 200 token）：

- 单次成本 ≈ 800/1e6 × $0.30 + 200/1e6 × $1.20 ≈ **$0.0005**（峰值，约 0.004 元）
- **一天 50 次调用 ≈ 0.17 元**；**一个月（按 600 次）≈ 2.0 元**

**结论：学习期 API 成本可以忽略，但 key 必须先注册。** 真正的成本不是钱，是**你的时间和注意力**——所以别把时间花在"反复调 prompt 刷效果"上，**花在写评测集上**。

> 如果你之后想用别的模型，先在 DeepSeek 官网核对当期价目（官方明确写了"价格可能调整"）。**不要写死在代码里**，从环境变量读。

---

## 十二、T4 完成后，下一步是什么

**按顺序做，每一步都是简历上的一句实话**：

| 顺序 | 做什么 | 对应哪一层 |
|---|---|---|
| 1 | **T5 · Agent 循环**：把 T4-b 的 3 轮循环扩展成通用循环（可配步数、工具可插拔），加**会话状态持久化** | L3 |
| 2 | **T6 · RAG**：景点介绍切分 + 向量检索 + **回答必须带引用来源** | L4 |
| 3 | **T7 · 评测集扩充**：把 10 条扩到 **30 条以上**，覆盖更多边界；接进 CI | L5 |
| 4 | **T8 · 部署与成本观测**：Docker + 公网链接 + **每次调用的 token 与成本记录** | L6 |

**为什么先循环后 RAG**：RAG 是"检索质量"问题，Agent 是"编排"问题。**编排不稳，检索再好也没用**——因为模型可能压根不调你的检索工具。

**框架什么时候学**：**T5 到 T8 全做完再考虑。** 顺序是：手写循环 → 理解框架在替你做什么 → 再用框架重写一遍。**反过来学，你会永远说不清"这个 bug 是我的循环错了还是框架的坑"。**

---

*T4 ｜ 完成后进入 `tasks/T5-agent-loop.md`（待建）*

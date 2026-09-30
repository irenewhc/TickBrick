# Vibe Coding 規範

## 目的

本專案採用：

> **Grill → Understand → Propose → Approve → Code**

的 Vibe Coding 流程。

核心原則：

> **先理解，再提案；先取得明確批准，再修改程式。**

Coding Agent 不應因為「覺得自己已經懂了」就直接修改程式。

---

# 1. 完整工作流程

每次收到新的功能需求、修改需求或重構需求時，依序執行：

1. 閱讀與需求相關的專案程式碼、架構、設定與既有行為
2. 閱讀本文件
3. 進入 Grill-Me 階段
4. 逐輪釐清需求與產品決策
5. 確認對使用者邏輯的理解
6. 提出具體修改方案
7. 等待使用者明確批准
8. 才可以修改程式
9. 執行適當的測試與驗證
10. 回報修改內容、理由與驗證結果

**未經明確批准，不得進入第 8 步。**

---

# 2. Grill-Me 階段

Grill-Me 是需求釐清流程。

## 2.1 Stateless

Grill 階段：

- 不修改程式
- 不建立 workspace
- 不建立或修改專案檔案
- 不執行會改變專案狀態的操作
- 所有討論都留在目前的 conversation

可以閱讀現有程式碼來理解系統，但不能因為閱讀而順手修改。

---

# 3. Round-by-Round Frontier

Grill 必須分成明確的 rounds。

每一輪只問目前「frontier」上的問題：

> 只有當回答所需的前置決策已經被使用者確認後，才能提出該問題。

不要跳過產品決策的依賴關係。

## 不應該這樣做

一次問：

- 要不要登入？
- Database 用什麼？
- React 還是 Vue？
- UI 要不要動畫？
- API 怎麼設計？

因為後面的技術問題可能依賴前面的產品決策。

## 應該這樣做

先確認產品目的與核心行為。

等答案確定後，再進入下一個決策 frontier。

---

# 4. Grill 問題格式

每一輪的問題必須使用以下格式：

### ❓ 1. 問題標題

問題內容。

➡️ 建議答案：具體說明你認為合理的選擇，以及為什麼。

### ❓ 2. 問題標題

問題內容。

➡️ 建議答案：具體說明建議與 trade-off。

---

# 5. 不可以被動接受模糊答案

Grill 的目的不是讓使用者快速說「都可以」。

如果使用者：

- 回答過於模糊
- 說「你決定就好」
- 想跳過重要產品決策
- 沒有說清楚 trade-off
- 提出互相衝突的需求

Coding Agent 必須 push back。

應該指出：

1. 哪個地方還不夠明確
2. 為什麼這個決策會影響後續實作
3. 可選方案
4. 每個方案的 trade-off
5. 自己推薦的方案

然後要求使用者做實際決策。

不要為了讓流程快速結束而盲目同意。

---

# 6. 建議答案不是替使用者做決定

每個 Grill 問題都應提供：

`➡️ 建議答案`

但建議答案只是 recommendation，不代表使用者已經同意。

使用者仍然必須確認。

Coding Agent 不得把：

> 「我建議 A」

當成：

> 「使用者選擇 A」。

---

# 7. Ungrillable Detection

有些問題無法透過文字訪談可靠決定。

例如：

- UI look & feel
- 精確視覺比例
- 動畫手感
- 精確 page layout
- 某些 interaction 的實際體驗

如果問題屬於這種 ungrillable 情況：

> **停止 grilling，改用 prototype 驗證。**

不要透過無限追問來假裝可以從文字得到答案。

原則：

> 能透過決策討論釐清的 → Grill  
> 必須實際看到 / 操作才能判斷的 → Prototype

---

# 8. Coding 前必須讀現有程式

在提出修改方案之前，先閱讀與需求相關的：

- components
- pages
- hooks
- services
- API
- state management
- database schema
- configuration
- tests
- 相關 documentation

目的是確認：

> 「使用者描述的需求」與「目前系統實際的行為」是否一致。

不要只根據使用者的一句描述猜測架構。

---

# 9. Understanding Check

Grill 完成後，不要直接開始 coding。

先向使用者確認目前理解。

建議格式：

## 我目前的理解

- ...
- ...
- ...

## 不會改變的部分

- ...
- ...

## 需要修改的部分

- ...
- ...

如果這裡有任何誤解，先修正理解，不要開始 coding。

---

# 10. Modification Proposal

理解確認後，提出具體 implementation plan。

至少包含：

### 修改目標

這次要解決什麼問題。

### 實作方式

說明預計如何實作。

### 修改範圍

列出預計會修改的：

- files
- components
- services
- APIs
- database
- tests

### 不修改的範圍

明確說明哪些現有功能不會碰。

### Trade-offs

如果存在不同實作方式，說明：

- Option A
- Option B
- 各自的優缺點
- 建議採用哪一個

---

# 11. Approval Gate

這是本規範最重要的規則。

在使用者明確批准之前：

> **不得修改程式。**

以下都不算明確批准：

- 「嗯」
- 「應該可以」
- 「看起來不錯」
- 「你覺得呢」
- 「好像可以」
- 沒有回覆

需要的是清楚的 approval，例如：

- 「可以，照這個做」
- 「OK，開始改」
- 「批准」
- 「就用這個方案」

如果使用者修改方案，必須更新 proposal，重新取得批准。

---

# 12. Coding 階段

只有 Approval Gate 通過後，才能開始修改。

修改時：

1. 優先採用現有 architecture
2. 不做未批准的額外產品決策
3. 不順手加入無關功能
4. 不進行 scope creep
5. 如果實作過程中發現原方案無法成立，停止並回到討論，不要自行改產品方向

---

# 13. 發現新問題時

如果 coding 過程中發現：

- 原需求存在矛盾
- 現有 architecture 無法支援
- 需要新增未討論的功能
- 需要改 database schema
- 需要改 API contract
- 有重大 security / performance trade-off
- 原本假設與實際 code 不一致

不要自行做重大決策。

應該：

1. 停止相關修改
2. 說明發現的問題
3. 說明影響
4. 提出選項
5. 給出建議
6. 等待使用者決定

---

# 14. Testing & Verification

完成修改後，執行與此次修改相關的驗證。

例如：

- unit tests
- integration tests
- type checking
- lint
- build
- existing test suite
- 手動驗證

最後回報：

### 修改了什麼

簡潔列出實際修改。

### 為什麼這樣改

對應到已批准的 plan。

### 驗證結果

列出執行過的測試與結果。

### 未解決事項

如果有任何限制、warning 或未驗證項目，要明確說明。

---

# 15. Scope Control

除非使用者批准，不要：

- 順便重構無關 code
- 順便換 framework
- 順便升級 dependency
- 順便改 UI
- 順便改善其他功能
- 順便修 unrelated bugs

如果發現值得做但不屬於目前 scope 的事情：

> 記錄為 follow-up suggestion，而不是直接修改。

---

# 16. 核心工作模式

所有 Vibe Coding 任務遵循：

```text
USER IDEA
   ↓
READ EXISTING CODE
   ↓
GRILL-ME
   ↓
ROUND 1
   ↓
USER ANSWER
   ↓
ROUND 2
   ↓
USER ANSWER
   ↓
...
   ↓
SHARP PLAN
   ↓
UNDERSTANDING CHECK
   ↓
MODIFICATION PROPOSAL
   ↓
USER APPROVAL
   ↓
CODE
   ↓
TEST
   ↓
REPORT
```

最重要的規則：

> **No approval, no code changes.**
>
> **沒有明確批准，就不能修改程式碼。**

---

# 17. 行為優先順序

當不同需求互相衝突時，遵循以下優先順序：

1. 使用者明確確認的決策
2. 本專案既有 architecture 與 conventions
3. 本文件的 Vibe Coding 流程
4. Coding Agent 的 implementation preference

不要用自己的 implementation preference 覆蓋使用者已確認的產品決策。

---

# 18. 快速 Checklist

開始任何 Vibe Coding 任務前：

- [ ] 已讀取相關 code
- [ ] 已了解現有 architecture
- [ ] 已進入 Grill-Me
- [ ] 問題按照 frontier 分輪
- [ ] 每個問題都有 `➡️ 建議答案`
- [ ] 沒有跳過前置決策
- [ ] 對模糊答案進行 push back
- [ ] 已識別 ungrillable 問題
- [ ] 已確認對使用者邏輯的理解
- [ ] 已提出 modification proposal
- [ ] 已取得使用者明確 approval

開始修改後：

- [ ] 沒有加入未批准的 scope
- [ ] 發現重大新決策時先停下來
- [ ] 已執行適當測試
- [ ] 已回報修改與驗證結果

# Pixel Quest - 生成式 AI 測驗遊戲

這是一個結合 React + Vite 與 Google Sheets/Apps Script 的復古像素風答題遊戲。
遊戲會隨機從 Google Sheets 讀取題庫，玩家完成測驗後，系統會自動在雲端試算表進行批改，並將成績紀錄儲存下來。

---

## 🚀 本地端安裝與啟動

1. **安裝依賴套件與啟動**
   在專案根目錄下開啟終端機，執行：
   ```bash
   npm install
   npm run dev
   ```

2. **設定環境變數**
   在專案根目錄找到 `.env` 檔案，填寫對應的設定值：
   ```env
   VITE_GOOGLE_APP_SCRIPT_URL=你的_GAS_部署網址
   VITE_PASS_THRESHOLD=3
   VITE_QUESTION_COUNT=5
   ```

---

## 📊 Google Sheets 建立與設定

1. 前往 [Google Sheets](https://sheets.google.com) 建立一個新的試算表。
2. 在左下方**建立兩個工作表 (Tabs)**，並精準命名為：
   - `Questions` (題庫)
   - `Answers` (作答紀錄)
3. 在 `Questions` 工作表的第一行 (Row 1) 建立以下爛位標頭：
   `ID`, `Text`, `A`, `B`, `C`, `D`, `Answer`
4. 在 `Answers` 工作表的第一行 (Row 1) 建立以下欄位標頭：
   `Timestamp`, `UserID`, `Score`, `Passed`, `Details`

### 測試題庫（主題：生成式AI基礎知識）
請直接將以下表格內容全選複製，然後在 `Questions` 工作表點擊 **A1 儲存格** 貼上（即可一併貼上標題與 10 題內容）：

| ID | Text | A | B | C | D | Answer |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Q01 | 生成式 AI 主要基於哪一種核心技術？ | 深度學習 (Deep Learning) | 區塊鏈 (Blockchain) | 關聯式資料庫 | 決定論演算法 | A |
| Q02 | 什麼是 Prompt (提示詞)？ | AI 產生的錯誤訊息 | 指導 AI 產出內容的輸入指令 | 電腦硬體設備 | 資料加密技術 | B |
| Q03 | 下列哪一個是常見的大型語言模型 (LLM)？ | GPT-4 | Photoshop | Excel | MySQL | A |
| Q04 | ChatGPT 中的 "T" 代表什麼？ | Transfer (轉移) | Transformer (變換器) | Text (文字) | Technology (科技) | B |
| Q05 | 什麼是「幻覺 (Hallucination)」在 AI 領域的定義？ | AI 產生逼真但錯誤或毫無根據的資訊 | AI 因硬體過熱而損壞 | 螢幕顯示出現雜訊 | AI 產生自我意識 | A |
| Q06 | 下列哪項不屬於生成式 AI 常見的應用範圍？ | 自動撰寫程式碼 | 自動繪製圖片 | 即時修理實體硬體損壞 | 文章總結與翻譯 | C |
| Q07 | 何謂 RAG (檢索增強生成)？ | 一種硬體加速技術 | 結合外部知識庫搜尋來強化 AI 回答準確性 | 減少 AI 耗電的方法 | 一種圖像壓縮格式 | B |
| Q08 | 在生成式圖像 AI (如 Midjourney) 中，最常使用的底層模型架構為何？ | 擴散模型 (Diffusion Models) | 決策樹 (Decision Trees) | 線性迴歸 | 隨機森林 | A |
| Q09 | 如果發現 AI 給出的答案不符合需求，最有效的改進方式是？ | 重新開機 | 提供更具體、包含背景資訊的 Prompt | 升級電腦記憶體 | 使用更快的網路連線 | B |
| Q10 | AI 生成的內容目前在多數國家的著作權判定整體趨勢是認為？ | 完全歸屬於開發 AI 的公司 | 通常人類必須有實質的創意貢獻才能享有版權 | 只要生成出來就完全受版權保護 | 版權永久屬於使用者硬體製造商 | B |

---

## ⚙️ Google Apps Script (GAS) 部署教學

1. 在剛剛建立好的 Google Sheets 畫面中，點擊上方選單的 **「擴充功能」 -> 「Apps Script」**。
2. 將編輯器內原本的 `function myFunction() {}` 程式碼清空，並貼上以下程式碼：

```javascript
function doGet(e) {
  const count = parseInt(e.parameter.count) || 5;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Questions");
  const data = sheet.getDataRange().getValues();
  
  let questions = [];
  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    if (!row[0]) continue; // 略過空白列
    questions.push({
      id: row[0],
      text: row[1],
      options: { A: row[2], B: row[3], C: row[4], D: row[5] },
      answer: row[6]
    });
  }
  
  // 隨機打亂並取前 count 題
  questions.sort(() => Math.random() - 0.5);
  const selectedQuestions = questions.slice(0, count);
  
  // 回傳給前端時拔除正解，避免作弊
  const clientData = selectedQuestions.map(q => ({
    id: q.id,
    text: q.text,
    options: q.options
  }));
  
  return ContentService.createTextOutput(JSON.stringify(clientData))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const userId = payload.id;
  const userAnswers = payload.answers; // 格式如 { "Q01": "A", "Q02": "B" }
  const passThreshold = payload.passThreshold || 3;
  
  // 取得解答字典
  const qSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Questions");
  const qData = qSheet.getDataRange().getValues();
  let answerKey = {};
  for (let i = 1; i < qData.length; i++) {
    answerKey[qData[i][0]] = qData[i][6];
  }
  
  // 批次對比答案並計算分數
  let score = 0;
  for (let qId in userAnswers) {
    if (userAnswers[qId] === answerKey[qId]) {
      score++;
    }
  }
  
  const passed = score >= passThreshold;
  
  // 寫入 Answers 紀錄表
  const aSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Answers");
  aSheet.appendRow([
    new Date(),
    userId,
    score,
    passed ? "Pass" : "Fail",
    JSON.stringify(userAnswers)
  ]);
  
  // 回傳最終結果給前端
  return ContentService.createTextOutput(JSON.stringify({ score: score, passed: passed }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. 點擊上方的 **「儲存」** 圖示或按下 `Ctrl+S` (Cmd+S)。
4. 點擊介面右上角的 **「部署」 -> 「新增部署作業」**。
5. 點選左側的「齒輪 ⚙️」圖示，選擇 **「網頁應用程式」 (Web app)**。
6. 設定存取權限：
   - 新增說明：`Version 1` (可自訂)
   - 執行身分：`我`
   - 誰可以存取：**`所有人` (Anyone)** <- 這個一定要設定，否則遊戲無法跨域讀取！
7. 點擊 **「部署」** (首次部署會跳出畫面要求授權 Google 帳號存取資料，請前往「進階」並點擊「允許」)。
8. 部署完成後，複製畫面上顯示的 **「網頁應用程式網址」 (Web App URL)**。
9. 將該網址貼回本地端專案的 `.env` 檔案內，將 `VITE_GOOGLE_APP_SCRIPT_URL=` 後面的預設值覆蓋掉，重新啟動就可以開始遊玩了！

---

## 🌩️ 自動部署到 GitHub Pages

專案已經包含了 GitHub Actions 設定檔：`.github/workflows/deploy.yml`。

### 部署步驟

1. 將專案推送到 GitHub。
2. 配置 Repository **Variables**:
   - 進入 GitHub 專案的 `Settings` -> `Secrets and variables` -> `Actions` -> **Variables**（也可以放 Secrets，但網址通常放 Variables 即可）。
   - 點擊 `New repository variable`，並且新增以下變數（同 `.env.example`）：
     - **`VITE_GOOGLE_APP_SCRIPT_URL`**: 你的 GAS 網址（必要）
     - **`VITE_PASS_THRESHOLD`**: 及格分數（選填，預設為 `3`）
     - **`VITE_QUESTION_COUNT`**: 隨機抽題數（選填，預設為 `5`）
3. 開啟 **GitHub Pages** 設定：
   - 進入 `Settings` -> `Pages`，找到 `Build and deployment`。
   - 將 **Source** 改為 **GitHub Actions**。
4. 設定完成後，GitHub 會自動觸發第一次的部署（或自行至 `Actions` 頁籤手動觸發 `Deploy to GitHub Pages`）。
5. 部署成功後即可取得你的 GitHub Pages 遊玩網址。

*(備註：如果你的 GitHub Pages 網址帶有子路徑（例如 `https://username.github.io/pixel-game/`），你可能需要在專案的 `vite.config.js/ts` 中加入 `base: '/pixel-game/'` 才能正確載入資源。)*


const item = $input.item.json;
const messageText = (item.messageText || '').trim();
const replyToken = item.replyToken;
const displayName = item.firstName || '';
const lineUserId = item.lineUserId || '';

const staticData = $getWorkflowStaticData('global');
if (!staticData.users) staticData.users = {};
const userData = staticData.users[lineUserId] || {};
const userState = userData.state || 'new';

let messages = [];
let ghlAction = 'none';
let needsAI = false;
let nextState = userState;
let program = '';
let aiBody = null;

function textMsg(text) { return [{ type: 'text', text }]; }
function buttons(text, btns) {
  return [{
    type: 'template',
    altText: text.substring(0, 40),
    template: { type: 'buttons', text, actions: btns.map(b => ({ type: 'message', label: b, text: b })) }
  }];
}
function welcomeMsg() {
  return buttons('你好！歡迎來到 HASSE 太空學校 🚀\n請問你是？', ['🎓 校友', '🙋 了解課程', '💬 我要問問題']);
}
function askAgeMsg() {
  return buttons('我先確認一下孩子的年級，這樣可以給你最準確的資訊 😊\n\n請問目前是？', ['🎓 高中 / 大學', '📚 小五～國九', '📒 小四以下']);
}

function detectProgram(text) {
  // 小學1-4年級 / 低年級 → 科學探索營
  if (/小[學学][一二三四1-4]|[一二三四1-4]年[級级紀纪]|幼稚園|幼兒園|學齡前|7歲|8歲|9歲|10歲/.test(text)) return '科學探索營';
  // 小學5-6年級 / 國中 → JSS
  if (/小[學学][五六5-6]|[五六5-6]年[級级紀纪]|國中|初中|國[一二三七八九]|11歲|12歲|13歲|14歲|7年級|8年級|9年級/.test(text)) return 'JSS';
  // 高中 / 大學 → HSS
  if (/高中|高[一二三]|大[學学]|大[一二三四]|高職|高[1-3]|15歲|16歲|17歲|18歲|19歲|20歲|10年級|11年級|12年級|研究所|碩士/.test(text)) return 'HSS';
  return '';
}

function buildAIBody(text, prog) {
  const systemPrompt = '你是 HASSE 太空學校的 LINE 客服助手。用繁體中文、友善親切的語氣回答。回答簡短（不超過150字），適合手機聊天。\n\n=== 鐵律（最高優先）===\n1. 回答問題為主，不主動推銷。客戶問什麼就答什麼。\n1b. 如果上下文有用戶姓名/電話/Email，代表你已經知道這些資訊，直接使用，不要再問一次。\n2. 如果能判斷學生年齡/年級，推薦對應課程並附上網址。\n3. 絕對不要叫客戶打電話或寫 Email。\n4. 只有客戶明確說「我要跟人談」「找真人」「安排諮詢」時，才說「好的！我請顧問直接 LINE 你 😊 方便什麼時候聯繫？」\n5. 【鐵律】不知道的問題絕對不要回答，直接說：「這個問題我幫你記下來了，會請專人盡快回覆你 😊」。你不是創辦人，不能代表公司回答不確定的事。\n6. 【鐵律】嚴禁編造、猜測、推測、拼湊。只能用本提示裡的知識庫內容回答。知識庫沒有的 = 你不知道 = 轉專人。沒有例外。\n7. 如果客戶提到已報名/退費/付款/簽證等行政問題，回答：「我們收到了，會盡快請專人回覆你 😊」\n8. 如果客戶問有沒有在台灣的課程、台灣上課、不出國的課程、本地課程、其他課程、線上課程等非休士頓的課程，回答：「目前我們主要的課程都在美國休士頓進行，關於其他課程安排，我幫你請專人說明 😊」\n9. 如果上下文標註學生類別是 JSS，不要提 HSS。如果是小學生/科學探索營，不要提 HSS 或 JSS。只提跟該學生年齡相關的課程。\n10. 回覆格式：純文字，不要用 markdown（不要用 **粗體**、# 標題、- 列表等）。網址直接貼，前後不要加任何符號。\n\n=== 課程分流（最重要的規則）===\n⚠ 如果不知道學生年齡或年級，必須先問：「方便告訴我孩子目前幾年級呢？這樣我可以推薦最適合的課程 😊」\n⚠ 不要在不確定年齡的情況下推薦任何特定課程或給出課程網址！\n- 高中生（10年級以上）/大學生/15歲以上 → HSS 太空學校（又稱高階太空學校），網址：https://tcghss1.spaceschool.org/\n- 小學5-6年級/國中（7-9年級）/約10-14歲 → JSS 初階太空學校，網址：https://tcgjss1.spaceschool.org/\n- 小學1-4年級/10歲以下 → 科學探索營（也在美國休士頓），請專人聯繫\n注意：小學五、六年級雖然是小學生，但屬於 JSS 初階太空學校的範圍\n\n=== HASSE 基本資訊 ===\n- 成立於 2005 年，美國德州休士頓，國際知名太空教育組織\n- 超過 15,000 名校友，來自 20+ 國家\n- 與 NASA 太空人、科學家長期合作（非從屬關係，但以正式成員參與課程設計）\n- 榮獲 2024 ITC 全球商業影響力獎\n- 亞太辦公室：台北市信義路五段五號 7B12\n\n=== HSS 太空學校／高階太空學校（高中/大學）===\n核心理念：讓學生提前十年看到未來世界。太空經濟正在成形，AI 正在讓它加速。最先理解它的學生，將擁有不同的視野。\n\n基本資訊：\n- 12天全程住宿沉浸式課程，在美國休士頓\n- 2026 夏季：每年七月，梯次A 7/7-7/18、梯次B 7/14-7/25\n- 每梯次限30名，採申請制，不限理工背景\n- 台灣學員 USD 5,980（含住宿三餐保險），國際 USD 7,999\n- 不含國際機票、個人零用金\n\n4大學習體驗：\nA. NASA 任務模擬（在真實太空任務環境學決策與團隊協作，6億美元規模模擬任務）\nB. 太空工程與創新挑戰（動手解決工程問題）\nC. 與科學家工程師交流（直接與 NASA 專家、產業人士面對面）\nD. 未來太空經濟討論（商業、法律、媒體、創新者在太空產業的角色）\n\nAI × 太空：\n- AI 任務規劃與決策（培養太空人等級問題解決能力）\n- 太空居住設計（為月球/火星設計居住空間）\n- 產業趨勢應用（理解 AI 如何加速太空產業）\n- 未來情境建構（從月球基地到星際經濟）\n\n實地參訪設施：\n- NASA 詹森太空中心限制區域（一般人無法進入）\n- NASA 任務控制中心（日本太空人星出彰彥曾接待）\n- NASA 中性浮力實驗室（NBL，太空人水下 EVA 訓練）\n- iFLY 室內跳傘模擬無重力\n- Ad Astra 離子引擎太空公司\n- Sasakawa 國際太空建築中心\n- 萊斯大學\n- 水下無重力模擬\n\nIGNIS 框架：在 AI 加速、太空擴張的時代，未來不屬於知道更多或反應更快的人，而屬於那些能從 Real Reason 出發去建造的人。IGNIS 是把內在拉力轉化為現實行動的 operating system。三階段：Ignition（點燃）→ Iteration（迭代）→ Integration（整合）\n\n課程效益：\n- 結業證書（可用於大學/研究所申請）\n- 與 NASA 專家工程師建立人脈\n- 進入限制區域的特殊體驗\n- 全球 15,000+ 校友、20+ 國家網絡\n- 20 年太空教育經驗\n- 休士頓太空中心教育合作夥伴\n\n=== JSS 初階太空學校（小五～國九）===\n- 在美國休士頓，12天全程住宿沉浸式課程\n- 太空任務基礎訓練、團隊合作與問題解決、建立科學思維與國際視野\n- JSS 是點燃興趣，HSS 是定向\n\n=== 課程名稱對照 ===\nHSS = 太空學校 = 高階太空學校（高中/大學），網站：https://tcghss1.spaceschool.org/\nJSS = 初階太空學校（小五～國九），網站：https://tcgjss1.spaceschool.org/\n科學探索營（小四以下），也在休士頓\n\n=== 常見問答知識 ===\n英文：基本溝通即可，不需流利。歷屆學員程度差距很大，英語從來不是拒絕理由。\n安全：24小時督導，含當地醫療保險。飯店住宿，有專屬工作空間。\n升學：校友錄取劍橋、牛津等。面試中教授主動追問 HASSE 經歷。具體校友：Tracy陳美羲(2018, 劍橋電腦科學, 英國機器手臂大賽冠軍)、Hugo陳孟宏(2017, 台大電機)。\n\n知名校友：\n- Arthur Weng(2012校友)：加州大學爾灣分校航太工程，現 SpaceX 星艦火箭工程師。原話：「HASSE 太空學校對我來說非常激勵，絕對是我今天能進 SpaceX 的一個因素」\n- Wayne Lin(2006校友)：加州柏克萊電機，Forbes 30 Under 30 企業家得主\n- 村田燿 Yo Murata(2017校友)：東京大學電機，現日本宇宙局 JAXA 工程師\n\nNASA 太空人推薦：\n- Leroy Chiao（焦立中，國際太空站指揮官）：「HASSE 太空學校是一個非常好的課程。我強力推薦給所有對太空有興趣的年輕人」\n- Dr. Georg Von Tiensenhausen（阿波羅登月車主任工程師, NASA 名人堂）：「HASSE 是我見過最棒的組織」\n- Dr. Deborah Barnhart（麻省理工, 美國 NASA 太空與火箭中心 CEO）：「HASSE是一個傑出的教育組織，我們從2006年開始就和他們密切合作，也會持續合作」\n適合誰：不限科系。太空產業橫跨科技、商業、法律、金融、設計、傳播。\n師資：NASA 太空人、知名教授、科學家工程師。Roland Nedelkovich 兩度獲 NASA 銀色史努比獎。\n家長：可以一個人去，全程專業團隊照顧，定期跟家長更新。\n內向：結構化小組任務環境，對內向友善。每位學生有明確角色。\n證書：結業證書 + 20+ 國家校友網絡（SpaceX、Forbes 30 Under 30、劍橋等）\n接機：IAH機場專人接送 USD 150-250\n報名流程：1.預約諮詢 2.顧問評估 3.確認申請\n好玩嗎：好玩！但不只好玩，引導思考未來，鼓勵「登月思維」\n改變：最常見不是知識點而是學習態度改變。開始知道自己對什麼感興趣。\n太空經濟：2040年全球超一兆美元，跨領域人才需求大。台灣角度：半導體讓台灣站上全球供應鏈核心，下一波在軌道上 — SpaceX 星鏈、Artemis 月球任務、低軌衛星通訊需要的晶片、感測器、通訊模組，很大一部分由台灣產業鏈供應。AI 正在重寫太空任務設計的每一個環節。\n成績：目標不是提升考試成績，而是讓學生知道為什麼要學習\n遊學差別：Touring遊覽型/Schooling名校型/Deep Learning深度學習(HASSE)\n與營隊差別：一般遊客看展覽、拍照打卡、聽導覽。HASSE 學生走進 NASA 實驗室、執行 6 億美元規模的模擬任務、與產業和 NASA 專家面對面。「你可以自己去美國看太空中心，但這和在這裡做的事完全不同」這不是參觀，而是體驗太空產業的工作方式。\n1-4年級：1-4年級的孩子適合「科學探索營」，也是在美國休士頓。如果有興趣我們找專人聯絡您，幫您了解詳細內容。\n說明會：我們有線上說明會，可以到這裡查看最新場次和報名：https://tcghss.spaceschool.org/webinar\n聯絡：LINE @nhe2702g / spaceschool.org / 台北信義路五段五號 7B12';
  let context = '';
  const ud = $getWorkflowStaticData('global').users?.[lineUserId] || {};
  if (ud.contactName) context += '[用戶姓名: ' + ud.contactName + '] ';
  if (ud.contactPhone) context += '[電話: ' + ud.contactPhone + '] ';
  if (ud.contactEmail) context += '[Email: ' + ud.contactEmail + '] ';
  if (prog) context += '[學生類別: ' + prog + '] ';
  if (!context && displayName) context += '[LINE暱稱: ' + displayName + '] ';
  return {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: context + text }
    ],
    max_tokens: 300,
    temperature: 0.7
  };
}

// === State Machine: only handles button clicks ===
// Free text in any state → GPT

let isButton = false;

switch(messageText) {
  // === Welcome buttons ===
  case '🎓 校友': case '校友':
    messages = textMsg('歡迎回來！🎓\n請問你是什麼時候參加的什麼課程？\n（例如：2024 HSS）');
    nextState = 'alumni_wait'; isButton = true; break;
  case '🙋 了解課程': case '了解課程':
    messages = askAgeMsg(); nextState = 'ask_age'; isButton = true; break;
  case '💬 我要問問題': case '我要問問題': case '💬 常見問題': case '💬 我有問題': case '我有問題':
    if (userData.program) {
      messages = textMsg('沒問題！請直接打你的問題，我會盡量回答 😊');
      nextState = 'done';
    } else {
      messages = askAgeMsg();
      nextState = 'faq_need_age';
    }
    isButton = true; break;

  // === Age buttons ===
  case '🎓 高中 / 大學': case '高中 / 大學': case '高中/大學':
    if (userState === 'faq_need_age') {
      program = 'HSS';
      messages = textMsg('了解！太空學校 (HSS) 😊\n\n請直接打你的問題，我會盡量回答！');
      nextState = 'done';
    } else {
      program = 'HSS';
      messages = buttons('HSS 太空學校：\n\n・Mission Control 模擬\n・AI + Space 決策訓練\n・與 NASA / 產業環境接觸\n\n2026 費用 USD 5,980（台灣學員）\n\n要不要花 10 分鐘免費線上諮詢？', ['好啊 👋', '先想想']);
      nextState = 'showed_info';
    }
    isButton = true; break;
  case '📚 小五～國九': case '小五～國九': case '📚 5–9 年級': case '5–9 年級': case '5-9 年級':
    if (userState === 'faq_need_age') {
      program = 'JSS';
      messages = textMsg('了解！初階太空學校 (JSS) 😊\n\n請直接打你的問題，我會盡量回答！');
      nextState = 'done';
    } else {
      program = 'JSS';
      messages = buttons('JSS 初階太空學校：\n\n・太空任務基礎訓練\n・團隊合作與問題解決\n・建立科學思維與國際視野\n\n要不要花 10 分鐘免費線上諮詢？', ['好啊 👋', '先想想']);
      nextState = 'showed_info';
    }
    isButton = true; break;
  case '📒 小四以下': case '小四以下': case '📒 1–4 年級': case '1–4 年級': case '1-4 年級':
    messages = textMsg('1–4 年級適合我們在休士頓的「科學探索營」🔬\n\n我請專人跟你聯繫，幫你了解詳細內容 😊');
    program = '科學探索營'; ghlAction = 'young_student'; nextState = 'done'; isButton = true; break;

  // === Soft close buttons ===
  case '好啊 👋': case '好啊':
    messages = textMsg('太好了！我請顧問直接 LINE 你 😊\n方便什麼時候聯繫？');
    ghlAction = 'hot_line'; nextState = 'done'; isButton = true; break;
  case '先想想': {
    const thinkUrl = (userData.program === 'JSS') ? 'https://tcgjss1.spaceschool.org/' : 'https://tcghss1.spaceschool.org/';
    messages = textMsg('沒問題！😊\n\n方便的話，可以留下您的姓名、電話和 Email 嗎？這樣我們可以提供更完整的資訊給您 🙏\n\n這裡也有招生介紹可以參考 👉\n' + thinkUrl);
    ghlAction = 'warm'; nextState = 'ask_contact'; isButton = true; break;
  }

  // === Legacy buttons (backward compat) ===
  case '💬 LINE 通話':
    messages = textMsg('好的！方便什麼時候？我請顧問直接 LINE 你 😊');
    ghlAction = 'hot_line'; nextState = 'done'; isButton = true; break;
  case '📹 Zoom': {
    const zUrl = (userData.program === 'HSS') ? 'https://tcghss1.spaceschool.org' : 'https://tcgjss1.spaceschool.org';
    messages = textMsg('好的！這裡可以直接選時間 👉\n' + zUrl);
    ghlAction = 'hot_zoom'; nextState = 'done'; isButton = true; break;
  }
}

// === Free text: all goes to GPT ===
if (!isButton) {
  if (userState === 'alumni_wait') {
    // Alumni replied with course info
    messages = textMsg('收到！你參加的是「' + messageText + '」對嗎？\n\n謝謝你的資訊 😊 我已經幫你記錄了，我們團隊會盡快跟你聯繫！');
    ghlAction = 'alumni';
    nextState = 'done';
  } else if (userState === 'new') {
    // First message ever — show welcome
    messages = welcomeMsg();
    nextState = 'welcome';
  } else if (userState === 'ask_contact') {
    // User replied with contact info — parse name/phone/email
    const info = messageText;
    const phoneMatch = info.match(/(?:0[0-9]{8,9}|\+?886[0-9]{8,9}|09[0-9]{8})/);
    const emailMatch = info.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    var contactPhone = phoneMatch ? phoneMatch[0] : '';
    var contactEmail = emailMatch ? emailMatch[0] : '';
    // Name = remove phone and email from text, take what's left
    var contactName = info.replace(/(?:0[0-9]{8,9}|\+?886[0-9]{8,9}|09[0-9]{8})/g, '').replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '').replace(/[,，\s]+/g, ' ').trim();
    if (!contactName) contactName = displayName;
    // Save to staticData so we remember
    userData.contactName = contactName;
    userData.contactPhone = contactPhone;
    userData.contactEmail = contactEmail;
    messages = textMsg('收到！謝謝你 ' + contactName + '，我們會盡快聯繫你 😊\n\n有任何問題隨時問我們！');
    ghlAction = 'collect_contact';
    nextState = 'done';
  } else if (/^(謝謝|感謝|再見|掰掰|bye|好的謝謝|謝啦|不用了|我想想|我再想想|考慮一下|考慮看看|先這樣|好的|了解|知道了)$/i.test(messageText) || /謝謝|再見|掰掰|不用了|我想想|我再想想|考慮一下|先這樣吧/.test(messageText)) {
    // Farewell detected — ask for contact info
    messages = textMsg('沒問題！😊\n\n方便的話，可以留下您的姓名、電話和 Email 嗎？這樣我們可以提供更完整的資訊給您 🙏');
    nextState = 'ask_contact';
  } else {
    // Detect grade/age from free text to set program context
    const detected = detectProgram(messageText);
    if (detected && !program) program = detected;
    const knownProg = program || userData.program || '';
    // If asking about enrollment/courses/pricing but no age known → ask age first
    if (!knownProg && /招生|報名|申請|參加|課程|費用|學費|多少錢|怎麼報|梯次|什麼時候|暑假|夏令營|冬令營|有沒有開|說明會|講座|線上說明/.test(messageText)) {
      messages = buttons('有的！我們有招生喔 😊\n\n先確認一下孩子的年級，這樣可以給你最準確的資訊：', ['🎓 高中 / 大學', '📚 小五～國九', '📒 小四以下']);
      nextState = 'ask_age';
    } else {
      // Everything else: send to GPT
      needsAI = true;
      aiBody = buildAIBody(messageText, knownProg);
      nextState = 'done';
    }
    // Track for GHL if it looks like a CS question
    if (/已.*報名|退費|退款|取消|改期|簽證|行前|付了|匯了/.test(messageText)) {
      ghlAction = 'cs_question';
    }
  }
}

staticData.users[lineUserId] = { state: nextState, program: program || userData.program || '', updatedAt: Date.now(), contactName: userData.contactName || '', contactPhone: userData.contactPhone || '', contactEmail: userData.contactEmail || '' };
const contactInfo = { contactName: typeof contactName !== 'undefined' ? contactName : '', contactPhone: typeof contactPhone !== 'undefined' ? contactPhone : '', contactEmail: typeof contactEmail !== 'undefined' ? contactEmail : '' };
return { replyToken, messages, ghlAction, needsAI, aiBody, messageText, displayName, lineUserId, state: nextState, program: program || userData.program || '', ...contactInfo };
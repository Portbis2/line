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

function buttons(text, btns) {
  return [{
    type: 'template',
    altText: text.substring(0, 40),
    template: { type: 'buttons', text, actions: btns.map(b => ({ type: 'message', label: b, text: b })) }
  }];
}
function textMsg(text) { return [{ type: 'text', text }]; }
function welcomeMsg() {
  return buttons('你好！歡迎來到 HASSE 太空學校 🚀\n請問你是？', ['🎓 校友', '🙋 了解課程', '💬 我要問問題']);
}
function askAgeMsg() {
  return buttons('我先確認一下孩子的年級，這樣可以給你最準確的資訊 😊\n\n請問目前是？', ['🎓 高中 / 大學', '📚 5–9 年級', '📒 1–4 年級']);
}

function buildAIBody(text, prog) {
  const systemPrompt = '你是 HASSE 太空學校的 LINE 客服助手。請用繁體中文、友善親切的語氣回答問題。回答要簡短（不超過150字），適合手機聊天。\n\nHASSE 基本資訊：\n- 成立於 2005 年，美國德州休士頓，國際知名太空教育組織\n- 超過 15,000 名校友，來自 20+ 國家\n- 與 NASA 太空人、科學家長期合作（非從屬關係）\n- 亞太辦公室在台北信義路五段五號 7B12\n\n課程：\n- HSS（高中/大學）：12天沉浸式，Mission Control 模擬、AI+Space 決策訓練。2026 夏季 梯次A 7/7-7/18、梯次B 7/14-7/25，每梯次限30名。台灣學員 USD 5,980（含住宿三餐保險）\n- JSS（5-9年級）：初階太空課程，約10天。太空任務訓練、團隊合作、科學思維\n- 科學探索營（1-4年級）\n\n設施：NASA 任務控制中心、中性浮力實驗室、SICSA 火星基地設計中心、萊斯大學\n英文：基本溝通即可，不需流利\n安全：24小時督導，含當地醫療保險\n升學：校友錄取劍橋、牛津等，面試加分\n\n客服問題處理：\n- 已報名但沒收到 Email → 告訴客戶「我們收到了，會盡快請專人回覆你」\n- 付款/退費/改期 → 告訴客戶「我們收到了，會盡快請專人回覆你」\n- 簽證/行前準備 → 告訴客戶「我們收到了，會盡快請專人回覆你」\n- 其他帳務/行政問題 → 告訴客戶「我們收到了，會盡快請專人回覆你」\n\n如果問題超出你的知識範圍，請說「我們收到你的問題了，會盡快請專人回覆你 😊」\n絕對不要叫客戶打電話或寫 Email，所有問題都由我們主動回覆。\n不要編造不確定的資訊。回答末尾可以適當加 emoji。';
  const userMsg = (prog ? '[學生類別: ' + prog + '] ' : '') + text;
  return {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg }
    ],
    max_tokens: 300,
    temperature: 0.7
  };
}

function answerFAQ(text) {
  const t = text.toLowerCase();

  if (/招生|有沒有開|還有開|有開課|開放報名|可以報名|今年有|明年有|還可以報|還能報/.test(t))
    return '有的！2026 夏季 HSS 太空沉浸計畫正在招生中 🚀\n\n・梯次 A：7/7–7/18\n・梯次 B：7/14–7/25\n\n每梯次限 30 名，採申請制，名額持續遞減中。\n\n要不要花 10 分鐘免費線上諮詢？😊';

  if (/在哪|地點|location|where|休士頓|houston|美國|德州/.test(t))
    return '課程在美國德州休士頓，NASA 詹森太空中心周邊 🚀\n\nHSS 為 12 天全程住宿沉浸式，進入的設施包括任務控制中心、中性浮力實驗室、SICSA 火星基地設計中心等。\n\n每一個場館都不是走馬看花，而是帶著任務進入，用真實資源解決問題。';

  if (/什麼時候|時間|when|日期|幾月|暑假|summer|2026|2025|梯次|開課|開始|出發/.test(t))
    return '2026 HSS 太空沉浸計畫：\n・梯次 A：7/7–7/18\n・梯次 B：7/14–7/25\n\n每梯次限 30 名，採申請制，名額持續遞減中。\n建議盡早確認 😊';

  if (/幾天|多久|多長|how long|duration|週|天數/.test(t))
    return 'HSS 為 12 天全程住宿沉浸式課程。\nJSS 初階太空學校約 10 天。\n\n詳細日程歡迎預約諮詢了解！';

  if (/費用|多少錢|價格|學費|cost|fee|price|貴|投資|錢|花費|預算/.test(t))
    return 'HSS 2026 夏季費用：\n・台灣學員：USD 5,980（名額有限）\n・國際標準：USD 7,999\n\n費用包含：12天課程、住宿、三餐、NASA設施參訪、24小時督導、結業證書、當地醫療保險\n\n不含：國際機票、個人零用金';

  if (/住宿|住哪|hotel|住|宿舍|飯店/.test(t))
    return '學生入住條件整潔舒適的飯店，設有專屬共同工作空間，供專案討論和課後交流。\n\n安全、便利是首要考量。全程有 HASSE 認證工作人員陪同 😊';

  if (/安全|safe|safety|保險|危險|照顧|放心|擔心|worry/.test(t))
    return '全程 24 小時有 HASSE 認證專業教育人員陪同督導。每個任務組有明確組長與協作角色。\n\nHASSE 為每位學員提供當地醫療保險，確保在美期間若有醫療需求都能妥善處理，家長可以放心 😊';

  if (/英文|英語|english|語言|language|英檢/.test(t))
    return '課程以英語進行，基本溝通能力就夠，不需要非常流利。\n\n歷屆學員英語程度差距很大，英語能力從來不是拒絕的理由。重要的是你能在討論中表達想法，這在課程過程中會自然發生 😊';

  if (/名額|還有嗎|額滿|人數|幾個人|capacity|限/.test(t))
    return '每梯次限 30 名，採申請制，名額持續遞減中。\n\n建議盡早預約諮詢確認最新名額狀況 😊';

  if (/nasa參觀|遊學團|參觀|太空營|營隊|camp|tour/.test(t))
    return '一般 NASA 遊覽：看展覽、聽導覽、拍照、離開。\n\nHASSE 學員：以任務組別身份進入同一批設施，帶著真實挑戰任務、工作角色和評估標準。\n\n場景相同，學習密度完全不同。太空營是體驗，HASSE 是訓練 🚀';

  if (/hasse是什麼|什麼是hasse|hasse 是|太空學校是|介紹一下|什麼機構|什麼組織|你們是誰|你們是什麼|哪個單位|誰辦的|主辦|背景|公司|非營利|nonprofit/.test(t))
    return 'HASSE 成立於 2005 年，總部在德州休士頓，是國際知名的太空教育組織。超過 15,000 名來自 20+ 國家的校友。\n\n與 NASA 太空人、科學家長期合作，以正式成員身份參與課程設計。榮獲 2024 ITC 全球商業影響力獎 🏆\n\n亞太辦公室設在台北，深耕亞太超過 18 年。';

  if (/適合|誰可以|資格|條件|requirement|不是理工|文組|非stem|不走stem|什麼樣的學生|什麼學生/.test(t))
    return '太空產業需要的人才橫跨科技、商業、法律、金融、設計、傳播。\n\nSpaceX 找的不只是火箭工程師，NASA 的工作也不只是計算軌道。不管念什麼科系，理解太空是跨領域的文明經濟，都是提早的優勢 💡';

  if (/升學|大學申請|履歷|備審|推甄|college|admission|面試|牛津|劍橋|oxford|cambridge/.test(t))
    return 'HASSE 校友成功錄取劍橋、牛津等頂尖大學。多位學員在面試中，教授主動追問 HASSE 經歷。\n\n牛津 Park 教授稱 HASSE 為「教育的典範轉移」。\n\n你寫的不是「我參加了課程」，而是「我做了這個專案，向業界專家發表成果，確認了我的方向」✨';

  if (/怎麼報|報名流程|如何申請|how to apply|步驟/.test(t))
    return '報名流程：\n1️⃣ 預約免費 10 分鐘諮詢\n2️⃣ 顧問幫你評估適合的課程\n3️⃣ 確認後提交申請\n\n要不要我幫你安排諮詢？😊';

  if (/家長|父母|parent|陪同|爸媽|一個人/.test(t))
    return '完全可以一個人去！每屆學員都從不同地方各自前往，在課程中認識彼此是體驗的一部分。\n\n全程有專業團隊照顧，也會定期跟家長更新狀況。很多校友說，這裡建立的友誼是最難忘的收穫之一 😊';

  if (/證書|certificate|結業|證明|校友|後續|支持/.test(t))
    return '完成課程後頒發 HASSE 結業證書，並進入橫跨 20+ 國家的校友網絡。\n\n網絡裡有 SpaceX 工程師、Forbes 30 Under 30 創業者、JAXA 工程師、劍橋和 UC Berkeley 研究者。課程結束是進入社群的起點 🌍';

  if (/ignis|框架|方法|學習方式|怎麼學/.test(t))
    return 'IGNIS 是 HASSE 的三階段學習框架：\n\n🔥 Ignition（點燃）— 與太空科學家對話，確立你的方向\n🔄 Iteration（迭代）— 實際操作、失敗、調整、再做一次\n🎯 Integration（整合）— 向業界專家發表真實成果\n\n不是被動接收知識，而是帶著問題去探索 💡';

  if (/ai|人工智慧|工作坊|workshop|程式/.test(t))
    return 'AI 工作坊是 HSS 課程核心部分，不需要會寫程式！\n\n用 AI 工具解決太空任務中的真實問題：任務規劃、棲息地設計、情境建構等。\n\n學的不是工具操作，是用 AI 解決問題的思考方式 🤖';

  if (/老師|師資|講師|教授|instructor|teacher|誰教/.test(t))
    return '師資包括 NASA 太空人、世界知名教授、參與重要太空任務的科學家與工程師。\n\n他們不只是演講嘉賓，而是實際參與課程設計與執行。Roland Nedelkovich 先生曾兩度獲 NASA「銀色史努比獎」🏅';

  if (/(hss|jss).*(差|不同|區別|比較)|(差|不同|區別|比較).*(hss|jss)|初階.*高階|高階.*初階/.test(t))
    return 'JSS 是點燃 🔥 HSS 是定向 🎯\n\nJSS（5-9年級）：打開學習興趣，發現好奇心。由老師主導，學生跟著任務走。\n\nHSS（高中大學）：釐清未來方向，自己主導學習，向業界專家發表成果。\n\n兩個設計邏輯完全不同的課程！';

  if (/太空經濟|未來|前景|就業|職涯|career|trillion|兆/.test(t))
    return '2040 年全球太空經濟規模預計超過一兆美元 🚀\n\n推動的不只是火箭工程師，而是橫跨科技、商業、法律、政策、建築、醫療、傳播的跨領域人才。\n\n太空提供的不是一個答案，而是一個夠大的格局，讓你找到自己的位置。';

  if (/內向|害羞|shy|introvert|不敢/.test(t))
    return '結構清晰的小組任務環境，對內向的學生往往比開放式社交更友善 😊\n\n每位學生都有明確角色，互動建立在共同解決問題上，不是社交壓力。\n\n許多內向學生反而在這裡找到自信，因為他們的思考和貢獻在這裡是被看見的 ✨';

  if (/好玩|fun|有趣|好不好玩/.test(t))
    return '學生一致的回答是：好玩！🎉\n\n但不只是好玩——課程目的是引導學生開始思考未來，鼓勵大膽的夢想。我們稱之為「登月思維」🌙\n\n太空學校提供不同的視角，讓學生重新看見自己真正在意的事。';

  if (/改變|收穫|學到|回來|之後|成長/.test(t))
    return '最常見的改變不是知識點，而是對學習的態度 ✨\n\n學生開始知道自己對什麼感興趣、願意主動思考未來、相信自己有能力做到原本覺得遙遠的事。\n\n高中生：釐清大學方向、面試有真實經歷、建立國際連結。';

  if (/機場|接送|接機|airport|iah|transfer/.test(t))
    return '可以安排！從休士頓 IAH 機場到飯店的專人接送，單程約 USD 150-250。\n\n若有其他學員相近時間抵達可共乘分攤。需要安排請聯繫 HASSE 亞太辦公室 😊';

  if (/聯絡|電話|email|地址|辦公室|contact/.test(t))
    return 'HASSE 亞太辦公室 🏢\n\n📍 台北市信義路五段五號 7B12\n💬 LINE @nhe2702g\n🌐 spaceschool.org\n\n有任何問題都可以直接在這裡問，我們會盡快回覆 😊';

  if (/成績|考試|分數|grade|score|學業/.test(t))
    return '課程目標不是提升考試成績，而是解決更根本的問題：讓學生知道自己為什麼要學習 💡\n\n一旦找到真正投入的領域，學習動力會從根本改變。這是 IGNIS 框架的核心：先點燃熱情，再建立能力 🔥';

  if (/遊學|比較|選擇|哪種|touring|schooling/.test(t))
    return 'HASSE 把海外學習分三個層次：\n\n🚌 Touring（遊覽型）— 看了很多，深度有限\n🏫 Schooling（名校型）— 品牌知名，收穫因人而異\n🔬 Deep Learning（深度學習）— HASSE 屬於這類\n\n選擇什麼學習深度，比選擇去哪裡更重要！';

  if (/nasa.*關係|關係.*nasa/.test(t))
    return 'HASSE 與 NASA 無直接從屬關係，但自創立以來，大量 NASA 太空人、科學家與工程師以正式成員身份參與課程。\n\nHASSE 的貢獻曾獲兩大 NASA 太空中心執行長公開肯定。\n\n「HASSE 太空學校是一個非常好的課程，我強力推薦。」— NASA 太空人 Leroy Chiao 🧑‍🚀';

  return null;
}

function detectAge(text) {
  const t = text.toLowerCase();
  const gradeMatch = t.match(/(\d+)\s*年級/);
  if (gradeMatch) {
    const grade = parseInt(gradeMatch[1]);
    if (grade >= 1 && grade <= 4) return 'young';
    if (grade >= 5 && grade <= 9) return 'jss';
    if (grade >= 10) return 'hss';
  }
  const ageMatch = t.match(/(\d+)\s*歲/);
  if (ageMatch) {
    const age = parseInt(ageMatch[1]);
    if (age <= 10) return 'young';
    if (age >= 11 && age <= 14) return 'jss';
    if (age >= 15) return 'hss';
  }
  if (/小一|小二|小三|小四|一年級|二年級|三年級|四年級|低年級|中年級/.test(t)) return 'young';
  if (/小五|小六|五年級|六年級|高年級|國一|國二|國三|七年級|八年級|九年級|初一|初二|初三|國中/.test(t)) return 'jss';
  if (/高一|高二|高三|十年級|十一年級|十二年級|高中|大一|大二|大三|大四|大學|college|university/.test(t)) return 'hss';
  return null;
}

function detectIntent(text) {
  const t = text.toLowerCase();
  if (/已.*(報名|繳|付款|申請)|沒.*收到|收不到|退費|退款|取消|改期|簽證|行前|出發前|已經報名|已報名|已繳費|已付款|付了|匯了/.test(t)) return 'cs_existing';
  if (/報名|申請|參加|註冊|enroll|register|sign.?up|招生/.test(t)) return 'want_register';
  if (/費用|多少錢|價格|學費|cost|fee|price/.test(t)) return 'ask_fee';
  if (/諮詢|顧問|consultant|consult/.test(t)) return 'want_consult';
  if (/課程|內容|介紹|了解|what|course/.test(t)) return 'ask_info';
  if (/校友|alumni|畢業/.test(t)) return 'alumni';
  if (/hss/i.test(t) && !/jss/i.test(t)) return 'hss';
  if (/jss/i.test(t) && !/hss/i.test(t)) return 'jss';
  if (/說明會|webinar|講座/.test(t)) return 'webinar';
  if (/你好|hi|hello|嗨|哈囉/.test(t)) return 'greeting';
  return 'unknown';
}

// === State Machine ===

if (userState === 'alumni_wait') {
  messages = textMsg('收到！你參加的是「' + messageText + '」對嗎？\n\n謝謝你的資訊 😊 我已經幫你記錄了，我們團隊會盡快跟你聯繫！');
  ghlAction = 'alumni';
  nextState = 'done';

} else if (userState === 'faq_need_age') {
  let handled = true;
  switch(messageText) {
    case '🎓 高中 / 大學': case '高中 / 大學': case '高中/大學':
      program = 'HSS'; break;
    case '📚 5–9 年級': case '5–9 年級': case '5-9 年級':
      program = 'JSS'; break;
    case '📒 1–4 年級': case '1–4 年級': case '1-4 年級':
      messages = textMsg('1–4 年級適合我們的「科學探索營」🔬\n\n我請專人跟你聯繫，幫你了解詳細內容 😊\n請稍等一下～');
      ghlAction = 'young_student'; nextState = 'done'; handled = false; break;
    default: {
      const ag = detectAge(messageText);
      if (ag === 'hss') { program = 'HSS'; }
      else if (ag === 'jss') { program = 'JSS'; }
      else if (ag === 'young') {
        messages = textMsg('1–4 年級適合我們的「科學探索營」🔬\n\n我請專人跟你聯繫，幫你了解詳細內容 😊\n請稍等一下～');
        ghlAction = 'young_student'; nextState = 'done'; handled = false;
      } else {
        messages = askAgeMsg();
        nextState = 'faq_need_age'; handled = false;
      }
      break;
    }
  }
  if (handled && program) {
    const pName = program === 'HSS' ? '高階太空學校 (HSS)' : '初階太空學校 (JSS)';
    messages = textMsg('了解！' + pName + ' 😊\n\n請直接打你的問題，我會盡量回答！\n答不了的我會請專人幫你！');
    nextState = 'done';
  }

} else if (userState === 'choose_method') {
  switch(messageText) {
    case '💬 LINE 通話': case 'LINE 通話':
      messages = textMsg('好的！方便什麼時候？我請顧問直接 LINE 你 😊');
      ghlAction = 'hot_line'; nextState = 'done'; break;
    case '📹 Zoom': case 'Zoom':
      const zUrl = (userData.program === 'HSS') ? 'https://tcghss1.spaceschool.org' : 'https://tcgjss1.spaceschool.org';
      messages = textMsg('好的！這裡可以直接選時間 👉\n' + zUrl + '\n\n預約完成後，我們會先了解學生背景，再給具體建議 😊');
      ghlAction = 'hot_zoom'; nextState = 'done'; break;
    default:
      messages = buttons('請選擇你比較方便的方式 😊', ['💬 LINE 通話', '📹 Zoom']);
      nextState = 'choose_method'; break;
  }

} else if (userState === 'showed_info') {
  switch(messageText) {
    case '好啊 👋': case '好啊':
      messages = buttons('太好了！你比較方便哪種方式？', ['💬 LINE 通話', '📹 Zoom']);
      nextState = 'choose_method'; break;
    case '先想想':
      messages = textMsg('沒問題！有任何問題隨時問我們 😊\n\n這裡有招生介紹可以參考 👉\nhttps://tcghss1.spaceschool.org/');
      ghlAction = 'warm'; nextState = 'done'; break;
    default: {
      const faq = answerFAQ(messageText);
      if (faq) {
        messages = textMsg(faq);
        nextState = 'done';
      } else {
        needsAI = true;
        aiBody = buildAIBody(messageText, userData.program || program);
        ghlAction = 'cs_question';
        nextState = 'done';
      }
      break;
    }
  }

} else if (userState === 'cs_wait' || userState === 'done') {
  const faqAnswer = answerFAQ(messageText);
  if (faqAnswer) {
    messages = textMsg(faqAnswer);
    nextState = 'done';
  } else {
    const intent = detectIntent(messageText);
    if (intent === 'cs_existing') {
      needsAI = true;
      aiBody = buildAIBody(messageText, userData.program || '');
      ghlAction = 'cs_question';
      nextState = 'done';
    } else if (intent === 'want_register' || intent === 'want_consult') {
      messages = buttons('想報名或諮詢都可以！你比較方便哪種方式？', ['💬 LINE 通話', '📹 Zoom']);
      nextState = 'choose_method';
    } else if (intent === 'ask_fee') {
      messages = buttons('HSS 2026 費用：\n・台灣學員：USD 5,980\n・國際：USD 7,999\n\n含課程、住宿、三餐、保險等\n不含機票\n\n想了解更多？', ['好啊 👋', '先想想']);
      nextState = 'showed_info';
    } else if (intent === 'webinar' || intent === 'ask_info') {
      messages = textMsg('這裡有完整介紹 👉\nhttps://tcghss.spaceschool.org/webinar\n\n有其他問題也可以繼續問我 😊');
      nextState = 'done';
    } else if (intent === 'greeting') {
      messages = textMsg('你好！有什麼問題都可以問我 😊');
      nextState = 'done';
    } else {
      const ageResult = detectAge(messageText);
      if (ageResult === 'young') {
        messages = textMsg('1–4 年級適合我們的「科學探索營」🔬\n\n我請專人跟你聯繫，幫你了解詳細內容 😊\n請稍等一下～');
        ghlAction = 'young_student'; nextState = 'done';
      } else if (ageResult === 'jss') {
        messages = buttons('根據年級，推薦 JSS 初階太空學校 😊\n\n・太空任務基礎訓練\n・團隊合作與問題解決\n・建立科學思維與國際視野\n\n要不要花 10 分鐘免費線上諮詢？', ['好啊 👋', '先想想']);
        program = 'JSS'; nextState = 'showed_info';
      } else if (ageResult === 'hss') {
        messages = buttons('根據年級，推薦 HSS 高階太空學校 😊\n\n・Mission Control 模擬\n・AI + Space 決策訓練\n・與 NASA / 產業環境接觸\n\n2026 費用 USD 5,980（台灣學員）\n\n要不要花 10 分鐘免費線上諮詢？', ['好啊 👋', '先想想']);
        program = 'HSS'; nextState = 'showed_info';
      } else {
        needsAI = true;
        aiBody = buildAIBody(messageText, userData.program || '');
        ghlAction = 'cs_question';
        nextState = 'done';
      }
    }
  }

} else {
  let handled = true;
  switch(messageText) {
    case '🎓 校友': case '校友':
      messages = textMsg('歡迎回來！🎓\n請問你是什麼時候參加的什麼課程？\n（例如：2024 HSS）');
      nextState = 'alumni_wait'; break;
    case '🙋 了解課程': case '了解課程': case '🙋 第一次認識': case '第一次認識':
      messages = askAgeMsg(); nextState = 'ask_age'; break;
    case '💬 我要問問題': case '我要問問題': case '💬 常見問題': case '常見問題': case '💬 我有問題': case '我有問題':
      if (userData.program) {
        messages = textMsg('沒問題！請直接打你的問題，我會盡量回答 😊\n答不了的我會請專人幫你！');
        nextState = 'done';
      } else {
        messages = askAgeMsg();
        nextState = 'faq_need_age';
      }
      break;
    case '🎓 高中 / 大學': case '高中 / 大學': case '高中/大學': case '14 歲以上':
      messages = buttons('HSS 高階太空學校是高強度的任務訓練環境，接近真實產業：\n\n・Mission Control 模擬\n・AI + Space 決策訓練\n・與 NASA / 產業環境接觸\n\n2026 夏季費用約 USD 5,980（台灣學員，名額有限）\n\n如果有興趣，我可以幫你看看適不適合 😊\n要不要花 10 分鐘免費線上諮詢？', ['好啊 👋', '先想想']);
      program = 'HSS'; nextState = 'showed_info'; break;
    case '📚 5–9 年級': case '5–9 年級': case '5-9 年級': case '11–14 歲':
      messages = buttons('JSS 初階太空學校是為 5–9 年級設計的課程：\n\n・太空任務基礎訓練\n・團隊合作與問題解決\n・建立科學思維與國際視野\n\n如果有興趣，我可以幫你看看適不適合 😊\n要不要花 10 分鐘免費線上諮詢？', ['好啊 👋', '先想想']);
      program = 'JSS'; nextState = 'showed_info'; break;
    case '📒 1–4 年級': case '1–4 年級': case '1-4 年級':
      messages = textMsg('1–4 年級適合我們的「科學探索營」🔬\n\n我請專人跟你聯繫，幫你了解詳細內容 😊\n請稍等一下～');
      ghlAction = 'young_student'; nextState = 'done'; break;
    case '好啊 👋': case '好啊':
      messages = buttons('太好了！你比較方便哪種方式？', ['💬 LINE 通話', '📹 Zoom']);
      nextState = 'choose_method'; break;
    case '💬 LINE 通話':
      messages = textMsg('好的！方便什麼時候？我請顧問直接 LINE 你 😊');
      ghlAction = 'hot_line'; nextState = 'done'; break;
    case '📹 Zoom': {
      const zoomUrl = (userData.program === 'HSS') ? 'https://tcghss1.spaceschool.org' : 'https://tcgjss1.spaceschool.org';
      messages = textMsg('好的！這裡可以直接選時間 👉\n' + zoomUrl + '\n\n預約完成後，我們會先了解學生背景，再給具體建議 😊');
      ghlAction = 'hot_zoom'; nextState = 'done'; break;
    }
    case '先想想':
      messages = textMsg('沒問題！有任何問題隨時問我們 😊\n\n這裡有招生介紹可以參考 👉\nhttps://tcghss1.spaceschool.org/');
      ghlAction = 'warm'; nextState = 'done'; break;
    default: handled = false; break;
  }

  if (!handled) {
    const faqAnswer = answerFAQ(messageText);
    if (faqAnswer) {
      messages = textMsg(faqAnswer);
      nextState = 'done';
    } else {
      const intent = detectIntent(messageText);
      switch(intent) {
        case 'cs_existing':
          needsAI = true;
          aiBody = buildAIBody(messageText, userData.program || '');
          ghlAction = 'cs_question';
          nextState = 'done'; break;
        case 'want_register': case 'want_consult':
          messages = askAgeMsg(); nextState = 'ask_age'; break;
        case 'ask_fee':
          messages = buttons('HSS 2026 費用：\n・台灣學員：USD 5,980\n・國際：USD 7,999\n\n含課程、住宿、三餐、保險等\n不含機票\n\n想了解更多？', ['好啊 👋', '先想想']);
          nextState = 'showed_info'; break;
        case 'ask_info':
          messages = askAgeMsg(); nextState = 'ask_age'; break;
        case 'alumni':
          messages = textMsg('歡迎回來！🎓\n請問你是什麼時候參加的什麼課程？\n（例如：2024 HSS）');
          nextState = 'alumni_wait'; break;
        case 'hss':
          messages = buttons('HSS 是高強度的任務訓練環境：\n\n・Mission Control 模擬\n・AI + Space 決策訓練\n・與 NASA / 產業環境接觸\n\n2026 費用 USD 5,980（台灣學員）\n\n要不要花 10 分鐘免費線上諮詢？', ['好啊 👋', '先想想']);
          program = 'HSS'; nextState = 'showed_info'; break;
        case 'jss':
          messages = buttons('JSS 初階太空學校（5-9年級）：\n\n・太空任務基礎訓練\n・團隊合作與問題解決\n・建立科學思維與國際視野\n\n要不要花 10 分鐘免費線上諮詢？', ['好啊 👋', '先想想']);
          program = 'JSS'; nextState = 'showed_info'; break;
        case 'webinar':
          messages = textMsg('這裡可以報名說明會 👉\nhttps://tcghss.spaceschool.org/webinar\n\n有問題隨時問我們 😊');
          nextState = 'done'; break;
        case 'greeting':
          messages = welcomeMsg(); nextState = 'welcome'; break;
        default: {
          const ageResult2 = detectAge(messageText);
          if (ageResult2 === 'young') {
            messages = textMsg('1–4 年級適合我們的「科學探索營」🔬\n\n我請專人跟你聯繫，幫你了解詳細內容 😊\n請稍等一下～');
            ghlAction = 'young_student'; nextState = 'done';
          } else if (ageResult2 === 'jss') {
            messages = buttons('根據年級，推薦 JSS 初階太空學校 😊\n\n・太空任務基礎訓練\n・團隊合作與問題解決\n・建立科學思維與國際視野\n\n要不要花 10 分鐘免費線上諮詢？', ['好啊 👋', '先想想']);
            program = 'JSS'; nextState = 'showed_info';
          } else if (ageResult2 === 'hss') {
            messages = buttons('根據年級，推薦 HSS 高階太空學校 😊\n\n・Mission Control 模擬\n・AI + Space 決策訓練\n・與 NASA / 產業環境接觸\n\n2026 費用 USD 5,980（台灣學員）\n\n要不要花 10 分鐘免費線上諮詢？', ['好啊 👋', '先想想']);
            program = 'HSS'; nextState = 'showed_info';
          } else {
            needsAI = true;
            aiBody = buildAIBody(messageText, userData.program || '');
            ghlAction = 'cs_question';
            nextState = 'done';
          }
          break;
        }
      }
    }
  }
}

staticData.users[lineUserId] = { state: nextState, program: program || userData.program || '', updatedAt: Date.now() };
return { replyToken, messages, ghlAction, needsAI, aiBody, messageText, displayName, lineUserId, state: nextState, program: program || userData.program || '' };
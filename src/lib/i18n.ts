// 双语词典：繁體中文 / English。界面文案与日志均经 t() 渲染。

export type Lang = "zh-Hant" | "en";
export const LANGS: { key: Lang; label: string }[] = [
  { key: "zh-Hant", label: "繁體中文" },
  { key: "en", label: "English" },
];

export const LANG_KEY = "gpu-king-lang";
/** 旧语言键（gpu-tycoon 时代）：新键读不到时回退读取 */
const LEGACY_LANG_KEY = "gpu-tycoon-lang";
/** SSR 与客户端首帧的默认语言：保证首屏文本一致，挂载后再换成存储值 */
export const DEFAULT_LANG: Lang = "en";

export function loadLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const saved = localStorage.getItem(LANG_KEY) ?? localStorage.getItem(LEGACY_LANG_KEY);
  return saved === "zh-Hant" ? "zh-Hant" : DEFAULT_LANG;
}

type Dict = Record<string, string>;

const zh: Dict = {
  "app.subtitle":
    "三人出資 {cap} USD − 註冊費 {fee} = 帳戶 {funds} USD · 決策投票 · 四域聲望",
  "app.yieldLine":
    "年化利率 {now}（地板 5% + 產能加成，上限 {capNow}）· 分紅池 {div} USD",
  "header.nameOnce": "為公司命名（僅可一次）",
  "header.nameNew": "新公司名稱",
  "header.placeholder": "字母+數字，1~20 位",
  "header.nameOk":
    "僅允許字母 A-Z a-z 與數字 0-9，空格/中文/符號/底線都會被拒絕",
  "header.errChars": "僅允許字母+數字，1~20 位，不能有空格或符號",
  "header.errReserved": "public / shop / donate 是保留路徑，請換個名字",
  "header.errEmpty": "請輸入公司名",
  "header.foundBtn": "成立（-{fee} USD）",
  "header.renameBtn": "命名",
  "card.live": "實時 +{rate} USD/s",
  "card.mcap": "市值 {mcap} USD（歸隊繳 1/{div}）",
  "card.lateOn": "已進後期",
  "card.lateOff": "達 {n} HASH/s 解鎖 25% 上限",
  "hash.title": "{n} HASH",
  "hash.passive": "被動 +{rate} HASH/s · 點擊 +1 HASH",
  "hash.note": "點擊計入 {m} 貢獻度（影響分紅佔比）",
  "hash.noteDissolved": " · 公司已解散，停產停息",
  "member.out": "離隊",
  "member.contrib": "貢獻 {n} 擊",
  "member.share": "（{pct}%）",
  "member.composite": "綜合 {n}",
  "rep.dev": "開發者",
  "rep.factory": "硬件工廠",
  "rep.media": "媒體",
  "rep.ai": "AI 公司",

  // —— 個人錢包卡 ——
  "wallet.title": "個人錢包",
  "wallet.hint": "離隊結算款暫存於此，歸隊時用作補繳",
  "wallet.enterShop": "商店",
  "wallet.enterDonate": "捐贈",

  // —— 捐贈頁（路由 /public）——
  "public.title": "算力捐贈",
  "donate.title": "算力捐贈",
  "donate.subtitle":
    "向社會各界捐贈 HASH 算力，換取該領域聲望 · 價格隨累計捐贈次數成長 · 受益人：當前操作成員",
  "donate.balance": "HASH 餘額 {n}",
  "donate.gain": "+{n} 聲望",
  "donate.cost": "捐贈 {n} HASH",
  "donate.times": "已捐 {n} 次",
  "donate.lack": "差 {n} HASH",
  "donate.coffee": "咖啡因開源基金會 · 贊助開發者咖啡",
  "donate.coffee.desc": "給一線程式設計師續命 → 開發者聲望 +{n}",
  "donate.keyboard": "鄉村機房鍵盤捐贈計劃",
  "donate.keyboard.desc": "為小廠工程師升級外设 → 硬件工廠聲望 +{n}",
  "donate.snowflake": "算力製冷公益基金",
  "donate.snowflake.desc": "為 AI 實驗室捐贈散熱 → AI 公司聲望 +{n}",
  "donate.megaphone": "開源宣發贊助基金",
  "donate.megaphone.desc": "替科技媒體買熱搜 → 媒體聲望 +{n}",

  // —— 消費商店 ——
  "shop.title": "消費商店",
  "shop.subtitle": "公司帳戶 USD 計價 · 純消費、無經營回報（除了開心）",
  "shop.balance": "帳戶 {bal}",
  "shop.jacket": "Tom Ford 黑色夾克",
  "shop.jacket.desc": "矽谷符號单品。僅可持有 1 件，無數值用途，純玩梗。",
  "shop.glasses": "黑框眼鏡",
  "shop.glasses.desc": "僅可持有 1 件。戴上發言權 +0，但看起來像創始人。",
  "shop.dur": "耐久 {left}/{total} · 每日 -1",
  "shop.worn": "已磨損 · 可買新的",
  "shop.holding": "持有中",
  "rank.usdTitle": "USD 世界排名",
  "rank.hashTitle": "HASH 世界排名",
  "rank.tabUsd": "USD 榜",
  "rank.tabHash": "HASH 榜",
  "shop.topup": "手機話費充值",
  "shop.topup.desc": "按實時匯率折算 USD · 地區與面值在彈窗內選擇",
  "shop.topup.open": "購買",
  "shop.topup.modalTitle": "手機話費充值",
  "shop.topup.fx": "1 USD ≈ {rate} {cur}",
  "shop.topup.fxMeta": "匯率 {date} · 來源 {source}",
  "shop.topup.fxOffline": "離線匯率（備用值）",
  "shop.topup.fxFallbackMeta": "離線兜底值 · 非實時匯率 · 來源 {source}",
  "shop.topup.cost": "應付 {usd} USD",
  "shop.topup.confirm": "確認充值",
  "shop.topup.cancel": "取消",
  "shop.topup.close": "關閉",
  "shop.region": "國家 / 地區",
  "shop.region.cn": "中國大陸",
  "shop.region.hk": "中國香港",
  "shop.amount": "充值金額",
  "shop.doTopup": "充值",
  "shop.buy": "購買",
  "shop.owned": "已購 {n}",
  "shop.lack": "差 {n} USD",

  "quit.btn": "辭職離隊（本金 0 USD + 分紅 {div} USD）",
  "vote.titleExpand": "擴產表決：{gpu}（{cost} HASH）",
  "vote.titleKick": "罷免表決：{m}",
  "vote.by": "發起 {m}",
  "vote.tally": "贊成 {yes} · 反對 {no}（需 ≥{need} 票）",
  "vote.waiting": " 待投票：{m}",
  "vote.yes": "贊成",
  "vote.no": "反對",
  "vote.passed": "已生效",
  "vote.failed": "通過但執行失敗（掉聲望）",
  "vote.rejected": "未通過",
  "vote.close": "關閉",
  "staff.short": "缺員：「{name}」只剩 {n}/{size} 人 · 罷免功能已鎖定",
  "staff.note":
    "公司市值 {cap}，歸隊需補繳市值 1/{div} = {cost} USD（從其離隊結算款扣除，注入公司池）。四域聲望歸 {newbie}。恢復滿編後才能再次罷免。",
  "staff.recall": "召回 {m}（補繳 {cost} USD）",
  "staff.wallet": "錢包 {n}",
  "staff.shortGap": " · 缺 {n}",
  "dissolved.title": "公司已解散",
  "dissolved.note":
    "在上方命名面板輸入新公司名（字母+數字）並繳納註冊費 {fee} USD 即可重新成立。當前帳戶 {usd} USD。",
  "contrib.title": "貢獻度（點擊次數）",
  "contrib.locked": "滿編後可罷免",
  "contrib.clicks": "{m}：{n} 擊",
  "contrib.share": "（{pct}%）",
  "contrib.kick": "罷免",
  "contrib.tipKicked": "貢獻度過低，發起罷免表決",
  "contrib.tipStaff": "公司缺員，補位恢復滿編後才能罷免",
  "contrib.tipDefault": "貢獻度達標或流程限制，暫不可罷免",
  "contrib.rule":
    "規則：滿編 {size} 人才能罷免（防連鎖）；貢獻度低於均值 40% 可被提案；罷免案需 {need} 票，被罷免者迴避。",
  "gpu.title": "GPU 代際 · 以 HASH 投資擴產（19 款）",
  "gpu.line1": "{name} ({year})",
  "gpu.line2": "+{h} HASH/s 產能（年化 +{y}%）· 擁有 {n} 台 · 成功率",
  "gpu.by": "（{m} 綜合 {c} · 品牌 {b}）",
  "gpu.lack": " · 還差 {n} HASH",
  "gpu.propose": "{cost} 提案",
  "log.title": "公司動態",
  "foot.note":
    "本機熱座：三位成員輪流在同一頁面點擊、投票。辭職本金歸零、只按貢獻分紅；被罷免另有本金 200；擴產成敗影響「硬件工廠 / AI 公司」，被罷免傷「媒體」。數據保存在本地。",
  "lang.switch": "語言",
  "nav.home": "首頁",
  "nav.company": "公司",
  // —— 導航三頂（固定英文標籤，兩語一致，避免命名漂移）——
  "nav.co": "Co: {name}",
  "nav.coEmpty": "Co",
  "nav.public": "Public",
  "nav.shop": "Shop",
  "home.addr": "公司地址",
  "home.copy": "複製",
  "home.copied": "已複製",
  "home.copyFail": "複製失敗",
  "rank.title": "全网公司排名",
  "rank.note": "本地模擬榜：對手公司為遊戲內數據，跨用戶訪問留待後端階段",
  "rank.name": "公司",
  "rank.mcap": "市值",
  "rank.hash": "HASH",
  "rank.you": "你",
  "rank.dissolved": "已解散",
  "companyPage.title": "公司詳情",
  "companyPage.shareholders": "三位股東",
  "companyPage.asset": "資產 {usd}",
  "companyPage.notFound": "沒有這家公司的記錄",
  "companyPage.switchHint": "點卡片可切換當前操作股東",
  "companyPage.notFoundHint": "你的公司地址是 {url}；若已解散請重新註冊。",
  "staff.goCompany": "→ 到公司頁補位",
  "section.personal": "個人賬戶與聲望",
  "section.company": "公司賬戶與經營",
  "section.companyBalance": "公司餘額",
  "section.gpuGenerations": "GPU 代際 · 經營",
  "section.shareholders": "股東",
  "section.companyDetail": "公司詳情",
  "companyDetail.empty": "尚未成立公司 · 請先在上方命名",
  "companyPage.publicOnly":
    "這是「{name}」的公開頁面 · 只讀，操作請回 Co 頁",
  "companyPage.backToCo": "← 返回 Co 頁",
  "companyPage.readOnlyAction": "公開頁只讀 · 需在 Co 頁操作",
  "companyRep.title": "公司聲望 · 品牌",
  "companyRep.link":
    "關聯規則：個人捐贈時公司同域 +½（向上取整）；擴產成功 工廠/AI 各 +2；擴產失敗照扣 HASH，且 工廠 -5 · 媒體 -2；罷免鬧翻 公司媒體 -3；擴產成功率 = 個人綜合 70% + 品牌綜合 30%；新人起始聲望隨品牌浮動",
  "donate.personalNow": "{m}：{v}",
  "donate.companyNow": "公司：{v}",

  // —— 日志模板 ——
  "log.boot": "三人出資共 {cap} USD，繳註冊費 {fee}，帳戶 {funds} USD",
  "log.rename": "公司命名為「{name}」",
  "log.found": "成立公司「{name}」：創始人出資 {seed} USD（優先動用贈金），繳註冊費 {fee} USD（{n} 人均攤），分紅池重置",
  "log.kickStart": "{by} 發起罷免 {target}（貢獻度過低）",
  "log.rejected": "表決未通過（{yes} 贊成 / {no} 反對），本次決策作廢",
  "log.expandOk":
    "擴產通過：投入 {cost} HASH 建設 {gpu}（+{h} HASH/s，{roll} < {chance}），{m} 硬件工廠 +{f} · AI 公司 +{a}；公司品牌 工廠/AI 各 +{cg}",
  "log.expandFail":
    "擴產失敗：{gpu} 投產翻車（{roll} ≥ {chance}），{cost} HASH 已燒掉，{m} 硬件工廠 -{f}；公司品牌 工廠 -{cff} · 媒體 -{cfm}",
  "log.quit": "{m} 辭職離隊：本金 0 + 分紅 {d} = {t} USD（結算款入個人錢包）",
  "log.kickOut": "{m} 被罷免離隊：收回本金 {p} + 分紅 {d} = {t} USD，媒體聲望 -{media}；公司媒體 -{cmg}",
  "log.dissolved": "公司已無人，自動解散",
  "log.recruit": "{m} 補繳 {cost} USD（市值 {cap} × 1/{div}）歸隊，起始聲望 {nb}（隨品牌）",
  "log.offline": "離線收益 +{usd} USD · +{hash} HASH",
  "log.donate": "{m} 捐贈 {cost} HASH（{d}），{dom} 聲望 +{gain}；公司同域 +{cg}",
  "log.buy": "{m} 在商店購買 {g}，花費 {price} USD",
  "log.buyDur": "{m} 在商店購買 {g}，花費 {price} USD（耐久 {dur} 天，僅此一件）",
  "log.topup": "{m} 向 {r} 充值 {cur}{amount}，扣 {usd} USD（匯率 1 USD ≈ {rate} {cur}）",
  "log.inviteJoin": "受邀股東 {d} 入駐：獲贈金 {usd} USD（僅限出資，不可消費）",
  "log.inviteGift": "成功邀請 1 人，獲 1 個邀請禮盒（未開 {boxes} 個）",
  "log.giftOpen": "開啟邀請禮盒（來自 {from}）：抽中 {d}，公司 {dom} 聲望 +{gain}",
  "member.prefix": "成員 ",
};

const en: Dict = {
  "app.subtitle":
    "3 founders pool {cap} USD − {fee} incorporation fee = {funds} USD · voting · 4-domain reputation",
  "app.yieldLine":
    "APY {now} (5% floor + capacity bonus, cap {capNow}) · dividend pool {div} USD",
  "header.nameOnce": "Name your company (one time only)",
  "header.nameNew": "New company name",
  "header.placeholder": "letters + digits, 1-20 chars",
  "header.nameOk":
    "Strict: only A-Z a-z and 0-9. Spaces, CJK, symbols, underscores are rejected",
  "header.errChars": "Letters + digits only, 1-20 chars, no spaces or symbols",
  "header.errReserved": "public / shop / donate are reserved paths — pick another name",
  "header.errEmpty": "Enter a company name",
  "header.foundBtn": "Found (-{fee} USD)",
  "header.renameBtn": "Name it",
  "card.live": "live +{rate} USD/s",
  "card.mcap": "mcap {mcap} USD (rejoin fee 1/{div})",
  "card.lateOn": "late game",
  "card.lateOff": "{n} HASH/s unlocks 25% cap",
  "hash.title": "{n} HASH",
  "hash.passive": "passive +{rate} HASH/s · click +1 HASH",
  "hash.note": "Clicks count toward {m}'s contribution (drives dividend share)",
  "hash.noteDissolved": " · company dissolved, no yield",
  "member.out": "left",
  "member.contrib": "{n} clicks",
  "member.share": " ({pct}%)",
  "member.composite": "composite {n}",
  "rep.dev": "Dev",
  "rep.factory": "Fab",
  "rep.media": "Media",
  "rep.ai": "AI Co",

  // —— Personal wallet ——
  "wallet.title": "Personal Wallet",
  "wallet.hint": "Exit settlements land here; used to pay the rejoin fee",
  "wallet.enterShop": "Shop",
  "wallet.enterDonate": "Donate",

  // —— Donations page (route /public) ——
  "public.title": "Hash Donations",
  "donate.title": "Hash Donations",
  "donate.subtitle":
    "Give HASH to the community for reputation in that domain · prices scale with donations · beneficiary: the active member",
  "donate.balance": "HASH balance {n}",
  "donate.gain": "+{n} rep",
  "donate.cost": "Donate {n} HASH",
  "donate.times": "donated {n}×",
  "donate.lack": "short {n} HASH",
  "donate.coffee": "Caffeine OSS Foundation · sponsor devs' coffee",
  "donate.coffee.desc": "Fuel for coders on the ground → Dev rep +{n}",
  "donate.keyboard": "Rural Server Room Keyboard Drive",
  "donate.keyboard.desc": "Better gear for fab engineers → Fab rep +{n}",
  "donate.snowflake": "Compute Cooling Charity Fund",
  "donate.snowflake.desc": "Cooling rigs for AI labs → AI Co rep +{n}",
  "donate.megaphone": "Open-Source PR Grant",
  "donate.megaphone.desc": "Trending slots for tech media → Media rep +{n}",

  // —— Shop ——
  "shop.title": "Consumer Shop",
  "shop.subtitle": "Paid from the company USD balance · pure consumption, zero ROI (except vibes)",
  "shop.balance": "balance {bal}",
  "shop.jacket": "Tom Ford Black Jacket",
  "shop.jacket.desc": "Silicon Valley power dress. Only 1 can be owned; no real use, pure meme.",
  "shop.glasses": "Black-framed Glasses",
  "shop.glasses.desc": "Only 1 can be owned. +0 speaking authority, but you look like a founder.",
  "shop.dur": "durability {left}/{total} · -1/day",
  "shop.worn": "worn out · buy a new one",
  "shop.holding": "in use",
  "rank.usdTitle": "USD World Ranking",
  "rank.hashTitle": "HASH World Ranking",
  "rank.tabUsd": "USD",
  "rank.tabHash": "HASH",
  "shop.topup": "Mobile Top-up",
  "shop.topup.desc": "Converted to USD at live rates · pick region and amount in the dialog",
  "shop.topup.open": "Buy",
  "shop.topup.modalTitle": "Mobile Top-up",
  "shop.topup.fx": "1 USD ≈ {rate} {cur}",
  "shop.topup.fxMeta": "Rate {date} · source {source}",
  "shop.topup.fxOffline": "Offline rate (fallback)",
  "shop.topup.fxFallbackMeta": "Offline fallback · not a live rate · source {source}",
  "shop.topup.cost": "Due {usd} USD",
  "shop.topup.confirm": "Confirm top-up",
  "shop.topup.cancel": "Cancel",
  "shop.topup.close": "Close",
  "shop.region": "Country / Region",
  "shop.region.cn": "Mainland China",
  "shop.region.hk": "Hong Kong, China",
  "shop.amount": "Amount",
  "shop.doTopup": "Top up",
  "shop.buy": "Buy",
  "shop.owned": "owned {n}",
  "shop.lack": "short {n} USD",

  "quit.btn": "Quit (principal 0 USD + dividend {div})",
  "vote.titleExpand": "Expansion vote: {gpu} ({cost} HASH)",
  "vote.titleKick": "Recall vote: {m}",
  "vote.by": "by {m}",
  "vote.tally": "Yes {yes} · No {no} (need ≥{need})",
  "vote.waiting": " awaiting: {m}",
  "vote.yes": "Yes",
  "vote.no": "No",
  "vote.passed": "Passed",
  "vote.failed": "Passed but execution failed (rep hit)",
  "vote.rejected": "Rejected",
  "vote.close": "Close",
  "staff.short": 'Vacancy: "{name}" has only {n}/{size} · recall locked',
  "staff.note":
    "Market cap {cap}; rejoining costs 1/{div} of cap = {cost} USD, paid from their settlement wallet into the pool. Reps reset to {newbie}. Recall unlocks again at full staff.",
  "staff.recall": "Recall {m} (pay {cost} USD)",
  "staff.wallet": "wallet {n}",
  "staff.shortGap": " · short {n}",
  "dissolved.title": "Company dissolved",
  "dissolved.note":
    "Type a new name above (letters + digits) and pay the {fee} USD incorporation fee to re-found. Current balance {usd} USD.",
  "contrib.title": "Contribution (clicks)",
  "contrib.locked": "recall unlocks at full staff",
  "contrib.clicks": "{m}: {n} clicks",
  "contrib.share": " ({pct}%)",
  "contrib.kick": "Recall",
  "contrib.tipKicked": "Contribution too low — open a recall vote",
  "contrib.tipStaff": "Staff short — fill the seat before recalling again",
  "contrib.tipDefault": "Contribution OK or blocked by process",
  "contrib.rule":
    "Rules: recall only at full staff of {size} (anti-cascade); below 40% of average is recallable; a recall needs {need} votes; the target abstains.",
  "gpu.title": "GPU generations · expand with HASH (19 SKUs)",
  "gpu.line1": "{name} ({year})",
  "gpu.line2": "+{h} HASH/s capacity (APY +{y}%) · owned {n} · success",
  "gpu.by": " ({m} composite {c} · brand {b})",
  "gpu.lack": " · need {n} more HASH",
  "gpu.propose": "{cost} propose",
  "log.title": "Company feed",
  "foot.note":
    "Local hotseat: 3 members take turns clicking and voting on one page. Quitting forfeits principal — you only keep the contribution-weighted dividend; a recall pays principal 200 too. Expansion results move Fab/AI-Co rep; being recalled hurts Media. Data stays on this machine.",
  "lang.switch": "Language",
  "nav.home": "Home",
  "nav.company": "Company",
  // —— top nav (fixed English labels in both languages) ——
  "nav.co": "Co: {name}",
  "nav.coEmpty": "Co",
  "nav.public": "Public",
  "nav.shop": "Shop",
  "home.addr": "Company address",
  "home.copy": "Copy",
  "home.copied": "Copied",
  "home.copyFail": "Copy failed",
  "rank.title": "Global Leaderboard",
  "rank.note": "Local simulated board: rivals are in-game data; real cross-user access comes with the backend phase",
  "rank.name": "Company",
  "rank.mcap": "Mcap",
  "rank.hash": "HASH",
  "rank.you": "You",
  "rank.dissolved": "dissolved",
  "companyPage.title": "Company detail",
  "companyPage.shareholders": "Shareholders",
  "companyPage.asset": "assets {usd}",
  "companyPage.notFound": "No such company on this host",
  "companyPage.switchHint": "Tap a card to switch the acting shareholder",
  "companyPage.notFoundHint": "Your company lives at {url}; re-incorporate if it was dissolved.",
  "staff.goCompany": "→ open the company page to refill the seat",
  "section.personal": "Personal account & reputation",
  "section.company": "Company account & operations",
  "section.companyBalance": "Company balance",
  "section.gpuGenerations": "GPU generations (operations)",
  "section.shareholders": "Shareholders",
  "section.companyDetail": "Company detail",
  "companyDetail.empty": "No company yet — name one above",
  "companyPage.publicOnly":
    'This is the public page for "{name}" · read only — operate from your Co page',
  "companyPage.backToCo": "← Back to my Co page",
  "companyPage.readOnlyAction": "Public page is read-only — operate from your Co page",
  "companyRep.title": "Company reputation · brand",
  "companyRep.link":
    "Linkage: donations also give the brand half the rep (round up); expansion success boosts brand Fab/AI Co +2 each; expansion failure burns the HASH budget and hits brand Fab -5 · Media -2; a hostile recall dents brand Media -3; success chance = personal 70% + brand 30%; newcomers' starting rep scales with the brand",
  "donate.personalNow": "{m}: {v}",
  "donate.companyNow": "brand: {v}",

  "log.boot": "3 founders pooled {cap} USD, paid {fee} incorporation fee, balance {funds} USD",
  "log.rename": 'Company named "{name}"',
  "log.found": "Founded \"{name}\": founders paid in {seed} USD (grants first), {fee} USD incorporation fee split across {n}, dividend pool reset",
  "log.kickStart": "{by} filed a recall against {target} (contribution too low)",
  "log.rejected": "Vote failed ({yes} yes / {no} no) — decision void",
  "log.expandOk":
    "Expansion passed: spent {cost} HASH on {gpu} (+{h} HASH/s, roll {roll} < {chance}); {m} Fab +{f} · AI Co +{a}; brand Fab/AI Co +{cg} each",
  "log.expandFail":
    "Expansion failed: {gpu} flopped (roll {roll} ≥ {chance}); {cost} HASH burned; {m} Fab -{f}; brand Fab -{cff} · Media -{cfm}",
  "log.quit": "{m} quit: principal 0 + dividend {d} = {t} USD (settled to personal wallet)",
  "log.kickOut": "{m} recalled: principal {p} + dividend {d} = {t} USD; Media rep -{media}; brand Media -{cmg}",
  "log.dissolved": "No shareholders left — company dissolved",
  "log.recruit": "{m} rejoined, paying {cost} USD (cap {cap} ÷ {div}); starting rep {nb} (brand-scaled)",
  "log.offline": "Offline gain +{usd} USD · +{hash} HASH",
  "log.donate": "{m} donated {cost} HASH ({d}); {dom} rep +{gain}; same-domain brand +{cg}",
  "log.buy": "{m} bought {g} at the shop for {price} USD",
  "log.buyDur": "{m} bought {g} at the shop for {price} USD ({dur}-day durability, one of one)",
  "log.topup": "{m} topped up {cur}{amount} for {r}, charged {usd} USD (rate 1 USD ≈ {rate} {cur})",
  "log.inviteJoin": "Invited shareholder {d} joined: grant +{usd} USD (funding only, non-spendable)",
  "log.inviteGift": "1 successful invite → 1 invite gift box ({boxes} unopened)",
  "log.giftOpen": "Opened invite gift box (from {from}): drew {d}; company {dom} rep +{gain}",
  "member.prefix": "Member ",
};

const DICTS: Record<Lang, Dict> = { "zh-Hant": zh, en };

export function t(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>,
): string {
  const raw = DICTS[lang][key] ?? DICTS["zh-Hant"][key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) =>
    k in params ? String(params[k]) : `{${k}}`,
  );
}

/** 日志参数若本身是词典键（如 rep.factory），翻译后再注入模板 */
export function translateParams(
  lang: Lang,
  params?: Record<string, string | number>,
): Record<string, string | number> | undefined {
  if (!params) return params;
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = typeof v === "string" && DICTS[lang][v] !== undefined ? t(lang, v) : v;
  }
  return out;
}

/** 成员显示名：zh-Hant「成員 A」/ en「Member A」 */
export function memberLabel(lang: Lang, code: string): string {
  return `${t(lang, "member.prefix")}${code}`;
}

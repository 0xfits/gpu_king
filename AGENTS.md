# gpu-tycoon 项目规则

## 图标
- 所有界面图标一律使用 Lucide 图标集（lucide-static，ISC License），以 src/components/icons.tsx 中的内联 SVG 组件形式引用，禁止 emoji 与其它图标库。
- 新增图标需求时：从 https://unpkg.com/lucide-static@latest/icons/<name>.svg 下载官方 SVG，把形状路径并入 icons.tsx（stroke=currentColor，尺寸由 size 参数控制），并在此处登记用途。
- 现有映射：四域声望 dev=terminal、factory=cpu、media=clapperboard、ai=brain-circuit；入口按钮 商店=shopping-cart、捐赠=heart-handshake、个人钱包=wallet、辞职=door-open；反馈 check-circle / x-circle / alert-triangle；商品 shirt / glasses / smartphone / coffee / keyboard / snowflake / megaphone / gift / coins / zap / pickaxe / dollar-sign / banknote / user / globe / heart / building-2 / chevron-right / arrow-left / plus。

## 其它约定
- 界面文案一律经 src/lib/i18n.ts 词典（zh-Hant / en 双语）渲染，日志存储消息键+参数，不在逻辑层拼接自然语言。
- 游戏数值与规则集中在 src/lib/game.ts，保持 reducer 纯函数；随机数用确定性 rng 状态。
- 金额展示：USD 主段 6 位小数 + pUSD 小字号副段；余额浮点存储，仅展示时拆分。
- 扩产决策需董事会投票；商店/捐赠为消费通道，不需投票。

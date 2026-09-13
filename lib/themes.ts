export const THEMES = [
  "10年後の家族へのメッセージ",
  "今日、自分を一番驚かせたこと",
  "20年後の自分に聞きたいこと",
  "今は言えないが10年後なら言えること",
  "子どもの頃の自分に、今なら伝えられること",
  "10年前に手放してよかった思い込み",
  "未来の誰かに残したい、失敗の理由",
  "今の仕事で、説明書には書けない知恵",
  "もう会えない人から受け取った言葉",
  "2036年にも変わらず大切にしていたい習慣",
  "未来の家族に覚えていてほしい、今日の何でもない風景",
  "過去の自分が聞いたら笑う、今の悩み",
  "あのとき選ばなかった道を、今どう思う？",
  "誰にも褒められなかったけれど、誇りに思うこと",
  "10年後にはなくなっていてほしい不便",
  "今は当たり前で、未来には珍しくなりそうなこと",
  "初めて勇気を出した日の自分への返事",
  "未来の後輩に渡したい、判断に迷ったときの基準",
  "忘れたくない、家族の小さな口癖",
  "未来の自分に引き継ぎたい、まだ解けていない問い",
  "昔は理解できなかったが、今ならわかる言葉",
  "10年かけても続けたい、小さな挑戦",
  "今日やめたことを、未来の自分はどう評価する？",
  "過去の失敗から生まれた、自分だけの工夫",
  "今の自分を支えている、誰かの見えない仕事",
  "未来に残したい、この場所の記憶",
  "10年後の自分と答え合わせしたい予想",
  "大人になってから変わった、幸せの定義",
  "次の世代に押しつけず、そっと渡したい経験",
  "今日の自分に、未来からどんな返事がほしい？",
] as const;

export function todayJst(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function themeForDate(date = todayJst()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error("date は実在する日付を YYYY-MM-DD で指定してください");
  }
  let hash = 0;
  for (const c of date) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  const index = hash % THEMES.length;
  return { date, theme: THEMES[index], index };
}

# りょっぴー Web Alpha

Cincinnatiを歩いて歴史人物に会い、資産戦闘力、お金のヒミツ、街とのつながり、写真の思い出を集める静的Webアプリです。GitHub Pagesへそのまま公開できます。ビルドツールと専用サーバーは不要です。

## 機能
- 1950年代アメリカン・ポップのモバイル優先UI
- 3人物、6スポット、18関係ノード
- ブラウザ位置情報と自宅用位置デモ
- 一人称の導入、人物ごとの口調、選択式質問
- ブラウザ読み上げと全文テキスト
- 現代ドル換算の推定資産、資産戦闘力、ランク
- 富の内訳、資産推移
- 人物図鑑
- 写真のブラウザ内保存
- PWAマニフェストとオフラインキャッシュ
- $6.99完全版のモック購入

## ローカル確認
```bash
python3 -m http.server 4173
```
ブラウザで `http://localhost:4173` を開きます。

検査:
```bash
node scripts/validate.mjs
```

## GitHub Pagesへ公開
1. GitHubで空のリポジトリを作る
2. このフォルダの内容をpushする
3. `Settings → Pages → Build and deployment → Source → GitHub Actions` を選ぶ

```bash
git init
git add .
git commit -m "Add Ryoppy Web Alpha"
git branch -M main
git remote add origin git@github.com:YOUR_NAME/ryoppy-web.git
git push -u origin main
```

公開URL例:
```text
https://YOUR_NAME.github.io/ryoppy-web/
```

## 保存
- 人物進捗と設定: localStorage
- 写真: IndexedDB
- 保存範囲: 現在のブラウザと端末

## 資産データ
Alphaの資産額、内訳、推移はUI検証用の仮推定値です。公開コンテンツへ進む際に人物ごとの再調査を行います。

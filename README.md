# りょっぴー Encounter Alpha

Cincinnatiを歩き、現地に近づくとその土地を築いた歴史人物が出現する、位置情報連動型の歴史図鑑ゲームです。

Web Alpha v0.3は、Streetcar沿線の探索地図から信号を追い、Christian Moerleinと遭遇する一本の体験へ集中しています。

## 体験の流れ

1. Streetcar沿線の6地点から、脈打つ人物信号を選ぶ
2. 距離を確かめて現地へ近づく、または位置デモで移動する
3. 歴史人物が画面いっぱいに出現する
4. 本人の短い物語を読む、または聞く
5. 質問して人物と街のつながりを発見する
6. 人物を図鑑へ記録する

人物の進捗と最後に選んだ信号はlocalStorageへ保存します。未発見地点は謎の信号として表示され、発見後は地図上の印が人物の顔と名前へ変わります。位置情報、音声読み上げ、Service Workerによるオフラインキャッシュをブラウザ標準機能だけで実装しています。

## ローカル確認

```bash
python3 -m http.server 4173
```

ブラウザで `http://localhost:4173` を開きます。

検査:

```bash
node scripts/validate.mjs
```

## GitHub Pages

`main`へpushするとGitHub Actionsが内容を検査し、自動公開します。

公開URL:

```text
https://agenthub-core.github.io/ryoppy-web/
```

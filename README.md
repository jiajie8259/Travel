新增的共用檔案
Travel/
├── css/
│   ├── base.css        (64 行)   CSS 變數、Reset
│   ├── trip-page.css   (661 行)  行程頁共用版面
│   ├── tracker.css     (351 行)  消費追蹤器樣式
│   └── index.css       (330 行)  首頁專用樣式
└── js/
    ├── tabs.js         (60 行)   Tab 切換（共用）
    ├── tracker.js      (815 行)  追蹤器引擎（共用）
    ├── export.js       (211 行)  Excel 匯出（共用）
    └── index.js        (191 行)  首頁 Modal 邏輯

未來新增旅程的方式
只需在新的 xxxx_城市.html 裡定義一個 TRIP_CONFIG 物件（約 40 行），再引用四個共用 <link> 和三個 <script> 標籤，所有追蹤器、匯出、Tab 邏輯自動就位，無需複製貼上任何 JS/CSS。

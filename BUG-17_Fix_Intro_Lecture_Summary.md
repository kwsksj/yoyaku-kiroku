# 【作業計画書】全教室における初回講習サマリーの不具合修正 (BUG-17)

**【問題の概要】**
現在、サマリーシートの集計ロジックにおいて、「初回講習」の予約数が東京教室以外（つくば教室、沼津教室）で正しくカウントされておらず、サマリーシートに表示されていない。

**【原因】**
1.  `_getReservationCountsForDate`（部分更新時の予約数集計）が、東京教室以外の初回講習をカウントしていない。
2.  `rebuildSummarySheet`（全再構築時の予約数集計）が、同様に東京教室以外の初回講習をカウントしていない。
3.  `_createSummaryRowData`（サマリー行生成）が、東京教室以外の初回講習行を生成するロジックを持たない。

**【修正方針】**
上記の関数群を修正し、全ての教室で「初回講習」が正しく集計・表示されるようにする。空席数の計算は、各教室のルール（つくばは午後、沼津は全日）に準拠する。

---

### 【修正提案】

#### 1. サマリー集計ロジックの汎用化 (`03_BusinessLogic_Summary.js`)

`rebuildSummarySheet`、`_getReservationCountsForDate`、`_createSummaryRowData`の3つの関数を修正し、全ての教室で初回講習を正しく扱えるようにします。

```diff
--- a/home/shiawasenahito3000/GAS-projects/yoyaku-kiroku/03_BusinessLogic_Summary.js
+++ b/home/shiawasenahito3000/GAS-projects/yoyaku-kiroku/03_BusinessLogic_Summary.js
@@ -183,9 +183,9 @@
                 
                 let sessionsToCreate = [];
                 if (sheetName === TSUKUBA_CLASSROOM_NAME) {
-                    sessionsToCreate.push(SESSION_MORNING, SESSION_AFTERNOON);
+                    sessionsToCreate.push(SESSION_MORNING, SESSION_AFTERNOON, ITEM_NAME_FIRST_LECTURE);
                 } else if (sheetName === TOKYO_CLASSROOM_NAME) {
                     sessionsToCreate.push(ITEM_NAME_MAIN_LECTURE, ITEM_NAME_FIRST_LECTURE);
                 } else {
-                    sessionsToCreate.push(SESSION_ALL_DAY);
+                    sessionsToCreate.push(SESSION_ALL_DAY, ITEM_NAME_FIRST_LECTURE);
                 }
 
                 sessionsToCreate.forEach(session => {
@@ -221,6 +221,7 @@
                     return;
                 }
 
+                const isFirstLecture = firstLectureIdx !== undefined && row[firstLectureIdx] === true;
                 const dateString = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
                 
                 if (sheetName === TSUKUBA_CLASSROOM_NAME) {
@@ -234,18 +235,26 @@
                         if (startHour < TSUKUBA_MORNING_SESSION_END_HOUR) {
                             const key = `${dateString}|${sheetName}|${SESSION_MORNING}`;
                             if (summaryAggregator.has(key)) summaryAggregator.get(key).count++;
                         }
-                        if (endHour > TSUKUBA_MORNING_SESSION_END_HOUR || (endHour === TSUKUBA_MORNING_SESSION_END_HOUR && endMinutes > 0)) {
-                           const key = `${dateString}|${sheetName}|${SESSION_AFTERNOON}`;
-                           if (summaryAggregator.has(key)) summaryAggregator.get(key).count++;
+                        const isInAfternoon = endHour > TSUKUBA_MORNING_SESSION_END_HOUR || (endHour === TSUKUBA_MORNING_SESSION_END_HOUR && endMinutes > 0);
+                        if (isInAfternoon) {
+                           const afternoonKey = `${dateString}|${sheetName}|${SESSION_AFTERNOON}`;
+                           if (summaryAggregator.has(afternoonKey)) summaryAggregator.get(afternoonKey).count++;
+                           if (isFirstLecture) {
+                               const introKey = `${dateString}|${sheetName}|${ITEM_NAME_FIRST_LECTURE}`;
+                               if (summaryAggregator.has(introKey)) summaryAggregator.get(introKey).count++;
+                           }
                         }
                     }
                 } else if (sheetName === TOKYO_CLASSROOM_NAME) {
                     const mainKey = `${dateString}|${sheetName}|${ITEM_NAME_MAIN_LECTURE}`;
                     if (summaryAggregator.has(mainKey)) {
                         summaryAggregator.get(mainKey).count++;
                     }
-                    if (row[firstLectureIdx] === true) {
+                    if (isFirstLecture) {
                         const introKey = `${dateString}|${sheetName}|${ITEM_NAME_FIRST_LECTURE}`;
                         if (summaryAggregator.has(introKey)) {
                             summaryAggregator.get(introKey).count++;
@@ -254,6 +263,10 @@
                     const key = `${dateString}|${sheetName}|${SESSION_ALL_DAY}`;
                     if (summaryAggregator.has(key)) {
                         summaryAggregator.get(key).count++;
+                    }
+                    if (isFirstLecture) {
+                        const introKey = `${dateString}|${sheetName}|${ITEM_NAME_FIRST_LECTURE}`;
+                        if (summaryAggregator.has(introKey)) summaryAggregator.get(introKey).count++;
                     }
                 }
             });
@@ -359,21 +372,29 @@
         const status = String(row[countIdx]).toLowerCase();
         const name = row[nameIdx];
 
+        const isFirstLecture = firstLectureIdx !== undefined && row[firstLectureIdx] === true;
+
         if (name && status !== STATUS_CANCEL && status !== STATUS_WAITING && rowDate instanceof Date && Utilities.formatDate(rowDate, timezone, 'yyyy-MM-dd') === targetDateString) {
             if (classroom === TSUKUBA_CLASSROOM_NAME) {
                 const startTime = row[startTimeIdx];
                 const endTime = row[endTimeIdx];
                 if (startTime instanceof Date && endTime instanceof Date) {
                     const startHour = startTime.getHours();
                     const endHour = endTime.getHours();
                     const endMinutes = endTime.getMinutes();
                     
                     if (startHour < TSUKUBA_MORNING_SESSION_END_HOUR) {
                         counts.set(SESSION_MORNING, (counts.get(SESSION_MORNING) || 0) + 1);
                     }
-                    if (endHour > TSUKUBA_MORNING_SESSION_END_HOUR || (endHour === TSUKUBA_MORNING_SESSION_END_HOUR && endMinutes > 0)) {
+                    const isInAfternoon = endHour > TSUKUBA_MORNING_SESSION_END_HOUR || (endHour === TSUKUBA_MORNING_SESSION_END_HOUR && endMinutes > 0);
+                    if (isInAfternoon) {
                         counts.set(SESSION_AFTERNOON, (counts.get(SESSION_AFTERNOON) || 0) + 1);
+                        if (isFirstLecture) {
+                            counts.set(ITEM_NAME_FIRST_LECTURE, (counts.get(ITEM_NAME_FIRST_LECTURE) || 0) + 1);
+                        }
                     }
                 }
             } else if (classroom === TOKYO_CLASSROOM_NAME) {
                 // 本講座の予約数をインクリメント
                 counts.set(ITEM_NAME_MAIN_LECTURE, (counts.get(ITEM_NAME_MAIN_LECTURE) || 0) + 1);
                 
-                const isFirstLecture = row[firstLectureIdx] === true;
                 if (isFirstLecture) {
                     // 初回講習の予約数をインクリメント
                     counts.set(ITEM_NAME_FIRST_LECTURE, (counts.get(ITEM_NAME_FIRST_LECTURE) || 0) + 1);
                 }
             } else { // 沼津など
                 counts.set(SESSION_ALL_DAY, (counts.get(SESSION_ALL_DAY) || 0) + 1);
+                if (isFirstLecture) {
+                    counts.set(ITEM_NAME_FIRST_LECTURE, (counts.get(ITEM_NAME_FIRST_LECTURE) || 0) + 1);
+                }
             }
         }
     });
@@ -392,25 +413,36 @@
 function _createSummaryRowData(classroom, date, counts, venue, timezone) {
     const rows = [];
     const dateString = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
 
+    const introCount = counts.get(ITEM_NAME_FIRST_LECTURE) || 0;
+
     if (classroom === TSUKUBA_CLASSROOM_NAME) {
         const capacity = CLASSROOM_CAPACITIES[classroom] || 8;
         const morningReservations = counts.get(SESSION_MORNING) || 0;
         const afternoonReservations = counts.get(SESSION_AFTERNOON) || 0;
         const morningAvailable = Math.max(0, capacity - morningReservations);
         const afternoonAvailable = Math.max(0, capacity - afternoonReservations);
         
         rows.push([`${dateString}_${classroom}_${SESSION_MORNING}`, date, classroom, SESSION_MORNING, venue, capacity, morningReservations, morningAvailable, new Date()]);
         rows.push([`${dateString}_${classroom}_${SESSION_AFTERNOON}`, date, classroom, SESSION_AFTERNOON, venue, capacity, afternoonReservations, afternoonAvailable, new Date()]);
 
+        // つくばの初回講習は午後の空きに依存
+        const introSpecificAvailable = Math.max(0, INTRO_LECTURE_CAPACITY - introCount);
+        const finalIntroAvailable = Math.min(afternoonAvailable, introSpecificAvailable);
+        rows.push([`${dateString}_${classroom}_${ITEM_NAME_FIRST_LECTURE}`, date, classroom, ITEM_NAME_FIRST_LECTURE, venue, INTRO_LECTURE_CAPACITY, introCount, finalIntroAvailable, new Date()]);
+
     } else if (classroom === TOKYO_CLASSROOM_NAME) {
         const mainCount = counts.get(ITEM_NAME_MAIN_LECTURE) || 0;
-        const introCount = counts.get(ITEM_NAME_FIRST_LECTURE) || 0;
         const availability = _calculateTokyoAvailability(mainCount, introCount);
 
         rows.push([`${dateString}_${classroom}_${ITEM_NAME_MAIN_LECTURE}`, date, classroom, ITEM_NAME_MAIN_LECTURE, venue, CLASSROOM_CAPACITIES[TOKYO_CLASSROOM_NAME], mainCount, availability.mainAvailable, new Date()]);
         rows.push([`${dateString}_${classroom}_${ITEM_NAME_FIRST_LECTURE}`, date, classroom, ITEM_NAME_FIRST_LECTURE, venue, INTRO_LECTURE_CAPACITY, introCount, availability.introAvailable, new Date()]);
 
     } else { // 沼津など
         const capacity = CLASSROOM_CAPACITIES[classroom] || 8;
         const reservations = counts.get(SESSION_ALL_DAY) || 0;
         const available = Math.max(0, capacity - reservations);
         rows.push([`${dateString}_${classroom}_${SESSION_ALL_DAY}`, date, classroom, SESSION_ALL_DAY, venue, capacity, reservations, available, new Date()]);
+
+        // 沼津などの初回講習は全日の空きに依存
+        const introSpecificAvailable = Math.max(0, INTRO_LECTURE_CAPACITY - introCount);
+        const finalIntroAvailable = Math.min(available, introSpecificAvailable);
+        rows.push([`${dateString}_${classroom}_${ITEM_NAME_FIRST_LECTURE}`, date, classroom, ITEM_NAME_FIRST_LECTURE, venue, INTRO_LECTURE_CAPACITY, introCount, finalIntroAvailable, new Date()]);
     }
     return rows;
 }
```

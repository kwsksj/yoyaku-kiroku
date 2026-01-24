/**
 * =================================================================
 * 【ファイル名】  : 02-8_Sync_Notion.js
 * 【モジュール種別】: バックエンド（GAS）
 * 【概要】          Notion 生徒データベースとの同期モジュール
 *
 * 【機能】
 *   - 生徒名簿データを Notion に同期
 *   - リアルタイム同期（登録・更新・退会時）
 *   - バッチ同期（時間トリガーで定期実行）
 *
 * 【Notion API】
 *   - Database ID: 02-8_Sync_Notion.js 作成時に設定
 *   - API Version: 2022-06-28
 *   - Auth: Bearer Token (PropertiesService で管理)
 *
 * 【依存関係】
 *   - 07_CacheManager.js (getCachedAllStudents)
 *   - 08_Utilities.js (getCachedStudentById)
 * =================================================================
 */

// ================================================================
// 依存モジュール
// ================================================================
import { getCachedAllStudents } from './07_CacheManager.js';
import { getCachedStudentById } from './08_Utilities.js';

// ================================================================
// 定数
// ================================================================

/** Notion API エンドポイント */
const NOTION_API_BASE = 'https://api.notion.com/v1';

/** Notion API バージョン */
const NOTION_API_VERSION = '2022-06-28';

/** PropertiesService のキー */
const PROPS_KEY_NOTION_TOKEN = 'NOTION_API_TOKEN';
const PROPS_KEY_NOTION_STUDENT_DB_ID = 'NOTION_STUDENT_DATABASE_ID';

/** バッチ同期時のレート制限対策（ミリ秒） */
const RATE_LIMIT_DELAY_MS = 350;

// ================================================================
// 型定義
// ================================================================

/**
 * @typedef {Object} NotionConfig
 * @property {string} token - Notion API トークン
 * @property {string} studentDbId - 生徒データベースID
 */

/**
 * @typedef {Object} NotionSyncResult
 * @property {boolean} success
 * @property {string | undefined} [pageId]
 * @property {string | undefined} [error]
 */

/**
 * @typedef {Object} NotionPage
 * @property {string} id
 * @property {Record<string, any>} properties
 */

/**
 * @typedef {Object} NotionApiResponse
 * @property {string} [id]
 * @property {NotionPage[]} [results]
 * @property {boolean} [has_more]
 * @property {string} [next_cursor]
 * @property {Array<{plain_text: string}>} [title]
 */

/**
 * @typedef {Object} StudentData
 * @property {string | undefined} [studentId]
 * @property {string | undefined} [nickname]
 * @property {string | undefined} [realName]
 * @property {string | undefined} [phone]
 * @property {string | undefined} [status]
 */

// ================================================================
// ★★★ 設定管理 ★★★
// ================================================================

/**
 * Notion 接続設定を取得します
 * @returns {NotionConfig | null}
 */
export function getNotionConfig() {
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty(PROPS_KEY_NOTION_TOKEN);
    const studentDbId = props.getProperty(PROPS_KEY_NOTION_STUDENT_DB_ID);

    if (!token || !studentDbId) {
      return null;
    }

    return { token, studentDbId };
  } catch (error) {
    Logger.log(
      `getNotionConfig Error: ${/** @type {Error} */ (error).message}`,
    );
    return null;
  }
}

/**
 * Notion 接続設定を保存します（初回セットアップ用）
 * GASエディタから実行してください。
 *
 * @param {string} token - Notion Integration Token (secret_xxx)
 * @param {string} studentDbId - 生徒データベースID
 * @returns {void}
 *
 * @example
 * // GASエディタから実行
 * setNotionCredentials('secret_xxxxxx', '2f257846aac280cba2b9e971db618f8e');
 */
export function setNotionCredentials(token, studentDbId) {
  if (!token || !studentDbId) {
    throw new Error('token と studentDbId は必須です');
  }

  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROPS_KEY_NOTION_TOKEN, token);
  props.setProperty(PROPS_KEY_NOTION_STUDENT_DB_ID, studentDbId);

  Logger.log('Notion認証情報を保存しました');
  Logger.log(`Database ID: ${studentDbId}`);
}

/**
 * Notion 接続設定を削除します（デバッグ用）
 * @returns {void}
 */
export function clearNotionCredentials() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(PROPS_KEY_NOTION_TOKEN);
  props.deleteProperty(PROPS_KEY_NOTION_STUDENT_DB_ID);
  Logger.log('Notion認証情報を削除しました');
}

// ================================================================
// ★★★ 個別同期（リアルタイム用） ★★★
// ================================================================

/**
 * 生徒データを Notion に同期します
 * 登録・更新・退会時に呼び出されます
 *
 * @param {string} studentId - 生徒ID
 * @param {'create' | 'update' | 'delete'} action - 同期アクション
 * @returns {NotionSyncResult}
 */
export function syncStudentToNotion(studentId, action) {
  try {
    const config = getNotionConfig();
    if (!config) {
      Logger.log('Notion同期スキップ: 設定が未完了です');
      return { success: false, error: '設定未完了' };
    }

    // 生徒データを取得
    const student = getCachedStudentById(studentId);
    if (!student && action !== 'delete') {
      Logger.log(`Notion同期エラー: 生徒が見つかりません - ${studentId}`);
      return { success: false, error: '生徒が見つかりません' };
    }

    // 既存の Notion ページを検索
    const existingPage = _findNotionPageByStudentId(config, studentId);

    /** @type {StudentData} */
    const studentData = student || { studentId };

    switch (action) {
      case 'create':
        if (existingPage) {
          // 既に存在する場合は更新
          return _updateNotionPage(config, existingPage.id, studentData);
        }
        return _createNotionPage(config, studentData);

      case 'update':
        if (existingPage) {
          return _updateNotionPage(config, existingPage.id, studentData);
        }
        // 存在しない場合は新規作成
        return _createNotionPage(config, studentData);

      case 'delete':
        if (existingPage) {
          // ステータスを「退会済み」に更新
          return _updateNotionPage(config, existingPage.id, {
            ...studentData,
            status: '退会済み',
          });
        }
        return { success: true }; // 存在しなければ何もしない

      default:
        return { success: false, error: `不明なアクション: ${action}` };
    }
  } catch (error) {
    Logger.log(
      `syncStudentToNotion Error: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, error: /** @type {Error} */ (error).message };
  }
}

// ================================================================
// ★★★ バッチ同期（時間トリガー用） ★★★
// ================================================================

/**
 * 全生徒データを Notion に同期します（差分同期）
 * 時間トリガーで1日1回実行することを想定しています
 *
 * @returns {{success: boolean, created: number, updated: number, errors: number}}
 */
export function syncAllStudentsToNotion() {
  const startTime = new Date();
  let created = 0;
  let updated = 0;
  let errors = 0;

  try {
    const config = getNotionConfig();
    if (!config) {
      Logger.log('Notion一括同期スキップ: 設定が未完了です');
      return { success: false, created: 0, updated: 0, errors: 0 };
    }

    // 全生徒データを取得
    const allStudents = getCachedAllStudents();
    if (!allStudents || Object.keys(allStudents).length === 0) {
      Logger.log('Notion一括同期: 生徒データがありません');
      return { success: true, created: 0, updated: 0, errors: 0 };
    }

    // Notion側の既存ページを全取得
    const existingPages = _getAllNotionPages(config);
    /** @type {Map<string | null, NotionPage>} */
    const existingPageMap = new Map(
      existingPages.map(page => [_extractStudentIdFromPage(page), page]),
    );

    Logger.log(
      `Notion一括同期開始: スプレッドシート ${Object.keys(allStudents).length}件, Notion ${existingPages.length}件`,
    );

    // 各生徒を同期
    for (const studentId in allStudents) {
      const student = allStudents[studentId];

      // 退会済みユーザーはスキップ（または「退会済み」ステータスで同期）
      const isWithdrawn =
        student.phone && student.phone.startsWith('_WITHDRAWN_');

      try {
        const existingPage = existingPageMap.get(studentId);

        /** @type {StudentData} */
        const studentData = {
          studentId: student.studentId,
          nickname: student.nickname,
          realName: student.realName,
          phone: student.phone,
          status: isWithdrawn ? '退会済み' : '在籍中',
        };

        if (existingPage) {
          // 更新
          const result = _updateNotionPage(
            config,
            existingPage.id,
            studentData,
          );
          if (result.success) {
            updated++;
          } else {
            errors++;
          }
        } else if (!isWithdrawn) {
          // 新規作成（退会済みは新規作成しない）
          const result = _createNotionPage(config, studentData);
          if (result.success) {
            created++;
          } else {
            errors++;
          }
        }

        // レート制限対策
        Utilities.sleep(RATE_LIMIT_DELAY_MS);
      } catch (error) {
        Logger.log(
          `Notion同期エラー (${studentId}): ${/** @type {Error} */ (error).message}`,
        );
        errors++;
      }
    }

    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;

    Logger.log(
      `Notion一括同期完了: 作成=${created}, 更新=${updated}, エラー=${errors}, 所要時間=${duration}秒`,
    );

    return { success: true, created, updated, errors };
  } catch (error) {
    Logger.log(
      `syncAllStudentsToNotion Error: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, created, updated, errors: errors + 1 };
  }
}

// ================================================================
// ★★★ Notion API ラッパー ★★★
// ================================================================

/**
 * Notion API にリクエストを送信します
 *
 * @param {string} token - Notion API トークン
 * @param {string} endpoint - APIエンドポイント（/databases/xxx など）
 * @param {GoogleAppsScript.URL_Fetch.HttpMethod} method - HTTPメソッド
 * @param {Object | null} [payload] - リクエストボディ
 * @returns {NotionApiResponse} レスポンス
 * @private
 */
function _notionRequest(token, endpoint, method, payload = null) {
  /** @type {GoogleAppsScript.URL_Fetch.URLFetchRequestOptions} */
  const options = {
    method: method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  };

  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(`${NOTION_API_BASE}${endpoint}`, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode >= 400) {
    throw new Error(`Notion API Error (${responseCode}): ${responseText}`);
  }

  return /** @type {NotionApiResponse} */ (JSON.parse(responseText));
}

/**
 * Notion に生徒ページを新規作成します
 *
 * @param {NotionConfig} config
 * @param {StudentData} student - 生徒データ
 * @returns {NotionSyncResult}
 * @private
 */
function _createNotionPage(config, student) {
  try {
    const properties = _buildNotionProperties(student);

    const response = _notionRequest(config.token, '/pages', 'post', {
      parent: { database_id: config.studentDbId },
      properties: properties,
    });

    Logger.log(
      `Notionページ作成成功: ${response.id} (${student.nickname || student.realName})`,
    );
    return { success: true, pageId: response.id };
  } catch (error) {
    Logger.log(
      `Notionページ作成エラー: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, error: /** @type {Error} */ (error).message };
  }
}

/**
 * Notion の生徒ページを更新します
 *
 * @param {NotionConfig} config
 * @param {string} pageId - NotionページID
 * @param {StudentData} student - 生徒データ
 * @returns {NotionSyncResult}
 * @private
 */
function _updateNotionPage(config, pageId, student) {
  try {
    const properties = _buildNotionProperties(student);

    const response = _notionRequest(config.token, `/pages/${pageId}`, 'patch', {
      properties: properties,
    });

    Logger.log(
      `Notionページ更新成功: ${response.id} (${student.nickname || student.realName})`,
    );
    return { success: true, pageId: response.id };
  } catch (error) {
    Logger.log(
      `Notionページ更新エラー: ${/** @type {Error} */ (error).message}`,
    );
    return { success: false, error: /** @type {Error} */ (error).message };
  }
}

/**
 * 生徒IDで Notion ページを検索します
 *
 * @param {NotionConfig} config
 * @param {string} studentId - 生徒ID
 * @returns {{id: string} | null}
 * @private
 */
function _findNotionPageByStudentId(config, studentId) {
  try {
    const response = _notionRequest(
      config.token,
      `/databases/${config.studentDbId}/query`,
      'post',
      {
        filter: {
          property: '生徒ID',
          rich_text: {
            equals: studentId,
          },
        },
      },
    );

    if (response.results && response.results.length > 0) {
      return { id: response.results[0].id };
    }

    return null;
  } catch (error) {
    Logger.log(
      `Notionページ検索エラー: ${/** @type {Error} */ (error).message}`,
    );
    return null;
  }
}

/**
 * Notion データベースの全ページを取得します
 *
 * @param {NotionConfig} config
 * @returns {NotionPage[]}
 * @private
 */
function _getAllNotionPages(config) {
  /** @type {NotionPage[]} */
  const allPages = [];
  let hasMore = true;
  /** @type {string | undefined} */
  let startCursor = undefined;

  try {
    while (hasMore) {
      /** @type {{start_cursor?: string}} */
      const payload = {};
      if (startCursor) {
        payload.start_cursor = startCursor;
      }

      const response = _notionRequest(
        config.token,
        `/databases/${config.studentDbId}/query`,
        'post',
        payload,
      );

      if (response.results) {
        allPages.push(...response.results);
      }

      hasMore = response.has_more || false;
      startCursor = response.next_cursor || undefined;
    }

    return allPages;
  } catch (error) {
    Logger.log(
      `Notion全ページ取得エラー: ${/** @type {Error} */ (error).message}`,
    );
    return allPages;
  }
}

/**
 * Notion ページから生徒IDを抽出します
 *
 * @param {NotionPage} page - Notionページオブジェクト
 * @returns {string | null}
 * @private
 */
function _extractStudentIdFromPage(page) {
  try {
    const studentIdProp = page.properties['生徒ID'];
    if (
      studentIdProp &&
      studentIdProp.rich_text &&
      studentIdProp.rich_text.length > 0
    ) {
      return studentIdProp.rich_text[0].plain_text;
    }
    return null;
  } catch (_error) {
    return null;
  }
}

/**
 * 生徒データから Notion プロパティオブジェクトを構築します
 *
 * @param {StudentData} student - 生徒データ
 * @returns {Object} Notionプロパティ
 * @private
 */
function _buildNotionProperties(student) {
  /** @type {Record<string, Object>} */
  const properties = {};

  // ニックネーム（Title）
  // 本名と完全一致している場合は先頭2文字のみ使用（プライバシー保護）
  let displayName = student.nickname || student.realName || '名前なし';
  if (
    student.nickname &&
    student.realName &&
    student.nickname === student.realName
  ) {
    displayName = student.realName.substring(0, 2);
  }
  properties['ニックネーム'] = {
    title: [{ text: { content: displayName } }],
  };

  // 生徒ID（Text）
  if (student.studentId) {
    properties['生徒ID'] = {
      rich_text: [{ text: { content: student.studentId } }],
    };
  }

  // 注: 本名・ステータスは公開ギャラリーに不要なため同期しない

  return properties;
}

// ================================================================
// ★★★ 手動実行・テスト用関数 ★★★
// ================================================================

/**
 * 【手動実行用】設定状態を確認します
 * GASエディタから実行してください
 */
export function checkNotionConfig_DEV() {
  const config = getNotionConfig();
  if (config) {
    Logger.log('Notion設定: 完了');
    Logger.log(`Database ID: ${config.studentDbId}`);
    Logger.log(`Token: ${config.token.substring(0, 15)}...`);
  } else {
    Logger.log('Notion設定: 未完了');
    Logger.log('setNotionCredentials(token, dbId) を実行してください');
  }
}

/**
 * 【手動実行用】Notion API 接続テスト
 * GASエディタから実行してください
 */
export function testNotionConnection_DEV() {
  const config = getNotionConfig();
  if (!config) {
    Logger.log('設定が未完了です');
    return;
  }

  try {
    const response = _notionRequest(
      config.token,
      `/databases/${config.studentDbId}`,
      'get',
    );
    Logger.log('接続成功!');
    const title =
      response.title && response.title[0]
        ? response.title[0].plain_text
        : '(タイトルなし)';
    Logger.log(`データベース名: ${title}`);
  } catch (error) {
    Logger.log(`接続失敗: ${/** @type {Error} */ (error).message}`);
  }
}

/**
 * 【手動実行用】特定の生徒を Notion に同期します
 * GASエディタから実行してください
 *
 * @param {string} studentId - 同期する生徒ID
 */
export function syncSingleStudent_DEV(studentId) {
  if (!studentId) {
    Logger.log('studentId を指定してください');
    return;
  }

  const result = syncStudentToNotion(studentId, 'update');
  Logger.log(`同期結果: ${JSON.stringify(result)}`);
}

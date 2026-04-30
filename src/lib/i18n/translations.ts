// Translation system for Shadowing Learning App
export interface TranslationKey {
  // Navigation
  "nav.home": string;
  "nav.settings": string;
  "nav.account": string;
  "nav.toggleTheme": string;
  "nav.switchLanguage": string;
  "nav.selectLanguage": string;

  // File Management
  "file.upload.title": string;
  "file.upload.dragDrop": string;
  "file.upload.orClick": string;
  "file.upload.supportedFormats": string;
  "file.upload.uploading": string;
  "file.upload.error": string;
  "file.upload.retry": string;
  "file.upload.clearError": string;
  "file.upload.maxFilesReached": string;
  "file.upload.selectFiles": string;

  // Player
  "player.loading": string;
  "player.error": string;
  "player.noSubtitles": string;
  "player.transcribeFirst": string;
  "player.back": string;
  "player.retry": string;

  // Settings
  "settings.title": string;
  "settings.language": string;
  "settings.targetLanguage": string;
  "settings.nativeLanguage": string;
  "settings.save": string;
  "settings.cancel": string;

  // Transcription
  "transcription.status.pending": string;
  "transcription.status.processing": string;
  "transcription.status.completed": string;
  "transcription.status.failed": string;
  "transcription.start": string;
  "transcription.cancel": string;
  "transcription.retry": string;
  "transcription.success": string;
  "transcription.error": string;

  // Common
  "common.loading": string;
  "common.error": string;
  "common.retry": string;
  "common.cancel": string;
  "common.save": string;
  "common.delete": string;
  "common.edit": string;
  "common.close": string;
  "common.confirm": string;
  "common.success": string;
}

// Translation dictionaries
export const translations: Record<string, TranslationKey> = {
  // Chinese Simplified (zh-CN)
  "zh-CN": {
    // Navigation
    "nav.home": "首页",
    "nav.settings": "设置",
    "nav.account": "用户中心",
    "nav.toggleTheme": "切换主题",
    "nav.switchLanguage": "切换语言",
    "nav.selectLanguage": "选择界面语言 / Select Language",

    // File Management
    "file.upload.title": "上传音频文件",
    "file.upload.dragDrop": "拖拽音频文件到此处，或点击选择文件",
    "file.upload.orClick": "或点击选择文件",
    "file.upload.supportedFormats": "支持格式：MP3, WAV, M4A, FLAC",
    "file.upload.uploading": "上传中...",
    "file.upload.error": "上传失败",
    "file.upload.retry": "重试",
    "file.upload.clearError": "清除错误",
    "file.upload.maxFilesReached": "已达到文件数量上限",
    "file.upload.selectFiles": "选择文件",

    // Player
    "player.loading": "加载中...",
    "player.error": "加载失败",
    "player.noSubtitles": "暂无字幕内容，请先在主页转录此文件",
    "player.transcribeFirst": "请先转录此文件",
    "player.back": "返回",
    "player.retry": "重试",

    // Settings
    "settings.title": "设置",
    "settings.language": "语言设置",
    "settings.targetLanguage": "目标学习语言（音频语言）",
    "settings.nativeLanguage": "母语（翻译目标）",
    "settings.save": "保存",
    "settings.cancel": "取消",

    // Transcription
    "transcription.status.pending": "等待中",
    "transcription.status.processing": "转录中",
    "transcription.status.completed": "已完成",
    "transcription.status.failed": "转录失败",
    "transcription.start": "开始转录",
    "transcription.cancel": "取消转录",
    "transcription.retry": "重新转录",
    "transcription.success": "转录完成",
    "transcription.error": "转录失败",

    // Common
    "common.loading": "加载中...",
    "common.error": "错误",
    "common.retry": "重试",
    "common.cancel": "取消",
    "common.save": "保存",
    "common.delete": "删除",
    "common.edit": "编辑",
    "common.close": "关闭",
    "common.confirm": "确认",
    "common.success": "成功",
  },

  // Traditional Chinese (zh-TW)
  "zh-TW": {
    // Navigation
    "nav.home": "首頁",
    "nav.settings": "設定",
    "nav.account": "用戶中心",
    "nav.toggleTheme": "切換主題",
    "nav.switchLanguage": "切換語言",
    "nav.selectLanguage": "選擇介面語言 / Select Language",

    // File Management
    "file.upload.title": "上傳音頻檔案",
    "file.upload.dragDrop": "拖拽音頻檔案到此處，或點擊選擇檔案",
    "file.upload.orClick": "或點擊選擇檔案",
    "file.upload.supportedFormats": "支援格式：MP3, WAV, M4A, FLAC",
    "file.upload.uploading": "上傳中...",
    "file.upload.error": "上傳失敗",
    "file.upload.retry": "重試",
    "file.upload.clearError": "清除錯誤",
    "file.upload.maxFilesReached": "已達到檔案數量上限",
    "file.upload.selectFiles": "選擇檔案",

    // Player
    "player.loading": "載入中...",
    "player.error": "載入失敗",
    "player.noSubtitles": "暫無字幕內容，請先在主頁轉錄此檔案",
    "player.transcribeFirst": "請先轉錄此檔案",
    "player.back": "返回",
    "player.retry": "重試",

    // Settings
    "settings.title": "設定",
    "settings.language": "語言設定",
    "settings.targetLanguage": "目標學習語言（音頻語言）",
    "settings.nativeLanguage": "母語（翻譯目標）",
    "settings.save": "儲存",
    "settings.cancel": "取消",

    // Transcription
    "transcription.status.pending": "等待中",
    "transcription.status.processing": "轉錄中",
    "transcription.status.completed": "已完成",
    "transcription.status.failed": "轉錄失敗",
    "transcription.start": "開始轉錄",
    "transcription.cancel": "取消轉錄",
    "transcription.retry": "重新轉錄",
    "transcription.success": "轉錄完成",
    "transcription.error": "轉錄失敗",

    // Common
    "common.loading": "載入中...",
    "common.error": "錯誤",
    "common.retry": "重試",
    "common.cancel": "取消",
    "common.save": "儲存",
    "common.delete": "刪除",
    "common.edit": "編輯",
    "common.close": "關閉",
    "common.confirm": "確認",
    "common.success": "成功",
  },

  // English (en-US)
  "en-US": {
    // Navigation
    "nav.home": "Home",
    "nav.settings": "Settings",
    "nav.account": "Account",
    "nav.toggleTheme": "Toggle Theme",
    "nav.switchLanguage": "Switch Language",
    "nav.selectLanguage": "Select Interface Language / 选择界面语言",

    // File Management
    "file.upload.title": "Upload Audio Files",
    "file.upload.dragDrop": "Drag and drop audio files here, or click to select",
    "file.upload.orClick": "or click to select files",
    "file.upload.supportedFormats": "Supported formats: MP3, WAV, M4A, FLAC",
    "file.upload.uploading": "Uploading...",
    "file.upload.error": "Upload failed",
    "file.upload.retry": "Retry",
    "file.upload.clearError": "Clear Error",
    "file.upload.maxFilesReached": "Maximum file count reached",
    "file.upload.selectFiles": "Select Files",

    // Player
    "player.loading": "Loading...",
    "player.error": "Loading failed",
    "player.noSubtitles": "No subtitles available. Please transcribe this file first.",
    "player.transcribeFirst": "Please transcribe this file first",
    "player.back": "Back",
    "player.retry": "Retry",

    // Settings
    "settings.title": "Settings",
    "settings.language": "Language Settings",
    "settings.targetLanguage": "Target Learning Language (Audio Language)",
    "settings.nativeLanguage": "Native Language (Translation Target)",
    "settings.save": "Save",
    "settings.cancel": "Cancel",

    // Transcription
    "transcription.status.pending": "Pending",
    "transcription.status.processing": "Processing",
    "transcription.status.completed": "Completed",
    "transcription.status.failed": "Failed",
    "transcription.start": "Start Transcription",
    "transcription.cancel": "Cancel Transcription",
    "transcription.retry": "Retry Transcription",
    "transcription.success": "Transcription Completed",
    "transcription.error": "Transcription Failed",

    // Common
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.retry": "Retry",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.close": "Close",
    "common.confirm": "Confirm",
    "common.success": "Success",
  },

  // Japanese (ja-JP)
  "ja-JP": {
    // Navigation
    "nav.home": "ホーム",
    "nav.settings": "設定",
    "nav.account": "アカウント",
    "nav.toggleTheme": "テーマ切り替え",
    "nav.switchLanguage": "言語切り替え",
    "nav.selectLanguage": "インターフェース言語を選択 / Select Language",

    // File Management
    "file.upload.title": "音声ファイルをアップロード",
    "file.upload.dragDrop": "音声ファイルをここにドラッグ＆ドロップ、またはクリックして選択",
    "file.upload.orClick": "またはクリックしてファイルを選択",
    "file.upload.supportedFormats": "対応フォーマット：MP3, WAV, M4A, FLAC",
    "file.upload.uploading": "アップロード中...",
    "file.upload.error": "アップロード失敗",
    "file.upload.retry": "再試行",
    "file.upload.clearError": "エラーをクリア",
    "file.upload.maxFilesReached": "ファイル数の上限に達しました",
    "file.upload.selectFiles": "ファイルを選択",

    // Player
    "player.loading": "読み込み中...",
    "player.error": "読み込み失敗",
    "player.noSubtitles": "字幕がありません。まずこのファイルを文字起こししてください。",
    "player.transcribeFirst": "まずこのファイルを文字起こししてください",
    "player.back": "戻る",
    "player.retry": "再試行",

    // Settings
    "settings.title": "設定",
    "settings.language": "言語設定",
    "settings.targetLanguage": "学習対象言語（音声言語）",
    "settings.nativeLanguage": "母語（翻訳対象）",
    "settings.save": "保存",
    "settings.cancel": "キャンセル",

    // Transcription
    "transcription.status.pending": "待機中",
    "transcription.status.processing": "処理中",
    "transcription.status.completed": "完了",
    "transcription.status.failed": "失敗",
    "transcription.start": "文字起こしを開始",
    "transcription.cancel": "文字起こしをキャンセル",
    "transcription.retry": "文字起こしを再試行",
    "transcription.success": "文字起こしが完了しました",
    "transcription.error": "文字起こしに失敗しました",

    // Common
    "common.loading": "読み込み中...",
    "common.error": "エラー",
    "common.retry": "再試行",
    "common.cancel": "キャンセル",
    "common.save": "保存",
    "common.delete": "削除",
    "common.edit": "編集",
    "common.close": "閉じる",
    "common.confirm": "確認",
    "common.success": "成功",
  },
};

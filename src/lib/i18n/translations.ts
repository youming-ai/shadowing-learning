// Translation system for Shadowing Learning App
export interface TranslationKey {
  // Navigation
  'nav.home': string
  'nav.settings': string
  'nav.account': string
  'nav.toggleTheme': string
  'nav.switchLanguage': string
  'nav.selectLanguage': string

  // File Management

  // Player
  'player.loading': string
  'player.error': string
  'player.back': string
  'player.retry': string

  // Settings
  'settings.title': string
  'settings.language': string
  'settings.targetLanguage': string
  'settings.nativeLanguage': string
  'settings.save': string
  'settings.cancel': string
  'settings.ai.title': string
  'settings.ai.engine': string
  'settings.ai.engineHint': string
  'settings.ai.engineDefault': string
  'settings.ai.apiKey': string
  'settings.ai.apiKeyHint': string
  'settings.ai.apiKeyPlaceholder': string
  'settings.ai.model': string
  'settings.ai.modelHint': string
  'settings.ai.save': string
  'settings.ai.clear': string
  'settings.ai.getKey': string
  'settings.ai.privacy': string
  'settings.ai.defaultQuotaHint': string
  'settings.ai.saved': string

  // Transcription

  // Library
  'library.title': string
  'library.add': string
  'library.search.placeholder': string
  'library.empty.title': string
  'library.empty.cta': string
  'library.deleteConfirm': string

  // Import dialog
  'import.tab.youtube': string
  'import.url.placeholder': string
  'import.submit': string
  'import.resolving': string
  'import.saving': string
  'import.error.INVALID_URL': string
  'import.error.VIDEO_NOT_FOUND': string
  'import.error.VIDEO_UNAVAILABLE': string
  'import.error.LIVE_NOT_SUPPORTED': string
  'import.error.VIDEO_TOO_LONG': string
  'import.error.YT_BLOCKED': string
  'import.error.EXTRACTOR_UNAVAILABLE': string
  'import.error.EXTRACTOR_FAILED': string
  'import.error.QUOTA_EXHAUSTED': string
  'import.error.SERVER_BUSY': string
  'import.error.RATE_LIMITED': string

  // Watch page
  'watch.subtitleCount': string
  'watch.regenerate': string
  'watch.openOnYouTube': string
  'watch.embedBlocked': string
  'watch.notFound': string
  'watch.stage.captions': string
  'watch.stage.translating': string
  'watch.retryPipeline': string
  'watch.prevSentence': string
  'watch.nextSentence': string
  'watch.loopSentence': string
  'watch.shadowing.toggle': string
  'watch.shadowing.settings': string
  'watch.shadowing.pass': string
  'watch.shadowing.phase.listening': string
  'watch.shadowing.phase.gap': string
  'watch.shadowing.repeat': string
  'watch.shadowing.gap': string
  'watch.shadowing.gap.short': string
  'watch.shadowing.gap.medium': string
  'watch.shadowing.gap.long': string
  'watch.shadowing.practiceRate': string
  'watch.shadowing.autoAdvance': string
  'watch.shadowing.loopDisabled': string
  'watch.record.start': string
  'watch.record.stop': string
  'watch.record.playMine': string
  'watch.record.playOriginal': string
  'watch.record.recording': string
  'watch.record.gapHint': string
  'watch.record.hint': string
  'watch.record.error.denied': string
  'watch.record.error.failed': string
  'watch.record.error.unsupported': string
  'watch.rhythm.ahead': string
  'watch.rhythm.onTime': string
  'watch.rhythm.late': string
  'watch.rhythm.latency': string
  'watch.rhythm.pace': string
  'watch.rhythm.analyzing': string
  'watch.rhythm.noSpeech': string
  'watch.rhythm.unavailable': string

  // Two-line nav + pages
  'nav.online': string
  'online.title': string
  'online.empty.title': string
  'online.empty.cta': string
  'online.tab.youtube': string
  'online.tab.podcast': string
  'online.tab.podcastSoon': string

  // Common
  'common.loading': string
  'common.error': string
  'common.retry': string
  'common.cancel': string
  'common.save': string
  'common.delete': string
  'common.edit': string
  'common.close': string
  'common.confirm': string
  'common.success': string
}

// Translation dictionaries
export const translations: Record<string, TranslationKey> = {
  // Chinese Simplified (zh-CN)
  'zh-CN': {
    // Navigation
    'nav.home': '首页',
    'nav.settings': '设置',
    'nav.account': '用户中心',
    'nav.toggleTheme': '切换主题',
    'nav.switchLanguage': '切换语言',
    'nav.selectLanguage': '选择界面语言 / Select Language',

    // File Management

    // Player
    'player.loading': '加载中...',
    'player.error': '加载失败',
    'player.back': '返回',
    'player.retry': '重试',

    // Settings
    'settings.title': '设置',
    'settings.language': '语言设置',
    'settings.targetLanguage': '目标学习语言（音频语言）',
    'settings.nativeLanguage': '母语（翻译目标）',
    'settings.save': '保存',
    'settings.cancel': '取消',
    'settings.ai.title': 'AI 引擎',
    'settings.ai.engine': '翻译引擎',
    'settings.ai.engineHint': '默认用免费额度；也可以填自己的 API Key 直连供应商',
    'settings.ai.engineDefault': '默认（免费额度）',
    'settings.ai.apiKey': 'API Key',
    'settings.ai.apiKeyHint': '未配置。填入你自己的 {{provider}} Key 即可直连',
    'settings.ai.apiKeyPlaceholder': '粘贴你的 API Key',
    'settings.ai.model': '模型',
    'settings.ai.modelHint': '可直接填写任意模型 ID；下面的建议只是预填',
    'settings.ai.save': '保存',
    'settings.ai.clear': '清除 Key',
    'settings.ai.getKey': '获取 {{provider}} Key',
    'settings.ai.privacy':
      'Key 只保存在这台设备的浏览器里，只会发送给你选择的供应商，不会经过我们的服务器。但请知悉：与本站同源的任何脚本都能读到它，请自行评估风险。',
    'settings.ai.defaultQuotaHint':
      '当前使用免费额度：翻译由我们的服务器调用，你无需配置任何密钥。',
    'settings.ai.saved': '已保存',

    // Transcription

    // Library
    'library.title': '资料库',
    'library.add': '添加',
    'library.search.placeholder': '搜索已导入的内容',
    'library.empty.title': '还没有学习内容',
    'library.empty.cta': '粘贴一个 YouTube 链接开始学习',
    'library.deleteConfirm': '删除这个内容及其字幕？',
    'import.tab.youtube': 'YouTube 链接',
    'import.url.placeholder': '粘贴 YouTube 视频链接…',
    'import.submit': '导入',
    'import.resolving': '获取视频信息…',
    'import.saving': '保存中…',
    'import.error.INVALID_URL': '无法识别的 YouTube 链接，请检查格式',
    'import.error.VIDEO_NOT_FOUND': '视频不存在或已删除',
    'import.error.VIDEO_UNAVAILABLE': '视频不可用（私享、区域或年龄限制）',
    'import.error.LIVE_NOT_SUPPORTED': '暂不支持直播内容，请等存档后再导入',
    'import.error.VIDEO_TOO_LONG': '无字幕视频暂只支持 30 分钟以内',
    'import.error.YT_BLOCKED': '服务器暂时无法访问 YouTube，请稍后再试',
    'import.error.EXTRACTOR_UNAVAILABLE': '服务器未配置转写组件，暂只支持有字幕的视频',
    'import.error.EXTRACTOR_FAILED': 'YouTube 数据获取失败，请稍后重试',
    'import.error.QUOTA_EXHAUSTED': '今日 AI 转写额度已用完，请明天再试',
    'import.error.SERVER_BUSY': '已有转写任务进行中，请稍后再试',
    'import.error.RATE_LIMITED': '请求过于频繁，请稍后再试',
    'watch.subtitleCount': '字幕',
    'watch.regenerate': '重新生成字幕',
    'watch.openOnYouTube': '在 YouTube 打开',
    'watch.embedBlocked': '该视频不允许嵌入播放',
    'watch.notFound': '内容不存在，可能已被删除',
    'watch.stage.captions': '获取字幕中…',
    'watch.stage.translating': '翻译中（{{done}}/{{total}}）',
    'watch.retryPipeline': '重试',
    'watch.prevSentence': '上一句',
    'watch.nextSentence': '下一句',
    'watch.loopSentence': '单句循环',
    'watch.shadowing.toggle': '影子跟读',
    'watch.shadowing.settings': '跟读设置',
    'watch.shadowing.pass': '第 {{current}}/{{total}} 遍',
    'watch.shadowing.phase.listening': '听',
    'watch.shadowing.phase.gap': '留白',
    'watch.shadowing.repeat': '每句重复',
    'watch.shadowing.gap': '跟读留白',
    'watch.shadowing.gap.short': '短',
    'watch.shadowing.gap.medium': '中',
    'watch.shadowing.gap.long': '长',
    'watch.shadowing.practiceRate': '练习语速',
    'watch.shadowing.autoAdvance': '自动下一句',
    'watch.shadowing.loopDisabled': '影子模式下使用跟读循环',
    'watch.record.start': '录音',
    'watch.record.stop': '停止',
    'watch.record.playMine': '我的',
    'watch.record.playOriginal': '原音',
    'watch.record.recording': '录音中…',
    'watch.record.gapHint': '现在可以跟读并录音',
    'watch.record.hint': '录下你的跟读，再和原音对比回放',
    'watch.record.error.denied': '麦克风权限被拒绝，请在浏览器设置中允许',
    'watch.record.error.failed': '无法启动录音，请重试',
    'watch.record.error.unsupported': '当前浏览器不支持录音',
    'watch.rhythm.ahead': '抢拍',
    'watch.rhythm.onTime': '合拍',
    'watch.rhythm.late': '拖拍',
    'watch.rhythm.latency': '开口 {{sec}}',
    'watch.rhythm.pace': '语速 ×{{ratio}}',
    'watch.rhythm.analyzing': '分析节奏…',
    'watch.rhythm.noSpeech': '没听到人声，再录一次试试',
    'watch.rhythm.unavailable': '当前浏览器无法分析节奏',

    // Two-line nav + pages
    'nav.online': '在线',
    'online.title': '在线发现',
    'online.empty.title': '还没有在线内容',
    'online.empty.cta': '粘贴一个 YouTube 链接开始学习',
    'online.tab.youtube': 'YouTube',
    'online.tab.podcast': '播客',
    'online.tab.podcastSoon': '即将推出',

    // Common
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.retry': '重试',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.close': '关闭',
    'common.confirm': '确认',
    'common.success': '成功',
  },

  // Traditional Chinese (zh-TW)
  'zh-TW': {
    // Navigation
    'nav.home': '首頁',
    'nav.settings': '設定',
    'nav.account': '用戶中心',
    'nav.toggleTheme': '切換主題',
    'nav.switchLanguage': '切換語言',
    'nav.selectLanguage': '選擇介面語言 / Select Language',

    // File Management

    // Player
    'player.loading': '載入中...',
    'player.error': '載入失敗',
    'player.back': '返回',
    'player.retry': '重試',

    // Settings
    'settings.title': '設定',
    'settings.language': '語言設定',
    'settings.targetLanguage': '目標學習語言（音頻語言）',
    'settings.nativeLanguage': '母語（翻譯目標）',
    'settings.save': '儲存',
    'settings.cancel': '取消',
    'settings.ai.title': 'AI 引擎',
    'settings.ai.engine': '翻譯引擎',
    'settings.ai.engineHint': '預設使用免費額度；也可以填入自己的 API Key 直連供應商',
    'settings.ai.engineDefault': '預設（免費額度）',
    'settings.ai.apiKey': 'API Key',
    'settings.ai.apiKeyHint': '尚未設定。填入你自己的 {{provider}} Key 即可直連',
    'settings.ai.apiKeyPlaceholder': '貼上你的 API Key',
    'settings.ai.model': '模型',
    'settings.ai.modelHint': '可直接填寫任意模型 ID；下方建議只是預填',
    'settings.ai.save': '儲存',
    'settings.ai.clear': '清除 Key',
    'settings.ai.getKey': '取得 {{provider}} Key',
    'settings.ai.privacy':
      'Key 只保存在這台裝置的瀏覽器裡，只會傳送給你選擇的供應商，不會經過我們的伺服器。但請知悉：與本站同源的任何腳本都能讀取它，請自行評估風險。',
    'settings.ai.defaultQuotaHint':
      '目前使用免費額度：翻譯由我們的伺服器呼叫，你不需要設定任何金鑰。',
    'settings.ai.saved': '已儲存',

    // Transcription

    // Library
    'library.title': '資料庫',
    'library.add': '新增',
    'library.search.placeholder': '搜尋已匯入的內容',
    'library.empty.title': '還沒有學習內容',
    'library.empty.cta': '貼上一個 YouTube 連結開始學習',
    'library.deleteConfirm': '刪除這個內容及其字幕？',
    'import.tab.youtube': 'YouTube 連結',
    'import.url.placeholder': '貼上 YouTube 影片連結…',
    'import.submit': '匯入',
    'import.resolving': '取得影片資訊…',
    'import.saving': '儲存中…',
    'import.error.INVALID_URL': '無法識別的 YouTube 連結，請檢查格式',
    'import.error.VIDEO_NOT_FOUND': '影片不存在或已刪除',
    'import.error.VIDEO_UNAVAILABLE': '影片不可用（私人、區域或年齡限制）',
    'import.error.LIVE_NOT_SUPPORTED': '暫不支援直播內容，請等存檔後再匯入',
    'import.error.VIDEO_TOO_LONG': '無字幕影片暫只支援 30 分鐘以內',
    'import.error.YT_BLOCKED': '伺服器暫時無法存取 YouTube，請稍後再試',
    'import.error.EXTRACTOR_UNAVAILABLE': '伺服器未設定轉寫元件，暫只支援有字幕的影片',
    'import.error.EXTRACTOR_FAILED': 'YouTube 資料取得失敗，請稍後重試',
    'import.error.QUOTA_EXHAUSTED': '今日 AI 轉寫額度已用完，請明天再試',
    'import.error.SERVER_BUSY': '已有轉寫任務進行中，請稍後再試',
    'import.error.RATE_LIMITED': '請求過於頻繁，請稍後再試',
    'watch.subtitleCount': '字幕',
    'watch.regenerate': '重新產生字幕',
    'watch.openOnYouTube': '在 YouTube 開啟',
    'watch.embedBlocked': '該影片不允許嵌入播放',
    'watch.notFound': '內容不存在，可能已被刪除',
    'watch.stage.captions': '取得字幕中…',
    'watch.stage.translating': '翻譯中（{{done}}/{{total}}）',
    'watch.retryPipeline': '重試',
    'watch.prevSentence': '上一句',
    'watch.nextSentence': '下一句',
    'watch.loopSentence': '單句循環',
    'watch.shadowing.toggle': '影子跟讀',
    'watch.shadowing.settings': '跟讀設定',
    'watch.shadowing.pass': '第 {{current}}/{{total}} 遍',
    'watch.shadowing.phase.listening': '聽',
    'watch.shadowing.phase.gap': '留白',
    'watch.shadowing.repeat': '每句重複',
    'watch.shadowing.gap': '跟讀留白',
    'watch.shadowing.gap.short': '短',
    'watch.shadowing.gap.medium': '中',
    'watch.shadowing.gap.long': '長',
    'watch.shadowing.practiceRate': '練習語速',
    'watch.shadowing.autoAdvance': '自動下一句',
    'watch.shadowing.loopDisabled': '影子模式下使用跟讀循環',
    'watch.record.start': '錄音',
    'watch.record.stop': '停止',
    'watch.record.playMine': '我的',
    'watch.record.playOriginal': '原音',
    'watch.record.recording': '錄音中…',
    'watch.record.gapHint': '現在可以跟讀並錄音',
    'watch.record.hint': '錄下你的跟讀，再和原音對比回放',
    'watch.record.error.denied': '麥克風權限被拒絕，請在瀏覽器設定中允許',
    'watch.record.error.failed': '無法啟動錄音，請重試',
    'watch.record.error.unsupported': '目前瀏覽器不支援錄音',
    'watch.rhythm.ahead': '搶拍',
    'watch.rhythm.onTime': '合拍',
    'watch.rhythm.late': '拖拍',
    'watch.rhythm.latency': '開口 {{sec}}',
    'watch.rhythm.pace': '語速 ×{{ratio}}',
    'watch.rhythm.analyzing': '分析節奏…',
    'watch.rhythm.noSpeech': '沒聽到人聲，再錄一次試試',
    'watch.rhythm.unavailable': '目前瀏覽器無法分析節奏',

    // Two-line nav + pages
    'nav.online': '線上',
    'online.title': '線上探索',
    'online.empty.title': '還沒有線上內容',
    'online.empty.cta': '貼上一個 YouTube 連結開始學習',
    'online.tab.youtube': 'YouTube',
    'online.tab.podcast': '播客',
    'online.tab.podcastSoon': '即將推出',

    // Common
    'common.loading': '載入中...',
    'common.error': '錯誤',
    'common.retry': '重試',
    'common.cancel': '取消',
    'common.save': '儲存',
    'common.delete': '刪除',
    'common.edit': '編輯',
    'common.close': '關閉',
    'common.confirm': '確認',
    'common.success': '成功',
  },

  // English (en-US)
  'en-US': {
    // Navigation
    'nav.home': 'Home',
    'nav.settings': 'Settings',
    'nav.account': 'Account',
    'nav.toggleTheme': 'Toggle Theme',
    'nav.switchLanguage': 'Switch Language',
    'nav.selectLanguage': 'Select Interface Language / 选择界面语言',

    // File Management

    // Player
    'player.loading': 'Loading...',
    'player.error': 'Loading failed',
    'player.back': 'Back',
    'player.retry': 'Retry',

    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language Settings',
    'settings.targetLanguage': 'Target Learning Language (Audio Language)',
    'settings.nativeLanguage': 'Native Language (Translation Target)',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',
    'settings.ai.title': 'AI Engine',
    'settings.ai.engine': 'Translation engine',
    'settings.ai.engineHint':
      'Default uses the free quota; you can also connect directly with your own API key',
    'settings.ai.engineDefault': 'Default (free quota)',
    'settings.ai.apiKey': 'API Key',
    'settings.ai.apiKeyHint': 'Not set. Add your own {{provider}} key to connect directly',
    'settings.ai.apiKeyPlaceholder': 'Paste your API key',
    'settings.ai.model': 'Model',
    'settings.ai.modelHint': 'Any model ID works; the suggestions below are just prefill',
    'settings.ai.save': 'Save',
    'settings.ai.clear': 'Clear key',
    'settings.ai.getKey': 'Get a {{provider}} key',
    'settings.ai.privacy':
      'The key stays in this browser on this device and is sent only to the provider you pick, never through our servers. Be aware, though: any script running on this origin could read it, so weigh that risk yourself.',
    'settings.ai.defaultQuotaHint':
      'Using the free quota: translation runs on our servers, so you do not need to configure any key.',
    'settings.ai.saved': 'Saved',

    // Transcription

    // Library
    'library.title': 'Library',
    'library.add': 'Add',
    'library.search.placeholder': 'Search imported content',
    'library.empty.title': 'Nothing to learn yet',
    'library.empty.cta': 'Paste a YouTube link to start learning',
    'library.deleteConfirm': 'Delete this item and its subtitles?',
    'import.tab.youtube': 'YouTube link',
    'import.url.placeholder': 'Paste a YouTube video link…',
    'import.submit': 'Import',
    'import.resolving': 'Fetching video info…',
    'import.saving': 'Saving…',
    'import.error.INVALID_URL': 'Unrecognized YouTube link — please check the format',
    'import.error.VIDEO_NOT_FOUND': 'Video not found or deleted',
    'import.error.VIDEO_UNAVAILABLE': 'Video unavailable (private, region or age restricted)',
    'import.error.LIVE_NOT_SUPPORTED': 'Live streams are not supported yet',
    'import.error.VIDEO_TOO_LONG': 'Videos without captions are limited to 30 minutes',
    'import.error.YT_BLOCKED': 'The server cannot reach YouTube right now — try again later',
    'import.error.EXTRACTOR_UNAVAILABLE':
      'Transcription unavailable on this server; only captioned videos are supported',
    'import.error.EXTRACTOR_FAILED': 'Failed to fetch YouTube data — please retry',
    'import.error.QUOTA_EXHAUSTED': 'Daily AI transcription quota reached — try tomorrow',
    'import.error.SERVER_BUSY': 'Another transcription is running — try again shortly',
    'import.error.RATE_LIMITED': 'Too many requests — please slow down',
    'watch.subtitleCount': 'Subtitles',
    'watch.regenerate': 'Regenerate subtitles',
    'watch.openOnYouTube': 'Open on YouTube',
    'watch.embedBlocked': 'This video does not allow embedded playback',
    'watch.notFound': 'Content not found — it may have been deleted',
    'watch.stage.captions': 'Fetching captions…',
    'watch.stage.translating': 'Translating ({{done}}/{{total}})',
    'watch.retryPipeline': 'Retry',
    'watch.prevSentence': 'Previous sentence',
    'watch.nextSentence': 'Next sentence',
    'watch.loopSentence': 'Loop sentence',
    'watch.shadowing.toggle': 'Shadowing',
    'watch.shadowing.settings': 'Shadowing settings',
    'watch.shadowing.pass': 'Pass {{current}}/{{total}}',
    'watch.shadowing.phase.listening': 'Listen',
    'watch.shadowing.phase.gap': 'Gap',
    'watch.shadowing.repeat': 'Repeats per line',
    'watch.shadowing.gap': 'Practice gap',
    'watch.shadowing.gap.short': 'Short',
    'watch.shadowing.gap.medium': 'Med',
    'watch.shadowing.gap.long': 'Long',
    'watch.shadowing.practiceRate': 'Practice speed',
    'watch.shadowing.autoAdvance': 'Auto-advance',
    'watch.shadowing.loopDisabled': 'Use shadowing loop while practice is on',
    'watch.record.start': 'Record',
    'watch.record.stop': 'Stop',
    'watch.record.playMine': 'Mine',
    'watch.record.playOriginal': 'Original',
    'watch.record.recording': 'Recording…',
    'watch.record.gapHint': 'Shadow now — you can record',
    'watch.record.hint': 'Record your shadowing, then compare with the original',
    'watch.record.error.denied': 'Microphone permission denied — enable it in browser settings',
    'watch.record.error.failed': 'Could not start recording — try again',
    'watch.record.error.unsupported': 'Recording is not supported in this browser',
    'watch.rhythm.ahead': 'Rushed',
    'watch.rhythm.onTime': 'On beat',
    'watch.rhythm.late': 'Late',
    'watch.rhythm.latency': 'Start {{sec}}',
    'watch.rhythm.pace': 'Pace ×{{ratio}}',
    'watch.rhythm.analyzing': 'Analyzing rhythm…',
    'watch.rhythm.noSpeech': 'No speech detected — try recording again',
    'watch.rhythm.unavailable': 'This browser cannot analyze rhythm',

    // Two-line nav + pages
    'nav.online': 'Online',
    'online.title': 'Discover',
    'online.empty.title': 'No online content yet',
    'online.empty.cta': 'Paste a YouTube link to start learning',
    'online.tab.youtube': 'YouTube',
    'online.tab.podcast': 'Podcast',
    'online.tab.podcastSoon': 'Coming soon',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.retry': 'Retry',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.success': 'Success',
  },

  // Japanese (ja-JP)
  'ja-JP': {
    // Navigation
    'nav.home': 'ホーム',
    'nav.settings': '設定',
    'nav.account': 'アカウント',
    'nav.toggleTheme': 'テーマ切り替え',
    'nav.switchLanguage': '言語切り替え',
    'nav.selectLanguage': 'インターフェース言語を選択 / Select Language',

    // File Management

    // Player
    'player.loading': '読み込み中...',
    'player.error': '読み込み失敗',
    'player.back': '戻る',
    'player.retry': '再試行',

    // Settings
    'settings.title': '設定',
    'settings.language': '言語設定',
    'settings.targetLanguage': '学習対象言語（音声言語）',
    'settings.nativeLanguage': '母語（翻訳対象）',
    'settings.save': '保存',
    'settings.cancel': 'キャンセル',
    'settings.ai.title': 'AI エンジン',
    'settings.ai.engine': '翻訳エンジン',
    'settings.ai.engineHint': '既定は無料枠。自分の API キーでプロバイダに直結することもできます',
    'settings.ai.engineDefault': '既定（無料枠）',
    'settings.ai.apiKey': 'API キー',
    'settings.ai.apiKeyHint': '未設定。{{provider}} のキーを入れると直結できます',
    'settings.ai.apiKeyPlaceholder': 'API キーを貼り付け',
    'settings.ai.model': 'モデル',
    'settings.ai.modelHint': '任意のモデル ID を入力できます。候補は入力補助です',
    'settings.ai.save': '保存',
    'settings.ai.clear': 'キーを削除',
    'settings.ai.getKey': '{{provider}} のキーを取得',
    'settings.ai.privacy':
      'キーはこの端末のブラウザにのみ保存され、選択したプロバイダにのみ送信されます。当社のサーバーは経由しません。ただし、このオリジンで動く任意のスクリプトが読み取れる点はご承知おきください。',
    'settings.ai.defaultQuotaHint':
      '現在は無料枠を使用中です。翻訳は当社のサーバーで実行されるため、キーの設定は不要です。',
    'settings.ai.saved': '保存しました',

    // Transcription

    // Library
    'library.title': 'ライブラリ',
    'library.add': '追加',
    'library.search.placeholder': 'インポート済みコンテンツを検索',
    'library.empty.title': 'まだ学習コンテンツがありません',
    'library.empty.cta': 'YouTube リンクを貼り付けて学習を始める',
    'library.deleteConfirm': 'このコンテンツと字幕を削除しますか？',
    'import.tab.youtube': 'YouTube リンク',
    'import.url.placeholder': 'YouTube 動画のリンクを貼り付け…',
    'import.submit': 'インポート',
    'import.resolving': '動画情報を取得中…',
    'import.saving': '保存中…',
    'import.error.INVALID_URL': 'YouTube リンクを認識できません。形式を確認してください',
    'import.error.VIDEO_NOT_FOUND': '動画が存在しないか削除されています',
    'import.error.VIDEO_UNAVAILABLE': '動画を利用できません（非公開・地域・年齢制限）',
    'import.error.LIVE_NOT_SUPPORTED': 'ライブ配信は未対応です。アーカイブ後にお試しください',
    'import.error.VIDEO_TOO_LONG': '字幕なし動画は 30 分以内のみ対応しています',
    'import.error.YT_BLOCKED':
      'サーバーが YouTube にアクセスできません。後でもう一度お試しください',
    'import.error.EXTRACTOR_UNAVAILABLE':
      'サーバーに転写コンポーネントがなく、字幕付き動画のみ対応しています',
    'import.error.EXTRACTOR_FAILED': 'YouTube データの取得に失敗しました。後で再試行してください',
    'import.error.QUOTA_EXHAUSTED': '本日の AI 転写枠を使い切りました。明日お試しください',
    'import.error.SERVER_BUSY': '別の転写タスクが実行中です。しばらくしてからお試しください',
    'import.error.RATE_LIMITED': 'リクエストが多すぎます。しばらくお待ちください',
    'watch.subtitleCount': '字幕',
    'watch.regenerate': '字幕を再生成',
    'watch.openOnYouTube': 'YouTube で開く',
    'watch.embedBlocked': 'この動画は埋め込み再生を許可していません',
    'watch.notFound': 'コンテンツが見つかりません。削除された可能性があります',
    'watch.stage.captions': '字幕を取得中…',
    'watch.stage.translating': '翻訳中（{{done}}/{{total}}）',
    'watch.retryPipeline': '再試行',
    'watch.prevSentence': '前の文',
    'watch.nextSentence': '次の文',
    'watch.loopSentence': '一文リピート',
    'watch.shadowing.toggle': 'シャドーイング',
    'watch.shadowing.settings': '練習設定',
    'watch.shadowing.pass': '{{current}}/{{total}} 回目',
    'watch.shadowing.phase.listening': '聴く',
    'watch.shadowing.phase.gap': '間',
    'watch.shadowing.repeat': '1文の繰り返し',
    'watch.shadowing.gap': '練習の間',
    'watch.shadowing.gap.short': '短',
    'watch.shadowing.gap.medium': '中',
    'watch.shadowing.gap.long': '長',
    'watch.shadowing.practiceRate': '練習速度',
    'watch.shadowing.autoAdvance': '自動で次へ',
    'watch.shadowing.loopDisabled': 'シャドーイング中は練習ループを使用',
    'watch.record.start': '録音',
    'watch.record.stop': '停止',
    'watch.record.playMine': '自分',
    'watch.record.playOriginal': '原音',
    'watch.record.recording': '録音中…',
    'watch.record.gapHint': '今すぐシャドーイングして録音できます',
    'watch.record.hint': '自分の声を録音して原音と比較',
    'watch.record.error.denied': 'マイクの権限が拒否されました。ブラウザ設定で許可してください',
    'watch.record.error.failed': '録音を開始できませんでした。再試行してください',
    'watch.record.error.unsupported': 'このブラウザは録音に対応していません',
    'watch.rhythm.ahead': '走り気味',
    'watch.rhythm.onTime': 'ちょうど良い',
    'watch.rhythm.late': '遅れ気味',
    'watch.rhythm.latency': '開始 {{sec}}',
    'watch.rhythm.pace': '速度 ×{{ratio}}',
    'watch.rhythm.analyzing': 'リズムを分析中…',
    'watch.rhythm.noSpeech': '音声を検出できませんでした。もう一度録音してください',
    'watch.rhythm.unavailable': 'このブラウザはリズム分析に対応していません',

    // Two-line nav + pages
    'nav.online': 'オンライン',
    'online.title': '見つける',
    'online.empty.title': 'オンラインコンテンツがまだありません',
    'online.empty.cta': 'YouTube リンクを貼り付けて学習を始める',
    'online.tab.youtube': 'YouTube',
    'online.tab.podcast': 'ポッドキャスト',
    'online.tab.podcastSoon': '近日公開',

    // Common
    'common.loading': '読み込み中...',
    'common.error': 'エラー',
    'common.retry': '再試行',
    'common.cancel': 'キャンセル',
    'common.save': '保存',
    'common.delete': '削除',
    'common.edit': '編集',
    'common.close': '閉じる',
    'common.confirm': '確認',
    'common.success': '成功',
  },
}

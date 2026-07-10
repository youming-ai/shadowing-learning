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
  'file.upload.title': string
  'file.upload.dragDrop': string
  'file.upload.orClick': string
  'file.upload.supportedFormats': string
  'file.upload.uploading': string
  'file.upload.error': string
  'file.upload.retry': string
  'file.upload.clearError': string
  'file.upload.maxFilesReached': string
  'file.upload.selectFiles': string

  // Player
  'player.loading': string
  'player.error': string
  'player.noSubtitles': string
  'player.transcribeFirst': string
  'player.back': string
  'player.retry': string

  // Settings
  'settings.title': string
  'settings.language': string
  'settings.targetLanguage': string
  'settings.nativeLanguage': string
  'settings.save': string
  'settings.cancel': string

  // Transcription
  'transcription.status.pending': string
  'transcription.status.processing': string
  'transcription.status.completed': string
  'transcription.status.failed': string
  'transcription.start': string
  'transcription.cancel': string
  'transcription.retry': string
  'transcription.success': string
  'transcription.error': string

  // Library
  'library.title': string
  'library.add': string
  'library.search.placeholder': string
  'library.empty.title': string
  'library.empty.cta': string
  'library.deleteConfirm': string

  // Import dialog
  'import.tab.youtube': string
  'import.tab.upload': string
  'import.url.placeholder': string
  'import.submit': string
  'import.resolving': string
  'import.saving': string
  'import.error.INVALID_URL': string
  'import.error.VIDEO_NOT_FOUND': string
  'import.error.VIDEO_UNAVAILABLE': string
  'import.error.LIVE_NOT_SUPPORTED': string
  'import.error.VIDEO_TOO_LONG': string
  'import.error.AUDIO_TOO_LARGE': string
  'import.error.YT_BLOCKED': string
  'import.error.EXTRACTOR_UNAVAILABLE': string
  'import.error.EXTRACTOR_FAILED': string
  'import.error.QUOTA_EXHAUSTED': string
  'import.error.SERVER_BUSY': string
  'import.error.RATE_LIMITED': string

  // Watch page
  'watch.subtitleCount': string
  'watch.regenerate': string
  'watch.regenerateConfirm': string
  'watch.openOnYouTube': string
  'watch.embedBlocked': string
  'watch.notFound': string
  'watch.stage.captions': string
  'watch.stage.transcribing': string
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

  // Two-line nav + pages
  'nav.online': string
  'nav.myAudio': string
  'online.title': string
  'online.empty.title': string
  'online.empty.cta': string
  'online.tab.youtube': string
  'online.tab.podcast': string
  'online.tab.podcastSoon': string
  'myaudio.title': string
  'myaudio.empty.title': string
  'myaudio.empty.cta': string
  'myaudio.upload': string

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
    'file.upload.title': '上传音频文件',
    'file.upload.dragDrop': '拖拽音频文件到此处，或点击选择文件',
    'file.upload.orClick': '或点击选择文件',
    'file.upload.supportedFormats': '支持格式：MP3, WAV, M4A, FLAC',
    'file.upload.uploading': '上传中...',
    'file.upload.error': '上传失败',
    'file.upload.retry': '重试',
    'file.upload.clearError': '清除错误',
    'file.upload.maxFilesReached': '已达到文件数量上限',
    'file.upload.selectFiles': '选择文件',

    // Player
    'player.loading': '加载中...',
    'player.error': '加载失败',
    'player.noSubtitles': '暂无字幕内容，请先在主页转录此文件',
    'player.transcribeFirst': '请先转录此文件',
    'player.back': '返回',
    'player.retry': '重试',

    // Settings
    'settings.title': '设置',
    'settings.language': '语言设置',
    'settings.targetLanguage': '目标学习语言（音频语言）',
    'settings.nativeLanguage': '母语（翻译目标）',
    'settings.save': '保存',
    'settings.cancel': '取消',

    // Transcription
    'transcription.status.pending': '等待中',
    'transcription.status.processing': '转录中',
    'transcription.status.completed': '已完成',
    'transcription.status.failed': '转录失败',
    'transcription.start': '开始转录',
    'transcription.cancel': '取消转录',
    'transcription.retry': '重新转录',
    'transcription.success': '转录完成',
    'transcription.error': '转录失败',

    // Library
    'library.title': '资料库',
    'library.add': '添加',
    'library.search.placeholder': '搜索已导入的内容',
    'library.empty.title': '还没有学习内容',
    'library.empty.cta': '粘贴一个 YouTube 链接开始学习',
    'library.deleteConfirm': '删除这个内容及其字幕？',
    'import.tab.youtube': 'YouTube 链接',
    'import.tab.upload': '上传音频',
    'import.url.placeholder': '粘贴 YouTube 视频链接…',
    'import.submit': '导入',
    'import.resolving': '获取视频信息…',
    'import.saving': '保存中…',
    'import.error.INVALID_URL': '无法识别的 YouTube 链接，请检查格式',
    'import.error.VIDEO_NOT_FOUND': '视频不存在或已删除',
    'import.error.VIDEO_UNAVAILABLE': '视频不可用（私享、区域或年龄限制）',
    'import.error.LIVE_NOT_SUPPORTED': '暂不支持直播内容，请等存档后再导入',
    'import.error.VIDEO_TOO_LONG': '无字幕视频暂只支持 30 分钟以内',
    'import.error.AUDIO_TOO_LARGE': '音频超过大小上限，暂无法转写',
    'import.error.YT_BLOCKED': '服务器暂时无法访问 YouTube，请稍后再试',
    'import.error.EXTRACTOR_UNAVAILABLE': '服务器未配置转写组件，暂只支持有字幕的视频',
    'import.error.EXTRACTOR_FAILED': 'YouTube 数据获取失败，请稍后重试',
    'import.error.QUOTA_EXHAUSTED': '今日 AI 转写额度已用完，请明天再试',
    'import.error.SERVER_BUSY': '已有转写任务进行中，请稍后再试',
    'import.error.RATE_LIMITED': '请求过于频繁，请稍后再试',
    'watch.subtitleCount': '字幕',
    'watch.regenerate': '重新生成字幕',
    'watch.regenerateConfirm': '重新转写将消耗 AI 额度，确定继续？',
    'watch.openOnYouTube': '在 YouTube 打开',
    'watch.embedBlocked': '该视频不允许嵌入播放',
    'watch.notFound': '内容不存在，可能已被删除',
    'watch.stage.captions': '获取字幕中…',
    'watch.stage.transcribing': 'AI 转写中…',
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

    // Two-line nav + pages
    'nav.online': '在线',
    'nav.myAudio': '我的音频',
    'online.title': '在线发现',
    'online.empty.title': '还没有在线内容',
    'online.empty.cta': '粘贴一个 YouTube 链接开始学习',
    'online.tab.youtube': 'YouTube',
    'online.tab.podcast': '播客',
    'online.tab.podcastSoon': '即将推出',
    'myaudio.title': '我的音频',
    'myaudio.empty.title': '还没有上传音频',
    'myaudio.empty.cta': '上传一段音频开始练习',
    'myaudio.upload': '上传音频',

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
    'file.upload.title': '上傳音頻檔案',
    'file.upload.dragDrop': '拖拽音頻檔案到此處，或點擊選擇檔案',
    'file.upload.orClick': '或點擊選擇檔案',
    'file.upload.supportedFormats': '支援格式：MP3, WAV, M4A, FLAC',
    'file.upload.uploading': '上傳中...',
    'file.upload.error': '上傳失敗',
    'file.upload.retry': '重試',
    'file.upload.clearError': '清除錯誤',
    'file.upload.maxFilesReached': '已達到檔案數量上限',
    'file.upload.selectFiles': '選擇檔案',

    // Player
    'player.loading': '載入中...',
    'player.error': '載入失敗',
    'player.noSubtitles': '暫無字幕內容，請先在主頁轉錄此檔案',
    'player.transcribeFirst': '請先轉錄此檔案',
    'player.back': '返回',
    'player.retry': '重試',

    // Settings
    'settings.title': '設定',
    'settings.language': '語言設定',
    'settings.targetLanguage': '目標學習語言（音頻語言）',
    'settings.nativeLanguage': '母語（翻譯目標）',
    'settings.save': '儲存',
    'settings.cancel': '取消',

    // Transcription
    'transcription.status.pending': '等待中',
    'transcription.status.processing': '轉錄中',
    'transcription.status.completed': '已完成',
    'transcription.status.failed': '轉錄失敗',
    'transcription.start': '開始轉錄',
    'transcription.cancel': '取消轉錄',
    'transcription.retry': '重新轉錄',
    'transcription.success': '轉錄完成',
    'transcription.error': '轉錄失敗',

    // Library
    'library.title': '資料庫',
    'library.add': '新增',
    'library.search.placeholder': '搜尋已匯入的內容',
    'library.empty.title': '還沒有學習內容',
    'library.empty.cta': '貼上一個 YouTube 連結開始學習',
    'library.deleteConfirm': '刪除這個內容及其字幕？',
    'import.tab.youtube': 'YouTube 連結',
    'import.tab.upload': '上傳音訊',
    'import.url.placeholder': '貼上 YouTube 影片連結…',
    'import.submit': '匯入',
    'import.resolving': '取得影片資訊…',
    'import.saving': '儲存中…',
    'import.error.INVALID_URL': '無法識別的 YouTube 連結，請檢查格式',
    'import.error.VIDEO_NOT_FOUND': '影片不存在或已刪除',
    'import.error.VIDEO_UNAVAILABLE': '影片不可用（私人、區域或年齡限制）',
    'import.error.LIVE_NOT_SUPPORTED': '暫不支援直播內容，請等存檔後再匯入',
    'import.error.VIDEO_TOO_LONG': '無字幕影片暫只支援 30 分鐘以內',
    'import.error.AUDIO_TOO_LARGE': '音訊超過大小上限，暫無法轉寫',
    'import.error.YT_BLOCKED': '伺服器暫時無法存取 YouTube，請稍後再試',
    'import.error.EXTRACTOR_UNAVAILABLE': '伺服器未設定轉寫元件，暫只支援有字幕的影片',
    'import.error.EXTRACTOR_FAILED': 'YouTube 資料取得失敗，請稍後重試',
    'import.error.QUOTA_EXHAUSTED': '今日 AI 轉寫額度已用完，請明天再試',
    'import.error.SERVER_BUSY': '已有轉寫任務進行中，請稍後再試',
    'import.error.RATE_LIMITED': '請求過於頻繁，請稍後再試',
    'watch.subtitleCount': '字幕',
    'watch.regenerate': '重新產生字幕',
    'watch.regenerateConfirm': '重新轉寫將消耗 AI 額度，確定繼續？',
    'watch.openOnYouTube': '在 YouTube 開啟',
    'watch.embedBlocked': '該影片不允許嵌入播放',
    'watch.notFound': '內容不存在，可能已被刪除',
    'watch.stage.captions': '取得字幕中…',
    'watch.stage.transcribing': 'AI 轉寫中…',
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

    // Two-line nav + pages
    'nav.online': '線上',
    'nav.myAudio': '我的音訊',
    'online.title': '線上探索',
    'online.empty.title': '還沒有線上內容',
    'online.empty.cta': '貼上一個 YouTube 連結開始學習',
    'online.tab.youtube': 'YouTube',
    'online.tab.podcast': '播客',
    'online.tab.podcastSoon': '即將推出',
    'myaudio.title': '我的音訊',
    'myaudio.empty.title': '還沒有上傳音訊',
    'myaudio.empty.cta': '上傳一段音訊開始練習',
    'myaudio.upload': '上傳音訊',

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
    'file.upload.title': 'Upload Audio Files',
    'file.upload.dragDrop': 'Drag and drop audio files here, or click to select',
    'file.upload.orClick': 'or click to select files',
    'file.upload.supportedFormats': 'Supported formats: MP3, WAV, M4A, FLAC',
    'file.upload.uploading': 'Uploading...',
    'file.upload.error': 'Upload failed',
    'file.upload.retry': 'Retry',
    'file.upload.clearError': 'Clear Error',
    'file.upload.maxFilesReached': 'Maximum file count reached',
    'file.upload.selectFiles': 'Select Files',

    // Player
    'player.loading': 'Loading...',
    'player.error': 'Loading failed',
    'player.noSubtitles': 'No subtitles available. Please transcribe this file first.',
    'player.transcribeFirst': 'Please transcribe this file first',
    'player.back': 'Back',
    'player.retry': 'Retry',

    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language Settings',
    'settings.targetLanguage': 'Target Learning Language (Audio Language)',
    'settings.nativeLanguage': 'Native Language (Translation Target)',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',

    // Transcription
    'transcription.status.pending': 'Pending',
    'transcription.status.processing': 'Processing',
    'transcription.status.completed': 'Completed',
    'transcription.status.failed': 'Failed',
    'transcription.start': 'Start Transcription',
    'transcription.cancel': 'Cancel Transcription',
    'transcription.retry': 'Retry Transcription',
    'transcription.success': 'Transcription Completed',
    'transcription.error': 'Transcription Failed',

    // Library
    'library.title': 'Library',
    'library.add': 'Add',
    'library.search.placeholder': 'Search imported content',
    'library.empty.title': 'Nothing to learn yet',
    'library.empty.cta': 'Paste a YouTube link to start learning',
    'library.deleteConfirm': 'Delete this item and its subtitles?',
    'import.tab.youtube': 'YouTube link',
    'import.tab.upload': 'Upload audio',
    'import.url.placeholder': 'Paste a YouTube video link…',
    'import.submit': 'Import',
    'import.resolving': 'Fetching video info…',
    'import.saving': 'Saving…',
    'import.error.INVALID_URL': 'Unrecognized YouTube link — please check the format',
    'import.error.VIDEO_NOT_FOUND': 'Video not found or deleted',
    'import.error.VIDEO_UNAVAILABLE': 'Video unavailable (private, region or age restricted)',
    'import.error.LIVE_NOT_SUPPORTED': 'Live streams are not supported yet',
    'import.error.VIDEO_TOO_LONG': 'Videos without captions are limited to 30 minutes',
    'import.error.AUDIO_TOO_LARGE': 'Audio exceeds the size limit for transcription',
    'import.error.YT_BLOCKED': 'The server cannot reach YouTube right now — try again later',
    'import.error.EXTRACTOR_UNAVAILABLE':
      'Transcription unavailable on this server; only captioned videos are supported',
    'import.error.EXTRACTOR_FAILED': 'Failed to fetch YouTube data — please retry',
    'import.error.QUOTA_EXHAUSTED': 'Daily AI transcription quota reached — try tomorrow',
    'import.error.SERVER_BUSY': 'Another transcription is running — try again shortly',
    'import.error.RATE_LIMITED': 'Too many requests — please slow down',
    'watch.subtitleCount': 'Subtitles',
    'watch.regenerate': 'Regenerate subtitles',
    'watch.regenerateConfirm': 'Re-transcribing consumes AI quota. Continue?',
    'watch.openOnYouTube': 'Open on YouTube',
    'watch.embedBlocked': 'This video does not allow embedded playback',
    'watch.notFound': 'Content not found — it may have been deleted',
    'watch.stage.captions': 'Fetching captions…',
    'watch.stage.transcribing': 'AI transcribing…',
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

    // Two-line nav + pages
    'nav.online': 'Online',
    'nav.myAudio': 'My Audio',
    'online.title': 'Discover',
    'online.empty.title': 'No online content yet',
    'online.empty.cta': 'Paste a YouTube link to start learning',
    'online.tab.youtube': 'YouTube',
    'online.tab.podcast': 'Podcast',
    'online.tab.podcastSoon': 'Coming soon',
    'myaudio.title': 'My Audio',
    'myaudio.empty.title': 'No uploaded audio yet',
    'myaudio.empty.cta': 'Upload an audio file to start practicing',
    'myaudio.upload': 'Upload audio',

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
    'file.upload.title': '音声ファイルをアップロード',
    'file.upload.dragDrop': '音声ファイルをここにドラッグ＆ドロップ、またはクリックして選択',
    'file.upload.orClick': 'またはクリックしてファイルを選択',
    'file.upload.supportedFormats': '対応フォーマット：MP3, WAV, M4A, FLAC',
    'file.upload.uploading': 'アップロード中...',
    'file.upload.error': 'アップロード失敗',
    'file.upload.retry': '再試行',
    'file.upload.clearError': 'エラーをクリア',
    'file.upload.maxFilesReached': 'ファイル数の上限に達しました',
    'file.upload.selectFiles': 'ファイルを選択',

    // Player
    'player.loading': '読み込み中...',
    'player.error': '読み込み失敗',
    'player.noSubtitles': '字幕がありません。まずこのファイルを文字起こししてください。',
    'player.transcribeFirst': 'まずこのファイルを文字起こししてください',
    'player.back': '戻る',
    'player.retry': '再試行',

    // Settings
    'settings.title': '設定',
    'settings.language': '言語設定',
    'settings.targetLanguage': '学習対象言語（音声言語）',
    'settings.nativeLanguage': '母語（翻訳対象）',
    'settings.save': '保存',
    'settings.cancel': 'キャンセル',

    // Transcription
    'transcription.status.pending': '待機中',
    'transcription.status.processing': '処理中',
    'transcription.status.completed': '完了',
    'transcription.status.failed': '失敗',
    'transcription.start': '文字起こしを開始',
    'transcription.cancel': '文字起こしをキャンセル',
    'transcription.retry': '文字起こしを再試行',
    'transcription.success': '文字起こしが完了しました',
    'transcription.error': '文字起こしに失敗しました',

    // Library
    'library.title': 'ライブラリ',
    'library.add': '追加',
    'library.search.placeholder': 'インポート済みコンテンツを検索',
    'library.empty.title': 'まだ学習コンテンツがありません',
    'library.empty.cta': 'YouTube リンクを貼り付けて学習を始める',
    'library.deleteConfirm': 'このコンテンツと字幕を削除しますか？',
    'import.tab.youtube': 'YouTube リンク',
    'import.tab.upload': '音声をアップロード',
    'import.url.placeholder': 'YouTube 動画のリンクを貼り付け…',
    'import.submit': 'インポート',
    'import.resolving': '動画情報を取得中…',
    'import.saving': '保存中…',
    'import.error.INVALID_URL': 'YouTube リンクを認識できません。形式を確認してください',
    'import.error.VIDEO_NOT_FOUND': '動画が存在しないか削除されています',
    'import.error.VIDEO_UNAVAILABLE': '動画を利用できません（非公開・地域・年齢制限）',
    'import.error.LIVE_NOT_SUPPORTED': 'ライブ配信は未対応です。アーカイブ後にお試しください',
    'import.error.VIDEO_TOO_LONG': '字幕なし動画は 30 分以内のみ対応しています',
    'import.error.AUDIO_TOO_LARGE': '音声がサイズ上限を超えているため転写できません',
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
    'watch.regenerateConfirm': '再転写は AI 枠を消費します。続行しますか？',
    'watch.openOnYouTube': 'YouTube で開く',
    'watch.embedBlocked': 'この動画は埋め込み再生を許可していません',
    'watch.notFound': 'コンテンツが見つかりません。削除された可能性があります',
    'watch.stage.captions': '字幕を取得中…',
    'watch.stage.transcribing': 'AI 転写中…',
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

    // Two-line nav + pages
    'nav.online': 'オンライン',
    'nav.myAudio': 'マイ音声',
    'online.title': '見つける',
    'online.empty.title': 'オンラインコンテンツがまだありません',
    'online.empty.cta': 'YouTube リンクを貼り付けて学習を始める',
    'online.tab.youtube': 'YouTube',
    'online.tab.podcast': 'ポッドキャスト',
    'online.tab.podcastSoon': '近日公開',
    'myaudio.title': 'マイ音声',
    'myaudio.empty.title': 'アップロードした音声がまだありません',
    'myaudio.empty.cta': '音声をアップロードして練習を始める',
    'myaudio.upload': '音声をアップロード',

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

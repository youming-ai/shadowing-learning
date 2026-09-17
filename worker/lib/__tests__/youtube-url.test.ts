import { describe, expect, it } from 'vitest'
import { extractVideoId } from '../youtube-url'

const ID = 'dQw4w9WgXcQ'

describe('extractVideoId', () => {
  it.each([
    [ID, '裸 id'],
    [`https://www.youtube.com/watch?v=${ID}`, '标准 watch 链接'],
    [`https://youtube.com/watch?v=${ID}&t=42s`, '带时间戳等多余参数'],
    [`https://m.youtube.com/watch?v=${ID}`, '移动端子域'],
    [`https://music.youtube.com/watch?v=${ID}`, 'music 子域'],
    [`https://youtu.be/${ID}`, '短链'],
    [`https://youtu.be/${ID}?si=abc`, '短链带参数'],
    [`https://www.youtube.com/shorts/${ID}`, 'Shorts'],
    [`https://www.youtube.com/embed/${ID}`, 'embed'],
    [`https://www.youtube.com/live/${ID}`, '直播存档'],
    [`https://www.youtube.com/v/${ID}`, '旧式 /v/ 路径'],
    [`https://www.youtube-nocookie.com/embed/${ID}`, '无 cookie 嵌入域名'],
    [`  https://youtu.be/${ID}  `, '首尾空白'],
    [`${ID} `, '裸 id 带尾部空白'],
  ])('解析 %s（%s）', (input) => {
    expect(extractVideoId(input)).toBe(ID)
  })

  it.each([
    ['https://www.youtube.com/', '没有 id'],
    [`https://www.youtube.com/watch?v=abc`, '残缺 id（以前会被原样返回）'],
    [`https://youtu.be/${ID}x`, '短链 id 多一位'],
    [`https://youtu.be/`, '短链没有 id'],
    [`https://example.com/watch?v=${ID}`, '非 YouTube 域名'],
    [`https://notyoutube.com/watch?v=${ID}`, '域名后缀伪装（不能只看 includes）'],
    ['', '空串'],
    ['not a url', '非 URL'],
  ])('拒绝 %s（%s）', (input) => {
    expect(extractVideoId(input)).toBeNull()
  })
})

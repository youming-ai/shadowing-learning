// 用法: bun run scripts/spike-youtube-vps.ts
// 在目标 VPS（Dokploy 宿主机或容器内）运行，验证 youtubei.js 与 yt-dlp 的可达性。
// 决策门：成功率 < 90% 则启动 spec Section 0 的对策阶梯（cookies / PO token / 代理）。
import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Innertube } from 'youtubei.js'

const execFileAsync = promisify(execFile)

// 混合冷热门、有手动字幕/仅 ASR/无字幕的样本
const VIDEO_IDS = [
  'dQw4w9WgXcQ',
  'jNQXAC9IVRw',
  '9bZkp7q19f0',
  'kJQP7kiw5Fk',
  'OPf0YbXqDm0',
  'fJ9rUzIMcZQ',
  'hTWKbfoikeg',
  'YQHsXMglC9A',
  'CevxZvSJLk8',
  'JGwWNGJdvx8',
  'RgKAFK5djSk',
  'OJNxxKlPtPg',
  'uelHwf8o7_U',
  'e-ORhEE9VVg',
  'fLexgOxsZu0',
  'nfWlot6h_JM',
  'hY7m5jjJ9mM',
  'CocEMWdc7Ck',
  '09R8_2nJtjg',
  '7PCkvCPvDXk',
]

async function spikeInnertube() {
  const yt = await Innertube.create()
  let okBasic = 0
  let okTranscript = 0
  for (const id of VIDEO_IDS) {
    try {
      const basic = await yt.getBasicInfo(id)
      if (basic.basic_info.title) okBasic++
      try {
        const info = await yt.getInfo(id)
        const transcript = await info.getTranscript()
        if (transcript?.transcript?.content) okTranscript++
      } catch (e) {
        console.log(`  transcript ${id}: FAIL ${(e as Error).message.slice(0, 120)}`)
      }
    } catch (e) {
      console.log(`  basicInfo ${id}: FAIL ${(e as Error).message.slice(0, 120)}`)
    }
  }
  console.log(
    `innertube: basicInfo ${okBasic}/${VIDEO_IDS.length}, transcript ${okTranscript}/${VIDEO_IDS.length}`,
  )
  return { okBasic, okTranscript }
}

async function spikeYtdlp() {
  let ok = 0
  const dir = mkdtempSync(join(tmpdir(), 'spike-'))
  try {
    for (const id of VIDEO_IDS.slice(0, 20)) {
      try {
        await execFileAsync(
          'yt-dlp',
          [
            '-f',
            'bestaudio[abr<=64]/worstaudio',
            '--max-filesize',
            '25M',
            '--no-part',
            '-o',
            join(dir, `${id}.audio`),
            '--',
            id,
          ],
          { timeout: 90_000 },
        )
        ok++
      } catch (e) {
        console.log(`  yt-dlp ${id}: FAIL ${(e as Error).message.slice(0, 120)}`)
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  console.log(`yt-dlp: ${ok}/20`)
  return ok
}

const { okBasic, okTranscript } = await spikeInnertube()
const ytdlpOk = await spikeYtdlp()
const pass = okBasic >= 18 && okTranscript >= 16 && ytdlpOk >= 18
console.log(
  pass
    ? '\nSPIKE PASS（≥90% 阈值，按计划继续）'
    : '\nSPIKE FAIL（启动对策阶梯，见 spec Section 0）',
)
process.exit(pass ? 0 : 1)

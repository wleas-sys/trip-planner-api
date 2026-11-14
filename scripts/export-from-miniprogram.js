// 从河源小程序的 utils/data.js 导出 JSON 种子数据。
// 这是数据准备脚本，不是练习题 —— 练习题在 tasks/ 目录里。
//
// 用法：
//   MINIPROGRAM_DIR="C:/path/to/heyuan-v2.2" node scripts/export-from-miniprogram.js
// 不设置环境变量时使用下面的默认路径。

const fs = require('node:fs')
const path = require('node:path')

const MINIPROGRAM_DIR = process.env.MINIPROGRAM_DIR
  || 'C:/Users/Administrator/Desktop/小程序/heyuan-v2.2'

const dataFile = path.join(MINIPROGRAM_DIR, 'utils', 'data.js')

if (!fs.existsSync(dataFile)) {
  console.error(`找不到 ${dataFile}`)
  console.error('请用环境变量 MINIPROGRAM_DIR 指向小程序目录，例如：')
  console.error('  MINIPROGRAM_DIR="D:/your/heyuan-v2.2" node scripts/export-from-miniprogram.js')
  process.exit(1)
}

// data.js 用 CommonJS 导出，且不依赖微信运行时，可直接 require。
const { PLACES, ROUTES, SOURCES, MODES, DATA_VERSION } = require(dataFile)

const outDir = path.join(__dirname, '..', 'data')
fs.mkdirSync(outDir, { recursive: true })

function write(name, value) {
  const file = path.join(outDir, name)
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8')
  const size = (fs.statSync(file).size / 1024).toFixed(1)
  console.log(`  ${name.padEnd(14)} ${String(Array.isArray(value) ? value.length : Object.keys(value).length).padStart(3)} 项  ${size} KB`)
}

console.log(`从 ${dataFile} 导出（数据版本 ${DATA_VERSION}）：`)
write('places.json', PLACES)
write('routes.json', ROUTES)
write('sources.json', SOURCES)
write('modes.json', MODES)
write('meta.json', {
  dataVersion: DATA_VERSION,
  placeCount: PLACES.length,
  routeCount: ROUTES.length,
  sourceCount: Object.keys(SOURCES).length,
  areas: [...new Set(PLACES.map(p => p.area))].sort(),
  categories: [...new Set(PLACES.map(p => p.category))].sort(),
})
console.log('完成。')

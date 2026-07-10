import { writeFileSync, mkdirSync, existsSync } from 'fs'

const REPO = 'youssef-grayaa/CTF_Writeups'
const POSTS_REPO = 'youssef-grayaa/random_posts'
const MALWARE_REPO = 'youssef-grayaa/polymorphic_malware'

const HEADERS = process.env.GITHUB_TOKEN
  ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
  : {}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchJSON(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: HEADERS })
    if (res.ok) return res.json()
    if (res.status >= 500 && attempt < retries) {
      console.warn(`Retry ${attempt + 1}/${retries} for ${url} (${res.status})`)
      await sleep(1000 * (attempt + 1))
      continue
    }
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  }
}

async function main() {
  const challenges = await fetchChallenges()
  const posts = await fetchPosts()
  const malwareWriteups = await fetchMalwareWriteups()

  mkdirSync('src/data', { recursive: true })
  writeFileSync('src/data/challenges.json', JSON.stringify(challenges, null, 2))
  writeFileSync('src/data/posts.json', JSON.stringify(posts, null, 2))
  writeFileSync('src/data/malware.json', JSON.stringify(malwareWriteups, null, 2))

  console.log(`Fetched ${challenges.length} challenges, ${posts.length} posts, ${malwareWriteups.length} malware writeups`)
}

async function fetchChallenges() {
  const API = `https://api.github.com/repos/${REPO}/contents`
  const data = await fetchJSON(API)
  const ctfs = data.filter(item => item.type === 'dir' && !item.name.startsWith('.'))

  const challenges = []
  for (const ctf of ctfs) {
    let ctfData
    try {
      ctfData = await fetchJSON(ctf.url)
    } catch (err) {
      console.warn(`Skipping CTF ${ctf.name}: ${err.message}`)
      continue
    }
    const challengeDirs = ctfData.filter(item => item.type === 'dir')

    for (const challenge of challengeDirs) {
      let chalData
      try {
        chalData = await fetchJSON(challenge.url)
      } catch (err) {
        console.warn(`Skipping challenge ${ctf.name}/${challenge.name}: ${err.message}`)
        continue
      }
      const writeup = chalData.find(f => f.name === 'WRITEUP.md')
      if (!writeup) continue

      const solverDir = chalData.find(f => f.name === 'Solution' && f.type === 'dir')
      let solverFile = null
      if (solverDir) {
        try {
          const solverData = await fetchJSON(solverDir.url)
          const pyFile = solverData.find(f => f.name.endsWith('.py'))
          if (pyFile) solverFile = pyFile.name
        } catch {
          // no solver
        }
      }

      challenges.push({
        name: challenge.name,
        ctf: ctf.name,
        writeupUrl: writeup.download_url,
        solverFile
      })
    }
  }

  return challenges
}

async function fetchPosts() {
  try {
    const API = `https://api.github.com/repos/${POSTS_REPO}/contents`
    const data = await fetchJSON(API)
    return data
      .filter(item => item.name.endsWith('.md'))
      .map(f => ({
        name: f.name.replace('.md', ''),
        url: f.download_url
      }))
  } catch (err) {
    console.warn(`Could not fetch posts: ${err.message}`)
    return []
  }
}

async function fetchMalwareWriteups() {
  try {
    const API = `https://api.github.com/repos/${MALWARE_REPO}/contents`
    const data = await fetchJSON(API)
    const dirs = data.filter(item => item.type === 'dir' && !item.name.startsWith('.'))

    const writeups = []
    for (const dir of dirs) {
      let dirData
      try {
        dirData = await fetchJSON(dir.url)
      } catch (err) {
        console.warn(`Skipping malware dir ${dir.name}: ${err.message}`)
        continue
      }
      const writeup = dirData.find(f => f.name === 'notes.md')
      if (writeup) {
        writeups.push({
          name: dir.name,
          writeupUrl: writeup.download_url
        })
      }
    }

    return writeups
  } catch (err) {
    console.warn(`Could not fetch malware writeups: ${err.message}`)
    return []
  }
}

main().catch(err => {
  console.error('Fatal data fetch error:', err)
  if (process.env.GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN was set but root fetch failed — aborting')
    process.exit(1)
  }
  mkdirSync('src/data', { recursive: true })
  if (!existsSync('src/data/challenges.json')) writeFileSync('src/data/challenges.json', '[]')
  if (!existsSync('src/data/posts.json')) writeFileSync('src/data/posts.json', '[]')
  if (!existsSync('src/data/malware.json')) writeFileSync('src/data/malware.json', '[]')
  process.exit(0)
})

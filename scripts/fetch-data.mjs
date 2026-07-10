import { writeFileSync, mkdirSync } from 'fs'

const REPO = 'youssef-grayaa/CTF_Writeups'
const POSTS_REPO = 'youssef-grayaa/random_posts'
const MALWARE_REPO = 'youssef-grayaa/polymorphic_malware'

const HEADERS = process.env.GITHUB_TOKEN
  ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
  : {}

async function fetchJSON(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  }
  return res.json()
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
    const ctfData = await fetchJSON(ctf.url)
    const challengeDirs = ctfData.filter(item => item.type === 'dir')

    for (const challenge of challengeDirs) {
      const chalData = await fetchJSON(challenge.url)
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
  const API = `https://api.github.com/repos/${POSTS_REPO}/contents`
  const data = await fetchJSON(API)
  return data
    .filter(item => item.name.endsWith('.md'))
    .map(f => ({
      name: f.name.replace('.md', ''),
      url: f.download_url
    }))
}

async function fetchMalwareWriteups() {
  try {
    const API = `https://api.github.com/repos/${MALWARE_REPO}/contents`
    const data = await fetchJSON(API)
    const dirs = data.filter(item => item.type === 'dir' && !item.name.startsWith('.'))

    const writeups = []
    for (const dir of dirs) {
      const dirData = await fetchJSON(dir.url)
      const writeup = dirData.find(f => f.name === 'WRITEUP.md')
      if (writeup) {
        writeups.push({
          name: dir.name,
          writeupUrl: writeup.download_url
        })
      }
    }

    return writeups
  } catch {
    console.warn('Could not fetch malware writeups (repo may not exist yet)')
    return []
  }
}

main().catch(err => {
  console.error('Data fetch failed:', err)
  if (process.env.GITHUB_TOKEN) {
    console.error('Fatal: GITHUB_TOKEN was provided but fetch still failed')
    process.exit(1)
  }
  console.error('Writing empty data files so local build can proceed')
  mkdirSync('src/data', { recursive: true })
  writeFileSync('src/data/challenges.json', '[]')
  writeFileSync('src/data/posts.json', '[]')
  writeFileSync('src/data/malware.json', '[]')
  process.exit(0)
})

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import ShinyText from './components/ShinyText'
import PixelBlast from './components/PixelBlast'
import { themes, currentTheme as defaultTheme } from './theme'

const IS_LOCAL = import.meta.env.VITE_LOCAL === 'true'
const REPO = 'youssef-grayaa/CTF_Writeups'
const POSTS_REPO = 'youssef-grayaa/random_posts'
const API = `https://api.github.com/repos/${REPO}/contents`
const POSTS_API = `https://api.github.com/repos/${POSTS_REPO}/contents`
const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN

const fetchWithAuth = (url) => {
  const headers = {}
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`
  }
  return fetch(url, { headers })
}

function App() {
  const [challenges, setChallenges] = useState([])
  const [posts, setPosts] = useState([])
  const [selected, setSelected] = useState(null)
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(true)
  const [solver, setSolver] = useState('')
  const [showSolver, setShowSolver] = useState(false)
  const [page, setPage] = useState('home') // 'home', 'ctf', 'malware', 'posts', 'posts'
  const [currentTheme, setCurrentTheme] = useState(Object.keys(themes).find(key => themes[key] === defaultTheme) || 'fantasy')

  const themeNames = Object.keys(themes)
  const theme = themes[currentTheme]

  const cycleTheme = () => {
    const currentIndex = themeNames.indexOf(currentTheme)
    const nextIndex = (currentIndex + 1) % themeNames.length
    setCurrentTheme(themeNames[nextIndex])
  }

  useEffect(() => {
    // Apply theme to CSS variables
    const root = document.documentElement
    root.style.setProperty('--bg', theme.background)
    root.style.setProperty('--text', theme.text)
    root.style.setProperty('--text-secondary', theme.textSecondary)
    root.style.setProperty('--primary', theme.primary)
    root.style.setProperty('--card-bg', theme.cardBg)
    root.style.setProperty('--card-bg-hover', theme.cardBgHover)
    root.style.setProperty('--border', theme.border)
    root.style.setProperty('--border-accent', theme.borderAccent)
    root.style.setProperty('--border-dark', theme.borderDark)
    root.style.setProperty('--pixel-blast', theme.pixelBlast)
  }, [currentTheme, theme])
  
  useEffect(() => {
    fetchChallenges()
    fetchPosts()
  }, [])

  const fetchChallenges = async () => {
    try {
      if (IS_LOCAL) {
        await fetchLocalChallenges()
      } else {
        await fetchGithubChallenges()
      }
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const fetchLocalChallenges = async () => {
    const res = await fetch('/api/challenges')
    const data = await res.json()
    setChallenges(data)
  }

  const fetchGithubChallenges = async () => {
    const res = await fetchWithAuth(API)
    const data = await res.json()
    const ctfs = data.filter(item => item.type === 'dir' && !item.name.startsWith('.'))
    
    const allChallenges = []
    for (const ctf of ctfs) {
      const ctfRes = await fetchWithAuth(ctf.url)
      const ctfData = await ctfRes.json()
      const challengeDirs = ctfData.filter(item => item.type === 'dir')
      
      for (const challenge of challengeDirs) {
        const chalRes = await fetchWithAuth(challenge.url)
        const chalData = await chalRes.json()
        const writeup = chalData.find(f => f.name === 'WRITEUP.md')
        
        if (writeup) {
          allChallenges.push({
            name: challenge.name,
            ctf: ctf.name,
            writeupUrl: writeup.download_url
          })
        }
      }
    }
    
    setChallenges(allChallenges)
  }

  const fetchPosts = async () => {
    try {
      if (IS_LOCAL) {
        const res = await fetch('/api/posts')
        const data = await res.json()
        setPosts(data)
      } else {
        const res = await fetchWithAuth(POSTS_API)
        const data = await res.json()
        const mdFiles = data.filter(item => item.name.endsWith('.md'))
        setPosts(mdFiles.map(f => ({
          name: f.name.replace('.md', ''),
          url: f.download_url
        })))
      }
    } catch (err) {
      console.error('Error fetching posts:', err)
    }
  }

  const loadPost = async (post) => {
    setSelected(post)
    setLoading(true)
    try {
      if (IS_LOCAL) {
        const res = await fetch(`/api/post?name=${post.name}`)
        const text = await res.text()
        setMarkdown(text)
      } else {
        const res = await fetch(post.url)
        const text = await res.text()
        setMarkdown(text)
      }
    } catch (err) {
      setMarkdown('# Error loading post')
    }
    setLoading(false)
  }

  const loadWriteup = async (challenge) => {
    setSelected(challenge)
    setLoading(true)
    setSolver('')
    setShowSolver(false)
    try {
      if (IS_LOCAL) {
        const res = await fetch(`/api/writeup?ctf=${challenge.ctf}&name=${challenge.name}`)
        const text = await res.text()
        setMarkdown(text)
        
        const solverRes = await fetch(`/api/solver?ctf=${challenge.ctf}&name=${challenge.name}`)
        if (solverRes.ok) {
          const solverText = await solverRes.text()
          setSolver(solverText)
        }
      } else {
        const res = await fetch(challenge.writeupUrl)
        const text = await res.text()
        setMarkdown(text)
        
        // Try to fetch solver from GitHub
        const solverUrl = challenge.writeupUrl.replace('/WRITEUP.md', '/Solution/')
        try {
          const solverDirRes = await fetchWithAuth(`https://api.github.com/repos/${REPO}/contents/${challenge.ctf}/${challenge.name}/Solution`)
          const files = await solverDirRes.json()
          const pyFile = files.find(f => f.name.endsWith('.py'))
          
          if (pyFile) {
            const solverRes = await fetch(pyFile.download_url)
            const solverText = await solverRes.text()
            setSolver(solverText)
          }
        } catch (err) {
          console.log('No solver found')
        }
      }
    } catch (err) {
      setMarkdown('# Error loading writeup')
    }
    setLoading(false)
  }

  const downloadChallenge = async () => {
    if (IS_LOCAL) {
      window.location.href = `/api/download?ctf=${selected.ctf}&name=${selected.name}`
    } else {
      const url = `https://github.com/${REPO}/archive/refs/heads/main.zip`
      window.open(url, '_blank')
    }
  }

  if (loading) {
    return <div className="loading">LOADING...</div>
  }

  const PixelBlastBg = () => (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
      <PixelBlast
        variant="triangle"
        pixelSize={4}
        color={theme.pixelBlast}
        patternScale={2}
        patternDensity={1}
        pixelSizeJitter={0}
        enableRipples
        rippleSpeed={0.3}
        rippleThickness={0.1}
        rippleIntensityScale={1}
        speed={0.5}
        edgeFade={0.1}
        transparent
      />
    </div>
  )

  if (page === 'home') {
    return (
      <div className="app">
        <PixelBlastBg />
        <button className="theme-toggle" onClick={cycleTheme} title={`Theme: ${currentTheme}`}>
          <img src={`${import.meta.env.BASE_URL}angry.png`} alt="Change Theme" />
        </button>
        <div className="header" style={{ position: 'relative', zIndex: 1 }}>
          <ShinyText text="GRAYAA_VX" />
          <p>▸ Digital Ghost in the Machine ◂</p>
        </div>

        <div className="about-section" style={{ position: 'relative', zIndex: 1 }}>
          <h2>About Me</h2>
          <p>
            Hey there, I'm <strong>Grayaa</strong>, a full-time code slicer and part-time digital ghost 
            navigating the neon shadows of cyberspace. Cybersecurity isn't just a job—it's my playground. 
            From dissecting malware to bending systems in ways corpos pray never happen, I'm here to 
            explore the underbelly of code and the art of digital survival.
          </p>
          <p>
            On this blog, you'll find deep dives into CTF writeups, exploits, malware analysis, and the 
            odd experiment that pushes the limits of what most firewalls consider "safe." No fluff, no 
            sales pitch, just raw insights from the frontlines of the cyberwar.
          </p>
          <p>
            Pull up a terminal, choom. Cause it's about to get weird.
          </p>
          <div className="socials">
            <a href="https://github.com/youssef-grayaa" target="_blank" rel="noopener noreferrer" className="social-link">
              GitHub
            </a>
            <a href="https://www.linkedin.com/in/youssef-grayaa-6b2513243/" target="_blank" rel="noopener noreferrer" className="social-link">
              LinkedIn
            </a>
            <a target="_blank" rel="noopener noreferrer" className="social-link">
              Discord: _pumpking21
            </a>
          </div>
        </div>

        <div className="nav-buttons" style={{ position: 'relative', zIndex: 1 }}>
          <button className="nav-btn" onClick={() => setPage('ctf')}>
            CTF WRITEUPS
          </button>
          <button className="nav-btn" onClick={() => setPage('malware')}>
            MALWARE_SHENANIGANS
          </button>
          <button className="nav-btn" onClick={() => setPage('posts')}>
            RANDOM_POSTS
          </button>
        </div>
      </div>
    )
  }

  if (page === 'malware') {
    return (
      <div className="app">
        <PixelBlastBg />
        <button className="theme-toggle" onClick={cycleTheme} title={`Theme: ${currentTheme}`}>
          <img src={`${import.meta.env.BASE_URL}angry.png`} alt="Change Theme" />
        </button>
        <div className="header" style={{ position: 'relative', zIndex: 1 }}>
          <h1>MALWARE_SHENANIGANS</h1>
          <p>▸ In Development ◂</p>
        </div>
        <button className="back-btn" onClick={() => setPage('home')} style={{position: 'relative', left: 0, bottom: 0, marginBottom: '20px', zIndex: 1}}>
          <img src={`${import.meta.env.BASE_URL}arrow-right.png`} alt="Back" />
        </button>
        <div className="about-section" style={{ position: 'relative', zIndex: 1 }}>
          <h2>Coming Soon</h2>
          <p style={{textAlign: 'center'}}>
            This section is currently under development. Check back soon for malware analysis, 
            reverse engineering deep dives, and other digital chaos.
          </p>
        </div>
      </div>
    )
  }

  if (page === 'posts') {
    return (
      <div className="app">
        <PixelBlastBg />
        <button className="theme-toggle" onClick={cycleTheme} title={`Theme: ${currentTheme}`}>
          <img src={`${import.meta.env.BASE_URL}angry.png`} alt="Change Theme" />
        </button>
        <div className="header" style={{ position: 'relative', zIndex: 1 }}>
          <h1>RANDOM_POSTS</h1>
          <p>▸ Thoughts & Musings ◂</p>
        </div>

        {!selected ? (
          <>
            <button className="back-btn" onClick={() => setPage('home')} style={{position: 'relative', left: 0, bottom: 0, marginBottom: '20px', zIndex: 1}}>
              <img src={`${import.meta.env.BASE_URL}arrow-right.png`} alt="Back" />
            </button>
            <div className="challenges-grid" style={{ position: 'relative', zIndex: 1 }}>
              {posts.map((p, i) => (
                <div key={i} className="challenge-card" onClick={() => loadPost(p)}>
                  <h3>{p.name.replace(/_/g, ' ')}</h3>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <button className="back-btn" onClick={() => setSelected(null)} style={{ zIndex: 1 }}>
              <img src={`${import.meta.env.BASE_URL}arrow-right.png`} alt="Back" />
            </button>
            <div className="writeup-container" style={{ position: 'relative', zIndex: 1 }}>
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <PixelBlastBg />
      <button className="theme-toggle" onClick={cycleTheme} title={`Theme: ${currentTheme}`}>
        <img src={`${import.meta.env.BASE_URL}angry.png`} alt="Change Theme" />
      </button>
      <div className="header" style={{ position: 'relative', zIndex: 1 }}>
        <h1>CTF WRITEUPS</h1>
        <p>▸ Challenges & Solutions ◂</p>
      </div>

      {!selected ? (
        <>
          <button className="back-btn" onClick={() => setPage('home')} style={{position: 'relative', left: 0, bottom: 0, marginBottom: '20px', zIndex: 1}}>
            <img src={`${import.meta.env.BASE_URL}arrow-right.png`} alt="Back" />
          </button>
          <div className="challenges-grid" style={{ position: 'relative', zIndex: 1 }}>
            {challenges.map((c, i) => (
              <div key={i} className="challenge-card" onClick={() => loadWriteup(c)}>
                <div className="ctf-name">[{c.ctf}]</div>
                <h3>{c.name}</h3>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <button className="back-btn" onClick={() => setSelected(null)}>
            <img src={`${import.meta.env.BASE_URL}arrow-right.png`} alt="Back" />
          </button>
          <div className="writeup-container" style={{ position: 'relative', zIndex: 1 }}>
            <ReactMarkdown>{markdown}</ReactMarkdown>
            <button className="download-btn" onClick={() => setShowSolver(!showSolver)}>
              {showSolver ? '▲ HIDE SOLVER' : '▼ VIEW SOLVER SCRIPT'}
            </button>
            {showSolver && (
              <div className="solver-container">
                {solver ? (
                  <SyntaxHighlighter language="python" style={atomDark} customStyle={{
                    background: '#1a1410',
                    border: '2px solid #4a3a2a',
                    fontSize: '1.4rem',
                    fontFamily: "'VT323', monospace"
                  }}>
                    {solver}
                  </SyntaxHighlighter>
                ) : (
                  <p>Solver not found, you should probably check the github repo</p>
                )}
              </div>
            )}
            <button className="download-btn" onClick={downloadChallenge}>
              <img src={`${import.meta.env.BASE_URL}slaughter.png`} alt="Download" />
              DOWNLOAD CHALLENGE
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default App

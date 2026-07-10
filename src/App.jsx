import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import ShinyText from './components/ShinyText'
import PixelBlast from './components/PixelBlast'
import { themes, currentTheme as defaultTheme } from './theme'

import challengesData from './data/challenges.json'
import postsData from './data/posts.json'
import malwareData from './data/malware.json'

const IS_LOCAL = import.meta.env.VITE_LOCAL === 'true'
const REPO = 'youssef-grayaa/CTF_Writeups'

const navigate = (hash) => { window.location.hash = hash }

function App() {
  const [challenges, setChallenges] = useState([])
  const [posts, setPosts] = useState([])
  const [malwareList, setMalwareList] = useState([])
  const [selected, setSelected] = useState(null)
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(true)
  const [solver, setSolver] = useState('')
  const [showSolver, setShowSolver] = useState(false)
  const [page, setPage] = useState('home')
  const [currentTheme, setCurrentTheme] = useState(
    Object.keys(themes).find(key => themes[key] === defaultTheme) || 'fantasy'
  )

  const challengesRef = useRef(challenges)
  const postsRef = useRef(posts)
  const malwareListRef = useRef(malwareList)

  useEffect(() => { challengesRef.current = challenges }, [challenges])
  useEffect(() => { postsRef.current = posts }, [posts])
  useEffect(() => { malwareListRef.current = malwareList }, [malwareList])

  const themeNames = Object.keys(themes)
  const theme = themes[currentTheme]

  const cycleTheme = () => {
    const currentIndex = themeNames.indexOf(currentTheme)
    const nextIndex = (currentIndex + 1) % themeNames.length
    setCurrentTheme(themeNames[nextIndex])
  }

  useEffect(() => {
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

  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    if (IS_LOCAL) {
      fetchLocalData()
    } else {
      setChallenges(challengesData)
      setPosts(postsData)
      setMalwareList(malwareData)
      setDataLoaded(true)
      setLoading(false)
    }
  }, [])

  const fetchLocalData = async () => {
    try {
      const [chalRes, postRes] = await Promise.all([
        fetch('/api/challenges'),
        fetch('/api/posts')
      ])
      setChallenges(await chalRes.json())
      setPosts(await postRes.json())
    } catch (err) {
      console.error(err)
    }
    setDataLoaded(true)
    setLoading(false)
  }

  useEffect(() => {
    if (!dataLoaded) return
    if (window.location.hash) {
      window.dispatchEvent(new Event('hashchange'))
    }
  }, [dataLoaded])

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '')
      const parts = hash.split('/').filter(Boolean)

      const c = challengesRef.current
      const p = postsRef.current
      const m = malwareListRef.current

      if (parts.length === 0 || parts[0] === 'home') {
        setPage('home')
        setSelected(null)
        setMarkdown('')
        setSolver('')
        setShowSolver(false)
        return
      }

      if (parts[0] === 'ctf') {
        setPage('ctf')
        setSolver('')
        setShowSolver(false)
        if (parts.length >= 3) {
          const challenge = c.find(x => x.ctf === decodeURIComponent(parts[1]) && x.name === decodeURIComponent(parts[2]))
          if (challenge) { loadWriteup(challenge); return }
        }
        setSelected(null)
        setMarkdown('')
        return
      }

      if (parts[0] === 'malware') {
        setPage('malware')
        if (parts.length >= 2) {
          const entry = m.find(x => x.name === decodeURIComponent(parts[1]))
          if (entry) { loadMalwareWriteup(entry); return }
        }
        setSelected(null)
        setMarkdown('')
        return
      }

      if (parts[0] === 'posts') {
        setPage('posts')
        if (parts.length >= 2) {
          const post = p.find(x => x.name === decodeURIComponent(parts[1]))
          if (post) { loadPost(post); return }
        }
        setSelected(null)
        setMarkdown('')
        return
      }
    }

    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  const loadPost = async (post) => {
    setSelected(post)
    setLoading(true)
    try {
      const res = IS_LOCAL ? await fetch(post.url) : await fetch(post.url)
      setMarkdown(await res.text())
    } catch {
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
        setMarkdown(await res.text())
        const solverRes = await fetch(`/api/solver?ctf=${challenge.ctf}&name=${challenge.name}`)
        if (solverRes.ok) setSolver(await solverRes.text())
      } else {
        const res = await fetch(challenge.writeupUrl)
        setMarkdown(await res.text())
        if (challenge.solverFile) {
          const solverUrl = `https://raw.githubusercontent.com/${REPO}/main/${challenge.ctf}/${challenge.name}/Solution/${challenge.solverFile}`
          try {
            const solverRes = await fetch(solverUrl)
            if (solverRes.ok) setSolver(await solverRes.text())
          } catch {
            console.log('No solver found')
          }
        }
      }
    } catch {
      setMarkdown('# Error loading writeup')
    }
    setLoading(false)
  }

  const loadMalwareWriteup = async (entry) => {
    setSelected(entry)
    setLoading(true)
    try {
      if (IS_LOCAL) {
        const res = await fetch(`/api/writeup?ctf=malware&name=${entry.name}`)
        setMarkdown(await res.text())
      } else {
        const res = await fetch(entry.writeupUrl)
        setMarkdown(await res.text())
      }
    } catch {
      setMarkdown('# Error loading writeup')
    }
    setLoading(false)
  }

  const downloadChallenge = () => {
    if (IS_LOCAL) {
      window.location.href = `/api/download?ctf=${selected.ctf}&name=${selected.name}`
    } else {
      window.open(`https://github.com/${REPO}/tree/main/${selected.ctf}/${selected.name}/Handout`, '_blank')
    }
  }

  if (loading) return <div className="loading">LOADING...</div>

  const PixelBlastBg = () => (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
      <PixelBlast variant="triangle" pixelSize={4} color={theme.pixelBlast} patternScale={2}
        patternDensity={1} pixelSizeJitter={0} enableRipples rippleSpeed={0.3}
        rippleThickness={0.1} rippleIntensityScale={1} speed={0.5} edgeFade={0.1} transparent />
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
          <p>Hey there, I'm <strong>Grayaa</strong>, a full-time code slicer and part-time digital ghost navigating the neon shadows of cyberspace. From dissecting malware to bending systems in ways corpos pray never happen, I'm here to explore the underbelly of code and the art of digital survival.</p>
          <p>On this blog, you'll find deep dives into CTF writeups, exploits, malware analysis, and the odd experiment that pushes the limits of what most firewalls consider "safe." No fluff, no sales pitch, just raw insights from the frontlines of the cyberwar.</p>
          <p>Pull up a terminal, choom. Cause it's about to get weird.</p>
          <div className="socials">
            <a href="https://github.com/youssef-grayaa" target="_blank" rel="noopener noreferrer" className="social-link">GitHub</a>
            <a href="https://www.linkedin.com/in/youssef-grayaa-6b2513243/" target="_blank" rel="noopener noreferrer" className="social-link">LinkedIn</a>
            <a target="_blank" rel="noopener noreferrer" className="social-link">Discord: _pumpking21</a>
          </div>
        </div>
        <div className="nav-buttons" style={{ position: 'relative', zIndex: 1 }}>
          <button className="nav-btn" onClick={() => navigate('#/ctf')}>CTF WRITEUPS</button>
          <button className="nav-btn" onClick={() => navigate('#/malware')}>MALWARE_SHENANIGANS</button>
          <button className="nav-btn" onClick={() => navigate('#/posts')}>RANDOM_POSTS</button>
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
          <ShinyText text="MALWARE_SHENANIGANS" />
          <p>▸ Reverse Engineering & Analysis ◂</p>
        </div>
        {!selected ? (
          <>
            <button className="back-btn" onClick={() => navigate('#/')} style={{ position: 'relative', left: 0, bottom: 0, marginBottom: '20px', zIndex: 1 }}>
              <img src={`${import.meta.env.BASE_URL}arrow-right.png`} alt="Back" />
            </button>
            <div style={{
              background: 'var(--card-bg)',
              border: '3px solid var(--border)',
              padding: '30px',
              position: 'relative',
              zIndex: 1
            }}>
              <a href="https://github.com/youssef-grayaa/polymorphic_malware" target="_blank" rel="noopener noreferrer" style={{
                color: 'var(--text-secondary)',
                textDecoration: 'underline',
                textUnderlineOffset: '4px',
                textDecorationColor: 'var(--border)',
                transition: 'color 0.2s, text-decoration-color 0.2s',
                fontSize: '1.5rem',
                fontFamily: '"Pixelify Sans", monospace',
                letterSpacing: '3px',
                display: 'inline-block',
                marginBottom: '30px'
              }}
              onMouseEnter={e => { e.target.style.color = 'var(--primary)'; e.target.style.textDecorationColor = 'var(--primary)' }}
              onMouseLeave={e => { e.target.style.color = 'var(--text-secondary)'; e.target.style.textDecorationColor = 'var(--border)' }}>
                polymorphic shellcode
              </a>
              {malwareList.length === 0 ? (
                <>
                  <h2 style={{ fontFamily: '"Jacquard 24", system-ui', color: 'var(--primary)', fontSize: '2rem', textAlign: 'center', marginBottom: '20px' }}>
                    Coming Soon
                  </h2>
                  <p style={{ textAlign: 'center' }}>
                    This section is currently under development. Check back soon for malware analysis,
                    reverse engineering deep dives, and other digital chaos.
                  </p>
                </>
              ) : (
                <div className="challenges-grid">
                  {malwareList.map((m, i) => (
                    <div key={i} className="challenge-card" onClick={() => navigate(`#/malware/${encodeURIComponent(m.name)}`)}>
                      <h3>{m.name}</h3>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button className="back-btn" onClick={() => navigate('#/malware')} style={{ zIndex: 1 }}>
              <img src={`${import.meta.env.BASE_URL}arrow-right.png`} alt="Back" />
            </button>
            <div className="writeup-container" style={{ position: 'relative', zIndex: 1 }}>
              <ReactMarkdown components={{
                img: ({ src, alt }) => {
                  let imageUrl = src
                  if (src && !src.startsWith('http') && selected?.writeupUrl) {
                    const baseUrl = selected.writeupUrl.replace(/\/[^/]+\.md$/, '')
                    imageUrl = src.startsWith('./') ? `${baseUrl}/${src.slice(2)}` : `${baseUrl}/${src}`
                  }
                  return <img src={imageUrl} alt={alt} style={{ maxWidth: '100%' }} />
                }
              }}>
                {markdown}
              </ReactMarkdown>
            </div>
          </>
        )}
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
            <button className="back-btn" onClick={() => navigate('#/')} style={{ position: 'relative', left: 0, bottom: 0, marginBottom: '20px', zIndex: 1 }}>
              <img src={`${import.meta.env.BASE_URL}arrow-right.png`} alt="Back" />
            </button>
            <div className="challenges-grid" style={{ position: 'relative', zIndex: 1 }}>
              {posts.map((p, i) => (
                <div key={i} className="challenge-card" onClick={() => navigate(`#/posts/${encodeURIComponent(p.name)}`)}>
                  <h3>{p.name.replace(/_/g, ' ')}</h3>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <button className="back-btn" onClick={() => navigate('#/posts')} style={{ zIndex: 1 }}>
              <img src={`${import.meta.env.BASE_URL}arrow-right.png`} alt="Back" />
            </button>
            <div className="writeup-container" style={{ position: 'relative', zIndex: 1 }}>
              <ReactMarkdown components={{
                img: ({ src, alt }) => {
                  let imageUrl = src
                  if (src && !src.startsWith('http') && selected?.url) {
                    const baseUrl = selected.url.replace(/\/[^/]*\.md$/, '')
                    imageUrl = src.startsWith('./') ? `${baseUrl}/${src.slice(2)}` : `${baseUrl}/${src}`
                  }
                  return <img src={imageUrl} alt={alt} style={{ maxWidth: '100%' }} />
                }
              }}>
                {markdown}
              </ReactMarkdown>
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
          <button className="back-btn" onClick={() => navigate('#/')} style={{ position: 'relative', left: 0, bottom: 0, marginBottom: '20px', zIndex: 1 }}>
            <img src={`${import.meta.env.BASE_URL}arrow-right.png`} alt="Back" />
          </button>
          <div className="challenges-grid" style={{ position: 'relative', zIndex: 1 }}>
            {challenges.map((c, i) => (
              <div key={i} className="challenge-card" onClick={() => navigate(`#/ctf/${encodeURIComponent(c.ctf)}/${encodeURIComponent(c.name)}`)}>
                <div className="ctf-name">[{c.ctf}]</div>
                <h3>{c.name}</h3>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <button className="back-btn" onClick={() => navigate('#/ctf')}>
            <img src={`${import.meta.env.BASE_URL}arrow-right.png`} alt="Back" />
          </button>
          <div className="writeup-container" style={{ position: 'relative', zIndex: 1 }}>
            <ReactMarkdown components={{
              img: ({ src, alt }) => {
                let imageUrl = src
                if (src && !src.startsWith('http') && selected?.writeupUrl) {
                  const baseUrl = selected.writeupUrl.replace('/WRITEUP.md', '')
                  imageUrl = src.startsWith('./') ? `${baseUrl}/${src.slice(2)}` : `${baseUrl}/${src}`
                }
                return <img src={imageUrl} alt={alt} style={{ maxWidth: '100%' }} />
              }
            }}>
              {markdown}
            </ReactMarkdown>
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

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import archiver from 'archiver'

const LOCAL_PATH = '/home/grayaa_vx/CTF_Writeups'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    {
      name: 'local-ctf-api',
      configureServer(server) {
        server.middlewares.use('/api/challenges', (req, res) => {
          const challenges = []
          const ctfs = fs.readdirSync(LOCAL_PATH).filter(f => {
            const stat = fs.statSync(path.join(LOCAL_PATH, f))
            return stat.isDirectory() && !f.startsWith('.')
          })

          for (const ctf of ctfs) {
            const ctfPath = path.join(LOCAL_PATH, ctf)
            const challengeDirs = fs.readdirSync(ctfPath).filter(f => {
              const stat = fs.statSync(path.join(ctfPath, f))
              return stat.isDirectory()
            })

            for (const challenge of challengeDirs) {
              const writeupPath = path.join(ctfPath, challenge, 'WRITEUP.md')
              if (fs.existsSync(writeupPath)) {
                challenges.push({ name: challenge, ctf })
              }
            }
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(challenges))
        })

        server.middlewares.use('/api/writeup', (req, res) => {
          const url = new URL(req.url, `http://${req.headers.host}`)
          const ctf = url.searchParams.get('ctf')
          const name = url.searchParams.get('name')
          const writeupPath = path.join(LOCAL_PATH, ctf, name, 'WRITEUP.md')

          if (fs.existsSync(writeupPath)) {
            const content = fs.readFileSync(writeupPath, 'utf-8')
            res.setHeader('Content-Type', 'text/plain')
            res.end(content)
          } else {
            res.statusCode = 404
            res.end('Not found')
          }
        })

        server.middlewares.use('/api/solver', (req, res) => {
          const url = new URL(req.url, `http://${req.headers.host}`)
          const ctf = url.searchParams.get('ctf')
          const name = url.searchParams.get('name')
          const solutionPath = path.join(LOCAL_PATH, ctf, name, 'Solution')

          if (fs.existsSync(solutionPath)) {
            const files = fs.readdirSync(solutionPath)
            const pyFile = files.find(f => f.endsWith('.py'))
            
            if (pyFile) {
              const solverPath = path.join(solutionPath, pyFile)
              const content = fs.readFileSync(solverPath, 'utf-8')
              res.setHeader('Content-Type', 'text/plain')
              res.end(content)
            } else {
              res.statusCode = 404
              res.end('No solver found')
            }
          } else {
            res.statusCode = 404
            res.end('Solution folder not found')
          }
        })

        server.middlewares.use('/api/download', (req, res) => {
          const url = new URL(req.url, `http://${req.headers.host}`)
          const ctf = url.searchParams.get('ctf')
          const name = url.searchParams.get('name')
          const solutionPath = path.join(LOCAL_PATH, ctf, name, 'Solution')

          if (fs.existsSync(solutionPath)) {
            res.setHeader('Content-Type', 'application/zip')
            res.setHeader('Content-Disposition', `attachment; filename="${name}.zip"`)

            const archive = archiver('zip', { zlib: { level: 9 } })
            archive.pipe(res)
            archive.directory(solutionPath, false)
            archive.finalize()
          } else {
            res.statusCode = 404
            res.end('Solution folder not found')
          }
        })
      }
    }
  ],
})

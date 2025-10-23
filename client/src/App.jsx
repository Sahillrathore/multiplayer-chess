import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ChessGame from './ChessGame'
import AuthPage, { AuthCallback } from './AuthPage'
import LandingPage from './pages/LandingPage'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      {/* <ChessGame /> */}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage/>} />
          <Route path="/login" element={<AuthPage/>} />
          <Route path="/play" element={<ChessGame/>} />
          <Route path="/auth/callback" element={<AuthCallback/>} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App

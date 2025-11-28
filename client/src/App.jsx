import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ChessGame from './ChessGame'
import AuthPage from './AuthPage'
import LandingPage from './pages/LandingPage'
import AuthCallback from './pages/AuthCallback'
import JoinInvite from './pages/JoinInvite'
import PracticeGame from './pages/PracticeGame'
import ProtectedRoute from './components/ProtectedRoute'
import NotFound from './pages/NotFound'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      {/* <ChessGame /> */}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage/>} />
          <Route path="/login" element={<AuthPage/>} />
          <Route path="/play" element={ <ProtectedRoute> <ChessGame/> </ProtectedRoute>} /> 
          <Route path='practice' element={<PracticeGame />} />
          <Route path="/play/:gameId" element={<ChessGame />} />
          <Route path="/auth/callback" element={<AuthCallback/>} />
          <Route path="/join/:token" element={<JoinInvite/>} />
          <Route path="*" element={<NotFound/>} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App

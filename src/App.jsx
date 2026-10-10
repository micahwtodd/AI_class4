import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import World from './World.jsx'
import Player from './Player.jsx'
import Minimap from './Minimap.jsx'
import TouchControls from './TouchControls.jsx'
import ChatPanel from './ChatPanel.jsx'
import { ZAMAN } from './Zaman.jsx'
import { chat } from './chat.js'
import { EYE, SPAWN } from './layout.js'

const PROFS = { [ZAMAN.id]: ZAMAN }

export default function App() {
  const [locked, setLocked] = useState(false)
  const [where, setWhere] = useState('')
  const [showMap, setShowMap] = useState(true)
  const lockRef = useRef()
  const mapRef = useRef()
  const onLock = useCallback((v) => setLocked(v), [])
  const onWhere = useCallback((w) => setWhere(w), [])
  // phones have no pointer lock, so they get a joystick + drag-to-look instead
  const [isTouch] = useState(() => matchMedia('(pointer: coarse)').matches) // phones + tablets; touchscreen laptops still get mouse mode
  const [touchOn, setTouchOn] = useState(false)
  const touchRef = useRef({ active: false, move: [0, 0], look: [0, 0], jump: false })
  const setTouch = (on) => {
    touchRef.current.active = on
    touchRef.current.move = [0, 0]
    setTouchOn(on)
  }
  const playing = locked || touchOn

  // chatting with a professor: free the mouse (or pause the joystick) so you can type
  const [chatWith, setChatWith] = useState(null)
  const [aimed, setAimed] = useState(null)
  useEffect(() => {
    chat.onAim = setAimed
    chat.onOpen = (id) => {
      chat.with = id
      setChatWith(id)
      touchRef.current.active = false
      touchRef.current.move = [0, 0]
      document.exitPointerLock?.()
    }
  }, [])
  const closeChat = useCallback(() => {
    chat.with = null
    setChatWith(null)
    if (touchOn) touchRef.current.active = true
    else lockRef.current?.() // back to walking (if the browser allows re-locking right away)
  }, [touchOn])

  useEffect(() => {
    const k = (e) => e.code === 'KeyM' && !e.target.closest?.('input, textarea') && setShowMap((v) => !v)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  return (
    <>
      <Canvas
        camera={{ fov: 72, near: 0.05, far: 800, position: [SPAWN.x, EYE, SPAWN.z] }}
        dpr={[1, 1.75]}
      >
        <World />
        <Player lockRef={lockRef} mapRef={mapRef} touchRef={touchRef} onLock={onLock} onWhere={onWhere} />
      </Canvas>

      <div className="where">
        <span className="dot" />
        {where}
      </div>
      <div className={showMap ? 'mapwrap' : 'mapwrap hidden'}>
        <Minimap drawRef={mapRef} />
      </div>
      <button className="maptoggle" onClick={() => setShowMap((s) => !s)}>
        {showMap ? 'hide map' : 'map'}
      </button>
      {playing && !chatWith && <div className={aimed ? 'crosshair on' : 'crosshair'} />}
      {touchOn && !chatWith && <TouchControls touchRef={touchRef} onPause={() => setTouch(false)} />}
      {playing && !chatWith && aimed && (
        <button className="talkhint" onClick={() => chat.open(aimed)}>
          {touchOn ? 'Tap here' : 'Click'} to chat with Prof. {PROFS[aimed].name.split(' ').slice(-1)[0]}
        </button>
      )}
      {chatWith && <ChatPanel prof={PROFS[chatWith]} onClose={closeChat} />}

      {!playing && !chatWith && (
        <div className="overlay" onClick={() => (isTouch ? setTouch(true) : lockRef.current?.())}>
          <div className="card">
            <div className="kicker">Yale SOM · Evans Hall</div>
            <h1>Floor 2</h1>
            <p className="sub">Classroom drums, the cloister, Ross Library, the Beinecke Terrace Room, and the courtyard.</p>
            <button className="go">{isTouch ? 'Tap to walk in' : 'Click to walk in'}</button>
            {!isTouch && (
              <button
                className="go alt"
                onClick={(e) => {
                  e.stopPropagation()
                  setTouch(true)
                }}
              >
                Use on-screen joystick
              </button>
            )}
            {isTouch ? (
              <div className="keys">
                <span><b>Left thumb</b> joystick to walk (push all the way to hurry)</span>
                <span><b>Right thumb</b> drag to look</span>
              </div>
            ) : (
              <div className="keys">
                <span><b>W A S D</b> walk</span>
                <span><b>Mouse</b> look</span>
                <span><b>Shift</b> sprint</span>
                <span><b>Space</b> jump</span>
                <span><b>C</b> crouch</span>
                <span><b>M</b> map</span>
                <span><b>Esc</b> pause</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

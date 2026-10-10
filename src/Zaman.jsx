import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Labubu from './Labubu.jsx'
import { chat } from './chat.js'

// Prof. Tauhid Zaman (MGT 409): black-and-pink hoodie, pink sneakers, a pink Labubu in one hand,
// waving "yo" at the class. Aim the crosshair at him and click to chat; he turns to face you while you talk.
// Built from primitives like the other professors; figure faces +z, feet at y = 0.

export const ZAMAN = { id: 'zaman', name: 'Tauhid Zaman', course: 'MGT 409 · AI Foundations for Managers' }

const REACH = 7 // meters: how close you need to be to start a chat
const CENTER = new THREE.Vector2(0, 0)

const mats = new Map()
const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o }))
  return mats.get(k)
}
const SPH = new THREE.SphereGeometry(1, 24, 16)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CAP = new THREE.CapsuleGeometry(1, 1, 6, 12)
const TORUS = new THREE.TorusGeometry(1, 0.14, 8, 24)
const SMILE = new THREE.TorusGeometry(1, 0.2, 6, 16, Math.PI) // half ring, flipped into a grin
const HAIR = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42) // top cap only

const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o }) => <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />

const SKIN = '#6b4630'
const HOODIE = '#141416'
const PINK = '#ff4fa3'
const JEANS = '#26324d'

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'))
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const printMat = () =>
  new THREE.MeshBasicMaterial({
    transparent: true,
    map: canvasTex(512, 160, (g) => {
      g.fillStyle = PINK
      g.font = 'bold 82px Arial Black, Arial, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('BLACKPINK', 256, 64)
      g.font = 'bold 34px Arial, sans-serif'
      g.fillText('♥ in your area ♥', 256, 132)
    }),
  })

const bubbleMat = () =>
  new THREE.SpriteMaterial({
    depthTest: false,
    map: canvasTex(256, 128, (g) => {
      g.fillStyle = PINK
      g.beginPath()
      g.roundRect(8, 8, 240, 88, 40)
      g.moveTo(110, 94)
      g.lineTo(128, 122)
      g.lineTo(146, 94)
      g.fill()
      g.fillStyle = '#0b0b0d'
      g.font = 'bold 56px Arial Black, Arial, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('yo! 👋', 128, 54)
    }),
  })

// turn `from` toward `to` along the shortest way round
const turn = (from, to, k) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k

export default function Zaman({ position = [0, 0, 0], rotation = 0 }) {
  const { camera } = useThree()
  const root = useRef()
  const body = useRef()
  const head = useRef()
  const waveArm = useRef()
  const mouth = useRef()
  const bubble = useRef()
  const yaw = useRef(rotation)
  const aimed = useRef(false)
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const print = useMemo(printMat, [])
  const bubbleM = useMemo(bubbleMat, [])

  // pointer-lock clicks land on the crosshair, so check what the crosshair is on
  useEffect(() => {
    const down = (e) => {
      if (e.button === 0 && aimed.current && document.pointerLockElement) chat.open(ZAMAN.id)
    }
    window.addEventListener('mousedown', down)
    return () => window.removeEventListener('mousedown', down)
  }, [])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const talking = chat.with === ZAMAN.id

    // crosshair aim (mouse mode and joystick mode both look from the screen center)
    let hit = false
    if (!talking && root.current) {
      ray.setFromCamera(CENTER, camera)
      ray.far = REACH
      hit = ray.intersectObject(root.current, true).length > 0
    }
    if (hit !== aimed.current) {
      aimed.current = hit
      chat.aim(hit ? ZAMAN.id : chat.aimed === ZAMAN.id ? null : chat.aimed)
    }

    // face the student while chatting; otherwise scan the room and bop to BLACKPINK
    const [px, , pz] = position
    const toCam = Math.atan2(camera.position.x - px, camera.position.z - pz)
    const target = talking || hit ? toCam : rotation + Math.sin(t * 0.4) * 0.35
    yaw.current = turn(yaw.current, target, Math.min(1, dt * (talking ? 5 : 2.5)))
    root.current.rotation.y = yaw.current
    body.current.position.y = talking ? 0 : Math.abs(Math.sin(t * 3.2)) * 0.025

    // head tilts to meet your eyes (seats rise behind him)
    const dist = Math.hypot(camera.position.x - px, camera.position.z - pz)
    const pitch = talking || hit ? -Math.atan2(camera.position.y - 1.68, dist) * 0.7 : Math.sin(t * 3.2) * 0.04
    head.current.rotation.x += (pitch - head.current.rotation.x) * Math.min(1, dt * 6)

    // right arm: a "yo" wave every few seconds (nonstop when you aim at him), hand gestures while talking
    const a = waveArm.current
    const speaking = performance.now() < chat.speakingUntil
    if (talking) {
      a.rotation.z = -0.25
      a.rotation.x = speaking ? -0.7 + Math.sin(t * 5) * 0.25 : -0.2
    } else if (hit || t % 7 < 1.8) {
      a.rotation.x = 0
      a.rotation.z = -2.6 + Math.sin(t * 12) * 0.28
    } else {
      a.rotation.x = 0
      a.rotation.z = -0.18
    }
    mouth.current.scale.y = speaking ? 0.03 + Math.abs(Math.sin(t * 14)) * 0.035 : 0.03

    bubble.current.visible = !talking
    bubble.current.position.y = 2.18 + Math.sin(t * 2) * 0.04
  })

  return (
    <group ref={root} position={position} rotation={[0, rotation, 0]} onClick={(e) => {
      // joystick/touch mode: a tap on him opens the chat (mouse mode uses the crosshair above)
      if (document.pointerLockElement) return
      e.stopPropagation()
      chat.open(ZAMAN.id)
    }}>
      <group ref={body}>
        {/* pink sneakers + jeans */}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B g={BOX} c="#ffffff" p={[0.1 * sx, 0.015, 0.04]} s={[0.12, 0.03, 0.28]} />
            <B g={BOX} c={PINK} p={[0.1 * sx, 0.065, 0.035]} s={[0.11, 0.08, 0.26]} />
            <B g={CYL} c={JEANS} p={[0.1 * sx, 0.5, 0]} s={[0.075, 0.82, 0.075]} />
          </group>
        ))}
        <B g={BOX} c={JEANS} p={[0, 0.93, 0]} s={[0.34, 0.16, 0.2]} />

        {/* black hoodie with pink hood trim, drawstrings, and a BLACKPINK print */}
        <B g={CYL} c={HOODIE} p={[0, 1.2, 0]} s={[0.2, 0.62, 0.13]} />
        <B c={HOODIE} p={[0, 1.47, 0]} s={[0.26, 0.085, 0.145]} />
        <B g={BOX} c="#0d0d0f" p={[0, 1.01, 0.125]} s={[0.24, 0.12, 0.012]} />
        <mesh material={print} position={[0, 1.27, 0.133]}>
          <planeGeometry args={[0.3, 0.094]} />
        </mesh>
        <B c={HOODIE} p={[0, 1.53, -0.11]} s={[0.15, 0.1, 0.08]} />
        <B g={TORUS} c={PINK} p={[0, 1.52, -0.02]} r={[Math.PI / 2 - 0.2, 0, 0]} s={[0.12, 0.12, 0.12]} />
        {[-1, 1].map((sx) => (
          <B key={sx} g={CYL} c={PINK} p={[0.045 * sx, 1.4, 0.135]} s={[0.006, 0.16, 0.006]} />
        ))}
        <B g={CYL} c={SKIN} p={[0, 1.56, 0]} s={[0.05, 0.08, 0.05]} />

        {/* left arm cradles a pink Labubu */}
        <group position={[0.25, 1.45, 0]} rotation={[-0.85, 0, 0.12]}>
          <mesh geometry={CAP} material={m(HOODIE)} position={[0, -0.24, 0]} scale={[0.062, 0.2, 0.062]} />
          <B g={TORUS} c={PINK} p={[0, -0.44, 0]} r={[Math.PI / 2, 0, 0]} s={[0.06, 0.06, 0.06]} />
          <B c={SKIN} p={[0, -0.5, 0.02]} s={[0.045, 0.055, 0.04]} />
          <group position={[0, -0.52, 0.07]} rotation={[0.85, 0, 0]}>
            <Labubu fur="#ff8fc7" expression="mischief" shirt={HOODIE} height={0.3} anim="idle" />
          </group>
        </group>

        {/* right arm waves */}
        <group ref={waveArm} position={[-0.25, 1.45, 0]}>
          <mesh geometry={CAP} material={m(HOODIE)} position={[0, -0.24, 0]} scale={[0.062, 0.2, 0.062]} />
          <B g={TORUS} c={PINK} p={[0, -0.44, 0]} r={[Math.PI / 2, 0, 0]} s={[0.06, 0.06, 0.06]} />
          <B c={SKIN} p={[0, -0.5, 0.02]} s={[0.045, 0.055, 0.04]} />
        </group>

        {/* head */}
        <group ref={head} position={[0, 1.69, 0]}>
          <B c={SKIN} p={[0, 0, 0]} s={[0.11, 0.13, 0.12]} />
          <mesh geometry={HAIR} material={m('#121010', { roughness: 1 })} position={[0, 0.012, -0.012]} rotation={[-0.32, 0, 0]} scale={[0.118, 0.142, 0.128]} />
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <B c={SKIN} p={[0.11 * sx, 0, 0]} s={[0.02, 0.035, 0.02]} />
              <B c="#ffffff" p={[0.04 * sx, 0.022, 0.104]} s={[0.021, 0.017, 0.01]} />
              <B c="#1a1210" p={[0.04 * sx, 0.022, 0.113]} s={[0.011, 0.012, 0.006]} />
              <B g={BOX} c="#121010" p={[0.042 * sx, 0.056, 0.107]} r={[0, 0, -0.12 * sx]} s={[0.042, 0.01, 0.01]} />
            </group>
          ))}
          <B c="#5a3a27" p={[0, -0.006, 0.12]} s={[0.019, 0.022, 0.018]} />
          <mesh ref={mouth} geometry={SMILE} material={m('#3a1712')} position={[0, -0.042, 0.108]} rotation={[0, 0, Math.PI]} scale={[0.036, 0.03, 0.02]} />
        </group>
      </group>

      <sprite ref={bubble} material={bubbleM} position={[0, 2.18, 0]} scale={[0.5, 0.25, 1]} />
    </group>
  )
}

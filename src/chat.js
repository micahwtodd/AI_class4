// Shared state between the 3D scene (inside <Canvas>, a separate React renderer) and the DOM chat window.
// Avatars read it every frame; App plugs in onOpen/onAim to turn changes into React state.
export const chat = {
  with: null, // id of the professor you're chatting with
  aimed: null, // id of the professor under the crosshair (within reach)
  speakingUntil: 0, // performance.now() until which the avatar's mouth moves
  onOpen: () => {},
  onAim: () => {},
  open(id) {
    this.onOpen(id)
  },
  aim(id) {
    if (id !== this.aimed) {
      this.aimed = id
      this.onAim(id)
    }
  },
}

// backend base URL: Vite proxies /api to FastAPI on :8000 in dev
export const API = import.meta.env.VITE_API_URL || '/api'

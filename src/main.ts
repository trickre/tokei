import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

app.innerHTML = `
  <main class="shell">
    <section class="panel clock-panel" data-clock-panel>
      <div class="clock-panel-header">
        <p class="eyebrow">Current Time</p>
        <button type="button" class="fullscreen-button" data-fullscreen-toggle>Fullscreen</button>
      </div>
      <h1 class="clock" data-clock>--:--:--</h1>
      <p class="date" data-date>----</p>
      <label class="clock-message-input">
        <span>Fullscreen Message</span>
        <input
          type="text"
          maxlength="80"
          placeholder="Enter a message for fullscreen mode"
          data-clock-message-input
        />
      </label>
      <p class="clock-fullscreen-message" data-clock-fullscreen-message></p>
    </section>

    <section class="panel timer-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Countdown Timer</p>
          <h2 class="panel-title">Set Duration</h2>
        </div>
        <span class="status idle" data-status>Idle</span>
      </div>

      <form class="timer-form" data-form>
        <label>
          Minutes
          <input type="number" name="minutes" min="0" max="999" value="5" inputmode="numeric" />
        </label>
        <label>
          Seconds
          <input type="number" name="seconds" min="0" max="59" value="0" inputmode="numeric" />
        </label>
        <label class="toggle">
          <input type="checkbox" name="timerFullscreen" />
          <span>Enable fullscreen during countdown</span>
        </label>
        <div class="actions">
          <button type="submit" class="primary">Start</button>
          <button type="button" data-pause>Pause</button>
          <button type="button" data-reset>Reset</button>
        </div>
      </form>

      <div class="timer-readout">
        <span class="timer-time" data-remaining>05:00</span>
        <p class="timer-fullscreen-session-name" data-timer-fullscreen-session-name></p>
        <p class="timer-note" data-note>Ready to start.</p>
      </div>
      <label class="session-name-input">
        <span>Session Name</span>
        <input
          type="text"
          name="sessionName"
          maxlength="80"
          placeholder="Enter a session name"
          data-session-name-input
        />
      </label>
    </section>
  </main>
`

const clockElement = document.querySelector<HTMLElement>('[data-clock]')
const dateElement = document.querySelector<HTMLElement>('[data-date]')
const clockPanelElement = document.querySelector<HTMLElement>('[data-clock-panel]')
const clockMessageInputElement = document.querySelector<HTMLInputElement>('[data-clock-message-input]')
const clockFullscreenMessageElement = document.querySelector<HTMLElement>('[data-clock-fullscreen-message]')
const timerPanelElement = document.querySelector<HTMLElement>('.timer-panel')
const fullscreenToggleButton = document.querySelector<HTMLButtonElement>('[data-fullscreen-toggle]')
const sessionNameInputElement = document.querySelector<HTMLInputElement>('[data-session-name-input]')
const statusElement = document.querySelector<HTMLElement>('[data-status]')
const remainingElement = document.querySelector<HTMLElement>('[data-remaining]')
const timerFullscreenSessionNameElement = document.querySelector<HTMLElement>(
  '[data-timer-fullscreen-session-name]',
)
const noteElement = document.querySelector<HTMLElement>('[data-note]')
const formElement = document.querySelector<HTMLFormElement>('[data-form]')
const pauseButton = document.querySelector<HTMLButtonElement>('[data-pause]')
const resetButton = document.querySelector<HTMLButtonElement>('[data-reset]')

if (
  !clockElement ||
  !dateElement ||
  !clockPanelElement ||
  !clockMessageInputElement ||
  !clockFullscreenMessageElement ||
  !timerPanelElement ||
  !fullscreenToggleButton ||
  !sessionNameInputElement ||
  !statusElement ||
  !remainingElement ||
  !timerFullscreenSessionNameElement ||
  !noteElement ||
  !formElement ||
  !pauseButton ||
  !resetButton
) {
  throw new Error('Required UI elements not found')
}

type TimerState = 'idle' | 'running' | 'paused' | 'finished'

type WakeLockSentinelLike = EventTarget & {
  released: boolean
  release: () => Promise<void>
}

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>
  }
}

let timerState: TimerState = 'idle'
let totalDurationMs = 5 * 60 * 1000
let remainingMs = totalDurationMs
let intervalId: number | null = null
let targetTimestamp = 0
let audioContext: AudioContext | null = null
let warningHoldTimeoutId: number | null = null
let wakeLockSentinel: WakeLockSentinelLike | null = null

const numberFormatter = new Intl.NumberFormat('ja-JP', {
  minimumIntegerDigits: 2,
  useGrouping: false,
})

const formatClock = (date: Date) =>
  `${numberFormatter.format(date.getHours())}:${numberFormatter.format(date.getMinutes())}:${numberFormatter.format(date.getSeconds())}`

const formatDate = (date: Date) =>
  date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${numberFormatter.format(minutes)}:${numberFormatter.format(seconds)}`
}

const updateClock = () => {
  const now = new Date()
  clockElement.textContent = formatClock(now)
  dateElement.textContent = formatDate(now)
}

const updateClockFullscreenMessage = () => {
  const message = clockMessageInputElement.value.trim()
  clockFullscreenMessageElement.textContent = message
  clockFullscreenMessageElement.classList.toggle('has-message', message.length > 0)
}

const updateStatus = (state: TimerState) => {
  timerState = state
  statusElement.textContent = state.charAt(0).toUpperCase() + state.slice(1)
  statusElement.className = `status ${state}`

  if (state === 'running') {
    pauseButton.textContent = 'Pause'
  } else if (state === 'paused') {
    pauseButton.textContent = 'Resume'
  } else {
    pauseButton.textContent = 'Pause'
  }
}

const renderTimer = () => {
  remainingElement.textContent = formatDuration(remainingMs)
}

const updateTimerFullscreenSessionName = () => {
  const sessionName = sessionNameInputElement.value.trim()
  timerFullscreenSessionNameElement.textContent = sessionName
  timerFullscreenSessionNameElement.classList.toggle('has-session-name', sessionName.length > 0)
}

const clearWarningHoldTimeout = () => {
  if (warningHoldTimeoutId !== null) {
    window.clearTimeout(warningHoldTimeoutId)
    warningHoldTimeoutId = null
  }
}

const resetTimerVisualState = () => {
  remainingElement.classList.remove('is-warning', 'is-finished-hold')
}

const updateTimerVisualState = () => {
  resetTimerVisualState()

  if (timerState === 'finished') {
    remainingElement.classList.add('is-finished-hold')
    return
  }

  if (timerState === 'running' && remainingMs > 0 && remainingMs <= 5000) {
    remainingElement.classList.add('is-warning')
  }
}

const enterFullscreen = async (element: HTMLElement, unavailableMessage: string) => {
  if (!document.fullscreenEnabled) {
    noteElement.textContent = unavailableMessage
    return
  }

  if (document.fullscreenElement === element) {
    return
  }

  await element.requestFullscreen()
}

const supportsWakeLock = () => 'wakeLock' in navigator

const releaseWakeLock = async () => {
  if (!wakeLockSentinel) {
    return
  }

  const activeWakeLock = wakeLockSentinel
  wakeLockSentinel = null
  await activeWakeLock.release()
}

const requestWakeLock = async () => {
  if (!supportsWakeLock() || wakeLockSentinel || document.visibilityState !== 'visible') {
    return
  }

  try {
    const activeNavigator = navigator as WakeLockNavigator
    const sentinel = await activeNavigator.wakeLock?.request('screen')

    if (!sentinel) {
      return
    }

    wakeLockSentinel = sentinel
    sentinel.addEventListener('release', () => {
      if (wakeLockSentinel === sentinel) {
        wakeLockSentinel = null
      }
    })
  } catch (error) {
    console.error('Failed to acquire wake lock.', error)
  }
}

const syncWakeLock = async () => {
  const isFullscreen =
    document.fullscreenElement === clockPanelElement || document.fullscreenElement === timerPanelElement

  if (isFullscreen) {
    await requestWakeLock()
    return
  }

  await releaseWakeLock()
}

const ensureAudioContext = async () => {
  if (!('AudioContext' in window)) {
    return null
  }

  if (!audioContext) {
    audioContext = new window.AudioContext()
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }

  return audioContext
}

const playAlarm = async () => {
  const context = await ensureAudioContext()

  if (!context) {
    noteElement.textContent = 'Time is up. Audio playback is not available in this browser.'
    return
  }

  const startAt = context.currentTime
  const pattern = [
    { frequency: 880, duration: 0.18 },
    { frequency: 660, duration: 0.18 },
    { frequency: 880, duration: 0.28 },
  ]

  let cursor = startAt

  for (const tone of pattern) {
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(tone.frequency, cursor)

    gainNode.gain.setValueAtTime(0.0001, cursor)
    gainNode.gain.exponentialRampToValueAtTime(0.16, cursor + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, cursor + tone.duration)

    oscillator.connect(gainNode)
    gainNode.connect(context.destination)

    oscillator.start(cursor)
    oscillator.stop(cursor + tone.duration)

    cursor += tone.duration + 0.05
  }
}

const syncFullscreenButton = () => {
  const isFullscreen = document.fullscreenElement === clockPanelElement
  fullscreenToggleButton.textContent = isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'
}

const stopInterval = () => {
  if (intervalId !== null) {
    window.clearInterval(intervalId)
    intervalId = null
  }
}

const finishTimer = () => {
  stopInterval()
  clearWarningHoldTimeout()
  remainingMs = 0
  renderTimer()
  updateStatus('finished')
  updateTimerVisualState()
  noteElement.textContent = 'Time is up.'
  if (document.fullscreenElement === timerPanelElement) {
    void document.exitFullscreen()
  }
  warningHoldTimeoutId = window.setTimeout(() => {
    if (timerState === 'finished') {
      remainingElement.classList.remove('is-finished-hold')
    }
    warningHoldTimeoutId = null
  }, 2000)
  void playAlarm()
}

const tickTimer = () => {
  remainingMs = targetTimestamp - Date.now()

  if (remainingMs <= 0) {
    finishTimer()
    return
  }

  renderTimer()
  updateTimerVisualState()
}

const startTimer = () => {
  clearWarningHoldTimeout()
  resetTimerVisualState()

  if (remainingMs <= 0) {
    remainingMs = totalDurationMs
  }

  targetTimestamp = Date.now() + remainingMs
  stopInterval()
  updateStatus('running')
  renderTimer()
  updateTimerVisualState()
  intervalId = window.setInterval(tickTimer, 250)
  noteElement.textContent = 'Countdown in progress.'
}

const resetTimer = () => {
  stopInterval()
  clearWarningHoldTimeout()
  remainingMs = totalDurationMs
  renderTimer()
  updateStatus('idle')
  updateTimerVisualState()
  noteElement.textContent = 'Ready to start.'
}

formElement.addEventListener('submit', async (event) => {
  event.preventDefault()

  const formData = new FormData(formElement)
  const minutes = Number(formData.get('minutes') ?? 0)
  const seconds = Number(formData.get('seconds') ?? 0)
  const timerFullscreen = formData.get('timerFullscreen') === 'on'
  const nextDurationMs = (minutes * 60 + seconds) * 1000

  if (!Number.isFinite(nextDurationMs) || nextDurationMs <= 0) {
    noteElement.textContent = 'Enter at least 1 second.'
    return
  }

  totalDurationMs = nextDurationMs
  remainingMs = nextDurationMs
  renderTimer()
  updateTimerVisualState()
  void ensureAudioContext()
  if (timerFullscreen) {
    await enterFullscreen(timerPanelElement, 'Fullscreen mode is not available in this browser.')
  }
  startTimer()
})

pauseButton.addEventListener('click', () => {
  if (timerState === 'running') {
    stopInterval()
    updateStatus('paused')
    noteElement.textContent = 'Timer paused.'
    return
  }

  if (timerState === 'paused') {
    void ensureAudioContext()
    startTimer()
  }
})

resetButton.addEventListener('click', resetTimer)

fullscreenToggleButton.addEventListener('click', async () => {
  if (document.fullscreenElement === clockPanelElement) {
    await document.exitFullscreen()
    return
  }

  await enterFullscreen(clockPanelElement, 'Fullscreen mode is not available in this browser.')
})

document.addEventListener('fullscreenchange', () => {
  syncFullscreenButton()
  void syncWakeLock()
})
document.addEventListener('visibilitychange', () => {
  void syncWakeLock()
})
window.addEventListener('beforeunload', () => {
  void releaseWakeLock()
})
clockMessageInputElement.addEventListener('input', updateClockFullscreenMessage)
sessionNameInputElement.addEventListener('input', updateTimerFullscreenSessionName)

updateClock()
window.setInterval(updateClock, 1000)
renderTimer()
updateStatus('idle')
updateTimerVisualState()
updateClockFullscreenMessage()
updateTimerFullscreenSessionName()
syncFullscreenButton()
void syncWakeLock()

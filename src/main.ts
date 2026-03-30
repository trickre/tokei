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
        <div class="actions">
          <button type="submit" class="primary">Start</button>
          <button type="button" data-pause>Pause</button>
          <button type="button" data-reset>Reset</button>
        </div>
      </form>

      <div class="timer-readout">
        <span class="timer-time" data-remaining>05:00</span>
        <p class="timer-note" data-note>Ready to start.</p>
      </div>
    </section>
  </main>
`

const clockElement = document.querySelector<HTMLElement>('[data-clock]')
const dateElement = document.querySelector<HTMLElement>('[data-date]')
const clockPanelElement = document.querySelector<HTMLElement>('[data-clock-panel]')
const fullscreenToggleButton = document.querySelector<HTMLButtonElement>('[data-fullscreen-toggle]')
const statusElement = document.querySelector<HTMLElement>('[data-status]')
const remainingElement = document.querySelector<HTMLElement>('[data-remaining]')
const noteElement = document.querySelector<HTMLElement>('[data-note]')
const formElement = document.querySelector<HTMLFormElement>('[data-form]')
const pauseButton = document.querySelector<HTMLButtonElement>('[data-pause]')
const resetButton = document.querySelector<HTMLButtonElement>('[data-reset]')

if (
  !clockElement ||
  !dateElement ||
  !clockPanelElement ||
  !fullscreenToggleButton ||
  !statusElement ||
  !remainingElement ||
  !noteElement ||
  !formElement ||
  !pauseButton ||
  !resetButton
) {
  throw new Error('Required UI elements not found')
}

type TimerState = 'idle' | 'running' | 'paused' | 'finished'

let timerState: TimerState = 'idle'
let totalDurationMs = 5 * 60 * 1000
let remainingMs = totalDurationMs
let intervalId: number | null = null
let targetTimestamp = 0

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
  remainingMs = 0
  renderTimer()
  updateStatus('finished')
  noteElement.textContent = 'Time is up.'
}

const tickTimer = () => {
  remainingMs = targetTimestamp - Date.now()

  if (remainingMs <= 0) {
    finishTimer()
    return
  }

  renderTimer()
}

const startTimer = () => {
  if (remainingMs <= 0) {
    remainingMs = totalDurationMs
  }

  targetTimestamp = Date.now() + remainingMs
  stopInterval()
  tickTimer()
  intervalId = window.setInterval(tickTimer, 250)
  updateStatus('running')
  noteElement.textContent = 'Countdown in progress.'
}

const resetTimer = () => {
  stopInterval()
  remainingMs = totalDurationMs
  renderTimer()
  updateStatus('idle')
  noteElement.textContent = 'Ready to start.'
}

formElement.addEventListener('submit', (event) => {
  event.preventDefault()

  const formData = new FormData(formElement)
  const minutes = Number(formData.get('minutes') ?? 0)
  const seconds = Number(formData.get('seconds') ?? 0)
  const nextDurationMs = (minutes * 60 + seconds) * 1000

  if (!Number.isFinite(nextDurationMs) || nextDurationMs <= 0) {
    noteElement.textContent = 'Enter at least 1 second.'
    return
  }

  totalDurationMs = nextDurationMs
  remainingMs = nextDurationMs
  renderTimer()
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
    startTimer()
  }
})

resetButton.addEventListener('click', resetTimer)

fullscreenToggleButton.addEventListener('click', async () => {
  if (!document.fullscreenEnabled) {
    noteElement.textContent = 'Fullscreen mode is not available in this browser.'
    return
  }

  if (document.fullscreenElement === clockPanelElement) {
    await document.exitFullscreen()
    return
  }

  await clockPanelElement.requestFullscreen()
})

document.addEventListener('fullscreenchange', syncFullscreenButton)

updateClock()
window.setInterval(updateClock, 1000)
renderTimer()
updateStatus('idle')
syncFullscreenButton()

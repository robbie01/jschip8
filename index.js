const keyboard = {
    'Digit1': 0x1,
    'Digit2': 0x2,
    'Digit3': 0x3,
    'Digit4': 0xC,
    'KeyQ': 0x4,
    'KeyW': 0x5,
    'KeyE': 0x6,
    'KeyR': 0xD,
    'KeyA': 0x7,
    'KeyS': 0x8,
    'KeyD': 0x9,
    'KeyF': 0xE,
    'KeyZ': 0xA,
    'KeyX': 0x0,
    'KeyC': 0xB,
    'KeyV': 0xF
}

const pixelSize = 8

var c = document.getElementById('c')
c.width = 64 * pixelSize
c.height = 32 * pixelSize
c.style.backgroundColor = "#000"

var ctx = c.getContext('2d')
ctx.fillStyle = '#fff'

var audioCtx = new AudioContext()
var oscillator = null

var cpuWorker = new Worker('worker/cpu.js')

cpuWorker.onmessage = e => {
    switch(e.data[0]) {
        case 'play':
            if (!oscillator) {
                oscillator = audioCtx.createOscillator()
                oscillator.type = 'square'
                oscillator.connect(audioCtx.destination)
                oscillator.start()
            }
            break
        case 'stop':
            if (oscillator) {
                oscillator.stop()
                oscillator = null
            }
            break
        case 'draw':
            const gfx = new Uint8Array(e.data[1])
            ctx.clearRect(0, 0, 64*pixelSize, 32*pixelSize)
            for (let i = 0; i < 64; ++i) {
                for (let j = 0; j < 32; ++j) {
                    if (gfx[i + j * 64])
                        ctx.fillRect(i*pixelSize, j*pixelSize, pixelSize, pixelSize)
                }
            }
            break
    }
}

window.addEventListener("keydown", e => {
    if (e.code in keyboard) {
        cpuWorker.postMessage(["keydown", keyboard[e.code]])
    }
})

window.addEventListener("keyup", e => {
    if (e.code in keyboard) {
        cpuWorker.postMessage(["keyup", keyboard[e.code]])
    }
})
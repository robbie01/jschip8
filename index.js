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

let pixelSize = 8
let width = 64, height = 32

var c = document.getElementById('c')
c.width = width * pixelSize
c.height = height * pixelSize
c.style.backgroundColor = "#000"

var ctx = c.getContext('2d')
ctx.fillStyle = '#fff'

var audioCtx = new AudioContext()
var oscillator = null

let cpuWorker = { postMessage: () => {}, terminate: () => {} }

let gfx = new Uint8Array(8192)
let sharedBuf, sharedGfx

requestAnimationFrame(function update() {
    requestAnimationFrame(update)
    ctx.clearRect(0, 0, width*pixelSize, height*pixelSize)
    if (!gfx) return
    for (let i = 0; i < width; ++i) {
        for (let j = 0; j < height; ++j) {
            if (gfx[i + j * width])
                ctx.fillRect(i*pixelSize, j*pixelSize, pixelSize, pixelSize)
        }
    }
})

const workerOnMessage = e => {
    switch(e.data[0]) {
        case 'buffer':
            switch (e.data[1]) {
                case 'standard':
                    width = 64
                    height = 32
                    pixelSize = 8
                    break
                case 'extended':
                    width = 128
                    height = 64
                    pixelSize = 4
                    break
            }
            sharedBuf = e.data[2]
            sharedGfx = new Uint8Array(sharedBuf)
            break
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
                oscillator.disconnect()
                oscillator = null
            }
            break
        case 'draw':
            gfx.set(sharedGfx)
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

const f = document.getElementById('f')
f.onsubmit = e => {
    e.preventDefault()
    cpuWorker.terminate()
    cpuWorker = new Worker('worker/cpu.js')
    cpuWorker.onmessage = workerOnMessage
    cpuWorker.postMessage(["play", f.elements["filename"].value])
}
const fontset = [
	0xF0, 0x90, 0x90, 0x90, 0xF0,		// 0
	0x20, 0x60, 0x20, 0x20, 0x70,		// 1
	0xF0, 0x10, 0xF0, 0x80, 0xF0,		// 2
	0xF0, 0x10, 0xF0, 0x10, 0xF0,		// 3
	0x90, 0x90, 0xF0, 0x10, 0x10,		// 4
	0xF0, 0x80, 0xF0, 0x10, 0xF0,		// 5
	0xF0, 0x80, 0xF0, 0x90, 0xF0,		// 6
	0xF0, 0x10, 0x20, 0x40, 0x40,		// 7
	0xF0, 0x90, 0xF0, 0x90, 0xF0,		// 8
	0xF0, 0x90, 0xF0, 0x10, 0xF0,		// 9
	0xF0, 0x90, 0xF0, 0x90, 0x90,		// A
	0xE0, 0x90, 0xE0, 0x90, 0xE0,		// B
	0xF0, 0x80, 0x80, 0x80, 0xF0,		// C
	0xE0, 0x90, 0x90, 0x90, 0xE0,		// D
	0xF0, 0x80, 0xF0, 0x80, 0xF0,		// E
	0xF0, 0x80, 0xF0, 0x80, 0x80		// F
]

const sfontset = [240,240,144,144,144,144,144,144,240,240,32,32,96,96,32,32,32,32,112,112,240,240,16,16,240,240,128,128,240,240,240,240,16,16,240,240,16,16,240,240,144,144,144,144,240,240,16,16,16,16,240,240,128,128,240,240,16,16,240,240,240,240,128,128,240,240,144,144,240,240,240,240,16,16,32,32,64,64,64,64,240,240,144,144,240,240,144,144,240,240,240,240,144,144,240,240,16,16,240,240]

const frequency = 5000

const keys = new Array(16).fill(false)

let delayTimer = 0
let soundTimer = 0
let audioPlaying = false
const memory = new Uint8Array(4096)
const mem = new DataView(memory.buffer)
memory.set(fontset)
memory.set(sfontset, 80)
const V = new Uint8Array(16)
const RPL = new Uint8Array(8)
let I = 0
const stack = new Uint16Array(16)
let sp = 0
let width, height, extended
let gfxBuffer = new SharedArrayBuffer(8192)
let gfx = new Uint8Array(gfxBuffer)
let pc = 0x200

const unsupport = instr => { throw new Error("Unsupported instruction " + ("0000" + instr.toString(16)).substr(-4).toUpperCase()) }

let setupGraphics = mode => {
    switch (mode) {
        case 'standard':
            width = 64
            height = 32
            extended = false
            break
        case 'extended':
            width = 128
            height = 64
            extended = true
            break
        default:
            throw new Error("Unsupported display mode")
    }
    postMessage(['buffer', mode, gfxBuffer])
}

setupGraphics('standard')

const draw = () => {
    postMessage(['draw'])
}

const instructions = {
    0x0: instr => {
        if ((instr & 0x00F0) === 0xC0) {
            let n = instr & 0x000F
            gfx.set(gfx.map((e, i, a) => i - width * n > width * height ? 0 : a[i - width * n]))
            pc += 2
            return
        }
        switch (instr) {
            case 0xE0:
                gfx.fill(0)
                draw()
                break
            case 0xEE:
                pc = stack[--sp]
                break
            case 0xFB:
                for (let i = 0; i < height; ++i) {
                    let newRow = gfx.slice(i*height, (i+1)*height).map((e, i, a) => (i - 4 < 0) ? 0 : a[i-4])
                    gfx.set(newRow, i*height)
                }
                break
            case 0xFC:
                for (let i = 0; i < height; ++i) {
                    let newRow = gfx.slice(i*height, (i+1)*height).map((e, i, a) => (i + 4 >= width) ? 0 : a[i+4])
                    gfx.set(newRow, i*height)
                }
                break
            case 0xFE:
                setupGraphics('standard')
                break
            case 0xFF:
                setupGraphics('extended')
                break
            default:
                unsupport(instr)
        }
        pc += 2
    },
    0x1: instr => pc = instr & 0xFFF,
    0x2: instr => {
        stack[sp++] = pc
        pc = instr & 0xFFF
    },
    0x3: instr => {
        if (V[(instr & 0x0F00) >> 8] === (instr & 0xFF)) pc += 4
        else pc += 2
    },
    0x4: instr => {
        if (V[(instr & 0x0F00) >> 8] !== (instr & 0xFF)) pc += 4
        else pc += 2
    },
    0x5: instr => {
        if (V[(instr & 0x0F00) >> 8] === V[(instr & 0x00F0) >> 4]) pc += 4
        else pc += 2
    },
    0x6: instr => {
        V[(instr & 0x0F00) >> 8] = instr & 0xFF
        pc += 2
    },
    0x7: instr => {
        V[(instr & 0x0F00) >> 8] += instr & 0xFF
        pc += 2
    },
    0x8: instr => {
        const x = (instr & 0x0F00) >> 8
        const y = (instr & 0x00F0) >> 4
        switch (instr & 0xF) {
            case 0x0:
                V[x] = V[y]
                break
            case 0x1:
                V[x] |= V[y]
                break
            case 0x2:
                V[x] &= V[y]
                break
            case 0x3:
                V[x] ^= V[y]
                break
            case 0x4:
                V[0xF] = V[x] + V[y] > 255 ? 1 : 0
                V[x] += V[y]
                break
            case 0x5:
                V[0xF] = V[x] >= V[y] ? 1 : 0
                V[x] -= V[y]
                break
            case 0x6:
                V[0xF] = V[x] & 1
                V[x] >>= 1
                break
            case 0x7:
                V[0xF] = V[y] >= V[x] ? 1 : 0
                V[x] = V[y] - V[x]
                break
            case 0xE:
                V[0xF] = V[x] >> 7
                V[x] <<= 1
                break
        }
        pc += 2
    },
    0x9: instr => {
        if (V[(instr & 0x0F00) >> 8] !== V[(instr & 0x00F0) >> 4]) pc += 4
        else pc += 2
    },
    0xA: instr => {
        I = instr & 0x0FFF
        pc += 2
    },
    0xB: instr => {
        pc = (instr & 0x0FFF) + V[0x0]
    },
    0xC: instr => {
        V[(instr & 0x0F00) >> 8] = (Math.random() * 256) & (instr & 0xFF)
        pc += 2
    },
    0xD: instr => {
        const x = (instr & 0x0F00) >> 8
        const y = (instr & 0x00F0) >> 4
        const n = instr & 0x000F
        V[0xF] = 0

        if (extended && n === 0) {
            for (let j = 0; j < 16; ++j) {
                let p = mem.getUint16(I+j*2, false)
                for (let i = 0; i < 16; ++i) {
                    if (p & (0x8000 >> i)) {
                        if (gfx[((V[x] + i) % width) + ((V[y] + j) % height) * width]) V[0xF] = 1
                        gfx[((V[x] + i) % width) + ((V[y] + j) % height) * width] ^= p & (0x8000 >> i)
                    }
                }
            }
        }
        for (let j = 0; j < n; ++j) {
            for (let i = 0; i < 8; ++i) {
                if (memory[I+j] & (0x80 >> i)) {
                    if (gfx[((V[x] + i) % width) + ((V[y] + j) % height) * width]) V[0xF] = 1
                    gfx[((V[x] + i) % width) + ((V[y] + j) % height) * width] ^= memory[I+j] & (0x80 >> i)
                }
            }
        }
        draw()
        pc += 2
    },
    0xE: instr => {
        const x = (instr & 0x0F00) >> 8
        switch (instr & 0xFF) {
            case 0x9E:
                if (keys[V[x]]) pc += 4
                else pc += 2
                break
            case 0xA1:
                if (!keys[V[x]]) pc += 4
                else pc += 2
                break
            default:
                unsupport(instr)
        }
    },
    0xF: instr => {
        const x = (instr & 0x0F00) >> 8
        switch (instr & 0xFF) {
            case 0x07:
                V[x] = delayTimer
                pc += 2
                break
            case 0x0A:
                for (let i = 0; i < 16; ++i) {
                    if (keys[i]) {
                        V[x] = i
                        pc += 2
                        break
                    }
                }
                break
            case 0x15:
                delayTimer = V[x]
                pc += 2
                break
            case 0x18:
                soundTimer = V[x]
                pc += 2
                break
            case 0x1E:
                I = (I + V[x]) % 65536
                pc += 2
                break
            case 0x29:
                I = V[x] * 5
                pc += 2
                break
            case 0x30:
                I = V[x] * 10 + 80
                pc += 2
                break
            case 0x33:
                memory[I] = Math.floor(V[x]/100)
                memory[I+1] = Math.floor(V[x]/10)%10
                memory[I+2] = V[x]%10
                pc += 2
                break
            case 0x55:
                memory.set(V.slice(0, x+1), I)
                pc += 2
                break
            case 0x65:
                V.set(memory.slice(I, x+1))
                pc += 2
                break
            case 0x75:
                RPL.set(V.slice(0, x+1))
                pc += 2
                break
            case 0x85:
                V.set(RPL.slice(0, x+1))
                pc += 2
                break
            default:
                unsupport(instr)
        }
    }
}

let stop = () => {}

const play = game => fetch(`/roms/${game}`)
    .then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.responseText))
    .then(ab => {
        memory.set(new Uint8Array(ab), 0x200)

        const cpuInterval = setInterval(() => {
            //console.log('instruction', mem.getUint16(pc, false).toString(16).toUpperCase(), 'pc', pc.toString(16).toUpperCase())
            const instr = mem.getUint16(pc, false)
            instructions[instr >> 12](instr)
        }, 1000/frequency)

        const timerInterval = setInterval(() => {
            if (delayTimer > 0) --delayTimer
            if (soundTimer > 0) {
                --soundTimer
                if (!audioPlaying) {
                    postMessage(['play'])
                    audioPlaying = true
                }
            } else {
                if (audioPlaying) {
                    postMessage(['stop'])
                    audioPlaying = false
                }
            }
        }, 1000/60)
    })

onmessage = e => {
    switch(e.data[0]) {
        case 'keydown':
            keys[e.data[1]] = true
            break
        case 'keyup':
            keys[e.data[1]] = false
            break
        case 'play':
            play(e.data[1])
            break
    }
}
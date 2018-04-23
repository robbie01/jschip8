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

const frequency = 100

const keys = []
for (let i = 0; i < 16; ++i) keys.push(false)

let delayTimer = 0
let soundTimer = 0
let audioPlaying = false
const memory = new Uint8Array(4096)
memory.set(fontset)
const V = new Uint8Array(16)
let I = 0
const stack = new Uint16Array(16)
let sp = 0
const gfx = new Uint8Array(2048)
let pc = 0x200

onmessage = e => {
    switch(e.data[0]) {
        case 'keydown':
            keys[e.data[1]] = true
            break
        case 'keyup':
            keys[e.data[1]] = false
            break
    }
}

const draw = () => {
    const gfxCopy = gfx.buffer.slice(0)
    postMessage(['draw', gfxCopy], [gfxCopy])
}

const instructions = {
    0x0: instr => {
        switch (instr) {
            case 0xE0:
                gfx.fill(0)
                draw()
                break
            case 0xEE:
                pc = stack[--sp]
                break
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
                V[0xF] = V[x] > V[y] ? 1 : 0
                V[x] -= V[y]
                break
            case 0x6:
                V[0xF] = V[x] & 1
                V[x] >>= 1
                break
            case 0x7:
                V[0xF] = V[y] > V[x] ? 1 : 0
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
        pc = instr & 0x0FFF + V[0x0]
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
        for (let j = 0; j < n; ++j) {
            for (let i = 0; i < 8; ++i) {
                if (memory[I+j] & (0x80 >> i)) {
                    if (gfx[((x + i) % 64) + ((y + j) % 32) * 64]) V[0xF] = 1
                    gfx[((x + i) % 64) + ((y + j) % 32) * 64] ^= memory[I+j] & (0x80 >> i)
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
            case 0x33:
                memory[I] = V[x]/100
                memory[I+1] = V[x]/10%10
                memory[I+2] = V[x]%10
                pc += 2
                break
            case 0x55:
                for (let i = 0; i <= x; ++i) {
                    memory[I+i] = V[i]
                }
                pc += 2
                break
            case 0x65:
                for (let i = 0; i <= x; ++i) {
                    V[i] = memory[I+i]
                }
                pc += 2
                break
        }
    }
}

fetch('/beep')
    .then(r => r.arrayBuffer())
    .then(ab => {
        memory.set(new Uint8Array(ab), 0x200)

        const cpuInterval = setInterval(() => {
            console.log('instruction', (memory[pc] << 8 | memory[pc+1]).toString(16).toUpperCase(), 'pc', pc.toString(16).toUpperCase())
            instructions[memory[pc] >> 4](memory[pc] << 8 | memory[pc+1])
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
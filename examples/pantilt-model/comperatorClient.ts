import { Servient } from '@node-wot/core'
import { HttpClientFactory, HttpsClientFactory} from '@node-wot/binding-http'
import { InteractionOutput, ThingDescription } from 'wot-typescript-definitions';
import { writeFileSync } from 'fs';

const pollingTime = 50
const servient = new Servient();
servient.addClientFactory(new HttpClientFactory())
servient.addClientFactory(new HttpsClientFactory())
servient.addCredentials({
    'esi:pantilt:1': {
        username: "admin",
        password: "hunter2",
    }
})

function wait(ms: number) {
    return new Promise<void>((resolve)=>setTimeout(()=> {resolve()}, ms))
}

const timeArray: number[] = []
const pantiltPanPositionArray: number[] = []
const pantiltTiltPositionArray: number[] = []
const dtPanPositionArray: number[] = []
const dtTiltPostionArray: number[] = []
let time = 0

servient.start().then(async (WoT)=> {
    const dtTd = await WoT.requestThingDescription('http://localhost:8080/machine')
    const pantiltTd = await WoT.requestThingDescription('https://remotelab.esi.cit.tum.de:8081/PanTilt1')

    const dtThing = await WoT.consume(dtTd)
    const pantiltThing =  await WoT.consume(pantiltTd)

    // Home both first
    await dtThing.invokeAction('goHome')
    await pantiltThing.invokeAction('goHome')

    await wait(12000)

    // Setup logging
    const interval = setInterval(async ()=>{
        let promises: Array<Promise<WoT.InteractionOutput>> = []
        promises.push(
            pantiltThing.readProperty('panPosition'), 
            pantiltThing.readProperty('tiltPosition'), 
            dtThing.readProperty('panPosition'), 
            dtThing.readProperty('tiltPosition')
        )
        const [pantiltPanPositionOut, pantiltTiltPositionOut, dtPanPositionOut, dtTiltPostionOut] = await Promise.all(promises)
        const pantiltPanPosition = await pantiltPanPositionOut.value() as number
        const pantiltTiltPosition = await pantiltTiltPositionOut.value() as number
        const dtPanPosition = await dtPanPositionOut.value() as number
        const dtTiltPostion = await dtTiltPostionOut.value() as number

        timeArray.push(time)
        time = time + pollingTime
        pantiltPanPositionArray.push(pantiltPanPosition)
        pantiltTiltPositionArray.push(pantiltTiltPosition)
        dtPanPositionArray.push(parseFloat(dtPanPosition.toFixed(1)))
        dtTiltPostionArray.push(parseFloat(dtTiltPostion.toFixed(1)))
    }, pollingTime)

    await wait(1000)

    // Pan with a speed of 15
    dtThing.invokeAction('panContinuously', 15)
    pantiltThing.invokeAction('panContinuously', 15)

    // Stop after 3 seconds
    await wait(3000)
    dtThing.invokeAction('stopMovement')
    pantiltThing.invokeAction('stopMovement')

    // wait for 0.5 seconds
    await wait(500)

    // Tilt with the speed of -8
    dtThing.invokeAction('tiltContinuously', -8)
    pantiltThing.invokeAction('tiltContinuously', -8)

    
    // Stop after 3 seconds
    await wait(3000)
    dtThing.invokeAction('stopMovement')
    pantiltThing.invokeAction('stopMovement')

    // wait for 0.5 seconds
    await wait(500)

    // Pan and tilt at the same time till max value
    dtThing.invokeAction('panContinuously', -10)
    pantiltThing.invokeAction('panContinuously', -10)
    dtThing.invokeAction('tiltContinuously', 12)
    pantiltThing.invokeAction('tiltContinuously', 12)

    await wait(10000)

    clearInterval(interval)
    let line = timeArray.join(',')
    line = line + '\n'
    line = line + pantiltPanPositionArray.join(',')
    line = line + '\n'
    line = line + pantiltTiltPositionArray.join(',')
    line = line + '\n'
    line = line + dtPanPositionArray.join(',')
    line = line + '\n'
    line = line + dtTiltPostionArray.join(',')
    line = line + '\n'
    line = line + '\n'
    writeFileSync('log.csv', line)
})
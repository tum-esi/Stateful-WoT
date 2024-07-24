import { Servient, Helpers } from "@node-wot/core";
import { HttpClientFactory } from "@node-wot/binding-http";
import { ThingDescription } from "wot-typescript-definitions";
import { setInterval } from "timers";

const servient = new Servient()
servient.addClientFactory(new HttpClientFactory())

const helpers =  new Helpers(servient)

helpers.fetch("http://localhost:8888/coffeeorders").then(async (td)=> {
    const TDstring = td as ThingDescription;
    const WoT = await servient.start()
    const consumedThing = await WoT.consume(TDstring);
    console.log("Subscribing"); 
    await consumedThing.invokeAction("getNextOrder");
    await consumedThing.invokeAction("getNextOrder");
    await consumedThing.invokeAction("getNextOrder");
    await consumedThing.invokeAction("getNextOrder");
    await consumedThing.subscribeEvent("orderReceived", (data)=>{
        console.log("Event occured");
    })
    console.log("Subscribed");
    setInterval(()=> {
        console.log("Shutting Servient down");
        servient.shutdown();
        console.log("Exiting");
        process.exit()
    }, 60000)
})
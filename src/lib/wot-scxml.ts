/** =======================================================================================================================
 * ?                                                     ABOUT
 * @author         :  Fady Salama
 * @email          :  fady.salama@tum.de
 * @repo           :  -
 * @createdOn      :  12.01.2023
 * @description    :  API for converting SCXML files to XState Machine exposed by node-wot
 *=======================================================================================================================**/

// TODO Comment and structure code
// import { MachineConfig, InternalMachineOptions, actions } from 'xstate'
// import fetch from 'node-fetch'
// import template from 'string-placeholder'
import * as fs from 'fs'
import * as path from 'path'
import xpath from 'xpath'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
// import toSource from 'tosource'
// import AbstractSyntaxTree from 'abstract-syntax-tree'
import prettier from 'prettier'

import { SCXML2XStateCodeParser, delayToMs, PARAM_OBJECT_PREFIX, SEND_PREFIX } from './xstate-scxml'

import { Servient, Helpers } from '@node-wot/core'
import { HttpServer, HttpClientFactory, HttpsClientFactory } from '@node-wot/binding-http'
import { CoapServer, CoapClientFactory, CoapsClientFactory } from '@node-wot/binding-coap'
import * as WoT from 'wot-typescript-definitions'

export const WOT_RESPONSE_PREFIX = 'wotResponse_'
export const WOT_SIM_PREFIX = 'wotSim_'

const servient = new Servient()
servient.addServer(new HttpServer())
servient.addClientFactory(new HttpClientFactory())
servient.addClientFactory(new HttpsClientFactory())
servient.addServer(new CoapServer())
servient.addClientFactory(new CoapClientFactory())
servient.addClientFactory(new CoapsClientFactory())

const WoTHelpers = new Helpers(servient)

const select = xpath.useNamespaces({ scxml: 'http://www.w3.org/2005/07/scxml', wot: 'http://example.com/wot' })
export class SCXML2WoTCodeParser extends SCXML2XStateCodeParser {
  protected readonly protoTD: WoT.ExposedThingInit
  public generatedTD: WoT.ThingDescription | undefined

  protected WOT_RESPONSE_COUNTER = 0
  protected WOT_SIM_COUNTER = 0
  protected readonly internalOps: InternalOperationRepresentation[] = []
  protected readonly simulationTargets: string[] = []
  protected readonly simModelIds: string[] = []

  protected readonly codeSnippets = {
    properties: {
      readproperty: '',
      writeproperty: '',
      observeproperty: '',
      unobserveproperty: '',
      emitTransition: '',
      emit: ''
    },
    actions: {
      invokeaction: ''
    },
    events: {
      subscribeevent: '',
      unsubscribeevent: '',
      emit: ''
    }
  }

  constructor () {
    super(WoTHelpers.fetch)
    this.protoTD = {
      '@context': ['https://www.w3.org/2022/wot/td/v1.1', {
        '@language': 'en'
      }],
      '@type': 'Thing',
      title: this.XStateMachineConfig.id ?? 'machine',
      description: '',
      properties: {},
      actions: {},
      events: {}
    }
  }

  public async generateXStateCode (scxml: string | Node, machineID?: string | undefined): Promise<string> {
    let scxmlDOM, scxmlNode, wotAffrNode
    // Check if string -> use XML DOM parser
    if (typeof scxml === 'string') {
      scxmlDOM = (new DOMParser()).parseFromString(scxml, 'application/scxml+xml')
      scxmlNode = select('//scxml:scxml', scxmlDOM, true) as Node
      wotAffrNode = select('//wot:affordances', scxmlDOM, true) as Node | undefined
    // Otherwise Node is ready
    } else {
      if (scxml.nodeName !== 'scxml') throw new Error('Can only parse SCXML node')
      scxmlNode = scxml
      scxmlDOM = scxmlNode.ownerDocument as Document
      wotAffrNode = select('//wot:affordances', scxmlNode, true) as Node | undefined
    }

    this.scxmlNode = scxmlNode

    // add WoT affordances
    if (wotAffrNode !== undefined) {
      this.addWoTAffordances(wotAffrNode)
    }

    // Add machine state read handler
    this.addMachineStateSchemaAndHandler()

    // find writable properties
    const writableProperties = this.findWritableDataProperties(scxmlDOM)
    // add propertywriteHanlder
    const needPropertyWriteHandler = this.addPropertyWriteHandlerState(scxmlDOM, writableProperties)
    if (needPropertyWriteHandler) {
      this.codeSnippets.properties.writeproperty = this.codeSnippets.properties.writeproperty.concat('')
    }

    this.preproccesModelNodes(scxmlDOM)
    const dataModelElement = select('//scxml:datamodel', scxmlDOM, true) as Element
    const stepSizeDataElement = scxmlDOM.createElementNS('http://www.w3.org/2005/07/scxml', 'data')
    dataModelElement.appendChild(stepSizeDataElement)
    stepSizeDataElement.setAttribute('id', '_stepSize')
    stepSizeDataElement.setAttribute('expr', '"0.01s"')

    scxml = new XMLSerializer().serializeToString(scxmlDOM)

    let xstateCode = await super.generateXStateCode(scxml, machineID)
    this.generateCodeSnippets()

    const tdImportsCode = 'import { Servient,  Helpers } from \'@node-wot/core\'\n' +
    'import { HttpServer, HttpClientFactory, HttpsClientFactory } from \'@node-wot/binding-http\'\n' +
    'import WebSocket from \'ws\'\n' +
    'import { EventEmitter, once } from \'events\'\n' +
    'import _ from \'lodash\'\n'

    const eventEmitterCode = 'class ResponseHandlerEmitter extends EventEmitter {}\n' +
    'const responseHandlerEmitter = new ResponseHandlerEmitter()\n'

    // Add Simulation Websocket Connections
    let wsCode = ''
    for (const [index, target] of this.simulationTargets.entries()) {
      wsCode += `let ws${index} = new WebSocket("${target}")\n`
    }

    xstateCode = tdImportsCode.concat(eventEmitterCode, wsCode, xstateCode)
    const tdCode =
`\n
const service = interpret(${machineID ?? this.XStateMachineConfig.id ?? 'machine'})

/*=================================================== node-wot ==================================================*/ 
const td: any = ${JSON.stringify(this.protoTD)}

const servient = new Servient()
servient.addServer(new HttpServer())
servient.addClientFactory(new HttpClientFactory())
Helpers.setStaticAddress("localhost")

servient.start().then(async (WoT) => {
  const thing = await WoT.produce(td)

/*============================================ Property Read Handlers ===========================================*/

${this.codeSnippets.properties.readproperty}

/*=========================================== Property Write Handlers ===========================================*/
 
${this.codeSnippets.properties.writeproperty}

/*============================================ Invoke Action Handlers ===========================================*/

${this.codeSnippets.actions.invokeaction}

/*================================================ Event Emitters ===============================================*/

${this.codeSnippets.events.emit}

/*================================================= On Transition ===============================================*/

  let lastState, lastContext
  service.onTransition((state)=> {
    console.log(\`\${td.title}:\`)
    console.log(\`Recieved Event: \${JSON.stringify(state.event)}\`)
    console.log(\`Current State: \${JSON.stringify(state.value)}\`)

    ${this.codeSnippets.properties.emitTransition}

    lastState = state
    lastContext = state.context
  })

  //Start State Machine and Server
  service.start()
  thing.expose()
})
`

    let wsHandlerCode = ''
    for (let i = 0; i < this.simulationTargets.length; i++) {
      wsHandlerCode = `ws${i}.on('message', (responseMessage: string) => {
        const response = JSON.parse(responseMessage)
        const simId = response.simId
        service.send({
          type: \`_sim_\${simId}.response\`,
          data: response as any
        })
      })`
    }
    return prettier.format(xstateCode.concat(tdCode, wsHandlerCode), { parser: 'typescript' })
  }

  protected addSend (sendNode: Node, actionsArray: any[]): void {
    // let typeExpr: string | undefined

    const typeAttr = select('./@type', sendNode, true) as Attr | undefined
    // const typeExprAttr = select('./@typeExpr', sendNode, true) as Attr | undefined

    const type: string | undefined = typeAttr?.value
    // typeExpr = typeExprAttr?.value

    if (type === undefined) {
      super.addSend(sendNode, actionsArray)
    } else if (type === 'WoTIOProcessor') {
      this.addSendWOTResponse(sendNode, actionsArray)
    } else if (type === 'WoTSimProcessor') {
      this.addSendSim(sendNode, actionsArray)
    }
  }

  protected addSendWOTResponse (sendNode: Node, actionsArray: any[]): void {
    let eventString: string | undefined
    let eventExpr: string | undefined

    // let idString: string | undefined
    // let idExpr: string | undefined

    let targetString: string | undefined
    // let targetExpr: string | undefined

    let delayNumber: number | undefined
    let delayExpr: string | undefined

    // Handle <content> and <param> Children
    let includesParam = false
    let includesContent = false

    const paramsObj = {}
    let contentCode, data: string | undefined

    // Attribute Extraction
    const eventAttr = select('./@event', sendNode, true) as Attr | undefined
    const eventExprAttr = select('./@eventexpr', sendNode, true) as Attr | undefined
    const targetAttr = select('./@target', sendNode, true) as Attr | undefined
    const targetExprAttr = select('./@targetexpr', sendNode, true) as Attr | undefined
    // const typeAttr = select('./@type', sendNode, true) as Attr | undefined
    // const typeExprAttr = select('./@typeExpr', sendNode, true) as Attr | undefined
    // const idAttr = select('./@id', sendNode, true) as Attr | undefined
    // const idlocationAttr = select('./@idlocation', sendNode, true) as Attr | undefined
    const delayAttr = select('./@delay', sendNode, true) as Attr | undefined
    const delayExprAttr = select('./@delayexpr', sendNode, true) as Attr | undefined
    const namelistAttr = select('./@namelistAttr', sendNode, true) as Attr | undefined

    // Event parsing
    if (eventAttr?.value !== undefined) {
      if (eventExprAttr != null) throw Error("Attribute 'eventExpr' should not occur with 'event'")
      eventString = eventAttr.value
    } else {
      if (eventExprAttr == null) throw Error("Attribute 'eventExpr' must occur with if 'event' is not present")

      // parse and modify expression code
      eventExpr = this.exprParserAndModder(eventExprAttr.value)
    }

    // // ID parsing
    // if (idAttr?.value !== undefined) {
    //   idString = idAttr.value
    // } else if (idlocationAttr?.value !== undefined) {
    //   idString = this.exprParserAndModder(idlocationAttr.value)
    // }

    // Target parsing
    if (targetAttr?.value !== undefined) {
      targetString = targetAttr.value
    } else if (targetExprAttr?.value !== undefined) {
      targetString = this.exprParserAndModder(targetExprAttr.value)
    }

    if (targetString !== undefined && targetString !== 'Consumer') throw new Error('<send> of type WoTIOProcessor can only have Consumer as target. Current target is ' + targetString)

    // Delay Parsing
    let delayString: string | undefined

    if (delayAttr?.value !== undefined) {
      delayString = delayAttr.value.trim()
    } else if (delayExprAttr?.value !== undefined) {
      delayExpr = this.exprParserAndModder(delayExprAttr.value)
    }

    if (delayString !== undefined) {
      delayNumber = delayToMs(delayString)
    }
    // ToDo Handle ID and Cancellation! Probably need to add a new variable in context in form of an array that we can push to.

    // // Add id if available
    // if (idString !== undefined) sendOptions.id = idString
    // else if (idExpr !== undefined) {
    //   this.variableMap[`${SEND_IDEXPR_PREFIX}${this.SEND_IDEXPR_COUNTER}`] = `(context: any, event: any, { _event } => {return ${idExpr}})`
    //   sendOptions.id = `{{${SEND_IDEXPR_PREFIX}${this.SEND_IDEXPR_COUNTER}}}`
    //   this.SEND_IDEXPR_COUNTER++
    // }

    if (this.XStateMachineOptions.actions === undefined) this.XStateMachineOptions.actions = {}

    if (namelistAttr?.value !== undefined) this.handleNameList(namelistAttr.value, paramsObj)
    // Handle <content> and <param> Children
    for (let i = 0; i < sendNode.childNodes.length; i++) {
      const childNode = sendNode.childNodes[i]
      switch (childNode.nodeName) {
        case 'param':
          includesParam = true
          if (includesContent) throw new Error('<send> cannot include both <param> and <content>')
          this.addParam(childNode, paramsObj)
          break

        case 'content':
          if (includesParam) throw new Error('<send> cannot include both <param> and <content>')
          if (includesContent) throw new Error('<send> cannot include more than one <content> node')
          includesContent = true
          // Will parse the first Text Node we see as JSON
          contentCode = this.getContentFromNode(childNode, 'WoTSend')
          contentCode = contentCode.slice(0, -1)
          break

        default:
          break
      }
    }

    if (includesParam) {
      this.variableMap[`${PARAM_OBJECT_PREFIX}${this.PARAM_OBJECT_COUNTER}`] = this.handleSendorSpawnParamsObject(paramsObj)
      data = `"{{${PARAM_OBJECT_PREFIX}${this.PARAM_OBJECT_COUNTER}}}"`
      this.PARAM_OBJECT_COUNTER++
    }

    if (includesContent) {
      data = contentCode
    }
    let code = '(context, event) => {'
    if (eventString !== undefined && data === undefined) {
      if (delayNumber !== undefined) code += ` setTimeout(()=>{ responseHandlerEmitter.emit("${eventString})" }, ${delayNumber}) }`
      else if (delayExpr !== undefined) code += ` setTimeout(()=>{ responseHandlerEmitter.emit("${eventString})" }, ${delayExpr}) }`
      else code += ` responseHandlerEmitter.emit("${eventString}") }`
    } else if (eventString !== undefined && data !== undefined) {
      if (delayNumber !== undefined) code += ` setTimeout(()=>{ responseHandlerEmitter.emit("${eventString}", ${data}) }, ${delayNumber}) }`
      else if (delayExpr !== undefined) code += ` setTimeout(()=>{ responseHandlerEmitter.emit("${eventString}", ${data}) }, ${delayExpr}) }`
      else code += ` responseHandlerEmitter.emit("${eventString}", ${data}) }`
    } else if (eventExpr !== undefined && data === undefined) {
      if (delayNumber !== undefined) code += ` setTimeout(()=>{ responseHandlerEmitter.emit("${eventExpr}") }, ${delayNumber}) }`
      else if (delayExpr !== undefined) code += ` setTimeout(()=>{ responseHandlerEmitter.emit("${eventExpr}") }, ${delayExpr}) }`
      else code += ` responseHandlerEmitter.emit("${eventExpr}") }`
    } else if (eventExpr !== undefined && data !== undefined) {
      if (delayNumber !== undefined) code += ` setTimeout(()=>{ responseHandlerEmitter.emit("${eventExpr}", ${data}) }, ${delayNumber}) }`
      else if (delayExpr !== undefined) code += ` setTimeout(()=>{ responseHandlerEmitter.emit("${eventExpr}", ${data}) }, ${delayExpr}) }`
      else code += ` responseHandlerEmitter.emit("${eventExpr}", ${data}) }`
    }
    this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`] = code

    // Add action to machine options
    if (this.XStateMachineOptions.actions === undefined) this.XStateMachineOptions.actions = {}
    this.XStateMachineOptions.actions[`${WOT_RESPONSE_PREFIX}${this.WOT_RESPONSE_COUNTER}`] = `{{${SEND_PREFIX}${this.SEND_COUNTER}}}` as any

    actionsArray.push(`${WOT_RESPONSE_PREFIX}${this.WOT_RESPONSE_COUNTER}`)
    this.SEND_COUNTER++
    this.WOT_RESPONSE_COUNTER++
  }

  protected addSendSim (sendNode: Node, actionsArray: any[]): void {
    // let eventString: string | undefined
    // let eventExpr: string | undefined

    // let idString: string | undefined
    // let idExpr: string | undefined

    let targetString: string | undefined
    // let targetExpr: string | undefined

    let delayNumber: number | undefined
    let delayExpr: string | undefined

    // Handle <content> and <param> Children
    let includesParam = false
    let includesContent = false

    const paramsObj = {}
    let contentCode, data: string | undefined

    // Attribute Extraction
    const targetAttr = select('./@target', sendNode, true) as Attr | undefined
    const targetExprAttr = select('./@targetexpr', sendNode, true) as Attr | undefined
    // const typeAttr = select('./@type', sendNode, true) as Attr | undefined
    // const typeExprAttr = select('./@typeExpr', sendNode, true) as Attr | undefined
    // const idAttr = select('./@id', sendNode, true) as Attr | undefined
    // const idlocationAttr = select('./@idlocation', sendNode, true) as Attr | undefined
    const delayAttr = select('./@delay', sendNode, true) as Attr | undefined
    const delayExprAttr = select('./@delayexpr', sendNode, true) as Attr | undefined
    const namelistAttr = select('./@namelistAttr', sendNode, true) as Attr | undefined

    // // ID parsing
    // if (idAttr?.value !== undefined) {
    //   idString = idAttr.value
    // } else if (idlocationAttr?.value !== undefined) {
    //   idString = this.exprParserAndModder(idlocationAttr.value)
    // }

    // Target parsing
    if (targetAttr?.value !== undefined) {
      targetString = targetAttr.value
    } else if (targetExprAttr?.value !== undefined) {
      targetString = this.exprParserAndModder(targetExprAttr.value)
    }

    if (targetString !== undefined && !targetString.startsWith('ws://')) throw new Error('<send> of type WoTSimProcessor can only have Websocket servers as target. Current target is ' + targetString)

    // Delay Parsing
    let delayString: string | undefined

    if (delayAttr?.value !== undefined) {
      delayString = delayAttr.value.trim()
    } else if (delayExprAttr?.value !== undefined) {
      delayExpr = this.exprParserAndModder(delayExprAttr.value)
    }

    if (delayString !== undefined) {
      delayNumber = delayToMs(delayString)
    }
    // ToDo Handle ID and Cancellation! Probably need to add a new variable in context in form of an array that we can push to.

    // // Add id if available
    // if (idString !== undefined) sendOptions.id = idString
    // else if (idExpr !== undefined) {
    //   this.variableMap[`${SEND_IDEXPR_PREFIX}${this.SEND_IDEXPR_COUNTER}`] = `(context: any, event: any, { _event } => {return ${idExpr}})`
    //   sendOptions.id = `{{${SEND_IDEXPR_PREFIX}${this.SEND_IDEXPR_COUNTER}}}`
    //   this.SEND_IDEXPR_COUNTER++
    // }

    if (this.XStateMachineOptions.actions === undefined) this.XStateMachineOptions.actions = {}

    if (namelistAttr?.value !== undefined) this.handleNameList(namelistAttr.value, paramsObj)
    // Handle <content> and <param> Children
    for (let i = 0; i < sendNode.childNodes.length; i++) {
      const childNode = sendNode.childNodes[i]
      switch (childNode.nodeName) {
        case 'param':
          includesParam = true
          if (includesContent) throw new Error('<send> cannot include both <param> and <content>')
          this.addParam(childNode, paramsObj)
          break

        case 'content':
          if (includesParam) throw new Error('<send> cannot include both <param> and <content>')
          if (includesContent) throw new Error('<send> cannot include more than one <content> node')
          includesContent = true
          // Will parse the first Text Node we see as JSON
          contentCode = this.getContentFromNode(childNode, 'WoTSend')
          contentCode = contentCode.slice(0, -1)
          break

        default:
          break
      }
    }

    if (includesParam) {
      this.variableMap[`${PARAM_OBJECT_PREFIX}${this.PARAM_OBJECT_COUNTER}`] = this.handleSendorSpawnParamsObject(paramsObj)
      data = `"{{${PARAM_OBJECT_PREFIX}${this.PARAM_OBJECT_COUNTER}}}"`
      this.PARAM_OBJECT_COUNTER++
    }

    if (includesContent) {
      data = contentCode
    }
    let code = '(context, event) => {'
    if (data !== undefined && targetString !== undefined) {
      if (delayNumber !== undefined) code += ` setTimeout(()=>{ ws${this.simulationTargets.indexOf(targetString)}.send(JSON.stringify(${data})) }, ${delayNumber}) }`
      else if (delayExpr !== undefined) code += ` setTimeout(()=>{ ws${this.simulationTargets.indexOf(targetString)}.send(JSON.stringify(${data})) }, ${delayExpr}) }`
      else code += ` ws${this.simulationTargets.indexOf(targetString)}.send(JSON.stringify(${data})) }`
    }
    this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`] = code

    // Add action to machine options
    if (this.XStateMachineOptions.actions === undefined) this.XStateMachineOptions.actions = {}
    this.XStateMachineOptions.actions[`${WOT_SIM_PREFIX}${this.WOT_SIM_COUNTER}`] = `{{${SEND_PREFIX}${this.SEND_COUNTER}}}` as any

    actionsArray.push(`${WOT_SIM_PREFIX}${this.WOT_SIM_COUNTER}`)
    this.SEND_COUNTER++
    this.WOT_SIM_COUNTER++
  }

  protected async addTransition (transitionNode: Node, parentNodeObj: any): Promise<void> {
    if (this.scxmlNode === undefined) throw Error('SCXML undefined')
    await super.addTransition(transitionNode, parentNodeObj)
    const eventAttr = select('./@event', transitionNode, true) as Attr | undefined
    const condAttr = select('./@cond', transitionNode, true) as Attr | undefined

    if (eventAttr?.value !== undefined) {
      const event = eventAttr.value
      const internalOp = this.internalOps.find((op) => op.event === event)
      const stateElement = transitionNode.parentNode as Element
      const parentState = stateElement.parentNode as Element
      const idAttr = select('./@id', stateElement, true) as Attr | undefined
      const id = idAttr?.value

      const parentId = parentState.getAttribute('id')
      const xpath = parentId !== null ? `//wot:property[@stateElement="${parentId}"]` : undefined
      const statePropertyNode = xpath !== undefined ? select(xpath, this.scxmlNode) : null
      const stateProperty = statePropertyNode !== null && xpath !== undefined ? (select(xpath, this.scxmlNode) as Node[])[0] as Element | undefined : undefined
      const stateIsProperty = stateProperty !== undefined
      const statePropertyName = stateIsProperty ? stateProperty.getAttribute('name') : null

      const affordancesMap = {
        property: 'properties',
        action: 'actions',
        event: 'events'
      }

      if (stateIsProperty && internalOp !== undefined) {
        let parents = this.findParentStates(stateElement)
        parents = parents.reverse()
        const parentsString = parents.join('.')

        this.protoTD[affordancesMap[internalOp.affordanceType]] ??= {}
        const affordancesObject = this.protoTD[affordancesMap[internalOp.affordanceType]] as Record<string, any>
        affordancesObject[internalOp.name] ??= {}
        affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`] ??= {}
        affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op] ??= {}
        // Affects Keyword
        affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op].affects ??= []
        if (statePropertyName !== null && !(affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op].affects as string[]).includes(statePropertyName)) affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op].affects.push(statePropertyName)
        // AvailableInState keyword
        affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op].availableInState ??= []
        if (id !== undefined && statePropertyName !== null) {
          if (!(affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op].availableInState as string[]).includes(`${statePropertyName}.${id}`)) affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op].availableInState.push(`${statePropertyName}.${id}`)

          if (!internalOp.availableIn.includes(parentsString.concat(`.${id}`))) internalOp.availableIn.push(parentsString.concat(`.${id}`))

          // Condition
          let cond = condAttr?.value
          if (cond !== undefined) {
            cond = cond.replace('event.data.payload', 'input')
            affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op][`${statePropertyName}.${id}`] ??= []
            affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op][`${statePropertyName}.${id}`].push({ cond })
            if (internalOp[id] === undefined) internalOp[id] = []
            internalOp[id].push({ cond })
          }
        }
      }

      // Assign
      const assignsXpath = './scxml:assign'
      const assignArray = select(assignsXpath, transitionNode) as Element[]
      for (let i = 0; i < assignArray.length; i++) {
        const location = assignArray[0].getAttribute('location')
        const xpath = location !== null ? `//wot:property[@dataElement="${location}"]` : undefined
        const statePropertyNode = xpath !== undefined && !((location?.startsWith('event')) ?? false) ? select(xpath, this.scxmlNode) : null
        const dataProperty = statePropertyNode !== null && xpath !== undefined ? (select(xpath, this.scxmlNode) as Node[])[0] as Element | undefined : undefined
        const dataIsProperty = dataProperty !== undefined
        const dataPropertyName = dataIsProperty ? dataProperty.getAttribute('name') : null

        if (dataIsProperty && internalOp !== undefined) {
          this.protoTD[affordancesMap[internalOp.affordanceType]] ??= {}
          const affordancesObject = this.protoTD[affordancesMap[internalOp.affordanceType]] as Record<string, any>
          affordancesObject[internalOp.name] ??= {}
          affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`] ??= {}
          affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op] ??= {}
          affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op].affects ??= []
          if (dataPropertyName !== null && !(affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op].affects as string[]).includes(dataPropertyName)) affordancesObject[internalOp.name][`scxml:${internalOp.affordanceType}`][internalOp.op].affects.push(dataPropertyName)
        }
      }
    }
  }

  protected async addNormalState (childStateNode: Node, parentNodeStatesObj: any): Promise<void> {
    await super.addNormalState(childStateNode, parentNodeStatesObj)
    const idAttr = select('./@id', childStateNode, true) as Attr
    const wotPropertyAttr = select('./@wot:property', childStateNode, true) as Attr | undefined

    const id = idAttr.value
    if (wotPropertyAttr !== undefined) {
      const propertySchema = {
        title: `${id}`,
        description: `Exposed State ${id}`
      }

      if (this.protoTD.properties === undefined) this.protoTD.properties = {}
      this.protoTD.properties[id] = propertySchema
      this.getStateSchema(childStateNode, this.protoTD.properties[id] as any)

      // Add read handler
      if (this.protoTD.properties[id]?.writeOnly === false || this.protoTD.properties[id]?.writeOnly === undefined) {
        this.codeSnippets.properties.readproperty += `thing.setPropertyReadHandler('${id}', () => service.getSnapshot().value`
        let parents = this.findParentStates(childStateNode)
        parents = parents.reverse()
        for (const parent of parents) {
          this.codeSnippets.properties.readproperty += `["${parent}"]`
        }
        this.codeSnippets.properties.readproperty += `["${id}"])\n`
      }
    }
  }

  protected async addParallelState (childParallelNode: Node, parentNodeStatesObj: any): Promise<void> {
    await super.addParallelState(childParallelNode, parentNodeStatesObj)
    const idAttr = select('./@id', childParallelNode, true) as Attr
    const wotPropertyAttr = select('./@wot:property', childParallelNode, true) as Attr | undefined

    const id = idAttr.value
    if (wotPropertyAttr !== undefined) {
      const propertySchema = {
        title: `${id}`,
        description: `Exposed State ${id}`
      }

      if (this.protoTD.properties === undefined) this.protoTD.properties = {}
      this.protoTD.properties[id] = propertySchema
      this.getStateSchema(childParallelNode, this.protoTD.properties[id] as any)

      // Add read handler
      if ((this.protoTD.properties[id]?.writeOnly) === false || this.protoTD.properties[id]?.writeOnly === undefined) {
        this.codeSnippets.properties.readproperty += `thing.setPropertyReadHandler('${id}', () => service.getSnapshot().value`
        let parents: string[] = this.findParentStates(childParallelNode)
        parents = parents.reverse()
        for (const parent of parents) {
          this.codeSnippets.properties.readproperty += `["${parent}"]`
        }
        this.codeSnippets.properties.readproperty += `["${id}"])\n`
      }
    }
  }

  protected addWoTAffordances (wotAffordancesNode: Node): void {
    for (let i = 0; i < wotAffordancesNode.childNodes.length; i++) {
      const childNode = wotAffordancesNode.childNodes[i]
      if (childNode.nodeType === childNode.ELEMENT_NODE) {
        switch (childNode.nodeName) {
          case 'wot:property':
            this.addWoTProperty(childNode as Element)
            break

          case 'wot:action':
            this.addWoTAction(childNode as Element)
            break

          case 'wot:event':
            this.addWoTEvent(childNode as Element)
            break

          default:
            break
        }
      }
    }
  }

  protected addWoTProperty (wotPropertyElement: Element): void {
    if (this.scxmlNode === undefined) throw Error('SCXML undefined')
    // Extract Attributes
    const nameAttr = select('./@name', wotPropertyElement, true) as Attr
    const dataElementAttr = select('./@dataElement', wotPropertyElement, true) as Attr | undefined
    const accessPropsAttr = select('./@accessProps', wotPropertyElement, true) as Attr | undefined
    const stateElementAttr = select('./@stateElement', wotPropertyElement, true) as Attr | undefined

    const name = nameAttr.value
    // const emitEvent = (select('./@emitEvent', wotPropertyElement, true) as Attr | undefined)?.value
    const dataElementID = dataElementAttr?.value
    const stateElementID = stateElementAttr?.value
    const accessProps = accessPropsAttr?.value !== undefined ? JSON.parse(accessPropsAttr.value) as boolean : undefined

    // add property to TD
    if (this.protoTD.properties === undefined) this.protoTD.properties = {}
    if (this.protoTD.properties[name] === undefined) this.protoTD.properties[name] = {}

    if (dataElementID !== undefined && (accessProps === false || accessProps === undefined)) {
      let dataElement
      // find associated <data> element
      if (this.scxmlNode !== undefined) {
        dataElement = (select(`//scxml:data[@id="${dataElementID}"]`, this.scxmlNode) as Node[])[0] as Element | undefined
        if (dataElement === undefined) throw new Error(`Cannot find <data> element with id: ${dataElementID} for property ${name}`)

        const contentElement = select('./scxml:content', wotPropertyElement, true) as Element | undefined
        if (contentElement === undefined || contentElement.textContent === null) throw new Error(`Cannot handle property ${name} without valid <content>`)
        const propertyObj = JSON.parse(contentElement.textContent)

        this.protoTD.properties[name] = propertyObj
        this.addPropertyData(name, dataElementID, wotPropertyElement)
      }
    } else if (dataElementID !== undefined && accessProps === true) {
      this.addPropertyDataNamelist(name, dataElementID, wotPropertyElement)
    } else if (stateElementID !== undefined) {
      // find associated state node
      const childStateNode = (select(`//scxml:state[@id="${stateElementID}"] | //scxml:parallel[@id="${stateElementID}"] | //scxml:final[@id="${stateElementID}"]`, this.scxmlNode) as Node[])[0] as Element | undefined
      if (childStateNode === undefined) throw new Error(`Cannot find state element with id: ${stateElementID} for property ${name}`)
      const contentElement = select('./scxml:content', wotPropertyElement, true) as Element | undefined
      const propertyObj = contentElement?.textContent != null ? JSON.parse(contentElement.textContent) : undefined
      this.protoTD.properties[name] = propertyObj
      this.addPropertyState(name, stateElementID, wotPropertyElement, childStateNode)
    } else {
      throw new Error(`Property "${name}" must define either "dataElement" or "stateElement"`)
    }
  }

  protected addWoTAction (wotActionElement: Element): void {
    const nameAttr = select('./@name', wotActionElement, true) as Attr
    const name = nameAttr.value

    if (this.protoTD.actions === undefined) this.protoTD.actions = {}
    if (this.protoTD.actions[name] === undefined) this.protoTD.actions[name] = {}
    const contentElement = select('./scxml:content', wotActionElement, true) as Element | undefined
    if (contentElement === undefined || contentElement.textContent === null) throw new Error('Cannot handle action without valid <content>')
    const actionObj = JSON.parse(contentElement.textContent)
    this.protoTD.actions[name] = actionObj

    const ops = select('./wot:op', wotActionElement) as Element[]
    for (const op of ops) {
      this.addOp(name, op, 'action', actionObj)
    }
  }

  protected addWoTEvent (wotEventElement: Element): void {
    const nameAttr = select('./@name', wotEventElement, true) as Attr
    const name = nameAttr.value
    const emitEvent = (select('./@emitEvent', wotEventElement, true) as Attr)?.value

    if (emitEvent === undefined) throw new Error(`emitEvent of Event ${name} is not defined!`)
    this.codeSnippets.events.emit = `responseHandlerEmitter.on("${emitEvent}", (data) => {
      thing.emitEvent("${name}", data)
    })\n`

    if (this.protoTD.events === undefined) this.protoTD.events = {}
    if (this.protoTD.events[name] === undefined) this.protoTD.events[name] = {}
    const contentElement = select('./scxml:content', wotEventElement, true) as Element | undefined
    if (contentElement === undefined || contentElement.textContent === null) throw new Error('Cannot handle action without valid <content>')
    const eventObj = JSON.parse(contentElement.textContent)
    this.protoTD.events[name] = eventObj

    const ops = select('./wot:op', wotEventElement) as Element[]
    for (const op of ops) {
      this.addOp(name, op, 'event', eventObj)
    }
  }

  protected addPropertyData (propertyName: string, dataName: string, propertyNode: Node): void {
    // Extract Schema
    const contentElement = select('./scxml:content', propertyNode, true) as Element

    // needed for observable generation
    const hasEmitEvent = (select('./@emitEvent', propertyNode, true) as Attr | undefined)?.value !== undefined
    if (contentElement === undefined || contentElement.textContent === null) throw new Error(`Cannot handle property ${propertyName} without valid <content>`)

    let propertySchema
    if (contentElement.textContent !== null) propertySchema = JSON.parse(contentElement.textContent)

    if (propertySchema === undefined || propertySchema === null) throw new Error(`<wot:property> ${propertyName} with "dataElement" does not contain a <schema>`)

    if (this.protoTD.properties === undefined) this.protoTD.properties = {}
    if (this.protoTD.properties[propertyName] === undefined) this.protoTD.properties[propertyName] = propertySchema

    const readable = this.protoTD.properties[propertyName]?.writeOnly === undefined || this.protoTD.properties[propertyName]?.writeOnly === false
    const writable = this.protoTD.properties[propertyName]?.readOnly === undefined || this.protoTD.properties[propertyName]?.readOnly === false
    const observable = this.protoTD.properties[propertyName]?.observable === true

    // find read prop
    const readPropNode = select('./wot:op[@type="readproperty"]', propertyNode, true) as Element | undefined
    let readPropStateDependantAttr, readPropResponseEventAttr, readPropEventAttr
    if (readPropNode !== undefined) {
      // Event to initiate property read
      readPropEventAttr = select('./@event', readPropNode, true) as Attr | undefined
      // Is reading the property dependant on current state
      readPropStateDependantAttr = select('./@stateDependant', readPropNode, true) as Attr | undefined
      // Event that is emitted from the state machine once the read operation is fulfilled
      readPropResponseEventAttr = select('./@responseEvent', readPropNode, true) as Attr | undefined
    }

    const hasReadPropEvent = readPropEventAttr?.value !== undefined
    const readPropStateDependant = readPropStateDependantAttr?.value !== undefined && readPropStateDependantAttr?.value === 'false'
    const readHasResponseEvent = readPropResponseEventAttr?.value !== undefined
    if (!hasReadPropEvent && readHasResponseEvent) console.warn(`readproperty ${propertyName} has a response event defined, but no event, response event will be ignored!`)

    // find write prop
    const writePropNode = select('./wot:op[@type="writeproperty"]', propertyNode, true) as Element | undefined
    let writePropStateDependantAttr, writePropResponseEventAttr, writePropEventAttr
    if (writePropNode !== undefined) {
      writePropEventAttr = select('./@event', writePropNode, true) as Attr | undefined
      writePropStateDependantAttr = select('./@stateDependant', writePropNode, true) as Attr | undefined
      writePropResponseEventAttr = select('./@responseEvent', writePropNode, true) as Attr | undefined
    }
    const hasWritePropEvent = writePropEventAttr?.value !== undefined
    const writeHasResponseEvent = writePropResponseEventAttr?.value !== undefined
    const writePropStateDependant = writePropStateDependantAttr?.value !== undefined && writePropStateDependantAttr?.value === 'false'
    if (!hasWritePropEvent && writeHasResponseEvent) console.warn(`Writeproperty ${propertyName} has a response event defined, but no event, response event will be ignored!`)

    // add read handler if no <wot:op> or if not state dependant and no event (always possible to read and response is instant)
    if (readable && (readPropNode === undefined || (!readPropStateDependant && !hasReadPropEvent))) {
      this.codeSnippets.properties.readproperty += `thing.setPropertyReadHandler('${propertyName}', async () => service.getSnapshot().context['${dataName}'])\n`
    }

    // add write handler if no <wot:op> or if not state dependant and no event (always possible to write and response is instant)
    if (writable && (writePropNode === undefined || (!writePropStateDependant && !hasWritePropEvent))) {
      this.codeSnippets.properties.writeproperty += `thing.setPropertyWriteHandler('${propertyName}', async (input, options) => {
        service.send({
          type: 'writeproperty.${propertyName}',
          data: {
            payload: await input.value(),
            uriVariables: options?.uriVariables
          }
        } as any)
      })
      `
    }

    // add emitPropertyChange if observable and no emit event (no state machine specific event)
    if (observable && !hasEmitEvent) {
      this.codeSnippets.properties.emitTransition += `if(lastContext !== undefined && lastContext["${dataName}"] !== state.context["${dataName}"]) thing.emitPropertyChange('${propertyName}')\n`
    }

    // add all other ops if available
    const ops = select('./wot:op', propertyNode) as Element[]
    for (const op of ops) {
      this.addOp(propertyName, op, 'property', propertySchema)
    }
  }

  protected addPropertyDataNamelist (propertyName: string, dataName: string, propertyNode: Node): void {
    if (this.scxmlNode === undefined) throw Error('SCXML undefined')
    // Extract Schema
    const contentElement = select('./scxml:content', propertyNode, true) as Element | undefined | null

    // needed for observable generation
    const hasEmitEvent = (select('./@emitEvent', propertyNode, true) as Attr | undefined)?.value !== undefined

    if (contentElement === undefined || contentElement === null || contentElement.textContent === null) console.log(`Warning: found a <content> with schema inside a namelisted <property> ${propertyName}. Will merge with generated schema`)

    let propertySchema: Record<string, any>
    let accessParameter: string | undefined
    let dataJSON
    // Merging
    if (contentElement?.textContent !== null && contentElement?.textContent !== undefined) {
      propertySchema = JSON.parse(contentElement.textContent)
      if (propertySchema.uriVariables !== undefined) accessParameter = Object.keys(propertySchema.uriVariables)[0]
    }

    // Find data element
    const dataElement = (select(`//scxml:data[@id="${dataName}"]`, this.scxmlNode) as Node[])[0]
    const exprAttr = select('./@expr', dataElement, true) as Attr | undefined
    let expr
    if (exprAttr?.value !== undefined) expr = exprAttr.value
    else {
      for (let i = 0; i < dataElement.childNodes.length; i++) {
        const childNode = dataElement.childNodes[i]
        if (childNode.nodeType === childNode.TEXT_NODE && childNode.nodeValue !== null) expr = childNode.nodeValue
      }
    }

    if (expr === undefined) {
      throw new Error(`Namelisted <property> ${propertyName} is linked to <data> ${dataName} that does not contain any experssion of data`)
    } else {
      // interpret string as JSON
      dataJSON = JSON.parse(expr)
      if (typeof dataJSON !== 'object') throw new Error(`Namelisted <property> ${propertyName} is linked to <data> ${dataName} that is not an object`)
    }

    // Generate schema
    accessParameter ??= (select('./@accessParamter', propertyNode, true) as Attr | undefined)?.value
    if (accessParameter === undefined || accessParameter === null) throw Error(`Cannot handle namelisted <property> ${propertyName} with "accesProps" and no "accessParameter"`)
    propertySchema ??= { }
    propertySchema.uriVariables ??= {}
    propertySchema.uriVariables[accessParameter] ??= {
      type: 'string',
      enum: Object.keys(dataJSON)
    }

    if (propertySchema.type === undefined) {
      for (const prop in dataJSON) {
        const dataJsonType = typeof dataJSON[prop]
        const propertySchemaType = propertySchema.type
        if (propertySchema.type === undefined) {
          propertySchema.type = typeof dataJSON[prop]
        } else if (propertySchemaType === 'string' && dataJsonType !== propertySchemaType) {
          propertySchema.oneOf = [{ type: propertySchemaType }];
          (propertySchema.oneOf as any[]).push({ type: dataJsonType })
          delete propertySchema.type
        }
      }
    }

    if (propertySchema === undefined || propertySchema === null) throw new Error(`<wot:property> ${propertyName} with "dataElement" does not contain a <schema>`)

    if (this.protoTD.properties === undefined) this.protoTD.properties = {}
    if (this.protoTD.properties[propertyName] === undefined) this.protoTD.properties[propertyName] = {}
    this.protoTD.properties[propertyName] = propertySchema

    const readable = this.protoTD.properties[propertyName]?.writeOnly === undefined || this.protoTD.properties[propertyName]?.writeOnly === false
    const writable = this.protoTD.properties[propertyName]?.readOnly === undefined || this.protoTD.properties[propertyName]?.readOnly === false
    const observable = this.protoTD.properties[propertyName]?.observable === true

    // find read prop
    const readPropNode = select('./wot:op[@type="readproperty"]', propertyNode, true) as Element | undefined
    let readPropStateDependantAttr, readPropResponseEventAttr, readPropEventAttr
    if (readPropNode !== undefined) {
      // Event to initiate property read (if state dependant)
      readPropEventAttr = select('./@event', readPropNode, true) as Attr | undefined
      // Is reading the property dependant on current state
      readPropStateDependantAttr = select('./@stateDependant', readPropNode, true) as Attr | undefined
      // Event that is emitted from the state machine once the read operation is fulfilled
      readPropResponseEventAttr = select('./@responseEvent', readPropNode, true) as Attr | undefined
    }

    const hasReadPropEvent = readPropEventAttr?.value !== undefined
    const readPropStateDependant = readPropStateDependantAttr?.value !== undefined && readPropStateDependantAttr?.value === 'false'
    const readHasResponseEvent = readPropResponseEventAttr?.value !== undefined
    if (!hasReadPropEvent && readHasResponseEvent) console.warn(`readproperty ${propertyName} has a response event defined, but no event, response event will be ignored!`)

    // find write prop
    const writePropNode = select('./wot:op[@type="writeproperty"]', propertyNode, true) as Element | undefined
    let writePropStateDependantAttr, writePropResponseEventAttr, writePropEventAttr
    if (writePropNode !== undefined) {
      // Event to initiate property write (if state dependant)
      writePropEventAttr = select('./@event', writePropNode, true) as Attr | undefined
      // Is reading the property dependant on current state
      writePropStateDependantAttr = select('./@stateDependant', writePropNode, true) as Attr | undefined
      // Event that is emitted from the state machine once the read operation is fulfilled
      writePropResponseEventAttr = select('./@responseEvent', writePropNode, true) as Attr | undefined
    }
    const hasWritePropEvent = writePropEventAttr?.value !== undefined
    const writeHasResponseEvent = writePropResponseEventAttr?.value !== undefined
    const writePropStateDependant = writePropStateDependantAttr?.value !== undefined && writePropStateDependantAttr?.value === 'false'
    if (!hasWritePropEvent && writeHasResponseEvent) console.warn(`Writeproperty ${propertyName} has a response event defined, but no event, response event will be ignored!`)

    // add read handler if readable but no <wot:op> or if not state dependant and no event (always possible to read and response is instant)
    if (readable && (readPropNode === undefined || (!readPropStateDependant && !hasReadPropEvent))) {
      this.codeSnippets.properties.readproperty += `thing.setPropertyReadHandler('${propertyName}', (options) => { 
        if (options && typeof options === "object" && options.uriVariables) {
        const uriVariables = options.uriVariables;
        if (uriVariables["${accessParameter}"]) {
          const id = uriVariables["${accessParameter}"];
          return service.getSnapshot().context["${dataName}"][id];
        }
      }
    })\n`
    }

    // add write handler if writable but no <wot:op> or if not state dependant and no event (always possible to write and response is instant)
    if (writable && (writePropNode === undefined || (!writePropStateDependant && !hasWritePropEvent))) {
      this.codeSnippets.properties.writeproperty += `thing.setPropertyWriteHandler('${propertyName}', async (input, options) => {
        service.send({
          type: 'writeproperty.${propertyName}',
          data: {
            payload: await input.value,
            uriVariables: options.uriVariables
          }
        } as any)
      })`
    }

    // add emitPropertyChange if observable and no emit event (no state machine specific event)
    // Todo Think about how to observe correctly
    if (observable && !hasEmitEvent) {
      this.codeSnippets.properties.emitTransition += `if(lastContext !== undefined && lastContext["${dataName}"] !== state.context["${dataName}"]) thing.emitPropertyChange('${propertyName}')\n`
    }

    // add all other ops if available
    const ops = select('./wot:op', propertyNode) as Element[]
    for (const op of ops) {
      this.addOp(propertyName, op, 'property', propertySchema)
    }
  }

  protected addPropertyState (propertyName: string, stateId: string, propertyNode: Node, stateNode: Node): void {
    const hasEmitEvent = (select('./@emitEvent', propertyNode, true) as Attr | undefined)?.value !== undefined

    this.protoTD.properties ??= {}
    this.protoTD.properties[propertyName] ??= {}
    if (this.protoTD.properties === undefined || this.protoTD.properties[propertyName] === undefined) { throw new Error('Unexpected error') }
    (this.protoTD.properties[propertyName] as Record<string, any>).title ??= `${stateId}`;
    (this.protoTD.properties[propertyName] as Record<string, any>).description ??= `Exposed State ${stateId}`
    this.getStateSchema(stateNode, this.protoTD.properties[propertyName] as any)

    const readable = (this.protoTD.properties[propertyName] as Record<string, any>)?.writeOnly === undefined || (this.protoTD.properties[propertyName] as Record<string, any>)?.writeOnly === false
    const observable = (this.protoTD.properties[propertyName] as Record<string, any>)?.observable === true

    // find read prop
    const readPropNode = select('./wot:op[@type="readproperty"]', propertyNode, true) as Element | undefined
    let readPropStateDependantAttr, readPropResponseEventAttr, readPropEventAttr
    if (readPropNode !== undefined) {
      readPropEventAttr = select('./@event', readPropNode, true) as Attr | undefined
      readPropStateDependantAttr = select('./@stateDependant', readPropNode, true) as Attr | undefined
      readPropResponseEventAttr = select('./@responseEvent', readPropNode, true) as Attr | undefined
    }
    const hasReadPropEvent = readPropEventAttr?.value !== undefined
    const readPropStateDependant = readPropStateDependantAttr?.value !== undefined && readPropStateDependantAttr?.value === 'false'
    const readHasResponseEvent = readPropResponseEventAttr?.value !== undefined
    if (!hasReadPropEvent && readHasResponseEvent) console.warn(`readproperty ${propertyName} has a response event defined, but no event, response event will be ignored!`)

    // Add read handler
    if (readable && (readPropNode === undefined || (!readPropStateDependant && !hasReadPropEvent))) {
      this.codeSnippets.properties.readproperty += `thing.setPropertyReadHandler('${propertyName}', () => service.getSnapshot().value`
      let parents = this.findParentStates(stateNode)
      parents = parents.reverse()
      for (const parent of parents) {
        this.codeSnippets.properties.readproperty += `["${parent}"]`
      }
      this.codeSnippets.properties.readproperty += `["${stateId}"])\n`
    }

    // add emitPropertyChange
    if (observable && !hasEmitEvent) {
      let parents = this.findParentStates(stateNode)
      parents = parents.reverse()
      let identifier = ''
      for (const parent of parents) {
        identifier += `["${parent}"]`
      }
      identifier += `["${stateId}"]`
      this.codeSnippets.properties.emitTransition += `if(lastState !== undefined && lastContext.value${identifier} !== state.value${identifier}) thing.emitPropertyChange('${propertyName}')\n`
    }

    const ops = select('./wot:op', propertyNode) as Element[]
    for (const op of ops) {
      this.addOp(propertyName, op, 'property', this.protoTD.properties[propertyName])
    }
  }

  /** ================================================================================================
  *                                         Utility Methods
  *================================================================================================ **/

  protected findStateLevel (stateNode: Node): number {
    /** Base cases **/

    // Has no children
    if (!stateNode.hasChildNodes()) return 0

    let i = 0
    let stateLevel = 0
    for (i = 0; i < stateNode.childNodes.length; i++) {
      const childNode = stateNode.childNodes[i]
      if (childNode.nodeType === childNode.ELEMENT_NODE && (childNode.nodeName === 'state' || childNode.nodeName === 'parallel' || childNode.nodeName === 'final' || childNode.nodeName === 'initial' || childNode.nodeName === 'history')) {
        const childStateLevel = this.findStateLevel(childNode)
        const newStateLevel = childStateLevel + 1
        if (newStateLevel > stateLevel) stateLevel = newStateLevel
      }
    }
    return stateLevel
  }

  protected enumerateStatePossibilities (stateNode: Node): stateEnum {
    const stateLevel = this.findStateLevel(stateNode)
    const nodeType = stateNode.nodeName
    if (stateLevel === 0) {
      let statevalue = ''
      const idAttr = select('./@id', stateNode, true) as Attr
      statevalue = idAttr?.value !== undefined ? idAttr.value : statevalue
      return statevalue
    } else if (stateLevel === 1) {
      const stateValues: any = nodeType === 'parallel' ? {} : []
      for (let i = 0; i < stateNode.childNodes.length; i++) {
        const childNode = stateNode.childNodes[i]
        if (childNode.nodeType === childNode.ELEMENT_NODE && (childNode.nodeName === 'state' || childNode.nodeName === 'parallel' || childNode.nodeName === 'final')) {
          const idAttr = select('./@id', childNode, true) as Attr
          if (idAttr?.value !== undefined && nodeType === 'parallel') stateValues[idAttr.value] = {}
          else if (idAttr?.value !== undefined) stateValues.push(idAttr.value)
        }
      }
      return stateValues
    } else {
      // const stateValuesEnum: stateEnum[] = []
      const result: any = nodeType === 'parallel' ? {} : []
      for (let i = 0; i < stateNode.childNodes.length; i++) {
        const childNode = stateNode.childNodes[i]
        if (childNode.nodeType === childNode.ELEMENT_NODE && (childNode.nodeName === 'state' || childNode.nodeName === 'parallel' || childNode.nodeName === 'final')) {
          const idAttr = select('./@id', childNode, true) as Attr
          const tempEnum = this.enumerateStatePossibilities(childNode)

          switch (nodeType) {
            case 'state':
              if (typeof tempEnum === 'string') result.push(tempEnum)
              else {
                const enumObj: stateEnum = {}
                enumObj[idAttr.value] = tempEnum
                result.push(enumObj)
              }
              break
            case 'parallel':
              if (typeof tempEnum === 'string') result[idAttr.value] = {}
              else result[idAttr.value] = tempEnum
              break
          }
        }
      }
      return result
    }
  }

  protected getStateSchema (stateNode: Node, propertySchema: Record<string, any>): void {
    const possibilities = this.enumerateStatePossibilities(stateNode)
    // Base Cases

    // Has only one child
    if (typeof possibilities === 'string') {
      propertySchema.type = 'object'
    // Has simple children
    } else if (Array.isArray(possibilities) && possibilities.every((value) => typeof value === 'string')) {
      propertySchema.type = 'string'
      propertySchema.enum = possibilities
    // Has complex children
    } else if (Array.isArray(possibilities)) {
      const simpleChildren: string[] = []
      const complexChildren: Array<Record<string, stateEnum>> = []
      for (const possibility of possibilities) {
        if (typeof possibility === 'string') simpleChildren.push(possibility)
        if (typeof possibility === 'object' && !Array.isArray(possibility)) complexChildren.push(possibility)
      }
      propertySchema.oneOf ??= []

      // Handle Simple Children
      propertySchema.oneOf.push({ type: 'string', enum: simpleChildren })

      // Handle Complex Children
      for (const complexStatePossibility of complexChildren) {
        const statePropetySchema: Record<string, any> = {}
        propertySchema.oneOf.push(statePropetySchema)

        statePropetySchema.type = 'object'
        statePropetySchema.required ??= []
        statePropetySchema.properties ??= {}
        statePropetySchema.required.push(...Object.keys(complexStatePossibility))
        for (const state in complexStatePossibility) {
          const childStateNode = (select(`//scxml:state[@id="${state}"] | //scxml:parallel[@id="${state}"] | //scxml:final[@id="${state}"]`, stateNode) as Node[])[0] as Node | undefined
          statePropetySchema.properties[state] = {}

          if (childStateNode !== undefined) {
            this.getStateSchema(childStateNode, statePropetySchema.properties[state])
          }
        }
      }
    // is a parallel state
    } else {
      propertySchema.type = 'object'
      propertySchema.required ??= []
      propertySchema.properties ??= {}
      for (const state in possibilities) {
        propertySchema.required.push(state)
        const childStateNode = (select(`//scxml:state[@id="${state}"] | //scxml:parallel[@id="${state}"] | //scxml:final[@id="${state}"]`, stateNode) as Node[])[0] as Node | undefined
        propertySchema.properties[state] = {}

        if (childStateNode !== undefined) {
          this.getStateSchema(childStateNode, propertySchema.properties[state])
        }
      }
    }
  }

  protected addPropertyWriteHandlerState (scxml: Node, properties?: string[]): boolean {
    const scxmlDoc = scxml.ownerDocument !== null ? scxml.ownerDocument : scxml as Document
    const scxmlNode = select('//scxml:scxml', scxmlDoc, true) as Element
    const scxmlElementChildren = select('./*', scxmlNode, false) as Element[]
    let isTopLevelParallel = false

    if (properties === undefined || properties.length === 0) return false

    if (scxmlElementChildren.length === 1 && scxmlElementChildren[0].nodeName === 'parallel') isTopLevelParallel = true

    // create State
    const propertyWriteHandlerNode = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'state')
    propertyWriteHandlerNode.setAttribute('id', '_propertywriteHandler')
    // create transition
    const propertyWriteTransition = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'transition')
    propertyWriteTransition.setAttribute('target', '_propertywriteHandler')
    propertyWriteTransition.setAttribute('event', '*')
    let conditionString = 'event.type.includes("writeproperty") && ('
    for (const property of properties) {
      conditionString = conditionString.concat(`event.type.split(".")[1] === "${property}" ||`)
    }
    conditionString = conditionString.slice(0, -2)
    conditionString = conditionString.concat(')')

    propertyWriteTransition.setAttribute('cond', 'event.type.includes("writeproperty")')
    // create write action
    const propertyWriteAssign = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'assign')
    propertyWriteAssign.setAttribute('location', 'event.type.split(".")[1]')
    propertyWriteAssign.setAttribute('expr', 'event.data.payload')

    propertyWriteTransition.appendChild(propertyWriteAssign)
    propertyWriteHandlerNode.appendChild(propertyWriteTransition)

    if (isTopLevelParallel) {
      const topParallelNode = select('./scxml:parallel', scxmlNode, true) as Node
      topParallelNode.appendChild(propertyWriteHandlerNode)
    } else {
      const wrapperNode = this.addParallelWotWrapper(scxml)
      wrapperNode.appendChild(propertyWriteHandlerNode)
      scxmlNode.appendChild(wrapperNode)
    }
    return true
  }

  protected addParallelWotWrapper (scxml: Node): Element {
    const scxmlDoc = scxml.ownerDocument !== null ? scxml.ownerDocument : scxml as Document
    const scxmlNode = select('//scxml:scxml', scxmlDoc, true) as Element
    const scxmlElementChildren = select('./*', scxmlNode, false) as Element[]
    const scxmlChildren = scxmlNode.childNodes
    let isTopLevelParallel = false
    const wotWrapper: Element | undefined = select('./scxml:parallel[@id="_wotwrapper"]', scxmlNode, true) as Element

    // for (let i = 0; i < scxmlElementChildren.length; i++) {
    //   const child = scxmlElementChildren[i]
    //   if (child.nodeType === child.ELEMENT_NODE && child.tagName === '_wotwrapper') wotWrapper = child
    // }
    if ((scxmlElementChildren.length === 1 && scxmlElementChildren[0].nodeName === 'parallel') || wotWrapper !== undefined) isTopLevelParallel = true

    if (!isTopLevelParallel) {
      const wrapperNode = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'parallel')
      wrapperNode.setAttribute('id', '_wotwrapper')
      const machineWrapperNode = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'state')
      machineWrapperNode.setAttribute('id', '_wotMachinewrapper')
      const initialAttr = select('./@inital', scxmlNode, true) as Attr | undefined
      if (initialAttr?.value !== undefined) machineWrapperNode.setAttribute('initial', initialAttr.value)
      scxmlNode.setAttribute('initial', '_wotwrapper')
      for (let i = 0; i < scxmlChildren.length; i++) {
        const child = scxmlChildren[i]
        const stateNodeTypes = ['state', 'parallel', 'final', 'history', 'initial']
        if (child.nodeType === child.ELEMENT_NODE && stateNodeTypes.includes(child.nodeName)) machineWrapperNode.appendChild(child)
      }
      wrapperNode.appendChild(machineWrapperNode)
      scxmlNode.appendChild(wrapperNode)
      return wrapperNode
    } else {
      return select('./scxml:parallel', scxmlNode, true) as Element
    }
  }

  protected findWritableDataProperties (scxmlNode: Node): string[] | undefined {
    const writableProperties = []
    const wotPropertyElements = select('//wot:property[@dataElement]', scxmlNode) as Element[]
    for (const wotPropertyElement of wotPropertyElements) {
      const contentElement = select('./scxml:content', wotPropertyElement, true) as Element | undefined

      const propertyName = (select('./@name', wotPropertyElement, true) as Attr).value
      const dataElementId = (select('./@dataElement', wotPropertyElement, true) as Attr).value

      if (contentElement === undefined || contentElement.textContent === null || contentElement.textContent === undefined) throw new Error(`Cannot handle property ${propertyName} without valid <content>`)

      const propertySchema = contentElement.textContent

      if (propertySchema === undefined || propertySchema === null) throw new Error(`<wot:property> ${propertyName} with "dataElement" does not contain a schema`)

      const schemaObj = JSON.parse(propertySchema)
      const writable = schemaObj?.readOnly === undefined || schemaObj?.readOnly === false

      // find write prop
      const writePropNode = select('./wot:op[@type="writeproperty"]', wotPropertyElement, true) as Element | undefined
      let writePropStateDependantAttr, writePropResponseEventAttr
      if (writePropNode !== undefined) {
        writePropStateDependantAttr = select('./@stateDependant', writePropNode, true) as Attr | undefined
        writePropResponseEventAttr = select('./@responseEvent', writePropNode, true) as Attr | undefined
      }
      const writeHasResponseEvent = writePropResponseEventAttr?.value !== undefined
      const writePropStateDependant = writePropStateDependantAttr?.value !== undefined && writePropStateDependantAttr?.value === 'false'

      if (writable && (writePropNode === undefined || (!writePropStateDependant && !writeHasResponseEvent))) {
        writableProperties.push(dataElementId)
      }
    }
    return writableProperties
  }

  protected addOp (name: string, opElement: Element, affordanceType: 'property' | 'action' | 'event', affordanceObject: Record<string, any>): void {
    const affordanceElement = opElement.parentNode as Element

    let dataElement: string | null, stateElement: string | null, availableInAttr: string | null, propertyElementId: string | undefined, propertyType: 'data' | 'state' | undefined

    const typeAttr = select('./@type', opElement, true) as Attr
    const eventAttr = select('./@event', opElement, true) as Attr | undefined
    const responseEventAttr = select('./@responseEvent', opElement, true) as Attr | undefined
    const stateDependantAttr = select('./@stateDependant', opElement, true) as Attr | undefined

    const type = typeAttr.value as AffordanceOperations
    const event = eventAttr?.value
    const responseEvent = responseEventAttr?.value
    const stateDependant = stateDependantAttr?.value !== undefined && stateDependantAttr?.value !== 'false'

    if (affordanceObject[`scxml:${affordanceType}`] === undefined) affordanceObject[`scxml:${affordanceType}`] = {}
    if (affordanceObject[`scxml:${affordanceType}`][type] === undefined) {
      affordanceObject[`scxml:${affordanceType}`][type] = {
        event,
        availableInState: []
      }
    }

    let availableIn: string[] = []

    if (event === undefined && stateDependant) {
      availableInAttr = opElement.getAttribute('availableIn')
      if (availableInAttr !== null) availableIn = availableInAttr.split(' ')

      // Available in generation
      for (let i = 0; i < availableIn.length; i++) {
        if (this.scxmlNode === undefined) throw new Error('Unexpected error')
        const stateElement = (select(`//scxml:state[@id="${availableIn[i]}"] | //scxml:parallel[@id="${availableIn[i]}"] | //scxml:final[@id="${availableIn[i]}"]`, this.scxmlNode)) as Element[]
        const parentElement = stateElement[0].parentNode as Element
        const parentId = parentElement?.getAttribute('id')
        const xpath = parentId !== null ? `//wot:property[@stateElement="${parentId}"]` : undefined
        const statePropertyNode = xpath !== undefined ? select(xpath, this.scxmlNode) : null
        const stateProperty = statePropertyNode !== null && xpath !== undefined ? (select(xpath, this.scxmlNode) as Node[])[0] as Element | undefined : undefined
        const stateIsProperty = stateProperty !== undefined
        const statePropertyName = stateIsProperty ? stateProperty.getAttribute('name') : null
        if (stateIsProperty && statePropertyName !== null) {
          let parents = this.findParentStates(stateElement[0])
          parents = parents.reverse()
          const parentsString = parents.join('.')

          availableIn[i] = `${parentsString}.${availableIn[i]}`
          affordanceObject[`scxml:${affordanceType}`][type].availableInState.push(`${statePropertyName}.${availableIn[i]}`)
        }
      }
    }

    // Special Case for properties
    if (affordanceElement.tagName === 'wot:property') {
      dataElement = affordanceElement.getAttribute('dataElement')
      stateElement = affordanceElement.getAttribute('stateElement')

      if (dataElement !== null && dataElement !== '') {
        propertyType = 'data'
        propertyElementId = dataElement
      } else if (stateElement !== null && stateElement !== '') {
        propertyType = 'state'
        propertyElementId = stateElement
      }
    }
    // Special Case for action
    if (affordanceElement.tagName === 'wot:action') {
      affordanceObject.synchronous = !(responseEvent === undefined || stateDependant)
    }

    this.internalOps.push({ name, affordanceType, affordanceObject, event, op: type, availableIn, responseEvent, stateDependant, propertyType, propertyElementId })
  }

  // TODO fix code generation
  protected generateCodeSnippets (): void {
    if (this.scxmlNode === undefined) throw Error('SCXML undefined')
    for (const op of this.internalOps) {
      switch (op.affordanceType) {
        case 'property':
          switch (op.op) {
            case 'readproperty':
              if (op.event === undefined && op.stateDependant !== undefined && op.stateDependant) {
                // Define property handler
                this.codeSnippets.properties[op.op] += `thing.setPropertyReadHandler('${op.name}', async (inputData, options) => {\n`
                // Generate state check code only if there are availableIn states
                if (op.availableIn.length > 0) this.codeSnippets.properties[op.op] += this.generateStateCheckCode(op)
                // If property is a data Element, return data from context
                if (op.propertyType !== undefined && op.propertyType === 'data' && op.propertyElementId !== undefined) {
                  this.codeSnippets.properties[op.op] += `return service.getSnapshot().context['${op.propertyElementId}'])\n`
                } else if (op.propertyType !== undefined && op.propertyType === 'state' && op.propertyElementId !== undefined) {
                  // If property is a state Element, return state value
                  this.codeSnippets.properties.readproperty += 'return service.getSnapshot().value'
                  const stateNode = (select(`//scxml:state[@id="${op.propertyElementId}"] | //scxml:parallel[@id="${op.propertyElementId}"] | //scxml:final[@id="${op.propertyElementId}"]`, this.scxmlNode) as Node[])[0] as Element
                  let parents = this.findParentStates(stateNode)
                  parents = parents.reverse()
                  for (const parent of parents) {
                    this.codeSnippets.properties.readproperty += `["${parent}"]`
                  }
                  this.codeSnippets.properties.readproperty += `["${op.propertyElementId}"]\n`
                }
                // Close bracket for conditional statement based on state
                if (op.availableIn.length > 0) this.codeSnippets.properties[op.op] += '}'
                // Close bracket for function
                this.codeSnippets.properties[op.op] += '})'
              } else if (op.event !== undefined && op.propertyType !== undefined && op.propertyType === 'data') {
                this.codeSnippets.properties[op.op] += `thing.setPropertyReadHandler('${op.name}', async (inputData, options) => {`

                if (op.stateDependant !== undefined && op.stateDependant && op.availableIn.length > 0) this.codeSnippets.properties[op.op] += this.generateStateCheckCode(op)

                if (op.responseEvent === undefined) throw new Error(`readproperty ${op.name} requires a response event with data!`)

                this.codeSnippets.properties[op.op] += `const responsePromise = once(responseHandlerEmitter, "${op.responseEvent}")
                  service.send({type: '${op.event}', data: { payload: await inputData.value(), uriVariables: options?.uriVariables }} as any)
                  const [data] = await responsePromise
                  return data
                })
                `
                if (op.stateDependant !== undefined && op.stateDependant && op.availableIn.length > 0) this.codeSnippets.properties[op.op] += '}'
                this.codeSnippets.properties[op.op] += '})'
              }
              break
            case 'writeproperty':
              this.codeSnippets.properties[op.op] += `thing.setPropertyWriteHandler('${op.name}', async (inputData, options) => {`
              if (op.event === undefined && op.stateDependant !== undefined && op.stateDependant && op.propertyType !== undefined && op.propertyType === 'data') {
                if (op.availableIn.length > 0) this.codeSnippets.properties[op.op] += this.generateStateCheckCode(op)
                if (op.propertyElementId !== undefined) {
                  this.codeSnippets.properties[op.op] += `service.send({
                      type: 'writeproperty.${op.propertyElementId}',
                      data: {
                        payload: await input.value,
                        uriVariables: options.uriVariables
                      }
                    } as any)
                  })`
                }
                if (op.availableIn.length > 0) this.codeSnippets.properties[op.op] += '}'
                this.codeSnippets.properties[op.op] += '})'
              } else if (op.event !== undefined && op.propertyType !== undefined && op.propertyType === 'data') {
                if (op.stateDependant !== undefined && op.stateDependant && op.availableIn.length > 0) {
                  this.codeSnippets.properties[op.op] += this.generateStateCheckCode(op)
                }
                if (op.responseEvent !== undefined) {
                  this.codeSnippets.properties[op.op] +=
                  `
                    const responsePromise = once(responseHandlerEmitter, "${op.responseEvent}")
                    service.send({type: '${op.event}', data: { payload: await inputData.value(), uriVariables: options?.uriVariables }} as any)
                    const [data] = await responsePromise
                    return data
                  })
                  `
                } else {
                  this.codeSnippets.properties[op.op] +=
                  `
                    service.send({type: '${op.event}', data: { payload: await inputData.value(), uriVariables: options?.uriVariables }} as any)
                    return
                  })
                  `
                }
                if (op.stateDependant !== undefined && op.stateDependant && op.availableIn.length > 0) this.codeSnippets.properties[op.op] += '}'
                this.codeSnippets.properties[op.op] += '})'
              }
              break
            case 'observeproperty':
              if (op.event === undefined) throw new Error(`${op.op} ${op.name} must have an "event" attribute`)
              if (op.responseEvent !== undefined) {
                this.codeSnippets.properties[op.op] += `thing.setPropertyObserveHandler('${op.name}', async (inputData, options) => {
                  const responsePromise = once(responseHandlerEmitter, "${op.responseEvent}")
                  service.send({type: '${op.event}', data: { payload: await inputData.value(), uriVariables: options?.uriVariables }} as any)
                  const [data] = await responsePromise
                  return data
                })
                `
              } else {
                this.codeSnippets.properties[op.op] += `thing.setPropertyObserveHandler('${op.name}', async (inputData, options) => {
                  service.send({type: '${op.event}', data: { payload: await inputData.value(), uriVariables: options?.uriVariables }} as any)
                  return
                })
                `
              }
              break
            case 'unobserveproperty':
              if (op.event === undefined) throw new Error(`${op.op} ${op.name} must have an "event" attribute`)
              if (op.responseEvent !== undefined) {
                this.codeSnippets.properties[op.op] += `thing.setPropertyUnobserveHandler('${op.name}', async (inputData, options) => {
                  const responsePromise = once(responseHandlerEmitter, "${op.responseEvent}")
                  service.send({type: '${op.event}', data: { payload: await inputData.value(), uriVariables: options?.uriVariables }} as any)
                  const [data] = await responsePromise
                  return data
                })
                `
              } else {
                this.codeSnippets.properties[op.op] += `thing.setPropertyUnobserveHandler('${op.name}', async (inputData, options) => {
                  service.send({type: '${op.event}', data: { payload: await inputData.value(), uriVariables: options?.uriVariables }} as any)
                  return
                })
                `
              }
              break
            default:
              break
          }
          break
        case 'action':
          if (op.event === undefined) throw new Error(`${op.op} ${op.name} must have an "event" attribute`)
          switch (op.op) {
            case 'invokeaction':
              this.codeSnippets.actions[op.op] += `thing.setActionHandler('${op.name}', async (inputData, options) => {`
              if (op.availableIn.length > 0) this.codeSnippets.actions[op.op] += this.generateStateCheckCode(op)
              if (op.affordanceObject.synchronous !== undefined && op.affordanceObject.synchronous === false) {
                this.codeSnippets.actions[op.op] += `service.send({type: '${op.event}'
                `
                if (op.affordanceObject?.data !== undefined || op.affordanceObject?.uriVariables !== undefined) {
                  this.codeSnippets.actions[op.op] += ', data: { '
                  if (op.affordanceObject?.data !== undefined) this.codeSnippets.actions[op.op] += 'payload: await inputData.value(),'
                  if (op.affordanceObject?.uriVariables !== undefined) this.codeSnippets.actions[op.op] += 'uriVariables: options?.uriVariables,'
                  this.codeSnippets.actions[op.op] += '}'
                }
                this.codeSnippets.actions[op.op] += `} as any)
                return undefined
                `
              } else {
                if (op.responseEvent === undefined) throw new Error(`invokeaction ${op.name} is sync but no response event was found!`)
                this.codeSnippets.actions[op.op] += `
                const responsePromise = once(responseHandlerEmitter, "${op.responseEvent}")
                service.send({type: '${op.event}'
                `
                if (op.affordanceObject?.data !== undefined || op.affordanceObject?.uriVariables !== undefined) {
                  this.codeSnippets.actions[op.op] += ', data: { '
                  if (op.affordanceObject?.data !== undefined) this.codeSnippets.actions[op.op] += 'payload: await inputData.value(),'
                  if (op.affordanceObject?.uriVariables !== undefined) this.codeSnippets.actions[op.op] += 'uriVariables: options?.uriVariables,'
                  this.codeSnippets.actions[op.op] += '}'
                }
                this.codeSnippets.actions[op.op] += `} as any)
                const [data] = await responsePromise
                return data
                `
              }
              if (op.availableIn.length > 0) this.codeSnippets.actions[op.op] += '}'
              this.codeSnippets.actions[op.op] += '})\n'
              break
            default:
              break
          }
          break
        case 'event':
          if (op.event === undefined) throw new Error(`${op.op} ${op.name} must have an "event" attribute`)
          switch (op.op) {
            case 'subscribeevent':
              if (op.responseEvent !== undefined) {
                this.codeSnippets.events[op.op] += `thing.setEventSubscribeHandler('${op.name}', async (inputData, options) => {
                  const responsePromise = once(responseHandlerEmitter, "${op.responseEvent}")
                  service.send({type: '${op.event}', data: { payload: await inputData.value(), uriVariables: options?.uriVariables }} as any)
                  const [data] = await responsePromise
                  return data
                })
                `
              } else {
                this.codeSnippets.events[op.op] += `thing.setEventSubscribeHandler('${op.name}', async (inputData, options) => {
                  service.send({type: '${op.event}', data: { payload: await inputData.value(), uriVariables: options?.uriVariables }} as any)
                  return
                })
                `
              }
              break
            case 'unsubscribeevent':
              if (op.responseEvent !== undefined) {
                this.codeSnippets.events[op.op] += `thing.setEventUnsubscribeHandler('${op.name}', async (inputData, options) => {
                  const responsePromise = once(responseHandlerEmitter, "${op.responseEvent}")
                  service.send({type: '${op.event}', data: { payload: await inputData.value(), uriVariables: options?.uriVariables }} as any)
                  const [data] = await responsePromise
                  return data
                })
                `
              } else {
                this.codeSnippets.events[op.op] += `thing.setEventUnsubscribeHandler('${op.name}', async (inputData, options) => {
                  service.send({type: '${op.event}', data: { payload: await inputData.value(), uriVariables: options?.uriVariables }} as any)
                  return
                })
                `
              }
              break

            default:
              break
          }
          break
        default:
          break
      }
    }
  }

  // TODO write this code
  protected generateStateCheckCode (op: InternalOperationRepresentation): string {
    let resultString = ''
    resultString += 'const currentState = service.getSnapshot()\n'
    const absoluteStates = op.availableIn.map((state) => `"${state}"`)
    resultString += `if(![${absoluteStates.toString()}].some(currentState.matches)) {
        throw new Error("${op.op} ${op.name} is not accessible in current state")
      } else {`
    return resultString
  }

  protected addMachineStateSchemaAndHandler (): void {
    if (this.protoTD.properties === undefined) this.protoTD.properties = {}
    this.protoTD.properties.state = {
      type: 'object',
      readOnly: true
    }

    this.codeSnippets.properties.readproperty += 'thing.setPropertyReadHandler("state", async () => service.getSnapshot().toJSON())\n'
  }

  protected preproccesModelNodes (scxml: Node): void {
    const scxmlDoc = scxml.ownerDocument !== null ? scxml.ownerDocument : scxml as Document
    const modelElements = select('//wot:model', scxml) as Element[]
    // Model elements are always in <onentry>
    for (const modelElement of modelElements) {
      const modelVariables = {
        parameters: {} satisfies Record<string, string | undefined>,
        inputs: {} satisfies Record<string, string | undefined>,
        outputs: {} satisfies Record<string, string | undefined>
      }
      const modelId = modelElement.getAttribute('id')
      if (modelId == null) throw new Error('Model does not have an "id"')
      this.simModelIds.push(modelId)

      let modelServer = modelElement.getAttribute('server')
      if (modelServer == null) throw new Error('Model does not specify simulation server "server"')
      modelServer = modelServer.trim()
      if (!modelServer.startsWith('ws')) modelServer = 'ws://' + modelServer
      if (!this.simulationTargets.includes(modelServer)) this.simulationTargets.push(modelServer)

      // get <onentry>
      const onentryNode = modelElement.parentNode as Element
      if (onentryNode?.tagName !== 'onentry') throw new Error('Model immediate parent must be <onentry>')
      // get <state> or <parallel>
      const stateNode = onentryNode?.parentNode as Element
      if (stateNode?.tagName !== 'state' && stateNode?.tagName !== 'parallel') throw new Error('Model second parent must be <state> or <parallel>')
      const stateNodeId = stateNode.getAttribute('id')
      if (stateNodeId === null) throw new Error('Model second parent must have an id')

      // const modelContent = select('./content', modelElement, true) as Element
      let modelContent = null
      const variableElements: Element[] = []
      for (let i = 0; i < modelElement.childNodes.length; i++) {
        const child = modelElement.childNodes[i]
        if (child.nodeType === child.ELEMENT_NODE && (child as Element).tagName === 'content') modelContent = child

        if (child.nodeType === child.ELEMENT_NODE && (child as Element).tagName === 'variable') variableElements.push(child as Element)
      }
      if (modelContent === null || modelContent === undefined) throw new Error(`Model '${modelId}' must have <content> with modelica model as string`)
      let modelicaString = modelContent.textContent
      if (modelicaString === null || modelicaString === undefined) throw new Error(`Model '${modelId}' must have <content> with modelica model as string`)
      const whiteSpaceExtractRegex = /\s*\n(\s*)model\s+(\w+)\n/m
      const whiteSpace = modelicaString.match(whiteSpaceExtractRegex)?.[1]
      if (whiteSpace !== undefined) {
        const whiteSpaceRegex = new RegExp(whiteSpace, 'mg')
        modelicaString = modelicaString.replace(whiteSpaceRegex, '')
      }
      modelicaString = modelicaString.trim()

      if (!fs.existsSync('models') || !fs.lstatSync('models').isDirectory()) fs.mkdirSync(path.join('models'))
      fs.writeFileSync(path.join('models', `${modelId}.mo`), modelicaString)

      // *------------------------------------- Parsing Modelica Model --------------------------------------*/

      const modelNameRegex = /\s*model\s+(\w+)/m
      const regArray = modelNameRegex.exec(modelicaString)
      if (regArray === null) throw new Error(`Model '${modelId}' does not have an ASCII name in string`)
      const modelName = regArray[1]

      // Get Parameters
      const parametersRegex = /parameter\s+(?:Real|Integer|String|Enum)\s+(\w+)/mg
      let matches = modelicaString.matchAll(parametersRegex)
      for (const match of matches) {
        (modelVariables.parameters as Record<string, string | undefined>)[match[1]] = undefined
      }

      // Get Inputs
      const inputsRegex = /input\s+(?:Real|Integer|String|Enum)\s+(\w+)/mg
      matches = modelicaString.matchAll(inputsRegex)
      for (const match of matches) {
        (modelVariables.inputs as Record<string, string | undefined>)[match[1]] = undefined
      }

      // Get Outputs
      const outputsRegex = /output\s+(?:Real|Integer|String|Enum)\s+(\w+)/mg
      matches = modelicaString.matchAll(outputsRegex)
      for (const match of matches) {
        (modelVariables.outputs as Record<string, string | undefined>)[match[1]] = undefined
      }

      for (let i = 0; i < variableElements.length; i++) {
        const variable = variableElements[i]

        const variableName = variable.getAttribute('name')
        if (variableName === null) throw new Error(`Variable in model ${modelId} does not have a name`)

        const variableLocation = variable.getAttribute('location')
        if (variableLocation === null) throw new Error(`Variable in model ${modelId} does not have a Location`)

        if (Object.keys(modelVariables.parameters).includes(variableName)) (modelVariables.parameters as Record<string, string | undefined>)[variableName] = variableLocation
        else if (Object.keys(modelVariables.inputs).includes(variableName)) (modelVariables.inputs as Record<string, string | undefined>)[variableName] = variableLocation
        else if (Object.keys(modelVariables.outputs).includes(variableName)) (modelVariables.outputs as Record<string, string | undefined>)[variableName] = variableLocation
        else throw new Error(`Model ${modelId} does not include variable with name ${variableName}`)
      }

      const unsetVariables = []
      for (const variableName in modelVariables.parameters) {
        if ((modelVariables.parameters as Record<string, string | undefined>)[variableName] === undefined) unsetVariables.push(variableName)
      }

      for (const variableName in modelVariables.inputs) {
        if ((modelVariables.inputs as Record<string, string | undefined>)[variableName] === undefined) unsetVariables.push(variableName)
      }

      for (const variableName in modelVariables.outputs) {
        if ((modelVariables.outputs as Record<string, string | undefined>)[variableName] === undefined) unsetVariables.push(variableName)
      }

      if (unsetVariables.length > 0) throw new Error(`Error in model ${modelId}: locations of variables ${JSON.stringify(unsetVariables)} was not defined`)

      // *------------------------------------ Creating Simulation States -------------------------------------*/

      // *-------------------------------------------- Entry State --------------------------------------------*/
      const modelEntryState = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'state')
      modelEntryState.setAttribute('id', `_${stateNodeId}_modelEntry`)
      stateNode.setAttribute('initial', `_${stateNodeId}_modelEntry`)
      stateNode.appendChild(modelEntryState)

      // Create on entry
      const startOnEntry = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'onentry')
      modelEntryState.appendChild(startOnEntry)

      // Create start send
      const startSend = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'send')
      startSend.setAttribute('type', 'WoTSimProcessor')
      startSend.setAttribute('target', modelServer)
      const startParamSimID = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'param')
      startParamSimID.setAttribute('name', 'simId')
      startParamSimID.setAttribute('expr', `"${modelName}"`)
      startSend.appendChild(startParamSimID)
      const startParamMsgType = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'param')
      startParamMsgType.setAttribute('name', 'messageType')
      startParamMsgType.setAttribute('expr', '"reset"')
      startSend.appendChild(startParamMsgType)
      const startParamStepSize = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'param')
      startParamStepSize.setAttribute('name', 'stepSize')
      startParamStepSize.setAttribute('expr', 'delayToS(_stepSize)')
      startSend.appendChild(startParamStepSize)

      if (Object.keys(modelVariables.parameters).length > 0) {
        const startParamParameters = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'param')
        startParamParameters.setAttribute('name', 'parameters')
        let dataString = '{'
        for (const parameter in modelVariables.parameters) {
          dataString += `"${parameter}": ${(modelVariables.parameters as Record<string, string>)[parameter]},`
        }
        dataString = dataString.slice(0, -1)
        dataString += '}'
        startParamParameters.setAttribute('expr', dataString)
        startSend.appendChild(startParamParameters)
      }

      if (Object.keys(modelVariables.inputs).length > 0) {
        const startParamInputs = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'param')
        startParamInputs.setAttribute('name', 'parameters')
        let dataString = '{'
        for (const parameter in modelVariables.inputs) {
          dataString += `"${parameter}": ${(modelVariables.inputs as Record<string, string>)[parameter]},`
        }
        dataString = dataString.slice(0, -1)
        dataString += '}'
        startParamInputs.setAttribute('expr', dataString)
        startSend.appendChild(startParamInputs)
      }
      startOnEntry.appendChild(startSend)

      // Create transtion
      const startToPreTick = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'transition')
      startToPreTick.setAttribute('target', `_${stateNodeId}_modelPreTick`)
      startToPreTick.setAttribute('event', `_sim_${modelName}.response`)
      modelEntryState.appendChild(startToPreTick)

      // *------------------------------------------ Pre Tick State ------------------------------------------*/
      const modelPreTickState = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'state')
      modelPreTickState.setAttribute('id', `_${stateNodeId}_modelPreTick`)
      stateNode.appendChild(modelPreTickState)

      const preTickOnEntry = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'onentry')
      modelPreTickState.appendChild(preTickOnEntry)
      // Create Assign
      for (const output in modelVariables.outputs) {
        const startToPreTickAssign = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'assign')
        startToPreTickAssign.setAttribute('location', (modelVariables.outputs as Record<string, string>)[output])
        startToPreTickAssign.setAttribute('expr', `event.data.outputs["${output}"]`)
        preTickOnEntry.appendChild(startToPreTickAssign)
      }
      // Create Response Received true Assign
      const startToPreTickAssign = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'assign')
      startToPreTickAssign.setAttribute('location', `_${modelId}_responseReceived`)
      startToPreTickAssign.setAttribute('expr', 'true')
      preTickOnEntry.appendChild(startToPreTickAssign)

      // Create transition
      const tickTransition = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'transition')
      tickTransition.setAttribute('event', 'simulationStep')
      tickTransition.setAttribute('target', `_${stateNodeId}_modelTickResponse`)
      modelPreTickState.appendChild(tickTransition)

      // Create transition send
      const tickTransitionSend = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'send')
      tickTransition.appendChild(tickTransitionSend)
      tickTransitionSend.setAttribute('type', 'WoTSimProcessor')
      tickTransitionSend.setAttribute('target', modelServer)
      const tickParamSimID = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'param')
      tickParamSimID.setAttribute('name', 'simId')
      tickParamSimID.setAttribute('expr', `"${modelName}"`)
      tickTransitionSend.appendChild(tickParamSimID)
      const tickParamMsgType = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'param')
      tickParamMsgType.setAttribute('name', 'messageType')
      tickParamMsgType.setAttribute('expr', '"step"')
      tickTransitionSend.appendChild(tickParamMsgType)

      if (Object.keys(modelVariables.inputs).length > 0) {
        const tickParamInputs = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'param')
        tickParamInputs.setAttribute('name', 'parameters')
        let dataString = '{'
        for (const parameter in modelVariables.inputs) {
          dataString += `"${parameter}": ${(modelVariables.inputs as Record<string, string>)[parameter]},`
        }
        dataString = dataString.slice(0, -1)
        dataString += '}'
        tickParamInputs.setAttribute('expr', dataString)
      }

      // *------------------------------------------ Tick Response ------------------------------------------*/
      const modelTickResponseState = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'state')
      modelTickResponseState.setAttribute('id', `_${stateNodeId}_modelTickResponse`)
      stateNode.appendChild(modelTickResponseState)

      // Create transition
      const responseTransition = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'transition')
      responseTransition.setAttributeNS('http://www.w3.org/2005/07/scxml', 'event', `_sim_${modelName}.response`)
      responseTransition.setAttributeNS('http://www.w3.org/2005/07/scxml', 'target', `_${stateNodeId}_modelPreTick`)
      modelTickResponseState.appendChild(responseTransition)

      // On Entry
      const tickResponseEntry = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'onentry')
      modelTickResponseState.appendChild(tickResponseEntry)

      // Create Response Received true Assign
      const tickResponseAssign = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'assign')
      tickResponseAssign.setAttribute('location', `_${modelId}_responseReceived`)
      tickResponseAssign.setAttribute('expr', 'false')
      tickResponseEntry.appendChild(tickResponseAssign)

      // *----------------------------------------- Response Received Flag -----------------------------------*/
      // add in response received flag
      const dataModelElement = select('//scxml:datamodel', scxml, true) as Element
      const responseReceivedDataElement = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'data')
      responseReceivedDataElement.setAttribute('id', `_${modelId}_responseReceived`)
      responseReceivedDataElement.setAttribute('expr', 'false')
      dataModelElement.appendChild(responseReceivedDataElement)
    }

    // *------------------------------------------ Simulation Clock ------------------------------------------*/
    if (modelElements.length > 0) {
      const topParallelState = this.addParallelWotWrapper(scxml)
      const clockState = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'state')
      topParallelState.appendChild(clockState)
      clockState.setAttribute('id', '_simulationClock')
      clockState.setAttribute('initial', '_clock_preTick')

      // *------------------------------------------ Pre Tick ------------------------------------------*/
      const clockPreTickState = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'state')
      clockState.appendChild(clockPreTickState)
      clockPreTickState.setAttribute('id', '_clock_preTick')
      // On Entry
      const clockPreTickEntry = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'onentry')
      clockPreTickState.appendChild(clockPreTickEntry)

      // On Entry Send
      const clockPreTickEntrySend = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'send')
      clockPreTickEntrySend.setAttribute('delayExpr', '_stepSize')
      clockPreTickEntrySend.setAttribute('event', 'simulationStep')
      clockPreTickEntry.appendChild(clockPreTickEntrySend)

      // Transition
      const clockPreTickTransition = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'transition')
      clockPreTickTransition.setAttribute('target', '_clock_postTick')
      clockPreTickTransition.setAttribute('event', 'simulationStep')
      clockPreTickState.appendChild(clockPreTickTransition)

      // *------------------------------------------ Post Tick ------------------------------------------*/
      const clockPostTickState = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'state')
      clockState.appendChild(clockPostTickState)
      clockPostTickState.setAttribute('id', '_clock_postTick')

      // Transition
      const clockPostTickTransition = scxmlDoc.createElementNS('http://www.w3.org/2005/07/scxml', 'transition')
      clockPostTickTransition.setAttribute('target', '_clock_preTick')
      clockPostTickTransition.setAttribute('cond', '"clockCond"')
      clockPostTickState.appendChild(clockPostTickTransition)
      if (this.XStateMachineOptions.guards === undefined) this.XStateMachineOptions.guards = {} satisfies Record<string, string>
      this.variableMap.clockCond = `(context: any, event: any, { cond, _event }) => { 
        const stateString = JSON.stringify(service.getSnapshot().value)
        const reg = /_modelTickResponse/
        return !reg.test(stateString)
      }
      `
      this.XStateMachineOptions.guards.clockCond = '{{clockCond}}' as any
      clockPostTickState.appendChild(clockPostTickTransition)
    }
  }
}

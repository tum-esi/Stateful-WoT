/** =======================================================================================================================
 * ?                                                     ABOUT
 * @author         :  Fady Salama
 * @email          :  fady.salama@tum.de
 * @repo           :  -
 * @createdOn      :  12.01.2023
 * @description    :  API for converting SCXML files to XState Source Code
 *=======================================================================================================================**/

import { MachineConfig, InternalMachineOptions, actions } from 'xstate'
import fetch from 'node-fetch'
import template from 'string-placeholder'
import xpath from 'xpath'
import { DOMParser } from '@xmldom/xmldom'
import toSource from 'tosource'
import AbstractSyntaxTree from 'abstract-syntax-tree'
import prettier from 'prettier'

const { choose } = actions

export const NORMAL_STATE_GENERIC_ID_PREFIX = 'b_'
export const PARALLEL_STATE_GENERIC_ID_PREFIX = 'pb_'
export const FINAL_STATE_GENERIC_ID_PREFIX = 'fb_'
export const HIST_STATE_GENERIC_ID_PREFIX = 'hist_'
export const COND_PREFIX = 'cond_'
// const TRANS_ACT_PREFIX = 'transAct_'
// const ON_ENTRY_ACTION_PREFIX = 'onEntryAct_'
// const ON_EXIT_ACTION_PREFIX = 'onExitAct_'
export const ASSIGN_PREFIX = 'assign_'
export const CANCEL_PREFIX = 'cancel_'
export const LOG_PREFIX = 'log_'
export const PARAM_PREFIX = 'param_'
export const PARAM_OBJECT_PREFIX = 'param_obj_'
export const SCRIPT_PREFIX = 'script_'
export const SEND_PREFIX = 'send_'
export const SEND_IDEXPR_PREFIX = 'send_id'
export const SEND_DELAYEXPR_PREFIX = 'send_delayexpr_'
export const SEND_TARGETEXPR_PREFIX = 'send_targetexpr_'
export const MACHINE_SERVICE_PREFIX = 'machine_'
export const SPAWN_ENTRY_PREFIX = 'spawn_ent'
export const SPAWN_EXIT_PREFIX = 'spawn_ext'

const select = xpath.useNamespaces({ scxml: 'http://www.w3.org/2005/07/scxml' })

export function delayToMs (delay: string | number): number {
  if (typeof delay === 'number') {
    return delay
  }

  const millisecondsMatch = delay.match(/(\d+)\s*ms/)
  if (millisecondsMatch !== null) {
    return parseInt(millisecondsMatch[1], 10)
  }

  const secondsMatch = delay.match(/((\d+)|(\d*)(\.?)(\d+))\s*s/)

  if (secondsMatch !== null) {
    const hasDecimal = secondsMatch[4] !== undefined
    if (!hasDecimal) {
      return parseInt(secondsMatch[2], 10) * 1000
    }

    const secondsPart = !(secondsMatch[3] !== undefined)
      ? parseInt(secondsMatch[3], 10) * 1000
      : 0

    let millisecondsPart = parseFloat(`0.${secondsMatch[5]}`) * 1000
    millisecondsPart = Math.floor(millisecondsPart)

    if (millisecondsPart >= 1000) {
      throw new Error(`Can't parse "${delay} delay."`)
    }

    return secondsPart + millisecondsPart
  }

  throw new Error(`Can't parse "${delay} delay."`)
}

/**
 * A class that provides the SCXML parsing abilities. Should be instantiated each time we parse a different SCXML document or node
 * @example ```ts
 * const wrapper = async (): Promise<void> => {
 *    const parser = new SCXML2XStateCodeParser()
 *    const code = await parser.generateXStateCode(smSCXML)
 * }
 * ```
 */
export class SCXML2XStateCodeParser {
  /** ------------------------------------------------------------------------------------------------
     *                                 Member Variable Declarations
     *------------------------------------------------------------------------------------------------**/

  /* ================================ Counters ============================== */

  /** */
  protected NORMAL_STATE_GENERIC_COUNTER: number
  protected PARALLEL_STATE_GENERIC_COUNTER: number
  protected FINAL_STATE_GENERIC_COUNTER: number
  protected HIST_STATE_GENERIC_COUNTER: number
  protected COND_COUNTER: number
  protected ASSIGN_COUNTER: number
  protected CANCEL_COUNTER: number
  protected LOG_COUNTER: number
  protected PARAM_COUNTER: number
  protected PARAM_OBJECT_COUNTER: number
  protected SCRIPT_COUNTER: number
  protected SEND_COUNTER: number
  protected SEND_IDEXPR_COUNTER: number
  protected SEND_DELAYEXPR_COUNTER: number
  protected SEND_TARGETEXPR_COUNTER: number
  protected MACHINE_SERVICE_COUNTER: number
  protected SPAWN_COUNTER: number

  /* ================================ Parser Storage ============================== */
  /**
   * SCXML Node
   */
  protected scxmlNode: Node | undefined

  /**
   * Generated XState Machine Code with placeholders
   */
  protected intermediaryXStateMachineFactoryCode: string | undefined
  /**
   * Generated XState Machine Code without placeholders
   */
  protected finalXStateMachineFactoryCode: string | undefined
  /**
   * Final XState Code
   */
  protected finalXStateCode: string | undefined
  /**
   * Placeholder mapping. Placeholders all have the form `"{{PLACEHOLDER}}"`
   */
  protected variableMap: Record<string, any> = {}

  /**
   * XState Machine Config
   */
  protected readonly XStateMachineConfig: MachineConfig<any, any, any> = {}
  /**
   * XState Machine Options
   */
  protected readonly XStateMachineOptions: InternalMachineOptions<any, any, any> = {
    actions: {},
    guards: {},
    delays: {},
    services: {}
  }

  protected childMachines: string

  protected readonly fetch: (url: string) => Promise<unknown>

  /**
   * @param fetcher a function that accepts a URL as a string and returns a Promise that resolves with the fetched resource. If not specified a normal HTTP fetcher is used
   */
  constructor (fetcher: (url: string) => Promise<unknown> = fetch) {
    this.NORMAL_STATE_GENERIC_COUNTER = 0
    this.PARALLEL_STATE_GENERIC_COUNTER = 0
    this.FINAL_STATE_GENERIC_COUNTER = 0
    this.HIST_STATE_GENERIC_COUNTER = 0
    this.COND_COUNTER = 0
    this.ASSIGN_COUNTER = 0
    this.CANCEL_COUNTER = 0
    this.LOG_COUNTER = 0
    this.PARAM_COUNTER = 0
    this.PARAM_OBJECT_COUNTER = 0
    this.SEND_COUNTER = 0
    this.SEND_IDEXPR_COUNTER = 0
    this.SEND_DELAYEXPR_COUNTER = 0
    this.SEND_TARGETEXPR_COUNTER = 0
    this.SCRIPT_COUNTER = 0
    this.MACHINE_SERVICE_COUNTER = 0
    this.SPAWN_COUNTER = 0
    this.fetch = fetcher
    this.childMachines = ''
  }

  /**
   * A method for converting SCXML document to XState format
   * @param scxml SCXML top node as XML Node or string
   * @param machineID The ID for the state machine
   * @returns a Promise that evalutes to a XState Code
   */
  public async generateXStateCode (scxml: string | Node, machineID?: string): Promise<string> {
    // Generate code of the main machine
    const mainMachineCode = await this.generateXStateMachineFactory(scxml)
    // Final XState Code string
    this.finalXStateCode =
      `import { createMachine, interpret, actions, spawn, AnyStateMachine, sendParent } from 'xstate';
const { choose, log, assign, raise, send, cancel, start, stop} = actions

/*======================================================= Utility functions =======================================================*/

function delayToMs (delay: string | number): number {
  if (typeof delay === 'number') {
    return delay
  }

  const millisecondsMatch = delay.match(/(\\d+)\\s*ms/)
  if (millisecondsMatch !== null) {
    return parseInt(millisecondsMatch[1], 10)
  }

  const secondsMatch = delay.match(/((\\d+)|(\\d*)(\\.?)(\\d+))\\s*s/)

  if (secondsMatch !== null) {
    const hasDecimal = secondsMatch[4] !== undefined
    if (!hasDecimal) {
      return parseInt(secondsMatch[2], 10) * 1000
    }

    const secondsPart = !(secondsMatch[3] !== undefined)
      ? parseInt(secondsMatch[3], 10) * 1000
      : 0

    let millisecondsPart = parseFloat(\`0.\${secondsMatch[5]}\`) * 1000
    millisecondsPart = Math.floor(millisecondsPart)

    if (millisecondsPart >= 1000) {
      throw new Error(\`Can't parse "\${delay} delay."\`)
    }

    return secondsPart + millisecondsPart
  }

  throw new Error(\`Can't parse "\${delay} delay."\`)
}

function delayToS(delay: string | number): number {
  const ms = delayToMs(delay)
  return ms/1000
}

function InvokedMachineFactory(
  machine: AnyStateMachine,
  initContext: any
): AnyStateMachine {
  return machine.withContext(initContext);
}

/*======================================================= Child Machines =======================================================*/

${this.childMachines}

/*======================================================= Main Machine =======================================================*/
const ${machineID ?? this.XStateMachineConfig.id ?? 'machine'} = ${mainMachineCode}
`
    // Prettifying code
    this.finalXStateCode = prettier.format(this.finalXStateCode, { parser: 'typescript' })
    return this.finalXStateCode
  }

  /**
   * A method for generating an XState Machine from a SCXML Node
   * @param scxml {string | Node} SCXML top node as XML Node or string
   * @returns a Promise that evalutes to a XState Machine Code
   */
  public async generateXStateMachineFactory (scxml: string | Node): Promise<string> {
    // parse SCXML Node
    await this.parseSCXML(scxml)

    // Store parsed code in intermediaryXStateMachineFactoryCode, add XStateMachineConfig and XStateMachineOptions as strings with placeholders
    this.intermediaryXStateMachineFactoryCode =
      `createMachine(
    ${toSource(this.XStateMachineConfig)},
    ${toSource(this.XStateMachineOptions)}
)
`
    // Keep replacing placeholders until no placeholder is present. This needs to be done because of recusive placeholders.
    // ! Potential infinite loop if placeholders cannot be replaced correctly
    this.finalXStateMachineFactoryCode = template(this.intermediaryXStateMachineFactoryCode, this.variableMap, { before: '"{{', after: '}}"' })

    do {
      this.finalXStateMachineFactoryCode = template(this.finalXStateMachineFactoryCode, this.variableMap, { before: '"{{', after: '}}"' })
    } while (this.finalXStateMachineFactoryCode.includes('"{{'))

    return this.finalXStateMachineFactoryCode
  }

  /**
   * Parses an SCXML Node or string and stores the generated machine configurations and placeholders in {@link SCXML2XStateCodeParser.XStateMachineConfig}, {@link SCXML2XStateCodeParser.XStateMachineOptions}, {@link SCXML2XStateCodeParser.variableMap} respectively
   * @param scxml The SCXML Node or string that should be parsed
   */
  protected async parseSCXML (scxml: string | Node): Promise<void> {
    let scxmlDOM, scxmlXPath
    // Check if string -> use XML DOM parser
    if (typeof scxml === 'string') {
      scxmlDOM = (new DOMParser()).parseFromString(scxml, 'application/scxml+xml')
      scxmlXPath = select('/scxml:scxml', scxmlDOM, true)
    // Otherwise Node is ready
    } else {
      if (scxml.nodeName !== 'scxml') throw new Error('Can only parse SCXML node')
      scxmlXPath = scxml
    }

    this.scxmlNode = scxmlXPath as unknown as Node

    // Get SCXML name
    const nameAttr = select('./@name', this.scxmlNode, true) as Attr | undefined
    if (nameAttr?.value !== undefined) this.XStateMachineConfig.id = nameAttr.value

    // Get Initial if available
    const initialAttr = select('./@initial', this.scxmlNode, true) as Attr | undefined
    this.XStateMachineConfig.initial = initialAttr?.value !== undefined ? initialAttr.value : undefined

    // find initial if otherwise not stated
    if (this.XStateMachineConfig.initial === undefined) {
      for (let i = 0; i < this.scxmlNode.childNodes.length; i++) {
        const node = this.scxmlNode.childNodes[i]
        // Find first node that is of type state, parallel or final
        if (node.nodeType === node.ELEMENT_NODE && (node.nodeName === 'state' || node.nodeName === 'parallel' || node.nodeName === 'final')) {
          // Check if it has an ID
          const tempIdAttr = select('./@id', node, true) as Attr | undefined
          // If no id is not found, find next applicable node
          if (tempIdAttr == null) continue
          // If id is found, add it to xstate
          this.XStateMachineConfig.initial = tempIdAttr.value; break
        }
      }
      if (this.XStateMachineConfig.initial === undefined) throw Error('<scxml> node does not contain a <state>, <parallel> or <final> element with an ID that can be considered as initial state!')
    }

    // Process Element Child Nodes
    for (let i = 0; i < this.scxmlNode.childNodes.length; i++) {
      const childNode = this.scxmlNode.childNodes[i]
      // Node must be of type Element
      if (childNode.nodeType === childNode.ELEMENT_NODE) {
        switch (childNode.nodeName) {
          case 'state':
            if (this.XStateMachineConfig.states === undefined) this.XStateMachineConfig.states = {}
            await this.addNormalState(childNode, this.XStateMachineConfig.states)
            break

          case 'parallel':
            if (this.XStateMachineConfig.states === undefined) this.XStateMachineConfig.states = {}
            await this.addParallelState(childNode, this.XStateMachineConfig.states)
            break

          case 'final':
            if (this.XStateMachineConfig.states === undefined) this.XStateMachineConfig.states = {}
            await this.addFinalState(childNode, this.XStateMachineConfig.states)
            break

          case 'datamodel':
            this.addDataModel(childNode)
            break

          default:
            break
        }
      }
    }
  }

  public getContext (): Record<string, any> {
    return this.XStateMachineConfig.context
  }

  /** =======================================================================================================================
     *                                                 Handling Core Constructs
     *=======================================================================================================================**/

  /**
   * Adds a normal state in parent state object
   * @param childStateNode The state node to add
   * @param parentNodeStatesObj The `states` object to add the child state into
   */
  protected async addNormalState (childStateNode: Node, parentNodeStatesObj: any): Promise<void> {
    // Check if it has an ID
    const tempIdAttr = select('./@id', childStateNode, true) as Attr | undefined
    let id: string
    if (tempIdAttr?.value !== undefined) id = tempIdAttr.value; else { id = `${NORMAL_STATE_GENERIC_ID_PREFIX}${this.NORMAL_STATE_GENERIC_COUNTER}`; this.NORMAL_STATE_GENERIC_COUNTER++ }
    parentNodeStatesObj[id] = { id }
    // Get initial state
    this.getInitialState(childStateNode, parentNodeStatesObj[id])

    // Process Element Child Nodes
    await this.addStateChildren(childStateNode, id, parentNodeStatesObj[id])
  }

  /**
   * Adds a parallel state in parent state object
   * @param childStateNode The state node to add
   * @param parentNodeStatesObj The `states` object to add the child state into
   */
  protected async addParallelState (childParallelNode: Node, parentNodeStatesObj: any): Promise<void> {
    // Check if it has an ID
    const tempIdAttr = select('./@id', childParallelNode, true) as Attr | undefined
    let id
    if (tempIdAttr?.value !== undefined) id = tempIdAttr.value; else { id = `${PARALLEL_STATE_GENERIC_ID_PREFIX}${this.PARALLEL_STATE_GENERIC_COUNTER}`; this.PARALLEL_STATE_GENERIC_COUNTER++ }
    parentNodeStatesObj[id] = { id, type: 'parallel' }

    // Process Element Child Nodes
    await this.addStateChildren(childParallelNode, id, parentNodeStatesObj[id])
  }

  /**
   * Adds a transition parent object
   * @param transitionNode The state node to add
   * @param parentNodeObj The object to add the transition into
   */
  protected async addTransition (transitionNode: Node, parentNodeObj: any): Promise<void> {
    // Get event if available
    const eventAttr = select('./@event', transitionNode, true) as Attr | undefined
    const eventName = eventAttr?.value !== undefined ? eventAttr.value : undefined

    // Get cond if available
    const condAttr = select('./@cond', transitionNode, true) as Attr | undefined
    let cond
    if (condAttr?.value !== undefined && condAttr.value === '"clockCond"') cond = { type: JSON.parse(condAttr.value) }
    else cond = condAttr?.value !== undefined ? this.conditionParser(condAttr.value) : undefined

    // Get target if available
    const targetAttr = select('./@target', transitionNode, true) as Attr | undefined
    const target = targetAttr?.value !== undefined ? targetAttr.value : undefined

    // Get type if available
    const typeAttr = select('./@type', transitionNode, true) as Attr | undefined
    const type = typeAttr?.value !== undefined ? typeAttr.value : 'external'
    const internal = type === 'internal'

    // check if transition is eventless
    const isEventless = eventName === undefined

    const transitionObject: { target?: string, internal?: boolean, cond?: any, in?: any, actions?: any } = {}
    // add `target` if available
    if (target !== undefined) transitionObject.target = `#${target}`
    // add internal if true
    if (internal) transitionObject.internal = internal
    // add condition if available
    if (cond?.type !== undefined) {
      transitionObject.cond = cond.type
    }
    // add in if available
    if (cond?.in !== undefined) { transitionObject.in = cond?.in }

    // Add child executable content
    for (let i = 0; i < transitionNode.childNodes.length; i++) {
      const childNode = transitionNode.childNodes[i]
      if (childNode.nodeType === childNode.ELEMENT_NODE) {
        transitionObject.actions = []
        await this.addExecutableContent(transitionNode, transitionObject.actions)
      }
    }

    // If transition is eventless, add it to `always` array
    if (isEventless) {
      // add to 'always' object in parent
      if (parentNodeObj.always === undefined) parentNodeObj.always = []
      parentNodeObj.always.push(transitionObject)
    // Otherwise add it to `on` array
    } else {
      // add to 'on' object in parent
      if (eventName === undefined) throw new Error('Event should have name')
      if (parentNodeObj.on === undefined) parentNodeObj.on = {}

      // If there is no transition with event name, just assign it the transitionObj
      if (parentNodeObj.on[eventName] === undefined) {
        parentNodeObj.on[eventName] = transitionObject
      } else {
        // If there is a transition with event name, we need to make sure we have an array
        if (Array.isArray(parentNodeObj.on[eventName])) {
          parentNodeObj.on[eventName].push(transitionObject)
        } else {
          parentNodeObj.on[eventName] = [parentNodeObj.on[eventName], transitionObject]
        }
      }
    }
  }

  /**
   * Finds the initial state inside a compound state
   * @param stateNode compound state node
   * @param NodeObj compound state object
   */
  protected getInitialState (stateNode: Node, NodeObj: any): void {
    // Get Initial if available
    const initialAttr = select('./@initial', stateNode, true) as Attr | undefined
    NodeObj.initial = initialAttr?.value !== undefined ? initialAttr.value : undefined

    // find initial if otherwise not stated
    if (NodeObj.initial === undefined) {
      for (let i = 0; i < stateNode.childNodes.length; i++) {
        const node = stateNode.childNodes[i]
        // Find first node that is of type state, parallel or final
        if (node.nodeType === node.ELEMENT_NODE && (node.nodeName === 'state' || node.nodeName === 'parallel' || node.nodeName === 'final')) {
          // Check if it has an ID
          const tempIdAttr = select('./@id', node, true) as Attr | undefined
          // If no id is not found, find next applicable node
          if (tempIdAttr == null) continue
          // If id is found, add it to xstate
          NodeObj.initial = tempIdAttr.value; break
        }
      }
    }
  }

  /**
   * @todo Adds initial pseudo-state node. XState does not support it yet
   * @param initialStateNode node of inital pseudo-state
   * @param parentNodeObj object of parent node
   */
  protected addInitialState (initialStateNode: Node, parentNodeObj: any): void {

  }

  /**
     *
     * @param childFinalNode
     * @param parentNodeStatesObj
     */
  protected async addFinalState (childFinalNode: Node, parentNodeStatesObj: any): Promise<void> {
    const idAttr = select('./@id', childFinalNode, true) as Attr | undefined
    let id
    if (idAttr?.value !== undefined) id = idAttr.value; else { id = `${FINAL_STATE_GENERIC_ID_PREFIX}${this.FINAL_STATE_GENERIC_COUNTER}`; this.FINAL_STATE_GENERIC_COUNTER++ }
    parentNodeStatesObj[id] = { id, type: 'final' }

    // Process Element Child Nodes
    await this.addFinalStateChildren(childFinalNode, parentNodeStatesObj[id])
  }

  /**
     *
     * @param childOnEntryNode
     * @param parentNodeObj
     */
  protected async addOnEntry (childOnEntryNode: Node, parentNodeObj: any): Promise<void> {
    if (parentNodeObj.entry === undefined) parentNodeObj.entry = []
    await this.addExecutableContent(childOnEntryNode, parentNodeObj.entry)
  }

  /**
     *
     * @param childOnExitNode
     * @param parentNodeObj
     */
  protected async addOnExit (childOnExitNode: Node, parentNodeObj: any): Promise<void> {
    if (parentNodeObj.exit === undefined) parentNodeObj.exit = []
    await this.addExecutableContent(childOnExitNode, parentNodeObj.exit)
  }

  protected addHistoryPseudoState (historyStateNode: Node, parentNodeObj: any): void {
    const historyObj: { type: 'history', history?: 'shallow' | 'deep', target?: string } = { type: 'history' }
    // Check if it has an ID
    const tempIdAttr = select('./@id', historyStateNode, true) as Attr | undefined
    let id
    if (tempIdAttr?.value !== undefined) id = tempIdAttr.value; else { id = `${HIST_STATE_GENERIC_ID_PREFIX}${this.HIST_STATE_GENERIC_COUNTER}`; this.HIST_STATE_GENERIC_COUNTER++ }
    // Check if type is available
    const typeAttr = select('./@type', historyStateNode, true) as Attr | undefined
    const type = (typeAttr?.value !== undefined ? typeAttr.value : undefined) as 'shallow' | 'deep' | undefined

    let target
    if (type !== undefined) historyObj.history = type
    for (const childNode of historyStateNode.childNodes) {
      if (childNode.nodeType === childNode.ELEMENT_NODE && childNode.nodeName === 'transition') {
        const typeAttr = select('./@id', childNode, true) as Attr | undefined
        target = typeAttr?.value !== undefined ? typeAttr.value : undefined
        break
      }
    }

    if (target !== undefined) historyObj.target = target

    if (parentNodeObj.states !== undefined) parentNodeObj.states = {}
    parentNodeObj.states[id] = historyObj
  }

  /** =======================================================================================================================
     *                                             Handling Executable Content
     *=======================================================================================================================**/

  /**
   * Adds all state children
   * @param node state node
   * @param nodeId ID of state node
   * @param currentNodeObj state node xstate object
   */
  protected async addStateChildren (node: Node, nodeId: string, currentNodeObj: any): Promise<void> {
    // Process Element Child Nodes
    for (let i = 0; i < node.childNodes.length; i++) {
      const childNode = node.childNodes[i]
      if (childNode.nodeType === childNode.ELEMENT_NODE) {
        switch (childNode.nodeName) {
          case 'state':
            if (currentNodeObj.states === undefined) currentNodeObj.states = {}
            await this.addNormalState(childNode, currentNodeObj.states)
            break

          case 'parallel':
            if (currentNodeObj.states === undefined) currentNodeObj.states = {}
            await this.addParallelState(childNode, currentNodeObj.states)
            break

          case 'final':
            if (currentNodeObj.states === undefined) currentNodeObj.states = {}
            await this.addFinalState(childNode, currentNodeObj.states)
            break

          case 'history':
            this.addHistoryPseudoState(childNode, currentNodeObj)
            break

          case 'invoke':
            await this.addInvoke(childNode, currentNodeObj, nodeId)
            break

          case 'datamodel':
            this.addDataModel(childNode)
            break

          case 'transition':
            await this.addTransition(childNode, currentNodeObj)
            break

          case 'onentry':
            await this.addOnEntry(childNode, currentNodeObj)
            break

          case 'onexit':
            await this.addOnExit(childNode, currentNodeObj)
            break

          default:
            break
        }
      }
    }
  }

  protected async addFinalStateChildren (finalNode: Node, currentNodeObj: any): Promise<void> {
    // Process Element Child Nodes
    for (let i = 0; i < finalNode.childNodes.length; i++) {
      const childNode = finalNode.childNodes[i]
      if (childNode.nodeType === childNode.ELEMENT_NODE) {
        switch (childNode.nodeName) {
          case 'donedata':
            this.addDoneData(childNode, currentNodeObj)
            break

          case 'onentry':
            await this.addOnEntry(childNode, currentNodeObj)
            break

          case 'onexit':
            await this.addOnExit(childNode, currentNodeObj)
            break

          default:
            break
        }
      }
    }
  }

  /**
     *
     * @param selfNode
     * @param actionsArray
     */
  protected async addExecutableContent (selfNode: Node, actionsArray: any[]): Promise<void> {
    for (let i = 0; i < selfNode.childNodes.length; i++) {
      const childNode = selfNode.childNodes[i]
      if (childNode.nodeType === childNode.ELEMENT_NODE) {
        switch (childNode.nodeName) {
          case 'if':
            this.addIfCondition(childNode, actionsArray)
            break

          case 'assign':
            this.addAssign(childNode, actionsArray)
            break

          case 'log':
            this.addLog(childNode, actionsArray)
            break

          case 'raise':
            this.addRaise(childNode, actionsArray)
            break

          case 'send':
            this.addSend(childNode, actionsArray)
            break

          case 'cancel':
            this.addCancel(childNode, actionsArray)
            break

          case 'script':
            await this.addScript(childNode, actionsArray)
            break

          default:
          // throw Error(`Unknown or unsupported node type <${childNode.nodeName}> in <${selfNode.nodeName}> node `)
        }
      }
    }
  }

  /**
     *
     * @param childAssignNode
     * @param actionsArray
     * @param cond
     */
  protected addAssign (childAssignNode: Node, actionsArray: any, cond?: string | 'else'): void {
    // Get location
    const locationAttr = select('./@location', childAssignNode, true) as Attr | undefined
    if (locationAttr?.value === undefined) throw new Error('<assign> node does not have a location attribute.')

    const location = locationAttr.value

    // Get value or expression to be assigned
    const exprAttr = select('./@expr', childAssignNode, true) as Attr | undefined
    let expr
    if (exprAttr?.value !== undefined) expr = exprAttr.value
    else {
      const dataNode = childAssignNode.firstChild as any
      if (dataNode.data !== undefined) expr = dataNode.data
    }

    if (expr === undefined) throw new Error('Could not find an expression for value assignment in <assign> node')

    // parse and modify expression code
    let expressionModded = this.exprParserAndModder(expr)

    // remove newline
    expressionModded = expressionModded.slice(0, -2)

    // add assign
    actionsArray.push(`{{${ASSIGN_PREFIX}${this.ASSIGN_COUNTER}}}`)

    const parsedLoction = AbstractSyntaxTree.parse(location)
    if (parsedLoction.body[0].type === 'ExpressionStatement' && parsedLoction.body[0].expression.type === 'MemberExpression' && parsedLoction.body[0].expression.object.type === 'Indentifier') {
      const object = parsedLoction.body[0].expression.object.name as string
      const property = parsedLoction.body[0].expression.property.name as string
      this.variableMap[`${ASSIGN_PREFIX}${this.ASSIGN_COUNTER}`] = `assign((context: any, event: any) => {
        const update: Record<string, any> = {}
        update["${object}"] = {...context["${object}"]}
        update["${object}"].${property} = ${expressionModded}
        return update
      })`
    } else if (parsedLoction.body[0].type === 'ExpressionStatement' && parsedLoction.body[0].expression.type === 'MemberExpression' && parsedLoction.body[0].expression.object.type !== 'Indentifier') {
      const object = location
      this.variableMap[`${ASSIGN_PREFIX}${this.ASSIGN_COUNTER}`] = `assign((context: any, event: any) => {
        const update: Record<string, any> = {}
        update[${object}] = {...context[${object}]}
        update[${object}] = ${expressionModded}
        return update
      })`
    } else {
      const parsedTree = AbstractSyntaxTree.parse(expressionModded)
      if (parsedTree.body?.length === 1 && parsedTree.body[0].expression?.type !== undefined && parsedTree.body[0].expression.type === 'Literal') {
        this.variableMap[`${ASSIGN_PREFIX}${this.ASSIGN_COUNTER}`] = `assign({${location}: ${expressionModded}})`
      } else {
        this.variableMap[`${ASSIGN_PREFIX}${this.ASSIGN_COUNTER}`] = `assign({${location}: (context: any, event: any) => {return ${expressionModded}}})`
      }
    }

    this.ASSIGN_COUNTER++
  }

  /**
     *
     * @param ifNode
     * @param actionsArray
     */
  protected addIfCondition (ifNode: Node, actionsArray: any[]): void {
    let condAttr = select('./@cond', ifNode, true) as Attr | undefined
    if (condAttr?.value === undefined) throw new Error('<if> node does not have a cond attribute.')

    let cond = this.conditionParser(condAttr.value)

    const condsArray: any[] = []
    let condActionObj: { cond?: string, in?: string, actions: any[] } = { actions: [] }

    if (cond?.type !== undefined) {
      condActionObj.cond = cond.type
    }
    if (cond?.in !== undefined) { condActionObj.in = cond?.in }

    condsArray.push(condActionObj)

    for (let i = 0; i < ifNode.childNodes.length; i++) {
      const childNode = ifNode.childNodes[i]
      switch (childNode.nodeName) {
        case 'if':
          this.addIfCondition(childNode, condActionObj.actions)
          break

        case 'elseif':
          condActionObj = { actions: [] }
          condAttr = select('./@cond', childNode, true) as Attr | undefined
          if (condAttr?.value === undefined) throw new Error('<elseif> node does not have a cond attribute.')

          cond = this.conditionParser(condAttr.value)

          if (cond?.type !== undefined) {
            condActionObj.cond = cond.type
          }
          if (cond?.in !== undefined) { condActionObj.in = cond?.in }

          condsArray.push(condActionObj)
          break

        case 'else':
          condActionObj = { actions: [] }
          condsArray.push(condActionObj)
          break

        case 'assign':
          this.addAssign(childNode, condActionObj.actions)
          break

        case 'log':
          this.addLog(childNode, condActionObj.actions)
          break

        case 'raise':
          this.addRaise(childNode, condActionObj.actions)
          break

        case 'send':
          this.addSend(childNode, condActionObj.actions)
          break

        case 'cancel':
          this.addCancel(childNode, actionsArray)
          break

        case 'script':
          void this.addScript(childNode, condActionObj.actions)
          break

        default:
          break
      }
    }

    actionsArray.push(choose(condsArray))
  }

  /**
     *
     * @param logNode
     * @param actionsArray
     */
  protected addLog (logNode: Node, actionsArray: any[]): void {
    const labelAttr = select('./@label', logNode, true) as Attr | undefined
    const exprAttr = select('./@expr', logNode, true) as Attr | undefined

    const label = labelAttr?.value !== undefined ? labelAttr.value : undefined
    let expr = exprAttr?.value !== undefined ? exprAttr.value : undefined

    if (expr !== undefined) {
      // parse and modify expression code
      expr = this.exprParserAndModder(expr)
      // remove newline
      expr = expr.slice(0, -2)

      if (label !== undefined) this.variableMap[`${LOG_PREFIX}${this.LOG_COUNTER}`] = `log((context: any, event: any, {_event}) => {return ${expr}}, "${label}")`
      else this.variableMap[`${LOG_PREFIX}${this.LOG_COUNTER}`] = `log((context: any, event: any, {_event}) => {return ${expr}})`
    } else {
      if (label !== undefined) this.variableMap[`${LOG_PREFIX}${this.LOG_COUNTER}`] = `log(undefined, "${label}")`
      else this.variableMap[`${LOG_PREFIX}${this.LOG_COUNTER}`] = 'log()'
    }
    actionsArray.push(`{{${LOG_PREFIX}${this.LOG_COUNTER}}}`)

    this.LOG_COUNTER++
  }

  /**
     *
     * @param raiseNode
     * @param actionsArray
     */
  protected addRaise (raiseNode: Node, actionsArray: any[]): void {
    const eventAttr = select('./@event', raiseNode, true) as Attr | undefined
    if (eventAttr?.value === undefined) throw Error('<raise> node does not contain event attribute')

    const event: string = eventAttr.value

    actionsArray.push({ type: 'xstate.raise', event })
  }

  /**
     *
     * @param sendNode
     * @param actionsArray
     */
  protected addSend (sendNode: Node, actionsArray: any[]): void {
    let eventString: string | undefined
    let eventExpr: string | undefined

    let idString: string | undefined
    let idExpr: string | undefined

    let targetString: string | undefined
    let targetExpr: string | undefined

    let delayNumber: number | undefined
    let delayExpr: string | undefined

    // Handle <content> and <param> Children
    let includesParam = false
    let includesContent = false

    const paramsObj = {}
    let contentCode, data: string | undefined

    const sendOptions: { id?: string, to?: string, delay?: number } = {}

    // Attribute Extraction
    const eventAttr = select('./@event', sendNode, true) as Attr | undefined
    const eventExprAttr = select('./@eventexpr', sendNode, true) as Attr | undefined
    const targetAttr = select('./@target', sendNode, true) as Attr | undefined
    const targetExprAttr = select('./@targetexpr', sendNode, true) as Attr | undefined
    // const typeAttr = select('./@type', sendNode, true) as Attr | undefined
    // const typeExprAttr = select('./@typeExpr', sendNode, true) as Attr | undefined
    const idAttr = select('./@id', sendNode, true) as Attr | undefined
    const idlocationAttr = select('./@idlocation', sendNode, true) as Attr | undefined
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

    // ID parsing
    if (idAttr?.value !== undefined) {
      idString = idAttr.value
    } else if (idlocationAttr?.value !== undefined) {
      idString = this.exprParserAndModder(idlocationAttr.value)
    }

    // Target parsing
    if (targetAttr?.value !== undefined) {
      targetString = targetAttr.value
    } else if (targetExprAttr?.value !== undefined) {
      targetString = this.exprParserAndModder(targetExprAttr.value)
    }

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
    // todo  Handle dynamic Send targets and delays
    // todo  Data and target parsing

    // Add id if available
    if (idString !== undefined) sendOptions.id = idString
    else if (idExpr !== undefined) {
      this.variableMap[`${SEND_IDEXPR_PREFIX}${this.SEND_IDEXPR_COUNTER}`] = `(context: any, event: any, { _event } => {return ${idExpr}})`
      sendOptions.id = `{{${SEND_IDEXPR_PREFIX}${this.SEND_IDEXPR_COUNTER}}}`
      this.SEND_IDEXPR_COUNTER++
    }

    // add delay if available
    if (delayNumber !== undefined) sendOptions.delay = delayNumber
    else if (delayExpr !== undefined) {
      if (this.XStateMachineOptions?.delays === undefined) this.XStateMachineOptions.delays = {}
      this.variableMap[`${SEND_DELAYEXPR_PREFIX}${this.SEND_DELAYEXPR_COUNTER}`] =
`(context: any, event: any, { _event }): number => {
  const delayExpr = ${delayExpr}
  return delayToMs(delayExpr)
}
`
      sendOptions.delay = `{{${SEND_DELAYEXPR_PREFIX}${this.SEND_DELAYEXPR_COUNTER}}}` as any
      this.SEND_DELAYEXPR_COUNTER++
    }

    // add target if available
    if (targetString !== undefined && targetString !== 'parent') sendOptions.to = targetString
    else if (targetExpr !== undefined) {
      this.variableMap[`${SEND_TARGETEXPR_PREFIX}${this.SEND_TARGETEXPR_COUNTER}`] = `(context: any, event: any, { _event } => {return ${targetExpr}})`
      sendOptions.to = `{{${SEND_TARGETEXPR_PREFIX}${this.SEND_TARGETEXPR_COUNTER}}}`
      this.SEND_TARGETEXPR_COUNTER++
    }

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
          contentCode = this.getContentFromNode(childNode, 'send')
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

    if (targetString !== 'parent') {
      if (eventString !== undefined && data === undefined) {
        this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`] = `send('${eventString}'`
      } else if (eventString !== undefined && data !== undefined) {
        this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`] = `send((context: any, event: any, {_event}) => ({type: '${eventString}', data: ${data}})`
      } else if (eventExpr !== undefined && data === undefined) {
        this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`] = `send((context: any, event: any, {_event}) => ({type: ${eventExpr}})`
      } else if (eventExpr !== undefined && data !== undefined) {
        this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`] = `send((context: any, event: any, {_event}) => ({type: ${eventExpr}, data: ${data}})`
      }
    } else {
      if (eventString !== undefined && data === undefined) {
        this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`] = `sendParent('${eventString}'`
      } else if (eventString !== undefined && data !== undefined) {
        this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`] = `sendParent((context: any, event: any, {_event}) => ({type: '${eventString}', data: ${data}})`
      } else if (eventExpr !== undefined && data === undefined) {
        this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`] = `sendParent((context: any, event: any, {_event}) => ({type: ${eventExpr}})`
      } else if (eventExpr !== undefined && data !== undefined) {
        this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`] = `sendParent((context: any, event: any, {_event}) => ({type: ${eventExpr}, data: ${data}})`
      }
    }
    if (Object.keys(sendOptions).length > 0) {
      this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`] = this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`].concat(`, ${toSource(sendOptions)})`)
    } else {
      this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`] = this.variableMap[`${SEND_PREFIX}${this.SEND_COUNTER}`].concat(')')
    }

    actionsArray.push(`{{${SEND_PREFIX}${this.SEND_COUNTER}}}`)
    this.SEND_COUNTER++
  }

  /**
     *
     * @param cancelNode
     * @param actionsArray
     */
  protected addCancel (cancelNode: Node, actionsArray: any[]): void {
    let idString: string | undefined
    let idExpr: string | undefined

    // Attribute Extraction
    const sendIdAttr = select('./@sendid', cancelNode, true) as Attr | undefined
    const sendIdExprAttr = select('./@sendidexpr', cancelNode, true) as Attr | undefined

    // Event parsing
    if (sendIdAttr?.value !== undefined) {
      if (sendIdExprAttr != null) throw Error("Attribute 'sendid' should not occur with 'sendidexpr'")
      idString = sendIdAttr.value
    } else {
      if (sendIdExprAttr == null) throw Error("Attribute 'sendidexpr' must occur with if 'sendid' is not present")

      // parse and modify expression code
      idExpr = this.exprParserAndModder(sendIdExprAttr.value)
    }

    if (this.XStateMachineOptions.actions == null) this.XStateMachineOptions.actions = {}

    actionsArray.push(`{{${CANCEL_PREFIX}${this.CANCEL_COUNTER}}}`)

    if (idString !== undefined) this.variableMap[`${CANCEL_PREFIX}${this.CANCEL_COUNTER}`] = `cancel("${idString}")`
    else if (idExpr !== undefined) this.variableMap[`${CANCEL_PREFIX}${this.CANCEL_COUNTER}`] = `cancel((context: any) => (return ${idExpr}))`

    this.CANCEL_COUNTER++
  }

  /**
     *
     * @param childScriptNode
     * @param actionsArray
     */
  protected async addScript (childScriptNode: Node, actionsArray: any[]): Promise<void> {
    const srcAttr = select('./@src', childScriptNode, true) as Attr | undefined
    const src = srcAttr?.value !== undefined ? srcAttr?.value : undefined

    // todo  Fetch if src defined
    let scriptString
    if (srcAttr?.value !== undefined) scriptString = this.fetch(srcAttr.value) as unknown as string
    else scriptString = select('string(.)', childScriptNode, true) as string | undefined

    if (scriptString !== undefined) {
      // regenerate code
      const expressionModded = this.exprParserAndModder(scriptString)

      if (this.XStateMachineOptions.actions === undefined) this.XStateMachineOptions.actions = {}

      this.variableMap[`${SCRIPT_PREFIX}${this.SCRIPT_COUNTER}`] = `(context: any, event: any {_event}) => ${expressionModded}`
      this.XStateMachineOptions.actions[`${SCRIPT_PREFIX}${this.SCRIPT_COUNTER}`] = `{{${SCRIPT_PREFIX}${this.SCRIPT_COUNTER}}}` as any

      actionsArray.push({ type: `${SCRIPT_PREFIX}${this.SCRIPT_COUNTER}` })
      this.SCRIPT_COUNTER++
    } else if (src === undefined) {
      throw Error('<script> node has no code')
    }
  }

  protected async addInvoke (invokeNode: Node, currentState: any, stateID: string): Promise<void> {
    let srcName, id, idLocation, autoforward, scxmlNode
    let hasParam = false

    // Attribute Extraction
    const typeAttr = select('./@type', invokeNode, true) as Attr | undefined
    const typeExprAttr = select('./@typeExpr', invokeNode, true) as Attr | undefined
    const srcAttr = select('./@src', invokeNode, true) as Attr | undefined
    const srcExprAttr = select('./@srcexpr', invokeNode, true) as Attr | undefined
    const idAttr = select('./@id', invokeNode, true) as Attr | undefined
    const idlocationAttr = select('./@idlocation', invokeNode, true) as Attr | undefined
    const namelistAttr = select('./@namelistAttr', invokeNode, true) as Attr | undefined
    const autoForwardAttr = select('./@autoforward', invokeNode, true) as Attr | undefined

    // todo  Add correct handling of attributes
    if (typeAttr !== undefined && (typeAttr.value !== 'http://www.w3.org/TR/scxml/' && typeAttr.value !== 'scxml')) throw new Error('Invoke Type not supported')
    if (typeAttr === undefined && typeExprAttr?.value !== undefined) { /* empty */ }
    if (srcAttr?.value !== undefined) srcName = srcAttr.value
    if (srcAttr?.value === undefined && srcExprAttr?.value !== undefined) { srcName = this.exprParserAndModder(srcExprAttr.value) }
    if (idAttr?.value !== undefined) id = idAttr.value
    if (idAttr?.value === undefined && idlocationAttr?.value !== undefined) { idLocation = idlocationAttr.value }
    if (autoForwardAttr?.value !== undefined) autoforward = autoForwardAttr.value

    /* ========================================== Handle Invoke Node ============================================= */

    const paramsObj = {}

    if (srcName !== undefined) {
      scxmlNode = await this.fetch(srcName)
    }
    if (namelistAttr?.value !== undefined) { if (namelistAttr?.value !== undefined) this.handleNameList(namelistAttr.value, paramsObj) }

    for (let i = 0; i < invokeNode.childNodes.length; i++) {
      const childNode = invokeNode.childNodes[i]
      switch (childNode.nodeName) {
        case 'param':
          hasParam = true
          this.addParam(childNode, paramsObj)
          break

        case 'content':
          if (srcAttr?.value !== undefined || srcExprAttr?.value !== undefined) throw new Error('<invoke> cannot have "src" and <content> at the same time')
          // Will parse the first Element Node we see as SCXML Node
          scxmlNode = this.getContentFromNode(childNode, 'invoke')
          break

        default:
          break
      }
    }

    const childMachineParser = new SCXML2XStateCodeParser()
    const childMachineFactoryCode = await childMachineParser.generateXStateMachineFactory(scxmlNode)
    const initialContext = childMachineParser.getContext()
    this.childMachines += `let ${MACHINE_SERVICE_PREFIX}${this.MACHINE_SERVICE_COUNTER} = ${childMachineFactoryCode}\n`
    this.variableMap[`${MACHINE_SERVICE_PREFIX}${this.MACHINE_SERVICE_COUNTER}`] = `${MACHINE_SERVICE_PREFIX}${this.MACHINE_SERVICE_COUNTER}`

    /* =============================================== Add Invoke Node ================================================== */

    if (idLocation === undefined) {
      await this.addInvokeNormally(currentState, initialContext, id, Boolean(autoforward), hasParam ? paramsObj : undefined)
    } else {
      await this.addInvokeAsSpawn(currentState, initialContext, idLocation, stateID, Boolean(autoforward), hasParam ? paramsObj : undefined)
    }
  }

  protected async addInvokeNormally (currentState: any, initialContext: Record<string, any>, serviceID?: string, autoforward?: boolean, data?: Record<string, any>): Promise<void> {
    // Assign if undefined
    currentState.invoke ??= {}
    if (currentState.invoke === undefined) currentState.invoke = {}
    if (serviceID !== undefined) currentState.invoke.id = serviceID
    if (autoforward === true) currentState.invoke.autoforward = autoforward
    if (data !== undefined) {
      currentState.invoke.data = this.handleInvokeOrDoneDataParamsObject(data, initialContext)
    }

    if (this.XStateMachineOptions.services !== undefined) this.XStateMachineOptions.services[`${MACHINE_SERVICE_PREFIX}${this.MACHINE_SERVICE_COUNTER}`] = `{{${MACHINE_SERVICE_PREFIX}${this.MACHINE_SERVICE_COUNTER}}}` as any
    currentState.invoke.src = `${MACHINE_SERVICE_PREFIX}${this.MACHINE_SERVICE_COUNTER}`
    this.MACHINE_SERVICE_COUNTER++
  }

  protected async addInvokeAsSpawn (currentState: any, initialContext: Record<string, any>, idLocation: string, currentStateID: string, autoforward?: boolean, data?: Record<string, any>): Promise<void> {
    if (this.XStateMachineConfig.context === undefined) this.XStateMachineConfig.context = {}
    if (this.XStateMachineConfig.context._spawnedServices === undefined) this.XStateMachineConfig.context._spawnedServices = {}
    if (this.XStateMachineConfig.context._spawnedServicesCounter === undefined) this.XStateMachineConfig.context._spawnedServicesCounter = 0

    let spawnFuncCode = `spawn(InvokedMachineFactory("{{${MACHINE_SERVICE_PREFIX}${this.MACHINE_SERVICE_COUNTER}}}"`
    if (data !== undefined) spawnFuncCode += `, ${this.handleSendorSpawnParamsObject(data, initialContext)}`
    spawnFuncCode += ')'
    if (autoforward === true) spawnFuncCode += `,{\`${currentStateID}.\${context._spawnedServicesCounter}\`, autoforward: ${String(autoforward)}})`
    else spawnFuncCode += `,\`${currentStateID}.\${context._spawnedServicesCounter}\`)`

    const spawnCode = `assign({
      "${idLocation}": (context: any, event: any) => \`${currentStateID}.\${context._spawnedServicesCounter}\`,
      _spawnedServices: (context: any, event: any) => {
        const tmp = {...context._spawnedServices}
        tmp[\`${currentStateID}.\${context._spawnedServicesCounter}\`] = ${spawnFuncCode}
        return tmp },
      _spawnedServicesCounter: (context: any, event: any) => context._spawnedServicesCounter+1
    })`

    const stopCode = `stop((context: any) => context["${idLocation}"])`

    this.variableMap[`${SPAWN_ENTRY_PREFIX}${this.SPAWN_COUNTER}`] = spawnCode
    this.variableMap[`${SPAWN_EXIT_PREFIX}${this.SPAWN_COUNTER}`] = stopCode

    if (currentState.entry === undefined) currentState.entry = `{{${SPAWN_ENTRY_PREFIX}${this.SPAWN_COUNTER}}}`
    else currentState.entry.push(`{{${SPAWN_ENTRY_PREFIX}${this.SPAWN_COUNTER}}}`)

    if (currentState.exit === undefined) currentState.exit = `{{${SPAWN_EXIT_PREFIX}${this.SPAWN_COUNTER}}}`
    else currentState.exit.push(`{{${SPAWN_EXIT_PREFIX}${this.SPAWN_COUNTER}}}`)

    this.SPAWN_COUNTER++
  }

  /** =======================================================================================================================
     *                                                 Handling Data Model
     *=======================================================================================================================**/

  /**
     *
     * @param dataModelNode
     * @param topNodeObject
     */
  protected addDataModel (dataModelNode: Node): void {
    if (this.XStateMachineConfig.context === undefined) this.XStateMachineConfig.context = {}

    const dataNodeArray = select('./scxml:data', dataModelNode) as Node[]
    for (const dataNode of dataNodeArray) {
      this.addData(dataNode)
    }
  }

  protected addData (dataNode: Node): void {
    const idAttr = select('./@id', dataNode, true) as Attr
    if (idAttr?.value === undefined) throw new Error('<data> node does not contain an id')
    const id = idAttr.value

    const exprAttr = select('./@expr', dataNode, true) as Attr | undefined
    let expr
    if (exprAttr?.value !== undefined) expr = exprAttr.value
    else {
      for (let i = 0; i < dataNode.childNodes.length; i++) {
        const childNode = dataNode.childNodes[i]
        if (childNode.nodeType === childNode.TEXT_NODE && childNode.nodeValue !== null) expr = childNode.nodeValue
      }
    }

    if (expr === undefined) {
      this.XStateMachineConfig.context[id] = undefined
    } else {
      // interpret string as JSON
      this.XStateMachineConfig.context[id] = JSON.parse(expr)
    }
  }

  protected addDoneData (doneDataNode: Node, parentFinalObj: any): void {
    // Handle <content> and <param> Children
    let includesParam = false
    let includesContent = false

    const paramsObj = {}
    let contentCode: string | undefined

    for (let i = 0; i < doneDataNode.childNodes.length; i++) {
      const childNode = doneDataNode.childNodes[i]
      switch (childNode.nodeName) {
        case 'param':
          includesParam = true
          if (includesContent) throw new Error('<donedata> cannot include both <param> and <content>')
          this.addParam(childNode, paramsObj)
          break

        case 'content':
          if (includesParam) throw new Error('<donedata> cannot include both <param> and <content>')
          if (includesContent) throw new Error('<donedata> cannot include more than one <content> node')
          includesContent = true
          // Will parse the first Text Node we see as JSON
          contentCode = this.getContentFromNode(childNode, 'donedata')
          break

        default:
          break
      }
    }

    if (includesParam) {
      parentFinalObj.data = this.handleInvokeOrDoneDataParamsObject(paramsObj)
    }

    if (includesContent) {
      parentFinalObj.data = contentCode
    }
  }

  protected getContentFromNode (contentNode: Node, parentType: 'send' | 'invoke' | 'donedata' | 'WoTSend'): any | Node {
    const exprAttr = select('./@expr', contentNode, true) as Attr | undefined

    if (exprAttr?.value !== undefined) {
      if (parentType === 'WoTSend') {
        const expr = this.exprParserAndModder(exprAttr.value)
        return expr.slice(0, -1)
      } else return `(context: any, event: any, {_event}) => {return ${this.exprParserAndModder(exprAttr.value)}}`
    } else {
      if (parentType !== 'invoke') {
        for (let i = 0; i < contentNode.childNodes.length; i++) {
          // Check if NodeType is Text
          if (contentNode.childNodes[i].nodeType === contentNode.childNodes[i].TEXT_NODE) {
            return JSON.parse(contentNode.childNodes[i].nodeValue as string)
          }
        }
      } else {
        for (let i = 0; i < contentNode.childNodes.length; i++) {
          // Check if NodeType is Element
          if (contentNode.childNodes[i].nodeType === contentNode.childNodes[i].ELEMENT_NODE) {
            return contentNode.childNodes[i]
          }
        }
      }
    }
  }

  protected addParam (paramNode: Node, parametersObj: Record<string, any>): void {
    const nameAttr = select('./@name', paramNode, true) as Attr | undefined
    const locationAttr = select('./@location', paramNode, true) as Attr | undefined
    const exprAttr = select('./@expr', paramNode, true) as Attr | undefined

    if (nameAttr?.value === undefined) throw new Error('<param> node must have "name" attribute')
    const key = nameAttr.value

    if (locationAttr?.value !== undefined) {
      if (exprAttr?.value !== undefined) throw new Error('<param> node must have either "location" or "expr" attribute')
      parametersObj[key] = `context["${locationAttr.value}"]`
    } else {
      if (exprAttr?.value === undefined) throw new Error('<param> node must have either "location" or "expr" attribute')
      let expr: string
      try {
        expr = JSON.stringify(JSON.parse(exprAttr.value))
      } catch (error) {
        expr = this.exprParserAndModder(exprAttr.value)
        expr = expr.replace(';', '')
      }
      parametersObj[key] = `${expr}`
    }
  }

  protected handleSendorSpawnParamsObject (parametersObj: Record<string, any>, initialContext?: Record<string, any>): string {
    let dataString = '{\n'

    if (initialContext !== undefined) {
      for (const key in initialContext) {
        if (key in parametersObj) {
          //! Take care of quotes! They are needed for the placeholder replacement
          dataString += `${key}:  "{{${PARAM_PREFIX}${this.PARAM_COUNTER}}}",`
          this.variableMap[`${PARAM_PREFIX}${this.PARAM_COUNTER}`] = parametersObj[key].replace('\n,', ',\n')
          this.PARAM_COUNTER++
        } else {
          dataString += `${key}:  ${JSON.stringify(initialContext[key])},`
        }
      }
    } else {
      for (const key in parametersObj) {
        //! Take care of quotes! They are needed for the placeholder replacement
        dataString += `${key}:  "{{${PARAM_PREFIX}${this.PARAM_COUNTER}}}",`
        this.variableMap[`${PARAM_PREFIX}${this.PARAM_COUNTER}`] = parametersObj[key].replace('\n,', ',\n')
        this.PARAM_COUNTER++
      }
    }

    dataString += '}'

    return dataString
  }

  protected handleInvokeOrDoneDataParamsObject (parametersObj: Record<string, string>, initialContext?: Record<string, any>): string {
    let dataString = '{\n'

    if (initialContext !== undefined) {
      for (const key in initialContext) {
        if (key in parametersObj) {
          //! Take care of quotes! They are needed for the placeholder replacement
          dataString += `${key}: (context, event) => { return ${parametersObj[key]} },`
        } else {
          dataString += `${key}:  ${JSON.stringify(initialContext[key])},`
        }
      }
    } else {
      for (const key in parametersObj) {
        //! Take care of quotes! They are needed for the placeholder replacement
        dataString += `${key}: (context, event) => { return ${parametersObj[key]} },`
      }
    }

    dataString += '}'

    this.variableMap[`${PARAM_PREFIX}${this.PARAM_COUNTER}`] = dataString
    const result = `{{${PARAM_PREFIX}${this.PARAM_COUNTER}}}`
    this.PARAM_COUNTER++

    return result
  }

  /** =======================================================================================================================
     *                                                 Utility functions
     *=======================================================================================================================**/

  /**
     *
     * @param expression
     * @returns
     */
  protected conditionParser (expression: string): { type?: string, expr?: string, in?: string } {
    const result: { type?: string, expr?: string, in?: string } = {}
    let inCond: string | undefined
    let noCondition = false
    // Generate abstract syntax tree for inspection
    const conditionTree = AbstractSyntaxTree.parse(expression)

    // walk through tree to find identifiers that are not function identifier => context variables
    // then add context
    const declaredVariable: string[] = []
    AbstractSyntaxTree.walk(conditionTree, (node: any, parent: any) => {
      if (node !== undefined && parent !== undefined && node.type === 'Identifier') {
        if (parent.type === 'VariableDeclarator') declaredVariable.push(node.name)

        if (parent.type === 'MemberExpression' && (!(AbstractSyntaxTree.match(parent.property, node) as boolean) || parent.computed as boolean) && node.name !== '_event' && node.name !== 'event' && node.name !== 'undefined') {
          node.name = `context["${node.name as string}"]`
        } else if (parent.type !== 'MemberExpression' && (parent.type !== 'CallExpression' || !(AbstractSyntaxTree.match(parent.callee, node) as boolean)) && parent.type !== 'VariableDeclarator' && node.name !== '_event' && node.name !== 'event' && node.name !== 'undefined' && !declaredVariable.includes(node.name)) {
          node.name = `context["${node.name as string}"]`
        }
      }
      // Parsing In() predicate and removing it from condition
      if ((Boolean(node)) && node.type === 'CallExpression' && node.callee.name === 'In') {
        inCond = node.arguments[0].value
        // check parent type
        switch (parent.type) {
          case 'ExpressionStatement':
            noCondition = true
            break

          case 'LogicalExpression': {
            // find if right or left node
            let leftOrRight = ''
            if (AbstractSyntaxTree.match(parent.right, node) as boolean) leftOrRight = 'right'; else leftOrRight = 'left'
            const otherLeaf = leftOrRight === 'right' ? 'left' : 'right'

            // find parent of parent
            let parentOfParent: any
            AbstractSyntaxTree.walk(conditionTree, (parentNode: any, parentOfParentNode: any) => { if (AbstractSyntaxTree.match(parent, parentNode) as boolean) parentOfParent = parentOfParentNode })

            if (parent.operator !== '&&' || parentOfParent === undefined || parentOfParent.type !== 'ExpressionStatement') throw Error('In predicate must be on the top level of an AND-logical statement')

            parentOfParent.expression = parent[otherLeaf]
            break
          }
          default:
            throw Error('Conditions can only contain expression statements or logical expressions')
        }
      }
    })

    if (inCond !== undefined) result.in = `#${inCond}`

    let condition: string | undefined
    // regenerate code
    if (!noCondition) {
      condition = AbstractSyntaxTree.generate(conditionTree) as string

      // remove newline
      condition = condition.slice(0, -2)

      // add a guard funtion to machineOptions
      if (this.XStateMachineOptions.guards === undefined) this.XStateMachineOptions.guards = {}
      this.variableMap[`${COND_PREFIX}${this.COND_COUNTER}`] = `(context: any, event: any, { cond, _event }) => ${condition}`
      this.XStateMachineOptions.guards[`${COND_PREFIX}${this.COND_COUNTER}`] = `{{${COND_PREFIX}${this.COND_COUNTER}}}` as any

      // add to result
      result.type = `${COND_PREFIX}${this.COND_COUNTER}`
      this.COND_COUNTER++
    }

    return result
  }

  /**
     *
     * @param expression
     * @returns
     */
  protected exprParserAndModder (expression: string): string {
    // Check if it is a whole object -> will need some help to fix first
    const isObjectRegex = /[{|,]\s*("\w+":\s*[a-zA-Z_$]\w+)/mg
    const isObject = isObjectRegex.test(expression)
    if (isObject) expression = 'let tmp=' + expression
    const expressionTree = AbstractSyntaxTree.parse(expression)

    // walk through tree to find identifiers that are not function identifier => context variables
    // then add context
    const declaredVariable: string[] = []
    AbstractSyntaxTree.walk(expressionTree, (node: any, parent: any) => {
      if (node !== undefined && parent !== undefined && node.type === 'Identifier') {
        if (parent.type === 'VariableDeclarator') declaredVariable.push(node.name)

        if (parent.type === 'MemberExpression' && (!(AbstractSyntaxTree.match(parent.property, node) as boolean) || parent.computed as boolean) && node.name !== '_event' && node.name !== 'event' && node.name !== 'undefined') {
          node.name = `context["${node.name as string}"]`
        } else if (parent.type !== 'MemberExpression' && (parent.type !== 'CallExpression' || !(AbstractSyntaxTree.match(parent.callee, node) as boolean)) && parent.type !== 'VariableDeclarator' && node.name !== '_event' && node.name !== 'event' && node.name !== 'undefined' && !declaredVariable.includes(node.name)) {
          node.name = `context["${node.name as string}"]`
        }
      }
    })

    // regenerate code
    let result = AbstractSyntaxTree.generate(expressionTree) as string
    if (isObject) result = result.replace(/let\s+tmp\s*=\s*/, '')
    return result
  }

  /**
   * Handle Namelists
   * @param namelist namelist string
   * @param parametersObj parameters container
   */
  protected handleNameList (namelist: string, parametersObj: Record<string, any>): void {
    const namelistItems = namelist.split(' ')
    for (const item of namelistItems) {
      parametersObj[item] = `{context["${item}"]}`
    }
  }

  /**
   * Find parent state
   * @param stateNode XML Node of state
   * @returns parent ids as array of strings
   */
  protected findParentStates (stateNode: Node): string[] {
    let currentParentNode = stateNode.parentNode
    const parents: string[] = []
    while (currentParentNode !== null) {
      if (currentParentNode.nodeName === 'state' || currentParentNode.nodeName === 'parallel') {
        const idAttr = select('./@id', currentParentNode, true) as Attr
        parents.push(idAttr.value)
      }
      currentParentNode = currentParentNode.parentNode
    }
    return parents
  }
}

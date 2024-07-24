declare module 'abstract-syntax-tree';
type stateEnum = string | string[] | stateEnum [] | { [key: string]: stateEnum }
type AffordanceOperations = 'readproperty' | 'writeproperty' | 'observeproperty' | 'unobserveproperty' | 'invokeaction' | 'queryaction' | 'cancelaction' | 'subscribeevent' | 'unsubscribeevent' | 'readallproperties' | 'writeallproperties' | 'readmultipleproperties' | 'writemultipleproperties' | 'observeallproperties' | 'unobserveallproperties' | 'subscribeallevents' | 'unsubscribeallevents' | 'queryallactions'
type PropertyOperations = 'readproperty' | 'writeproperty' | 'observeproperty' | 'unobserveproperty'
type ActionOperations = 'invokeaction' | 'queryaction' | 'cancelaction'
type EventOperations = 'subscribeevent' | 'unsubscribeevent'
type topLevelOperations = 'readallproperties' | 'writeallproperties' | 'readmultipleproperties' | 'writemultipleproperties' | 'observeallproperties' | 'unobserveallproperties' | 'subscribeallevents' | 'unsubscribeallevents' | 'queryallactions'

interface InternalOperationRepresentation {
  affordanceType: 'property' | 'action' | 'event'
  affordanceObject: any
  name: string
  op: AffordanceOperations
  responseEvent?: string
  emitEvent?: string
  event?: string
  propertyType?: 'data' | 'state'
  propertyElementId?: string
  availableIn: string[]
  stateDependant?: boolean
  [key: string]: { cond?: string, schema?: Record<string, any> } | any
}

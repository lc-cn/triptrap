export class EventDeliver{
    private _events:Record<EventDeliver.EventName, EventDeliver.Listener[]>={}
    maxListeners:number=15
    constructor() {
    }
    setMaxListeners(n:number){
        this.maxListeners=n
        return this
    }
    getMaxListeners(){
        return this.maxListeners
    }
    listeners(event?:EventDeliver.EventName){
        if(!event) return Object.values(this._events).flat()
        return [...this._events[event]]
    }
    on(event:EventDeliver.EventName,listener:EventDeliver.Listener,prepend?:boolean){
        return this.addListener(event,listener,prepend)
    }
    addListener(event:EventDeliver.EventName,listener:EventDeliver.Listener,prepend?:boolean):EventDeliver.Dispose{
        const listeners:EventDeliver.Listener[]=this._events[event]||=[]
        if(listeners.length>=this.maxListeners)console.warn(`event:${event.toString()} listeners out of maxListeners`)
        const method:'push'|'unshift'=prepend?'unshift':'push'
        listeners[method](listener)
        return ()=>EventDeliver.remove(listeners,listener)
    }
    prependListener(event:EventDeliver.EventName,listener:EventDeliver.Listener,append?:boolean):EventDeliver.Dispose{
        return this.on(event,listener,!append)
    }
    addOnceListener(event:EventDeliver.EventName,listener:EventDeliver.Listener,prepend?:boolean):EventDeliver.Dispose{
        const dispose=this.on(event,(...args:any[])=>{
            listener(...args)
            dispose()
        },prepend)
        return dispose
    }
    once(event:EventDeliver.EventName,listener:EventDeliver.Listener,prepend?:boolean){
        return this.addOnceListener(event,listener,prepend)
    }
    prependOnceListener(event:EventDeliver.EventName,listener:EventDeliver.Listener,append?:boolean):EventDeliver.Dispose{
        return this.once(event,listener,!append)
    }
    removeListener(event?:EventDeliver.EventName,listener?:EventDeliver.Listener){
        if(!event) this._events={}
        if(!listener) this._events[event]=[]
        return EventDeliver.remove(this._events[event],listener)
    }
    off(event?:EventDeliver.EventName,listener?:EventDeliver.Listener){
        return this.removeListener(event,listener)
    }
    async emitAsync(event:EventDeliver.EventName,...args:any[]){
        const listeners:EventDeliver.Listener[]=this._events[event]||[]
        for(const listener of listeners){
            await listener.apply(this,args)
        }
    }
    emit(event:EventDeliver.EventName,...args:any[]){
        this.emitAsync(event,...args)
    }
    async bailSync(event:EventDeliver.EventName,...args:any[]){
        const listeners:EventDeliver.Listener[]=this._events[event]||[]
        for(const listener of listeners){
            const result=await listener.apply(this,args)
            if(result) return result
        }
    }
    bail(event:EventDeliver.EventName,...args:any[]){
        const listeners:EventDeliver.Listener[]=this._events[event]||[]
        for(const listener of listeners){
            const result=listener.apply(this,args)
            if(result && !EventDeliver.isPromise(result)) return result
        }
    }
    listenerCount(event:EventDeliver.EventName){
        if(!this._events[event]) return 0
        return this._events[event].length
    }
    eventNames(){
        const result:(string|symbol)[]=[]
        result.push(...Object.getOwnPropertyNames(this._events),...Object.getOwnPropertySymbols(this._events))
        return result
    }
}
export namespace EventDeliver{
    export type EventName=string|symbol
    export type Listener=(...args:any[])=>any
    export type Dispose=()=>boolean
    export function isPromise(object:unknown):object is Promise<unknown>{
        return typeof object==='object' &&  typeof object['then']==='function' && typeof object['catch']==='function'
    }
    export function remove<T extends any>(list:T[],item:T){
        const index=list.indexOf(item)
        if(index<0) return false
        list.splice(index,1)
        return true
    }
}
export default EventDeliver

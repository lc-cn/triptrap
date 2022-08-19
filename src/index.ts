export class EventDeliver{
    private _events:Map<EventDeliver.EventName,EventDeliver.Listener[]>=new Map<EventDeliver.EventName, EventDeliver.Listener[]>()
    maxListeners:number=15
    constructor() {
    }
    setMaxListeners(n:number){
        this.maxListeners=n
        return this
    }
    private getListeners(event:EventDeliver.EventName){
        const listeners:EventDeliver.Listener[]=[...(this._events.get(event)||[])]
        if(typeof event==='string' && (!event.startsWith('before-') && !event.startsWith('after-'))){
            listeners.unshift(...(this._events.get('before-'+event)||[]))
            listeners.push(...(this._events.get('after-'+event)||[]))
        }
        return listeners
    }
    getMaxListeners(){
        return this.maxListeners
    }
    listeners(event?:EventDeliver.EventName){
        if(!event) return [...this._events.values()].flat()
        return [...(this._events.get(event)||[])]
    }
    on(event:EventDeliver.EventName,listener:EventDeliver.Listener,prepend?:boolean){
        return this.addListener(event,listener,prepend)
    }
    addListener(event:EventDeliver.EventName,listener:EventDeliver.Listener,prepend?:boolean):EventDeliver.Dispose{
        if(!this._events.get(event))this._events.set(event,[])
        const listeners:EventDeliver.Listener[]=this._events.get(event)
        if(listeners.length>=this.maxListeners)console.warn(`event:${event.toString()} listeners out of maxListeners`)
        const method:'push'|'unshift'=prepend?'unshift':'push'
        listeners[method](listener)
        const _this=this
        const dispose:EventDeliver.Dispose=(()=>EventDeliver.remove(listeners,listener)) as EventDeliver.Dispose
        return new Proxy(dispose,{
            get(target:EventDeliver.Dispose, p: PropertyKey, receiver: any): any {
                return Reflect.get(_this,p,receiver)
            }
        })
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
        if(!event) this._events=new Map<EventDeliver.EventName, EventDeliver.Listener[]>()
        if(!listener) this._events.set(event,[])
        return EventDeliver.remove(this._events.get(event),listener)
    }
    off(event?:EventDeliver.EventName,listener?:EventDeliver.Listener){
        return this.removeListener(event,listener)
    }
    async emitAsync(event:EventDeliver.EventName,...args:any[]){
        for(const listener of this.getListeners(event)){
            await listener.apply(this,args)
        }
    }
    emit(event:EventDeliver.EventName,...args:any[]){
        this.emitAsync(event,...args)
    }
    before(event:string,listener:EventDeliver.Listener){
        return this.on('before-'+event,listener)
    }
    after(event:string,listener:EventDeliver.Listener){
        return this.on('after-'+event,listener)
    }
    async bailSync(event:EventDeliver.EventName,...args:any[]){
        for(const listener of this.getListeners(event)){
            const result=await listener.apply(this,args)
            if(result) return result
        }
    }
    bail(event:EventDeliver.EventName,...args:any[]){
        for(const listener of this.getListeners(event)){
            const result=listener.apply(this,args)
            if(result && !EventDeliver.isPromise(result)) return result
        }
    }
    listenerCount(event:EventDeliver.EventName){
        if(!this._events.get(event)) return 0
        return this._events.get(event).length
    }
    eventNames(){
        return [...this._events.keys()].flat()
    }
}
export namespace EventDeliver{
    export type EventName=string|symbol
    export type Listener=(...args:any[])=>any
    export type Dispose=(()=>boolean) & EventDeliver
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

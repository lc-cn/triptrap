export type MatcherFn=(...args:any[])=>boolean
export type Matcher=string|symbol|RegExp|MatcherFn
export class Trapper{
    private matchers:Map<MatcherFn,Trapper.Listener>=new Map<MatcherFn, Trapper.Listener>()
    constructor() {
    }
    private getListeners(...args:any[]){
        return [...this.matchers.keys()]
            .filter(matcherFn=>matcherFn(...args))
            .map(matcherFn=>this.matchers.get(matcherFn))
    }
    listeners(matcher?:Matcher){
        if(!matcher) return [...this.matchers.values()]
        if(typeof matcher==='function') return [this.matchers.get(matcher)].filter(Boolean)
        const result:Trapper.Listener[]=[]
        this.matchers.forEach((listener,matcherFn)=>{
            if(matcherFn(matcher)){
                result.push(listener)
            }
        })
        return result
    }
    trap(matcher:Matcher,listener:Trapper.Listener){
        return this.addMatcher(matcher,listener)
    }
    addMatcher(matcher:Matcher,listener:Trapper.Listener):Trapper.Dispose{
        if(typeof matcher !=="function")matcher=Trapper.createMatcherFn(matcher)
        this.matchers.set(matcher,listener)
        const _this=this
        const dispose:Trapper.Dispose=(()=>{
            this.matchers.delete(matcher as MatcherFn)
        }) as Trapper.Dispose
        return new Proxy(dispose,{
            get(target:Trapper.Dispose, p: PropertyKey, receiver: any): any {
                return Reflect.get(_this,p,receiver)
            }
        })
    }
    trapOnce(matcher:Matcher,listener:Trapper.Listener):Trapper.Dispose{
        const dispose=this.trap(matcher,(...args:any[])=>{
            listener(...args)
            dispose()
        })
        return dispose
    }
    offTrap(matcher:Matcher){
        if(!matcher) this.matchers=new Map<MatcherFn, Trapper.Listener>()
        const matcherFns=this.getMatchers(matcher)
        matcherFns.forEach(matcherFn=>{
            this.matchers.delete(matcherFn)
        })
    }
    async tripAsync(...args:any[]){
        for(const listener of this.getListeners(...args)){
            await listener.apply(this,args)
        }
    }
    trip(...args:any[]){
        this.tripAsync(...args)
    }
    async bailSync(...args:any[]){
        for(const listener of this.getListeners(...args)){
            const result=await listener.apply(this,args)
            if(result) return result
        }
    }
    bail(...args:any[]){
        for(const listener of this.getListeners(...args)){
            const result=listener.apply(this,args)
            if(result && !Trapper.isPromise(result)) return result
        }
    }
    private getMatchers(matcher:Matcher){
        if(typeof matcher==='function') return [matcher]
        return [...this.matchers.keys()].filter(matcherFn=>matcherFn(matcher))
    }
}
export interface TripTrapper{
    matchers:Map<MatcherFn,Listener>
    addMatcher(matcher:Matcher,listener:Listener):TripTrapper
    trap(matcher:Matcher,listener:Listener):TripTrapper
    trip(eventName:string|symbol,...args:any[]):void
    tripAsync(eventName:string|symbol,...args:any[]):Promise<void>
    bail<T=any>(eventName:string|symbol,...args:any[]):T
    bailAsync<T=any>(eventName:string|symbol,...args:any[]):Promise<T>
    listeners(matcher:Matcher):Listener[]
    delete(matcher:Matcher):TripTrapper
    clean():TripTrapper
}
export interface Listener{
    (...args:any[]):any
}
export function defineTripTrap():TripTrapper{
    const matchers:Map<MatcherFn,Listener>=new Map<MatcherFn, Listener>()
    const getMatchers:(matcher:Matcher)=>MatcherFn[]=(matcher:Matcher)=>{
        if(typeof matcher==='function') return [matcher]
        return [...matchers.keys()].filter(matcherFn=>matcherFn(matcher))
    }
    const getListeners=(...args:any[])=>{
        return [...matchers.keys()]
            .filter(matcherFn=>matcherFn(...args))
            .map(matcherFn=>matchers.get(matcherFn))
    }
    const trapper:TripTrapper= {
        matchers,
        addMatcher(matcher:Matcher,listener:Listener){
            if(typeof matcher !=="function")matcher=Trapper.createMatcherFn(matcher)
            matchers.set(matcher,listener)
            return trapper
        },
        trap(matcher: Matcher, listener: Listener) {
            return trapper.addMatcher(matcher,listener)
        },
        trip(eventName: string | symbol, ...args:any[]) {
            return trapper.tripAsync(eventName,...args)
        },
        async tripAsync(eventName:string|symbol,...args:any[]){
            for(const listener of getListeners(eventName,...args)){
                await listener.apply(this,args)
            }
        },
        bail<T=any>(eventName:string|symbol,...args:any[]):T{
            for(const listener of this.getListeners(...args)){
                const result=listener.apply(this,args)
                if(result && !Trapper.isPromise(result)) return result
            }
        },
        async bailAsync<T=any>(eventName:string|symbol,...args:any[]):Promise<T>{
            for(const listener of this.getListeners(...args)){
                const result=await listener.apply(this,args)
                if(result) return result
            }
        },
        listeners(matcher:Matcher){
          return getMatchers(matcher).map(matcherFn=>matchers.get(matcherFn))
        },
        delete(matcher){
            const matcherFns=getMatchers(matcher)
            matcherFns.forEach(matcherFn=>{
                matchers.delete(matcherFn)
            })
            return trapper
        },
        clean(){
            matchers.clear()
            return trapper
        }
    }
    return trapper
}
export namespace Trapper{
    export type Listener=(...args:any[])=>any
    export type Dispose=(()=>void) & Trapper
    export function isPromise(object:unknown):object is Promise<unknown>{
        return typeof object==='object' &&  typeof object['then']==='function' && typeof object['catch']==='function'
    }
    export function createMatcherFn(eventName:string|symbol|RegExp):MatcherFn{
        return (...args:any[])=>{
            if(["string",'symbol'].includes(typeof eventName)) return args[0]===eventName
            return (eventName as RegExp).test(args[0])
        }
    }
}
export default Trapper
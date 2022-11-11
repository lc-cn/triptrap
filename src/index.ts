export type MatcherFn=(...args:any[])=>boolean
export type Matcher=string|symbol|RegExp|MatcherFn
export class EventMatcher{
    private matchers:Map<MatcherFn,EventMatcher.Listener>=new Map<MatcherFn, EventMatcher.Listener>()
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
        const result:EventMatcher.Listener[]=[]
        this.matchers.forEach((listener,matcherFn)=>{
            if(matcherFn(matcher)){
                result.push(listener)
            }
        })
        return result
    }
    trap(matcher:Matcher,listener:EventMatcher.Listener){
        return this.addMatcher(matcher,listener)
    }
    addMatcher(matcher:Matcher,listener:EventMatcher.Listener):EventMatcher.Dispose{
        if(typeof matcher !=="function")matcher=EventMatcher.createMatcherFn(matcher)
        this.matchers.set(matcher,listener)
        const _this=this
        const dispose:EventMatcher.Dispose=(()=>{
            this.matchers.delete(matcher as MatcherFn)
        }) as EventMatcher.Dispose
        return new Proxy(dispose,{
            get(target:EventMatcher.Dispose, p: PropertyKey, receiver: any): any {
                return Reflect.get(_this,p,receiver)
            }
        })
    }
    trapOnce(matcher:Matcher,listener:EventMatcher.Listener):EventMatcher.Dispose{
        const dispose=this.trap(matcher,(...args:any[])=>{
            listener(...args)
            dispose()
        })
        return dispose
    }
    offTrap(matcher:Matcher){
        if(!matcher) this.matchers=new Map<MatcherFn, EventMatcher.Listener>()
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
    async tripOnceSync(...args:any[]){
        for(const listener of this.getListeners(...args)){
            const result=await listener.apply(this,args)
            if(result) return result
        }
    }
    tripOnce(...args:any[]){
        for(const listener of this.getListeners(...args)){
            const result=listener.apply(this,args)
            if(result && !EventMatcher.isPromise(result)) return result
        }
    }
    private getMatchers(matcher:Matcher){
        if(typeof matcher==='function') return [matcher]
        return [...this.matchers.keys()].filter(matcherFn=>matcherFn(matcher))
    }
}
export namespace EventMatcher{
    export type Listener=(...args:any[])=>any
    export type Dispose=(()=>boolean) & EventMatcher
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
export default EventMatcher
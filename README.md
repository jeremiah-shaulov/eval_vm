# eval_vm - Evaluate JavaScript-like expressions safely

Probably you know, that regular `eval()` is not safe, because things like `Content-Security-Policy: script-src` can break it.
This library provides much safer function!

This library introduces `safeEval()` function, that knows to interpret and execute code, expressed in language, that is a subset of JavaScript. I'll call this language `EvalVmScript`.

During code execution, `globalThis` object is substituted with one that you provide, and all property accesses on all objects can be intercepted and rejected.

### Example:

```ts
import {safeEval} from "https://deno.land/x/eval_vm@v0.0.5/mod.ts";

// 1. Prepare fake "globalThis" object
const globalThis: any = {Object, Array, String, Number, Math, JSON};
globalThis.globalThis = globalThis;
globalThis.self = globalThis;

// 2. Handler that intercepts property access
const handler: ProxyHandler<any> =
{	get(target, prop)
	{	if (typeof(target)!='function' && prop!='prototype' && prop!='__proto__')
		{	return target[prop];
		}
	},

	set(target, prop, value)
	{	if (target == globalThis)
		{	target[prop] = value;
		}
		return true;
	},

	deleteProperty()
	{	// won't delete
		return true;
	}
};

// 3. Call safeEval
let result = await safeEval(`'Hello '.charAt(3) + 'World'.length`, globalThis, handler);
console.log(result); // prints 'l5'

// 4. Call safeEval
result = await safeEval(`String.prototype.charAt = null;  'a'.charAt(0)`, globalThis, handler);
console.log(result); // prints 'a'

// 5. Call safeEval
result = await safeEval(`a = {allowed: true};  a.notAllowed = true`, globalThis, handler);
console.log(globalThis.a); // prints {allowed: true}
```

## What's implemented

Currently only the following JavaScript things are implemented:

- Values: numbers, strings, names, etc.
- Operations: `.` `?.` `+` `-` `*` `/` `%` `**` `!` `~` `++` `--` `<<` `>>` `>>>` `&` `|` `^` `&&` `||` `??` `<` `<=` `==` `===` `!=` `!==` `>=` `>` `=` `+=` `-=` `*=` `/=` `%=` `**=` `<<=` `>>=` `>>>=` `&=` `|=` `^=` `&&=` `||=` `??=` `,` `...` `typeof` `void` `delete` `in` `instanceof`, `new`
- `if - else`

Not implemented:
- `var`, `let`, `const` (only global variables in the provided `globalThis` can be used)
- Loops
- Block labels
- Lambdas
- Function and class declarations

If some called function returned `Promise`, this promise is automatically awaited-for.

## Access handler

Third argument to `safeEval()` is called `handler`, and it can contain the following interception methods:

- `get(target: object, prop: string, globalThis: any): any` - catches property read access
- `set(target: object, prop: string, value: any, globalThis: any): boolean` - catches property write access
- `deleteProperty(target: object, prop: string): boolean` - catches property deletion
- `apply(func: Function, thisArg: any, argArray: any[]): any` - catches method call
- `construct(ctor: Function, argArray: any[], globalThis: any): object` - catches class instantiation

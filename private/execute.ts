import {OpCode} from "./compile.ts";
import {Bytecode} from "./bytecode.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

class Name
{	constructor(public name: string, public boundThis: Any)
	{
	}

	get(globalThis: unknown, handler: ProxyHandler<Any>)
	{	if (this.boundThis == null)
		{	throw new Error(`Tried to access "${this.name}" on null`);
		}
		if (handler.get)
		{	return handler.get(this.boundThis, this.name, globalThis);
		}
		else
		{	return this.boundThis[this.name];
		}
	}

	set(value: Any, globalThis: unknown, handler: ProxyHandler<Any>)
	{	if (this.boundThis == null)
		{	throw new Error(`Tried to call "${this.name}" on null`);
		}
		if (handler.set)
		{	handler.set(this.boundThis, this.name, value, globalThis);
		}
		else
		{	this.boundThis[this.name] = value;
		}
		return value;
	}

	deleteProperty(handler: ProxyHandler<Any>)
	{	if (handler.deleteProperty)
		{	return !!handler.deleteProperty(this.boundThis, this.name);
		}
		else
		{	return delete this.boundThis[this.name];
		}
	}

	apply(args: Any[], globalThis: unknown, handler: ProxyHandler<Any>)
	{	const func = this.get(globalThis, handler);
		if (func == null)
		{	throw new Error(`Object doesn't have nonnull property "${this.name}"`);
		}
		if (handler.apply)
		{	return handler.apply(func, this.boundThis, args);
		}
		else
		{	return func.apply(this.boundThis, args);
		}
	}

	construct(args: Any[], globalThis: unknown, handler: ProxyHandler<Any>)
	{	const ctor: Any = this.get(globalThis, handler);
		if (ctor == null)
		{	throw new Error(`Object doesn't have nonnull property "${this.name}"`);
		}
		if (handler.construct)
		{	return handler.construct(ctor, args, globalThis as Any);
		}
		else
		{	return new ctor(...args);
		}
	}
}

class Spread
{	constructor(public value: Any)
	{
	}
}

export function safeEval(expr: string|Bytecode, globalThis: unknown={}, handler: ProxyHandler<Any>={})
{	const bytecode = expr instanceof Bytecode ? expr : new Bytecode(expr);
	return executeBytecode(bytecode, globalThis, handler);
}

async function executeBytecode(bytecode: Bytecode, globalThis: unknown, handler: ProxyHandler<Any>)
{	const {opCodes, values} = bytecode;
	const stack: Any[] = [];
	let stackLen = 0;
	const scopes = [{i: 0, iEnd: bytecode.length}];
	let scopesLen = 1;

	function valueOf(value: Any)
	{	if (value instanceof Name)
		{	value = value.get(globalThis, handler);
		}
		return value;
	}

	while (scopesLen-- > 0)
	{	let {i, iEnd} = scopes[scopesLen];
		for (; i<iEnd; i+=2)
		{	const opCode = opCodes[i];
			switch (opCode)
			{	case OpCode.VALUE:
					stack[stackLen++] = values[opCodes[i+1]];
					break;
				case OpCode.NAME:
					stack[stackLen++] = new Name(values[opCodes[i+1]]+'', globalThis);
					break;
				case OpCode.DOT:
				{	const name = stack[--stackLen];
					if (!(name instanceof Name))
					{	throw new Error('Invalid operand');
					}
					name.boundThis = valueOf(stack[stackLen-1]);
					stack[stackLen-1] = name;
					break;
				}
				case OpCode.QEST_DOT:
				{	const name = stack[--stackLen];
					if (!(name instanceof Name))
					{	throw new Error('Invalid operand');
					}
					const value = valueOf(stack[stackLen-1]);
					if (value != null)
					{	name.boundThis = value;
						stack[stackLen-1] = name;
					}
					else
					{	stack[stackLen-1] = value;
					}
					break;
				}
				case OpCode.GET:
				{	let name = valueOf(stack[--stackLen]);
					const value = valueOf(stack[stackLen-1]);
					if (typeof(name) == 'number')
					{	stack[stackLen-1] = value[name];
					}
					else
					{	name += '';
						stack[stackLen-1] = new Name(name, value);
					}
					break;
				}
				case OpCode.CALL:
				{	const nArgs = opCodes[i+1]|0;
					const args: unknown[] = [];
					for (let i=stackLen-nArgs; i<stackLen; i++)
					{	const value = valueOf(stack[i]);
						if (value instanceof Spread)
						{	for (const v of value.value)
							{	args[args.length] = v;
							}
						}
						else
						{	args[args.length] = value;
						}
					}
					stackLen -= nArgs;
					const func = stack[stackLen-1];
					let result: unknown;
					if (func instanceof Name)
					{	result = func.apply(args, globalThis, handler);
					}
					else
					{	if (func == null)
						{	throw new Error(`Tried to call null`);
						}
						if (handler.apply)
						{	result = handler.apply(func, globalThis, args);
						}
						else
						{	result = func.apply(globalThis, args);
						}
					}
					if (result instanceof Promise)
					{	result = await result;
					}
					stack[stackLen-1] = result;
					break;
				}
				case OpCode.NEW:
				{	const nArgs = opCodes[i+1]|0;
					const args: unknown[] = [];
					for (let i=stackLen-nArgs; i<stackLen; i++)
					{	const value = valueOf(stack[i]);
						if (value instanceof Spread)
						{	for (const v of value.value)
							{	args[args.length] = v;
							}
						}
						else
						{	args[args.length] = value;
						}
					}
					stackLen -= nArgs;
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Cannot instantiate such value');
					}
					stack[stackLen-1] = a.construct(args, globalThis, handler);
					break;
				}
				case OpCode.DISCARD:
				{	valueOf(stack[--stackLen]); // evaluate for side effects
					break;
				}
				case OpCode.ARRAY:
				{	const nArgs = opCodes[i+1]|0;
					const args: unknown[] = [];
					for (let i=stackLen-nArgs; i<stackLen; i++)
					{	const value = valueOf(stack[i]);
						if (value instanceof Spread)
						{	for (const v of value.value)
							{	args[args.length] = v;
							}
						}
						else
						{	args[args.length] = value;
						}
					}
					stackLen -= nArgs;
					stack[stackLen++] = args;
					break;
				}
				case OpCode.OBJECT:
				{	const nArgs = opCodes[i+1]|0;
					const obj: Record<string, unknown> = {};
					for (let i=stackLen-nArgs; i<stackLen;)
					{	const name = valueOf(stack[i++]);
						if (name instanceof Spread)
						{	for (const [k, v] of Object.entries(name.value))
							{	obj[k] = v;
							}
						}
						else
						{	const value = valueOf(stack[i++]);
							obj[name] = value;
						}
					}
					stackLen -= nArgs;
					stack[stackLen++] = obj;
					break;
				}
				case OpCode.STRING_TEMPLATE:
				{	const nArgs = opCodes[i+1]|0;
					const strings: Any = [];
					const raw: string[] = [];
					const args: unknown[] = [strings];
					strings.raw = raw;
					for (let i=stackLen-nArgs; true; i++)
					{	strings[strings.length] = stack[i++] + '';
						raw[raw.length] = stack[i++] + '';
						if (i >= stackLen)
						{	break;
						}
						args[args.length] = valueOf(stack[i]);
					}
					stackLen -= nArgs;
					const func = stack[stackLen-1];
					let result: unknown;
					if (func instanceof Name)
					{	result = func.apply(args, globalThis, handler);
					}
					else
					{	if (func == null)
						{	throw new Error(`Tried to call null`);
						}
						if (handler.apply)
						{	result = handler.apply(func, globalThis, args);
						}
						else
						{	result = func.apply(globalThis, args);
						}
					}
					stack[stackLen-1] = result;
					break;
				}
				case OpCode.IF:
				case OpCode.IF_NOT_NULL:
				{	const thenBlockSize = opCodes[i+1]|0;
					const thenStart = i + 2;
					const thenEnd = thenStart + thenBlockSize;
					const elseBlockSize = opCodes[thenEnd+1]|0; // OpCode.ELSE
					const elseStart = thenEnd + 2;
					const elseEnd = elseStart + elseBlockSize;
					const cond = valueOf(stack[stackLen-1]);
					scopes[scopesLen++] = {i: elseEnd+2, iEnd}; // i after ENDIF
					if (opCode==OpCode.IF ? cond : cond!=null)
					{	i = thenStart;
						iEnd = thenEnd;
					}
					else
					{	i = elseStart;
						iEnd = elseEnd;
					}
					i -= 2; // will i += 2 on next iter
					break;
				}
				case OpCode.UNARY_PLUS:
					stack[stackLen-1] = +valueOf(stack[stackLen-1]);
					break;
				case OpCode.NEG:
					stack[stackLen-1] = -valueOf(stack[stackLen-1]);
					break;
				case OpCode.INV:
					stack[stackLen-1] = ~valueOf(stack[stackLen-1]);
					break;
				case OpCode.NOT:
					stack[stackLen-1] = !valueOf(stack[stackLen-1]);
					break;
				case OpCode.INC:
				{	const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid operand to ++');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) + 1, globalThis, handler);
					break;
				}
				case OpCode.DEC:
				{	const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid operand to --');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) - 1, globalThis, handler);
					break;
				}
				case OpCode.INC_LATER:
				{	const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid operand to ++');
					}
					const value = a.get(globalThis, handler);
					a.set(value + 1, globalThis, handler);
					stack[stackLen-1] = value;
					break;
				}
				case OpCode.DEC_LATER:
				{	const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid operand to ++');
					}
					const value = a.get(globalThis, handler);
					a.set(value - 1, globalThis, handler);
					stack[stackLen-1] = value;
					break;
				}
				case OpCode.TYPEOF:
					stack[stackLen-1] = typeof(valueOf(stack[stackLen-1]));
					break;
				case OpCode.VOID:
					valueOf(stack[stackLen-1]); // evaluate for side effects
					stack[stackLen-1] = undefined;
					break;
				case OpCode.DELETE:
				{	const a = stack[stackLen-1];
					let result = true;
					if (a instanceof Name)
					{	result = a.deleteProperty(handler);
					}
					stack[stackLen-1] = result;
					break;
				}
				case OpCode.SPREAD:
					stack[stackLen-1] = new Spread(valueOf(stack[stackLen-1]));
					break;
				case OpCode.IN:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) in valueOf(b);
					break;
				}
				case OpCode.INSTANCEOF:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) instanceof valueOf(b);
					break;
				}
				case OpCode.ADD:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) + valueOf(b);
					break;
				}
				case OpCode.SUB:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) - valueOf(b);
					break;
				}
				case OpCode.MUL:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) * valueOf(b);
					break;
				}
				case OpCode.DIV:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) / valueOf(b);
					break;
				}
				case OpCode.MOD:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) % valueOf(b);
					break;
				}
				case OpCode.POW:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) ** valueOf(b);
					break;
				}
				case OpCode.SAL:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) << valueOf(b);
					break;
				}
				case OpCode.SAR:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) >> valueOf(b);
					break;
				}
				case OpCode.SHR:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) >>> valueOf(b);
					break;
				}
				case OpCode.BITWISE_AND:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) & valueOf(b);
					break;
				}
				case OpCode.BITWISE_OR:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) | valueOf(b);
					break;
				}
				case OpCode.BITWISE_XOR:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) ^ valueOf(b);
					break;
				}
				case OpCode.LT:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) < valueOf(b);
					break;
				}
				case OpCode.GT:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) > valueOf(b);
					break;
				}
				case OpCode.LE:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) <= valueOf(b);
					break;
				}
				case OpCode.GE:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) >= valueOf(b);
					break;
				}
				case OpCode.EQ:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) == valueOf(b);
					break;
				}
				case OpCode.NE:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) != valueOf(b);
					break;
				}
				case OpCode.EQ_STRICT:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) === valueOf(b);
					break;
				}
				case OpCode.NE_STRICT:
				{	const b = stack[--stackLen];
					stack[stackLen-1] = valueOf(stack[stackLen-1]) !== valueOf(b);
					break;
				}
				case OpCode.ASSIGN:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(b, globalThis, handler);
					break;
				}
				case OpCode.ASSIGN_ADD:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) + b, globalThis, handler);
					break;
				}
				case OpCode.ASSIGN_SUB:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) - b, globalThis, handler);
					break;
				}
				case OpCode.ASSIGN_MUL:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) * b, globalThis, handler);
					break;
				}
				case OpCode.ASSIGN_DIV:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) / b, globalThis, handler);
					break;
				}
				case OpCode.ASSIGN_MOD:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) % b, globalThis, handler);
					break;
				}
				case OpCode.ASSIGN_POW:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) ** b, globalThis, handler);
					break;
				}
				case OpCode.ASSIGN_SAL:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) << b, globalThis, handler);
					break;
				}
				case OpCode.ASSIGN_SAR:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) >> b, globalThis, handler);
					break;
				}
				case OpCode.ASSIGN_SHR:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) >>> b, globalThis, handler);
					break;
				}
				case OpCode.ASSIGN_BITWISE_AND:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) & b, globalThis, handler);
					break;
				}
				case OpCode.ASSIGN_BITWISE_OR:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) | b, globalThis, handler);
					break;
				}
				case OpCode.ASSIGN_BITWISE_XOR:
				{	const b = valueOf(stack[--stackLen]);
					const a = stack[stackLen-1];
					if (!(a instanceof Name))
					{	throw new Error('Invalid left-hand side in assignment');
					}
					stack[stackLen-1] = a.set(a.get(globalThis, handler) ^ b, globalThis, handler);
					break;
				}
				default:
					throw new Error('VM error');
			}
		}
	}

	if (stackLen != 1)
	{	throw new Error('VM error');
	}

	return valueOf(stack[0]);
}

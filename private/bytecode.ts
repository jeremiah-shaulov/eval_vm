import {compile, OpCode, ExitType} from "./compile.ts";
import {jstok} from "./deps.ts";
import {safeEval} from "./execute.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

// deno-lint-ignore ban-types
type Handler = ProxyHandler<object>;

export class Bytecode
{	opCodes: OpCode[] = [];
	values: Any[] = [];

	constructor(expr='')
	{	if (expr)
		{	const it = jstok(expr);
			const {exitType} = compile(this, it);
			if (exitType != ExitType.EOF)
			{	throw new SyntaxError('Invalid expression');
			}
		}
	}

	add(opCode: OpCode, value: Any)
	{	this.opCodes.push(opCode);
		this.values.push(value);
	}

	safeEval(globalThis: unknown={}, handler: Handler={})
	{	safeEval(this, globalThis, handler);
	}

	toString()
	{	const {opCodes, values} = this;
		let indent = '';
		let str = '';
		for (let i=0, iEnd=opCodes.length; i<iEnd; i++)
		{	str += indent;
			switch (opCodes[i])
			{	case OpCode.VALUE:
					str += `VALUE ${JSON.stringify(values[i])}\n`;
					break;
				case OpCode.NAME:
					str += `NAME ${values[i]}\n`;
					break;
				case OpCode.DOT:
					str += `DOT\n`;
					break;
				case OpCode.QEST_DOT:
					str += `QEST_DOT\n`;
					break;
				case OpCode.GET:
					str += `GET\n`;
					break;
				case OpCode.CALL:
					str += `CALL ${values[i]}\n`;
					break;
				case OpCode.NEW:
					str += `NEW ${values[i]}\n`;
					break;
				case OpCode.DISCARD:
					str += `DISCARD\n`;
					break;
				case OpCode.ARRAY:
					str += `ARRAY ${values[i]}\n`;
					break;
				case OpCode.OBJECT:
					str += `OBJECT ${values[i]}\n`;
					break;
				case OpCode.STRING_TEMPLATE:
					str += `STRING_TEMPLATE ${values[i]}\n`;
					break;
				case OpCode.IF:
					str += `IF ${values[i]}\n`;
					indent += '\t';
					break;
				case OpCode.IF_NOT_NULL:
					str += `IF_NOT_NULL ${values[i]}\n`;
					indent += '\t';
					break;
				case OpCode.ELSE:
					str = str.slice(0, -1);
					str += `ELSE ${values[i]}\n`;
					break;
				case OpCode.ENDIF:
					str = str.slice(0, -1);
					indent = indent.slice(0, -1);
					str += `ENDIF\n`;
					break;
				case OpCode.UNARY_PLUS:
					str += `UNARY_PLUS\n`;
					break;
				case OpCode.NEG:
					str += `NEG\n`;
					break;
				case OpCode.INV:
					str += `INV\n`;
					break;
				case OpCode.NOT:
					str += `NOT\n`;
					break;
				case OpCode.INC:
					str += `INC\n`;
					break;
				case OpCode.DEC:
					str += `DEC\n`;
					break;
				case OpCode.INC_LATER:
					str += `INC_LATER\n`;
					break;
				case OpCode.DEC_LATER:
					str += `DEC_LATER\n`;
					break;
				case OpCode.TYPEOF:
					str += `TYPEOF\n`;
					break;
				case OpCode.VOID:
					str += `VOID\n`;
					break;
				case OpCode.DELETE:
					str += `DELETE\n`;
					break;
				case OpCode.SPREAD:
					str += `SPREAD\n`;
					break;
				case OpCode.IN:
					str += `IN\n`;
					break;
				case OpCode.INSTANCEOF:
					str += `INSTANCEOF\n`;
					break;
				case OpCode.ADD:
					str += `ADD\n`;
					break;
				case OpCode.SUB:
					str += `SUB\n`;
					break;
				case OpCode.MUL:
					str += `MUL\n`;
					break;
				case OpCode.DIV:
					str += `DIV\n`;
					break;
				case OpCode.MOD:
					str += `MOD\n`;
					break;
				case OpCode.POW:
					str += `POW\n`;
					break;
				case OpCode.SAL:
					str += `SAL\n`;
					break;
				case OpCode.SAR:
					str += `SAR\n`;
					break;
				case OpCode.SHR:
					str += `SHR\n`;
					break;
				case OpCode.BITWISE_AND:
					str += `BITWISE_AND\n`;
					break;
				case OpCode.BITWISE_OR:
					str += `BITWISE_OR\n`;
					break;
				case OpCode.BITWISE_XOR:
					str += `BITWISE_XOR\n`;
					break;
				case OpCode.LT:
					str += `LT\n`;
					break;
				case OpCode.GT:
					str += `GT\n`;
					break;
				case OpCode.LE:
					str += `LE\n`;
					break;
				case OpCode.GE:
					str += `GE\n`;
					break;
				case OpCode.EQ:
					str += `EQ\n`;
					break;
				case OpCode.NE:
					str += `NE\n`;
					break;
				case OpCode.EQ_STRICT:
					str += `EQ_STRICT\n`;
					break;
				case OpCode.NE_STRICT:
					str += `NE_STRICT\n`;
					break;
				case OpCode.ASSIGN:
					str += `ASSIGN\n`;
					break;
				case OpCode.ASSIGN_ADD:
					str += `ASSIGN_ADD\n`;
					break;
				case OpCode.ASSIGN_SUB:
					str += `ASSIGN_SUB\n`;
					break;
				case OpCode.ASSIGN_MUL:
					str += `ASSIGN_MUL\n`;
					break;
				case OpCode.ASSIGN_DIV:
					str += `ASSIGN_DIV\n`;
					break;
				case OpCode.ASSIGN_MOD:
					str += `ASSIGN_MOD\n`;
					break;
				case OpCode.ASSIGN_POW:
					str += `ASSIGN_POW\n`;
					break;
				case OpCode.ASSIGN_SAL:
					str += `ASSIGN_SAL\n`;
					break;
				case OpCode.ASSIGN_SAR:
					str += `ASSIGN_SAR\n`;
					break;
				case OpCode.ASSIGN_SHR:
					str += `ASSIGN_SHR\n`;
					break;
				case OpCode.ASSIGN_BITWISE_AND:
					str += `ASSIGN_BITWISE_AND\n`;
					break;
				case OpCode.ASSIGN_BITWISE_OR:
					str += `ASSIGN_BITWISE_OR\n`;
					break;
				case OpCode.ASSIGN_BITWISE_XOR:
					str += `ASSIGN_BITWISE_XOR\n`;
					break;
			}
		}
		return str;
	}
}

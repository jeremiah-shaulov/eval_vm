import {Bytecode} from "./bytecode.ts";
import {Token, TokenType} from "./deps.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

const C_PAREN_OPEN = '('.charCodeAt(0);
const C_PAREN_CLOSE = ')'.charCodeAt(0);
const C_SQUARE_OPEN = '['.charCodeAt(0);
const C_SQUARE_CLOSE = ']'.charCodeAt(0);
const C_BRACE_OPEN = '{'.charCodeAt(0);
const C_BRACE_CLOSE = '}'.charCodeAt(0);
const C_LT = '<'.charCodeAt(0);
const C_GT = '>'.charCodeAt(0);
const C_EQ = '='.charCodeAt(0);
const C_EXCL = '!'.charCodeAt(0);
const C_QEST = '?'.charCodeAt(0);
const C_COLON = ':'.charCodeAt(0);
const C_DOT = '.'.charCodeAt(0);
const C_PLUS = '+'.charCodeAt(0);
const C_MINUS = '-'.charCodeAt(0);
const C_TIMES = '*'.charCodeAt(0);
const C_SLASH = '/'.charCodeAt(0);
const C_PERCENT = '%'.charCodeAt(0);
const C_COMMA = ','.charCodeAt(0);
const C_SEMICOLON = ';'.charCodeAt(0);
const C_TILDA = '~'.charCodeAt(0);
const C_AMP = '&'.charCodeAt(0);
const C_PIPE = '|'.charCodeAt(0);
const C_CARET = '^'.charCodeAt(0);

export const enum OpCode
{	VALUE,
	NAME,
	DOT,
	QEST_DOT,
	GET,
	CALL,
	NEW,
	DISCARD,
	ARRAY,
	OBJECT,
	STRING_TEMPLATE,
	IF,
	IF_NOT_NULL,
	ELSE,
	ENDIF,
	UNARY_PLUS,
	NEG,
	INV,
	NOT,
	INC,
	DEC,
	INC_LATER,
	DEC_LATER,
	TYPEOF,
	VOID,
	DELETE,
	SPREAD,
	IN,
	INSTANCEOF,
	ADD,
	SUB,
	MUL,
	DIV,
	MOD,
	POW,
	SAL,
	SAR,
	SHR,
	BITWISE_AND,
	BITWISE_OR,
	BITWISE_XOR,
	LT,
	GT,
	LE,
	GE,
	EQ,
	NE,
	EQ_STRICT,
	NE_STRICT,
	ASSIGN,
	ASSIGN_ADD,
	ASSIGN_SUB,
	ASSIGN_MUL,
	ASSIGN_DIV,
	ASSIGN_MOD,
	ASSIGN_POW,
	ASSIGN_SAL,
	ASSIGN_SAR,
	ASSIGN_SHR,
	ASSIGN_BITWISE_AND,
	ASSIGN_BITWISE_OR,
	ASSIGN_BITWISE_XOR,
}

const ASSOC_RIGHT = 0x100;

const PRECEDENCE =
[	100, // VALUE
	100, // NAME
	20, // DOT
	20, // QEST_DOT
	20, // GET
	19, // CALL
	18, // NEW,
	0, // DISCARD
	20, // ARRAY
	20, // OBJECT
	20, // STRING_TEMPLATE
	6, // IF,
	6, // IF_NOT_NULL
	6, // ELSE,
	4, // ENDIF
	18, // UNARY_PLUS
	18, // NEG
	18, // INV
	18, // NOT
	18, // INC
	18, // DEC
	18, // INC_LATER
	18, // DEC_LATER
	18, // TYPEOF
	18, // VOID,
	18, // DELETE,
	18, // SPREAD
	13, // IN
	13, // INSTANCEOF
	15, // PLUS
	15, // MINUS
	16, // MUL
	16, // DIV
	16, // MOD
	17, // POW
	14, // SAL,
	14, // SAR,
	14, // SHR,
	11, // BITWISE_AND,
	9, // BITWISE_OR,
	10, // BITWISE_XOR,
	13, // LT,
	13, // GT,
	13, // LE,
	13, // GE,
	12, // EQ,
	12, // NE,
	12, // EQ_STRICT,
	12, // NE_STRICT,
	2 + ASSOC_RIGHT, // ASSIGN,
	2 + ASSOC_RIGHT, // ASSIGN_ADD,
	2 + ASSOC_RIGHT, // ASSIGN_SUB,
	2 + ASSOC_RIGHT, // ASSIGN_MUL,
	2 + ASSOC_RIGHT, // ASSIGN_DIV,
	2 + ASSOC_RIGHT, // ASSIGN_MOD,
	2 + ASSOC_RIGHT, // ASSIGN_POW,
	2 + ASSOC_RIGHT, // ASSIGN_SAL,
	2 + ASSOC_RIGHT, // ASSIGN_SAR,
	2 + ASSOC_RIGHT, // ASSIGN_SHR,
	2 + ASSOC_RIGHT, // ASSIGN_BITWISE_AND,
	2 + ASSOC_RIGHT, // ASSIGN_BITWISE_OR,
	2 + ASSOC_RIGHT, // ASSIGN_BITWISE_XOR,
];

const enum ExprType
{	PRIMARY, // toplevel expression (where block can start)
	PRIMARY_ONE_STMT, // toplevel expression: read 1 statement
	SECONDARY, // in parentheses, square brackets, etc.
	TO_COMMA, // secondary: read to expression end
	TO_COMMA_OR_PIPEPIPE, // secondary: read to expression end or to '||' operator
	FUNC_ARGS, // in function arguments (parentheses)
	ARRAY, // in array constructor ([...])
	OBJECT, // in object constructor ({...})
	STRING_TEMPLATE_CONCAT, // in param of not tagged string template (`...`)
	STRING_TEMPLATE, // in param of *tagged* string template (tag`...`)
}

export const enum ExitType
{	EOF, // Stopped at end of code. "redoToken" is undefined.
	PAREN_CLOSE, // Stopped at ')'. "redoToken" is the ')' token.
	SQUARE_CLOSE, // Stopped at ']'. "redoToken" is the ']' token.
	BRACE_CLOSE, // Stopped at '}'. "redoToken" is the '}' token.
	COMMA, // Stopped at ','. "redoToken" is the ',' token.
	SEMICOLON, // Stopped at ';'. "redoToken" is the ';' token.
	NEW_EXPR, // Stopped at first token after newline that terminated previous statement. "redoToken" is the next token that must be redone.
	PIPEPIPE, // Stopped at '||' (in ExprType.TO_COMMA_OR_PIPEPIPE). "redoToken" is the '||' token.
	STRING_TEMPLATE_MID, // Stopped at TokenType.STRING_TEMPLATE_MID token (in ExprType.STRING_TEMPLATE_CONCAT or ExprType.STRING_TEMPLATE). "redoToken" is the TokenType.STRING_TEMPLATE_MID.
	STRING_TEMPLATE_END, // Stopped at TokenType.STRING_TEMPLATE_END token (in ExprType.STRING_TEMPLATE_CONCAT or ExprType.STRING_TEMPLATE). "redoToken" is the TokenType.STRING_TEMPLATE_END.
	COLON, // Stopped at ':' of ternary operator (in ExprType.TO_COMMA or ExprType.TO_COMMA_OR_PIPEPIPE). "redoToken" is the ':' token.
}

const enum Expecting
{	VALUE,
	OPERATION,
	NEW_STMT,
}

export class SyntaxError extends Error
{	constructor(public origMessage: string, public nLine: number, public nColumn: number)
	{	super(`Syntax error at ${nLine}:${nColumn}: ${origMessage}`);
	}
}

export function compile(bytecode: Bytecode, it: Generator<Token>, exprType=ExprType.PRIMARY, opCodesBuffer: number[]=[], valuesBuffer: Any[]=[]): {redoToken: Token|undefined, exitType: ExitType, nArgs: number}
{	const {opCodes, values} = bytecode;
	let expecting = Expecting.VALUE;
	let pendingOp = OpCode.VALUE; // OpCode.VALUE for nothing
	let opCodeValue = 0;
	const pendingUnaryOps = [];
	let lastOpI = -1;
	let nArgs = 1;
	let isStmtStart = true;
	let lastToken: Token | undefined;
	let lastWhitespaceToken: Token | undefined;
	var redoToken: Token | undefined;
	let token: Token | undefined;

	/*	When `expecting` == Expecting.VALUE:
			- If unary prefix operation arrives, it will be pushed to `pendingUnaryOps`.
			- If operand (number, string, etc.) arrives, it will be added to `bytecode`, and `expecting` will be switched to Expecting.OPERATION.

		When `expecting` == Expecting.OPERATION:
			- If operation (add, subtract, etc.) arrives, it will be set to `pendingOp`, and `expecting` will be switched to Expecting.VALUE.

		When `expecting` == Expecting.VALUE:
			- If after adding operand, there was nonempty `pendingOp` (`pendingOp != OpCode.VALUE`), this pending operation will be added to `bytecode`, and `pendingOp` will be reset.
			After adding `pendingOp`, operations at previous insert position (when last time added `pendingOp`) will be considered, and all operations with lower precedence will be moved to the end of `bytecode` array.
	 */

	while (true)
	{	if (redoToken)
		{	token = redoToken;
			redoToken = undefined;
		}
		else
		{	token = it.next().value;
			if (!token)
			{	break;
			}
		}

		const isAfterNewLine = lastWhitespaceToken && lastWhitespaceToken.nLine != token.nLine ? lastWhitespaceToken : undefined;
		lastWhitespaceToken = undefined;

		if (expecting == Expecting.VALUE)
		{	// Value (operand) expected
			switch (token.type)
			{	case TokenType.WHITESPACE:
					if (!isAfterNewLine)
					{	lastWhitespaceToken = token;
					}
					continue;
				case TokenType.COMMENT:
					lastWhitespaceToken = isAfterNewLine;
					continue;
				case TokenType.MORE_REQUEST:
					lastWhitespaceToken = isAfterNewLine;
					lastToken = token;
					continue;
				case TokenType.STRING:
				case TokenType.STRING_TEMPLATE:
					bytecode.add(OpCode.VALUE, token.getValue());
					break;
				case TokenType.STRING_TEMPLATE_BEGIN:
				{	bytecode.add(OpCode.VALUE, token.getValue());
					let exitType;
					while (true)
					{	exitType = compile(bytecode, it, ExprType.STRING_TEMPLATE_CONCAT, opCodesBuffer, valuesBuffer).exitType;
						if (exitType == ExitType.STRING_TEMPLATE_END)
						{	break;
						}
						if (exitType != ExitType.STRING_TEMPLATE_MID)
						{	throw new SyntaxError('String template not complete', token.nLine, token.nColumn);
						}
					}
					break;
				}
				case TokenType.NUMBER:
					bytecode.add(OpCode.VALUE, token.getNumberValue());
					break;
				case TokenType.REGEXP:
					bytecode.add(OpCode.VALUE, token.getRegExpValue());
					break;
				case TokenType.IDENT:
					switch (token.text)
					{	case 'true':
							bytecode.add(OpCode.VALUE, true);
							break;
						case 'false':
							bytecode.add(OpCode.VALUE, false);
							break;
						case 'null':
							bytecode.add(OpCode.VALUE, null);
							break;
						case 'undefined':
							bytecode.add(OpCode.VALUE, undefined);
							break;
						case 'NaN':
							bytecode.add(OpCode.VALUE, NaN);
							break;
						case 'Infinity':
							bytecode.add(OpCode.VALUE, Infinity);
							break;
						case 'typeof':
							pendingUnaryOps[pendingUnaryOps.length] = OpCode.TYPEOF;
							continue;
						case 'void':
							pendingUnaryOps[pendingUnaryOps.length] = OpCode.VOID;
							continue;
						case 'delete':
							pendingUnaryOps[pendingUnaryOps.length] = OpCode.DELETE;
							continue;
						case 'new':
							pendingUnaryOps[pendingUnaryOps.length] = OpCode.NEW;
							continue;
						case 'if':
							if (isStmtStart)
							{	redoToken = compileIf(bytecode, it, opCodesBuffer, valuesBuffer);
								expecting = Expecting.NEW_STMT;
								break;
							}
							bytecode.add(OpCode.NAME, token.text);
							break;
						default:
							bytecode.add(OpCode.NAME, token.text);
							break;
					}
					break;
				case TokenType.OTHER:
					switch (token.text.length)
					{	case 1:
							switch (token.text.charCodeAt(0))
							{	case C_PLUS:
									pendingUnaryOps[pendingUnaryOps.length] = OpCode.UNARY_PLUS;
									continue;
								case C_MINUS:
									pendingUnaryOps[pendingUnaryOps.length] = OpCode.NEG;
									continue;
								case C_TILDA:
									pendingUnaryOps[pendingUnaryOps.length] = OpCode.INV;
									continue;
								case C_EXCL:
									pendingUnaryOps[pendingUnaryOps.length] = OpCode.NOT;
									continue;
								case C_PAREN_OPEN:
									if (compile(bytecode, it, ExprType.SECONDARY, opCodesBuffer, valuesBuffer).exitType != ExitType.PAREN_CLOSE)
									{	throw new SyntaxError('Unbalanced parentheses', token.nLine, token.nColumn);
									}
									break;
								case C_PAREN_CLOSE:
									// func call with 0 arguments
									if (exprType!=ExprType.FUNC_ARGS || !isStmtStart || pendingUnaryOps.length!=0)
									{	throw new SyntaxError('Unexpected parenthesis close', token.nLine, token.nColumn);
									}
									return {redoToken: token, exitType: ExitType.PAREN_CLOSE, nArgs: 0};
								case C_SQUARE_OPEN:
								{	const {exitType, nArgs} = compile(bytecode, it, ExprType.ARRAY, opCodesBuffer, valuesBuffer);
									if (exitType != ExitType.SQUARE_CLOSE)
									{	throw new SyntaxError('Unbalanced square bracket', token.nLine, token.nColumn);
									}
									bytecode.add(OpCode.ARRAY, nArgs);
									break;
								}
								case C_SQUARE_CLOSE:
									// empty array: []
									if (exprType!=ExprType.ARRAY || !isStmtStart || pendingUnaryOps.length!=0)
									{	throw new SyntaxError('Unexpected square bracket close', token.nLine, token.nColumn);
									}
									return {redoToken: token, exitType: ExitType.SQUARE_CLOSE, nArgs: 0};
								case C_BRACE_OPEN:
								{	if (isStmtStart && (exprType==ExprType.PRIMARY || exprType==ExprType.PRIMARY_ONE_STMT))
									{	// deno-lint-ignore no-inner-declarations no-redeclare
										var {redoToken, exitType} = compile(bytecode, it, ExprType.PRIMARY, opCodesBuffer, valuesBuffer);
										if (exitType != ExitType.BRACE_CLOSE)
										{	throw new SyntaxError('Unbalanced braces', token.nLine, token.nColumn);
										}
										if (exprType == ExprType.PRIMARY_ONE_STMT)
										{	return {redoToken, exitType, nArgs};
										}
										redoToken = undefined;
									}
									else
									{	const nArgs = compileObject(bytecode, it, opCodesBuffer, valuesBuffer);
										bytecode.add(OpCode.OBJECT, nArgs);
									}
									break;
								}
								case C_BRACE_CLOSE:
									// "}" that terminates object
									if (exprType!=ExprType.OBJECT || pendingOp!=OpCode.VALUE || pendingUnaryOps.length!=0)
									{	throw new SyntaxError('Unexpected brace close', token.nLine, token.nColumn);
									}
									return {redoToken: token, exitType: ExitType.BRACE_CLOSE, nArgs: 1};
								case C_SEMICOLON:
									// double semicolon
									if (!isStmtStart || pendingUnaryOps.length!=0 || exprType!=ExprType.PRIMARY)
									{	throw new SyntaxError('Unexpected semicolon', token.nLine, token.nColumn);
									}
									continue;
								default:
									throw new SyntaxError('Unexpected token', token.nLine, token.nColumn);
							}
							break;
						case 2:
							switch (token.text.charCodeAt(0)*256 + token.text.charCodeAt(1))
							{	case C_PLUS*256 + C_PLUS:
									pendingUnaryOps[pendingUnaryOps.length] = OpCode.INC;
									continue;
								case C_MINUS*256 + C_MINUS:
									pendingUnaryOps[pendingUnaryOps.length] = OpCode.DEC;
									continue;
								default:
									throw new SyntaxError('Unexpected token', token.nLine, token.nColumn);
							}
							break;
						case 3:
							if (token.text == '...')
							{	if (pendingOp!=OpCode.VALUE || pendingUnaryOps.length!=0 || (exprType!=ExprType.FUNC_ARGS && exprType!=ExprType.ARRAY))
								{	throw new SyntaxError('Misplaced spread operator', token.nLine, token.nColumn);
								}
								pendingUnaryOps[pendingUnaryOps.length] = OpCode.SPREAD;
								continue;
							}
							else
							{	throw new SyntaxError('Unexpected token', token.nLine, token.nColumn);
							}
							break;
						default:
							throw new SyntaxError('Unexpected token', token.nLine, token.nColumn);
					}
					break;
				default:
					throw new SyntaxError('Unexpected token', token.nLine, token.nColumn);
			}
		}
		else
		{	// Operation expected
			switch (token.type)
			{	case TokenType.WHITESPACE:
					if (!isAfterNewLine)
					{	lastWhitespaceToken = token;
					}
					continue;
				case TokenType.COMMENT:
					lastWhitespaceToken = isAfterNewLine;
					continue;
				case TokenType.MORE_REQUEST:
					lastWhitespaceToken = isAfterNewLine;
					lastToken = token;
					continue;
				case TokenType.STRING_TEMPLATE:
				{	bytecode.add(OpCode.VALUE, token.getValue());
					bytecode.add(OpCode.VALUE, token.text.slice(1, -1)); // raw part
					pendingOp = OpCode.STRING_TEMPLATE;
					opCodeValue = 2;
					expecting = Expecting.VALUE;
					break;
				}
				case TokenType.STRING_TEMPLATE_BEGIN:
				{	bytecode.add(OpCode.VALUE, token.getValue());
					bytecode.add(OpCode.VALUE, token.text.slice(1, -2)); // raw part
					let nParts = 2;
					let exitType;
					while (true)
					{	exitType = compile(bytecode, it, ExprType.STRING_TEMPLATE, opCodesBuffer, valuesBuffer).exitType;
						nParts += 3;
						if (exitType == ExitType.STRING_TEMPLATE_END)
						{	break;
						}
						if (exitType != ExitType.STRING_TEMPLATE_MID)
						{	throw new SyntaxError('String template not complete', token.nLine, token.nColumn);
						}
					}
					pendingOp = OpCode.STRING_TEMPLATE;
					opCodeValue = nParts;
					expecting = Expecting.VALUE;
					break;
				}
				case TokenType.STRING_TEMPLATE_MID:
				case TokenType.STRING_TEMPLATE_END:
					bytecode.add(OpCode.VALUE, token.getValue());
					if (exprType == ExprType.STRING_TEMPLATE_CONCAT)
					{	bytecode.add(OpCode.ADD, 0); // concat param
						bytecode.add(OpCode.ADD, 0); // concat string part (STRING_TEMPLATE_MID or STRING_TEMPLATE_END)
					}
					else if (exprType == ExprType.STRING_TEMPLATE)
					{	// add raw part
						bytecode.add(OpCode.VALUE, token.text.slice(1, token.type==TokenType.STRING_TEMPLATE_MID ? -2 : -1)); // }...${  or  }...`
					}
					else
					{	throw new SyntaxError('Unexpected token', token.nLine, token.nColumn);
					}
					return {redoToken: token, exitType: token.type==TokenType.STRING_TEMPLATE_MID ? ExitType.STRING_TEMPLATE_MID : ExitType.STRING_TEMPLATE_END, nArgs: 1};
				case TokenType.IDENT:
					switch (token.text)
					{	case 'in':
							pendingOp = OpCode.IN;
							opCodeValue = 0;
							expecting = Expecting.VALUE;
							continue;
						case 'instanceof':
							pendingOp = OpCode.INSTANCEOF;
							opCodeValue = 0;
							expecting = Expecting.VALUE;
							continue;
					}
					break;
				case TokenType.OTHER:
					switch (token.text.length)
					{	case 1:
							switch (token.text.charCodeAt(0))
							{	case C_DOT:
									pendingOp = OpCode.DOT;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_PLUS:
									pendingOp = OpCode.ADD;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_MINUS:
									pendingOp = OpCode.SUB;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_TIMES:
									pendingOp = OpCode.MUL;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_SLASH:
									pendingOp = OpCode.DIV;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_PERCENT:
									pendingOp = OpCode.MOD;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_LT:
									pendingOp = OpCode.LT;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_GT:
									pendingOp = OpCode.GT;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_AMP:
									pendingOp = OpCode.BITWISE_AND;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_PIPE:
									pendingOp = OpCode.BITWISE_OR;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_CARET:
									pendingOp = OpCode.BITWISE_XOR;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_EQ:
									pendingOp = OpCode.ASSIGN;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_QEST:
								{	// IF
									bytecode.add(OpCode.IF, 0);
									let len = opCodes.length;
									bytecode.add(OpCode.DISCARD, 0);
									if (compile(bytecode, it, ExprType.TO_COMMA, opCodesBuffer, valuesBuffer).exitType != ExitType.COLON)
									{	throw new SyntaxError('Ternary operator not terminated', token.nLine, token.nColumn);
									}
									values[len - 1] = opCodes.length - len;
									// ELSE
									bytecode.add(OpCode.ELSE, 0);
									len = opCodes.length;
									bytecode.add(OpCode.DISCARD, 0);
									// deno-lint-ignore no-inner-declarations no-redeclare
									var {redoToken, exitType} = compile(bytecode, it, ExprType.TO_COMMA, opCodesBuffer, valuesBuffer);
									values[len - 1] = opCodes.length - len;
									if (exitType!=ExitType.EOF && exitType!=ExitType.PAREN_CLOSE && exitType!=ExitType.SEMICOLON && exitType!=ExitType.NEW_EXPR && exitType!=ExitType.COMMA && exitType!=ExitType.COLON)
									{	throw new SyntaxError('Invalid expression', token.nLine, token.nColumn);
									}
									// ENDIF
									pendingOp = OpCode.ENDIF; // although ENDIF is not used by execute(), it helps me to jump from here to precedence resolution block below
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									break;
								}
								case C_COLON:
									// ':' in ternary operator
									return {redoToken: token, exitType: ExitType.COLON, nArgs: 1};
								case C_COMMA:
									switch (exprType)
									{	case ExprType.OBJECT: // ',' that terminates object name-value
										case ExprType.TO_COMMA:
										case ExprType.TO_COMMA_OR_PIPEPIPE:
											return {redoToken: token, exitType: ExitType.COMMA, nArgs: 1};
										case ExprType.ARRAY:
										case ExprType.FUNC_ARGS:
											nArgs++;
											break;
										default:
											bytecode.add(OpCode.DISCARD, 0);
											lastOpI = -1;
									}
									pendingOp = OpCode.VALUE;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_SEMICOLON:
									switch (exprType)
									{	case ExprType.OBJECT:
											throw new SyntaxError('Object expression not terminated', token.nLine, token.nColumn);
										case ExprType.ARRAY:
											throw new SyntaxError('Array expression not terminated', token.nLine, token.nColumn);
										case ExprType.FUNC_ARGS:
											throw new SyntaxError('Unexpected semicolon in function arguments', token.nLine, token.nColumn);
										case ExprType.STRING_TEMPLATE:
										case ExprType.STRING_TEMPLATE_CONCAT:
											throw new SyntaxError('Unexpected semicolon in string template parameter', token.nLine, token.nColumn);
										case ExprType.PRIMARY_ONE_STMT:
										case ExprType.TO_COMMA:
										case ExprType.TO_COMMA_OR_PIPEPIPE:
											return {redoToken: token, exitType: ExitType.SEMICOLON, nArgs: 1};
									}
									bytecode.add(OpCode.DISCARD, 0);
									lastOpI = -1;
									isStmtStart = true;
									nArgs = 1;
									pendingOp = OpCode.VALUE;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_PAREN_OPEN:
								{	const {nArgs, exitType} = compile(bytecode, it, ExprType.FUNC_ARGS, opCodesBuffer, valuesBuffer);
									if (exitType != ExitType.PAREN_CLOSE)
									{	throw new SyntaxError('Unbalanced parentheses', token.nLine, token.nColumn);
									}
									opCodeValue = nArgs;
									pendingOp = OpCode.CALL;
									expecting = Expecting.VALUE;
									break;
								}
								case C_PAREN_CLOSE:
									return {redoToken: token, exitType: ExitType.PAREN_CLOSE, nArgs};
								case C_SQUARE_OPEN:
								{	const {exitType} = compile(bytecode, it, ExprType.SECONDARY, opCodesBuffer, valuesBuffer);
									if (exitType != ExitType.SQUARE_CLOSE)
									{	throw new SyntaxError('Unbalanced square bracket', token.nLine, token.nColumn);
									}
									pendingOp = OpCode.GET;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									break;
								}
								case C_SQUARE_CLOSE:
									return {redoToken: token, exitType: ExitType.SQUARE_CLOSE, nArgs};
								case C_BRACE_CLOSE:
									// '}' that terminates object or block
									return {redoToken: token, exitType: ExitType.BRACE_CLOSE, nArgs};
							}
							break;
						case 2:
							switch (token.text.charCodeAt(0)*256 + token.text.charCodeAt(1))
							{	case C_TIMES*256 + C_TIMES:
									pendingOp = OpCode.POW;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_QEST*256 + C_DOT:
									pendingOp = OpCode.QEST_DOT;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_LT*256 + C_EQ:
									pendingOp = OpCode.LE;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_GT*256 + C_EQ:
									pendingOp = OpCode.GE;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_EQ*256 + C_EQ:
									pendingOp = OpCode.EQ;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_EXCL*256 + C_EQ:
									pendingOp = OpCode.NE;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_LT*256 + C_LT:
									pendingOp = OpCode.SAL;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_GT*256 + C_GT:
									pendingOp = OpCode.SAR;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_PLUS*256 + C_EQ:
									pendingOp = OpCode.ASSIGN_ADD;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_MINUS*256 + C_EQ:
									pendingOp = OpCode.ASSIGN_SUB;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_TIMES*256 + C_EQ:
									pendingOp = OpCode.ASSIGN_MUL;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_SLASH*256 + C_EQ:
									pendingOp = OpCode.ASSIGN_DIV;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_PERCENT*256 + C_EQ:
									pendingOp = OpCode.ASSIGN_MOD;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_AMP*256 + C_EQ:
									pendingOp = OpCode.ASSIGN_BITWISE_AND;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_PIPE*256 + C_EQ:
									pendingOp = OpCode.ASSIGN_BITWISE_OR;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_CARET*256 + C_EQ:
									pendingOp = OpCode.ASSIGN_BITWISE_XOR;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_PLUS*256 + C_PLUS:
									pendingOp = OpCode.INC_LATER;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									break;
								case C_MINUS*256 + C_MINUS:
									pendingOp = OpCode.DEC_LATER;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									break;
								case C_AMP*256 + C_AMP:
								{	// IF
									bytecode.add(OpCode.IF, 0);
									const len = opCodes.length;
									bytecode.add(OpCode.DISCARD, 0);
									// deno-lint-ignore no-inner-declarations no-redeclare
									var {redoToken, exitType} = compile(bytecode, it, ExprType.TO_COMMA_OR_PIPEPIPE, opCodesBuffer, valuesBuffer);
									values[len - 1] = opCodes.length - len;
									// ELSE
									bytecode.add(OpCode.ELSE, 0);
									// ENDIF
									if (exitType!=ExitType.EOF && exitType!=ExitType.PAREN_CLOSE && exitType!=ExitType.SEMICOLON && exitType!=ExitType.NEW_EXPR && exitType!=ExitType.COMMA && exitType!=ExitType.COLON && exitType!=ExitType.PIPEPIPE)
									{	throw new SyntaxError('Invalid expression', token.nLine, token.nColumn);
									}
									pendingOp = OpCode.ENDIF; // although ENDIF is not used by execute(), it helps me to jump from here to precedence resolution block below
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									break;
								}
								case C_PIPE*256 + C_PIPE:
								case C_QEST*256 + C_QEST:
								{	if (exprType == ExprType.TO_COMMA_OR_PIPEPIPE)
									{	return {redoToken: token, exitType: ExitType.PIPEPIPE, nArgs};
									}
									// IF
									bytecode.add(token.text.charCodeAt(0)==C_QEST ? OpCode.IF_NOT_NULL : OpCode.IF, 0);
									// ELSE
									bytecode.add(OpCode.ELSE, 0);
									const len = opCodes.length;
									bytecode.add(OpCode.DISCARD, 0);
									// deno-lint-ignore no-inner-declarations no-redeclare
									var {redoToken, exitType} = compile(bytecode, it, ExprType.TO_COMMA, opCodesBuffer, valuesBuffer);
									values[len - 1] = opCodes.length - len;
									// ENDIF
									if (exitType!=ExitType.EOF && exitType!=ExitType.PAREN_CLOSE && exitType!=ExitType.SEMICOLON && exitType!=ExitType.NEW_EXPR && exitType!=ExitType.COMMA && exitType!=ExitType.COLON)
									{	throw new SyntaxError('Invalid expression', token.nLine, token.nColumn);
									}
									pendingOp = OpCode.ENDIF; // although ENDIF is not used by execute(), it helps me to jump from here to precedence resolution block below
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									break;
								}
							}
							break;
						case 3:
							switch (token.text.charCodeAt(0)*0x10000 + token.text.charCodeAt(1)*0x100 + token.text.charCodeAt(2))
							{	case C_EQ*0x10000 + C_EQ*0x100 + C_EQ:
									pendingOp = OpCode.EQ_STRICT;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_EXCL*0x10000 + C_EQ*0x100 + C_EQ:
									pendingOp = OpCode.NE_STRICT;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_GT*0x10000 + C_GT*0x100 + C_GT:
									pendingOp = OpCode.SHR;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_TIMES*0x10000 + C_TIMES*0x100 + C_EQ:
									pendingOp = OpCode.ASSIGN_POW;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_LT*0x10000 + C_LT*0x100 + C_EQ:
									pendingOp = OpCode.ASSIGN_SAL;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_GT*0x10000 + C_GT*0x100 + C_EQ:
									pendingOp = OpCode.ASSIGN_SAR;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
								case C_AMP*0x10000 + C_AMP*0x100 + C_EQ:
								{	// IF
									bytecode.add(OpCode.IF, 0);
									const len = opCodes.length;
									// deno-lint-ignore no-inner-declarations no-redeclare
									var {redoToken, exitType} = compile(bytecode, it, ExprType.TO_COMMA_OR_PIPEPIPE, opCodesBuffer, valuesBuffer);
									bytecode.add(OpCode.ASSIGN, 0);
									values[len - 1] = opCodes.length - len;
									// ELSE
									bytecode.add(OpCode.ELSE, 0);
									// ENDIF
									if (exitType!=ExitType.EOF && exitType!=ExitType.PAREN_CLOSE && exitType!=ExitType.SEMICOLON && exitType!=ExitType.NEW_EXPR && exitType!=ExitType.COMMA && exitType!=ExitType.COLON && exitType!=ExitType.PIPEPIPE)
									{	throw new SyntaxError('Invalid expression', token.nLine, token.nColumn);
									}
									pendingOp = OpCode.ENDIF; // although ENDIF is not used by execute(), it helps me to jump from here to precedence resolution block below
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									break;
								}
								case C_PIPE*0x10000 + C_PIPE*0x100 + C_EQ:
								case C_QEST*0x10000 + C_QEST*0x100 + C_EQ:
								{	if (exprType == ExprType.TO_COMMA_OR_PIPEPIPE)
									{	return {redoToken: token, exitType: ExitType.PIPEPIPE, nArgs};
									}
									// IF
									bytecode.add(token.text.charCodeAt(0)==C_QEST ? OpCode.IF_NOT_NULL : OpCode.IF, 0);
									// ELSE
									bytecode.add(OpCode.ELSE, 0);
									const len = opCodes.length;
									// deno-lint-ignore no-inner-declarations no-redeclare
									var {redoToken, exitType} = compile(bytecode, it, ExprType.TO_COMMA, opCodesBuffer, valuesBuffer);
									bytecode.add(OpCode.ASSIGN, 0);
									values[len - 1] = opCodes.length - len;
									// ENDIF
									if (exitType!=ExitType.EOF && exitType!=ExitType.PAREN_CLOSE && exitType!=ExitType.SEMICOLON && exitType!=ExitType.NEW_EXPR && exitType!=ExitType.COMMA && exitType!=ExitType.COLON)
									{	throw new SyntaxError('Invalid expression', token.nLine, token.nColumn);
									}
									pendingOp = OpCode.ENDIF; // although ENDIF is not used by execute(), it helps me to jump from here to precedence resolution block below
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									break;
								}
							}
							break;
						case 4:
							switch (token.text)
							{	case '>>>=':
									pendingOp = OpCode.ASSIGN_SHR;
									opCodeValue = 0;
									expecting = Expecting.VALUE;
									continue;
							}
							break;
					}
					break;
			}
		}

		if (expecting == Expecting.OPERATION)
		{	if (!isAfterNewLine)
			{	throw new SyntaxError('Unexpected token', token.nLine, token.nColumn);
			}
			if (exprType==ExprType.PRIMARY_ONE_STMT || exprType==ExprType.TO_COMMA || exprType==ExprType.TO_COMMA_OR_PIPEPIPE)
			{	return {redoToken: token, exitType: ExitType.NEW_EXPR, nArgs: 1};
			}
			redoToken = token;
			lastWhitespaceToken = isAfterNewLine;
			bytecode.add(OpCode.DISCARD, 0);
			lastOpI = -1;
			isStmtStart = true;
			nArgs = 1;
			pendingOp = OpCode.VALUE;
			opCodeValue = 0;
			expecting = Expecting.VALUE;
		}
		else
		{	isStmtStart = false;
			// unary operations are not added immediately, and now is the time to add them
			for (const opCode of pendingUnaryOps)
			{	bytecode.add(opCode, 0);
			}
			// reorder operations according to their precedence, and remember where last operation inserted (lastOpI)
			if (pendingOp != OpCode.VALUE)
			{	const precAssoc = PRECEDENCE[pendingOp];
				const prec = precAssoc & ~ASSOC_RIGHT;
				let j = lastOpI;
				if (!(precAssoc & ASSOC_RIGHT))
				{	// left associative
					while (j > 0 && (PRECEDENCE[opCodes[j]] & ~ASSOC_RIGHT) < prec)
					{	j--;
					}
				}
				else
				{	// right associative
					while (j > 0 && (PRECEDENCE[opCodes[j]] & ~ASSOC_RIGHT) <= prec)
					{	j--;
					}
				}
				const prevLastOpI = lastOpI;
				lastOpI = opCodes.length;
				if (j < prevLastOpI)
				{	const shiftBlockLen = prevLastOpI - j++;
					let pos = lastOpI;
					if (pendingOp==OpCode.CALL && opCodes[j]==OpCode.NEW)
					{	// CALL followed by NEW - merge to single NEW
						values[j] = opCodeValue;
					}
					else
					{	bytecode.add(pendingOp, opCodeValue);
						pos++;
					}
					/*	I want to perform:

						const opCodesSlice = opCodes.splice(j, shiftBlockLen);
						const valuesSlice = values.splice(j, shiftBlockLen);
						opCodes.splice(opCodes.length, 0, ...opCodesSlice);
						values.splice(values.length, 0, ...valuesSlice);

						The following is optimized version of this
					 */
					for (let k=0; k<shiftBlockLen; j++, k++)
					{	opCodesBuffer[k] = opCodes[j];
						valuesBuffer[k] = values[j];
					}
					for (let k=j-shiftBlockLen; j<pos; j++, k++)
					{	opCodes[k] = opCodes[j];
						values[k] = values[j];
					}
					j -= shiftBlockLen;
					for (let k=0; k<shiftBlockLen; j++, k++)
					{	opCodes[j] = opCodesBuffer[k];
						values[j] = valuesBuffer[k];
					}
				}
				else
				{	bytecode.add(pendingOp, opCodeValue);
				}
				expecting = Expecting.OPERATION;
				pendingOp = OpCode.VALUE;
				opCodeValue = 0;
			}
			else
			{	if (lastOpI==-1 && pendingUnaryOps.length!=0)
				{	lastOpI = opCodes.length - 1;
				}
				if (expecting == Expecting.NEW_STMT)
				{	bytecode.add(OpCode.DISCARD, 0);
					expecting = Expecting.VALUE;
				}
				else
				{	expecting = Expecting.OPERATION;
				}
			}
			// done
			pendingUnaryOps.length = 0;
		}
	}

	if (pendingOp!=OpCode.VALUE || expecting==Expecting.VALUE)
	{	throw new SyntaxError('Invalid expression', lastToken?.nLine ?? 1, lastToken?.nColumn ?? 1);
	}
	return {redoToken: undefined, exitType: ExitType.EOF, nArgs};
}

function compileObject(bytecode: Bytecode, it: Generator<Token>, opCodesBuffer: number[]=[], valuesBuffer: Any[]=[])
{	let state = false; // false: key expected; true: colon expected
	let nArgs = 0;
	let lastToken: Token | undefined;
	let token: Token | undefined;

	while ((token = it.next().value))
	{	if (!state)
		{	switch (token.type)
			{	case TokenType.WHITESPACE:
				case TokenType.COMMENT:
					continue;
				case TokenType.MORE_REQUEST:
					lastToken = token;
					continue;
				case TokenType.STRING:
					bytecode.add(OpCode.VALUE, token.getValue());
					break;
				case TokenType.NUMBER:
					bytecode.add(OpCode.VALUE, token.getNumberValue());
					break;
				case TokenType.IDENT:
					bytecode.add(OpCode.VALUE, token.getValue());
					break;
				case TokenType.OTHER:
					if (token.text.length == 1)
					{	switch (token.text.charCodeAt(0))
						{	case C_SQUARE_OPEN:
							{	const {exitType} = compile(bytecode, it, ExprType.SECONDARY, opCodesBuffer, valuesBuffer);
								if (exitType != ExitType.SQUARE_CLOSE)
								{	throw new SyntaxError('Unbalanced square bracket', token.nLine, token.nColumn);
								}
								break;
							}
							case C_BRACE_CLOSE:
								return nArgs;
							default:
								throw new SyntaxError('Unexpected token', token.nLine, token.nColumn);
						}
					}
					else if (token.text == '...')
					{	const {exitType} = compile(bytecode, it, ExprType.OBJECT, opCodesBuffer, valuesBuffer);
						bytecode.add(OpCode.SPREAD, 0);
						nArgs++;
						if (exitType == ExitType.BRACE_CLOSE)
						{	return nArgs;
						}
						if (exitType != ExitType.COMMA)
						{	throw new SyntaxError('Unbalanced brace', token.nLine, token.nColumn);
						}
						continue;
					}
					else
					{	throw new SyntaxError('Unexpected token', token.nLine, token.nColumn);
					}
					break;
				default:
					throw new SyntaxError('Unexpected token', token.nLine, token.nColumn);
			}
			nArgs++;
		}
		else
		{	switch (token.type)
			{	case TokenType.WHITESPACE:
				case TokenType.COMMENT:
					continue;
				case TokenType.MORE_REQUEST:
					lastToken = token;
					continue;
				case TokenType.OTHER:
					if (token.text.length!=1 || token.text.charCodeAt(0)!=C_COLON)
					{	throw new SyntaxError('Expected ":"', token.nLine, token.nColumn);
					}
					break;
				default:
					throw new SyntaxError('Expected ":"', token.nLine, token.nColumn);
			}
			const {exitType} = compile(bytecode, it, ExprType.OBJECT, opCodesBuffer, valuesBuffer);
			nArgs++;
			if (exitType == ExitType.BRACE_CLOSE)
			{	return nArgs;
			}
			if (exitType != ExitType.COMMA)
			{	throw new SyntaxError('Unbalanced brace', token.nLine, token.nColumn);
			}
		}
		state = !state;
	}

	throw new SyntaxError('Invalid expression', lastToken?.nLine ?? 1, lastToken?.nColumn ?? 1); // must exit on '}'
}

function compileIf(bytecode: Bytecode, it: Generator<Token>, opCodesBuffer: number[]=[], valuesBuffer: Any[]=[]): Token|undefined
{	const {opCodes, values} = bytecode;
	let lastToken: Token | undefined;
	let token: Token | undefined;

	while ((token = it.next().value))
	{	switch (token.type)
		{	case TokenType.WHITESPACE:
			case TokenType.COMMENT:
				continue;
			case TokenType.MORE_REQUEST:
				lastToken = token;
				continue;
			case TokenType.OTHER:
			{	if (token.text != '(')
				{	throw new SyntaxError('Expected "(" after "if"', token.nLine, token.nColumn);
				}
				if (compile(bytecode, it, ExprType.SECONDARY, opCodesBuffer, valuesBuffer).exitType != ExitType.PAREN_CLOSE)
				{	throw new SyntaxError('Unbalanced parentheses', token.nLine, token.nColumn);
				}
				// IF
				bytecode.add(OpCode.IF, 0);
				let len = opCodes.length;
				bytecode.add(OpCode.DISCARD, 0);
				// deno-lint-ignore no-inner-declarations no-redeclare
				var {redoToken, exitType} = compile(bytecode, it, ExprType.PRIMARY_ONE_STMT, opCodesBuffer, valuesBuffer);
				values[len - 1] = opCodes.length - len;
				// ELSE
				bytecode.add(OpCode.ELSE, 0);
				len = opCodes.length;
				if (exitType==ExitType.SEMICOLON || exitType==ExitType.BRACE_CLOSE || exitType==ExitType.NEW_EXPR)
				{	if (exitType != ExitType.NEW_EXPR)
					{	redoToken = it.next().value;
					}
					while (redoToken && (redoToken.type==TokenType.WHITESPACE || redoToken.type==TokenType.COMMENT || redoToken.type==TokenType.MORE_REQUEST))
					{	redoToken = it.next().value;
					}
					if (redoToken && redoToken.type==TokenType.IDENT && redoToken.text=='else')
					{	bytecode.add(OpCode.DISCARD, 0);
						// deno-lint-ignore no-inner-declarations no-redeclare
						var {redoToken, exitType} = compile(bytecode, it, ExprType.PRIMARY_ONE_STMT, opCodesBuffer, valuesBuffer);
						values[len - 1] = opCodes.length - len;
						if (exitType==ExitType.SEMICOLON || exitType==ExitType.BRACE_CLOSE)
						{	redoToken = undefined;
						}
					}
				}
				// ENDIF
				bytecode.add(OpCode.ENDIF, 0);
				return redoToken;
			}
			default:
				throw new SyntaxError('Expected "(" after "if"', token.nLine, token.nColumn);
		}
	}

	throw new SyntaxError('Invalid expression', lastToken?.nLine ?? 1, lastToken?.nColumn ?? 1);
}

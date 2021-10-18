import {safeEval} from "../../mod.ts";
import {assert, assertEquals} from 'https://deno.land/std@0.106.0/testing/asserts.ts';

// deno-lint-ignore no-explicit-any
type Any = any;

Deno.test
(	'Basic',
	async () =>
	{	const EXPRS =
		[	`-+-Infinity`,
			`'a' - 1`,
			`'a' + 1`,
			`undefined == null`,
			`null`,
			`true`,
			`false`,
			`NaN`,
			`2 + 3 * 4 - 5`,
			`(2 + 3) * 4 - -(-5)`,
			`-(2 + 3) * 4 - -(-5)`,
			`-(2 + 3) * 4 ** 2`,
			`-2 << 3 * 2 + 4`,
			`-(2 << 3) * 2 + 4`,
			`-(2 << 3) * (4 / 2)`,
			`-Math.max(2, 4.5, 3)`,
			`"\x40".charCodeAt(0)`,
			`"abc"[1]`,
			`"a" + "b"`,
			`['a', 'b', 'c'].slice(1)`,
			`-[]`,
			`true + 2`,
			`({})`,
			`({a: false})`,
			`({a: false,})`,
			`({"a": 1, bb: '2'})`,
			`({10: 11, 11: 12})`,
			'`ABC`',
			'`ABC ${2+3} DEF`',
			'`ABC ${2+3}${6} DEF`',
			'String.raw `ABC`',
			'String.raw `ABC ${2+3} DEF`',
			'String.raw `ABC ${2+3}${6} DEF`',
			'String.raw `A\\`B\\nC`',
			'String.raw `${"A"} \\` ${"B"} \\n ${"C"}`',
			'/a/i.test(`ABC`)',
			'0 ? "y" : "n"',
			'1 ? "y" : "n"',
			'0 ? "zero" : 1 ? "one" : "other"',
			`null ?? 0 ?? "y"`,
			`0 ?? null ?? "y"`,
			`"y" ?? null ?? 0`,
			`null ?? setV(true); v`,
			`0 ?? setV(true); v`,
			`null || setV(true); v`,
			`0 || setV(true); v`,
			`null && setV(true); v`,
			`0 && setV(true); v`,
			'0 && 1 || 2 && 3',
			'0 && 1 || false && 3',
			'0 || 1 && 2 || 3',
			'0 || 1 && false || 3',
			'true ? 0 || 1 && false || 3 : "."',
			'1 ? 2 ? 3 : 4 : 5',
			'1 ? 0 ? 3 : 4 : 5',
			'true ? 0 || 1 && 1 ? 0 ? 3 : 4 : 5 || 3 : "."',
			'false ? 0 || 1 && 1 ? 0 ? 3 : -+4 : !5 + -6 || ~3 : "."',
			`({}) instanceof Object`,
			`'length' in []`,
			`1.3 % 1 < 1 && "aab" > "aaa"`,
			`0xFF & 0xF0 | 0x3 <= 0x100 ^ 1`,
			`Math.max(0.123*2, 0.1)`,
			`1, 0 ? "y" : "n"`,
			`0 ? "y" : "n", 1`,
			`1; 0 ? "y" : "n"`,
			`0 ? "y" : "n"; 1`,
			`1\n2`,
			`"a"\n"b"\n`,
			`a=1; if (a) a='y'; a`,
			`self.a=1; if (self.a) self.a="y"; self.a`,
			`a=1, b=2; a+b`,
			`a=0?1:2, b=true && "b"; a+b`,
			`a=0?1:2, b=true || "b"; a+b`,
			`a=0?1&&1:2&&2.1, b=false || "b"; a+b`,
			`a=0?1&&1:2&&2.1, b=false?'f':'t' || "b" && "c"; a+b`,
			`a=1; a&&=2`,
			`a=1; (a&&=2) + a`,
			`a=1; a||=2`,
			`a=1; (a||=2) + a`,
			`a=1; b = a ||= 2`,
			`a=1; a ||= b = 2; a+b`,
			`a=1; a &&= a && 0; a`,
			`a=1; a &&= a || 0; a`,
			`a=1; a &&= a && 2; a`,
			`a=1; a &&= a || 2; a`,
			`a=1; a &&= a ||= 2; a`,
			`a=1; a ||= a &&= 2; a`,
			`a=0; a ||= a &&= 2; a`,
			`({}) == ({})`,
			`({}) === ({})`,
			`1+2 === 3`,
			`1+2 !== 3`,
			`[].slice === [].slice`,
			`a=0x7 << 1; a >>= 2`,
			`a=-1\n a >>= 2`,
			`a=-1; a <<= 2`,
			`123456 >> 4`,
			`a=-1\n;; a >>>= 2`,
			`-1 >>> 8`,
			`[] >= {}`,
			`[] != {}`,
			`a=10; a**=3`,
			`2 < 3 + 4 * 5 / 6 ** 2`,
			`a = b = c = /./`,
			`self.fake?.prop`,
			`a={prop: [0]}; a?.prop?.length`,
			`a=-0; a+=100; a-=30; a*=0.1; a/=0.0123; a%=12; a&=a; a|=128; a^=7; a*a`,
			`JSON.stringify({[2*2 + '.']: 3e-1})`,
			`if (0) a=1\nelse a=2; a+a`,
			`if (1) {a=1\na+=2}else a=4; a+a`,
			`if (0) {a=1\na+=2}else a=4; a+a`,
			`if (1) a=4\nelse\n\n{a=1\na+=2} a+a`,
			`if (0) a=4\nelse\n\n{a=1\na+=2} a+a`,
			`typeof a`,
			`a=[]; typeof a.b`,
			`typeof('')`,
			`a=3; ++a * 2`,
			`a=3; ++a * 2; a`,
			`a=3; 5 + ++a * 2`,
			`a=3; 5 + ++a * 2; a`,
			`a=3; a++ * 2`,
			`a=3; a++ * 2; a`,
			`a=3; 5 + a++ * 2`,
			`a=3; 5 + a++ * 2; a`,
			`a={k2: "v2"}; b={k1: "v1", ...a, k3: "v3"}`,
			`a={k2: "v2", k3: "v3"}; ["k1", ...Object.keys(a), "k4"]`,
			`a=[2.1, 3.4, -5]; Math.max(...a)`,
		];

		// deno-lint-ignore no-unused-vars
		var a, b, c, v; // for eval()
		// deno-lint-ignore no-unused-vars
		function setV(newV: Any)
		{	v = newV;
		}

		for (const expr of EXPRS)
		{	const ENV: Any = {Object, String, Number, Math, JSON, setV(newV: Any) {this.v = newV}};
			ENV.self = ENV;
			ENV.globalThis = ENV;
			a = b = c = v = undefined;

			try
			{	assertEquals(await safeEval(expr, ENV), eval(expr));
			}
			catch (e)
			{	console.log(`Error in expression: ${expr}`);
				throw e;
			}
		}

		let res = await safeEval(`Math.random()`, {Math});
		assert(res>=0 && res<=1);

		res = await safeEval(`-Math.random()`, {Math});
		assert(res>=-1 && res<=0);
	}
);

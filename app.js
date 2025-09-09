'use strict';

// Calculator logic
function setupCalculator() {
	const prevEl = document.getElementById('prev');
	const currEl = document.getElementById('curr');

	let previous = '';
	let current = '0';
	let operation = null;
	let overwrite = false;

	const format = (val) => {
		if (val === '' || val === '-') return val || '0';
		const [i, d] = String(val).split('.');
		const int = Number(i);
		const intStr = Number.isFinite(int) ? int.toLocaleString(undefined) : i;
		return d != null ? `${intStr}.${d}` : intStr;
	};

	const opSymbol = (op) => ({ '/': '÷', '*': '×', '+': '+', '-': '−' }[op] || op);

	const updateDisplay = () => {
		currEl.textContent = format(current);
		prevEl.textContent = operation && previous !== '' ? `${format(previous)} ${opSymbol(operation)}` : '';
	};

	const clearAll = () => {
		previous = '';
		current = '0';
		operation = null;
		overwrite = false;
		updateDisplay();
	};

	const inputDigit = (d) => {
		if (overwrite) { current = '0'; overwrite = false; }
		if (d === '.') {
			if (current.includes('.')) return;
			current = current === '0' ? '0.' : current + '.';
			return updateDisplay();
		}
		if (current === '0') current = d; else current += d;
		updateDisplay();
	};

	const chooseOp = (op) => {
		if (current === '-' || current === '.') return;
		if (previous !== '' && current !== '' && operation) {
			compute();
		} else {
			previous = current;
		}
		operation = op;
		overwrite = true;
		updateDisplay();
	};

	const compute = () => {
		const a = parseFloat(previous);
		const b = parseFloat(current);
		if (!Number.isFinite(a) || !Number.isFinite(b) || !operation) return;
		let res = 0;
		switch (operation) {
			case '+': res = a + b; break;
			case '-': res = a - b; break;
			case '*': res = a * b; break;
			case '/': res = b === 0 ? NaN : a / b; break;
		}
		current = String(res);
		previous = '';
		operation = null;
		overwrite = true;
		updateDisplay();
	};

	const toggleSign = () => {
		if (current === '0') return;
		if (current.startsWith('-')) current = current.slice(1); else current = '-' + current;
		updateDisplay();
	};

	const percent = () => {
		const v = parseFloat(current);
		if (!Number.isFinite(v)) return;
		current = String(v / 100);
		updateDisplay();
	};

	const del = () => {
		if (overwrite) { current = '0'; overwrite = false; return updateDisplay(); }
		if (current.length <= 1 || (current.length === 2 && current.startsWith('-'))) { current = '0'; }
		else { current = current.slice(0, -1); }
		updateDisplay();
	};

	// Mouse / touch
	document.querySelectorAll('[data-num]').forEach((btn) => {
		btn.addEventListener('click', () => inputDigit(btn.textContent.trim()));
	});
	document.querySelectorAll('[data-op]').forEach((btn) => {
		btn.addEventListener('click', () => chooseOp(btn.getAttribute('data-op')));
	});
	document.querySelector('[data-action="clear"]').addEventListener('click', clearAll);
	document.querySelector('[data-action="equals"]').addEventListener('click', compute);
	document.querySelector('[data-action="sign"]').addEventListener('click', toggleSign);
	document.querySelector('[data-action="percent"]').addEventListener('click', percent);

	// Keyboard
	window.addEventListener('keydown', (e) => {
		const key = e.key;
		if (/^[0-9]$/.test(key)) { inputDigit(key); return; }
		if (key === '.') { inputDigit('.'); return; }
		if (key === '+' || key === '-' || key === '*' || key === '/') { chooseOp(key); return; }
		if (key === 'Enter' || key === '=') { e.preventDefault(); compute(); return; }
		if (key === 'Backspace') { del(); return; }
		if (key === 'Escape') { clearAll(); return; }
		if (key === '%') { percent(); return; }
	});

	// Long press on delete via context menu on display
	document.getElementById('curr').addEventListener('contextmenu', (e) => { e.preventDefault(); del(); });

	updateDisplay();
}

// Effects gating and initialization
function shouldEnableEffects() {
	const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduce) return false;
	const cores = (navigator.hardwareConcurrency || 2);
	if (cores < 4) return false;
	const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
	if (coarse) return false;
	return true;
}

function initWebGLBackground(options) {
	const DPR_CAP = options && options.dprCap ? options.dprCap : 1.5;
	const DPR = Math.min(window.devicePixelRatio || 1, DPR_CAP);
	const canvas = document.getElementById('glbg');
	const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
	if (!gl) return;

	const vertSrc = `
		attribute vec2 a;
		void main(){ gl_Position = vec4(a, 0.0, 1.0); }
	`;
	const fragSrc = `
		precision mediump float;
		uniform vec2 u_res;
		uniform float u_time;
		uniform vec2 u_mouse;
		float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
		void main(){
			vec2 uv = gl_FragCoord.xy / u_res.xy;
			vec2 p = (uv - 0.5);
			p.x *= u_res.x / u_res.y;
			vec2 m = (u_mouse - 0.5);
			m.x *= u_res.x / u_res.y;
			vec2 center = m * 0.2;
			float d = length(p - center);
			vec3 c1 = vec3(0.05, 0.06, 0.10);
			vec3 c2 = vec3(0.11, 0.13, 0.22);
			float g = smoothstep(0.85, 0.0, d);
			vec3 col = mix(c1, c2, g);
			float bands = 0.5 + 0.5 * sin(6.2831 * (d * 1.2 - u_time * 0.06));
			col += vec3(0.02, 0.016, 0.03) * bands;
			float vig = smoothstep(0.95, 0.35, length(uv - 0.5));
			col *= mix(0.75, 1.0, vig);
			float n = hash(gl_FragCoord.xy + floor(u_time*10.0));
			col += (n - 0.5) * 0.015;
			gl_FragColor = vec4(col, 1.0);
		}
	`;

	function compile(type, src){
		const s = gl.createShader(type);
		gl.shaderSource(s, src);
		gl.compileShader(s);
		return s;
	}
	const vs = compile(gl.VERTEX_SHADER, vertSrc);
	const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
	const prog = gl.createProgram();
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);
	gl.useProgram(prog);

	const locRes = gl.getUniformLocation(prog, 'u_res');
	const locTime = gl.getUniformLocation(prog, 'u_time');
	const locMouse = gl.getUniformLocation(prog, 'u_mouse');

	const buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ -1,-1, 1,-1, -1,1, 1,1 ]), gl.STATIC_DRAW);
	const locA = gl.getAttribLocation(prog, 'a');
	gl.enableVertexAttribArray(locA);
	gl.vertexAttribPointer(locA, 2, gl.FLOAT, false, 0, 0);

	let start = performance.now();
	let mouse = [0.5, 0.5];

	function resize(){
		const w = Math.floor(innerWidth * DPR);
		const h = Math.floor(innerHeight * DPR);
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w; canvas.height = h;
			canvas.style.width = '100%'; canvas.style.height = '100%';
			gl.viewport(0, 0, w, h);
			gl.uniform2f(locRes, w, h);
		}
	}
	window.addEventListener('resize', resize);
	window.addEventListener('orientationchange', resize);
	window.addEventListener('pointermove', (e) => { mouse = [ e.clientX / innerWidth, 1 - (e.clientY / innerHeight) ]; }, { passive: true });
	resize();

	function frame(){
		const t = (performance.now() - start) / 1000;
		gl.uniform1f(locTime, t);
		gl.uniform2f(locMouse, mouse[0], mouse[1]);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		requestAnimationFrame(frame);
	}
	frame();
}

function initMouseTrail(options) {
	const trail = document.getElementById('trail');
	const ctx = trail.getContext('2d');
	const points = [];
	const settings = Object.assign({ dpr: 1, scale: 0.5, maxPoints: 200, maxAge: 1.0, spacing: 4 }, options || {});
	const TDPR = settings.dpr;
	const SCALE = settings.scale;
	const maxPoints = settings.maxPoints;
	const maxAge = settings.maxAge;
	const spacing = Math.max(3, settings.spacing * TDPR);

	const off = document.createElement('canvas');
	const ox = off.getContext('2d');

	function resize2D(){
		const w = Math.floor(innerWidth * TDPR);
		const h = Math.floor(innerHeight * TDPR);
		if (trail.width !== w || trail.height !== h) {
			trail.width = w; trail.height = h;
			trail.style.width = '100%'; trail.style.height = '100%';
		}
		const ow = Math.max(2, Math.floor(w * SCALE));
		const oh = Math.max(2, Math.floor(h * SCALE));
		if (off.width !== ow || off.height !== oh) { off.width = ow; off.height = oh; }
	}
	window.addEventListener('resize', resize2D);
	window.addEventListener('orientationchange', resize2D);
	resize2D();

	const gbGreen = getComputedStyle(document.documentElement).getPropertyValue('--gb-light').trim() || '#9bbc0f';
	const tmp = document.createElement('canvas');
	const c = tmp.getContext('2d');
	c.fillStyle = gbGreen; c.fillRect(0,0,1,1);
	const d = c.getImageData(0,0,1,1).data;
	const gb = { r: d[0], g: d[1], b: d[2] };

	function pushPoint(x, y, t){
		points.push({ x, y, t });
		while (points.length > maxPoints) points.shift();
	}
	window.addEventListener('pointermove', (e) => {
		const now = performance.now() / 1000;
		const x = e.clientX * TDPR;
		const y = e.clientY * TDPR;
		const n = points.length;
		if (n > 0) {
			const last = points[n - 1];
			const dx = x - last.x; const dy = y - last.y; const dist = Math.hypot(dx, dy);
			if (dist > spacing) {
				const steps = Math.min(10, Math.floor(dist / spacing));
				for (let s = 1; s <= steps; s++) {
					const f = s / (steps + 1);
					pushPoint(last.x + dx * f, last.y + dy * f, last.t + (now - last.t) * f);
				}
			}
		}
		pushPoint(x, y, now);
	}, { passive: true });

	function lerp(a,b,t){ return a + (b - a) * t; }

	function drawTrail(){
		const now = performance.now() / 1000;
		while (points.length > 2 && (now - points[1].t) > maxAge) points.shift();
		ox.clearRect(0, 0, off.width, off.height);
		ox.globalCompositeOperation = 'source-over';
		ox.lineJoin = 'round';
		ox.lineCap = 'round';
		for (let i = 1; i < points.length; i++) {
			const p0 = points[i-1];
			const p1 = points[i];
			const age = now - p1.t;
			if (age > maxAge) continue;
			const t = 1 - (age / maxAge);
			const ease = t * t * (3 - 2 * t);
			const mx = lerp(p0.x, p1.x, 0.5);
			const my = lerp(p0.y, p1.y, 0.5);
			const sx = SCALE, sy = SCALE;
			const glowAlpha = 0.26 * ease;
			const glowW = (16 + 34 * ease) * sx;
			ox.strokeStyle = `rgba(${gb.r}, ${gb.g}, ${gb.b}, ${glowAlpha})`;
			ox.lineWidth = glowW;
			ox.shadowColor = `rgba(${gb.r}, ${gb.g}, ${gb.b}, ${0.35 * ease})`;
			ox.shadowBlur = (22 + 28 * ease) * sx;
			ox.beginPath();
			ox.moveTo(p0.x * sx, p0.y * sy);
			ox.quadraticCurveTo(p0.x * sx, p0.y * sy, mx * sx, my * sy);
			ox.stroke();
		}
		const trailW = trail.width, trailH = trail.height;
		ctx.clearRect(0, 0, trailW, trailH);
		ctx.imageSmoothingEnabled = true;
		ctx.save();
		ctx.filter = 'blur(28px)';
		ctx.globalAlpha = 0.6;
		ctx.drawImage(off, 0, 0, trailW, trailH);
		ctx.restore();
		requestAnimationFrame(drawTrail);
	}
	drawTrail();
}

function initEffectsIfAllowed() {
	if (!shouldEnableEffects()) return;
	document.body.classList.add('effects-on');
	const lowPower = (navigator.hardwareConcurrency || 2) < 8;
	const dprCap = lowPower ? 1.25 : 1.5;
	initWebGLBackground({ dprCap });
	initMouseTrail({ dpr: 1, scale: lowPower ? 0.45 : 0.5, maxPoints: lowPower ? 140 : 200, maxAge: 1.0, spacing: 4 });
}

// Boot
(function bootstrap(){
	// Calculator is light, init immediately after parse (script is deferred)
	setupCalculator();
	// Lazy-init effects during idle time
	const ric = window.requestIdleCallback || function(cb){ return setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 200); };
	ric(() => initEffectsIfAllowed());
})();


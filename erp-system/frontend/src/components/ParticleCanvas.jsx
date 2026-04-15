import React, { useEffect, useRef, useCallback } from 'react';

/* ── Configuration ─────────────────────────────────────────────── */
const LAYERS = [
    { count: 18, speedRange: [0.12, 0.28], sizeRange: [1.2, 2.2], alpha: 0.38, color: 'orange', depth: 0.4 },
    { count: 24, speedRange: [0.30, 0.55], sizeRange: [1.5, 3.0], alpha: 0.55, color: 'mix', depth: 0.65 },
    { count: 14, speedRange: [0.55, 0.90], sizeRange: [2.5, 4.5], alpha: 0.75, color: 'white', depth: 1.0 },
];
const CONNECT_DIST = 110;    // px — max distance for connection lines
const REPEL_DIST = 90;     // px — mouse repulsion radius
const REPEL_FORCE = 0.06;   // repulsion strength
const FADE_SPEED = 0.008;
const MOBILE_SCALE = 0.55;   // reduce particle count on mobile

const orange = 'rgba(255,107,0,';
const white = 'rgba(255,255,255,';

function chooseColor(type) {
    if (type === 'orange') return 'orange';
    if (type === 'white') return 'white';
    return Math.random() > 0.6 ? 'orange' : 'white';
}

function makeParticle(W, H, layer, isMobile) {
    const speed = layer.speedRange[0] + Math.random() * (layer.speedRange[1] - layer.speedRange[0]);
    const angle = Math.random() * Math.PI * 2;
    return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: layer.sizeRange[0] + Math.random() * (layer.sizeRange[1] - layer.sizeRange[0]),
        alpha: 0,                 // start transparent — fade in
        targetAlpha: layer.alpha * (0.7 + Math.random() * 0.3),
        depth: layer.depth,
        color: chooseColor(layer.color),
        fadeDir: 1,               // 1=fade in, -1=fade out
        lifePhase: Math.random(), // 0-1 cycle offset
    };
}

/* ── Main Component ─────────────────────────────────────────────── */
const ParticleCanvas = () => {
    const canvasRef = useRef(null);
    const mouse = useRef({ x: -9999, y: -9999 });
    const particles = useRef([]);
    const rafId = useRef(null);
    const isMobile = window.innerWidth < 1024;

    /* build particle pool */
    const initParticles = useCallback((W, H) => {
        const scale = isMobile ? MOBILE_SCALE : 1;
        const pool = [];
        for (const layer of LAYERS) {
            const n = Math.round(layer.count * scale);
            for (let i = 0; i < n; i++) pool.push(makeParticle(W, H, layer, isMobile));
        }
        particles.current = pool;
    }, [isMobile]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        /* resize handler */
        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            initParticles(canvas.width, canvas.height);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        /* mouse tracking — only inside left panel */
        const parent = canvas.parentElement;
        const onMove = (e) => {
            const rect = parent.getBoundingClientRect();
            mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };
        const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };
        parent.addEventListener('mousemove', onMove);
        parent.addEventListener('mouseleave', onLeave);

        /* draw glow circle */
        const drawDot = (x, y, r, color, alpha) => {
            const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5);
            const C = color === 'orange' ? orange : white;
            grd.addColorStop(0, `${C}${alpha})`);
            grd.addColorStop(0.4, `${C}${alpha * 0.55})`);
            grd.addColorStop(1, `${C}0)`);
            ctx.beginPath();
            ctx.arc(x, y, r * 3.5, 0, Math.PI * 2);
            ctx.fillStyle = grd;
            ctx.fill();
        };

        /* RAF loop */
        const loop = () => {
            const W = canvas.width, H = canvas.height;
            ctx.clearRect(0, 0, W, H);

            const mx = mouse.current.x, my = mouse.current.y;
            const pts = particles.current;

            /* update */
            for (const p of pts) {
                /* life fade (gentle pulse) */
                p.alpha += FADE_SPEED * p.fadeDir;
                if (p.alpha >= p.targetAlpha) { p.alpha = p.targetAlpha; p.fadeDir = -1; }
                if (p.alpha <= 0.05) { p.alpha = 0.05; p.fadeDir = 1; p.targetAlpha = 0.25 + Math.random() * 0.5; }

                /* mouse repulsion */
                const dx = p.x - mx, dy = p.y - my;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < REPEL_DIST && dist > 0.1) {
                    const force = (1 - dist / REPEL_DIST) * REPEL_FORCE;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }

                /* dampen velocity so it doesn't explode */
                p.vx *= 0.995;
                p.vy *= 0.995;

                /* move */
                p.x += p.vx;
                p.y += p.vy;

                /* wrap around edges */
                if (p.x < -10) p.x = W + 10;
                if (p.x > W + 10) p.x = -10;
                if (p.y < -10) p.y = H + 10;
                if (p.y > H + 10) p.y = -10;
            }

            /* connection lines (between nearby particles in same/adjacent depth) */
            ctx.save();
            for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    const a = pts[i], b = pts[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < CONNECT_DIST) {
                        const strength = (1 - d / CONNECT_DIST) * Math.min(a.alpha, b.alpha) * 0.7;
                        const isOrange = a.color === 'orange' || b.color === 'orange';
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = isOrange ? `rgba(255,107,0,${strength})` : `rgba(255,255,255,${strength * 0.6})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
            ctx.restore();

            /* draw dots (back to front by depth) */
            const sorted = [...pts].sort((a, b) => a.depth - b.depth);
            for (const p of sorted) {
                /* mouse proximity glow boost */
                const mdx = p.x - mx, mdy = p.y - my;
                const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
                const glowBoost = mdist < REPEL_DIST ? (1 - mdist / REPEL_DIST) * 1.8 : 1;
                drawDot(p.x, p.y, p.r * glowBoost, p.color, p.alpha * glowBoost);
            }

            rafId.current = requestAnimationFrame(loop);
        };
        loop();

        return () => {
            cancelAnimationFrame(rafId.current);
            ro.disconnect();
            parent.removeEventListener('mousemove', onMove);
            parent.removeEventListener('mouseleave', onLeave);
        };
    }, [initParticles]);

    return (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 0 }} />
    );
};

export default ParticleCanvas;

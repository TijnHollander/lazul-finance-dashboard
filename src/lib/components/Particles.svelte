<script lang="ts">
    import { onMount } from 'svelte';
    // staat voor nu hier denk dat we er ff een apart mapje voor moeten maken

    //https://animation-svelte.vercel.app/magic/particles <--- miss tweaken

    let {
        quantity = 67, // 67 TUN TUN SAHUR 67!!!!!
        staticity = 50,
        ease = 50,
        size = 0.4,
        color = '#ffffff',
        vx = 0,
        vy = 0,
        class: className = ''
    }: {
        quantity?: number;
        staticity?: number;
        ease?: number;
        size?: number;
        color?: string;
        vx?: number;
        vy?: number;
        class?: string;
    } = $props();

    let canvasContainer: HTMLDivElement;
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    let mouse = { x: 0, y: 0 };
    let canvasSize = { w: 0, h: 0 };

    type Circle = {
        x: number;
        y: number;
        translateX: number;
        translateY: number;
        size: number;
        alpha: number;
        targetAlpha: number;
        dx: number;
        dy: number;
        magnetism: number;
    };

    let circles: Circle[] = [];
    let animationFrame: number;

    function hexToRgb(hex: string) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex
                .split('')
                .map((c) => c + c)
                .join('');
        }
        const num = parseInt(hex, 16);
        return [num >> 16 & 255, num >> 8 & 255, num & 255];
    }

    const rgb = hexToRgb(color);

    function resizeCanvas() {
        if (!canvasContainer || !canvas || !ctx) return;
        canvasSize.w = canvasContainer.offsetWidth;
        canvasSize.h = canvasContainer.offsetHeight;
        canvas.width = canvasSize.w * dpr;
        canvas.height = canvasSize.h * dpr;
        canvas.style.width = `${canvasSize.w}px`;
        canvas.style.height = `${canvasSize.h}px`;
        ctx.scale(dpr, dpr);

        circles = [];
        for (let i = 0; i < quantity; i++) {
            circles.push(createCircle());
        }
    }

    function createCircle(): Circle {
        const x = Math.floor(Math.random() * canvasSize.w);
        const y = Math.floor(Math.random() * canvasSize.h);
        const s = Math.floor(Math.random() * 2) + size;
        const alpha = 0;
        const targetAlpha = parseFloat((Math.random() * 0.6 + 0.1).toFixed(1));
        const dx = (Math.random() - 0.5) * 0.2;
        const dy = (Math.random() - 0.5) * 0.2;
        const magnetism = 0.1 + Math.random() * 4;
        return { x, y, translateX: 0, translateY: 0, size: s, alpha, targetAlpha, dx, dy, magnetism };
    }

    function drawCircle(circle: Circle) {
        ctx.translate(circle.translateX, circle.translateY);
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${circle.alpha})`;
        ctx.fill();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function remapValue(value: number, start1: number, end1: number, start2: number, end2: number) {
        const remapped = ((value - start1) * (end2 - start2)) / (end1 - start1) + start2;
        return remapped > 0 ? remapped : 0;
    }

    function animate() {
        ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

        circles.forEach((circle, i) => {
            const edge = [
                circle.x + circle.translateX - circle.size,
                canvasSize.w - circle.x - circle.translateX - circle.size,
                circle.y + circle.translateY - circle.size,
                canvasSize.h - circle.y - circle.translateY - circle.size
            ];
            const closestEdge = Math.min(...edge);
            const remapClosestEdge = parseFloat(remapValue(closestEdge, 0, 20, 0, 1).toFixed(2));

            if (remapClosestEdge > 1) {
                circle.alpha += 0.02;
                if (circle.alpha > circle.targetAlpha) circle.alpha = circle.targetAlpha;
            } else {
                circle.alpha = circle.targetAlpha * remapClosestEdge;
            }

            circle.x += circle.dx + vx;
            circle.y += circle.dy + vy;
            circle.translateX +=
                (mouse.x / (staticity / circle.magnetism) - circle.translateX) / ease;
            circle.translateY +=
                (mouse.y / (staticity / circle.magnetism) - circle.translateY) / ease;

            if (
                circle.x < -circle.size ||
                circle.x > canvasSize.w + circle.size ||
                circle.y < -circle.size ||
                circle.y > canvasSize.h + circle.size
            ) {
                circles[i] = createCircle();
            }

            drawCircle(circle);
        });

        animationFrame = requestAnimationFrame(animate);
    }

    function handleMouseMove(e: MouseEvent) {
        if (!canvasContainer) return;
        const rect = canvasContainer.getBoundingClientRect();
        const { w, h } = canvasSize;
        const x = e.clientX - rect.left - w / 2;
        const y = e.clientY - rect.top - h / 2;
        const inside = x < w / 2 && x > -w / 2 && y < h / 2 && y > -h / 2;
        if (inside) {
            mouse.x = x;
            mouse.y = y;
        }
    }

    onMount(() => {
        ctx = canvas.getContext('2d')!;
        resizeCanvas();
        animate();

        const ro = new ResizeObserver(resizeCanvas);
        ro.observe(canvasContainer);
        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            cancelAnimationFrame(animationFrame);
            ro.disconnect();
            window.removeEventListener('mousemove', handleMouseMove);
        };
    });
</script>

<div bind:this={canvasContainer} class="pointer-events-none absolute inset-0 size-full {className}">
    <canvas bind:this={canvas}></canvas>
</div>


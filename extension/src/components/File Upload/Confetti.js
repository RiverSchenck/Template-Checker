import confetti from 'canvas-confetti';

export function triggerConfettiCelebration() {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
  
    const myConfetti = confetti.create(canvas, { resize: true });

    // Get the viewport width
    const viewportWidth = window.innerWidth;
    const shiftPx = 80;
    const originX = shiftPx / viewportWidth;

    myConfetti({
      particleCount: 500,
      spread: 150,
      zIndex: 9999,
      origin: { x: 0.5 + originX, y: 0.5 }, // Adjusting x to shift the confetti to the right
      colors: ['#F4CDFF', '#CDE0FF', '#7B58F8', '#C500C5', '#E6DFE0'],
    });
  
    setTimeout(() => {
      document.body.removeChild(canvas);
    }, 5000);
}

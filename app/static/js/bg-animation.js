/* ============================================================
   AI INTERVIEW AGENT - FUTURISTIC ANIMATED BACKGROUND ENGINE
   ============================================================ */

class CyberBackground {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'bgCanvas';
    this.ctx = this.canvas.getContext('2d');
    
    // Style Canvas element
    Object.assign(this.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
      zIndex: '0',
      opacity: '0.65',
    });

    document.body.prepend(this.canvas);

    this.particles = [];
    this.numParticles = 55;
    this.maxDistance = 140;
    this.animFrameId = null;

    this.resize();
    this.initParticles();
    this.bindEvents();
    this.animate();
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1,
        color: Math.random() > 0.4 ? '#4FD1C5' : '#6366F1',
        alpha: Math.random() * 0.6 + 0.2,
      });
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw connecting neural lines
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const p1 = this.particles[i];
        const p2 = this.particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.maxDistance) {
          const alpha = (1 - dist / this.maxDistance) * 0.25;
          this.ctx.strokeStyle = `rgba(79, 209, 197, ${alpha})`;
          this.ctx.lineWidth = 0.8;
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke();
        }
      }
    }

    // Update and draw particles
    for (let p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > this.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.height) p.vy *= -1;

      // Glow effect
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = p.color;

      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;

    this.animFrameId = requestAnimationFrame(() => this.animate());
  }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.cyberBg = new CyberBackground();
});

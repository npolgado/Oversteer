# Fix: ParticleContainer API error causing collision freeze

Summary
- Symptom: Collisions with props/enemies threw an uncaught error and froze the game (0 FPS). Error: "ParticleContainer.addChild() is not available. Please use ParticleContainer.addParticle()".

Root cause
- Pixi.js ParticleContainer API differs by version. A recent merge used addChild/removeChild on the ParticleContainer, which is not available in some Pixi builds and throws, stopping the main loop.

Fix applied
- Use ParticleContainer.addParticle/removeParticle when available, falling back to addChild/removeChild. Also handle sprite removal in clear().
- File changed: src/render/particles.ts
  - spawn(): use addParticle if present, else addChild
  - update()/cleanup: use removeParticle if present, else removeChild
  - clear(): remove particles via removeParticle when available

Reproduction
1. npm run dev
2. Play and cause a prop or enemy collision that spawns particles (near-miss / bounce)
3. Previously: Uncaught Error and freeze; Now: no error and particles spawn correctly.

Notes
- Built successfully after the change. If you want, commit the change with a proper message and Co-authored-by trailer.
- If other Pixi API mismatches appear (source-map warnings or WebGLRenderer differences), paste the console output and I'll address them.

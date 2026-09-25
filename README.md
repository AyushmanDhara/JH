# Jharkhand Industrial Safety Simulator

**Learn. Practice. Respond. Stay Safe.**

AR-ready browser-based 3D industrial safety training simulator for Jharkhand’s mining & manufacturing sector.

Built with **Three.js**, **Vite**, and a modular training engine designed so the same safety logic can later drive Android AR (ARCore / WebXR).

---

## Features

- Main Menu hub: Training, Tutorial, Progress, Certificates, How to Play, Settings
- **Fire & Explosion Response** — full interactive scenario
- **Gas Leak & Confined Space** — full interactive scenario
- **Machinery Safety** — hazard sign, PPE, e-stop, lockout/tagout
- **PPE Training** — select the correct protective equipment
- All four Training modules are fully interactive and load the same way (no lazy-chunk loading)
- Scenario-based scoring & assessment + knowledge quiz
- Digital certificates with QR code
- Certificate verification page (`verify.html`)
- Admin compliance dashboard (`admin.html`)
- English / Hindi / Santali localisation
- Offline-first PWA (Service Worker + Cache)
- Desktop (WASD + mouse) and mobile (virtual joystick) controls
- Training logic decoupled from renderer (AR-ready)

---

## Quick Start

```bash
npm install
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`).

### Build for production

```bash
npm run build
npm run preview
```

Output is in `dist/`.

### Deploy to GitHub Pages

1. Set `base: './'` in `vite.config.js` (already set).
2. Build: `npm run build`
3. Push the `dist/` folder to the `gh-pages` branch, or use the GitHub Actions workflow of your choice.
4. Enable GitHub Pages on the repository.

---

## Project Structure

```
src/
  core/           TrainingEngine, ScenarioManager, Score, Assessment, i18n, Storage…
  world/          Menu backdrop scenery, TrainingCentre rooms, Lighting, Environment
  player/         Desktop + Mobile controllers
  modules/        FireSafety, GasSafety scenario logic
  ui/             HUD
  i18n/           en.js, hi.js, sat.js
  utils/          QR, Audio, DeviceDetector
public/
index.html
verify.html
admin.html
```

---

## Controls

| Desktop | Action |
|---------|--------|
| W A S D | Move |
| Mouse   | Look |
| Shift   | Sprint |
| Space   | Jump |
| E       | Interact |
| Esc     | Pause |

| Mobile | Action |
|--------|--------|
| Left joystick | Move |
| Right area    | Look |
| Buttons       | Sprint / Jump / Interact |

---

## End-to-end flow

1. Language selection (EN / हिन्दी / ᱥᱟᱱᱛᱟᱲᱤ)
2. Main Menu → Training
3. Choose a module (Fire, Gas, Machinery, or PPE)
4. Complete interactive objectives
5. Assessment + quiz
6. Certificate + QR
7. Verify at `/verify.html`

The app opens directly to the Main Menu — there is no walk-in city or entrance step.

---

## Architecture (AR-ready)

```
TrainingEngine
  ├── ScenarioManager      ← pure logic
  ├── ObjectiveManager
  ├── AssessmentEngine
  ├── ScoreManager
  ├── CertificateManager
  ├── LocalizationManager
  ├── StorageManager
  └── Renderer
        ├── ThreeJSRenderer   (current)
        └── FutureARRenderer  (swap-in)
```

Safety rules, scoring, objectives and certificates never import Three.js.  
A future Android AR renderer only needs to:

1. Provide camera pose / hit-test surfaces  
2. Place the same virtual interactables  
3. Call `engine.scenarios.handleEvent(id)` when the user “interacts”

---

## Offline / PWA

`vite-plugin-pwa` caches JS, CSS, HTML and assets.  
After first load the simulator works without network (explore, train, certificate, local verify).

---

## License

Prototype for educational / vocational training use.

# Contributing to Choicease

Thank you for your interest in contributing to **Choicease** — we really appreciate it! 🚀  
This document explains how to report issues, propose changes, and submit code, docs, or design contributions.

## Quick links
- Live app: see `index.html` (static site entry).  
- Privacy Policy: `privacy.html` (we don't collect user data).  
  (These files are part of the repo and the site root.)  

## TL;DR — How to contribute
1. Fork the repository.
2. Create a branch for your change: `git checkout -b feat/short-summary` or `git checkout -b fix/short-summary`.
3. Make your changes, follow the style guidelines below.
4. Commit with clear messages and a DCO sign-off (see below).
5. Push to your fork and open a Pull Request (PR) against `main`.
6. Add a description, link to any live demo / screenshots, and check the PR checklist.

---

## Contributor License / License compatibility

By contributing, you license your contributions under the project's license (GNU GPL v3). That means:
- Any contribution you submit will be made available under GPL v3 (or a compatible license).
- To make contribution tracking simple and legally clear, we ask contributors to sign-off commits with the Developer Certificate of Origin (DCO) style line described below.

### DCO sign-off (recommended)
Add this line to the end of each commit message:
```

Signed-off-by: Your Name [your-email@example.com](mailto:your-email@example.com)

```
This indicates you agree the contribution is yours to submit and can be licensed under GPL v3.

---

## Code of Conduct
Please follow a friendly, professional, and inclusive tone in all interactions. If you’d like, we can add a full `CODE_OF_CONDUCT.md` — tell us and we’ll add one.

---

## Issues & Feature Requests

### How to report an issue
- Use the issue tracker to report bugs or request features.
- Include:
  - A short descriptive title.
  - A reproducible description of the bug (steps, expected vs actual).
  - Browser/OS and any console errors (for front-end issues).
  - Minimal reproducible example or link to a gist / screenshot.

### Templates
You can create these as `.github/ISSUE_TEMPLATE/*` files. Example short templates are included at the bottom of this file.

---

## Development (what you need)
Choicease is a static front-end project (HTML/CSS/JS). There is no backend.

### Local preview
1. Clone your fork:
```

git clone [https://github.com/](https://github.com/)<your-username>/choicease.git
cd choicease

````
2. Open `index.html` in your browser, or serve locally:
- Quick: `open index.html` or double-click the file.
- Local server (recommended for CORS/static behaviors):
  ```
  # Python 3
  python -m http.server 8000
  # then visit http://localhost:8000
  ```

> Note: Because Choicease is fully client-side, running locally is usually sufficient for development and testing.

---

## Project structure (high level)
- `index.html` — main app entry (UI & flows).
- `script.js` / `script (1).js` — app logic (ratings, export, PDF generation).
- `styles.css` / `styles (1).css` — styles.
- `privacy.html`, `terms.html` — policy pages.
- `LICENSE` — GPL v3 license file.
- `CONTRIBUTING.md`, `README.md`, `CODE_OF_CONDUCT.md` — project docs.

(If any names differ in your repo, adapt accordingly.)

---

## Coding & style guidelines

### HTML
- Keep markup semantic and accessible.
- Use `aria-*` attributes for interactive controls where appropriate (existing code uses ARIA).
- Keep inline scripts minimal — prefer JS modules in `script.js`.

### CSS
- Follow the existing naming and simple utility styles.
- Keep layout responsive — aim for mobile-first behavior.

### JavaScript
- Use the existing style: clear functions, comment blocks, avoid global pollution where possible.
- Keep use of third-party libs explicit (they are already included via CDN).
- Sanitize user inputs before rendering (there’s already `sanitizeInput()` used in your code).

### Tests
- No formal test harness currently; manual testing via browser is acceptable.
- If you add automated tests, include instructions to run them in this file.

---

## Commit messages
- Use imperative, present-tense style:
- `feat: add share to reddit helper`
- `fix: prevent orphaned ratings when removing an option`
- `docs: update privacy policy last-updated date`
- Include a brief body for non-trivial changes.

Always add the DCO sign-off:
````

Signed-off-by: Jane Developer [jane@example.com](mailto:jane@example.com)

```

---

## Branch naming
- Features: `feat/<short-description>` (e.g., `feat/export-csv`)
- Fixes: `fix/<short-description>` (e.g., `fix/qr-generation`)
- Docs: `docs/<short-description>`
- Chores: `chore/<short-description>`

---

## Pull Request (PR) process

When you open a PR:
- Ensure your branch is up to date with `main`.
- Provide a clear description of what you changed and why.
- Include screenshots or a short demo GIF for UI changes.
- Link relevant issues by number (`#123`) if applicable.
- Add tests or manual test steps if needed.

### PR checklist (maintainer will use this to review)
- [ ] CI / local checks pass (if any)
- [ ] Code follows style guidelines (lint / formatting)
- [ ] No console errors introduced
- [ ] Documentation updated where relevant (README, comments)
- [ ] DCO sign-off present on commits
- [ ] PR description includes screenshots or demo (if UI)

---

## Small contribution ideas (good first issues)
- Improve accessibility (aria labels, keyboard navigation).
- Add unit tests for utility functions.
- Improve documentation or examples in `README.md`.
- Add a Code of Conduct file.

---

## Templates (copy into `.github` if you want)

### ISSUE_TEMPLATE/bug_report.md
```

---

name: Bug report
about: Report a bug in Choicease
title: '\[BUG] '
labels: bug
-----------

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots / Console**
If applicable, add screenshots and console logs.

**Environment (please complete the following):**

* OS: \[e.g., macOS, Windows]
* Browser: \[e.g., Chrome 120]
* Version: \[if applicable]

```

### ISSUE_TEMPLATE/feature_request.md
```

---

name: Feature request
about: Suggest an idea for this project
title: '\[FEATURE] '
labels: enhancement
-------------------

**Is your feature request related to a problem? Please describe.**

**Describe the solution you'd like**

**Additional context / sketches / screenshots**

```

### PULL_REQUEST_TEMPLATE.md
```

## Description

Please include a summary of the change and which issue is fixed. Also include relevant motivation and context.

Fixes # (issue)

## Type of change

* [ ] Bug fix
* [ ] New feature
* [ ] Documentation update
* [ ] Other (please describe)

## Checklist

* [ ] My code follows the project style
* [ ] I have added necessary documentation
* [ ] DCO sign-off present on commits

```

---

## Questions or help
If you need help setting up a development environment or want example branches to start with, ping the maintainers via email (contact@choicease.com) or open an issue.

Thanks again — we look forward to your contributions! 🎉
```


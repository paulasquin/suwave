# Showcase kit

Template for project showcase sites (scroll-driven three.js acts, bilingual, journal, vertical video). Read README.md first: it holds the recipe, the act contract, the testing routine and the pitfalls already paid for.

- Code, comments and docs in English; site copy in French (default, in index.html and content.js) and English (strings.js, content.en.js).
- `js/kit/` is shared code: improve it here rather than diverging in a project copy, and port fixes back.
- Validate 3D on a real GPU (modal/) and on a phone profile before calling a site done; SwiftShader hides NaN shader bugs.
- Heavy work (GPU renders, video capture, big builds) goes to the Mac session `mac-guardia` when it is available, otherwise to an ephemeral Modal machine (workspace `photomate`).

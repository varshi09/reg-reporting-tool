# 02 — Technology Stack

Source of truth: `package.json` (root of repo). Every entry below was cross-checked against actual imports in `src/`.

## Runtime dependencies

| Package | Version (package.json) | Purpose | Verified usage in code |
|---|---|---|---|
| `next` | 16.3.0 | Application framework: App Router, file-based routing, API routes, Turbopack dev/build, font optimization | `src/app/**` (every page and API route), `next/font/google` in `src/app/layout.tsx`, `next/navigation` (`useRouter`) in `src/app/login/page.tsx`, `src/lib/useRequireAuth.ts`, `NextResponse`/`NextRequest`-style handlers in every `src/app/api/**/route.ts` |
| `react` | 19.2.8 | UI library | Every `.tsx` file under `src/app` and `src/components` |
| `react-dom` | 19.2.8 | React DOM renderer | Implicit via Next.js rendering pipeline |
| `oracledb` | ^7.0.1 | Oracle Database driver (node-oracledb) | `src/lib/db.ts` (connection pool via `oracledb.createPool`), `src/app/api/upload/route.ts` (`oracledb.STRING` bind type) |
| `exceljs` | ^4.4.0 | Excel (.xlsx) file generation and parsing | `src/lib/excelReportTemplate.ts` (shared workbook styling helpers), `src/app/api/brf01/export/route.ts`, `src/app/api/brf01-suptech/export/route.ts` (writing `.xlsx` exports), `src/app/api/upload/route.ts` (reading uploaded `.xlsx`/`.csv` files with `ExcelJS.Workbook`) |

## Development dependencies

| Package | Version | Purpose | Verified usage |
|---|---|---|---|
| `typescript` | ^5 | Static typing for the whole codebase | `tsconfig.json`, all `.ts`/`.tsx` files |
| `@types/node` | ^20 | Node.js type definitions | Implicit (used by `oracledb`, `node:stream` import in `src/app/api/upload/route.ts`) |
| `@types/react` | ^19 | React type definitions | Implicit across all `.tsx` |
| `@types/react-dom` | ^19 | React DOM type definitions | Implicit |
| `tailwindcss` | ^4 | Utility-first CSS framework | `src/app/globals.css` (`@import "tailwindcss";`, `@theme inline`) |
| `@tailwindcss/postcss` | ^4 | PostCSS plugin that wires Tailwind v4 into the build | `postcss.config.mjs` |
| `eslint` | ^9 | Linting | `eslint.config.mjs`, `npm run lint` script |
| `eslint-config-next` | 16.3.0 | Next.js-specific ESLint rules (core-web-vitals + TypeScript) | `eslint.config.mjs` |

**All 4 runtime dependencies and all 8 dev dependencies declared in `package.json` are actually used in the codebase.** No unused or orphaned packages were found, and no undeclared package is imported (i.e., no missing `package.json` entries were detected by inspection).

## Fonts

- **IBM Plex Sans** — primary UI font, loaded via `next/font/google` in `src/app/layout.tsx` (`IBM_Plex_Sans`, weights 400/500/600/700), exposed as the `--font-ibm-plex-sans` CSS variable and set as the default `font-family` in `src/app/globals.css`.
- **Geist Mono** — loaded alongside as `--font-geist-mono` in `src/app/layout.tsx` but not observed to be applied anywhere in the current styling (`globals.css` only assigns `--font-sans` to body text). Included by the Next.js scaffold; not confirmed as actively used for any visible text.

## Notable things that are declared/referenced but NOT present as real integrations

- **Tabler Icons CSS classes** (`ti ti-calendar`, `ti ti-building-bank`, etc.) are referenced as class names in `src/lib/reportCategories.ts` (the `icon` field) and rendered via `<i className={\`ti ${module.icon}\`} />` in `src/app/reports/[category]/page.tsx` and `src/app/reports/[category]/[module]/page.tsx`. **No Tabler Icons stylesheet or package is included** in `package.json`, and no `<link>` to a Tabler CDN was found in `src/app/layout.tsx`. These icon classes will not render any glyph in the current build — this is a minor, cosmetic gap (an empty `<i>` element with no visible icon), not a functional one.
- The hand-rolled `src/components/icons.tsx` module (SVG-based icons: `IconLock`, `IconHome`, `IconCloudUpload`, etc.) is the actual icon system used for the login page and app shell — no external icon library dependency.

## Database

- **Oracle Database 21 XE** (per project context/naming conventions such as `XEPDB1` in the connection string) is the target database. The application does not declare or vendor the database itself — it is an external dependency the app connects to via `oracledb`. See `03-System-Architecture.md` and `07-Deployment-Guide.md` for how this is provisioned.

## Build tooling

- **Turbopack** — Next.js 16's default bundler for `next dev`/`next build`; no custom Webpack config is present (`next.config.ts` only sets `allowedDevOrigins`).
- **Scripts** (`package.json`): `dev` (`next dev`), `build` (`next build`), `start` (`next start`), `lint` (`eslint`). **No `test` script exists.**

## Version note

`react@19.2.8` and `next@16.3.0` are both materially newer than versions widely documented as of this audit's knowledge cutoff; `AGENTS.md`/`CLAUDE.md` in the repo root explicitly warn that "this version has breaking changes" relative to older training data. Documentation and prior familiarity with Next.js should not be assumed to transfer 1:1 — always verify against `node_modules/next/dist/docs/` or the code itself.

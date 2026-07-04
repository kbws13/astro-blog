# Feishu Content Source Migration Plan

## Goal

Replace the current Notion build-time data source with Feishu Knowledge Base, Feishu Docs, and Feishu Bitable while keeping the Astro site static and preserving the existing blog, notes, projects, tags, categories, language routing, and Vercel deployment workflow.

The original code centralized Notion access in `src/lib/notion.ts`, then mapped it into site-facing collections in `src/utils/server.ts`. The active implementation now uses `src/lib/content-source` for Feishu access while keeping that boundary, so provider-specific API calls do not spread into page components.

## Source Model

Use Feishu Bitable as the metadata registry and Feishu Docs or Wiki nodes as the body source.

```text
Feishu App
  -> tenant_access_token
  -> Bitable registry records
      -> Type, Status, Lang, Slug, Tags, Category, Order, Source
  -> Feishu Wiki or Docx content
      -> Markdown or HTML for Astro rendering
  -> Astro build-time content APIs
  -> prerendered Vercel site
```

## Recommended Bitable Schema

Use one registry table unless there is a proven scale or permission reason to split it.

| Field | Type | Applies To | Purpose |
| --- | --- | --- | --- |
| `Title` | title/text | all | Display title |
| `Type` | single select | all | `Post`, `Page`, `Note`, `Project` |
| `Status` | single select | all | `Published`, `Draft`, `Hidden`, `Archived` |
| `Lang` | single select | all | `zh`, `en` |
| `Slug` | text | posts, pages, notes | Route slug. Notes may use nested paths like `topic/item` |
| `Source` | url/text | posts, pages, notes | Feishu document or wiki URL/token for body content |
| `Date` | date | posts | Publish date |
| `Tags` | multi select | posts | Tag list |
| `Category` | single select | posts/notes/projects | Category grouping |
| `Cover` | url/file | posts | Optional blog cover image, mapped to the theme `heroImage` UI |
| `Description` | text | projects | Summary text |
| `Order` | number | projects | Display order |
| `Image` | url/file | projects | Project image |
| `Site` | url | projects | Project site |
| `GitHub` | url | projects | Repository link |
| `Doc` | url | projects | Documentation link |
| `Release` | url | projects | Release link |

Filter records at the API layer with `Status = Published`. Do not fetch all records and filter visibility in page components.

## Environment Variables

Real credentials live in `.env`, which is ignored by Git.

| Variable | Required | Purpose |
| --- | --- | --- |
| `FEISHU_APP_ID` | yes | Feishu custom app ID |
| `FEISHU_APP_SECRET` | yes | Feishu custom app secret |
| `FEISHU_TEST_DOC_URL` | until migration verified | Test document URL used for connectivity and content extraction |
| `FEISHU_REGISTRY_APP_TOKEN` | yes | Bitable app token |
| `FEISHU_REGISTRY_TABLE_ID` | yes | Bitable table ID |
| `FEISHU_REGISTRY_VIEW_ID` | optional | Optional registry view ID |
| `FEISHU_WIKI_SPACE_ID` | required after migration | Wiki space ID for the user's `编程` knowledge base |
| `VERCEL_DEPLOY_HOOK_URL` | optional | Vercel Deploy Hook for rebuild automation |

Generated Feishu image files are written to `public/feishu-assets/` during local preview or build. This directory is ignored by Git because it is a build-time cache derived from Feishu document media tokens.

## External APIs

Use official Feishu Open Platform APIs.

- Tenant token: `POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal`
- Bitable record search: `POST https://open.feishu.cn/open-apis/bitable/v1/apps/:app_token/tables/:table_id/records/search`
- Wiki child nodes: `GET https://open.feishu.cn/open-apis/wiki/v2/spaces/:space_id/nodes`
- Docx block children: `GET https://open.feishu.cn/open-apis/docx/v1/documents/:document_id/blocks/:block_id/children`
- Document image download: `GET https://open.feishu.cn/open-apis/drive/v1/medias/:file_token/download`

The Feishu docs note that API permissions are not enough by themselves. The Feishu app also needs access to the concrete Bitable, Wiki, and Docs resources.

The content registry Bitable must live inside the user's `编程` knowledge base, not in the app-owned cloud-space root. This keeps the management table visible and manageable for the user.

## Architecture

Introduce a provider-neutral content source boundary.

```text
src/lib/content-source/
  types.ts
  index.ts
  feishu.ts

src/utils/server.ts
  consumes provider-neutral functions

Astro pages
  keep current collection and rendering behavior
```

Target public API:

- `getPosts()`
- `getPages()`
- `getNotes()`
- `getProjects()`
- `getPageContent(source)`

Provider-neutral types replace exported `Notion*` names.

## Implementation Steps

1. Add provider-neutral content types.
   - Create `src/lib/content-source/types.ts`.
   - Mirror the previous post, note, and project fields under neutral names.
   - Use provider-neutral source identifiers in site-facing types.

2. Add Feishu auth and API client.
   - Read `FEISHU_APP_ID` and `FEISHU_APP_SECRET`.
   - Cache `tenant_access_token` until near expiry.
   - Add typed request helper that checks Feishu `code !== 0` and reports `msg`.

3. Add Bitable registry loader.
   - Query only `Status = Published`.
   - Page through all results.
   - Normalize Feishu field shapes into content-source types.
   - Validate required fields per content type and fail the build with actionable errors.

4. Add document content extraction.
   - First verify whether the Feishu API can export or return Markdown for the test document.
   - If Markdown export is available, use it.
   - If not, implement a Docx block to Markdown converter covering headings, paragraphs, bold/italic/code text, links, lists, code blocks, quotes, tables, and images.
   - Keep unsupported block handling explicit. Unknown blocks should render a clear placeholder in development and fail only when they break published content.

5. Swap imports behind the existing site API.
   - Update `src/utils/server.ts` to consume provider-neutral functions.
   - Update dynamic blog and note routes to call `getPageContent`.
   - Remove direct Notion imports from pages.

6. Preserve rendering behavior.
   - Keep existing Markdown rendering through `remark-gfm`, `remark-math`, `rehype-katex`, and heading extraction.
   - Keep provider names out of Markdown rendering utilities.

7. Update setup files.
   - Update `.env.example`.
   - Remove Notion dependencies from `package.json` after Feishu path passes.
   - Update README only if user wants public setup instructions there.

8. Add rebuild automation documentation.
   - Use Vercel Deploy Hook as the rebuild trigger.
   - Keep `VERCEL_DEPLOY_HOOK_URL` secret.
   - Trigger from Feishu automation, manual script, or an internal command. Do not add a public unauthenticated endpoint to this Astro site.

## Connectivity Checklist

Before changing production data paths:

- [x] Feishu app has required API permissions.
- [x] Feishu app has access to the target Bitable.
- [x] Feishu app has access to the test document.
- [x] `FEISHU_APP_ID` and `FEISHU_APP_SECRET` are present in `.env`.
- [x] Tenant token request succeeds.
- [x] Test document URL can be parsed into a wiki node token or document token.
- [x] Bitable registry table and table ID are confirmed.
- [x] One `Post`, one `Note`, and one `Project` record can be read from Feishu.
- [x] One document body can be converted to Markdown or HTML with headings preserved.

Connectivity note from the first smoke check:

- `tenant_access_token` succeeded with Feishu `code: 0`.
- Resolving the provided wiki test document failed with Feishu `code: 131006`, message `permission denied: node permission denied, tenant needs read permission`.
- The app credentials are valid, but the Feishu app still needs resource permission on the concrete test wiki/document before document extraction can be verified.

Connectivity note from the second smoke check on 2026-07-03:

- `tenant_access_token` succeeded with Feishu `code: 0`.
- The provided wiki URL resolved successfully to a `docx` object titled `Agent`.
- Reading Docx child blocks succeeded with Feishu `code: 0`; the first page returned 20 blocks and `has_more: true`.
- `FEISHU_REGISTRY_APP_TOKEN` and `FEISHU_REGISTRY_TABLE_ID` are still empty, so Bitable registry reads have not been verified yet.

Registry creation note from 2026-07-03:

- Created Feishu Bitable `Astro Blog Content Registry` at `https://my.feishu.cn/base/PlhUbzqMDaE0aHsF1n3cLip4nue`.
- Created `Content` table with 18 fields matching the recommended schema.
- Saved `FEISHU_REGISTRY_APP_TOKEN` and `FEISHU_REGISTRY_TABLE_ID` into `.env`.
- Verified published-record search against the empty `Content` table with Feishu `code: 0`.
- Fixed the registry query field list to match the created schema exactly. Feishu returns `FieldNameNotFound` if `field_names` contains an alias such as `Url` when only `URL` exists.

Registry relocation note from 2026-07-03:

- The first registry Base was created in the app-owned cloud-space root, which made it hard for the user to see in the Feishu UI.
- Created a replacement Bitable node inside the `编程` knowledge base at `https://my.feishu.cn/wiki/UMEwwBeBzijZBikA2PXco5l9nZe`.
- Created a `Content` table in that knowledge-base Bitable with the same 18-field schema.
- Copied the 7 test records into the new `Content` table and deleted the default empty `Table`.
- Updated `.env` to use the knowledge-base Bitable app token and table ID.
- Future production registry work must use the `编程` knowledge-base Bitable.

Test data note from 2026-07-03:

- Added published test records: 2 `Note`, 1 `Post`, and 1 `Project`. Friend-link records were later removed when the links module was dropped.
- Added visibility-control test records: 1 `Draft` post and 1 `Hidden` note.
- Verified the published-record query still returns only 5 records after adding Draft/Hidden rows.
- `pnpm run build` generated `/blog/feishu-source-test/`, `/blog/Migration/`, `/notes/agent/`, `/notes/agent/nested-test/`, `/tags/Feishu/`, `/tags/Astro/`, `/tags/Test/`, `/projects/`, and `/rss.xml`.
- Verified `/blog/draft-hidden-test/` and `/notes/hidden-note-test/` were not generated.
- Removed the legacy Notion implementation and dependencies after the Feishu registry in `编程` passed tests and build.

Friend-link removal note from 2026-07-03:

- Removed the site Links pages (`/links` and `/en/links`), Friend Circle integration, friend-link schema/config, and provider-neutral `Link` content type.
- Removed the Feishu registry `Link` record, `URL` field, `Avatar` field, and `Link` option from the `Type` single-select field in the `编程` knowledge-base Bitable.
- After removing the `Link` type option, restored the remaining records' `Type` values. The registry now contains `Note:3`, `Post:2`, and `Project:1` records, with no friend-link records.

Post cover note from 2026-07-04:

- Added optional `Cover` field to the `编程` knowledge-base Bitable registry.
- `Cover` is mapped to `ContentPost.cover`, then to the existing theme `heroImage` object.
- Blog list cards and blog detail pages use the original Axi theme cover UI through `PostPreview.astro` and `Hero.astro`; no separate cover component is introduced.
- Filled the published `feishu-source-test` post with `https://picr2.axi404.top/1767811093734_image.webp` as a test cover image.

Note category note from 2026-07-04:

- `Note` records may use the optional `Category` field.
- `/notes` and `/en/notes` show categorized notes as category cards and uncategorized notes as direct note cards.
- Category cards link to `/notes/category/<category>` and `/en/notes/category/<category>`.
- The `category` route segment is reserved for note category listing pages so note slugs do not collide with category names.

## Implementation Checklist

- [x] Add content-source types.
- [x] Add Feishu auth client.
- [x] Add Bitable search wrapper.
- [x] Add registry field parser and validators.
- [x] Add initial Feishu document content extraction.
- [x] Add content cache for repeated page content calls during a build.
- [x] Update `src/utils/server.ts`.
- [x] Update blog detail routes.
- [x] Update note routes.
- [x] Update project routes if exported function names change.
- [x] Remove or isolate Notion-specific names from active page routes.
- [x] Remove legacy Notion source module and dependencies.
- [x] Update `.env.example`.
- [x] Run type checking.
- [x] Run production build.
- [x] Manually verify blog list, blog detail, tag pages, category pages, notes tree, projects page, and RSS.

## Acceptance Checklist

- [x] `pnpm run type:check` passes.
- [x] `pnpm run build` passes.
- [x] Published Feishu posts appear in `/blog` and `/en/blog` according to `Lang`.
- [x] Draft or hidden Feishu records do not appear anywhere.
- [x] Tags and categories match Bitable fields.
- [x] Note categories match the optional Bitable `Category` field and route under `/notes/category/<category>`.
- [x] Note nested paths render under `/notes` and `/en/notes`.
- [x] Project ordering matches `Order`.
- [x] Existing local MDX collections still work where intended.
- [x] RSS uses Feishu content successfully.
- [ ] Build errors identify the missing record field or inaccessible document clearly.

## Risks And Decisions

- Document conversion is the main unknown. Verify it with the provided test document before replacing all Notion code.
- Bitable advanced permissions can return empty data even when the API call succeeds. Treat empty results as a configuration error during migration.
- Do not add concurrency against one Bitable table until the first version is stable. Feishu documents that serially process table operations can return conflict or timeout errors.
- The legacy `src/lib/notion.ts` implementation and the `@notionhq/client` / `notion-to-md` dependencies have been removed after the Feishu path passed tests, real Bitable reads, and production build.
- The active Astro pages, RSS route, home stats, projects, tags, and note routes now consume `src/lib/content-source`.
- Blog post cover images are controlled by the optional Feishu registry `Cover` field and rendered through the existing Axi theme `heroImage` UI.
- Note category pages use the reserved `/notes/category/<category>` prefix. Do not create a note slug that starts with `category/` unless the routing design is revised.
- The friend-link module has been removed. The site no longer has `/links` or `/en/links`, the provider-neutral content source no longer exposes `Link` records, and the Feishu registry schema no longer includes `URL` or `Avatar` fields for friend links.
- Feishu Docx code blocks observed in the test wiki are `block_type: 14` with a `code` payload. The converter renders them as fenced Markdown and uses plain text inside code blocks so Feishu inline styles do not corrupt code.
- Feishu Docx images observed in the test wiki are `block_type: 27` with an image media token. The build-time content source downloads those images with tenant access token and emits Markdown image references to `/feishu-assets/...`.
- Feishu quote containers observed as `block_type: 34` are read recursively and rendered as Markdown blockquotes.
- Blocks with children are traversed recursively, so nested content is not silently dropped at the root-block boundary.

## Documentation Rule

Before any future functional, design, or architecture change, read this document. If the change affects content sourcing, data shape, routing, build behavior, deployment, or architecture, update this document in the same change.

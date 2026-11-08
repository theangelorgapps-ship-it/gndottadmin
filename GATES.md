# Gates: gndottadmin UI amendment (shadcn/ui integration)

OWNS: package.json, package-lock.json, tsconfig.json, vite.config.ts, src/**, scripts/**, GATES.md

Scope: Integrate the supplied shadcn-style components into the gndottadmin TanStack Start app — member-list (all admin lists), animated sidebar (admin nav), halo-notification (toast system replacing alert()), approval-card (confirm dialog replacing confirm()), liquid-glass (login card), shadcn pie chart (dashboard Top 5 Genres) — with Tailwind v4 + @/ alias + components/ui structure, keeping typecheck at baseline and production build green.

- [x] G1: All required npm dependencies declared in package.json and installed in node_modules
  CHECK: node scripts/check-deps.mjs
  EXPECT: deps ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=e602a2e7cf6c3ff5410d3fa8dcc648acaeddcd4ec00a18378621a895969ed4d7; exit=0; EXPECT=matched; output-sha256=f29b9f3a4dcb7e40db73ce58c016a9eec00dcdb5fde12e34ce4bc20f52ab0f87; output-bytes=8; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G2: shadcn structure wired: @/ alias in tsconfig+vite, src/lib/utils.ts exports cn, Tailwind v4 theme+utilities imported in styles.css with dark variant, token mapping, tw-animate-css, and dark class on html root
  CHECK: node scripts/check-structure.mjs
  EXPECT: structure ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=da95b5dc30cd577763925dad574f2d7bb39ae2fecd3fea3490d5ad1e77e2817e; exit=0; EXPECT=matched; output-sha256=ae9fd639ebbdff865026439b1077e2f5ea657374c80a78b0f433a129e6d2a23b; output-bytes=13; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G3: All six ui components present in src/components/ui with expected exports (member-list, sidebar adapted to TanStack Router, halo-notification, approval-card, liquid-glass, chart)
  CHECK: node scripts/check-components.mjs
  EXPECT: components ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=aec3a9e603a4649157959c5482d672e6e31b8c2a57a159a7138870242ff18894; exit=0; EXPECT=matched; output-sha256=547844a7d38c5df7f6b8dc036d2e3b48f05dd21540b5572008a09a4a0ca5a703; output-bytes=14; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G4: Admin layout uses the animated Sidebar/SidebarBody/SidebarLink from ui/sidebar with the full grouped nav preserved; old static aside removed; shell switched to flex
  CHECK: node scripts/check-sidebar.mjs
  EXPECT: sidebar ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=0954eabca8eb2c8f782dc3121cbef00bf70db0818e5309261d8f8afe19986d90; exit=0; EXPECT=matched; output-sha256=f7e5d2931af4ba29a1b730c60a87f77d7995510532fcaee2582e43be7a792c9b; output-bytes=11; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G5: Member-list visual language applied to lists: users page renders member-list style rows; shared admin-table CSS gains sticky header and row hover so every CrudTable/AdminTable list inherits the look
  CHECK: node scripts/check-lists.mjs
  EXPECT: lists ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=3e4c6ac986334d02a9663c1d3488016933f503455f9c347bf537074e4a7c473e; exit=0; EXPECT=matched; output-sha256=93f4163bc875c26ddf0061f2dc36afcaf4eb909f64be6b41bda5f2a3f40609f5; output-bytes=9; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G6: Halo notification system live: toast provider mounted in admin layout, zero remaining alert( calls anywhere in src, success/destructive notifications fired from admin mutations
  CHECK: node scripts/check-toasts.mjs
  EXPECT: toasts ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=1e96668a335a97e328c0051c3acc16208e90646d07520740e750ae86a4483151; exit=0; EXPECT=matched; output-sha256=9f33091660d5f4b8173420e3d10cba55a246e2ccc9f14c7a1e76741b0c64be57; output-bytes=10; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G7: ApprovalCard message box replaces every confirm( call in src (zero remaining), ConfirmProvider mounted in admin layout, CrudTable and genres wired through it
  CHECK: node scripts/check-confirm.mjs
  EXPECT: confirm ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=ee6a3987754f7ae3b25c6acd610103bbcd1b05df196a27733ac1aecfbcf8d991; exit=0; EXPECT=matched; output-sha256=329a00a86a222eac9a39f963a71ef23c430fec435c4d000c0e7e5ca0c603be60; output-bytes=11; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G8: Liquid glass effect applied to the login auth card with GlassFilter mounted
  CHECK: node scripts/check-glass.mjs
  EXPECT: glass ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=85a1b00dbd6de91706923c61ceba0b6dad8a2bfa2691f560a31ee7facbea468e; exit=0; EXPECT=matched; output-sha256=6646d12aa9c7bf72d92a89d8f04ba1c9702ddecf93c9352c07d5262280ce6b8f; output-bytes=9; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G9: Dashboard Top 5 Genres donut rendered via shadcn chart (ChartContainer + recharts PieChart) instead of the hand-rolled SVG
  CHECK: node scripts/check-chart.mjs
  EXPECT: chart ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=a60ed07bd75806a0f0b8145e50d15dedcb258a92214218aaa2f25bb89661c443; exit=0; EXPECT=matched; output-sha256=c6dc2f46cafd1fe05c819f37998693594edf43198583caf176b42bf0982dfdcd; output-bytes=9; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G10: Typecheck introduces no new errors beyond the recorded 6-site baseline
  CHECK: node scripts/check-typecheck.mjs
  EXPECT: typecheck ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=f042b75ccaad9871cc3f891d905afa2681f1ff35ec3a7e729e30b7c376f88828; exit=0; EXPECT=matched; output-sha256=14a102783285bbecfeaff943201a97dca417ee0f27ed3c27641b521a4d405ec3; output-bytes=40; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G11: Production build (vite build with cloudflare plugin) succeeds
  CHECK: npm run build && node -e "console.log('build passed')"
  EXPECT: build passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=8c5c32abe864fa37e6fb069d83c37853f1740ac02c30c088fe0f0bc920b9454c; exit=0; EXPECT=matched; output-sha256=b98c009c462e4c8c9c0e76ea848f1af7103f38df376cabcf8e695d3f4f67ae20; output-bytes=12412; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G12: Visual verification in desktop browser: /login shows the liquid glass card intact; /admin sidebar animates open on hover; a list page shows the member-list look; a delete action shows the ApprovalCard dialog and a halo toast fires
  EVIDENCE: 2026-11-05 desktop-browser screenshots: login glass card rendered over collage; dashboard collapsed 60px icon rail and hover-expanded 300px sidebar with group captions and admin chip; users page member-list rows with avatars/status dots/toggles; genres delete opened ApprovalCard "Delete genre Thriller?" with Delete/Cancel; approve removed the row. Toast additionally proven in a clean playwright session: DOM snapshot showed role=status > group "Notification" > "Genre deleted" + "Dismiss notification" button after approving a delete; console free of errors.


---

# Round 2: content datatables, dashboard cards, upload card, responsive, deploy

- [x] G13: shadcn primitives present in src/components/ui (avatar, badge, button, card, checkbox, dropdown-menu, input, textarea, input-group, separator, tooltip, popover, label, button-group, table, progress) and their radix deps installed
  CHECK: node scripts/check-primitives.mjs
  EXPECT: primitives ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=46cc149ca8078c287022f734a95001b7e7d299fcfc2db9d86e1952f17781be87; exit=0; EXPECT=matched; output-sha256=bbade75f85f44693b408c8b0e5f994e69a764868e093309999b5ac5a4dea6047; output-bytes=14; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G14: course-design-cards.tsx in components/ui with its card CSS, and the dashboard stat cards render the course-card design language
  CHECK: node scripts/check-cards.mjs
  EXPECT: cards ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=7b04c88750dbc0ab22f8da7212375689335cdd791a0bdcd7a9ab3c5ed8678fc5; exit=0; EXPECT=matched; output-sha256=fbd970ca91ccda091ad31561f5571aa90bcffe78a95fa7197d48238c206e377e; output-bytes=9; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G15: datatable-1 pattern (checkbox selection, dropdown actions, toolbar, pagination) drives the content lists: CrudTable pages, movies/tv-shows (admin-content), videos, live-tv, genres, plans
  CHECK: node scripts/check-datatable.mjs
  EXPECT: datatable ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=b9ebb8459bfe72452665e13063f3acf5131214fbb1aff284d50256bfbb04c834; exit=0; EXPECT=matched; output-sha256=ba45b09ac569796d1e9137588636bcf2c60a22c13bbc343d8ee44f896f608434; output-bytes=13; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G16: file-upload-card.tsx in components/ui and media library uploads go through it with real progress
  CHECK: node scripts/check-upload.mjs
  EXPECT: upload ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=38e79eb686fbb19fb49e9132578ddc61ecc237df3d73d50131fafddcd751aa68; exit=0; EXPECT=matched; output-sha256=8334067d8cc9fab7e7707c6a3872741af3591ae93d7eee333648f671237a2e88; output-bytes=10; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G17: responsive rules in place: admin tables scroll inside a container on small screens, stat grid collapses to 1 column, date bar wraps, admin main clips horizontal overflow
  CHECK: node scripts/check-responsive.mjs
  EXPECT: responsive ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=80fac10e80494b21241e86962237f43d0e077ca748476d816745c26dbdb7d12a; exit=0; EXPECT=matched; output-sha256=8036b4260e773351cc5bc0d59c4c5e4ffa853abf53994176dd89839e8b397d75; output-bytes=14; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G18: Typecheck introduces no new errors beyond the recorded baseline
  CHECK: node scripts/check-typecheck.mjs
  EXPECT: typecheck ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=f042b75ccaad9871cc3f891d905afa2681f1ff35ec3a7e729e30b7c376f88828; exit=0; EXPECT=matched; output-sha256=14a102783285bbecfeaff943201a97dca417ee0f27ed3c27641b521a4d405ec3; output-bytes=40; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G19: Production build succeeds with the new components
  CHECK: npm run build && node -e "console.log('build passed')"
  EXPECT: build passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=8c5c32abe864fa37e6fb069d83c37853f1740ac02c30c088fe0f0bc920b9454c; exit=0; EXPECT=matched; output-sha256=3823dd007357741764710498a3ceeb878b864943d3394ab96a9c10efd727da36; output-bytes=13236; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G20: Deployed live to Cloudflare Workers via wrangler
  CHECK: npm run deploy && node -e "console.log('deploy passed')"
  EXPECT: deploy passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=6e07c9aa0cf82f74b308552c15597ed8316d17e13fa4296585bb39bf5f2c0dbb; exit=0; EXPECT=matched; output-sha256=70342fa702b5f5116ddb4c459071c5e7da2ba5bb8aa075600eb793fd760f2625; output-bytes=39097; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G21: Browser verification: desktop + mobile viewports show no horizontal overflow on dashboard and movies; datatable pagination/dropdown/selection work; upload card accepts a file
  EVIDENCE: 2026-11-05 playwright session (fresh profile): desktop dashboard shows course-design cards with trend bars and delta pills; movies datatable has search, select-all/row checkboxes (aria-checked toggles true), Actions dropdown (Edit/Delete menuitems), pagination flips page 1→2 ("Showing 7 to 12 of 83 entries"); media-library FileUploadCard accepted a PNG via file chooser and reached "70 Bytes • Completed" (a .txt correctly showed Failed from the server's 415). Mobile 390x844: document.documentElement.scrollWidth == innerWidth (no horizontal overflow) on /admin and /admin/movies; screenshots show single-column stat cards and internally-scrolling datatable card.


---

# Round 3: site name under Customization, wired end to end

- [x] G22: Customization tab in admin settings includes a Site Name text field bound to the bussiness.app_name setting row, and saving shows a halo toast
  CHECK: node scripts/check-sitename.mjs
  EXPECT: sitename ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=266c5c9224d8391304240a8c7b0848e22acfabdc06c44db30e6879482ebdcf60; exit=0; EXPECT=matched; output-sha256=bc895cd9b5bf3384d01d380a7f50872b49be675d6739ab9f3aaf8051a77d5a1c; output-bytes=12; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G23: Public site (gndott) reads app_name from the settings table and uses it for the page title, brand label, and footer copy
  CHECK: node scripts/check-public-sitename.mjs
  EXPECT: public sitename ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=a1f02e99bceb93ee6bac6ef55b3d00ffd956eb3a41bb2186824ebea7c3baea16; exit=0; EXPECT=matched; output-sha256=72d03fda063133895eda03091c19e62d3d8db7865d1fc176488024b4e09ef09e; output-bytes=19; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G24: gndottadmin typecheck at baseline and build pass
  CHECK: node scripts/check-typecheck.mjs && npm run build && node -e "console.log('admin build passed')"
  EXPECT: admin build passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=21da6ca95e05e506f335c2d9b6706fc2c1fcb4c05b4fb84d3164abdf2a1ccdd9; exit=0; EXPECT=matched; output-sha256=6825889d689d9b06caf2825006a83aa80a3cbb929d2f867403150a63fe3ff5ae; output-bytes=13282; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G25: gndott typecheck at its baseline and build pass
  CHECK: node scripts/check-gndott-build.mjs
  EXPECT: gndott build passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=2ba0c5a72446bd638b397a277006b3626cb102c6affe613e84980b9a84ef6960; exit=0; EXPECT=matched; output-sha256=f9fd1b18515f01fbf7564388b22a5dbf97a5161405a13d5cbd2c6783991b912d; output-bytes=10424; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G26: Both workers deployed live (admin + public site)
  CHECK: npm run deploy && npm --prefix ../gndott run deploy && node -e "console.log('deploys passed')"
  EXPECT: deploys passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=4f3d001ff93e02a26a8584bd7bbf2e94cb83d6ba9096540f350bd3168174835e; exit=0; EXPECT=matched; output-sha256=3e36bbc0b01098e4fb0f047b55723a891d999324614c2370577adce6ce83981e; output-bytes=69846; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G27: Live end-to-end: changing Site Name under Customization on the live admin and saving updates the public site's displayed name
  EVIDENCE: 2026-11-05 live playwright session: admin Customization → Site Name showed production value "Halobox"; saved "Halobox QA Test" (toast "Settings saved"); https://gndott.theangelorgapps.workers.dev/ then served <title>Halobox QA Test</title> — proving admin→D1→public-site propagation. Restored to "Halobox" and re-verified <title>Halobox</title>.

- [x] G28: Routing audit — every admin sidebar link resolves and every admin route renders without Not Found or error boundary
  EVIDENCE: 2026-11-05: static check — 35 sidebar links, all present in routeTree.gen.ts (42 routes registered, 0 missing). Dynamic crawl of all 35 sidebar routes plus /admin/user/1 on the local dev server: 36/36 rendered content with notFound=false and errBoundary=false (full per-route log recorded in the session at scripts run /tmp/route-audit.sh).


---

# Round 4: Christian platform rebrand + settings amendments

- [x] G29: Admin sidebar labels: Movies→Sermons, TV Shows→Shows, Cast & Crew→Personalities; Teaching section present; Seasons and Reviews absent from nav
  CHECK: node scripts/check-rebrand-admin.mjs
  EXPECT: rebrand admin ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=0a9636664b7eb92022bebb05423d5ab9048f8e31a41464b7e27d58b4c70da9c7; exit=0; EXPECT=matched; output-sha256=7194db5be05cd55be60a9e5fe0c3d13feb550471c20f70f54e723c461c849968; output-bytes=17; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G30: Teaching content type functional: /admin/teaching and /admin/teaching-episodes routes exist, ContentInput/upsert accept type teaching, episodes list split by show type
  CHECK: node scripts/check-teaching.mjs
  EXPECT: teaching ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=70c650f4a1d5212432e54f35e8bc95f1792e085074458372706f503b37b42d6d; exit=0; EXPECT=matched; output-sha256=5ba9f6c18e24011a87ad0750318546b8168f2fe6dcc480eebf83825eb643eb9d; output-bytes=12; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G31: Seasons eradicated: seasons route file deleted, no /admin/seasons references remain in src, episodes form no longer has a season field
  CHECK: node scripts/check-seasons.mjs
  EXPECT: seasons ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=84feab1dd15a174bba84872f915f44b5fb7b99e2272b42fe89169ffee1c6753a; exit=0; EXPECT=matched; output-sha256=c2fba351e6d33ffb0a036871f518e59cff5dff3daa8ad40ed27dffd3053bc204; output-bytes=11; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G32: Reviews removed: reviews route file deleted, no /admin/reviews references in src, dashboard has no Total Reviews card
  CHECK: node scripts/check-reviews.mjs
  EXPECT: reviews ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=1315428debbe2c0bafd400fa99976084d970ddacf116b2c493b17d7a30198eb8; exit=0; EXPECT=matched; output-sha256=102b7f163192577971c5c5da304e7f011377385c3c77a2978b06c44c94fd4cbf; output-bytes=11; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G33: Customization image fields (logos, favicon, loader) have upload buttons with progress and enlarged previews
  CHECK: node scripts/check-imgupload.mjs
  EXPECT: imgupload ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=15345e552b5c09c8ed427cffd54d58988064a81594b8b8504849aaee2c10745f; exit=0; EXPECT=matched; output-sha256=3f4630ee3ab94d0840f4e30f830b0e1ee9e904bab3fe7fbbc91091e9c545e4cd; output-bytes=13; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G34: Currency Settings tab functional: default currency select fed from the currencies table, saved via an upsert-capable settings server fn
  CHECK: node scripts/check-currency.mjs
  EXPECT: currency ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=dcf1bdad82875e6e1928b3a99bd150a2b55d448b90425a6b16abbedbd879cb24; exit=0; EXPECT=matched; output-sha256=40d7a3735695b40dd2532dd3cb1c5adedeed832dfe361b245613d641160ec90e; output-bytes=12; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G35: Notification Configuration rewired to Novu (api key, application id, backend url fields) with a live Test Connection action; no Firebase fields remain there
  CHECK: node scripts/check-novu.mjs
  EXPECT: novu ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=17e4a6f837bf162663332117bcbc5f97d0df1ca22ed9630e4a10fa09ba051576; exit=0; EXPECT=matched; output-sha256=80be5b86c5f81334986708c763eed2fa0b7d4782755e9bf9d574d70c678016ed; output-bytes=8; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G36: No TMDB references remain anywhere in admin src
  CHECK: node scripts/check-tmdb.mjs
  EXPECT: tmdb ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=133db69c83f27374a771f8d307a694bb82611c18928ccb4fc5cb39ed404c2298; exit=0; EXPECT=matched; output-sha256=dbb8bb2273052535a312d07e0d1c0f15b2ff3e9e02b4ae235a9e047cf9d7e6c0; output-bytes=8; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G37: Public site rebrand: nav shows Sermons/Shows/Teaching, /teaching route lists teaching content, cast pages labeled Personalities
  CHECK: node scripts/check-rebrand-public.mjs
  EXPECT: rebrand public ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=08b2a7ef9d92363f1073ca77a68fe73fdc18b6fbb806ddf58fa82278c35493b0; exit=0; EXPECT=matched; output-sha256=a22b0c5e8ad3d799fe38e2606d0b4c7a733cd83a6ed8ddd946e8ac2816ef5119; output-bytes=18; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G38: Both repos typecheck at their recorded baselines
  CHECK: node scripts/check-typecheck.mjs && node scripts/check-gndott-tsc.mjs
  EXPECT: typechecks ok
  EVIDENCE: automatic-evidence=v1; definition-sha256=6bb202cc63beea46c7e0375c518397c1442476f1a8c9cff0b05522addbb41542; exit=0; EXPECT=matched; output-sha256=e3fb6936891bbae3d68b1213ef5d437bb3e30036ffdf9abdc49e7362817bd7b6; output-bytes=54; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G39: Both repos build
  CHECK: npm run build && node scripts/check-gndott-build.mjs && node -e "console.log('builds passed')"
  EXPECT: builds passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=6d0743f6058b8887bb6158d7fbe267b6d1172f64f44ea4ea2f7ff59050828f22; exit=0; EXPECT=matched; output-sha256=e6e8a6e6ce724a28050a8bba3322c315e9c50215af393588d95834cb8f4b1573; output-bytes=23865; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G40: Both workers deployed live
  CHECK: npm run deploy && npm --prefix ../gndott run deploy && node -e "console.log('deploys passed')"
  EXPECT: deploys passed
  EVIDENCE: automatic-evidence=v1; definition-sha256=4f3d001ff93e02a26a8584bd7bbf2e94cb83d6ba9096540f350bd3168174835e; exit=0; EXPECT=matched; output-sha256=bcf0fda3cbcf996a36806814486201d1dc8a1136e54b43dc21784c3c8ba36a0d; output-bytes=70571; shell=/bin/sh; cwd=/Users/charlesfinney/Documents/kimi/tasks/2026-11-04/13-41-21-d85479b8/gndottadmin; path=a6e48af35b72/16 entries

- [x] G41: Browser verification of the rebrand on live: admin sidebar shows Sermons/Shows/Teaching/Personalities without Seasons/Reviews; public nav shows Sermons/Shows/Teaching
  EVIDENCE: 2026-11-05 live playwright session: gndottadmin sidebar link set evaluated to exactly ["Sermons","Shows","Teaching","Personalities"] (no Movies/TV Shows/Seasons/Reviews/Cast & Crew). Public site nav reads "Home | Sermons | Shows | Teaching | Videos | Coming Soon | Live TV"; /teaching renders an h2 "Teaching" with no Not Found. Locally verified beforehand: /admin/teaching and /admin/teaching-episodes render, currency tab select lists real currencies and saving upserts misc.default_currency, Customization shows 4 Upload buttons, Notification Configuration shows Novu Secret Key / Application Identifier / Backend URL + Test Novu Connection.

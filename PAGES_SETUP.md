# GitHub Pages activation

The site files and deployment workflow are ready. The repository's Pages site has not yet been enabled, and the workflow token cannot create it because GitHub requires both **Pages: write** and **Administration: write** for that API operation.

## One-time repository setting

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open **Actions → Build and deploy Qingdao travel map → Run workflow** and run it on `main`.

The workflow will then:

- validate `index.html` against SHA-256 `6b05b78ebd638649a04cafb013f9acdc560add90c69f2127c01dda93af328086`;
- upload the site artifact;
- deploy GitHub Pages;
- request the live page and verify its title and MarkerCluster dependency;
- update `DEPLOYMENT.md` only with the actual result.

Expected project-site address after successful activation:

`https://1337816143.github.io/travel-plans/`

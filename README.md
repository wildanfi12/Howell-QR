# Howell visitor registration

This repository contains the static visitor registration page served by GitHub Pages and the Google Apps Script source that writes submissions to a Google Sheet.

## Architecture

- index.html is the static site entry point. It serves the registration form and posts submissions to the configured Apps Script web app.
- google-apps-script.js is the backend source. It validates submissions and appends accepted leads to the sheet named Leads Indocomtech 2026.
- CNAME configures the custom domain howellcable.site.
- This repository has no JavaScript framework, package manager, build step, or dependency lockfile. GitHub Pages serves the static files from the main branch.
- The Apps Script project is maintained separately from this repository. Updating this file alone does not update the deployed Google Apps Script web app.

## Local checks

Requires Node.js 20 or later. Run the built-in regression suite with:

    node --test tests/registration.test.cjs

Check JavaScript syntax with:

    node --check google-apps-script.js

The tests use mocked Google Apps Script services. They do not submit data to the live sheet or send WhatsApp messages.

For a manual browser flow using the local mock endpoint, run:

    node tests/mock-server.cjs

Then open http://127.0.0.1:4173/ and use synthetic visitor details. The server binds only to loopback, rewrites the Apps Script endpoint in memory, and does not persist the submitted fields.

## Backend update procedure

1. Open the Google Sheet's Apps Script project.
2. Replace its server code with google-apps-script.js.
3. Save and create a new web app deployment version.
4. Confirm its deployment URL matches SHEET_URL in index.html.
5. Test the updated endpoint with synthetic data in a non-production sheet before enabling it for visitors.

The Apps Script web app must return its fixed HTML acknowledgement from an iframe for the page to verify that a row was written. The response embeds only a fixed status and a request ID; it must not include visitor data. The iframe origin check and destination origin in the frontend and backend must remain synchronized. Script Cache provides best-effort deduplication for immediate retries; Google may evict cache entries early, so this is not a durable idempotency guarantee.

## Cache and performance notes

There is no service worker, local build cache, or application cache in this repository. GitHub Pages and Google delivery cache headers are managed outside the repository and were not modified here. Do not cache registration submissions or visitor data. The page references only the Howell and Indocomtech logo files; the other repository images are not referenced by the page.

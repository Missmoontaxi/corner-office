# 0006. CareBird's mark appears inside the fiction, never on the frame

*Status: accepted Fri 2026-11-13 · Date: 2026-11-13 · Decider: Paula McMahon*

## Context

Corner Office has two layers. The frame is Paula's showcase, with the title, the byline, the dock and the "Built by Paula McMahon" credit. Inside it sit in-world documents, like Alex Ellery's brief, that belong to CareBird, the fictional company.

CareBird now has a brand (the Sheltering Fold bird, Teal and Ochre, Nunito Sans) and a public site at carebird.moontaxilab.com. A visitor who skips the byline should still learn whose company the brief belongs to, and anyone curious should be able to visit the company.

A bird next to the Corner Office title was considered and set aside. It would make the showcase read as a CareBird product and blur the line between the fiction and the builder.

## Decision

- The brief header reads "Alex Ellery, Founder and CEO, CareBird" on wider screens and "Alex Ellery, CareBird" on phones, with the ivory bird on a small brand-teal tile before the company name. Brand teal (#376B65) alone is too dark to read on the frame's near-black, and the tile keeps the exact brand color.
- The word CareBird links to https://carebird.moontaxilab.com/ in a new tab from the brief header, the desktop byline and the footer line on every view. The address lives in one constant, `CAREBIRD_URL` in `lib/desk/shared.ts`.
- The mark is a copy of the brand's ivory symbol SVG, served from `public/brand/carebird/`.
- The frame keeps its own look. CareBird's colors, mark and type appear only on in-world surfaces.

## Consequences

- Name, role and company in the header come from the day's persona data, so a seed change flows through without a code change.
- If the brand mark changes, replace the SVG in `public/brand/carebird/` from the brand's source files.
- Nunito Sans for in-world documents is a later, separate change. The header keeps the frame's font for now, since at this size the difference does not show.

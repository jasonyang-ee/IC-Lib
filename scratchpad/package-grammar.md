# Package grammar fixture

`package-samples.json` records 30 real or source-backed package strings. It covers IC, discrete, passive, and connector-adjacent package vocabulary; `N/A`, `SOT-23-5`, and `TO-252-3` exercise the `packageType` fallback route documented in `SPEC.md` R24.

Resolver contract: strip terminal dimensional notes repeatedly, split alternate package names on commas or semicolons, try the whole token before a leading/trailing pin count or one terminal modifier, then fall back to IPC-7351B dimensional parsing. `expectedCanonical: null` is an explicit pass-through outcome, never a guessed canonical package.

Sources: DigiKey product/detail results for CAT93C46VI-G, TMAG5110B4AQDBVR, MCP660-E/ML, AD8222HBCPZ-R7, ADA4858-3ACPZ-R2, BQ24230RGTR, AUIRLR2703, DMTH10H025SK3-13, C1005X5R1V105K050BE, and MMSZ5248BS00J3; Mouser TPS62400 and Si522xx datasheets; `SPEC.md` R18-R22.
